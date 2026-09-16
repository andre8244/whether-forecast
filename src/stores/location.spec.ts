import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GeoLocation } from '../types/weather'

const searchLocations = vi.fn()
const reverseGeocode = vi.fn()
vi.mock('../api/geocoding', async () => {
  const actual = await vi.importActual<typeof import('../api/geocoding')>('../api/geocoding')
  return {
    ...actual,
    searchLocations: (...a: unknown[]) => searchLocations(...a),
    reverseGeocode: (...a: unknown[]) => reverseGeocode(...a),
  }
})

const { DEFAULT_LOCATION, useLocationStore } = await import('./location')

function place(name: string, latitude: number, longitude: number): GeoLocation {
  return {
    id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name,
    country: 'Italia',
    latitude,
    longitude,
    timezone: 'Europe/Rome',
  }
}

const MILANO = place('Milano', 45.4643, 9.1895)

/** Lets the un-awaited naming promise settle. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function stubGeolocation(latitude: number, longitude: number) {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude, longitude } } as GeolocationPosition),
    },
  })
}
const NAPOLI = place('Napoli', 40.8518, 14.2681)

beforeEach(() => {
  localStorage.clear()
  searchLocations.mockReset()
  reverseGeocode.mockReset()
  reverseGeocode.mockResolvedValue(null)
  // A fresh Pinia per test: the previous module-level refs leaked between them.
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  // Several tests stub navigator; leaving one in place would make a later
  // test think the browser has geolocation when it is asserting it does not.
  vi.unstubAllGlobals()
})

describe('initial state', () => {
  it('starts from the default location with nothing stored', () => {
    expect(useLocationStore().current).toEqual(DEFAULT_LOCATION)
    expect(useLocationStore().favorites).toEqual([])
  })

  it('restores the last location and favourites', () => {
    localStorage.setItem('meteo:last-location', JSON.stringify(NAPOLI))
    localStorage.setItem('meteo:favorites', JSON.stringify([MILANO]))
    setActivePinia(createPinia())

    const store = useLocationStore()
    expect(store.current.name).toBe('Napoli')
    expect(store.favorites.map((f) => f.name)).toEqual(['Milano'])
  })

  it('survives unreadable stored state', () => {
    localStorage.setItem('meteo:last-location', 'not json')
    setActivePinia(createPinia())

    expect(useLocationStore().current).toEqual(DEFAULT_LOCATION)
  })
})

describe('select', () => {
  it('changes the current location and persists it', () => {
    const store = useLocationStore()
    store.select(MILANO)

    expect(store.current.name).toBe('Milano')
    expect(JSON.parse(localStorage.getItem('meteo:last-location')!).name).toBe('Milano')
  })

  it('clears any open search results', async () => {
    searchLocations.mockResolvedValue([MILANO, NAPOLI])
    const store = useLocationStore()
    await store.search('mi')
    expect(store.results).toHaveLength(2)

    store.select(MILANO)
    expect(store.results).toEqual([])
  })
})

describe('favourites', () => {
  it('adds and removes the current location', () => {
    const store = useLocationStore()
    store.select(MILANO)

    expect(store.isFavorite).toBe(false)
    store.toggleFavorite()
    expect(store.isFavorite).toBe(true)
    expect(store.favorites).toHaveLength(1)

    store.toggleFavorite()
    expect(store.isFavorite).toBe(false)
    expect(store.favorites).toEqual([])
  })

  it('tracks whether the current location is among them', () => {
    const store = useLocationStore()
    store.select(MILANO)
    store.toggleFavorite()

    store.select(NAPOLI)
    expect(store.isFavorite).toBe(false)

    store.select(MILANO)
    expect(store.isFavorite).toBe(true)
  })

  it('removes one by id without touching the others', () => {
    const store = useLocationStore()
    store.select(MILANO)
    store.toggleFavorite()
    store.select(NAPOLI)
    store.toggleFavorite()

    store.removeFavorite(MILANO.id)
    expect(store.favorites.map((f) => f.name)).toEqual(['Napoli'])
  })

  it('persists the list', () => {
    const store = useLocationStore()
    store.select(MILANO)
    store.toggleFavorite()

    expect(JSON.parse(localStorage.getItem('meteo:favorites')!)).toHaveLength(1)
  })
})

describe('search', () => {
  it('does not call the API for a query under two characters', async () => {
    const store = useLocationStore()
    await store.search('m')

    expect(searchLocations).not.toHaveBeenCalled()
    expect(store.results).toEqual([])
    expect(store.searching).toBe(false)
  })

  it('stores the results and clears the busy flag', async () => {
    searchLocations.mockResolvedValue([MILANO])
    const store = useLocationStore()

    await store.search('milano')
    expect(store.results).toEqual([MILANO])
    expect(store.searching).toBe(false)
    expect(store.searchError).toBeNull()
  })

  it('surfaces a failure without leaving stale results', async () => {
    searchLocations.mockResolvedValueOnce([MILANO])
    const store = useLocationStore()
    await store.search('milano')

    searchLocations.mockRejectedValueOnce(new Error('Rete non raggiungibile'))
    await store.search('napoli')

    expect(store.searchError).toBe('Rete non raggiungibile')
    expect(store.results).toEqual([])
    expect(store.searching).toBe(false)
  })

  it('aborts the previous request when a new one starts', async () => {
    const signals: AbortSignal[] = []
    searchLocations.mockImplementation((_q: string, signal: AbortSignal) => {
      signals.push(signal)
      return Promise.resolve([])
    })

    const store = useLocationStore()
    await store.search('mil')
    await store.search('nap')

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('leaves state alone when its own request was superseded', async () => {
    // A slow first search resolving after a second one must not overwrite it.
    let releaseFirst: (value: GeoLocation[]) => void = () => {}
    searchLocations.mockImplementationOnce(
      () => new Promise<GeoLocation[]>((resolve) => (releaseFirst = resolve)),
    )
    searchLocations.mockResolvedValueOnce([NAPOLI])

    const store = useLocationStore()
    const first = store.search('mil')
    await store.search('nap')

    releaseFirst([MILANO])
    await first

    expect(store.results).toEqual([NAPOLI])
  })

  it('clearResults empties the list and stops the spinner', async () => {
    searchLocations.mockResolvedValue([MILANO])
    const store = useLocationStore()
    await store.search('milano')

    store.clearResults()
    expect(store.results).toEqual([])
    expect(store.searching).toBe(false)
  })
})

describe('locate', () => {
  it('reports when the browser has no geolocation', async () => {
    const store = useLocationStore()
    await store.locate()

    expect(store.locationError).toMatch(/non disponibile/)
    expect(store.locating).toBe(false)
  })

  it('selects the coordinates immediately, before any naming', async () => {
    stubGeolocation(25.7743, -80.1937)

    const store = useLocationStore()
    await store.locate()

    expect(store.current.latitude).toBeCloseTo(25.7743)
    // The timezone arrives with the forecast; no extra call is made for it.
    expect(store.current.timezone).toBe('')
    expect(store.locationError).toBeNull()
    expect(store.locating).toBe(false)

  })

  it('fills in the city name once the reverse lookup answers', async () => {
    stubGeolocation(25.7743, -80.1937)
    reverseGeocode.mockResolvedValue({
      name: 'Miami',
      admin1: 'Florida',
      country: 'Stati Uniti',
      countryCode: 'US',
    })

    const store = useLocationStore()
    await store.locate()
    await flush()

    expect(store.current.name).toBe('Miami')
    expect(store.current.admin1).toBe('Florida')
    expect(store.current.country).toBe('Stati Uniti')

  })

  it('keeps the coordinates identity so the forecast is not refetched', async () => {
    stubGeolocation(25.7743, -80.1937)
    reverseGeocode.mockResolvedValue({ name: 'Miami', country: 'Stati Uniti' })

    const store = useLocationStore()
    await store.locate()
    const idBefore = store.current.id

    await flush()

    // The forecast watcher keys on the id, so renaming must not change it.
    expect(store.current.id).toBe(idBefore)
  })

  it('persists the name once it arrives', async () => {
    stubGeolocation(25.7743, -80.1937)
    reverseGeocode.mockResolvedValue({ name: 'Miami', country: 'Stati Uniti' })

    const store = useLocationStore()
    await store.locate()
    await flush()

    expect(JSON.parse(localStorage.getItem('meteo:last-location')!).name).toBe('Miami')
  })

  it('stays on the placeholder when the position cannot be named', async () => {
    stubGeolocation(0, -40)
    reverseGeocode.mockResolvedValue(null)

    const store = useLocationStore()
    await store.locate()
    await flush()

    expect(store.current.name).toBe('Posizione attuale')
  })

  it('discards a name that arrives after the user moved on', async () => {
    stubGeolocation(25.7743, -80.1937)
    let release: (value: unknown) => void = () => {}
    reverseGeocode.mockImplementation(() => new Promise((resolve) => (release = resolve)))

    const store = useLocationStore()
    await store.locate()

    store.select(MILANO)
    release({ name: 'Miami', country: 'Stati Uniti' })
    await flush()

    expect(store.current.name).toBe('Milano')
  })

  it('does not name a position the browser never gave', async () => {
    const store = useLocationStore()
    await store.locate()

    expect(reverseGeocode).not.toHaveBeenCalled()
  })

  it('reports a denied permission', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1, message: 'denied' } as GeolocationPositionError),
      },
    })


    const store = useLocationStore()
    await store.locate()

    expect(store.locationError).toMatch(/Permesso negato/)
    expect(store.locating).toBe(false)

  })
})
