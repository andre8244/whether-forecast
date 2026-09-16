<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SparkLine from './SparkLine.vue'
import ProbabilityBars from './ProbabilityBars.vue'
import { axisLabels, axisTicks, slotCenter } from '../../lib/chart'
import { useChartHover } from '../../composables/useChartHover'
import {
  dayHourLabel,
  hourLabel,
  millimetres,
  percent,
  sameDay,
  temperature,
  weekdayLabel,
} from '../../lib/format'
import { describeCode } from '../../lib/wmo'
import type { HourPoint } from '../../types/weather'

const props = defineProps<{ hours: HourPoint[] }>()

const plot = ref<HTMLElement | null>(null)
const hourCount = computed(() => props.hours.length)
const { active, isActive, guideLeft, tooltipStyle, onPointer, clear, step, toStart, toEnd } =
  useChartHover(hourCount, plot)

const plotWidth = ref(0)

/** Below this width five axis labels start colliding, so three are used. */
const NARROW_PLOT_PX = 420

let sizeObserver: ResizeObserver | undefined

onMounted(() => {
  if (!plot.value || typeof ResizeObserver === 'undefined') return
  sizeObserver = new ResizeObserver(([entry]) => {
    plotWidth.value = entry.contentRect.width
  })
  sizeObserver.observe(plot.value)
})

onBeforeUnmount(() => sizeObserver?.disconnect())

// Zero means "not measured yet", which keeps the roomier default.
const maxTicks = computed(() =>
  plotWidth.value > 0 && plotWidth.value < NARROW_PLOT_PX ? 3 : 5,
)

const temperatures = computed(() => props.hours.map((hour) => hour.temperature))
const apparent = computed(() => props.hours.map((hour) => hour.apparentTemperature))
const precipitation = computed(() => props.hours.map((hour) => hour.precipitationProbability))

const ticks = computed(() => {
  const times = props.hours.map((hour) => hour.time)
  const indices = axisTicks(times.length, maxTicks.value)
  const labels = axisLabels(indices, times, hourLabel, weekdayLabel, sameDay)

  return indices.map((index, i) => ({
    index,
    label: labels[i],
    left: slotCenter(index, times.length) * 100,
  }))
})

const hovered = computed(() => (isActive.value ? props.hours[active.value] : null))
</script>

<template>
  <figure class="chart">
    <div
      ref="plot"
      class="plot"
      tabindex="0"
      role="application"
      :aria-label="
        hovered
          ? `${dayHourLabel(hovered.time)}: ${temperature(hovered.temperature)}, percepita ${temperature(hovered.apparentTemperature)}, pioggia ${percent(hovered.precipitationProbability)}`
          : 'Grafico orario. Usa le frecce per scorrere le ore.'
      "
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="clear"
      @focus="step(0)"
      @blur="clear"
      @keydown.left.prevent="step(-1)"
      @keydown.right.prevent="step(1)"
      @keydown.home.prevent="toStart"
      @keydown.end.prevent="toEnd"
      @keydown.escape="clear"
    >
      <SparkLine
        :values="temperatures"
        :secondary="apparent"
        :highlight="active"
        label="Andamento della temperatura reale e percepita"
      />
      <ProbabilityBars
        :values="precipitation"
        :height="28"
        :highlight="active"
        label="Probabilità oraria di precipitazione"
      />

      <div v-if="hovered" class="guide" :style="{ left: `${guideLeft}%` }" aria-hidden="true" />

      <div v-if="hovered" class="tooltip" :style="tooltipStyle" aria-hidden="true">
        <strong class="when">{{ dayHourLabel(hovered.time) }}</strong>
        <span class="condition">{{ describeCode(hovered.weatherCode).label }}</span>
        <dl class="numeric">
          <div>
            <dt>Reale</dt>
            <dd :style="{ color: 'var(--temp-line)' }">{{ temperature(hovered.temperature) }}</dd>
          </div>
          <div>
            <dt>Percepita</dt>
            <dd :style="{ color: 'var(--temp-line-apparent)' }">
              {{ temperature(hovered.apparentTemperature) }}
            </dd>
          </div>
          <div>
            <dt>Pioggia</dt>
            <dd :style="{ color: 'var(--precip-bar)' }">
              {{ percent(hovered.precipitationProbability) }}
            </dd>
          </div>
          <div v-if="hovered.precipitation">
            <dt>Accumulo</dt>
            <dd>{{ millimetres(hovered.precipitation) }}</dd>
          </div>
          <div v-else-if="(hovered.precipitationProbability ?? 0) >= 50" class="note">
            <dd>Nessun accumulo nella previsione principale</dd>
          </div>
          <div v-if="hovered.stormProbability !== null && hovered.stormProbability >= 5">
            <dt>Temporale</dt>
            <dd>{{ percent(hovered.stormProbability) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <figcaption class="axis numeric" aria-hidden="true">
      <span v-for="tick in ticks" :key="tick.index" :style="{ left: `${tick.left}%` }">
        {{ tick.label }}
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.chart {
  /* Clears the axis labels before whatever follows the chart. */
  margin: 0 0 24px;
}

.plot {
  position: relative;
  /* The pointer should land on a slot anywhere over the chart, not only on ink. */
  touch-action: pan-y;
  cursor: crosshair;
  border-radius: var(--radius-sm);
}

.plot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-strong);
  pointer-events: none;
}

.tooltip {
  position: absolute;
  top: -4px;
  z-index: 5;
  min-width: 148px;
  padding: 8px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  pointer-events: none;
}

.when {
  display: block;
  font-size: 0.82rem;
  text-transform: capitalize;
}

.condition {
  display: block;
  margin-bottom: 6px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.tooltip dl {
  margin: 0;
  display: grid;
  gap: 2px;
}

.tooltip dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

dt {
  font-size: 0.72rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
}

/* A caveat, not a value: it must not read as loudly as the figures above it. */
.note dd {
  font-weight: 400;
  font-size: 0.7rem;
  line-height: 1.3;
  color: var(--text-muted);
}

.axis {
  position: relative;
  height: 1.1rem;
  margin-top: 4px;
  font-size: 0.72rem;
  color: var(--text-faint);
}

.axis span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

/* The outermost labels would overflow the card if they stayed centred. */
.axis span:first-child {
  transform: none;
}

.axis span:last-child {
  transform: translateX(-100%);
}
</style>
