import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { readJson, writeJson } from '../lib/storage'
import {
  FALLBACK_SUNRISE_MINUTES,
  FALLBACK_SUNSET_MINUTES,
  minutesOfDay,
  skyPaletteAt,
} from '../lib/skyTheme'

export type ThemePreference = 'system' | 'light' | 'dark' | 'sky'

const STORAGE_KEY = 'meteo:theme'
const ORDER: ThemePreference[] = ['system', 'light', 'dark', 'sky']

const LABELS: Record<ThemePreference, string> = {
  system: 'di sistema',
  light: 'chiaro',
  dark: 'scuro',
  sky: 'cielo',
}

const GLYPHS: Record<ThemePreference, string> = {
  system: '🖥️',
  light: '☀️',
  dark: '🌙',
  sky: '🌅',
}

/** Custom properties the sky theme drives directly. */
const SKY_PROPERTIES = ['--bg', '--bg-elevated', '--bg-sunken', '--on-bg', '--on-bg-muted']

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (ORDER as string[]).includes(value)
}

/**
 * Colour scheme, including a sky theme that follows the time of day.
 *
 * A store rather than a composable: the previous version registered an
 * `onMounted` hook per calling component, so a second caller would have
 * re-applied the theme on its own mount.
 */
export const useThemeStore = defineStore('theme', () => {
  const stored = readJson<unknown>(STORAGE_KEY, 'system')
  const preference = ref<ThemePreference>(isPreference(stored) ? stored : 'system')

  /**
   * Sun times for the displayed place, in minutes past midnight, but only
   * when that place keeps the viewer's own clock.
   *
   * The sky theme tracks the viewer's local time, since it is their room the
   * screen is lighting. Pairing their clock with another continent's sunrise
   * would put dawn colours on a screen at midday, so a foreign location falls
   * back to civil hours instead.
   */
  const sunrise = ref(FALLBACK_SUNRISE_MINUTES)
  const sunset = ref(FALLBACK_SUNSET_MINUTES)

  /** Bumped every minute; the palette recomputes from it. */
  const now = ref(new Date())

  const label = computed(() => LABELS[preference.value])
  const glyph = computed(() => GLYPHS[preference.value])

  const skyPalette = computed(() =>
    skyPaletteAt(now.value.getHours() * 60 + now.value.getMinutes(), sunrise.value, sunset.value),
  )

  function setSunTimes(sunriseTime: string, sunsetTime: string, timezone: string): void {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!sunriseTime || !sunsetTime || timezone !== viewerZone) {
      sunrise.value = FALLBACK_SUNRISE_MINUTES
      sunset.value = FALLBACK_SUNSET_MINUTES
      return
    }

    sunrise.value = minutesOfDay(sunriseTime)
    sunset.value = minutesOfDay(sunsetTime)
  }

  function apply(): void {
    const root = document.documentElement

    if (preference.value !== 'sky') {
      for (const property of SKY_PROPERTIES) root.style.removeProperty(property)
      if (preference.value === 'system') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', preference.value)
      return
    }

    const palette = skyPalette.value
    // The sky picks which of the two token sets applies; everything inside a
    // card then keeps the contrast those sets were built with.
    root.setAttribute('data-theme', palette.mode)
    root.style.setProperty('--bg', palette.background)
    root.style.setProperty('--bg-elevated', palette.elevated)
    root.style.setProperty('--bg-sunken', palette.sunken)
    root.style.setProperty('--on-bg', palette.onBackground)
    root.style.setProperty('--on-bg-muted', palette.onBackgroundMuted)
  }

  apply()

  watch(preference, (value) => {
    apply()
    writeJson(STORAGE_KEY, value)
  })

  watch(skyPalette, () => {
    if (preference.value === 'sky') apply()
  })

  function tick(): void {
    now.value = new Date()
  }

  function cycle(): void {
    preference.value = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]
  }

  return { preference, label, glyph, skyPalette, setSunTimes, cycle, tick }
})
