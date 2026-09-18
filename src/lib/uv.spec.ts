import { describe, expect, it } from 'vitest'
import { UV_WINDOW_HOURS, peakUv } from './uv'
import type { HourPoint } from '../types/weather'

function hour(uvIndex: number | null, offset: number): HourPoint {
  const at = new Date(Date.parse('2026-09-16T00:00:00') + offset * 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:00`

  return {
    time,
    timestamp: at.getTime(),
    temperature: 20,
    apparentTemperature: 20,
    precipitationProbability: 0,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 0,
    cloudCover: 10,
    humidity: 50,
    pressure: 1015,
    windSpeed: 5,
    windGusts: 10,
    windDirection: 90,
    uvIndex,
    visibility: 30_000,
    freezingLevel: 3500,
    cape: 0,
    liftedIndex: 5,
    cin: 0,
    stormProbability: null,
    stormPerModel: {},
    stormSpread: null,
    rainProbability: null,
    modelConsensus: null,
  }
}

/** A window starting at midnight, one entry per hour. */
function window(values: (number | null)[]): HourPoint[] {
  return values.map((value, i) => hour(value, i))
}

describe('peakUv', () => {
  it('finds the strongest hour and names it', () => {
    const found = peakUv(window([0, 1, 5, 7, 4]))
    expect(found?.value).toBe(7)
    expect(found?.time).toBe('2026-09-16T03:00')
  })

  it('prefers the earlier of two equal peaks', () => {
    // The one the reader meets first is the one worth naming.
    expect(peakUv(window([0, 6, 3, 6]))?.time).toBe('2026-09-16T01:00')
  })

  it('ignores the night, which is what the old current-hour tile showed', () => {
    expect(peakUv(window([0, 0, 0, 0]))).toBeNull()
  })

  it('ignores missing values without mistaking them for zero', () => {
    expect(peakUv(window([null, null, 2]))?.value).toBe(2)
    expect(peakUv(window([null, null]))).toBeNull()
  })

  it('looks no further than the window', () => {
    const values = Array.from({ length: 40 }, (_, i) => (i === 30 ? 9 : 1))
    expect(peakUv(window(values))?.value).toBe(1)
    expect(peakUv(window(values), 40)?.value).toBe(9)
    expect(UV_WINDOW_HOURS).toBe(24)
  })

  it('is null for an empty window', () => {
    expect(peakUv([])).toBeNull()
  })
})
