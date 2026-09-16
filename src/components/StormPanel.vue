<script setup lang="ts">
import { computed, ref } from 'vue'
import ProbabilityBars from './charts/ProbabilityBars.vue'
import { useChartHover } from '../composables/useChartHover'
import {
  capeReading,
  cinReading,
  labelForModel,
  liftedIndexReading,
  modelsDisagree,
  probabilityToken,
} from '../lib/stormRisk'
import { axisLabels, axisTicks, slotCenter } from '../lib/chart'
import {
  energy,
  hourLabel,
  index,
  percent,
  relativeDayLabel,
  sameDay,
  weekdayLabel,
} from '../lib/format'
import type { HourPoint } from '../types/weather'

const props = defineProps<{ hours: HourPoint[]; degraded: boolean }>()

const expanded = ref(false)

const plot = ref<HTMLElement | null>(null)
const hourCount = computed(() => props.hours.length)
const { active, isActive, guideLeft, tooltipStyle, onPointer, clear, step, toStart, toEnd } =
  useChartHover(hourCount, plot)

const hovered = computed(() => (isActive.value ? props.hours[active.value] : null))

/** The hour with the highest pooled probability drives the headline. */
const peak = computed(() => {
  let best: HourPoint | null = null
  for (const hour of props.hours) {
    if (hour.stormProbability === null) continue
    if (best === null || hour.stormProbability > (best.stormProbability ?? -1)) best = hour
  }
  return best
})

const now = computed(() => props.hours[0] ?? null)

const headline = computed(() => peak.value?.stormProbability ?? null)

const summary = computed(() => {
  const value = headline.value
  if (value === null) return 'Probabilità di temporale non disponibile'
  if (value === 0) return 'Nessun temporale previsto nelle prossime 48 ore'
  if (value < 20) return 'Temporali poco probabili'
  if (value < 40) return 'Temporali possibili'
  if (value < 60) return 'Temporali probabili'
  return 'Temporali molto probabili'
})

const disagreement = computed(() => modelsDisagree(peak.value?.stormSpread ?? null))

/** Per-model split for whichever hour is being inspected, else the peak. */
const modelRows = computed(() => {
  const source = hovered.value ?? peak.value
  if (!source) return []
  return Object.entries(source.stormPerModel).map(([id, value]) => ({
    id,
    label: labelForModel(id),
    value,
  }))
})

/** Each index on its own scale; no combined score is derived from them. */
const indices = computed(() => {
  const hour = now.value
  return [
    { key: 'cape', name: 'CAPE', value: energy(hour?.cape), reading: capeReading(hour?.cape ?? null) },
    { key: 'li', name: 'Lifted index', value: index(hour?.liftedIndex), reading: liftedIndexReading(hour?.liftedIndex ?? null) },
    { key: 'cin', name: 'CIN', value: energy(hour?.cin), reading: cinReading(hour?.cin ?? null) },
  ]
})

const barValues = computed(() => props.hours.map((hour) => hour.stormProbability))
const barTokens = computed(() => props.hours.map((hour) => probabilityToken(hour.stormProbability)))

const axis = computed(() => {
  const times = props.hours.map((hour) => hour.time)
  if (times.length < 2) return []

  const indices = axisTicks(times.length, 3)
  const labels = axisLabels(indices, times, hourLabel, weekdayLabel, sameDay)

  return indices.map((tick, i) => ({
    key: tick,
    label: labels[i],
    left: slotCenter(tick, times.length) * 100,
  }))
})
</script>

