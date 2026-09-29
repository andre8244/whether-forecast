import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailsGrid from './DetailsGrid.vue'
import type { AirQualityPoint, CurrentConditions, HourPoint } from '../types/weather'

const CURRENT: CurrentConditions = {
  time: '2026-09-16T12:00',
  temperature: 24,
  apparentTemperature: 25,
  humidity: 58,
  precipitation: 0,
  weatherCode: 2,
  cloudCover: 40,
  pressure: 1012,
  windSpeed: 9,
  windGusts: 21,
  windDirection: 200,
  isDay: true,
}

const AIR: AirQualityPoint = {
  europeanAqi: 32,
  pm2_5: 8,
  pm10: 14,
  ozone: 60,
  nitrogenDioxide: 12,
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

function mountGrid(
  hourPoint: HourPoint | null = hour(),
  rest: HourPoint[] = [],
  air: AirQualityPoint | null = AIR,
) {
  return mount(DetailsGrid, {
    props: {
      current: CURRENT,
      sunrise: '2026-09-16T07:08',
      sunset: '2026-09-16T19:38',
      hours: hourPoint ? [hourPoint, ...rest] : [],
      air,
    },
  })
}

/** The value rendered under a given label. */
function valueFor(wrapper: ReturnType<typeof mountGrid>, label: string): string | null {
  const entry = wrapper.findAll('dl > div').find((row) => row.find('dt').text() === label)
  return entry ? entry.find('dd').text().replace(/\s+/g, ' ').trim() : null
}

describe('DetailsGrid', () => {
  it('reads wind, humidity and cloud cover from the current conditions', () => {
    // The hour in progress says 60% humidity and 80% cloud; the observation wins.
    const wrapper = mountGrid()
    expect(valueFor(wrapper, 'Vento')).toBe('9 km/h SSO')
    expect(valueFor(wrapper, 'Raffiche')).toBe('21 km/h')
    expect(valueFor(wrapper, 'Umidità')).toBe('58%')
    expect(valueFor(wrapper, 'Nuvolosità')).toBe('40%')
  })

  it('reports sunrise and sunset', () => {
    const wrapper = mountGrid()
    expect(valueFor(wrapper, 'Alba')).toBe('07:08')
    expect(valueFor(wrapper, 'Tramonto')).toBe('19:38')
  })

  it('reports the air quality index with its band and advice', () => {
    const value = valueFor(mountGrid(), 'Qualità dell’aria')
    expect(value).toContain('32')
    expect(value).toContain('discreta')
    expect(value).toContain('accettabile')
  })

  it('drops the air quality tile without data for the place', () => {
    expect(valueFor(mountGrid(hour(), [], null), 'Qualità dell’aria')).toBeNull()
    expect(
      valueFor(mountGrid(hour(), [], { ...AIR, europeanAqi: null }), 'Qualità dell’aria'),
    ).toBeNull()
  })

  it('leaves pressure out', () => {
    expect(valueFor(mountGrid(), 'Pressione')).toBeNull()
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

  it('keeps the current readings without any hourly data', () => {
    const wrapper = mountGrid(null, [], null)
    expect(wrapper.find('h2').text()).toBe('Dettagli')
    expect(valueFor(wrapper, 'Vento')).not.toBeNull()
    expect(valueFor(wrapper, 'Visibilità')).toBeNull()
    expect(valueFor(wrapper, 'UV massimo')).toBeNull()
  })
})
