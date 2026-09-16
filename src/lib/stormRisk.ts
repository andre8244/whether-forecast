/**
 * Thunderstorm probability from the ensemble members, plus the deterministic
 * convective indices reported on their own published scales.
 *
 * The Open-Meteo `thunderstorm_probability` field is accepted by the API but
 * returns null for most models, so the probability here is computed from the
 * ensemble: the share of members forecasting a thunderstorm code at each hour.
 */

import { isThunderstormCode } from './wmo'
import type { GroupedMembers, StormProbability } from '../types/weather'

/** Below this share of members reporting, an hour yields null instead of 0. */
const MIN_DATA_RATIO = 0.5

/** Per-model spread above this many points is flagged as disagreement. */
export const DISAGREEMENT_THRESHOLD = 30

const MEMBER_KEY = /^weather_code_member\d+_(.+)$/
const CONTROL_KEY = /^weather_code_(.+)$/

export const MODEL_LABELS: Record<string, string> = {
  ecmwf_ifs025_ensemble: 'ECMWF',
  icon_global_eps: 'ICON',
  ncep_gefs025: 'GFS',
}

export function labelForModel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId
}

/**
 * Split the flat ensemble response into member series grouped by model.
 *
 * Keys arrive as `weather_code_member01_ecmwf_ifs025_ensemble`, and the model
 * suffix is not always the id that was requested (`gfs025` comes back as
 * `ncep_gefs025`), so grouping reads whatever follows `memberNN_` rather than
 * matching against the requested names.
 *
 * The unsuffixed control run `weather_code_<model>` counts as a member. A bare
 * `weather_code` key, present only in single-model responses, is skipped so it
 * cannot double-count the control.
 */
export function groupMembers(
  hourly: Record<string, unknown>,
): GroupedMembers {
  const grouped: GroupedMembers = {}

  for (const [key, series] of Object.entries(hourly)) {
    if (key === 'time' || key === 'weather_code' || !Array.isArray(series)) continue

    const member = MEMBER_KEY.exec(key)
    const model = member ? member[1] : CONTROL_KEY.exec(key)?.[1]
    if (!model) continue

    ;(grouped[model] ??= []).push(series as (number | null)[])
  }

  return grouped
}

function probabilityForHour(members: (number | null)[][], hour: number): number | null {
  let withData = 0
  let stormy = 0

  for (const series of members) {
    const code = series[hour]
    if (code === null || code === undefined) continue
    withData += 1
    if (isThunderstormCode(code)) stormy += 1
  }

  if (members.length === 0 || withData < members.length * MIN_DATA_RATIO) return null
  return Math.round((stormy / withData) * 100)
}

/**
 * Combined and per-model thunderstorm probability, 0-100, one value per hour.
 *
 * Each model carries equal weight: the headline is the mean of the per-model
 * probabilities, not a count over the pooled membership. Counting members
 * would let ECMWF decide 41% of the answer purely because its centre runs 50
 * members against GFS's 30, which is a fact about compute budgets rather than
 * about the weather.
 *
 * Models with no usable data for an hour drop out of that hour's mean instead
 * of counting as zero.
 */
export function thunderstormProbability(
  grouped: GroupedMembers,
  hourCount: number,
): StormProbability {
  const models = Object.keys(grouped)

  const combined: (number | null)[] = []
  const perModel: Record<string, (number | null)[]> = {}
  const spread: (number | null)[] = []

  for (const model of models) perModel[model] = []

  for (let hour = 0; hour < hourCount; hour += 1) {
    const values: number[] = []
    for (const model of models) {
      const value = probabilityForHour(grouped[model], hour)
      perModel[model].push(value)
      if (value !== null) values.push(value)
    }

    combined.push(
      values.length === 0
        ? null
        : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    )
    spread.push(values.length < 2 ? null : Math.max(...values) - Math.min(...values))
  }

  return { combined, perModel, spread }
}

export function modelsDisagree(spread: number | null): boolean {
  return spread !== null && spread > DISAGREEMENT_THRESHOLD
}

