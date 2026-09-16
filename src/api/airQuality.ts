import { getJson } from './client'
import type { AirQualityResponse } from '../types/weather'

const ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const HOURLY = ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'european_aqi']

export function fetchAirQuality(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<AirQualityResponse> {
  return getJson<AirQualityResponse>(
    ENDPOINT,
    { latitude, longitude, hourly: HOURLY, forecast_days: 3, timezone: 'auto' },
    signal,
  )
}
