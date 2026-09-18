/**
 * When the forecast expects the next precipitation.
 *
 * "Quando piove?" is the question people open a weather app for, and the app
 * answered it only by making them read the hourly strip themselves.
 *
 * The test is the deterministic run's own output — depth or a precipitation
 * code — so the answer always matches the strip below it. The ensemble may
 * disagree, and where it does the current card says so on its own line; this
 * is not the place to blend the two.
 */

import { isWetCode } from './wmo'
import type { HourPoint } from '../types/weather'

/** Hourly depth, mm, at or above which an hour counts as wet. */
export const RAIN_MIN = 0.1

export interface NextRain {
  hour: HourPoint
  /** Hours from the one in progress: 1 is the next hour. */
  inHours: number
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
    if (isWet(hours[i])) return { hour: hours[i], inHours: i }
  }
  return null
}

/** True when it is already raining in the hour in progress. */
export function rainingNow(hours: HourPoint[]): boolean {
  const current = hours[0]
  return current !== undefined && isWet(current)
}
