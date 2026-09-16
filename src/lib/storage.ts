/**
 * localStorage access that never throws.
 *
 * Reads can come back empty and writes can throw in private windows, with site
 * data blocked, or during a PWA thumbnail capture, so every call is guarded and
 * the app has to render correctly without any stored state.
 */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage unavailable; the feature degrades silently.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // As above.
  }
}
