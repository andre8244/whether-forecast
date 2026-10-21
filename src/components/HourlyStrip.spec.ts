import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HourlyStrip from './HourlyStrip.vue'
import type { CurrentConditions, HourPoint } from '../types/weather'

function hour(index: number, overrides: Partial<HourPoint> = {}): HourPoint {
  const time = `2026-10-21T${String(12 + index).padStart(2, '0')}:00`
  return {
    time,
    timestamp: Date.parse(`${time}:00`),
    temperature: 15,
    apparentTemperature: 14,
    precipitationProbability: 23,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 100,
    humidity: 80,
    pressure: 1010,
    windSpeed: 8,
    windGusts: 18,
    windDirection: 200,
    uvIndex: 1,
    visibility: 20_000,
    freezingLevel: 2800,
    cape: 0,
    liftedIndex: 3,
    cin: 0,
    stormProbability: 0,
    stormPerModel: {},
    stormSpread: null,
    rainProbability: 10,
    modelConsensus: null,
    ...overrides,
  }
}

const CURRENT: CurrentConditions = {
  time: '2026-10-21T12:00',
  temperature: 15,
  apparentTemperature: 14,
  humidity: 80,
  precipitation: 0,
  weatherCode: 3,
  cloudCover: 100,
  pressure: 1010,
  windSpeed: 8,
  windGusts: 18,
  windDirection: 200,
  isDay: true,
}

function cells(hours: HourPoint[], current?: CurrentConditions) {
  return mount(HourlyStrip, { props: { hours, current } }).findAll('.strip li')
}

describe('HourlyStrip', () => {
  it('shows the ensemble outlook over a dry model hour', () => {
    const [, possible, likely] = cells([
      hour(0),
      hour(1, { rainProbability: 40 }),
      hour(2, { rainProbability: 70 }),
    ])
    expect(possible.find('.glyph').text()).toBe('🌦️')
    expect(possible.find('.glyph').attributes('title')).toBe('Possibile pioggia')
    expect(likely.find('.glyph').text()).toBe('🌧️')
  })

  it('prints the share the icon is read from', () => {
    const [, wet] = cells([hour(0), hour(1, { rainProbability: 70 })])
    expect(wet.find('.precip').text()).toContain('70%')
  })

  it("falls back to Open-Meteo's figure without the ensemble", () => {
    const [, cell] = cells([hour(0), hour(1, { rainProbability: null })])
    expect(cell.find('.precip').text()).toContain('23%')
    expect(cell.find('.glyph').text()).toBe('☁️')
  })

  it("names the first cell from the current card's reading", () => {
    // The hourly code says rain, the 15-minute one the card uses does not:
    // the first cell follows the card.
    const first = hour(0, { weatherCode: 61, rainProbability: 70 })
    const [now] = cells([first, hour(1)], CURRENT)
    expect(now.find('.glyph').attributes('title')).toBe('Pioggia probabile')
  })

  it('leaves the first cell to the model when the card has a trace falling', () => {
    const [now] = cells([hour(0, { rainProbability: 70 })], { ...CURRENT, precipitation: 0.1 })
    expect(now.find('.glyph').attributes('title')).toBe('Coperto')
  })
})
