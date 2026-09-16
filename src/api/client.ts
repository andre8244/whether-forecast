/** Minimal fetch wrapper: query building, timeout, normalised errors. */

export class ApiError extends Error {
  readonly url: string
  readonly status?: number

  constructor(message: string, url: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.url = url
    this.status = status
  }
}

export type QueryValue = string | number | boolean | string[] | undefined

const DEFAULT_TIMEOUT_MS = 12_000

function buildUrl(base: string, params: Record<string, QueryValue>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  return url.toString()
}

export async function getJson<T>(
  base: string,
  params: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(base, params)
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(url, { signal: combined, headers: { Accept: 'application/json' } })
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new ApiError('Rete non raggiungibile', url)
  }

  if (!response.ok) {
    // Open-Meteo returns { error: true, reason: "..." } with a 4xx status.
    const reason = await response
      .json()
      .then((body: { reason?: string }) => body?.reason)
      .catch(() => undefined)
    throw new ApiError(reason ?? `Errore HTTP ${response.status}`, url, response.status)
  }

  return (await response.json()) as T
}