<template>
  <section class="card storm" :aria-label="'Rischio temporali'">
    <header class="head">
      <div>
        <h2>Rischio temporali</h2>
        <p class="summary">{{ summary }}</p>
      </div>
      <div class="value numeric" :style="{ color: probabilityToken(headline) }">
        {{ percent(headline) }}
      </div>
    </header>

    <p v-if="degraded" class="notice">
      Dati ensemble non disponibili: la probabilità non può essere calcolata.
    </p>

    <template v-else>
      <p class="picco" v-if="peak && headline">
        Probabilità massima {{ relativeDayLabel(peak.time) }} alle
        {{ hourLabel(peak.time) }}
      </p>

      <div
        ref="plot"
        class="plot"
        tabindex="0"
        role="application"
        :aria-label="
          hovered
            ? `${relativeDayLabel(hovered.time)} alle ${hourLabel(hovered.time)}: probabilità di temporale ${percent(hovered.stormProbability)}`
            : 'Probabilità oraria di temporale. Usa le frecce per scorrere le ore.'
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
        <ProbabilityBars
          :values="barValues"
          :tokens="barTokens"
          :height="48"
          :highlight="active"
          label="Probabilità oraria di temporale nelle prossime 48 ore"
        />

        <div v-if="hovered" class="guide" :style="{ left: `${guideLeft}%` }" aria-hidden="true" />

        <div v-if="hovered" class="tooltip" :style="tooltipStyle" aria-hidden="true">
          <strong class="when">
            {{ relativeDayLabel(hovered.time) }} {{ hourLabel(hovered.time) }}
          </strong>
          <p class="tip-value numeric" :style="{ color: probabilityToken(hovered.stormProbability) }">
            {{ percent(hovered.stormProbability) }}
          </p>
          <dl class="numeric">
            <div v-for="row in modelRows" :key="row.id">
              <dt>{{ row.label }}</dt>
              <dd>{{ percent(row.value) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="axis numeric" aria-hidden="true">
        <span v-for="tick in axis" :key="tick.key" :style="{ left: `${tick.left}%` }">
          {{ tick.label }}
        </span>
      </div>

      <p v-if="disagreement" class="notice warn">
        I modelli non concordano ({{ percent(peak?.stormSpread) }} di scarto): previsione incerta.
      </p>

      <button class="toggle" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? 'Nascondi dettagli' : 'Mostra dettagli' }}
      </button>

      <div v-if="expanded" class="details">
        <h3>Accordo tra i modelli</h3>
        <p class="hint">
          Percentuale di scenari che prevedono un temporale, per ciascun modello, nell’ora
          {{ hovered ? 'selezionata' : 'di picco' }}. La cifra grande è la media dei tre modelli,
          ciascuno con lo stesso peso.
        </p>
        <ul class="models">
          <li v-for="row in modelRows" :key="row.id">
            <span class="model-label">{{ row.label }}</span>
            <span class="track">
              <span
                class="fill"
                :style="{
                  width: `${row.value ?? 0}%`,
                  background: probabilityToken(row.value),
                }"
              />
            </span>
            <span class="numeric model-value">{{ percent(row.value) }}</span>
          </li>
        </ul>

        <h3>Indici convettivi ora</h3>
        <p class="hint">
          Dal modello deterministico. Ogni indice ha la sua scala: descrivono quanta energia ha
          l’atmosfera e se può liberarla, non quanto è probabile che lo faccia. La probabilità
          resta quella dell’ensemble qui sopra.
        </p>
        <dl class="indices">
          <div v-for="item in indices" :key="item.key">
            <dt>{{ item.name }}</dt>
            <dd class="numeric">
              {{ item.value }}
              <span v-if="item.reading" class="band" :style="{ color: item.reading.token }">
                {{ item.reading.label }}
              </span>
            </dd>
            <p v-if="item.reading" class="gloss">{{ item.reading.detail }}</p>
          </div>
        </dl>
      </div>
    </template>
  </section>
</template>

<style scoped>
.storm {
  padding: 18px;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.summary {
  margin: 4px 0 0;
  font-size: 1.05rem;
  font-weight: 500;
}

.value {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1;
}

.picco {
  margin: 10px 0 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.plot {
  position: relative;
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
  top: -6px;
  z-index: 5;
  min-width: 132px;
  padding: 8px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  pointer-events: none;
}

.tooltip .when {
  display: block;
  font-size: 0.8rem;
  text-transform: capitalize;
}

.tip-value {
  margin: 2px 0 6px;
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1;
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

.tooltip dt {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.tooltip dd {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
}

.axis {
  position: relative;
  height: 1.1rem;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--text-faint);
}

.axis span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

.axis span:first-child {
  transform: none;
}

.axis span:last-child {
  transform: translateX(-100%);
}

.notice {
  margin: 12px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.notice.warn {
  color: var(--risk-high);
}

.toggle {
  margin-top: 14px;
  padding: 8px 12px;
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

h3 {
  margin: 0 0 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

h3:not(:first-child) {
  margin-top: 20px;
}

.hint,
.gloss {
  margin: 0 0 10px;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.models {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.models li {
  display: grid;
  grid-template-columns: 4rem 1fr 3rem;
  align-items: center;
  gap: 10px;
}

.model-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.track {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-sunken);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.model-value {
  text-align: right;
  font-size: 0.85rem;
}

.indices {
  margin: 0;
  display: grid;
  gap: 14px;
}

.indices div {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 4px 10px;
  align-items: baseline;
}

.band {
  margin-left: 6px;
  font-weight: 500;
  font-size: 0.85rem;
}

dt {
  font-size: 0.82rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.gloss {
  grid-column: 1 / -1;
  margin: 0;
}
</style>
