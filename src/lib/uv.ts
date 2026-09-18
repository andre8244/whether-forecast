/**
 * The strongest ultraviolet still ahead.
 *
 * The details card used to show the UV index for the hour in progress, which
 * is 0 for every hour of the night: a tile that spends half its life saying
 * nothing. What a reader can act on is when the sun is next at its worst, so
 * the peak of the coming day is reported instead, with the hour it falls on.
 */

import type { HourPoint } from '../types/weather'

/** How far ahead the peak is looked for. */
export const UV_WINDOW_HOURS = 24

export interface UvPeak {
  value: number
  /** Local ISO time of the peak hour. */
  time: string
}

/**
 * Highest UV index in the next `UV_WINDOW_HOURS`, or null when the window
 * holds no sunlight at all — a polar winter, or a model that omits the field.
 *
 * Ties go to the earlier hour: of two equal peaks, the one the reader will
 * meet first is the one worth naming.
 */
export function peakUv(hours: HourPoint[], span = UV_WINDOW_HOURS): UvPeak | null {
  let peak: UvPeak | null = null

  for (const hour of hours.slice(0, span)) {
    const value = hour.uvIndex
    if (value === null || value <= 0) continue
    if (peak === null || value > peak.value) peak = { value, time: hour.time }
  }

  return peak
}
