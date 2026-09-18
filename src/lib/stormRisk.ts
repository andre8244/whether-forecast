/**
 * Convective-storm probability from the ensemble members, plus the
 * deterministic convective indices reported on their own published scales.
 *
 * The Open-Meteo `thunderstorm_probability` field is accepted by the API but
 * returns null for most models, so the probability is computed from the
 * members. It used to be the share of members carrying a thunderstorm weather
 * code, which measurement showed to be a dead metric: over seven days at one
 * point, ICON global EPS produced code 95/96/99 in 0 of 6720 member-hours,
 * GFS025 in 0 of 5208, ECMWF in 14 of 8568 (0.16%). The same check over the
 * Amazon and over Singapore — thunderstorms most afternoons — returned zero
 * from all three models. Global ensembles resolve no convection, so the code
 * almost never survives their post-processing, and the panel read "unlikely"
 * everywhere and always.
 *
 * A member now counts when it has the rain *and* the energy to have convected:
 * precipitation at or above `CONVECTIVE_PRECIPITATION_MIN` together with CAPE
 * at or above `CONVECTIVE_CAPE_MIN`, or the thunderstorm code on the rare
 * occasion a model does emit it.
 */

import { isThunderstormCode } from './wmo'
import type { GroupedMembers, MemberSeries, StormProbability } from '../types/weather'

/** Below this share of members reporting, an hour yields null instead of 0. */
const MIN_DATA_RATIO = 0.5

/** Per-model spread above this many points is flagged as disagreement. */
export const DISAGREEMENT_THRESHOLD = 30

/**
 * Convective energy, J/kg, at or above which a raining member is counted.
 *
 * Deliberately low: the precipitation in the same member is the evidence that
 * something triggered, so this only has to rule out rain falling from a column
 * with no energy to convect. Measured against three days of live members, it
 * separates the cases it should: frontal rain over Bergen with every member wet
 * scored 0, while the Pesaro afternoon that prompted this scored 74.
 */
export const CONVECTIVE_CAPE_MIN = 500

/** Hourly precipitation, mm, at or above which a member counts as raining. */
export const CONVECTIVE_PRECIPITATION_MIN = 0.2

/** Hourly precipitation, mm, at or above which a member counts for the rain share. */
export const MEMBER_RAIN_MIN = 0.1

const MEMBER_KEY = /^(weather_code|cape|precipitation)_member(\d+)_(.+)$/
const CONTROL_KEY = /^(weather_code|cape|precipitation)_(.+)$/

export const MODEL_LABELS: Record<string, string> = {
  ecmwf_ifs025_ensemble: 'ECMWF',
  icon_global_eps: 'ICON',
  ncep_gefs025: 'GFS',
}

export function labelForModel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId
}

const VARIABLE_FIELD = {
  weather_code: 'weatherCode',
  cape: 'cape',
  precipitation: 'precipitation',
} as const

function emptyMember(): MemberSeries {
  return { weatherCode: [], cape: [], precipitation: [] }
}

/**
 * Split the flat ensemble response into member series grouped by model.
 *
 * Keys arrive as `cape_member01_ecmwf_ifs025_ensemble`, and the model suffix is
 * not always the id that was requested (`gfs025` comes back as `ncep_gefs025`),
 * so grouping reads whatever follows `memberNN_` rather than matching against
 * the requested names. The three variables of one member are joined on that
 * member number, which is why members are collected in a map before being
 * flattened into a list.
 *
 * The unsuffixed control run `<variable>_<model>` counts as a member. A bare
 * `weather_code`, `cape` or `precipitation` key, present only in single-model
 * responses, matches neither pattern — both require a model suffix — so it
 * cannot double-count the control.
 */
