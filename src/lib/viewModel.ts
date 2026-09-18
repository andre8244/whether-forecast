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
    const cape = hourly.cape[i] ?? null
    const liftedIndex = hourly.lifted_index[i] ?? null
    const cin = hourly.convective_inhibition[i] ?? null

    const stormPerModel: Record<string, number | null> = {}
    for (const model of models) stormPerModel[model] = storm.perModel[model][i] ?? null

    return {
      time,
      timestamp: timestampOf(time),
      temperature: hourly.temperature_2m[i] ?? null,
      apparentTemperature: hourly.apparent_temperature[i] ?? null,
      precipitationProbability: hourly.precipitation_probability[i] ?? null,
      precipitation: hourly.precipitation[i] ?? null,
      snowfall: hourly.snowfall[i] ?? null,
      weatherCode: hourly.weather_code[i] ?? null,
      cloudCover: hourly.cloud_cover[i] ?? null,
      humidity: hourly.relative_humidity_2m[i] ?? null,
      pressure: hourly.surface_pressure[i] ?? null,
      windSpeed: hourly.wind_speed_10m[i] ?? null,
      windGusts: hourly.wind_gusts_10m[i] ?? null,
      windDirection: hourly.wind_direction_10m[i] ?? null,
      uvIndex: hourly.uv_index[i] ?? null,
      cape,
      liftedIndex,
      cin,
      stormProbability: storm.combined[i] ?? null,
      stormPerModel,
      stormSpread: storm.spread[i] ?? null,
      rainProbability: storm.rain[i] ?? null,
      modelConsensus: consensus[i] ?? null,
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
      weatherCode: daily.weather_code[i] ?? null,
      tempMax: daily.temperature_2m_max[i] ?? null,
      tempMin: daily.temperature_2m_min[i] ?? null,
      apparentMax: daily.apparent_temperature_max[i] ?? null,
      apparentMin: daily.apparent_temperature_min[i] ?? null,
      precipitationSum: daily.precipitation_sum[i] ?? null,
      precipitationProbabilityMax: daily.precipitation_probability_max[i] ?? null,
      uvIndexMax: daily.uv_index_max[i] ?? null,
      windSpeedMax: daily.wind_speed_10m_max[i] ?? null,
      windGustsMax: daily.wind_gusts_10m_max[i] ?? null,
      sunrise: daily.sunrise[i] ?? '',
      sunset: daily.sunset[i] ?? '',
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
    sunrise: daily.sunrise[0] ?? '',
    sunset: daily.sunset[0] ?? '',
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
    europeanAqi: hourly.european_aqi[i] ?? null,
    pm2_5: hourly.pm2_5[i] ?? null,
    pm10: hourly.pm10[i] ?? null,
    ozone: hourly.ozone[i] ?? null,
    nitrogenDioxide: hourly.nitrogen_dioxide[i] ?? null,
  }
}
