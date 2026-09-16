import { describe, expect, it } from 'vitest'
import { axisLabels, axisTicks, slotCenter, slotIndexAt } from './chart'

describe('slotCenter', () => {
  it('places a point at the middle of its hour slot', () => {
    expect(slotCenter(0, 4)).toBe(0.125)
    expect(slotCenter(3, 4)).toBe(0.875)
  })

  it('never reaches the plot edges', () => {
    expect(slotCenter(0, 48)).toBeGreaterThan(0)
    expect(slotCenter(47, 48)).toBeLessThan(1)
  })

  it('handles an empty series', () => {
    expect(slotCenter(0, 0)).toBe(0)
  })
})

describe('slotIndexAt', () => {
  it('maps a fraction to the slot under it', () => {
    expect(slotIndexAt(0, 4)).toBe(0)
    expect(slotIndexAt(0.24, 4)).toBe(0)
    expect(slotIndexAt(0.26, 4)).toBe(1)
    expect(slotIndexAt(0.99, 4)).toBe(3)
  })

  it('round-trips with slotCenter', () => {
    for (const i of [0, 7, 23, 47]) {
      expect(slotIndexAt(slotCenter(i, 48), 48)).toBe(i)
    }
  })

  it('clamps a fraction outside the plot', () => {
    expect(slotIndexAt(-0.5, 4)).toBe(0)
    expect(slotIndexAt(1, 4)).toBe(3)
    expect(slotIndexAt(2, 4)).toBe(3)
  })

  it('reports no slot for an empty series', () => {
    expect(slotIndexAt(0.5, 0)).toBe(-1)
  })
})

describe('axisTicks', () => {
  it('spans the series from first to last', () => {
    const ticks = axisTicks(48)
    expect(ticks[0]).toBe(0)
    expect(ticks.at(-1)).toBe(47)
  })

  it('returns no more than the requested number of labels', () => {
    expect(axisTicks(48).length).toBeLessThanOrEqual(5)
    expect(axisTicks(48, 7).length).toBeLessThanOrEqual(7)
  })

  it('spaces the labels evenly', () => {
    expect(axisTicks(9, 5)).toEqual([0, 2, 4, 6, 8])
  })

  it('labels every slot for a short series', () => {
    expect(axisTicks(3)).toEqual([0, 1, 2])
  })

  it('handles an empty series', () => {
    expect(axisTicks(0)).toEqual([])
  })
})

describe('axisLabels', () => {
  const hour = (t: string) => t.slice(11, 16)
  const weekday = (t: string) => (t.slice(8, 10) === '16' ? 'mer' : 'gio')
  const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10)

  const times = [
    '2026-09-16T16:00',
    '2026-09-16T20:00',
    '2026-09-17T04:00',
    '2026-09-17T16:00',
  ]

  it('prefixes the weekday on the first tick', () => {
    expect(axisLabels([0], times, hour, weekday, sameDay)).toEqual(['mer 16:00'])
  })

  it('omits the weekday while the day is unchanged', () => {
    expect(axisLabels([0, 1], times, hour, weekday, sameDay)).toEqual(['mer 16:00', '20:00'])
  })

  it('brings the weekday back when the day changes', () => {
    expect(axisLabels([0, 1, 2, 3], times, hour, weekday, sameDay))
      .toEqual(['mer 16:00', '20:00', 'gio 04:00', '16:00'])
  })

  it('handles an empty tick list', () => {
    expect(axisLabels([], times, hour, weekday, sameDay)).toEqual([])
  })
})
