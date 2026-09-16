import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from './theme'
import { AA_CONTRAST, contrastRatio } from '../lib/color'
import { FALLBACK_SUNRISE_MINUTES, skyColorAt } from '../lib/skyTheme'

function attribute(): string | null {
  return document.documentElement.getAttribute('data-theme')
}

function inline(property: string): string {
  return document.documentElement.style.getPropertyValue(property)
}

/** Freezes the clock so the palette under test is deterministic. */
function atClock(hours: number, minutes = 0) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 17, hours, minutes, 0))
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
  vi.useRealTimers()
})

describe('useThemeStore', () => {
  it('follows the system scheme by default, setting no attribute', () => {
    const store = useThemeStore()

    expect(store.preference).toBe('system')
    expect(store.label).toBe('di sistema')
    expect(attribute()).toBeNull()
  })

  it('cycles system, light, dark, sky and back', async () => {
    const store = useThemeStore()

    store.cycle()
    await nextTick()
    expect(store.preference).toBe('light')
    expect(store.label).toBe('chiaro')
    expect(attribute()).toBe('light')

    store.cycle()
    await nextTick()
    expect(store.preference).toBe('dark')
    expect(store.label).toBe('scuro')
    expect(attribute()).toBe('dark')

    store.cycle()
    await nextTick()
    expect(store.preference).toBe('sky')
    expect(store.label).toBe('cielo')
    // The sky picks one of the two token sets rather than being a third one.
    expect(attribute()).toMatch(/^(light|dark)$/)

    store.cycle()
    await nextTick()
    expect(store.preference).toBe('system')
    expect(attribute()).toBeNull()
  })

  it('persists the choice', async () => {
    const store = useThemeStore()
    store.cycle()
    await nextTick()

    expect(localStorage.getItem('meteo:theme')).toBe('"light"')
  })

  it('restores a stored choice and applies it immediately', () => {
    localStorage.setItem('meteo:theme', '"dark"')
    setActivePinia(createPinia())

    expect(useThemeStore().preference).toBe('dark')
    expect(attribute()).toBe('dark')
  })

  it('applies the theme once however many components read the store', () => {
    // The composable this replaced registered an onMounted hook per caller.
    const first = useThemeStore()
    const second = useThemeStore()

    expect(second).toBe(first)
  })

  it('survives unreadable stored state', () => {
    localStorage.setItem('meteo:theme', '{oops')
    setActivePinia(createPinia())

    expect(useThemeStore().preference).toBe('system')
  })
})


describe('sky theme', () => {
  function skyStore(hours: number, minutes = 0) {
    atClock(hours, minutes)
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.preference = 'sky'
    return store
  }

  it('paints a bright sky at midday and uses the light token set', async () => {
    const store = skyStore(13)
    await nextTick()

    expect(attribute()).toBe('light')
    expect(inline('--bg')).toBe(store.skyPalette.background)
    expect(store.skyPalette.mode).toBe('light')
  })

  it('paints a dark sky at night and uses the dark token set', async () => {
    skyStore(2)
    await nextTick()

    expect(attribute()).toBe('dark')
    expect(inline('--bg')).toBe('#0b1220')
  })

  it('drives the card surfaces as well as the page', async () => {
    skyStore(13)
    await nextTick()

    expect(inline('--bg-elevated')).toMatch(/^#[0-9a-f]{6}$/)
    expect(inline('--bg-sunken')).toMatch(/^#[0-9a-f]{6}$/)
    expect(inline('--bg-elevated')).not.toBe(inline('--bg'))
  })

  it('keeps on-sky text above AA at whatever hour', async () => {
    for (const hour of [0, 5, 7, 9, 13, 18, 19, 21, 23]) {
      const store = skyStore(hour)
      await nextTick()

      expect(
        contrastRatio(inline('--on-bg'), inline('--bg')),
        `${hour}:00`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
      expect(
        contrastRatio(inline('--on-bg-muted'), inline('--bg')),
        `${hour}:00 muted`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST)
      expect(store.skyPalette.background).toBe(inline('--bg'))
    }
  })

  it('repaints when the clock advances', async () => {
    const store = skyStore(6, 30)
    await nextTick()
    const before = inline('--bg')

    vi.setSystemTime(new Date(2026, 8, 17, 7, 30, 0))
    store.tick()
    await nextTick()

    expect(inline('--bg')).not.toBe(before)
  })

  it('clears its inline properties when another theme is chosen', async () => {
    const store = skyStore(13)
    await nextTick()
    expect(inline('--bg')).not.toBe('')

    store.preference = 'dark'
    await nextTick()

    expect(inline('--bg')).toBe('')
    expect(inline('--bg-elevated')).toBe('')
    expect(inline('--on-bg')).toBe('')
    expect(attribute()).toBe('dark')
  })

  it('survives a reload, restoring the sky rather than a plain theme', async () => {
    localStorage.setItem('meteo:theme', '"sky"')
    atClock(13)
    setActivePinia(createPinia())

    const store = useThemeStore()
    expect(store.preference).toBe('sky')
    expect(store.label).toBe('cielo')
    expect(inline('--bg')).not.toBe('')
  })

  it('ignores a stored value that is no longer a theme', () => {
    localStorage.setItem('meteo:theme', '"aurora"')
    setActivePinia(createPinia())

    expect(useThemeStore().preference).toBe('system')
  })
})

describe('sky theme sun times', () => {
  it('follows the location when it keeps the viewer’s own clock', async () => {
    atClock(6, 30)
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.preference = 'sky'
    await nextTick()
    const withDefaults = store.skyPalette.background

    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    store.setSunTimes('2026-09-17T05:30', '2026-09-17T21:00', viewerZone)
    await nextTick()

    // Sunrise an hour and a half earlier puts 06:30 well past dawn.
    expect(store.skyPalette.background).not.toBe(withDefaults)
  })

  it('falls back to civil hours for a location in another timezone', async () => {
    atClock(7, 0)
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.preference = 'sky'

    // Miami's sunrise against a European clock would put dawn colours on the
    // screen at the wrong time of day.
    store.setSunTimes('2026-09-17T07:07', '2026-09-17T19:23', 'America/New_York')
    await nextTick()

    expect(store.skyPalette.background).toBe(skyColorAt(FALLBACK_SUNRISE_MINUTES))
  })

  it('falls back when the sun times are missing', async () => {
    atClock(7, 0)
    setActivePinia(createPinia())
    const store = useThemeStore()
    store.preference = 'sky'

    store.setSunTimes('', '', Intl.DateTimeFormat().resolvedOptions().timeZone)
    await nextTick()

    expect(store.skyPalette.background).toBe(skyColorAt(FALLBACK_SUNRISE_MINUTES))
  })
})
