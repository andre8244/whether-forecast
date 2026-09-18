import { getJson } from './client'
import type { EnsembleResponse } from '../types/weather'

const ENDPOINT = 'https://ensemble-api.open-meteo.com/v1/ensemble'

/**
 * Three models pooled in one request: ~119 members over 168 hours.
 *
 * Each variable multiplies the payload by the member count, so only the three
 * the storm probability is built from are requested: ~18 kB gzipped against
 * ~7 kB for the weather code alone.
 *
 * ICON global EPS publishes no CAPE — every value comes back null — so it
 * contributes to the rain share and drops out of the convective probability.
 * That is handled where the members are read, not here.
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
      hourly: ['weather_code', 'cape', 'precipitation'],
      models: MODELS,
      forecast_days: 7,
      timezone: 'auto',
    },
    signal,
  )
}
