import { getJson } from './client'
import type { GeocodingResponse, GeoLocation } from '../types/weather'

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'


export function locationId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

/**
 * How a geolocated position is labelled.
 *
 * Open-Meteo's geocoding API is forward-only and no reverse lookup is made, so
 * coordinates from the browser stay unnamed rather than being sent to a third
 * party to be resolved.
 */
export const UNNAMED_POSITION = 'Posizione attuale'

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
