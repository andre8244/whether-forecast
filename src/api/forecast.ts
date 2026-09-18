import { getJson } from './client'
import type { ForecastResponse, MultiModelResponse } from '../types/weather'

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const CURRENT = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'is_day',
]

const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'weather_code',
  'cloud_cover',
  'relative_humidity_2m',
  'surface_pressure',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'uv_index',
  'cape',
  'lifted_index',
  'convective_inhibition',
]

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'uv_index_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'sunrise',
  'sunset',
]

/** Metric units are Open-Meteo's default, so no unit parameters are needed. */
export function fetchForecast(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  return getJson<ForecastResponse>(
    ENDPOINT,
    {
      latitude,
      longitude,
      current: CURRENT,
      hourly: HOURLY,
      daily: DAILY,
      forecast_days: 7,
      timezone: 'auto',
    },
    signal,
  )
}

/**
 * The same hours from three independent global models, for cross-checking the
 * headline condition.
 *
 * `best_match` picks the best available model for the point, which over Italy
 * is ICON-D2 — so comparing against `icon_seamless` would compare it with
 * itself. These are the three centres' own global runs instead: coarser than
 * the headline, but genuinely separate forecasts. Two variables over 7 days
 * cost about 1 kB gzipped.
 */
const COMPARISON_MODELS = ['icon_global', 'ecmwf_ifs025', 'gfs_global']

export function fetchModelComparison(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<MultiModelResponse> {
  return getJson<MultiModelResponse>(
    ENDPOINT,
    {
      latitude,
      longitude,
      hourly: ['precipitation', 'weather_code'],
      models: COMPARISON_MODELS,
      forecast_days: 7,
      timezone: 'auto',
    },
    signal,
  )
}
