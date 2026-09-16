import { getJson } from './client'
import type { EnsembleResponse } from '../types/weather'

const ENDPOINT = 'https://ensemble-api.open-meteo.com/v1/ensemble'

/**
 * Three models pooled in one request: ~119 members over 168 hours, ~60 kB.
 * Only `weather_code` is requested — adding variables multiplies the payload
 * by the member count.
 */
const MODELS = ['ecmwf_ifs025', 'icon_global', 'gfs025']

export function fetchEnsemble(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<EnsembleResponse> {
  return getJson<EnsembleResponse>(
    ENDPOINT,
    {
      latitude,
      longitude,
      hourly: 'weather_code',
      models: MODELS,
      forecast_days: 7,
      timezone: 'auto',
    },
    signal,
  )
}
