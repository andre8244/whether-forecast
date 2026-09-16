import { onScopeDispose, ref } from 'vue'

export const REFRESH_INTERVAL_MS = 10 * 60 * 1000

/**
 * Silent refresh on an interval, paused while the tab is hidden. When the tab
 * comes back after longer than the interval, it refreshes immediately rather
 * than waiting out the remainder.
 */
export function useAutoRefresh(callback: () => void, intervalMs = REFRESH_INTERVAL_MS) {
  const lastRun = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  function run(): void {
    lastRun.value = Date.now()
    callback()
  }

  function start(): void {
    stop()
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') run()
    }, intervalMs)
  }

  function stop(): void {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }

  function onVisibility(): void {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastRun.value >= intervalMs) run()
  }

  document.addEventListener('visibilitychange', onVisibility)
  start()

  onScopeDispose(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { lastRun, markRun: () => (lastRun.value = Date.now()) }
}
