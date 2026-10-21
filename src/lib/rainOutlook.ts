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

/**
 * 2 m temperature, °C, at or below which precipitation is called snow, and
 * up to which it may be either.
 *
 * A model with nothing falling says nothing about the type, and the share
 * counts any precipitation, so the type is read from the temperature. The
 * split is the forecasters' rule of thumb — snow commonly reaches the ground
 * up to about 1-2 °C — rather than anything calibrated; a band names the
 * uncertain middle instead of guessing.
 */
export const SNOW_MAX = 1
export const MIXED_MAX = 3

export type PrecipitationKind = 'rain' | 'mixed' | 'snow'

/** Rain without a temperature, which is what the label always said before. */
export function precipitationKind(temperature: number | null | undefined): PrecipitationKind {
  if (temperature === null || temperature === undefined) return 'rain'
  if (temperature <= SNOW_MAX) return 'snow'
  if (temperature <= MIXED_MAX) return 'mixed'
  return 'rain'
}

/** What falls, as the subject of a sentence: "Neve nel 70% degli scenari". */
export const PRECIPITATION_NOUN: Record<PrecipitationKind, string> = {
  rain: 'Pioggia',
  mixed: 'Pioggia o neve',
  snow: 'Neve',
}

const OUTLOOK: Record<PrecipitationKind, { possible: string; likely: string; icon: string }> = {
  rain: { possible: 'Possibile pioggia', likely: 'Pioggia probabile', icon: '🌧️' },
  mixed: { possible: 'Possibile pioggia o neve', likely: 'Pioggia o neve probabile', icon: '🌨️' },
  snow: { possible: 'Possibile neve', likely: 'Neve probabile', icon: '🌨️' },
}

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
 * leaves the model's condition as it is. The temperature only picks between
 * rain and snow when the ensemble overrules the model.
 */
export function conditionFor(
  code: number | null | undefined,
  share: number | null | undefined,
  isDay = true,
  temperature?: number | null,
): Condition {
  const model = describeCode(code)
  const own = { label: model.label, icon: iconFor(code, isDay) }
  if (isWetCode(code) || share === null || share === undefined) return own

  const kind = precipitationKind(temperature)
  const outlook = OUTLOOK[kind]
  if (share >= RAIN_LIKELY)
    return { label: outlook.likely, icon: outlook.icon, modelLabel: own.label }
  if (share >= RAIN_POSSIBLE) {
    // The sun-and-rain glyph reads as showers; snow keeps its own.
    const icon = kind === 'rain' ? '🌦️' : outlook.icon
    return { label: outlook.possible, icon, modelLabel: own.label }
  }
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
