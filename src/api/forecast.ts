import { getJson } from './client'
import type { ForecastResponse } from '../types/weather'

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
