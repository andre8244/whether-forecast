import { describe, expect, it } from 'vitest'
import {
  AA_CONTRAST,
  bestContrast,
  contrastRatio,
  ensureContrast,
  mixHex,
  parseHex,
  relativeLuminance,
  toHex,
} from './color'

describe('parseHex and toHex', () => {
  it('round-trips a six-digit colour', () => {
    expect(toHex(parseHex('#9ed2f0'))).toBe('#9ed2f0')
  })

  it('expands a three-digit colour', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#012')).toEqual(parseHex('#001122'))
  })

  it('accepts a colour without the hash', () => {
    expect(parseHex('9ed2f0')).toEqual(parseHex('#9ed2f0'))
  })

  it('clamps out-of-range channels', () => {
    expect(toHex({ r: -20, g: 300, b: 128 })).toBe('#00ff80')
  })
})

describe('mixHex', () => {
  it('returns the endpoints at 0 and 1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('blends halfway', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clamps a fraction outside the range', () => {
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
})

describe('relativeLuminance', () => {
  it('spans black to white', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBe(0)
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 5)
  })

  it('weights green above red above blue', () => {
    const red = relativeLuminance(parseHex('#ff0000'))
    const green = relativeLuminance(parseHex('#00ff00'))
    const blue = relativeLuminance(parseHex('#0000ff'))

    expect(green).toBeGreaterThan(red)
    expect(red).toBeGreaterThan(blue)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#9ed2f0', '#9ed2f0')).toBeCloseTo(1, 5)
  })

  it('does not care which way round the pair is given', () => {
    expect(contrastRatio('#16202f', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#16202f'),
      10,
    )
  })
})

describe('ensureContrast', () => {
  it('leaves a foreground that already passes untouched', () => {
    expect(ensureContrast('#16202f', '#ffffff')).toBe('#16202f')
  })

  it('lifts a foreground that falls short', () => {
    const fixed = ensureContrast('#7a8496', '#5b6880')
    expect(contrastRatio(fixed, '#5b6880')).toBeGreaterThanOrEqual(AA_CONTRAST)
  })

  it('reaches AA on the mid-tone that neither extreme comfortably clears', () => {
    // 18% luminance is the worst case: 4.50 against white, 4.67 against black.
    const background = '#a26766'
    const fixed = ensureContrast('#e8edf7', background)

    expect(contrastRatio(fixed, background)).toBeGreaterThanOrEqual(AA_CONTRAST)
  })

  it('reaches AA on any background whatsoever', () => {
    // Sweeping the greys covers the full luminance range including the trap.
    for (let level = 0; level <= 255; level += 1) {
      const background = toHex({ r: level, g: level, b: level })
      for (const start of ['#16202f', '#e8edf7']) {
        expect(
          contrastRatio(ensureContrast(start, background), background),
          `${start} on ${background}`,
        ).toBeGreaterThanOrEqual(AA_CONTRAST)
      }
    }
  })

  it('honours a stricter target', () => {
    const fixed = ensureContrast('#5b6880', '#ffffff', 7)
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(7)
  })
})

describe('bestContrast', () => {
  it('picks the more readable option', () => {
    expect(bestContrast('#0b1220', ['#16202f', '#e8edf7'])).toBe('#e8edf7')
    expect(bestContrast('#9ed2f0', ['#16202f', '#e8edf7'])).toBe('#16202f')
  })
})
