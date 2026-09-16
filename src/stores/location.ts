import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { UNNAMED_POSITION, locationId, reverseGeocode, searchLocations } from '../api/geocoding'
import { readJson, writeJson } from '../lib/storage'
import type { GeoLocation } from '../types/weather'

const FAVORITES_KEY = 'meteo:favorites'
const LAST_KEY = 'meteo:last-location'

/** Shown before the user has chosen anything and geolocation is unavailable. */
export const DEFAULT_LOCATION: GeoLocation = {
  id: locationId(45.0705, 7.6868),
  name: 'Torino',
  admin1: 'Piemonte',
  country: 'Italia',
  countryCode: 'IT',
  latitude: 45.0705,
  longitude: 7.6868,
  timezone: 'Europe/Rome',
}

/**
 * The selected place, saved favourites and the search box.
 *
 * This is app-wide state shared by the header and the forecast, so it lives in
 * a store rather than in a composable holding module-level refs — which is
 * what it was before, a global pretending to be per-caller state.
 */
export const useLocationStore = defineStore('location', () => {
  const current = ref<GeoLocation>(readJson<GeoLocation>(LAST_KEY, DEFAULT_LOCATION))
  const favorites = ref<GeoLocation[]>(readJson<GeoLocation[]>(FAVORITES_KEY, []))

  const results = ref<GeoLocation[]>([])
  const searching = ref(false)
  const searchError = ref<string | null>(null)
  const locating = ref(false)
  const locationError = ref<string | null>(null)

  let searchController: AbortController | undefined

  const isFavorite = computed(() => favorites.value.some((entry) => entry.id === current.value.id))

  function select(location: GeoLocation): void {
    current.value = location
    results.value = []
    writeJson(LAST_KEY, location)
  }

  function toggleFavorite(): void {
    const existing = favorites.value.findIndex((entry) => entry.id === current.value.id)
    if (existing >= 0) favorites.value.splice(existing, 1)
    else favorites.value.push(current.value)
    writeJson(FAVORITES_KEY, favorites.value)
  }

  function removeFavorite(id: string): void {
    favorites.value = favorites.value.filter((entry) => entry.id !== id)
    writeJson(FAVORITES_KEY, favorites.value)
  }

  function clearResults(): void {
    searchController?.abort()
    results.value = []
    searching.value = false
  }

  async function search(query: string): Promise<void> {
    searchController?.abort()
    searchError.value = null

    if (query.trim().length < 2) {
      results.value = []
      searching.value = false
      return
    }

    const controller = new AbortController()
    searchController = controller
    searching.value = true

    try {
      const found = await searchLocations(query, controller.signal)
      // A superseded request must not overwrite the newer one, whether it was
      // rejected by the abort or had already resolved when the abort landed.
      if (controller.signal.aborted) return
      results.value = found
    } catch (error) {
      if (controller.signal.aborted) return
      searchError.value = error instanceof Error ? error.message : 'Ricerca non riuscita'
      results.value = []
    } finally {
      if (!controller.signal.aborted) searching.value = false
    }
  }

  /**
   * Names a geolocated position once the forecast is already on its way.
   *
   * The label is cosmetic, so it must never delay the data: the coordinates
   * are selected first and the name is patched in when it arrives. If the user
   * has moved on to another place in the meantime, the answer is discarded.
   */
  async function nameCurrentPosition(latitude: number, longitude: number): Promise<void> {
    const id = locationId(latitude, longitude)
    const named = await reverseGeocode(latitude, longitude)
    if (!named || current.value.id !== id) return

    // Patched in place: replacing the object would look like a new location.
    Object.assign(current.value, named)
    writeJson(LAST_KEY, current.value)
  }

  /**
   * Browser geolocation.
   *
   * The timezone is left empty on purpose. The forecast request that follows
   * reports the authoritative one for these coordinates, so asking any
   * endpoint for it here would duplicate that call.
   */
  async function locate(): Promise<void> {
    locationError.value = null

    if (!('geolocation' in navigator)) {
      locationError.value = 'Geolocalizzazione non disponibile su questo dispositivo'
      return
    }

    locating.value = true
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 5 * 60 * 1000,
        })
      })

      const { latitude, longitude } = position.coords
      select({
        id: locationId(latitude, longitude),
        name: UNNAMED_POSITION,
        country: '',
        latitude,
        longitude,
        // Filled in from the forecast response; see `ForecastViewModel.timezone`.
        timezone: '',
      })

      // Deliberately not awaited: the forecast is already loading.
      void nameCurrentPosition(latitude, longitude)
    } catch (error) {
      locationError.value =
        error && typeof error === 'object' && 'code' in error
          ? 'Permesso negato o posizione non disponibile'
          : 'Impossibile determinare la posizione'
    } finally {
      locating.value = false
    }
  }

  return {
    current,
    favorites,
    results,
    searching,
    searchError,
    locating,
    locationError,
    isFavorite,
    select,
    toggleFavorite,
    removeFavorite,
    search,
    clearResults,
    locate,
  }
})
