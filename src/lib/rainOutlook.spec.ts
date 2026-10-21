import { describe, expect, it } from 'vitest'
import {
  MIXED_MAX,
  RAIN_LIKELY,
  RAIN_POSSIBLE,
  SNOW_MAX,
  conditionFor,
  hourRainChance,
  precipitationKind,
} from './rainOutlook'
import type { HourPoint } from '../types/weather'

describe('conditionFor', () => {
  it("keeps the model's condition below the possible band", () => {
    expect(conditionFor(3, RAIN_POSSIBLE - 1)).toEqual({ label: 'Coperto', icon: '☁️' })
    expect(conditionFor(0, 0)).toEqual({ label: 'Sereno', icon: '☀️' })
  })

  it('calls rain possible from 30%', () => {
    expect(conditionFor(3, RAIN_POSSIBLE)).toEqual({
      label: 'Possibile pioggia',
      icon: '🌦️',
      modelLabel: 'Coperto',
    })
    expect(conditionFor(0, RAIN_LIKELY - 1).label).toBe('Possibile pioggia')
  })

  it('calls rain probable from 60%', () => {
    expect(conditionFor(3, RAIN_LIKELY)).toEqual({
      label: 'Pioggia probabile',
      icon: '🌧️',
      modelLabel: 'Coperto',
    })
  })

  it('leaves a wet model code alone, which carries type and intensity', () => {
    expect(conditionFor(61, 90).label).toBe('Pioggia debole')
    expect(conditionFor(71, 90).label).toBe('Neve debole')
    expect(conditionFor(95, 90).label).toBe('Temporale')
  })

  it("keeps the model's condition without a share", () => {
    expect(conditionFor(3, null).label).toBe('Coperto')
    expect(conditionFor(3, undefined).modelLabel).toBeUndefined()
  })

  it('passes day and night through to the model icon', () => {
    expect(conditionFor(0, 10, false).icon).toBe('🌙')
  })

  it('overrules a missing model code', () => {
    expect(conditionFor(null, 70).label).toBe('Pioggia probabile')
  })
})

describe('precipitationKind', () => {
  it('splits rain, either and snow on the 2 m temperature', () => {
    expect(precipitationKind(SNOW_MAX)).toBe('snow')
    expect(precipitationKind(-5)).toBe('snow')
    expect(precipitationKind(SNOW_MAX + 0.1)).toBe('mixed')
    expect(precipitationKind(MIXED_MAX)).toBe('mixed')
    expect(precipitationKind(MIXED_MAX + 0.1)).toBe('rain')
  })

  it('says rain without a temperature', () => {
    expect(precipitationKind(null)).toBe('rain')
    expect(precipitationKind(undefined)).toBe('rain')
  })
})

describe('conditionFor with a temperature', () => {
  it('names snow when it is cold enough', () => {
    expect(conditionFor(3, RAIN_LIKELY, true, 0)).toEqual({
      label: 'Neve probabile',
      icon: '🌨️',
      modelLabel: 'Coperto',
    })
    expect(conditionFor(3, RAIN_POSSIBLE, true, -2)).toMatchObject({
      label: 'Possibile neve',
      icon: '🌨️',
    })
  })

  it('names either in the band between', () => {
    expect(conditionFor(3, RAIN_LIKELY, true, 2).label).toBe('Pioggia o neve probabile')
    expect(conditionFor(3, RAIN_POSSIBLE, true, 2).label).toBe('Possibile pioggia o neve')
  })

  it('keeps rain above it', () => {
    expect(conditionFor(3, RAIN_POSSIBLE, true, 8)).toMatchObject({
      label: 'Possibile pioggia',
      icon: '🌦️',
    })
  })

  it('leaves the model alone however cold, below the bands', () => {
    expect(conditionFor(3, RAIN_POSSIBLE - 1, true, -5).label).toBe('Coperto')
  })
})

describe('hourRainChance', () => {
  const hour = (rainProbability: number | null, precipitationProbability: number | null) =>
    ({ rainProbability, precipitationProbability }) as HourPoint

  it('prints the share the icon is read from', () => {
    expect(hourRainChance(hour(65, 23))).toBe(65)
    expect(hourRainChance(hour(0, 23))).toBe(0)
  })

  it("falls back to Open-Meteo's figure without the ensemble", () => {
    expect(hourRainChance(hour(null, 23))).toBe(23)
  })
})
