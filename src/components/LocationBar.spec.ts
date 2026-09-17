import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import type { GeoLocation } from '../types/weather'

const searchLocations = vi.fn()
vi.mock('../api/geocoding', async () => {
  const actual = await vi.importActual<typeof import('../api/geocoding')>('../api/geocoding')
  return { ...actual, searchLocations: (...a: unknown[]) => searchLocations(...a) }
})

const LocationBar = (await import('./LocationBar.vue')).default
const { useLocationStore } = await import('../stores/location')

const DEBOUNCE = 250

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
const MILANO_MARITTIMA = place('Milano Marittima', 44.2744, 12.3533)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  searchLocations.mockReset()
  localStorage.clear()
})

afterEach(() => vi.useRealTimers())

/** Lets the debounce fire and the search promise settle. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(DEBOUNCE)
  await nextTick()
}

describe('LocationBar', () => {
  it('selects the first result when Enter is pressed', async () => {
    searchLocations.mockResolvedValue([MILANO, MILANO_MARITTIMA])

    const wrapper = mount(LocationBar)
    const input = wrapper.find('input')
    await input.setValue('milano')
    await settle()

    await input.trigger('keydown.enter')
    await vi.runAllTimersAsync()

    expect(useLocationStore().current).toEqual(MILANO)
  })

  it('waits for the debounced search rather than picking a stale first result', async () => {
    searchLocations.mockResolvedValueOnce([MILANO]).mockResolvedValueOnce([MILANO_MARITTIMA])

    const wrapper = mount(LocationBar)
    const input = wrapper.find('input')
    await input.setValue('milano')
    await settle()

    // The longer query is still inside the debounce window when Enter lands,
    // so the list on screen is the one for 'milano'.
    await input.setValue('milano marittima')
    await input.trigger('keydown.enter')
    await vi.runAllTimersAsync()

    expect(searchLocations).toHaveBeenLastCalledWith('milano marittima', expect.anything())
    expect(useLocationStore().current).toEqual(MILANO_MARITTIMA)
  })

  it('does nothing on Enter when the search found no place', async () => {
    searchLocations.mockResolvedValue([])
    const store = useLocationStore()
    const before = store.current

    const wrapper = mount(LocationBar)
    const input = wrapper.find('input')
    await input.setValue('qwerty')
    await settle()

    await input.trigger('keydown.enter')
    await vi.runAllTimersAsync()

    expect(store.current).toEqual(before)
    expect(wrapper.find('input').element.value).toBe('qwerty')
  })
})
