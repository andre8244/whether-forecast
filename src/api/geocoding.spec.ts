import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { locationId, reverseGeocode, searchLocations } from './geocoding'

let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function lastUrl(): URL {
  return new URL(fetchMock.mock.calls.at(-1)![0] as string)
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('locationId', () => {
  it('is stable at four decimals, so a label change keeps the identity', () => {
    expect(locationId(45.07049, 7.68682)).toBe('45.0705,7.6868')
    expect(locationId(45.070491, 7.686821)).toBe(locationId(45.07049, 7.68682))
  })

  it('keeps distinct places distinct', () => {
    expect(locationId(45.07, 7.69)).not.toBe(locationId(25.77, -80.19))
  })
})

describe('searchLocations', () => {
  it('asks for Italian results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchLocations('torino')

    expect(lastUrl().searchParams.get('language')).toBe('it')
    expect(lastUrl().searchParams.get('name')).toBe('torino')
  })

  it('does not call the API for a query under two characters', async () => {
    expect(await searchLocations('t')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a result onto the app shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 3165524,
            name: 'Torino',
            latitude: 45.07049,
            longitude: 7.68682,
            country: 'Italia',
            country_code: 'IT',
            admin1: 'Piemonte',
            timezone: 'Europe/Rome',
          },
        ],
      }),
    )

    expect(await searchLocations('torino')).toEqual([
      {
        id: '45.0705,7.6868',
        name: 'Torino',
        admin1: 'Piemonte',
        country: 'Italia',
        countryCode: 'IT',
        latitude: 45.07049,
        longitude: 7.68682,
        timezone: 'Europe/Rome',
      },
    ])
  })

  it('treats a response with no results as empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    expect(await searchLocations('qwertyuiop')).toEqual([])
  })
})

describe('reverseGeocode', () => {
  it('names a coordinate pair in Italian', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        city: 'Miami',
        locality: 'Miami',
        principalSubdivision: 'Florida',
        countryName: 'Stati Uniti',
        countryCode: 'US',
      }),
    )

    expect(await reverseGeocode(25.7743, -80.1937)).toEqual({
      name: 'Miami',
      admin1: 'Florida',
      country: 'Stati Uniti',
      countryCode: 'US',
    })
    expect(lastUrl().searchParams.get('localityLanguage')).toBe('it')
  })

  it('falls back to the locality where there is no city', async () => {
    // Out at sea: no city, but a named body of water.
    fetchMock.mockResolvedValue(
      jsonResponse({
        city: '',
        locality: 'Brazilian jurisdictional waters',
        principalSubdivision: '',
        countryName: '',
        countryCode: '',
      }),
    )

    const named = await reverseGeocode(0, -40)
    expect(named?.name).toBe('Brazilian jurisdictional waters')
    expect(named?.admin1).toBeUndefined()
    expect(named?.countryCode).toBeUndefined()
  })

  it('returns nothing when there is no name at all', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ city: '', locality: '' }))
    expect(await reverseGeocode(0, 0)).toBeNull()
  })

  it('swallows a failure rather than costing the user their forecast', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(reverseGeocode(45, 7)).resolves.toBeNull()
  })

  it('swallows an error status too', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reason: 'rate limited' }, 429))
    await expect(reverseGeocode(45, 7)).resolves.toBeNull()
  })
})