/**
 * Convective indices, each reported on its own published scale.
 *
 * An earlier version combined CAPE, lifted index and CIN into a single ordinal
 * band by adding and subtracting steps. The individual thresholds were
 * conventional but that composition rule had no source, so it is gone: each
 * index is now reported separately against the scale it actually comes with.
 *
 * They describe how much energy the atmosphere holds and whether it can be
 * released. They are context for the ensemble probability, never a substitute:
 * high CAPE with no trigger produces no storm at all.
 */

export interface IndexReading {
  /** Short Italian label for the band. */
  label: string
  /** What that band implies, in one clause. */
  detail: string
  /** Colour token, or a neutral one where severity would mislead. */
  token: string
}

/**
 * CAPE, convective available potential energy, in J/kg.
 *
 * Conventional convective-energy table as used in operational forecasting
 * (see NWS convective parameter references).
 */
export function capeReading(cape: number | null): IndexReading | null {
  if (cape === null) return null
  if (cape < 300) return { label: 'trascurabile', detail: 'Energia insufficiente per la convezione.', token: 'var(--risk-none)' }
  if (cape < 1000) return { label: 'debole', detail: 'Convezione possibile solo con forte innesco.', token: 'var(--risk-low)' }
  if (cape < 2500) return { label: 'moderata', detail: 'Energia sufficiente per temporali organizzati.', token: 'var(--risk-moderate)' }
  if (cape < 4000) return { label: 'elevata', detail: 'Energia da temporali forti.', token: 'var(--risk-high)' }
  return { label: 'estrema', detail: 'Energia da temporali violenti.', token: 'var(--risk-extreme)' }
}

/**
 * Lifted index, in °C: parcel temperature minus environment at 500 hPa.
 *
 * Scale as published by the NWS: 0 to -3 marginally unstable, -3 to -6
 * moderately unstable, -6 to -9 very unstable, below -9 extremely unstable.
 */
export function liftedIndexReading(liftedIndex: number | null): IndexReading | null {
  if (liftedIndex === null) return null
  if (liftedIndex > 0) return { label: 'stabile', detail: 'L’aria sollevata resta più fredda dell’ambiente.', token: 'var(--risk-none)' }
  if (liftedIndex > -3) return { label: 'poco instabile', detail: 'Temporali sparsi possibili.', token: 'var(--risk-low)' }
  if (liftedIndex > -6) return { label: 'moderatamente instabile', detail: 'Temporali probabili, qualcuno forte.', token: 'var(--risk-moderate)' }
  if (liftedIndex > -9) return { label: 'molto instabile', detail: 'Fenomeni severi probabili.', token: 'var(--risk-high)' }
  return { label: 'estremamente instabile', detail: 'Condizioni da temporali pericolosi.', token: 'var(--risk-extreme)' }
}

/**
 * Convective inhibition, in J/kg.
 *
 * Open-Meteo reports CIN as a positive magnitude rather than the negative
 * value the textbooks use, so the bands are read on |CIN|. Thresholds follow
 * the common operational split: under 25 weak, 25-50 moderate, 50-200
 * significant, above 200 strong enough to suppress development.
 *
 * Deliberately neutral in colour: strong inhibition means *fewer* storms, so
 * a red badge here would read backwards next to CAPE and the lifted index.
 */
export function cinReading(cin: number | null): IndexReading | null {
  if (cin === null) return null
  const magnitude = Math.abs(cin)
  const token = 'var(--text)'
  if (magnitude < 25) return { label: 'debole', detail: 'Nessun freno: la convezione parte facilmente.', token }
  if (magnitude < 50) return { label: 'moderata', detail: 'Serve un po’ di riscaldamento per innescare.', token }
  if (magnitude <= 200) return { label: 'significativa', detail: 'Serve un innesco deciso per rompere il tappo.', token }
  return { label: 'forte', detail: 'Tappo robusto: sviluppo temporalesco ostacolato.', token }
}

/** Colour token for a 0-100 probability, matching the band palette. */
export function probabilityToken(probability: number | null): string {
  if (probability === null) return 'var(--risk-none)'
  if (probability >= 60) return 'var(--risk-extreme)'
  if (probability >= 40) return 'var(--risk-high)'
  if (probability >= 20) return 'var(--risk-moderate)'
  if (probability >= 5) return 'var(--risk-low)'
  return 'var(--risk-none)'
}
