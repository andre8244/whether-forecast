/** Metric formatting and it-IT date rendering. */

const LOCALE = 'it-IT'

function nullable(value: number | null | undefined, render: (v: number) => string): string {
  return value === null || value === undefined ? '—' : render(value)
}

export function temperature(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)}°`)
}

export function temperatureWithUnit(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)} °C`)
}

export function speed(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)} km/h`)
}

/**
 * Precipitation depth.
 *
 * Anything under 0.05 mm would round to "0.0 mm", which reads as "no rain"
 * when the model actually forecast a trace of it. Those hours are reported as
 * a trace instead, and a true zero drops the decimal so the two never look
 * alike.
 */
export function millimetres(value: number | null | undefined): string {
  return nullable(value, (v) => {
    if (v === 0) return '0 mm'
    if (v < 0.05) return '< 0.1 mm'
    return `${v.toFixed(1)} mm`
  })
}

/** Snow depth, cm. Traces are named rather than rounded away, as for rain. */
export function centimetres(value: number | null | undefined): string {
  return nullable(value, (v) => {
    if (v === 0) return '0 cm'
    if (v < 0.05) return '< 0.1 cm'
    return `${v.toFixed(1)} cm`
  })
}

/**
 * Visibility, given in metres by the API.
 *
 * Under a kilometre the metres are what matters — the difference between 300 m
 * and 900 m is the difference between fog and haze — so they are kept.
 */
export function distance(value: number | null | undefined): string {
  return nullable(value, (v) => {
    if (v < 1000) return `${Math.round(v / 10) * 10} m`
    if (v < 10_000) return `${(v / 1000).toFixed(1)} km`
    return `${Math.round(v / 1000)} km`
  })
}

/** Height above sea level, metres, rounded to the nearest ten. */
export function altitude(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v / 10) * 10} m`)
}

export function percent(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)}%`)
}

export function pressure(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)} hPa`)
}

export function energy(value: number | null | undefined): string {
  return nullable(value, (v) => `${Math.round(v)} J/kg`)
}

export function index(value: number | null | undefined, digits = 1): string {
  return nullable(value, (v) => v.toFixed(digits))
}

export function concentration(value: number | null | undefined): string {
  return nullable(value, (v) => `${v.toFixed(1)} µg/m³`)
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']

/** Degrees to a 16-point Italian compass label. */
export function windDirection(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined) return '—'
  const normalised = ((degrees % 360) + 360) % 360
  return COMPASS[Math.round(normalised / 22.5) % 16]
}

/**
 * Open-Meteo returns local times without an offset (`2026-09-16T14:00`), so
 * `Date` parses them as local to the *browser*, not to the forecast location.
 *
 * Two clocks therefore exist, and mixing them up shows a Miami forecast six
 * hours in the past to a viewer in Rome:
 *
 * - `parseApiTime` / `timestampOf` keep the naive reading, which is what the
 *   display wants — "14:00" should mean 14:00 where the weather is.
 * - `instantOf` resolves the string to a real point in time using the
 *   response's `utc_offset_seconds`, and is what any comparison against
 *   `Date.now()` must use.
 */
export function parseApiTime(value: string): Date {
  return new Date(value)
}

export function timestampOf(value: string): number {
  return parseApiTime(value).getTime()
}

/** Epoch ms of an API local-time string, given the location's UTC offset. */
export function instantOf(value: string, utcOffsetSeconds: number): number {
  // Reading the string as UTC and then removing the location's offset gives
  // the true instant, independently of where the browser is.
  const asUtc = Date.parse(`${value}${value.length <= 10 ? 'T00:00' : ''}Z`)
  return asUtc - utcOffsetSeconds * 1000
}

export function hourLabel(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
    .format(parseApiTime(value))
}

export function weekdayLabel(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(parseApiTime(value))
}

export function dayLabel(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
    .format(parseApiTime(value))
}

export function dayHourLabel(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parseApiTime(value))
}

export function fullTimeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

/**
 * Same, rendered in the forecast location's zone.
 *
 * Every hour in the app is shown in the weather's local time, so a timestamp
 * printed in the viewer's zone next to them reads as a contradiction. An
 * unknown zone falls back to the browser's.
 */
export function fullTimeLabelIn(timestamp: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(timestamp))
  } catch {
    return fullTimeLabel(timestamp)
  }
}

/**
 * Day of an API time string relative to now: "oggi", "domani", or the weekday.
 *
 * A bare weekday for today reads as a week away, which is exactly the
 * ambiguity a 48-hour span invites.
 */
export function relativeDayLabel(value: string, now = new Date()): string {
  if (isToday(value, now)) return 'oggi'

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (isToday(value, tomorrow)) return 'domani'

  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(parseApiTime(value))
}

/** True when the two API time strings fall on the same calendar day. */
export function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10)
}

export function isToday(value: string, now = new Date()): boolean {
  const date = parseApiTime(value)
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

/** UV index to an Italian risk label, WHO bands. */
export function uvLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value >= 11) return 'estremo'
  if (value >= 8) return 'molto alto'
  if (value >= 6) return 'alto'
  if (value >= 3) return 'moderato'
  return 'basso'
}
