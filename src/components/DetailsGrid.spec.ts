import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailsGrid from './DetailsGrid.vue'
import type { CurrentConditions, HourPoint } from '../types/weather'

const CURRENT: CurrentConditions = {
  time: '2026-09-16T12:00',
  temperature: 24,
  apparentTemperature: 25,
  humidity: 60,
  precipitation: 0,
  weatherCode: 3,
  cloudCover: 80,
  pressure: 1012,
  windSpeed: 9,
  windGusts: 21,
  windDirection: 200,
  isDay: true,
}

function hour(overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time: '2026-09-16T12:00',
    timestamp: Date.parse('2026-09-16T12:00:00'),
    temperature: 24,
    apparentTemperature: 25,
    precipitationProbability: 10,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 80,
    humidity: 60,
    pressure: 1012,
    windSpeed: 9,
    windGusts: 21,
    windDirection: 200,
    uvIndex: 5,
    visibility: 24_000,
    freezingLevel: 3610,
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

function mountGrid(hourPoint: HourPoint | null = hour()) {
  return mount(DetailsGrid, { props: { current: CURRENT, hour: hourPoint } })
}

/** The value rendered under a given label. */
function valueFor(wrapper: ReturnType<typeof mountGrid>, label: string): string | null {
  const entry = wrapper.findAll('dl > div').find((row) => row.find('dt').text() === label)
  return entry ? entry.find('dd').text().replace(/\s+/g, ' ').trim() : null
}

describe('DetailsGrid', () => {
  it('reports visibility in kilometres when the air is clear', () => {
    expect(valueFor(mountGrid(), 'Visibilità')).toBe('24 km')
  })

  it('keeps metres for visibility once it drops below a kilometre', () => {
    const wrapper = mountGrid(hour({ visibility: 350 }))
    expect(valueFor(wrapper, 'Visibilità')).toBe('350 m')
  })

  it('reports the freezing level', () => {
    expect(valueFor(mountGrid(), 'Zero termico')).toBe('3610 m')
  })

  it('shows snow only while it is falling', () => {
    expect(valueFor(mountGrid(), 'Neve')).toBeNull()
    expect(valueFor(mountGrid(hour({ snowfall: 2.4 })), 'Neve')).toBe('2.4 cm')
  })

  it('drops a tile the model does not publish rather than showing a dash', () => {
    // A Norwegian forecast carries no freezing level at all; a tile that is
    // permanently "—" is the dead weight this grid was meant to lose.
    const wrapper = mountGrid(hour({ freezingLevel: null }))
    expect(valueFor(wrapper, 'Zero termico')).toBeNull()
    expect(valueFor(wrapper, 'Visibilità')).toBe('24 km')
  })

  it('drops all three optional tiles without any hourly data', () => {
    const wrapper = mountGrid(null)
    expect(valueFor(wrapper, 'Visibilità')).toBeNull()
    expect(valueFor(wrapper, 'Zero termico')).toBeNull()
    expect(valueFor(wrapper, 'Neve')).toBeNull()
    // The current-conditions tiles are unaffected.
    expect(valueFor(wrapper, 'Pressione')).toBe('1012 hPa')
  })
})
