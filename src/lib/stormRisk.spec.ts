import { describe, expect, it } from 'vitest'
import ensembleFixture from './__fixtures__/ensemble.json'
import {
  CONVECTIVE_CAPE_MIN,
  CONVECTIVE_PRECIPITATION_MIN,
  DISAGREEMENT_THRESHOLD,
  MEMBER_RAIN_MIN,
  capeReading,
  cinReading,
  convectiveProbability,
  groupMembers,
  labelForModel,
  liftedIndexReading,
  modelsDisagree,
} from './stormRisk'

/*
 * The fixture is a live capture, trimmed to six hours:
 * ensemble-api.open-meteo.com/v1/ensemble?latitude=43.9102&longitude=12.9132
 *   &hourly=weather_code,cape,precipitation&models=ecmwf_ifs025,icon_global,gfs025
 *   &forecast_days=1&timezone=auto
 * ICON global EPS really does return null CAPE for every member and hour; that
 * is the case the convective probability has to survive, so it is kept as is.
 */

/** One member's inputs for one hour. Omitted fields read as a benign zero. */
interface MemberHour {
  cape?: number | null
  rain?: number | null
  code?: number | null
}

/** Convective: rain and energy together, comfortably past both thresholds. */
const CONVECTIVE: MemberHour = { cape: 1200, rain: 1 }
/** Rain with no energy behind it — a front, not a storm. */
const FRONTAL: MemberHour = { cape: 0, rain: 2 }
/** Energy with nothing falling: the trigger never came. */
const CAPPED: MemberHour = { cape: 1200, rain: 0 }
/** What ICON global EPS looks like: precipitation, never CAPE. */
const NO_CAPE: MemberHour = { cape: null, rain: 2 }

