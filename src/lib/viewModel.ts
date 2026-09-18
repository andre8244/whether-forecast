/** Pure merge of the three API responses into one hour-keyed view model. */

import { convectiveProbability, groupMembers } from './stormRisk'
import { consensusFor } from './modelConsensus'
import { instantOf, timestampOf } from './format'
import type {
  AirQualityPoint,
  AirQualityResponse,
  DayPoint,
  EnsembleResponse,
  ForecastResponse,
  ForecastViewModel,
  GeoLocation,
  HourPoint,
  MultiModelResponse,
} from '../types/weather'

/** How many hours of the hourly strip are shown. */
export const HOURLY_WINDOW = 48

export interface MergeInput {
  location: GeoLocation
  forecast: ForecastResponse
  ensemble: EnsembleResponse | null
  comparison: MultiModelResponse | null
  airQuality: AirQualityResponse | null
  degraded: string[]
  now?: number
  fetchedAt?: number
}

/**
 * Index of the first hour at or after `now`, clamped so a window always fits.
 *
 * The comparison runs on true instants, not on the naive local strings: for a
 * location in another timezone those differ by the whole UTC offset.
 */
function startIndex(times: string[], now: number, utcOffsetSeconds: number): number {
  const found = times.findIndex((time) => instantOf(time, utcOffsetSeconds) >= now)
  if (found < 0) return Math.max(0, times.length - HOURLY_WINDOW)
  // Keep the hour currently in progress rather than jumping to the next one.
  return Math.max(0, found - 1)
}

/**
 * One value from a series that an older cached payload may not carry at all.
 *
 * The cache holds raw API responses, so a build that adds a variable will read
 * back payloads written before it existed. Indexing those directly threw, and
 * the throw happened inside the cached render, which left the page on its
 * loading banner with no way out but clearing storage by hand.
 */
function at<T>(series: (T | null)[] | undefined, index: number): T | null {
  return series?.[index] ?? null
}

export function buildViewModel(input: MergeInput): ForecastViewModel {
  const { location, forecast, ensemble, comparison, airQuality, degraded } = input
  const now = input.now ?? Date.now()
  const fetchedAt = input.fetchedAt ?? now

  const { hourly, daily, current } = forecast
  const hours = hourly.time.length
  const utcOffset = forecast.utc_offset_seconds

  const storm = ensemble
    ? convectiveProbability(groupMembers(ensemble.hourly), hours)
    : { combined: [], perModel: {}, spread: [], rain: [] }

  const consensus = comparison ? consensusFor(comparison, hours) : []

  const models = Object.keys(storm.perModel)

  const allHours: HourPoint[] = hourly.time.map((time, i) => {
    const cape = at(hourly.cape, i)
    const liftedIndex = at(hourly.lifted_index, i)
    const cin = at(hourly.convective_inhibition, i)

    const stormPerModel: Record<string, number | null> = {}
    for (const model of models) stormPerModel[model] = at(storm.perModel[model], i)

    return {
      time,
      timestamp: timestampOf(time),
      temperature: at(hourly.temperature_2m, i),
      apparentTemperature: at(hourly.apparent_temperature, i),
      precipitationProbability: at(hourly.precipitation_probability, i),
      precipitation: at(hourly.precipitation, i),
      snowfall: at(hourly.snowfall, i),
      weatherCode: at(hourly.weather_code, i),
      cloudCover: at(hourly.cloud_cover, i),
      humidity: at(hourly.relative_humidity_2m, i),
      pressure: at(hourly.surface_pressure, i),
      windSpeed: at(hourly.wind_speed_10m, i),
      windGusts: at(hourly.wind_gusts_10m, i),
      windDirection: at(hourly.wind_direction_10m, i),
      uvIndex: at(hourly.uv_index, i),
      visibility: at(hourly.visibility, i),
      freezingLevel: at(hourly.freezing_level_height, i),
      cape,
      liftedIndex,
      cin,
      stormProbability: at(storm.combined, i),
      stormPerModel,
      stormSpread: at(storm.spread, i),
      rainProbability: at(storm.rain, i),
      modelConsensus: at(consensus, i),
    }
  })

  const from = startIndex(hourly.time, now, utcOffset)
  const window = allHours.slice(from, from + HOURLY_WINDOW)

  const days: DayPoint[] = daily.time.map((date, i) => {
    // No daily ensemble field exists, so the day's peak is taken from its hours.
    const dayHours = allHours.filter((hour) => hour.time.startsWith(date))
    const probabilities = dayHours
      .map((hour) => hour.stormProbability)
      .filter((value): value is number => value !== null)

    return {
      date,
      timestamp: timestampOf(date),
      weatherCode: at(daily.weather_code, i),
      tempMax: at(daily.temperature_2m_max, i),
      tempMin: at(daily.temperature_2m_min, i),
      apparentMax: at(daily.apparent_temperature_max, i),
      apparentMin: at(daily.apparent_temperature_min, i),
      precipitationSum: at(daily.precipitation_sum, i),
      precipitationProbabilityMax: at(daily.precipitation_probability_max, i),
      uvIndexMax: at(daily.uv_index_max, i),
      windSpeedMax: at(daily.wind_speed_10m_max, i),
      windGustsMax: at(daily.wind_gusts_10m_max, i),
      sunrise: at(daily.sunrise, i) ?? '',
      sunset: at(daily.sunset, i) ?? '',
      stormProbabilityMax: probabilities.length ? Math.max(...probabilities) : null,
    }
  })

  return {
    location,
    timezone: forecast.timezone,
    elevation: forecast.elevation,
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      weatherCode: current.weather_code,
      cloudCover: current.cloud_cover,
      pressure: current.surface_pressure,
      windSpeed: current.wind_speed_10m,
      windGusts: current.wind_gusts_10m,
      windDirection: current.wind_direction_10m,
      isDay: current.is_day === 1,
    },
    hourly: window,
    daily: days,
    airQuality: pickAirQuality(airQuality, now, utcOffset),
    sunrise: at(daily.sunrise, 0) ?? '',
    sunset: at(daily.sunset, 0) ?? '',
    fetchedAt,
    observedAt: instantOf(current.time, utcOffset),
    degraded,
  }
}

/** Air quality for the hour closest to now, or null when unavailable. */
function pickAirQuality(
  response: AirQualityResponse | null,
  now: number,
  utcOffsetSeconds: number,
): AirQualityPoint | null {
  if (!response) return null
  const { hourly } = response
  // Same coordinates as the forecast, so the same UTC offset applies.
  const i = startIndex(hourly.time, now, utcOffsetSeconds)
  if (i >= hourly.time.length) return null

  return {
    europeanAqi: at(hourly.european_aqi, i),
    pm2_5: at(hourly.pm2_5, i),
    pm10: at(hourly.pm10, i),
    ozone: at(hourly.ozone, i),
    nitrogenDioxide: at(hourly.nitrogen_dioxide, i),
  }
}
