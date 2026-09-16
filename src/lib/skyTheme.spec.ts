import { describe, expect, it } from 'vitest'
import { AA_CONTRAST, contrastRatio, relativeLuminance, parseHex } from './color'
import {
  FALLBACK_SUNRISE_MINUTES,
  FALLBACK_SUNSET_MINUTES,
  SKY_COLORS,
  minutesOfDay,
  skyColorAt,
  skyPalette,
  skyPaletteAt,
  skyStops,
} from './skyTheme'

const SUNRISE = 7 * 60 + 10
const SUNSET = 19 * 60 + 36

/** Every minute of the day, so nothing hides between samples. */
const EVERY_MINUTE = Array.from({ length: 1440 }, (_, i) => i)

describe('minutesOfDay', () => {
  it('reads an API local-time string', () => {
    expect(minutesOfDay('2026-09-17T00:00')).toBe(0)
    expect(minutesOfDay('2026-09-17T07:10')).toBe(430)
    expect(minutesOfDay('2026-09-17T23:59')).toBe(1439)
  })
})

describe('skyColorAt', () => {
  it('is deep night in the small hours', () => {
    expect(skyColorAt(3 * 60, SUNRISE, SUNSET)).toBe(SKY_COLORS.night)
    expect(skyColorAt(0, SUNRISE, SUNSET)).toBe(SKY_COLORS.night)
  })

  it('is the dawn colour exactly at sunrise', () => {
    expect(skyColorAt(SUNRISE, SUNRISE, SUNSET)).toBe(SKY_COLORS.dawn)
  })

  it('is the sunset colour exactly at sunset', () => {
    expect(skyColorAt(SUNSET, SUNRISE, SUNSET)).toBe(SKY_COLORS.sunset)
  })

  it('holds full daylight across the middle of the day', () => {
    expect(skyColorAt(13 * 60, SUNRISE, SUNSET)).toBe(SKY_COLORS.day)
    expect(skyColorAt(15 * 60, SUNRISE, SUNSET)).toBe(SKY_COLORS.day)
  })

  it('returns to deep night well after sunset', () => {
    expect(skyColorAt(23 * 60, SUNRISE, SUNSET)).toBe(SKY_COLORS.night)
  })

  it('moves in small steps, never jumping', () => {
    // A jump would read as a flicker rather than a fade.
    let previous = skyColorAt(0, SUNRISE, SUNSET)
    let biggest = 0

    for (const minute of EVERY_MINUTE) {
      const current = skyColorAt(minute, SUNRISE, SUNSET)
      const a = parseHex(previous)
      const b = parseHex(current)
      biggest = Math.max(
        biggest,
        Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b),
      )
      previous = current
    }

    expect(biggest).toBeLessThan(15)
  })

  it('brightens through the morning and dims through the evening', () => {
    const atNoon = relativeLuminance(parseHex(skyColorAt(13 * 60, SUNRISE, SUNSET)))
    const atDawn = relativeLuminance(parseHex(skyColorAt(SUNRISE, SUNRISE, SUNSET)))
    const atNight = relativeLuminance(parseHex(skyColorAt(2 * 60, SUNRISE, SUNSET)))

    expect(atNoon).toBeGreaterThan(atDawn)
    expect(atDawn).toBeGreaterThan(atNight)
  })

  it('falls back to civil hours when the sun times are unknown', () => {
    expect(skyColorAt(FALLBACK_SUNRISE_MINUTES)).toBe(SKY_COLORS.dawn)
    expect(skyColorAt(FALLBACK_SUNSET_MINUTES)).toBe(SKY_COLORS.sunset)
  })
})

describe('skyStops in extreme daylight', () => {
  it('keeps the stops in order through a polar winter', () => {
    // Sun up for 40 minutes: the daylight plateau has nowhere to sit.
    const stops = skyStops(11 * 60 + 40, 12 * 60 + 20)
    const times = stops.map((s) => s.at)

    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('keeps the stops in order through a polar summer', () => {
    const stops = skyStops(2 * 60, 23 * 60)
    const times = stops.map((s) => s.at)

    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('still produces a colour every minute of a 40-minute day', () => {
    for (const minute of EVERY_MINUTE) {
      expect(skyColorAt(minute, 11 * 60 + 40, 12 * 60 + 20)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('skyPalette mode', () => {
  it('asks for the light token set under a daylight sky', () => {
    expect(skyPalette(SKY_COLORS.day).mode).toBe('light')
    expect(skyPalette(SKY_COLORS.morning).mode).toBe('light')
    expect(skyPalette(SKY_COLORS.golden).mode).toBe('light')
  })

  it('asks for the dark token set under a night sky', () => {
    expect(skyPalette(SKY_COLORS.night).mode).toBe('dark')
    expect(skyPalette(SKY_COLORS.twilight).mode).toBe('dark')
    expect(skyPalette(SKY_COLORS.sunset).mode).toBe('dark')
  })

  it('switches mode exactly once on each side of the day', () => {
    const modes = EVERY_MINUTE.map((m) => skyPaletteAt(m, SUNRISE, SUNSET).mode)
    const flips = modes.filter((mode, i) => i > 0 && mode !== modes[i - 1]).length

    expect(flips).toBe(2)
  })
})

describe('contrast is guaranteed, not hoped for', () => {
  it('clears AA for text on the sky at every minute of the day', () => {
    for (const minute of EVERY_MINUTE) {
      const palette = skyPaletteAt(minute, SUNRISE, SUNSET)
      const ratio = contrastRatio(palette.onBackground, palette.background)

      expect(
        ratio,
        `minute ${minute}, sky ${palette.background}, text ${palette.onBackground}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
    }
  })

  it('clears AA for muted text on the sky at every minute', () => {
    for (const minute of EVERY_MINUTE) {
      const palette = skyPaletteAt(minute, SUNRISE, SUNSET)
      expect(
        contrastRatio(palette.onBackgroundMuted, palette.background),
        `minute ${minute}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
    }
  })

  it('clears AA for card text against the sky-tinted card surface', () => {
    const text = { light: '#16202f', dark: '#e8edf7' }

    for (const minute of EVERY_MINUTE) {
      const palette = skyPaletteAt(minute, SUNRISE, SUNSET)
      expect(
        contrastRatio(text[palette.mode], palette.elevated),
        `minute ${minute}, card ${palette.elevated}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
      expect(
        contrastRatio(text[palette.mode], palette.sunken),
        `minute ${minute}, sunken ${palette.sunken}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
    }
  })

  it('holds for a polar winter day too', () => {
    for (const minute of EVERY_MINUTE) {
      const palette = skyPaletteAt(minute, 11 * 60 + 40, 12 * 60 + 20)
      expect(contrastRatio(palette.onBackground, palette.background)).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      )
    }
  })

  it('holds for a midsummer day too', () => {
    for (const minute of EVERY_MINUTE) {
      const palette = skyPaletteAt(minute, 4 * 60, 22 * 60)
      expect(contrastRatio(palette.onBackground, palette.background)).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      )
    }
  })
})
