import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type {
  AirQualityResponse,
  EnsembleResponse,
  ForecastResponse,
  GeoLocation,
  MultiModelResponse,
} from '../types/weather'

const fetchForecast = vi.fn()
const fetchModelComparison = vi.fn()
const fetchEnsemble = vi.fn()
const fetchAirQuality = vi.fn()

vi.mock('../api/forecast', () => ({
  fetchForecast: (...a: unknown[]) => fetchForecast(...a),
  fetchModelComparison: (...a: unknown[]) => fetchModelComparison(...a),
}))
vi.mock('../api/ensemble', () => ({ fetchEnsemble: (...a: unknown[]) => fetchEnsemble(...a) }))
vi.mock('../api/airQuality', () => ({ fetchAirQuality: (...a: unknown[]) => fetchAirQuality(...a) }))

const { useForecast } = await import('./useForecast')

const LOCATION: GeoLocation = {
  id: '45.0705,7.6868',
  name: 'Torino',
  country: 'Italia',
  latitude: 45.0705,
  longitude: 7.6868,
  timezone: 'Europe/Rome',
}

/** The browser's current UTC offset, so `localIso` and the stub agree. */
function browserUtcOffsetSeconds(): number {
  return -new Date().getTimezoneOffset() * 60
}

function localIso(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:00`
}

/** A forecast whose `current` timestamp sits `hoursAgo` in the past. */
function forecast(hoursAgo = 0): ForecastResponse {
  const observed = new Date(Date.now() - hoursAgo * 3_600_000)
  const time = Array.from({ length: 48 }, (_, i) =>
    localIso(new Date(observed.getTime() + i * 3_600_000)),
  )
  const series = <T>(v: T) => time.map(() => v)

  return {
    latitude: 45.07,
    longitude: 7.69,
    elevation: 239,
    timezone: 'Europe/Rome',
    utc_offset_seconds: browserUtcOffsetSeconds(),
    current: {
      time: localIso(observed),
      temperature_2m: 22,
      apparent_temperature: 23,
      relative_humidity_2m: 74,
      precipitation: 0,
      weather_code: 2,
      cloud_cover: 74,
      surface_pressure: 986,
      wind_speed_10m: 7,
      wind_gusts_10m: 21,
      wind_direction_10m: 45,
      is_day: 0,
    },
    hourly: {
      time,
      temperature_2m: series(20),
      apparent_temperature: series(21),
      precipitation_probability: series(10),
      precipitation: series(0),
      rain: series(0),
      showers: series(0),
      snowfall: series(0),
      weather_code: series(2),
      cloud_cover: series(60),
      relative_humidity_2m: series(70),
      surface_pressure: series(986),
      wind_speed_10m: series(7),
      wind_gusts_10m: series(20),
      wind_direction_10m: series(45),
      uv_index: series(0),
      cape: series(0),
      lifted_index: series(2),
      convective_inhibition: series(0),
    },
    daily: {
      time: [localIso(observed).slice(0, 10)],
      weather_code: [2],
      temperature_2m_max: [28],
      temperature_2m_min: [21],
      apparent_temperature_max: [29],
      apparent_temperature_min: [23],
      precipitation_sum: [0],
      precipitation_probability_max: [10],
      uv_index_max: [6],
      wind_speed_10m_max: [18],
      wind_gusts_10m_max: [35],
      sunrise: [`${localIso(observed).slice(0, 10)}T07:08`],
      sunset: [`${localIso(observed).slice(0, 10)}T19:38`],
    },
  }
}

function ensemble(): EnsembleResponse {
  const time = forecast().hourly.time
  return {
    hourly: {
      time,
      weather_code_ecmwf_ifs025_ensemble: time.map(() => 95),
      cape_ecmwf_ifs025_ensemble: time.map(() => 1500),
      precipitation_ecmwf_ifs025_ensemble: time.map(() => 2),

      weather_code_member01_ecmwf_ifs025_ensemble: time.map(() => 3),
      cape_member01_ecmwf_ifs025_ensemble: time.map(() => 1500),
      precipitation_member01_ecmwf_ifs025_ensemble: time.map(() => 0),
    },
  }
}

/** ECMWF and GFS see rain in every hour; ICON does not. */
function comparison(): MultiModelResponse {
  const time = forecast().hourly.time
  return {
    hourly: {
      time,
      precipitation_icon_global: time.map(() => 0),
      weather_code_icon_global: time.map(() => 3),
      precipitation_ecmwf_ifs025: time.map(() => 1.2),
      weather_code_ecmwf_ifs025: time.map(() => 61),
      precipitation_gfs_global: time.map(() => 0.8),
      weather_code_gfs_global: time.map(() => 61),
    },
  }
}

function airQuality(): AirQualityResponse {
  const time = forecast().hourly.time
  return {
    hourly: {
      time,
      pm2_5: time.map(() => 12),
      pm10: time.map(() => 16),
      ozone: time.map(() => 82),
      nitrogen_dioxide: time.map(() => 18),
      european_aqi: time.map(() => 35),
    },
  }
}

/** Runs the composable inside a scope so its watchers can be disposed. */
async function run() {
  const scope = effectScope()
  const location = ref(LOCATION)
  const api = scope.run(() => useForecast(location))!
  // Let the immediate watcher fire and its four requests settle.
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
  return { ...api, dispose: () => scope.stop() }
}

describe('useForecast', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchForecast.mockReset()
    fetchModelComparison.mockReset()
    fetchEnsemble.mockReset()
    fetchAirQuality.mockReset()
  })

  afterEach(() => localStorage.clear())

  it('merges all four responses on success', async () => {
    fetchForecast.mockResolvedValue(forecast())
    fetchEnsemble.mockResolvedValue(ensemble())
    fetchModelComparison.mockResolvedValue(comparison())
    fetchAirQuality.mockResolvedValue(airQuality())

    const { model, error, stale, loading, dispose } = await run()

    expect(error.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(stale.value).toBe(false)
    expect(model.value?.current.temperature).toBe(22)
    expect(model.value?.hourly[0].stormProbability).toBe(50)
    expect(model.value?.hourly[0].modelConsensus).toEqual({
      wet: ['ECMWF', 'GFS'],
      dry: ['ICON'],
    })
    expect(model.value?.airQuality?.europeanAqi).toBe(35)
    expect(model.value?.degraded).toEqual([])
    dispose()
  })

  it('renders without the model split when only that call fails', async () => {
    fetchForecast.mockResolvedValue(forecast())
    fetchEnsemble.mockResolvedValue(ensemble())
    fetchModelComparison.mockRejectedValue(new Error('boom'))
    fetchAirQuality.mockResolvedValue(airQuality())

    const { model, error, dispose } = await run()

    expect(error.value).toBeNull()
    expect(model.value?.hourly[0].modelConsensus).toBeNull()
    // Everything else still renders.
    expect(model.value?.hourly[0].stormProbability).toBe(50)
    expect(model.value?.degraded).toEqual(['confronto'])
    dispose()
  })

  it('renders without storm data when only the ensemble fails', async () => {
    fetchForecast.mockResolvedValue(forecast())
    fetchEnsemble.mockRejectedValue(new Error('boom'))
    fetchModelComparison.mockResolvedValue(comparison())
    fetchAirQuality.mockResolvedValue(airQuality())

    const { model, error, dispose } = await run()

    expect(error.value).toBeNull()
    expect(model.value?.degraded).toEqual(['ensemble'])
    expect(model.value?.hourly[0].stormProbability).toBeNull()
    expect(model.value?.current.temperature).toBe(22)
    dispose()
  })

  it('renders without air quality when only that call fails', async () => {
    fetchForecast.mockResolvedValue(forecast())
    fetchEnsemble.mockResolvedValue(ensemble())
    fetchModelComparison.mockResolvedValue(comparison())
    fetchAirQuality.mockRejectedValue(new Error('boom'))

    const { model, error, dispose } = await run()

    expect(error.value).toBeNull()
    expect(model.value?.degraded).toEqual(['aria'])
    expect(model.value?.airQuality).toBeNull()
    dispose()
  })

  it('caches a successful payload for the next load', async () => {
    fetchForecast.mockResolvedValue(forecast())
    fetchEnsemble.mockResolvedValue(ensemble())
    fetchModelComparison.mockResolvedValue(comparison())
    fetchAirQuality.mockResolvedValue(airQuality())

    const first = await run()
    first.dispose()
    expect(localStorage.getItem('meteo:last-forecast')).not.toBeNull()

    // Second load, network down: the cached payload carries the page.
    fetchForecast.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchEnsemble.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchModelComparison.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchAirQuality.mockRejectedValue(new Error('Rete non raggiungibile'))

    const { model, error, stale, dispose } = await run()

    expect(model.value?.current.temperature).toBe(22)
    expect(stale.value).toBe(true)
    expect(error.value).toBe('Dati non aggiornabili: rete non raggiungibile.')
    dispose()
  })

  it('reports an error when the forecast fails with nothing cached', async () => {
    fetchForecast.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchEnsemble.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchModelComparison.mockRejectedValue(new Error('Rete non raggiungibile'))
    fetchAirQuality.mockRejectedValue(new Error('Rete non raggiungibile'))

    const { model, error, loading, dispose } = await run()

    expect(model.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBe('Rete non raggiungibile')
    dispose()
  })

  it('flags stale data even when a replayed cache hit looks like a success', async () => {
    // What the service worker does offline: the request resolves, with data
    // that is hours old.
    fetchForecast.mockResolvedValue(forecast(6))
    fetchEnsemble.mockResolvedValue(ensemble())
    fetchModelComparison.mockResolvedValue(comparison())
    fetchAirQuality.mockResolvedValue(airQuality())

    const { stale, error, model, dispose } = await run()

    expect(error.value).toBeNull()
    expect(stale.value).toBe(true)
    expect(model.value).not.toBeNull()
    dispose()
  })
})
