import { describe, expect, it } from 'vitest'
import { RAIN_MIN, nextRain, rainingNow } from './nextRain'
import type { HourPoint } from '../types/weather'

function hour(overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time: '2026-09-16T12:00',
    timestamp: Date.parse('2026-09-16T12:00:00'),
    temperature: 20,
    apparentTemperature: 20,
    precipitationProbability: 0,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 80,
    humidity: 60,
    pressure: 1012,
    windSpeed: 8,
    windGusts: 15,
    windDirection: 180,
    uvIndex: 1,
    visibility: 20_000,
    freezingLevel: 3200,
    cape: 100,
    liftedIndex: 2,
    cin: 0,
    stormProbability: null,
    stormPerModel: {},
    stormSpread: null,
    rainProbability: null,
    modelConsensus: null,
    ...overrides,
  }
}

/** Builds a window from a depth per hour, one hour apart. */
function window(depths: (number | null)[]): HourPoint[] {
  return depths.map((precipitation, i) =>
    hour({ precipitation, time: `2026-09-16T${String(12 + i).padStart(2, '0')}:00` }),
  )
}

describe('nextRain', () => {
  it('finds the first wet hour after the one in progress', () => {
    const found = nextRain(window([0, 0, 0.4, 1.2]))
    expect(found?.inHours).toBe(2)
    expect(found?.hour.time).toBe('2026-09-16T14:00')
  })

  it('counts the very next hour as one', () => {
    expect(nextRain(window([0, 0.5]))?.inHours).toBe(1)
  })

  it('skips the hour in progress, which the condition already reports', () => {
    // It is raining now and stays dry after: there is no rain *ahead*.
    expect(nextRain(window([2, 0, 0]))).toBeNull()
  })

  it('takes a precipitation code as wet even with no depth', () => {
    const hours = [hour(), hour({ precipitation: 0, weatherCode: 61 })]
    expect(nextRain(hours)?.inHours).toBe(1)
  })

  it('counts an hour exactly at the threshold, not below it', () => {
    expect(nextRain(window([0, RAIN_MIN]))?.inHours).toBe(1)
    expect(nextRain(window([0, RAIN_MIN - 0.01]))).toBeNull()
  })

  it('returns null for a dry window', () => {
    expect(nextRain(window([0, 0, 0, 0]))).toBeNull()
  })

  it('treats a missing depth as dry rather than throwing', () => {
    expect(nextRain(window([0, null, null]))).toBeNull()
  })

  it('returns null for an empty window', () => {
    expect(nextRain([])).toBeNull()
  })
})

describe('rainingNow', () => {
  it('reads the hour in progress only', () => {
    expect(rainingNow(window([0.4, 0]))).toBe(true)
    expect(rainingNow(window([0, 5]))).toBe(false)
  })

  it('is false without any hours', () => {
    expect(rainingNow([])).toBe(false)
  })
})
