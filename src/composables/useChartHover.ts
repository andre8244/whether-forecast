import { computed, ref, type Ref } from 'vue'
import { slotCenter, slotIndexAt } from '../lib/chart'

/** Distance between the guide line and the tooltip edge. */
const TOOLTIP_GAP_PX = 12

/** Past this fraction across the plot, the tooltip flips to the other side. */
const FLIP_AT = 0.55

/**
 * Pointer and keyboard selection over an hour-slot chart.
 *
 * The geometry lives here rather than in a component because two charts use
 * it — the hourly curves and the thunderstorm bars — and both must agree with
 * `slotCenter`, which is also what positions the marks they draw.
 *
 * Each caller renders its own tooltip contents; this only decides which slot
 * is active and where the guide and tooltip go. The caller owns the element
 * ref so its template binding stays visible to the compiler.
 */
export function useChartHover(count: Ref<number>, plot: Ref<HTMLElement | null>) {
  const active = ref(-1)

  const isActive = computed(() => active.value >= 0 && active.value < count.value)

  const guideLeft = computed(() => slotCenter(active.value, count.value) * 100)

  const tooltipStyle = computed(() => {
    const left = guideLeft.value
    // Beside the guide, never on top of it: centring would hide the very
    // point being read.
    const flip = left > FLIP_AT * 100
    return {
      left: `${left}%`,
      transform: flip
        ? `translateX(calc(-100% - ${TOOLTIP_GAP_PX}px))`
        : `translateX(${TOOLTIP_GAP_PX}px)`,
    }
  })

  function onPointer(event: PointerEvent): void {
    const box = plot.value?.getBoundingClientRect()
    if (!box || box.width === 0) return
    active.value = slotIndexAt((event.clientX - box.left) / box.width, count.value)
  }

  function clear(): void {
    active.value = -1
  }

  function step(delta: number): void {
    if (count.value === 0) return
    // The first key press selects the opening slot rather than skipping it.
    if (active.value < 0) {
      active.value = 0
      return
    }
    active.value = Math.min(count.value - 1, Math.max(0, active.value + delta))
  }

  function toStart(): void {
    if (count.value > 0) active.value = 0
  }

  function toEnd(): void {
    if (count.value > 0) active.value = count.value - 1
  }

  return { active, isActive, guideLeft, tooltipStyle, onPointer, clear, step, toStart, toEnd }
}
