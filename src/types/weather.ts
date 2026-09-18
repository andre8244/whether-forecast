/** Shared types for the Open-Meteo responses and the merged view model. */

export interface GeoLocation {
  /** Stable key used for favourites: `${lat},${lon}` rounded to 4 decimals. */
  id: string
  name: string
  admin1?: string
  country: string
  countryCode?: string
  latitude: number
  longitude: number
  timezone: string
}

/* ---------------------------------------------------------------- geocoding */

export interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  country_code?: string
  admin1?: string
  admin2?: string
  timezone: string
  population?: number
}

export interface GeocodingResponse {
  results?: GeocodingResult[]
}

/* ---------------------------------------------------------------- forecast */

export interface ForecastCurrent {
  time: string
  temperature_2m: number
  apparent_temperature: number
  relative_humidity_2m: number
  precipitation: number
  weather_code: number
  cloud_cover: number
  surface_pressure: number
  wind_speed_10m: number
  wind_gusts_10m: number
  wind_direction_10m: number
  is_day: number
}

export interface ForecastHourly {
  time: string[]
  temperature_2m: (number | null)[]
  apparent_temperature: (number | null)[]
  precipitation_probability: (number | null)[]
  precipitation: (number | null)[]
  rain: (number | null)[]
  showers: (number | null)[]
  snowfall: (number | null)[]
  weather_code: (number | null)[]
  cloud_cover: (number | null)[]
  relative_humidity_2m: (number | null)[]
  surface_pressure: (number | null)[]
  wind_speed_10m: (number | null)[]
  wind_gusts_10m: (number | null)[]
  wind_direction_10m: (number | null)[]
  uv_index: (number | null)[]
  cape: (number | null)[]
  lifted_index: (number | null)[]
  convective_inhibition: (number | null)[]
}

