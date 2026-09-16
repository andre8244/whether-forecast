import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { readJson, writeJson } from '../lib/storage'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'meteo:theme'
const ORDER: ThemePreference[] = ['system', 'light', 'dark']

function apply(value: ThemePreference): void {
  const root = document.documentElement
  if (value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', value)
}

/**
 * Colour scheme preference.
 *
 * A store rather than a composable: the previous version registered an
 * `onMounted` hook per calling component, so a second caller would have
 * re-applied the theme on its own mount.
 */
export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readJson<ThemePreference>(STORAGE_KEY, 'system'))

  apply(preference.value)

  watch(preference, (value) => {
    apply(value)
    writeJson(STORAGE_KEY, value)
  })

  const label = computed(() =>
    preference.value === 'light' ? 'chiaro' : preference.value === 'dark' ? 'scuro' : 'di sistema',
  )

  function cycle(): void {
    preference.value = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]
  }

  return { preference, label, cycle }
})
