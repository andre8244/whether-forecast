import { describe, expect, it } from 'vitest'
import { RAIN_LIKELY, RAIN_POSSIBLE, conditionFor, hourRainChance } from './rainOutlook'
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
