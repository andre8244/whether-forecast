/**
 * Where three independent global models stand on rain, hour by hour.
 *
 * The headline condition comes from one deterministic run — Open-Meteo's
 * `best_match`, which over Italy is ICON-D2 at about 2 km. On the afternoon
 * that prompted this it reported overcast and 0.0 mm for every hour while it
 * rained, and the app had nothing to set against it.
 *
 * Comparing that against the ensemble answers a different question: 25 km
 * members disagree with a 2 km run about *when* rain falls even when both
 * expect it, so their timing mismatch is not evidence of an error. These are
 * deterministic runs like the headline, from the three centres that publish
 * one globally, so a disagreement here is like compared with like.
 *
 * It no longer decides anything. Two of three models seeing rain used to
 * overrule a dry headline on its own, but they are the control runs of the
 * ensembles behind the rain share and almost never disagree with it, so the
 * share decides alone (see `rainOutlook`) and the split is shown as detail.
 */

import { isWetCode } from './wmo'
import type { ModelConsensus, MultiModelResponse } from '../types/weather'

/** Hourly precipitation, mm, at or above which a model is forecasting rain. */
export const MODEL_RAIN_MIN = 0.1

const LABELS: Record<string, string> = {
  icon_global: 'ICON',
  ecmwf_ifs025: 'ECMWF',
  gfs_global: 'GFS',
}

export function labelForComparisonModel(modelId: string): string {
  return LABELS[modelId] ?? modelId
}

interface ModelSeries {
  precipitation: (number | null)[]
  weatherCode: (number | null)[]
}

const KEY = /^(precipitation|weather_code)_(.+)$/

const FIELD = {
  precipitation: 'precipitation',
  weather_code: 'weatherCode',
} as const

/**
 * Split the flat response into one series pair per model.
 *
 * Bare `precipitation` and `weather_code` keys, which single-model responses
 * carry, have no model suffix and so match nothing.
 */
export function groupModels(hourly: Record<string, unknown>): Record<string, ModelSeries> {
  const models: Record<string, ModelSeries> = {}

  for (const [key, series] of Object.entries(hourly)) {
    if (key === 'time' || !Array.isArray(series)) continue

    const match = KEY.exec(key)
    if (!match) continue

    const [, variable, model] = match
    const entry = (models[model] ??= { precipitation: [], weatherCode: [] })
    entry[FIELD[variable as keyof typeof FIELD]] = series as (number | null)[]
  }

  return models
}

function isWet(series: ModelSeries, hour: number): boolean | null {
  const precipitation = series.precipitation[hour]
  const code = series.weatherCode[hour]
  const noRain = precipitation === null || precipitation === undefined
  const noCode = code === null || code === undefined
  // Past the end of a shorter series both read as missing, which is not a
  // forecast of dry weather.
  if (noRain && noCode) return null
  return (precipitation ?? 0) >= MODEL_RAIN_MIN || isWetCode(code)
}

/**
 * One split per hour, models named by label. Hours where no model reported
 * yield null rather than an empty split, so a gap cannot read as agreement.
 */
export function modelConsensus(
  models: Record<string, ModelSeries>,
  hourCount: number,
): (ModelConsensus | null)[] {
  const ids = Object.keys(models)
  const consensus: (ModelConsensus | null)[] = []

  for (let hour = 0; hour < hourCount; hour += 1) {
    const wet: string[] = []
    const dry: string[] = []

    for (const id of ids) {
      const verdict = isWet(models[id], hour)
      if (verdict === null) continue
      ;(verdict ? wet : dry).push(labelForComparisonModel(id))
    }

    consensus.push(wet.length + dry.length === 0 ? null : { wet, dry })
  }

  return consensus
}

/** Convenience for the one call site that has the raw response. */
export function consensusFor(
  comparison: MultiModelResponse,
  hourCount: number,
): (ModelConsensus | null)[] {
  return modelConsensus(groupModels(comparison.hourly), hourCount)
}
