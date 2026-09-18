import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CurrentCard from './CurrentCard.vue'
import type { CurrentConditions, GeoLocation, HourPoint } from '../types/weather'

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

function hour(rainProbability: number | null): HourPoint {
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
    cape: 900,
    liftedIndex: -4,
    cin: 20,
    stormProbability: 40,
    stormPerModel: {},
    stormSpread: null,
    rainProbability,
  }
}

function mountCard(
  temperature: number,
  apparent: number,
  options: { current?: Partial<CurrentConditions>; hour?: HourPoint | null } = {},
) {
  return mount(CurrentCard, {
    props: {
      current: { ...conditions(temperature, apparent), ...options.current },
      location: LOCATION,
      elevation: 239,
      sunrise: '2026-09-16T07:08',
      sunset: '2026-09-16T19:38',
      hour: options.hour ?? null,
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

  it('names the place and its elevation', () => {
    const wrapper = mountCard(21, 21)
    expect(wrapper.find('.place').text()).toContain('Torino, Piemonte, Italia')
    expect(wrapper.find('.place').text()).toContain('239 m')
  })

  it('says so when the models disagree with the dry headline', () => {
    // The case that prompted this: overcast and 0 mm from one model while the
    // ensemble it was fetched with had most members raining.
    const wrapper = mountCard(24, 25, { current: { weatherCode: 3 }, hour: hour(82) })
    expect(wrapper.find('.disagreement').text()).toContain('82%')
  })

  it('keeps quiet when the headline already says it is raining', () => {
    const wrapper = mountCard(24, 25, {
      current: { weatherCode: 61, precipitation: 0.4 },
      hour: hour(82),
    })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
  })

  it('keeps quiet when the ensemble is no wetter than a minority', () => {
    const wrapper = mountCard(24, 25, { current: { weatherCode: 3 }, hour: hour(35) })
    expect(wrapper.find('.disagreement').exists()).toBe(false)
  })

  it('keeps quiet without ensemble data at all', () => {
    expect(mountCard(24, 25, { hour: null }).find('.disagreement').exists()).toBe(false)
    expect(mountCard(24, 25, { hour: hour(null) }).find('.disagreement').exists()).toBe(false)
  })
})