export function groupMembers(hourly: Record<string, unknown>): GroupedMembers {
  const byModel: Record<string, Map<string, MemberSeries>> = {}

  for (const [key, series] of Object.entries(hourly)) {
    if (key === 'time' || !Array.isArray(series)) continue

    const member = MEMBER_KEY.exec(key)
    const control = member ? null : CONTROL_KEY.exec(key)
    const match = member ?? control
    if (!match) continue

    const variable = match[1] as keyof typeof VARIABLE_FIELD
    const model = member ? member[3] : control![2]

    const members = (byModel[model] ??= new Map())
    const id = member ? member[2] : 'control'
    const entry = members.get(id) ?? emptyMember()
    entry[VARIABLE_FIELD[variable]] = series as (number | null)[]
    members.set(id, entry)
  }

  const grouped: GroupedMembers = {}
  for (const [model, members] of Object.entries(byModel)) grouped[model] = [...members.values()]
  return grouped
}

/**
 * Share of members meeting `counts`, over the members `evaluable` accepts.
 *
 * A member that cannot be judged is left out of both the numerator and the
 * denominator, and a model where too few members can be judged yields null
 * rather than a zero it has not earned. That is what keeps ICON global EPS,
 * which serves no CAPE, out of the convective mean instead of dragging it
 * down: none of its members are evaluable, so the model reports nothing.
 */
function shareForHour(
  members: MemberSeries[],
  hour: number,
  evaluable: (member: MemberSeries, hour: number) => boolean,
  counts: (member: MemberSeries, hour: number) => boolean,
): number | null {
  let withData = 0
  let hits = 0

  for (const member of members) {
    if (!evaluable(member, hour)) continue
    withData += 1
    if (counts(member, hour)) hits += 1
  }

  if (members.length === 0 || withData < members.length * MIN_DATA_RATIO) return null
  return Math.round((hits / withData) * 100)
}

function hasConvectiveInputs(member: MemberSeries, hour: number): boolean {
  const cape = member.cape[hour]
  const precipitation = member.precipitation[hour]
  return cape !== null && cape !== undefined && precipitation !== null && precipitation !== undefined
}

function isConvective(member: MemberSeries, hour: number): boolean {
  const cape = member.cape[hour] ?? 0
  const precipitation = member.precipitation[hour] ?? 0
  const wetEnough = precipitation >= CONVECTIVE_PRECIPITATION_MIN
  const energetic = cape >= CONVECTIVE_CAPE_MIN
  return (wetEnough && energetic) || isThunderstormCode(member.weatherCode[hour])
}

function hasPrecipitation(member: MemberSeries, hour: number): boolean {
  const precipitation = member.precipitation[hour]
  return precipitation !== null && precipitation !== undefined
}

function isWet(member: MemberSeries, hour: number): boolean {
  return (member.precipitation[hour] ?? 0) >= MEMBER_RAIN_MIN
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/**
 * Combined and per-model convective-storm probability, 0-100, one per hour,
 * with the share of members forecasting any precipitation alongside.
 *
 * Each model carries equal weight: the headline is the mean of the per-model
 * probabilities, not a count over the pooled membership. Counting members
 * would let ECMWF decide 41% of the answer purely because its centre runs 50
 * members against GFS's 30, which is a fact about compute budgets rather than
 * about the weather.
 *
 * Models with no usable data for an hour drop out of that hour's mean instead
 * of counting as zero, so the storm mean runs over the models that publish
 * CAPE while the rain share keeps all three.
 */
export function convectiveProbability(
  grouped: GroupedMembers,
  hourCount: number,
): StormProbability {
  const models = Object.keys(grouped)

  const combined: (number | null)[] = []
  const perModel: Record<string, (number | null)[]> = {}
  const spread: (number | null)[] = []
  const rain: (number | null)[] = []

  for (const model of models) perModel[model] = []

  for (let hour = 0; hour < hourCount; hour += 1) {
    const values: number[] = []
    const wet: number[] = []

    for (const model of models) {
      const value = shareForHour(grouped[model], hour, hasConvectiveInputs, isConvective)
      perModel[model].push(value)
      if (value !== null) values.push(value)

      const wetShare = shareForHour(grouped[model], hour, hasPrecipitation, isWet)
      if (wetShare !== null) wet.push(wetShare)
    }

    combined.push(mean(values))
    spread.push(values.length < 2 ? null : Math.max(...values) - Math.min(...values))
    rain.push(mean(wet))
  }

  return { combined, perModel, spread, rain }
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