/** Builds a flat ensemble-shaped payload from per-model member hours. */
function flatten(models: Record<string, MemberHour[][]>): Record<string, unknown> {
  const hourly: Record<string, unknown> = { time: [] }
  for (const [model, members] of Object.entries(models)) {
    members.forEach((hours, i) => {
      // The first member stands in for the control run, which has no number.
      const suffix = i === 0 ? model : `member${String(i).padStart(2, '0')}_${model}`
      hourly[`weather_code_${suffix}`] = hours.map((hour) => hour.code ?? 0)
      hourly[`cape_${suffix}`] = hours.map((hour) => (hour.cape === undefined ? 0 : hour.cape))
      hourly[`precipitation_${suffix}`] = hours.map((hour) =>
        hour.rain === undefined ? 0 : hour.rain,
      )
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

  it('joins the three variables of one member into one series set', () => {
    const grouped = groupMembers({
      time: ['2026-09-16T00:00'],
      weather_code_member01_icon_global_eps: [95],
      cape_member01_icon_global_eps: [800],
      precipitation_member01_icon_global_eps: [1.4],
    })

    expect(grouped.icon_global_eps).toHaveLength(1)
    expect(grouped.icon_global_eps[0]).toEqual({
      weatherCode: [95],
      cape: [800],
      precipitation: [1.4],
    })
  })

  it('reads the suffix rather than the requested model id', () => {
    // gfs025 is requested but comes back as ncep_gefs025.
    const grouped = groupMembers(ensembleFixture.hourly as Record<string, unknown>)
    expect(grouped.gfs025).toBeUndefined()
    expect(grouped.ncep_gefs025).toBeDefined()
  })

  it('skips bare variable keys so the control is not double-counted', () => {
    const grouped = groupMembers({
      time: ['2026-09-16T00:00'],
      weather_code: [95],
      cape: [800],
      precipitation: [1.4],
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

describe('convectiveProbability', () => {
  it('reports 100 when every member has rain and the energy behind it', () => {
    const grouped = groupMembers(flatten({ m: [[CONVECTIVE], [CONVECTIVE], [CONVECTIVE]] }))
    expect(convectiveProbability(grouped, 1).combined).toEqual([100])
  })

  it('reports 0 for rain falling from a column with no energy', () => {
    // The frontal case: every member wet, no member convective.
    const grouped = groupMembers(flatten({ m: [[FRONTAL], [FRONTAL], [FRONTAL]] }))
    const result = convectiveProbability(grouped, 1)

    expect(result.combined).toEqual([0])
    expect(result.rain).toEqual([100])
  })

  it('reports 0 for energy that never rained', () => {
    const grouped = groupMembers(flatten({ m: [[CAPPED], [CAPPED], [CAPPED]] }))
    expect(convectiveProbability(grouped, 1).combined).toEqual([0])
  })

  it('counts a member exactly at both thresholds', () => {
    const at: MemberHour = { cape: CONVECTIVE_CAPE_MIN, rain: CONVECTIVE_PRECIPITATION_MIN }
    const below: MemberHour = { cape: CONVECTIVE_CAPE_MIN - 1, rain: CONVECTIVE_PRECIPITATION_MIN }
    const grouped = groupMembers(flatten({ m: [[at], [below]] }))
    expect(convectiveProbability(grouped, 1).combined).toEqual([50])
  })

  it('counts a thunderstorm code even when the thresholds are not met', () => {
    // Rare, but when a model does emit 95 it is not evidence to throw away.
    const coded: MemberHour = { cape: 0, rain: 0, code: 95 }
    const grouped = groupMembers(flatten({ m: [[coded], [CAPPED]] }))
    expect(convectiveProbability(grouped, 1).combined).toEqual([50])
  })

  it('reports the member share within a single model', () => {
    const grouped = groupMembers(
      flatten({ m: [[CONVECTIVE], [CONVECTIVE], [FRONTAL], [FRONTAL]] }),
    )
    expect(convectiveProbability(grouped, 1).combined).toEqual([50])
  })

  it('excludes members without CAPE from both numerator and denominator', () => {
    // 2 of the 3 judgeable members are convective: 67%, not 50% of all four.
    const grouped = groupMembers(
      flatten({ m: [[CONVECTIVE], [CONVECTIVE], [FRONTAL], [NO_CAPE]] }),
    )
    expect(convectiveProbability(grouped, 1).combined).toEqual([67])
  })

  it('yields null when fewer than half the members can be judged', () => {
    const grouped = groupMembers(
      flatten({ m: [[CONVECTIVE], [NO_CAPE], [NO_CAPE], [NO_CAPE]] }),
    )
    expect(convectiveProbability(grouped, 1).combined).toEqual([null])
  })

  it('keeps the hour when exactly half the members can be judged', () => {
    const grouped = groupMembers(
      flatten({ m: [[CONVECTIVE], [FRONTAL], [NO_CAPE], [NO_CAPE]] }),
    )
    expect(convectiveProbability(grouped, 1).combined).toEqual([50])
  })

  it('drops a model that publishes no CAPE instead of counting it as zero', () => {
    // This is ICON global EPS. Counting its silence as 0% was what buried the
    // signal: a real 96% from ECMWF averaged down to 32%.
    const grouped = groupMembers(
      flatten({
        ecmwf_ifs025_ensemble: [[CONVECTIVE], [CONVECTIVE]],
        icon_global_eps: [[NO_CAPE], [NO_CAPE]],
      }),
    )
    const result = convectiveProbability(grouped, 1)

    expect(result.perModel.icon_global_eps).toEqual([null])
    expect(result.combined).toEqual([100])
    // It still counts for the rain share, which needs no CAPE.
    expect(result.rain).toEqual([100])
  })

  it('weights each model equally regardless of its member count', () => {
    const grouped = groupMembers(
      flatten({
        big: [[CONVECTIVE], [CONVECTIVE], [CONVECTIVE], [CONVECTIVE]],
        small: [[FRONTAL]],
      }),
    )
    const result = convectiveProbability(grouped, 1)

    expect(result.perModel.big).toEqual([100])
    expect(result.perModel.small).toEqual([0])
    // Mean of 100 and 0, not 4 convective members out of 5.
    expect(result.combined).toEqual([50])
  })

  it('averages three models the way the real request returns them', () => {
    const grouped = groupMembers(
      flatten({
        a: [[CONVECTIVE], [CONVECTIVE], [FRONTAL], [FRONTAL]],
        b: [[CONVECTIVE], [FRONTAL], [FRONTAL], [FRONTAL]],
        c: [[FRONTAL], [FRONTAL], [FRONTAL], [FRONTAL]],
      }),
    )
    // 50, 25 and 0 average to 25.
    expect(convectiveProbability(grouped, 1).combined).toEqual([25])
  })

  it('computes spread as max minus min across models', () => {
    const grouped = groupMembers(
      flatten({
        a: [[CONVECTIVE], [CONVECTIVE]],
        b: [[CONVECTIVE], [FRONTAL]],
        c: [[FRONTAL], [FRONTAL]],
      }),
    )
    expect(convectiveProbability(grouped, 1).spread).toEqual([100])
  })

  it('leaves spread null when fewer than two models report', () => {
    const grouped = groupMembers(flatten({ only: [[CONVECTIVE], [FRONTAL]] }))
    expect(convectiveProbability(grouped, 1).spread).toEqual([null])
  })

  it('handles every hour of the window independently', () => {
    const grouped = groupMembers(
      flatten({
        m: [
          [CONVECTIVE, FRONTAL, CONVECTIVE],
          [CONVECTIVE, FRONTAL, FRONTAL],
        ],
      }),
    )
    expect(convectiveProbability(grouped, 3).combined).toEqual([100, 0, 50])
  })

  it('counts the rain share at the threshold, across every model', () => {
    const wet: MemberHour = { cape: 0, rain: MEMBER_RAIN_MIN }
    const dry: MemberHour = { cape: 0, rain: MEMBER_RAIN_MIN - 0.01 }
    const grouped = groupMembers(flatten({ a: [[wet], [dry]], b: [[wet], [wet]] }))
    // 50 and 100 average to 75.
    expect(convectiveProbability(grouped, 1).rain).toEqual([75])
  })

  it('produces one value per hour for the real fixture', () => {
    const grouped = groupMembers(ensembleFixture.hourly as Record<string, unknown>)
    const hours = ensembleFixture.hourly.time.length
    const result = convectiveProbability(grouped, hours)

    expect(result.combined).toHaveLength(hours)
    expect(result.rain).toHaveLength(hours)
    expect(Object.keys(result.perModel)).toHaveLength(3)
    for (const value of result.combined) {
      expect(value === null || (value >= 0 && value <= 100)).toBe(true)
    }
    // ICON publishes no CAPE, so it reports nothing for any hour of the capture.
    expect(result.perModel.icon_global_eps.every((value) => value === null)).toBe(true)
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
