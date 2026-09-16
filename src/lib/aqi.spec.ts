import { describe, expect, it } from 'vitest'
import { describeAqi } from './aqi'

describe('describeAqi', () => {
  it('walks the European AQI band boundaries', () => {
    expect(describeAqi(0)?.band).toBe('buona')
    expect(describeAqi(20)?.band).toBe('buona')
    expect(describeAqi(20.1)?.band).toBe('discreta')
    expect(describeAqi(40)?.band).toBe('discreta')
    expect(describeAqi(41)?.band).toBe('moderata')
    expect(describeAqi(60)?.band).toBe('moderata')
    expect(describeAqi(61)?.band).toBe('scarsa')
    expect(describeAqi(80)?.band).toBe('scarsa')
    expect(describeAqi(81)?.band).toBe('molto scarsa')
    expect(describeAqi(100)?.band).toBe('molto scarsa')
    expect(describeAqi(101)?.band).toBe('pessima')
  })

  it('carries a colour token and Italian advice', () => {
    const good = describeAqi(10)
    expect(good?.token).toBe('var(--aqi-1)')
    expect(good?.advice).toMatch(/\S/)
  })

  it('returns null for a missing value', () => {
    expect(describeAqi(null)).toBeNull()
    expect(describeAqi(undefined)).toBeNull()
  })
})
