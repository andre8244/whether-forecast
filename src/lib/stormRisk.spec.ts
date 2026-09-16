import { describe, expect, it } from 'vitest'
import ensembleFixture from './__fixtures__/ensemble.json'
import {
  DISAGREEMENT_THRESHOLD,
  capeReading,
  cinReading,
  groupMembers,
  labelForModel,
  liftedIndexReading,
  modelsDisagree,
  thunderstormProbability,
} from './stormRisk'

/** Builds a flat ensemble-shaped payload from per-model member series. */
function flatten(models: Record<string, (number | null)[][]>): Record<string, unknown> {
  const hourly: Record<string, unknown> = { time: [] }
  for (const [model, members] of Object.entries(models)) {
    members.forEach((series, i) => {
      // The first series stands in for the control run, which has no member number.
      hourly[i === 0 ? `weather_code_${model}` : `weather_code_member${String(i).padStart(2, '0')}_${model}`] = series
    })
  }
  return hourly
}

describe('groupMembers', () => {
  it('groups a real three-model response by its key suffixes', () => {
    const grouped = groupMembers(ensembleFixture.hourly as Record<string, unknown>)

    // Control run plus members: 50 + 1, 39 + 1, 30 + 1.
    expect(grouped.ecmwf_ifs025_ensemble).toHaveLength(51)
    expect(grouped.icon_global_eps).toHaveLength(40)
    expect(grouped.ncep_gefs025).toHaveLength(31)
    expect(Object.keys(grouped)).toHaveLength(3)
  })

  it('reads the suffix rather than the requested model id', () => {
    // gfs025 is requested but comes back as ncep_gefs025.
    const grouped = groupMembers(ensembleFixture.hourly as Record<string, unknown>)
    expect(grouped.gfs025).toBeUndefined()
    expect(grouped.ncep_gefs025).toBeDefined()
  })

  it('skips the bare weather_code key so the control is not double-counted', () => {
    const grouped = groupMembers({
      time: ['2026-09-16T00:00'],
      weather_code: [95],
      weather_code_icon_global_eps: [95],
      weather_code_member01_icon_global_eps: [3],
    })
    expect(grouped.icon_global_eps).toHaveLength(2)
  })

  it('ignores non-array values', () => {
    const grouped = groupMembers({ time: ['x'], latitude: 45.07 as unknown })
    expect(grouped).toEqual({})
  })
})

