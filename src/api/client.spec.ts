import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getJson } from './client'

const BASE = 'https://api.open-meteo.com/v1/forecast'

let fetchMock: ReturnType<typeof vi.fn>

/** The URL the last call was made with. */
function requestedUrl(): URL {
  return new URL(fetchMock.mock.calls[0][0] as string)
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('getJson query building', () => {
  it('serialises scalars onto the query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, { latitude: 45.07, longitude: 7.69, forecast_days: 7, current: 'x' })

    const url = requestedUrl()
    expect(url.searchParams.get('latitude')).toBe('45.07')
    expect(url.searchParams.get('forecast_days')).toBe('7')
    expect(url.searchParams.get('current')).toBe('x')
  })

  it('joins arrays with commas, as Open-Meteo expects', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, { hourly: ['temperature_2m', 'cape'] })

    expect(requestedUrl().searchParams.get('hourly')).toBe('temperature_2m,cape')
  })

  it('omits undefined parameters rather than sending "undefined"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, { latitude: 45, models: undefined })

    const url = requestedUrl()
    expect(url.searchParams.has('models')).toBe(false)
    expect(url.searchParams.has('latitude')).toBe(true)
  })

  it('serialises a boolean', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, { flag: false })

    expect(requestedUrl().searchParams.get('flag')).toBe('false')
  })

  it('keeps a zero, which is a real coordinate', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, { latitude: 0, longitude: 0 })

    const url = requestedUrl()
    expect(url.searchParams.get('latitude')).toBe('0')
    expect(url.searchParams.get('longitude')).toBe('0')
  })

  it('asks for JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, {})

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Accept: 'application/json' } })
  })
})

describe('getJson success', () => {
  it('returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ latitude: 45.06, elevation: 241 }))

    await expect(getJson(BASE, {})).resolves.toEqual({ latitude: 45.06, elevation: 241 })
  })
})

describe('getJson failures', () => {
  it('surfaces the API reason on a 4xx', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: true, reason: 'Parameter hourly is invalid' }, 400),
    )

    await expect(getJson(BASE, {})).rejects.toThrow('Parameter hourly is invalid')
  })

  it('falls back to the status when the error body has no reason', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: true }, 429))

    await expect(getJson(BASE, {})).rejects.toThrow('Errore HTTP 429')
  })

  it('falls back to the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)

    await expect(getJson(BASE, {})).rejects.toThrow('Errore HTTP 502')
  })

  it('reports an unreachable network in Italian', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(getJson(BASE, {})).rejects.toThrow('Rete non raggiungibile')
  })

  it('attaches the status and url to the error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reason: 'nope' }, 400))

    const error = await getJson(BASE, { latitude: 45 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).url).toContain('latitude=45')
    expect((error as ApiError).name).toBe('ApiError')
  })

  it('leaves a network error without a status', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await getJson(BASE, {}).catch((e: unknown) => e)
    expect((error as ApiError).status).toBeUndefined()
  })
})

describe('getJson cancellation', () => {
  it('rethrows the original reason when the caller aborts', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockImplementation(() => {
      controller.abort()
      return Promise.reject(abortError)
    })

    // An abort is the caller's own doing, so it must not be reported as a
    // network failure the UI would show as an error banner.
    await expect(getJson(BASE, {}, controller.signal)).rejects.toBe(abortError)
  })

  it('passes a signal that aborts when the caller does', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValue(jsonResponse({}))
    await getJson(BASE, {}, controller.signal)

    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal
    expect(signal.aborted).toBe(false)
    controller.abort()
    expect(signal.aborted).toBe(true)
  })

  it('always arms a request timeout', async () => {
    // AbortSignal.timeout is native and ignores fake timers, so the wiring is
    // checked rather than the elapsed time.
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockResolvedValue(jsonResponse({}))

    await getJson(BASE, {})
    expect(timeout).toHaveBeenCalledWith(12_000)

    await getJson(BASE, {}, new AbortController().signal)
    expect(timeout).toHaveBeenCalledTimes(2)

    timeout.mockRestore()
  })

  it('aborts the request when its timeout fires', async () => {
    const timeoutController = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal)
    fetchMock.mockResolvedValue(jsonResponse({}))

    await getJson(BASE, {})
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal as AbortSignal
    expect(signal.aborted).toBe(false)

    timeoutController.abort()
    expect(signal.aborted).toBe(true)

    timeout.mockRestore()
  })
})
