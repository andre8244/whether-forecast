/**
 * Horizontal geometry shared by the hourly chart layers.
 *
 * Each value covers one hour, so a point sits at the centre of its slot rather
 * than at a slot edge. Using the same mapping for the line and the bars is what
 * keeps the hover guide aligned with both.
 */

/** Horizontal centre of slot `i`, as a 0-1 fraction of the plot width. */
export function slotCenter(index: number, count: number): number {
  if (count <= 0) return 0
  return (index + 0.5) / count
}

/** Slot under a 0-1 horizontal fraction, clamped to the available range. */
export function slotIndexAt(fraction: number, count: number): number {
  if (count <= 0) return -1
  const index = Math.floor(fraction * count)
  return Math.min(count - 1, Math.max(0, index))
}

/**
 * Indices to label on the time axis: evenly spaced, always including the first
 * and last slot, and never more than `max` of them.
 */
export function axisTicks(count: number, max = 5): number[] {
  if (count <= 0) return []
  if (count <= max) return Array.from({ length: count }, (_, i) => i)

  const step = (count - 1) / (max - 1)
  const ticks = Array.from({ length: max }, (_, i) => Math.round(i * step))
  return [...new Set(ticks)]
}

/**
 * Axis labels for a set of tick indices.
 *
 * A bare hour repeats across a multi-day span, so the weekday is prefixed on
 * the first tick and whenever the day changes from the previous tick.
 */
export function axisLabels(
  ticks: number[],
  times: string[],
  hour: (time: string) => string,
  weekday: (time: string) => string,
  sameDay: (a: string, b: string) => boolean,
): string[] {
  return ticks.map((tick, i) => {
    const time = times[tick]
    const previous = i === 0 ? undefined : times[ticks[i - 1]]
    const showDay = previous === undefined || !sameDay(previous, time)
    return showDay ? `${weekday(time)} ${hour(time)}` : hour(time)
  })
}