describe('thunderstormProbability', () => {
  it('reports 100 when every member forecasts a thunderstorm', () => {
    const grouped = groupMembers(flatten({ m: [[95], [96], [99]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([100])
  })

  it('reports 0 when no member forecasts a thunderstorm', () => {
    const grouped = groupMembers(flatten({ m: [[0], [3], [61]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([0])
  })

  it('reports the member share within a single model', () => {
    const grouped = groupMembers(flatten({ m: [[95], [95], [3], [3]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([50])
  })

  it('excludes null members from both numerator and denominator', () => {
    // 2 of the 3 reporting members are stormy: 67%, not 50% of all four.
    const grouped = groupMembers(flatten({ m: [[95], [95], [3], [null]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([67])
  })

  it('yields null when fewer than half the members have data', () => {
    const grouped = groupMembers(flatten({ m: [[95], [null], [null], [null]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([null])
  })

  it('keeps the hour when exactly half the members report', () => {
    const grouped = groupMembers(flatten({ m: [[95], [3], [null], [null]] }))
    expect(thunderstormProbability(grouped, 1).combined).toEqual([50])
  })

  it('weights each model equally regardless of its member count', () => {
    const grouped = groupMembers(
      flatten({
        big: [[95], [95], [95], [95]],
        small: [[3]],
      }),
    )
    const result = thunderstormProbability(grouped, 1)

    expect(result.perModel.big).toEqual([100])
    expect(result.perModel.small).toEqual([0])
    // Mean of 100 and 0, not 4 stormy members out of 5.
    expect(result.combined).toEqual([50])
  })

  it('averages three models the way the real request returns them', () => {
    const grouped = groupMembers(
      flatten({
        a: [[95], [95], [3], [3]],
        b: [[95], [3], [3], [3]],
        c: [[3], [3], [3], [3]],
      }),
    )
    // 50, 25 and 0 average to 25.
    expect(thunderstormProbability(grouped, 1).combined).toEqual([25])
  })

  it('drops a model with no data instead of counting it as zero', () => {
    const grouped = groupMembers(
      flatten({
        reporting: [[95], [95]],
        silent: [[null], [null]],
      }),
    )
    // The silent model is excluded, so the answer is the reporting one's 100.
    expect(thunderstormProbability(grouped, 1).combined).toEqual([100])
  })

  it('computes spread as max minus min across models', () => {
    const grouped = groupMembers(
      flatten({ a: [[95], [95]], b: [[95], [3]], c: [[3], [3]] }),
    )
    expect(thunderstormProbability(grouped, 1).spread).toEqual([100])
  })

  it('leaves spread null when fewer than two models report', () => {
    const grouped = groupMembers(flatten({ only: [[95], [3]] }))
    expect(thunderstormProbability(grouped, 1).spread).toEqual([null])
  })

  it('handles every hour of the window independently', () => {
    const grouped = groupMembers(flatten({ m: [[95, 3, 95], [95, 3, 3]] }))
    expect(thunderstormProbability(grouped, 3).combined).toEqual([100, 0, 50])
  })

  it('produces one value per hour for the real fixture', () => {
    const grouped = groupMembers(ensembleFixture.hourly as Record<string, unknown>)
    const hours = ensembleFixture.hourly.time.length
    const result = thunderstormProbability(grouped, hours)

    expect(result.combined).toHaveLength(hours)
    expect(Object.keys(result.perModel)).toHaveLength(3)
    for (const value of result.combined) {
      expect(value === null || (value >= 0 && value <= 100)).toBe(true)
    }
  })
})

describe('modelsDisagree', () => {
  it('flags a spread above the threshold', () => {
    expect(modelsDisagree(DISAGREEMENT_THRESHOLD + 1)).toBe(true)
  })

  it('does not flag a spread at or below the threshold', () => {
    expect(modelsDisagree(DISAGREEMENT_THRESHOLD)).toBe(false)
    expect(modelsDisagree(0)).toBe(false)
  })

  it('does not flag a missing spread', () => {
    expect(modelsDisagree(null)).toBe(false)
  })
})

describe('capeReading', () => {
  const band = (cape: number | null) => capeReading(cape)?.label

  it('walks the published convective-energy thresholds', () => {
    expect(band(299)).toBe('trascurabile')
    expect(band(300)).toBe('debole')
    expect(band(999)).toBe('debole')
    expect(band(1000)).toBe('moderata')
    expect(band(2499)).toBe('moderata')
    expect(band(2500)).toBe('elevata')
    expect(band(3999)).toBe('elevata')
    expect(band(4000)).toBe('estrema')
  })

  it('carries a colour token and an explanation', () => {
    const reading = capeReading(1500)
    expect(reading?.token).toBe('var(--risk-moderate)')
    expect(reading?.detail).toMatch(/\S/)
  })

  it('returns nothing without data', () => {
    expect(capeReading(null)).toBeNull()
  })
})

describe('liftedIndexReading', () => {
  const band = (li: number | null) => liftedIndexReading(li)?.label

  it('walks the published stability thresholds', () => {
    expect(band(3)).toBe('stabile')
    expect(band(0)).toBe('poco instabile')
    expect(band(-2.9)).toBe('poco instabile')
    expect(band(-3)).toBe('moderatamente instabile')
    expect(band(-5.9)).toBe('moderatamente instabile')
    expect(band(-6)).toBe('molto instabile')
    expect(band(-8.9)).toBe('molto instabile')
    expect(band(-9)).toBe('estremamente instabile')
  })

  it('returns nothing without data', () => {
    expect(liftedIndexReading(null)).toBeNull()
  })
})

describe('cinReading', () => {
  const band = (cin: number | null) => cinReading(cin)?.label

  it('walks the published inhibition thresholds', () => {
    expect(band(0)).toBe('debole')
    expect(band(24)).toBe('debole')
    expect(band(25)).toBe('moderata')
    expect(band(49)).toBe('moderata')
    expect(band(50)).toBe('significativa')
    expect(band(200)).toBe('significativa')
    expect(band(201)).toBe('forte')
  })

  it('reads the magnitude, whichever sign the API sends', () => {
    // Open-Meteo returns CIN positive; the textbook convention is negative.
    expect(band(-150)).toBe(band(150))
    expect(band(-10)).toBe('debole')
  })

  it('stays colour-neutral, because strong inhibition means fewer storms', () => {
    expect(cinReading(500)?.token).toBe('var(--text)')
    expect(cinReading(0)?.token).toBe('var(--text)')
  })

  it('returns nothing without data', () => {
    expect(cinReading(null)).toBeNull()
  })
})

describe('labelForModel', () => {
  it('maps known model ids to short labels', () => {
    expect(labelForModel('ecmwf_ifs025_ensemble')).toBe('ECMWF')
    expect(labelForModel('icon_global_eps')).toBe('ICON')
    expect(labelForModel('ncep_gefs025')).toBe('GFS')
  })

  it('falls back to the raw id', () => {
    expect(labelForModel('bom_access_global_ensemble')).toBe('bom_access_global_ensemble')
  })
})
