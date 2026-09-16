/**
 * A background that follows the sun.
 *
 * The palette is anchored to the day's actual sunrise and sunset rather than
 * to fixed clock hours, so the colour turns when the sky outside does. Every
 * colour that carries text is derived from the interpolated sky and then
 * forced to clear WCAG AA, because a background that moves cannot have its
 * foregrounds chosen by hand.
 */

import {
  AA_CONTRAST,
  bestContrast,
  ensureContrast,
  mixHex,
  parseHex,
  relativeLuminance,
} from './color'

/** Keyframes of the sky, from deep night through to deep night. */
export const SKY_COLORS = {
  night: '#0b1220',
  twilight: '#38325e',
  dawn: '#e0876b',
  morning: '#bfdcef',
  day: '#9ed2f0',
  golden: '#f0b27a',
  sunset: '#dd6f57',
} as const

/** Used when the location's sun times are unknown. */
export const FALLBACK_SUNRISE_MINUTES = 7 * 60
export const FALLBACK_SUNSET_MINUTES = 19 * 60

/**
 * Above this luminance the sky is treated as a daylight background and the
 * app's light token set is used; below it, the dark set.
 *
 * Set just under the dawn colour's luminance so sunrise brings the light
 * surfaces up with it, while the deeper sunset red keeps the dark ones. The
 * day then opens light and closes dark, which is the way it actually goes.
 */
const DAYLIGHT_LUMINANCE = 0.32

/** How much sky is blended into the card surfaces, keeping them cohesive. */
const CARD_TINT = 0.1

interface Stop {
  /** Minutes from midnight. */
  at: number
  color: string
}

/** Minutes past midnight for an API local-time string. */
export function minutesOfDay(time: string): number {
  const hours = Number(time.slice(11, 13))
  const minutes = Number(time.slice(14, 16))
  return hours * 60 + minutes
}

/**
 * Colour stops for a day with the given sun times.
 *
 * The daylight plateau is pinned to the midpoint when the day is too short
 * for it, which is what keeps a polar winter from producing crossed stops.
 */
export function skyStops(sunrise: number, sunset: number): Stop[] {
  const noon = (sunrise + sunset) / 2
  const dayStart = Math.min(sunrise + 105, noon)
  const dayEnd = Math.max(sunset - 105, noon)

  return [
    { at: sunrise - 75, color: SKY_COLORS.night },
    { at: sunrise - 35, color: SKY_COLORS.twilight },
    { at: sunrise, color: SKY_COLORS.dawn },
    { at: Math.min(sunrise + 45, dayStart), color: SKY_COLORS.morning },
    { at: dayStart, color: SKY_COLORS.day },
    { at: dayEnd, color: SKY_COLORS.day },
    { at: Math.max(sunset - 45, dayEnd), color: SKY_COLORS.golden },
    { at: sunset, color: SKY_COLORS.sunset },
    { at: sunset + 35, color: SKY_COLORS.twilight },
    { at: sunset + 75, color: SKY_COLORS.night },
  ]
}

/** The sky colour at a moment, interpolated between the surrounding stops. */
export function skyColorAt(
  minutes: number,
  sunrise = FALLBACK_SUNRISE_MINUTES,
  sunset = FALLBACK_SUNSET_MINUTES,
): string {
  const stops = skyStops(sunrise, sunset)

  if (minutes <= stops[0].at) return stops[0].color
  const last = stops[stops.length - 1]
  if (minutes >= last.at) return last.color

  for (let i = 1; i < stops.length; i += 1) {
    const from = stops[i - 1]
    const to = stops[i]
    if (minutes > to.at) continue

    const span = to.at - from.at
    // Coincident stops mean a phase with no duration; take the later colour.
    if (span <= 0) return to.color
    return mixHex(from.color, to.color, (minutes - from.at) / span)
  }

  return last.color
}

export interface SkyPalette {
  /** The page background. */
  background: string
  /** Which of the app's two token sets the sky calls for. */
  mode: 'light' | 'dark'
  /** Card and sunken surfaces, tinted toward the sky. */
  elevated: string
  sunken: string
  /** Text sitting directly on the sky, guaranteed to clear AA. */
  onBackground: string
  /** Secondary text on the sky. Still AA: it is small print. */
  onBackgroundMuted: string
}

/** The two token sets the app already ships, as plain values. */
const TOKENS = {
  light: { text: '#16202f', muted: '#5b6880', elevated: '#ffffff', sunken: '#e8ecf5' },
  dark: { text: '#e8edf7', muted: '#9aa8c0', elevated: '#151e30', sunken: '#0e1626' },
} as const

/**
 * Everything the sky colour implies, with contrast enforced.
 *
 * Card surfaces carry a tenth of the sky so the app reads as one piece; the
 * text on them is then re-checked against that tinted surface rather than
 * against the untinted token it came from.
 */
export function skyPalette(background: string): SkyPalette {
  const mode = relativeLuminance(parseHex(background)) >= DAYLIGHT_LUMINANCE ? 'light' : 'dark'
  const tokens = TOKENS[mode]

  const elevated = mixHex(tokens.elevated, background, CARD_TINT)
  const sunken = mixHex(tokens.sunken, background, CARD_TINT)

  // Text on the sky starts from whichever token set reads better against it,
  // not from the one the cards use. At dawn those differ: the cards may still
  // be dark while near-black is the legible choice on a warm sky, and forcing
  // the card's own light token down to black produces a muddy grey instead.
  const onText = bestContrast(background, [TOKENS.light.text, TOKENS.dark.text])
  const onMuted = bestContrast(background, [TOKENS.light.muted, TOKENS.dark.muted])

  return {
    background,
    mode,
    elevated,
    sunken,
    onBackground: ensureContrast(onText, background, AA_CONTRAST),
    onBackgroundMuted: ensureContrast(onMuted, background, AA_CONTRAST),
  }
}

/** The palette for a given moment, in one call. */
export function skyPaletteAt(
  minutes: number,
  sunrise?: number,
  sunset?: number,
): SkyPalette {
  return skyPalette(skyColorAt(minutes, sunrise, sunset))
}
