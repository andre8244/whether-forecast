import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DailyList from './DailyList.vue'
import type { DayPoint } from '../types/weather'

function day(weatherCode: number, rainProbability: number | null, precipitationSum = 0): DayPoint {
  return {
    date: '2026-10-24',
    timestamp: Date.parse('2026-10-24T00:00:00'),
    weatherCode,
    tempMax: 19,
    tempMin: 12,
    apparentMax: 19,
    apparentMin: 11,
    precipitationSum,
    precipitationProbabilityMax: 40,
    uvIndexMax: 2,
    windSpeedMax: 14,
    windGustsMax: 30,
    sunrise: '2026-10-24T07:21',
    sunset: '2026-10-24T17:58',
    stormProbabilityMax: 0,
    rainProbability,
  }
}

function row(entry: DayPoint) {
  return mount(DailyList, { props: { days: [entry] } })
}

function glyph(entry: DayPoint) {
  return row(entry).find('.glyph')
}

describe('DailyList', () => {
  it('shows rain when most of the ensemble is wet over an overcast model', () => {
    // Pesaro, 24 October: ICON overcast all day, 84% of members past 1 mm.
    const icon = glyph(day(3, 84))
    expect(icon.text()).toBe('🌧️')
    expect(icon.attributes('title')).toBe('Pioggia probabile')
  })

  it('keeps the model icon when the ensemble is mostly dry', () => {
    const icon = glyph(day(3, 15))
    expect(icon.text()).toBe('☁️')
    expect(icon.attributes('title')).toBe('Coperto')
  })

  it('prints the share the icon is read from', () => {
    // Open-Meteo's own figure for that day was 38%.
    expect(row(day(3, 84)).find('.meta').text()).toContain('💧 84%')
  })

  it("falls back to Open-Meteo's figure without the ensemble", () => {
    expect(row(day(3, null)).find('.meta').text()).toContain('💧 40%')
  })

  it('shows the depth only when the model has some', () => {
    expect(row(day(3, 84)).find('.meta').text()).not.toContain('mm')
    expect(
      row(day(61, 84, 4.2))
        .find('.meta')
        .text(),
    ).toContain('💧 84% · 4.2 mm')
  })

  it('keeps a wet model icon whatever the share', () => {
    expect(glyph(day(95, 50)).attributes('title')).toBe('Temporale')
  })
})
