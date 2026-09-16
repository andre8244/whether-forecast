/**
 * Colour maths for the sky theme: mixing, WCAG luminance and contrast.
 *
 * A background that moves through the day cannot have its text colour picked
 * by hand, so the palette is derived and the contrast is enforced rather than
 * eyeballed.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

function channelHex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0')
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
}

/** Linear blend, `t` from 0 (all `from`) to 1 (all `to`). */
export function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t))
  return {
    r: from.r + (to.r - from.r) * clamped,
    g: from.g + (to.g - from.g) * clamped,
    b: from.b + (to.b - from.b) * clamped,
  }
}

export function mixHex(from: string, to: string, t: number): string {
  return toHex(mix(parseHex(from), parseHex(to), t))
}

function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 for black and 1 for white. */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b)
  )
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a))
  const lb = relativeLuminance(parseHex(b))
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/** WCAG AA for normal text. */
export const AA_CONTRAST = 4.5

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/**
 * Pushes a foreground colour toward black or white until it clears `minRatio`
 * against the background.
 *
 * The direction is chosen by which extreme the background can actually reach,
 * not by which one the foreground already leans toward. Those differ exactly
 * where it matters: a mid-tone sky around 18% luminance tops out at 4.50:1
 * against white while clearing 4.67:1 against black, so following the
 * foreground's lean would fall short by a hair at the one moment the margin
 * is thinnest.
 *
 * Black and white between them cover every background at 4.58:1 or better, so
 * a target of 4.5 is always reachable.
 */
export function ensureContrast(
  foreground: string,
  background: string,
  minRatio = AA_CONTRAST,
): string {
  if (contrastRatio(foreground, background) >= minRatio) return foreground

  const target =
    contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
      ? WHITE
      : BLACK

  // 40 steps resolves to under one 8-bit level per channel.
  const fg = parseHex(foreground)
  for (let step = 1; step <= 40; step += 1) {
    const candidate = toHex(mix(fg, target, step / 40))
    if (contrastRatio(candidate, background) >= minRatio) return candidate
  }

  return toHex(target)
}

/** Whichever of the two reads better on `background`. */
export function bestContrast(background: string, options: string[]): string {
  return options.reduce((best, option) =>
    contrastRatio(option, background) > contrastRatio(best, background) ? option : best,
  )
}
