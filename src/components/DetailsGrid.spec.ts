import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailsGrid from './DetailsGrid.vue'
import type { HourPoint } from '../types/weather'

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

function mountGrid(hourPoint: HourPoint | null = hour(), rest: HourPoint[] = []) {
  return mount(DetailsGrid, { props: { hours: hourPoint ? [hourPoint, ...rest] : [] } })
}

/** The value rendered under a given label. */
function valueFor(wrapper: ReturnType<typeof mountGrid>, label: string): string | null {
  const entry = wrapper.findAll('dl > div').find((row) => row.find('dt').text() === label)
  return entry ? entry.find('dd').text().replace(/\s+/g, ' ').trim() : null
}

describe('DetailsGrid', () => {
  it('does not repeat what the current card already shows', () => {
    const wrapper = mountGrid()
    for (const label of ['Vento', 'Raffiche', 'Umidità', 'Nuvolosità', 'Pressione']) {
      expect(valueFor(wrapper, label)).toBeNull()
    }
  })

  it('reports the coming UV peak rather than the current hour', () => {
    // 5 now, 8 in two hours: the number worth planning around is the 8.
    const now = hour({ uvIndex: 5, time: '2026-09-16T12:00' })
    const later = [
      hour({ uvIndex: 7, time: '2026-09-16T13:00' }),
      hour({ uvIndex: 8, time: '2026-09-16T14:00' }),
    ]
    const wrapper = mountGrid(now, later)

    const value = valueFor(wrapper, 'UV massimo')
    expect(value).toContain('8')
    expect(value).toContain('molto alto')
    expect(value).toContain('14:00')
  })

  it('drops the UV tile through a night with no sun in the window', () => {
    const night = hour({ uvIndex: 0, time: '2026-09-16T23:00' })
    expect(valueFor(mountGrid(night), 'UV massimo')).toBeNull()
  })

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

  it('renders nothing but its heading without any hourly data', () => {
    const wrapper = mountGrid(null)
    expect(wrapper.findAll('dl > div')).toHaveLength(0)
    expect(wrapper.find('h2').text()).toBe('Dettagli')
  })
})
