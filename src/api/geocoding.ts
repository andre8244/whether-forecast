import { getJson } from './client'
import type { GeocodingResponse, GeoLocation } from '../types/weather'

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'

/**
 * Open-Meteo's geocoding API is forward-only, so naming the coordinates that
 * come out of the browser needs a second provider. BigDataCloud's client
 * endpoint is keyless, CORS-open and localisable, and returns the same shape
 * this app already uses: city, subdivision, country.
 *
 * It is the one request in the app that goes anywhere other than Open-Meteo,
 * and it only fires when the user presses the locate button.
 */
const REVERSE_ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

export function locationId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

interface ReverseResult {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
  countryCode?: string
}

/** How a geolocated position is labelled until, or unless, it can be named. */
export const UNNAMED_POSITION = 'Posizione attuale'

/**
 * Names a coordinate pair. Returns `null` rather than throwing: a position
 * without a label is still perfectly usable, so a failure here must not cost
 * the user their forecast.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Partial<GeoLocation> | null> {
  let result: ReverseResult
  try {
    result = await getJson<ReverseResult>(
      REVERSE_ENDPOINT,
      { latitude, longitude, localityLanguage: 'it' },
      signal,
    )
  } catch {
    return null
  }

  // Out at sea there is no city, but there may still be a named body of water.
  const name = result.city || result.locality
  if (!name) return null

  return {
    name,
    admin1: result.principalSubdivision || undefined,
    country: result.countryName ?? '',
    countryCode: result.countryCode || undefined,
  }
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<GeoLocation[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const response = await getJson<GeocodingResponse>(
    ENDPOINT,
    { name: trimmed, count: 8, language: 'it', format: 'json' },
    signal,
  )

  return (response.results ?? []).map((result) => ({
    id: locationId(result.latitude, result.longitude),
    name: result.name,
    admin1: result.admin1,
    country: result.country,
    countryCode: result.country_code,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  }))
}
