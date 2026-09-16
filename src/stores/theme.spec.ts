import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useThemeStore } from './theme'

function attribute(): string | null {
  return document.documentElement.getAttribute('data-theme')
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('useThemeStore', () => {
  it('follows the system scheme by default, setting no attribute', () => {
    const store = useThemeStore()

    expect(store.preference).toBe('system')
    expect(store.label).toBe('di sistema')
    expect(attribute()).toBeNull()
  })

  it('cycles system to light to dark and back', async () => {
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