export interface ForecastDaily {
  time: string[]
  weather_code: (number | null)[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  apparent_temperature_max: (number | null)[]
  apparent_temperature_min: (number | null)[]
  precipitation_sum: (number | null)[]
  precipitation_probability_max: (number | null)[]
  uv_index_max: (number | null)[]
  wind_speed_10m_max: (number | null)[]
  wind_gusts_10m_max: (number | null)[]
  sunrise: string[]
  sunset: string[]
}

export interface ForecastResponse {
  latitude: number
  longitude: number
  elevation: number
  timezone: string
  utc_offset_seconds: number
  current: ForecastCurrent
  hourly: ForecastHourly
  daily: ForecastDaily
}

/* ------------------------------------------------------- model comparison */

/** Flat response: `time` plus one series per variable, key-suffixed by model. */
export interface MultiModelResponse {
  hourly: { time: string[] } & Record<string, (number | null)[] | string[]>
}

/**
 * Which deterministic models forecast precipitation in one hour, by label.
 *
 * A model that reported nothing for the hour appears in neither list, so
 * `wet.length + dry.length` is how many actually answered.
 */
export interface ModelConsensus {
  wet: string[]
  dry: string[]
}

/* ---------------------------------------------------------------- ensemble */

/** Flat response: `time` plus one series per member, key-suffixed by model. */
export interface EnsembleResponse {
  hourly: { time: string[] } & Record<string, (number | null)[] | string[]>
}

/** Model ids as they appear in the response key suffixes, not as requested. */
export type EnsembleModelId = 'ecmwf_ifs025_ensemble' | 'icon_global_eps' | 'ncep_gefs025'

/**
 * The three hour-aligned series that describe one ensemble member.
 *
 * `cape` is absent from ICON global EPS, which publishes no convective energy
 * at all: its entries are null for every hour.
 */
export interface MemberSeries {
  weatherCode: (number | null)[]
  cape: (number | null)[]
  precipitation: (number | null)[]
}

/** Members grouped by model: `grouped[model][memberIndex]`. */
export type GroupedMembers = Record<string, MemberSeries[]>

export interface StormProbability {
  /**
   * Hour-aligned probability 0-100: the mean of the per-model values, each
   * model weighted equally. `null` when no model has usable data.
   */
  combined: (number | null)[]
  /** Same, per model, before combining. */
  perModel: Record<string, (number | null)[]>
  /** max - min across models, per hour. `null` when fewer than 2 models report. */
  spread: (number | null)[]
  /**
   * Share of members forecasting any precipitation, on the same equal-weight
   * mean. Every model publishes precipitation, so this one keeps all three.
   */
  rain: (number | null)[]
}

/* ------------------------------------------------------------- air quality */

export interface AirQualityHourly {
  time: string[]
  pm2_5: (number | null)[]
  pm10: (number | null)[]
  ozone: (number | null)[]
  nitrogen_dioxide: (number | null)[]
  european_aqi: (number | null)[]
}

export interface AirQualityResponse {
  hourly: AirQualityHourly
}

/* ------------------------------------------------------------- view model */

export interface HourPoint {
  /** Local ISO time as returned by the API, e.g. `2026-09-16T14:00`. */
  time: string
  /** Epoch ms, for comparisons and chart x-positions. */
  timestamp: number
  temperature: number | null
  apparentTemperature: number | null
  precipitationProbability: number | null
  precipitation: number | null
  snowfall: number | null
  weatherCode: number | null
  cloudCover: number | null
  humidity: number | null
  pressure: number | null
  windSpeed: number | null
  windGusts: number | null
  windDirection: number | null
  uvIndex: number | null
  cape: number | null
  liftedIndex: number | null
  cin: number | null
  /** Equal-weight ensemble convective-storm probability across models, 0-100. */
  stormProbability: number | null
  /** Per-model convective-storm probability, 0-100. */
  stormPerModel: Record<string, number | null>
  /** Disagreement between models, in percentage points. */
  stormSpread: number | null
  /**
   * Share of ensemble members with any precipitation this hour, 0-100.
   *
   * Independent of `precipitationProbability`, which comes from the single
   * deterministic model: the two disagreeing is the interesting case.
   */
  rainProbability: number | null
  /** How the three global models split on rain this hour. Null when degraded. */
  modelConsensus: ModelConsensus | null
}

export interface DayPoint {
  date: string
  timestamp: number
  weatherCode: number | null
  tempMax: number | null
  tempMin: number | null
  apparentMax: number | null
  apparentMin: number | null
  precipitationSum: number | null
  precipitationProbabilityMax: number | null
  uvIndexMax: number | null
  windSpeedMax: number | null
  windGustsMax: number | null
  sunrise: string
  sunset: string
  /**
   * Highest hourly storm probability in the day. A peak, not an average: a day
   * with one hour at 40% reads 40%.
   */
  stormProbabilityMax: number | null
}

export interface AirQualityPoint {
  europeanAqi: number | null
  pm2_5: number | null
  pm10: number | null
  ozone: number | null
  nitrogenDioxide: number | null
}

export interface CurrentConditions {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitation: number
  weatherCode: number
  cloudCover: number
  pressure: number
  windSpeed: number
  windGusts: number
  windDirection: number
  isDay: boolean
}

export interface ForecastViewModel {
  location: GeoLocation
  /**
   * IANA timezone reported by the forecast endpoint for these coordinates.
   *
   * Authoritative over `location.timezone`, which is empty for a position that
   * came from the browser rather than from a geocoding result.
   */
  timezone: string
  elevation: number
  current: CurrentConditions
  /** Next 48 hours from now. */
  hourly: HourPoint[]
  daily: DayPoint[]
  airQuality: AirQualityPoint | null
  sunrise: string
  sunset: string
  /** Epoch ms when this payload was fetched. */
  fetchedAt: number
  /**
   * Epoch ms of the forecast's own `current` timestamp. Unlike `fetchedAt`,
   * this does not advance when the service worker replays a cached response,
   * so it is what staleness is judged on.
   */
  observedAt: number
  /** Endpoints that failed; the UI degrades rather than blanking. */
  degraded: string[]
}
