import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CurrentCard from './CurrentCard.vue'
import type {
  CurrentConditions,
  DayPoint,
  GeoLocation,
  HourPoint,
  ModelConsensus,
} from '../types/weather'

const TWO_MODELS_WET: ModelConsensus = { wet: ['ECMWF', 'GFS'], dry: ['ICON'] }

const LOCATION: GeoLocation = {
  id: '45.0705,7.6868',
  name: 'Torino',
  admin1: 'Piemonte',
  country: 'Italia',
  latitude: 45.0705,
  longitude: 7.6868,
  timezone: 'Europe/Rome',
}

function conditions(temperature: number, apparentTemperature: number): CurrentConditions {
  return {
    time: '2026-09-16T12:00',
    temperature,
    apparentTemperature,
    humidity: 60,
    precipitation: 0,
    weatherCode: 2,
    cloudCover: 40,
    pressure: 1012,
    windSpeed: 9,
    windGusts: 21,
    windDirection: 200,
    isDay: true,
  }
}

function hour(
  rainProbability: number | null,
  modelConsensus: ModelConsensus | null = null,
  overrides: Partial<HourPoint> = {},
): HourPoint {
  return {
    time: '2026-09-16T12:00',
    timestamp: Date.parse('2026-09-16T12:00:00'),
    temperature: 24,
    apparentTemperature: 25,
    precipitationProbability: 70,
    precipitation: 0,
    snowfall: 0,
    weatherCode: 3,
    cloudCover: 100,
    humidity: 60,
    pressure: 1012,
    windSpeed: 9,
    windGusts: 21,
    windDirection: 200,
    uvIndex: 3,
    visibility: 20_000,
    freezingLevel: 3200,
    cape: 900,
    liftedIndex: -4,
    cin: 20,
    stormProbability: 40,
    stormPerModel: {},
    stormSpread: null,
    rainProbability,
    modelConsensus,
    ...overrides,
  }
}

const TODAY: DayPoint = {
  date: '2026-09-16',
  timestamp: Date.parse('2026-09-16T00:00:00'),
  weatherCode: 2,
  tempMax: 26.4,
  tempMin: 14.2,
  apparentMax: 27,
  apparentMin: 13,
  precipitationSum: 0,
  precipitationProbabilityMax: 10,
  uvIndexMax: 6,
  windSpeedMax: 14,
  windGustsMax: 30,
  sunrise: '2026-09-16T07:08',
  sunset: '2026-09-16T19:38',
  stormProbabilityMax: 5,
  rainProbability: 10,
  temperatureAhead: 20,
}

function mountCard(
  temperature: number,
  apparent: number,
  options: {
    current?: Partial<CurrentConditions>
    hour?: HourPoint | null
    hours?: HourPoint[]
    today?: DayPoint | null
  } = {},
) {
  const first = options.hour === undefined ? null : options.hour
  const hours = options.hours ?? (first ? [first] : [])

  return mount(CurrentCard, {
    props: {
      current: { ...conditions(temperature, apparent), ...options.current },
      location: LOCATION,
      elevation: 239,
      today: options.today === undefined ? TODAY : options.today,
      hours,
    },
  })
}

