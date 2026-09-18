import { describe, expect, it } from 'vitest'
import {
  MIN_DISSENTING_MODELS,
  MODEL_RAIN_MIN,
  consensusFor,
  groupModels,
  labelForComparisonModel,
  modelConsensus,
  modelsSeeRain,
} from './modelConsensus'

/** Builds the flat shape the forecast endpoint returns for several models. */
function flatten(
  models: Record<string, { rain: (number | null)[]; codes?: (number | null)[] }>,
): Record<string, unknown> {
  const hourly: Record<string, unknown> = { time: [] }
  for (const [model, series] of Object.entries(models)) {
    hourly[`precipitation_${model}`] = series.rain
    hourly[`weather_code_${model}`] = series.codes ?? series.rain.map(() => 3)
  }
  return hourly
}

describe('groupModels', () => {
  it('pairs each model’s two series', () => {
    const models = groupModels(flatten({ icon_global: { rain: [0.4], codes: [61] } }))
    expect(models.icon_global).toEqual({ precipitation: [0.4], weatherCode: [61] })
  })

  it('skips bare variable keys, which carry no model', () => {
    expect(groupModels({ time: ['x'], precipitation: [1], weather_code: [61] })).toEqual({})
  })

  it('ignores non-array values', () => {
    expect(groupModels({ time: ['x'], latitude: 45.07 as unknown })).toEqual({})
  })
})

describe('modelConsensus', () => {
  it('splits the models into wet and dry, by label', () => {
    const models = groupModels(
      flatten({
        icon_global: { rain: [0] },
        ecmwf_ifs025: { rain: [1] },
        gfs_global: { rain: [1.1] },
      }),
    )
    expect(modelConsensus(models, 1)).toEqual([{ wet: ['ECMWF', 'GFS'], dry: ['ICON'] }])
  })

  it('counts a model wet at the threshold, dry below it', () => {
    const models = groupModels(
      flatten({
        ecmwf_ifs025: { rain: [MODEL_RAIN_MIN] },
        gfs_global: { rain: [MODEL_RAIN_MIN - 0.01] },
      }),
    )
    expect(modelConsensus(models, 1)).toEqual([{ wet: ['ECMWF'], dry: ['GFS'] }])
  })

  it('counts a precipitation code as wet even with no accumulation', () => {
    // Drizzle can be forecast with a depth that rounds to nothing.
    const models = groupModels(flatten({ ecmwf_ifs025: { rain: [0], codes: [51] } }))
    expect(modelConsensus(models, 1)).toEqual([{ wet: ['ECMWF'], dry: [] }])
  })

  it('leaves a model that reported nothing out of both lists', () => {
    const models = groupModels(
      flatten({
        icon_global: { rain: [null], codes: [null] },
        ecmwf_ifs025: { rain: [1] },
      }),
    )
    expect(modelConsensus(models, 1)).toEqual([{ wet: ['ECMWF'], dry: [] }])
  })

  it('yields null for an hour no model answered, rather than an empty split', () => {
    const models = groupModels(flatten({ icon_global: { rain: [null], codes: [null] } }))
    expect(modelConsensus(models, 1)).toEqual([null])
  })

  it('handles every hour independently', () => {
    const models = groupModels(
      flatten({ icon_global: { rain: [1, 0] }, ecmwf_ifs025: { rain: [1, 1] } }),
    )
    expect(modelConsensus(models, 2)).toEqual([
      { wet: ['ICON', 'ECMWF'], dry: [] },
      { wet: ['ECMWF'], dry: ['ICON'] },
    ])
  })

  it('pads hours the response did not reach', () => {
    const models = groupModels(flatten({ icon_global: { rain: [1] } }))
    expect(modelConsensus(models, 3)).toEqual([{ wet: ['ICON'], dry: [] }, null, null])
  })
})

describe('modelsSeeRain', () => {
  it('needs more than one model before doubting the headline', () => {
    expect(modelsSeeRain({ wet: ['ECMWF'], dry: ['ICON', 'GFS'] })).toBe(false)
    expect(modelsSeeRain({ wet: ['ECMWF', 'GFS'], dry: ['ICON'] })).toBe(true)
    expect(MIN_DISSENTING_MODELS).toBe(2)
  })

  it('is false without a split at all', () => {
    expect(modelsSeeRain(null)).toBe(false)
  })
})

describe('labelForComparisonModel', () => {
  it('names the three models it knows', () => {
    expect(labelForComparisonModel('icon_global')).toBe('ICON')
    expect(labelForComparisonModel('ecmwf_ifs025')).toBe('ECMWF')
    expect(labelForComparisonModel('gfs_global')).toBe('GFS')
  })

  it('falls back to the raw id', () => {
    expect(labelForComparisonModel('meteofrance_arpege')).toBe('meteofrance_arpege')
  })
})

describe('consensusFor', () => {
  it('reads a response in the shape the endpoint returns', () => {
    const response = {
      hourly: flatten({ icon_global: { rain: [0] }, ecmwf_ifs025: { rain: [2] } }),
    } as { hourly: { time: string[] } & Record<string, (number | null)[] | string[]> }

    expect(consensusFor(response, 1)).toEqual([{ wet: ['ECMWF'], dry: ['ICON'] }])
  })
})
