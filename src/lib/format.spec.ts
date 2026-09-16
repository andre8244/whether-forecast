import { describe, expect, it } from 'vitest'
import {
  concentration,
  energy,
  fullTimeLabelIn,
  hourLabel,
  instantOf,
  isToday,
  millimetres,
  percent,
  relativeDayLabel,
  pressure,
  speed,
  temperature,
  temperatureWithUnit,
  uvLabel,
  weekdayLabel,
  windDirection,
} from './format'

describe('metric formatting', () => {
  it('rounds temperatures', () => {
    expect(temperature(21.4)).toBe('21°')
    expect(temperature(-0.6)).toBe('-1°')
    expect(temperatureWithUnit(17.8)).toBe('18 °C')
  })

  it('formats the other metric units', () => {
    expect(speed(12.6)).toBe('13 km/h')
    expect(millimetres(2.35)).toBe('2.4 mm')
    expect(percent(66.6)).toBe('67%')
    expect(pressure(1013.4)).toBe('1013 hPa')
    expect(energy(1234.5)).toBe('1235 J/kg')
    expect(concentration(8.25)).toBe('8.3 µg/m³')
  })

  it('renders an em dash for missing values', () => {
    expect(temperature(null)).toBe('—')
    expect(speed(undefined)).toBe('—')
    expect(percent(null)).toBe('—')
  })

  it('keeps a real zero distinct from a missing value', () => {
    expect(percent(0)).toBe('0%')
    expect(millimetres(0)).toBe('0.0 mm')
  })
})

describe('windDirection', () => {
  it('maps cardinal degrees to Italian compass points', () => {
    expect(windDirection(0)).toBe('N')
    expect(windDirection(90)).toBe('E')
    expect(windDirection(180)).toBe('S')
    expect(windDirection(270)).toBe('O')
  })

  it('maps intercardinal degrees', () => {
    expect(windDirection(45)).toBe('NE')
    expect(windDirection(225)).toBe('SO')
    expect(windDirection(315)).toBe('NO')
  })

  it('wraps around the compass', () => {
    expect(windDirection(360)).toBe('N')
    expect(windDirection(350)).toBe('N')
    expect(windDirection(-90)).toBe('O')
  })

  it('handles a missing direction', () => {
    expect(windDirection(null)).toBe('—')
  })
})

describe('date rendering', () => {
  it('renders the hour in 24-hour it-IT form', () => {
    expect(hourLabel('2026-09-16T14:00')).toBe('14:00')
    expect(hourLabel('2026-09-16T09:00')).toBe('09:00')
  })

  it('renders a short weekday', () => {
    // 2026-09-16 is a Wednesday.
    expect(weekdayLabel('2026-09-16')).toMatch(/mer/i)
  })

  it('recognises today against a fixed reference', () => {
    const now = new Date('2026-09-16T12:00:00')
    expect(isToday('2026-09-16T23:00', now)).toBe(true)
    expect(isToday('2026-09-17T00:00', now)).toBe(false)
  })
})

describe('instantOf', () => {
  it('resolves an API local time to a true instant', () => {
    // Miami, 15:30 EDT (UTC-4) is 19:30 UTC.
    expect(instantOf('2026-09-16T15:30', -4 * 3600)).toBe(Date.parse('2026-09-16T19:30:00Z'))
  })

  it('handles a location east of UTC', () => {
    // Rome, 21:30 CEST (UTC+2) is 19:30 UTC.
    expect(instantOf('2026-09-16T21:30', 2 * 3600)).toBe(Date.parse('2026-09-16T19:30:00Z'))
  })

  it('agrees for a location at UTC', () => {
    expect(instantOf('2026-09-16T12:00', 0)).toBe(Date.parse('2026-09-16T12:00:00Z'))
  })

  it('does not depend on the browser timezone', () => {
    // Both strings name the same moment, from two different places.
    expect(instantOf('2026-09-16T15:30', -4 * 3600))
      .toBe(instantOf('2026-09-16T21:30', 2 * 3600))
  })

  it('accepts a date-only string', () => {
    expect(instantOf('2026-09-16', 2 * 3600)).toBe(Date.parse('2026-09-15T22:00:00Z'))
  })
})

describe('fullTimeLabelIn', () => {
  const instant = Date.parse('2026-09-16T19:30:00Z')

  it('renders the instant in the forecast location’s zone', () => {
    expect(fullTimeLabelIn(instant, 'America/New_York')).toContain('15:30')
    expect(fullTimeLabelIn(instant, 'Europe/Rome')).toContain('21:30')
    expect(fullTimeLabelIn(instant, 'Asia/Tokyo')).toContain('04:30')
  })

  it('falls back to the browser zone for an unknown timezone', () => {
    expect(fullTimeLabelIn(instant, 'Not/AZone')).toContain('19:30')
  })
})

describe('uvLabel', () => {
  it('walks the WHO bands', () => {
    expect(uvLabel(0)).toBe('basso')
    expect(uvLabel(2.9)).toBe('basso')
    expect(uvLabel(3)).toBe('moderato')
    expect(uvLabel(6)).toBe('alto')
    expect(uvLabel(8)).toBe('molto alto')
    expect(uvLabel(11)).toBe('estremo')
  })

  it('handles a missing index', () => {
    expect(uvLabel(null)).toBe('—')
  })
})

describe('relativeDayLabel', () => {
  const now = new Date('2026-09-16T12:00:00')

  it('names today and tomorrow instead of their weekdays', () => {
    expect(relativeDayLabel('2026-09-16T15:00', now)).toBe('oggi')
    expect(relativeDayLabel('2026-09-17T15:00', now)).toBe('domani')
  })

  it('falls back to the weekday further out', () => {
    // 2026-09-18 is a Friday.
    expect(relativeDayLabel('2026-09-18T15:00', now)).toBe('venerdì')
  })

  it('handles the last hour of today', () => {
    expect(relativeDayLabel('2026-09-16T23:00', now)).toBe('oggi')
  })

  it('handles a month boundary', () => {
    expect(relativeDayLabel('2026-10-01T09:00', new Date('2026-09-30T20:00:00'))).toBe('domani')
  })
})
