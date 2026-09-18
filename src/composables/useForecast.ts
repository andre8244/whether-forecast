import { ref, shallowRef, watch, type Ref } from 'vue'
import { fetchAirQuality } from '../api/airQuality'
import { fetchEnsemble } from '../api/ensemble'
import { fetchForecast, fetchModelComparison } from '../api/forecast'
import { buildViewModel } from '../lib/viewModel'
import { readJson, remove, writeJson } from '../lib/storage'
import type {
  AirQualityResponse,
  EnsembleResponse,
  ForecastResponse,
  ForecastViewModel,
  GeoLocation,
  MultiModelResponse,
} from '../types/weather'

const CACHE_KEY = 'meteo:last-forecast'

/**
 * Forecast data older than this is shown with a staleness banner.
 *
 * `fetchedAt` cannot carry this judgement: the service worker replays cached
 * API responses while offline, so a request can "succeed" against hours-old
 * data. The forecast's own `current` timestamp is checked instead.
 */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000

export function isStale(observedAt: number, now = Date.now()): boolean {
  return now - observedAt > STALE_AFTER_MS
}

interface CachedPayload {
  location: GeoLocation
  forecast: ForecastResponse
  ensemble: EnsembleResponse | null
  comparison: MultiModelResponse | null
  airQuality: AirQualityResponse | null
  degraded: string[]
  fetchedAt: number
}

export function useForecast(location: Ref<GeoLocation>) {
  const model = shallowRef<ForecastViewModel | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** True when the rendered data is too old to present as current. */
  const stale = ref(false)

  let controller: AbortController | undefined

  /**
   * Render the stored payload for this place, if there is one.
   *
   * The cache holds raw API responses, so a build that adds or renames a field
   * reads back payloads written by the previous one. `buildViewModel` tolerates
   * a missing series, but anything it cannot survive must not strand the page:
   * this ran before the network call, so a throw here left the loading banner
   * up with no request ever sent. A payload that cannot be rendered is dropped
   * instead, and the fetch carries on.
   */
  function renderCached(target: GeoLocation): boolean {
    const cached = readJson<CachedPayload | null>(CACHE_KEY, null)
    if (!cached || cached.location.id !== target.id) return false

    try {
      model.value = buildViewModel({ ...cached, now: Date.now() })
    } catch {
      remove(CACHE_KEY)
      return false
    }

    stale.value = true
    return true
  }

  async function load(target: GeoLocation, silent = false): Promise<void> {
    controller?.abort()
    const active = new AbortController()
    controller = active

    if (!silent) {
      loading.value = true
      error.value = null
      // Show the cached payload for this place while the network call runs.
      if (model.value?.location.id !== target.id) model.value = null
      renderCached(target)
    }

    const [forecastResult, ensembleResult, comparisonResult, airQualityResult] =
      await Promise.allSettled([
        fetchForecast(target.latitude, target.longitude, active.signal),
        fetchEnsemble(target.latitude, target.longitude, active.signal),
        fetchModelComparison(target.latitude, target.longitude, active.signal),
        fetchAirQuality(target.latitude, target.longitude, active.signal),
      ])

    if (active.signal.aborted) return

    // The forecast is the only response the page cannot do without.
    if (forecastResult.status === 'rejected') {
      loading.value = false
      const cached = renderCached(target)
      error.value = cached
        ? 'Dati non aggiornabili: rete non raggiungibile.'
        : forecastResult.reason instanceof Error
          ? forecastResult.reason.message
          : 'Impossibile caricare le previsioni'
      return
    }

    const degraded: string[] = []
    const ensemble = ensembleResult.status === 'fulfilled' ? ensembleResult.value : null
    const comparison = comparisonResult.status === 'fulfilled' ? comparisonResult.value : null
    const airQuality = airQualityResult.status === 'fulfilled' ? airQualityResult.value : null
    if (!ensemble) degraded.push('ensemble')
    if (!comparison) degraded.push('confronto')
    if (!airQuality) degraded.push('aria')

    const fetchedAt = Date.now()
    const payload: CachedPayload = {
      location: target,
      forecast: forecastResult.value,
      ensemble,
      comparison,
      airQuality,
      degraded,
      fetchedAt,
    }

    const built = buildViewModel({ ...payload, now: fetchedAt })
    model.value = built
    // A replayed cache hit looks like a success, so age decides, not transport.
    stale.value = isStale(built.observedAt, fetchedAt)
    error.value = null
    loading.value = false
    writeJson(CACHE_KEY, payload)
  }

  // Keyed on the id, which is the coordinates: a place being renamed after a
  // reverse lookup must not cost three more requests.
  watch(
    () => location.value.id,
    () => void load(location.value),
    { immediate: true },
  )

  return {
    model,
    loading,
    error,
    stale,
    refresh: (silent = false) => load(location.value, silent),
  }
}