describe('CurrentCard', () => {
  it('always shows the perceived temperature', () => {
    const wrapper = mountCard(21, 21)
    expect(wrapper.find('.feels').text()).toContain('Percepita')
    expect(wrapper.find('.feels').text()).toContain('21°')
  })

  it('says nothing when perceived and real agree', () => {
    // The two numbers are right there; naming the agreement adds nothing.
    for (const apparent of [21, 22, 22.9, 19.1, 20]) {
      expect(mountCard(21, apparent).find('.feels-note').exists()).toBe(false)
    }
  })

  it('qualifies a perceived temperature that runs warmer', () => {
    expect(mountCard(21, 23).find('.feels-note').text()).toContain('più caldo')
  })

  it('qualifies a perceived temperature that runs colder', () => {
    expect(mountCard(21, 19).find('.feels-note').text()).toContain('più freddo')
  })

  it("shows today's low and high", () => {
    const range = mountCard(21, 21).find('.range').text()
    expect(range).toContain('Minima')
    expect(range).toContain('14°')
    expect(range).toContain('Massima')
    expect(range).toContain('26°')
  })

  it('leaves the readings to the details card', () => {
    const text = mountCard(21, 21).text()
    for (const label of ['Vento', 'Raffiche', 'Umidità', 'Nuvolosità', 'Alba', 'Tramonto']) {
      expect(text).not.toContain(label)
    }
  })

  it('drops the range without a daily entry', () => {
    expect(mountCard(21, 21, { today: null }).find('.range').exists()).toBe(false)
  })

  it('names the place and its elevation', () => {
    const wrapper = mountCard(21, 21)
    expect(wrapper.find('.place').text()).toContain('Torino, Piemonte, Italia')
    expect(wrapper.find('.place').text()).toContain('239 m')
  })

  it('quotes the ensemble share when it contradicts the dry headline', () => {
    // The case that prompted this: overcast and 0 mm from the model behind the
    // headline while most of the ensemble it was fetched with was wet.
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(82, TWO_MODELS_WET),
    })
    expect(wrapper.find('.disagreement').text()).toContain('Pioggia nel 82% degli scenari')
  })

  it('keeps the model names in the title rather than the line', () => {
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(82, TWO_MODELS_WET),
    })
    const line = wrapper.find('.disagreement')

    expect(line.text()).not.toContain('ECMWF')
    expect(line.attributes('title')).toBe('Pioggia per ECMWF e GFS; ICON no')
  })

  it('quotes a share in the possible band', () => {
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(35, { wet: ['ECMWF'], dry: ['ICON', 'GFS'] }),
    })
    expect(wrapper.find('.disagreement').text()).toContain('35%')
  })

  it('stays quiet below the possible band, whatever the models say', () => {
    // Two models wet with the share under 30% happened in 15 of 1655 dry hours
    // measured; the share alone decides, so icon and percentage always agree.
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(25, TWO_MODELS_WET),
    })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
    expect(wrapper.find('.condition').text()).toBe('Coperto')
  })

  it('keeps quiet when the headline already says it is raining', () => {
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 61, precipitation: 0.4 },
      hour: hour(82, TWO_MODELS_WET),
    })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
  })

  it('keeps quiet when neither cross-check contradicts the headline', () => {
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(20, { wet: [], dry: ['ICON', 'ECMWF', 'GFS'] }),
    })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
  })

  it('keeps quiet without cross-check data at all', () => {
    expect(mountCard(24, 25, { hour: null }).find('.disagreement').exists()).toBe(false)
    expect(
      mountCard(24, 25, { hour: hour(null) })
        .find('.disagreement')
        .exists(),
    ).toBe(false)
  })

  it('says when rain is next expected', () => {
    const dry = hour(null, null, { precipitation: 0 })
    const wet = hour(null, null, { precipitation: 0.8, time: '2026-09-16T16:00' })
    const wrapper = mountCard(24, 25, { hours: [dry, dry, wet] })

    expect(wrapper.find('.next-rain').text()).toContain('Pioggia prevista tra 2 h')
    expect(wrapper.find('.next-rain').text()).toContain('16:00')
  })

  it('calls rain ahead probable when only the ensemble has it', () => {
    const dry = hour(null, null, { precipitation: 0 })
    const likely = hour(75, null, { precipitation: 0, time: '2026-09-16T15:00' })
    const wrapper = mountCard(24, 25, { hours: [dry, dry, likely] })

    expect(wrapper.find('.next-rain').text()).toContain('Pioggia probabile tra 2 h')
    expect(wrapper.find('.next-rain').text()).toContain('15:00')
  })

  it('says nothing about rain ahead while it is already raining', () => {
    // The condition itself reports the hour in progress.
    const raining = hour(null, null, { precipitation: 1.5, weatherCode: 61 })
    const wet = hour(null, null, { precipitation: 0.8 })
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 61, precipitation: 1.5 },
      hours: [raining, wet],
    })

    expect(wrapper.find('.next-rain').exists()).toBe(false)
  })

  it('says nothing about rain ahead across a dry window', () => {
    const dry = hour(null, null, { precipitation: 0 })
    expect(
      mountCard(24, 25, { hours: [dry, dry, dry] })
        .find('.next-rain')
        .exists(),
    ).toBe(false)
  })

  it('reads as probable rain when most of the ensemble is wet over a dry model', () => {
    // The night that prompted this: ICON-D2 overcast and 0 mm over Pesaro at
    // 03:00 while 65% of the three ensembles had rain, and it rained.
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 3 },
      hour: hour(65, TWO_MODELS_WET),
    })
    const condition = wrapper.find('.condition')

    expect(condition.text()).toBe('Pioggia probabile')
    expect(condition.attributes('title')).toBe('Modello principale: Coperto')
    expect(wrapper.find('.glyph').text()).toBe('🌧️')
  })

  it('reads as possible rain in the 30-60% band', () => {
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 3 },
      hour: hour(40, null),
    })
    expect(wrapper.find('.condition').text()).toBe('Possibile pioggia')
    expect(wrapper.find('.glyph').text()).toBe('🌦️')
  })

  it("keeps the model's condition without an ensemble, whatever the models say", () => {
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 3 },
      hour: hour(null, TWO_MODELS_WET),
    })
    expect(wrapper.find('.condition').text()).toBe('Coperto')
  })

  it("keeps the model's condition when a trace is falling under a dry code", () => {
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 3, precipitation: 0.1 },
      hour: hour(90, TWO_MODELS_WET),
    })
    expect(wrapper.find('.condition').text()).toBe('Coperto')
  })

  it("keeps the model's condition when nothing contradicts it", () => {
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 3 },
      hour: hour(29, { wet: ['ECMWF'], dry: ['ICON', 'GFS'] }),
    })
    const condition = wrapper.find('.condition')

    expect(condition.text()).toBe('Coperto')
    expect(condition.attributes('title')).toBeUndefined()
  })

  it('names snow on a cold card, in the label and the line', () => {
    const wrapper = mountCard(0, -3, {
      current: { weatherCode: 3 },
      hour: hour(70, TWO_MODELS_WET),
    })
    expect(wrapper.find('.condition').text()).toBe('Neve probabile')
    expect(wrapper.find('.disagreement').text()).toContain('Neve nel 70% degli scenari')
    expect(wrapper.find('.disagreement').attributes('title')).toBe('Neve per ECMWF e GFS; ICON no')
  })

  it('names snow ahead, from the model code or the ensemble', () => {
    const dry = hour(null, null, { precipitation: 0 })
    const snow = hour(null, null, { precipitation: 0.4, weatherCode: 71 })
    expect(
      mountCard(0, -3, { hours: [dry, snow] })
        .find('.next-rain')
        .text(),
    ).toContain('Neve prevista tra 1 h')

    const cold = hour(80, null, { precipitation: 0, temperature: 0 })
    expect(
      mountCard(0, -3, { hours: [dry, cold] })
        .find('.next-rain')
        .text(),
    ).toContain('Neve probabile tra 1 h')
  })

  it("keeps the model's condition when it already says rain", () => {
    const wrapper = mountCard(14, 13, {
      current: { weatherCode: 61, precipitation: 0.4 },
      hour: hour(82, TWO_MODELS_WET),
    })
    expect(wrapper.find('.condition').text()).toBe('Pioggia debole')
  })

  it('keeps quiet when the models dissent but there is no share to quote', () => {
    // The line is a sentence about scenarios; without the ensemble it has no
    // number, and a count of model names is what this wording replaced.
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 3 },
      hour: hour(null, TWO_MODELS_WET),
    })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
  })
})
