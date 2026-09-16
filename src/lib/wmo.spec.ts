import { describe, expect, it } from 'vitest'
import { describeCode, iconFor, isThunderstormCode } from './wmo'

describe('isThunderstormCode', () => {
  it('accepts the three thunderstorm codes', () => {
    expect(isThunderstormCode(95)).toBe(true)
    expect(isThunderstormCode(96)).toBe(true)
    expect(isThunderstormCode(99)).toBe(true)
  })

  it('rejects neighbouring precipitation codes', () => {
    expect(isThunderstormCode(82)).toBe(false)
    expect(isThunderstormCode(86)).toBe(false)
    expect(isThunderstormCode(97)).toBe(false)
  })

  it('rejects missing values', () => {
    expect(isThunderstormCode(null)).toBe(false)
    expect(isThunderstormCode(undefined)).toBe(false)
  })
})

describe('describeCode', () => {
  it('labels known codes in Italian', () => {
    expect(describeCode(0).label).toBe('Sereno')
    expect(describeCode(65).label).toBe('Pioggia forte')
    expect(describeCode(95).label).toBe('Temporale')
  })

  it('marks the thunderstorm group', () => {
    expect(describeCode(96).isThunderstorm).toBe(true)
    expect(describeCode(80).isThunderstorm).toBe(false)
  })

  it('degrades gracefully for an unknown code', () => {
    const unknown = describeCode(42)
    expect(unknown.label).toBe('Codice 42')
    expect(unknown.icon).toBe('unknown')
  })

  it('degrades gracefully for a missing code', () => {
    expect(describeCode(null).label).toBe('Dato non disponibile')
  })
})

describe('iconFor', () => {
  it('switches clear sky between day and night', () => {
    expect(iconFor(0, true)).toBe('☀️')
    expect(iconFor(0, false)).toBe('🌙')
  })

  it('uses one glyph for the thunderstorm group', () => {
    expect(iconFor(95)).toBe('⛈️')
    expect(iconFor(99)).toBe('⛈️')
  })
})
