<script setup lang="ts">
import { computed } from 'vue'
import { slotCenter } from '../../lib/chart'

const props = withDefaults(
  defineProps<{
    /** One value per hour; nulls break the line into segments. */
    values: (number | null)[]
    /** Optional second series drawn dashed, e.g. perceived temperature. */
    secondary?: (number | null)[]
    width?: number
    height?: number
    color?: string
    secondaryColor?: string
    label?: string
    /** Slot to mark with a dot, or -1 for none. */
    highlight?: number
  }>(),
  {
    secondary: undefined,
    width: 600,
    height: 64,
    color: 'var(--temp-line)',
    secondaryColor: 'var(--temp-line-apparent)',
    label: '',
    highlight: -1,
  },
)

const PAD_Y = 6

const bounds = computed(() => {
  const all = [...props.values, ...(props.secondary ?? [])]
    .filter((value): value is number => value !== null)
  if (!all.length) return null

  const min = Math.min(...all)
  const max = Math.max(...all)
  // A flat series would divide by zero; give it a nominal 1-unit span.
  const span = max - min || 1
  return { min, max, span }
})

/** Slot centres, matching the bar layer so a hover guide lines up with both. */
function pointAt(value: number, index: number): { x: number; y: number } {
  const box = bounds.value!
  const usableY = props.height - PAD_Y * 2
  return {
    x: slotCenter(index, props.values.length) * props.width,
    y: PAD_Y + usableY - ((value - box.min) / box.span) * usableY,
  }
}

function project(values: (number | null)[]): string[] {
  if (!bounds.value || values.length < 2) return []

  const segments: string[] = []
  let current: string[] = []

  values.forEach((value, i) => {
    if (value === null) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
      return
    }
    const { x, y } = pointAt(value, i)
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  })

  if (current.length > 1) segments.push(current.join(' '))
  return segments
}

const primaryPaths = computed(() => project(props.values))
const secondaryPaths = computed(() => (props.secondary ? project(props.secondary) : []))

const markers = computed(() => {
  const i = props.highlight
  if (!bounds.value || i < 0 || i >= props.values.length) return []

  const dots: { x: number; y: number; color: string }[] = []
  const primary = props.values[i]
  const secondary = props.secondary?.[i]
  if (primary !== null && primary !== undefined) {
    dots.push({ ...pointAt(primary, i), color: props.color })
  }
  if (secondary !== null && secondary !== undefined) {
    dots.push({ ...pointAt(secondary, i), color: props.secondaryColor })
  }
  return dots
})
</script>

<template>
  <svg
    v-if="bounds"
    class="sparkline"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    role="img"
    :aria-label="label"
  >
    <polyline
      v-for="(points, i) in secondaryPaths"
      :key="`s${i}`"
      :points="points"
      fill="none"
      :stroke="secondaryColor"
      stroke-width="1.5"
      stroke-dasharray="4 3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <polyline
      v-for="(points, i) in primaryPaths"
      :key="`p${i}`"
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Non-scaling stroke keeps the dot round despite the stretched viewBox. -->
    <circle
      v-for="(dot, i) in markers"
      :key="`m${i}`"
      :cx="dot.x"
      :cy="dot.y"
      r="3"
      :fill="dot.color"
      stroke="var(--bg-elevated)"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.sparkline {
  display: block;
  width: 100%;
  height: 64px;
}
</style>
