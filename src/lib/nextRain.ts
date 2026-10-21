/**
 * When the forecast expects the next precipitation.
 *
 * "Quando piove?" is the question people open a weather app for, and the app
 * answered it only by making them read the hourly strip themselves.
 *
 * An hour counts when the deterministic run has rain in it — depth or a
 * precipitation code — or, failing that, when most of the ensemble does. The
 * strip shows rain icons on that second ground too, and a line naming a later
 * hour than the icons beside it, or none at all, was the app contradicting
 * itself. Which ground it was is returned, because a time read off a share of
 * 25 km members is a likelihood rather than a forecast hour, and the wording
 * says so.
 *
 * Only the probable band counts, not the possible one: a line giving a time
 * has to be worth acting on, and from 30% it would fire in most unsettled
 * hours. The strip's icons carry that band.
 */

import { RAIN_LIKELY } from './rainOutlook'
import { isWetCode } from './wmo'
import type { HourPoint } from '../types/weather'

/** Hourly depth, mm, at or above which an hour counts as wet. */
export const RAIN_MIN = 0.1

export interface NextRain {
  hour: HourPoint
  /** Hours from the one in progress: 1 is the next hour. */
  inHours: number
  /** Whether the deterministic run or only the ensemble has rain in that hour. */
  source: 'model' | 'ensemble'
}

function isWet(hour: HourPoint): boolean {
  return (hour.precipitation ?? 0) >= RAIN_MIN || isWetCode(hour.weatherCode)
}

/**
 * The first wet hour after the one in progress, or null.
 *
 * `hours[0]` is the hour already under way, and whether it is raining now is
 * what the condition itself reports, so the search starts after it.
 */
export function nextRain(hours: HourPoint[]): NextRain | null {
  for (let i = 1; i < hours.length; i += 1) {
    const hour = hours[i]
    if (isWet(hour)) return { hour, inHours: i, source: 'model' }
    if ((hour.rainProbability ?? 0) >= RAIN_LIKELY) return { hour, inHours: i, source: 'ensemble' }
  }
  return null
}

/**
 * True when the deterministic run has rain in the hour in progress.
 *
 * The model alone: an ensemble majority this hour already turns the card's
 * condition to "Possibile pioggia", and counting it here would only hide the
 * line about the hours after.
 */
export function rainingNow(hours: HourPoint[]): boolean {
  const current = hours[0]
  return current !== undefined && isWet(current)
}
