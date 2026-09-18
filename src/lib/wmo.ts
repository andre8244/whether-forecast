/** WMO 4677 weather codes as served by Open-Meteo, described in Italian. */

export interface WeatherCondition {
  label: string
  /** Key into the icon set; see `iconFor`. */
  icon: string
  isThunderstorm: boolean
}

const CONDITIONS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Sereno', icon: 'clear' },
  1: { label: 'Prevalentemente sereno', icon: 'mostly-clear' },
  2: { label: 'Parzialmente nuvoloso', icon: 'partly-cloudy' },
  3: { label: 'Coperto', icon: 'overcast' },
  45: { label: 'Nebbia', icon: 'fog' },
  48: { label: 'Nebbia con brina', icon: 'fog' },
  51: { label: 'Pioviggine debole', icon: 'drizzle' },
  53: { label: 'Pioviggine moderata', icon: 'drizzle' },
  55: { label: 'Pioviggine intensa', icon: 'drizzle' },
  56: { label: 'Pioviggine gelata debole', icon: 'freezing-drizzle' },
  57: { label: 'Pioviggine gelata intensa', icon: 'freezing-drizzle' },
  61: { label: 'Pioggia debole', icon: 'rain' },
  63: { label: 'Pioggia moderata', icon: 'rain' },
  65: { label: 'Pioggia forte', icon: 'rain' },
  66: { label: 'Pioggia gelata debole', icon: 'freezing-rain' },
  67: { label: 'Pioggia gelata forte', icon: 'freezing-rain' },
  71: { label: 'Neve debole', icon: 'snow' },
  73: { label: 'Neve moderata', icon: 'snow' },
  75: { label: 'Neve forte', icon: 'snow' },
  77: { label: 'Granelli di neve', icon: 'snow' },
  80: { label: 'Rovesci deboli', icon: 'showers' },
  81: { label: 'Rovesci moderati', icon: 'showers' },
  82: { label: 'Rovesci violenti', icon: 'showers' },
  85: { label: 'Rovesci di neve deboli', icon: 'snow-showers' },
  86: { label: 'Rovesci di neve forti', icon: 'snow-showers' },
  95: { label: 'Temporale', icon: 'thunderstorm' },
  96: { label: 'Temporale con grandine debole', icon: 'thunderstorm-hail' },
  99: { label: 'Temporale con grandine forte', icon: 'thunderstorm-hail' },
}

/** Codes 95, 96 and 99 are the thunderstorm group. */
export const THUNDERSTORM_CODES = [95, 96, 99] as const

export function isThunderstormCode(code: number | null | undefined): boolean {
  return code === 95 || code === 96 || code === 99
}

/**
 * Codes from 51 up describe falling precipitation: drizzle, rain, snow,
 * showers and thunderstorms. Everything below is cloud, fog or clear sky.
 */
export function isWetCode(code: number | null | undefined): boolean {
  return code !== null && code !== undefined && code >= 51
}

export function describeCode(code: number | null | undefined): WeatherCondition {
  if (code === null || code === undefined) {
    return { label: 'Dato non disponibile', icon: 'unknown', isThunderstorm: false }
  }
  const known = CONDITIONS[code]
  if (!known) {
    return { label: `Codice ${code}`, icon: 'unknown', isThunderstorm: isThunderstormCode(code) }
  }
  return { ...known, isThunderstorm: isThunderstormCode(code) }
}

/** Single glyph per icon key, day/night aware where it matters. */
export function iconFor(code: number | null | undefined, isDay = true): string {
  const { icon } = describeCode(code)
  switch (icon) {
    case 'clear':
      return isDay ? '☀️' : '🌙'
    case 'mostly-clear':
      return isDay ? '🌤️' : '🌙'
    case 'partly-cloudy':
      return isDay ? '⛅' : '☁️'
    case 'overcast':
      return '☁️'
    case 'fog':
      return '🌫️'
    case 'drizzle':
    case 'freezing-drizzle':
      return '🌦️'
    case 'rain':
    case 'freezing-rain':
      return '🌧️'
    case 'showers':
      return '🌧️'
    case 'snow':
    case 'snow-showers':
      return '🌨️'
    case 'thunderstorm':
    case 'thunderstorm-hail':
      return '⛈️'
    default:
      return '❓'
  }
}
