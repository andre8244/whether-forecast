/**
 * One rule for whether an hour or a day reads as rain, used by every card.
 *
 * Icons used to come from the deterministic run alone, so an hour or a day
 * where it had no rain read "Coperto" however many ensemble members were wet.
 * The bands follow the convention of the services that publish theirs: NWS
 * words its point forecasts as a "chance" of rain from 30% and as rain from
 * 60%, and Yr's long-range symbol shows rain once most ensemble members do.
 *
 * The share is the only input. The current card once also turned on two of
 * three global models seeing rain, but measured over ten places and eight
 * days that added 15 of 1655 dry hours: those models are the control runs of
 * the same ensembles, so when they agree the share has almost always passed
 * 30% already. A second trigger also meant an icon that could disagree with
 * the percentage printed beside it, which a single input rules out.
 *
 * The model's icon is kept whenever it already shows precipitation, since it
 * carries the type and intensity the share cannot: a share says how likely
 * rain is, not whether it is drizzle, snow or a downpour.
 */

import { describeCode, iconFor, isWetCode } from './wmo'
import type { HourPoint } from '../types/weather'

/** Share of members, 0-100, from which rain is called possible. */
export const RAIN_POSSIBLE = 30

/** Share of members, 0-100, from which rain is called probable. */
export const RAIN_LIKELY = 60

export interface Condition {
  label: string
  icon: string
  /** The model's own label, set only when the ensemble overrules it. */
  modelLabel?: string
}

/**
 * The condition to show for a model code and an ensemble share.
 *
 * A null share — the ensemble call failed, or the hour is past its reach —
 * leaves the model's condition as it is.
 */
export function conditionFor(
  code: number | null | undefined,
  share: number | null | undefined,
  isDay = true,
): Condition {
  const model = describeCode(code)
  const own = { label: model.label, icon: iconFor(code, isDay) }
  if (isWetCode(code) || share === null || share === undefined) return own

  if (share >= RAIN_LIKELY) return { label: 'Pioggia probabile', icon: '🌧️', modelLabel: own.label }
  if (share >= RAIN_POSSIBLE)
    return { label: 'Possibile pioggia', icon: '🌦️', modelLabel: own.label }
  return own
}

/**
 * The rain percentage to print for an hour: the same share the icon is read
 * from, so the two cannot disagree. Open-Meteo's own figure, from a single
 * 30-member ensemble, stands in only when the three-model share is missing.
 */
export function hourRainChance(hour: HourPoint): number | null {
  return hour.rainProbability ?? hour.precipitationProbability
}
