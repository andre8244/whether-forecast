import { describe, expect, it } from 'vitest'
import { HOURLY_WINDOW, buildViewModel } from './viewModel'
import { instantOf } from './format'
import type {
  AirQualityResponse,
  EnsembleResponse,
  ForecastResponse,
  GeoLocation,
} from '../types/weather'

const LOCATION: GeoLocation = {
  id: '45.0705,7.6868',
  name: 'Torino',
  country: 'Italia',
  latitude: 45.0705,
  longitude: 7.6868,
  timezone: 'Europe/Rome',
}

/** 72 consecutive local hours starting at midnight on 2026-09-16. */
function hourTimes(count: number): string[] {
  const times: string[] = []
  const start = new Date('2026-09-16T00:00:00')
  for (let i = 0; i < count; i += 1) {
    const at = new Date(start.getTime() + i * 3_600_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    times.push(
      `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:00`,
    )
  }
  return times
}

function forecastStub(hours: number): ForecastResponse {
  const time = hourTimes(hours)
  const series = <T>(value: T) => time.map(() => value)

  return {
    latitude: 45.07,
    longitude: 7.69,
    elevation: 239,
    timezone: 'Europe/Rome',
    utc_offset_seconds: 7200,
    current: {
      time: '2026-09-16T12:00',
      temperature_2m: 24.1,
      apparent_temperature: 25.8,
      relative_humidity_2m: 58,
      precipitation: 0,
      weather_code: 2,
      cloud_cover: 40,
      surface_pressure: 1012,
      wind_speed_10m: 9,
      wind_gusts_10m: 21,
      wind_direction_10m: 200,
      is_day: 1,
    },
    hourly: {
      time,
      temperature_2m: time.map((_, i) => 15 + (i % 12)),
      apparent_temperature: time.map((_, i) => 16 + (i % 12)),
      precipitation_probability: series(20),
      precipitation: series(0.2),
      rain: series(0.2),
      showers: series(0),
      snowfall: series(0),
      weather_code: series(3),
      cloud_cover: series(55),
      relative_humidity_2m: series(60),
      surface_pressure: series(1011),
      wind_speed_10m: series(8),
      wind_gusts_10m: series(18),
      wind_direction_10m: series(210),
      uv_index: series(4),
      cape: series(1200),
      lifted_index: series(-1),
      convective_inhibition: series(-20),
    },
    daily: {
      time: ['2026-09-16', '2026-09-17', '2026-09-18'],
      weather_code: [95, 3, 61],
      temperature_2m_max: [27, 24, 22],
      temperature_2m_min: [15, 14, 13],
      apparent_temperature_max: [29, 25, 22],
      apparent_temperature_min: [14, 13, 12],
      precipitation_sum: [4.2, 0, 1.1],
      precipitation_probability_max: [70, 10, 40],
      uv_index_max: [6, 5, 4],
      wind_speed_10m_max: [18, 12, 15],
      wind_gusts_10m_max: [42, 25, 33],
      sunrise: ['2026-09-16T07:02', '2026-09-17T07:03', '2026-09-18T07:04'],
      sunset: ['2026-09-16T19:36', '2026-09-17T19:34', '2026-09-18T19:33'],
    },
  }
}

/** Two models; on the first day member 1 of each is stormy, later none are. */
function ensembleStub(hours: number): EnsembleResponse {
  const time = hourTimes(hours)
  const stormyFirstDay = time.map((t) => (t.startsWith('2026-09-16') ? 95 : 3))
  const calm = time.map(() => 3)

  return {
    hourly: {
      time,
      weather_code_ecmwf_ifs025_ensemble: stormyFirstDay,
      weather_code_member01_ecmwf_ifs025_ensemble: calm,
      weather_code_icon_global_eps: calm,
      weather_code_member01_icon_global_eps: calm,
    },
  }
}

function airQualityStub(hours: number): AirQualityResponse {
  const time = hourTimes(hours)
  return {
    hourly: {
      time,
      pm2_5: time.map((_, i) => 8 + i),
      pm10: time.map((_, i) => 14 + i),
      ozone: time.map(() => 60),
      nitrogen_dioxide: time.map(() => 22),
      european_aqi: time.map((_, i) => 25 + i),
    },
  }
}

/** 12:30 local to the stub, which sits at UTC+2. */
const NOON = instantOf('2026-09-16T12:30', 2 * 3600)

function build(overrides: Partial<Parameters<typeof buildViewModel>[0]> = {}) {
  const hours = 72
  return buildViewModel({
    location: LOCATION,
    forecast: forecastStub(hours),
    ensemble: ensembleStub(hours),
    airQuality: airQualityStub(hours),
    degraded: [],
    now: NOON,
    fetchedAt: NOON,
    ...overrides,
  })
}

describe('buildViewModel', () => {
  it('returns a 48-hour window starting at the hour in progress', () => {
    const model = build()
    expect(model.hourly).toHaveLength(HOURLY_WINDOW)
    // 12:30 falls inside the 12:00 hour, which stays visible.
    expect(model.hourly[0].time).toBe('2026-09-16T12:00')
  })

  it('carries perceived temperature alongside the measured one', () => {
    const model = build()
    expect(model.current.temperature).toBe(24.1)
    expect(model.current.apparentTemperature).toBe(25.8)
    expect(model.hourly[0].apparentTemperature).not.toBeNull()
  })

  it('attaches pooled and per-model storm probability to each hour', () => {
    const first = build().hourly[0]
    // 1 of 4 pooled members is stormy; 1 of 2 for ECMWF, 0 of 2 for ICON.
    expect(first.stormProbability).toBe(25)
    expect(first.stormPerModel.ecmwf_ifs025_ensemble).toBe(50)
    expect(first.stormPerModel.icon_global_eps).toBe(0)
    expect(first.stormSpread).toBe(50)
  })

  it('derives the daily storm peak from that day’s hours', () => {
    const model = build()
    expect(model.daily[0].stormProbabilityMax).toBe(25)
    expect(model.daily[1].stormProbabilityMax).toBe(0)
  })

  it('passes the raw convective indices through without deriving a score', () => {
    const first = build().hourly[0]
    expect(first.cape).toBe(1200)
    expect(first.liftedIndex).toBe(-1)
    expect(first.cin).toBe(-20)
  })

  it('degrades to null storm data when the ensemble call failed', () => {
    const model = build({ ensemble: null, degraded: ['ensemble'] })
    expect(model.hourly[0].stormProbability).toBeNull()
    expect(model.hourly[0].stormPerModel).toEqual({})
    expect(model.daily[0].stormProbabilityMax).toBeNull()
    expect(model.degraded).toEqual(['ensemble'])
    // Everything else still renders.
    expect(model.current.temperature).toBe(24.1)
    expect(model.hourly).toHaveLength(HOURLY_WINDOW)
  })

  it('degrades to no air quality when that call failed', () => {
    expect(build({ airQuality: null }).airQuality).toBeNull()
  })

  it('picks the air quality reading for the current hour', () => {
    // Hour index 12 of the stub series.
    expect(build().airQuality?.europeanAqi).toBe(37)
  })

  it('maps the daily rows through', () => {
    const day = build().daily[0]
    expect(day.tempMax).toBe(27)
    expect(day.apparentMax).toBe(29)
    expect(day.precipitationSum).toBe(4.2)
    expect(day.sunrise).toBe('2026-09-16T07:02')
  })

  it('clamps the window when the forecast is shorter than 48 hours', () => {
    const hours = 24
    const model = buildViewModel({
      location: LOCATION,
      forecast: forecastStub(hours),
      ensemble: ensembleStub(hours),
      airQuality: null,
      degraded: [],
      now: NOON,
    })
    expect(model.hourly.length).toBeLessThanOrEqual(hours)
    expect(model.hourly.length).toBeGreaterThan(0)
  })

  it('picks the current hour for a location in another timezone', () => {
    // A Miami forecast (UTC-4) read by a browser elsewhere: the naive local
    // strings are hours apart from the viewer's clock, so the window must be
    // chosen on true instants, not on the strings themselves.
    const hours = 72
    const base = forecastStub(hours)
    const miami: ForecastResponse = {
      ...base,
      utc_offset_seconds: -4 * 3600,
      current: { ...base.current, time: '2026-09-16T08:30' },
    }

    // 2026-09-16T12:30 local in the stub's strings, read as UTC-4, is 16:30Z.
    const model = buildViewModel({
      location: LOCATION,
      forecast: miami,
      ensemble: null,
      airQuality: null,
      degraded: [],
      now: Date.parse('2026-09-16T16:30:00Z'),
    })

    expect(model.hourly[0].time).toBe('2026-09-16T12:00')
    expect(model.observedAt).toBe(Date.parse('2026-09-16T12:30:00Z'))
  })

  it('reports observedAt as a true instant, not a naive local reading', () => {
    const model = build()
    // The stub is UTC+2 and its current time is 12:00 local, so 10:00Z.
    expect(model.observedAt).toBe(Date.parse('2026-09-16T10:00:00Z'))
  })

  it('falls back to the last hours when the forecast is entirely in the past', () => {
    const hours = 72
    const model = buildViewModel({
      location: LOCATION,
      forecast: forecastStub(hours),
      ensemble: null,
      airQuality: null,
      degraded: [],
      now: instantOf('2027-01-01T00:00', 2 * 3600),
    })
    expect(model.hourly).toHaveLength(HOURLY_WINDOW)
  })
})
