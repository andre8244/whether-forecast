import { describe, expect, it } from 'vitest'
import { isStale } from './useForecast'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-09-16T21:00:00').getTime()

describe('isStale', () => {
  it('accepts a forecast issued within the last two hours', () => {
    expect(isStale(NOW - HOUR, NOW)).toBe(false)
    expect(isStale(NOW - 2 * HOUR, NOW)).toBe(false)
  })

  it('flags a forecast older than two hours', () => {
    expect(isStale(NOW - 2 * HOUR - 1, NOW)).toBe(true)
    expect(isStale(NOW - 12 * HOUR, NOW)).toBe(true)
  })

  it('accepts a forecast timestamped slightly in the future', () => {
    // Rounding between the API's local clock and the browser's can do this.
    expect(isStale(NOW + 30 * 60 * 1000, NOW)).toBe(false)
  })
})
