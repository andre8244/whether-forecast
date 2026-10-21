<script setup lang="ts">
import { computed } from 'vue'
import { isWetCode } from '../lib/wmo'
import { conditionFor } from '../lib/rainOutlook'
import { nextRain, rainingNow } from '../lib/nextRain'
import { hourLabel, percent, temperature } from '../lib/format'
import type { CurrentConditions, DayPoint, GeoLocation, HourPoint } from '../types/weather'

const props = defineProps<{
  current: CurrentConditions
  location: GeoLocation
  elevation: number
  /** Today's entry of the daily list, for the day's low and high. */
  today: DayPoint | null
  /** The 48-hour window, for the cross-checks and the next-rain line. */
  hours: HourPoint[]
}>()

/** The hour in progress; the window's first entry, empty while degraded. */
const hour = computed<HourPoint | null>(() => props.hours[0] ?? null)

const place = computed(() => {
  const { name, admin1, country } = props.location
  return [name, admin1, country].filter(Boolean).join(', ')
})

/**
 * Feels-like only earns a qualifier when it differs enough to notice.
 *
 * Saying "in linea con il reale" beside two numbers that already read the
 * same spends a line to tell the reader what they can see.
 */
const feelsNote = computed(() => {
  const delta = props.current.apparentTemperature - props.current.temperature
  if (delta >= 2) return 'più caldo del reale'
  if (delta <= -2) return 'più freddo del reale'
  return null
})

/** True when the model behind the headline has nothing falling this hour. */
const headlineIsDry = computed(
  () => !isWetCode(props.current.weatherCode) && props.current.precipitation === 0,
)

/**
 * The headline condition comes from one deterministic model, and this card
 * once read "Nuvoloso" during a thunderstorm because that model had 0.0 mm for
 * every hour of the day, and "Coperto" through a night of rain over Pesaro.
 *
 * Where the model is dry, the ensemble share for the hour in progress can
 * overrule it by the same rule as the hourly strip and the daily list, so the
 * card and the strip's first cell cannot name the same hour differently. The
 * model's own condition stays in the title. Silent whenever the model already
 * has something falling, including a trace under a dry code.
 */
const condition = computed(() => {
  const share = headlineIsDry.value ? (hour.value?.rainProbability ?? null) : null
  return conditionFor(props.current.weatherCode, share, props.current.isDay)
})

const conditionTitle = computed(() =>
  condition.value.modelLabel ? `Modello principale: ${condition.value.modelLabel}` : undefined,
)

/**
 * The share behind an overruled condition, on its own line.
 *
 * What the line says is the ensemble share, because one number the reader can
 * weigh beats a count of model names they would have to look up. How the three
 * global models split goes in the title for anyone who wants it.
 */
const disagreement = computed(() => {
  const share = hour.value?.rainProbability ?? null
  if (!condition.value.modelLabel || share === null) return null

  return { share, consensus: hour.value?.modelConsensus ?? null }
})

/**
 * When rain is next expected, once it is not already falling.
 *
 * Saying "tra 2 h" while it rains would be answering a question nobody asked,
 * and the condition above already reports the hour in progress. Nothing is
 * shown when the whole window is dry: the seven-day list covers that, and a
 * standing "nessuna pioggia" on a July week is a line that never earns itself.
 */
const rainAhead = computed(() => {
  if (rainingNow(props.hours)) return null
  return nextRain(props.hours)
})

/** Italian list: "ECMWF e GFS", "ICON, ECMWF e GFS". */
function nameList(models: string[]): string {
  if (models.length <= 1) return models.join('')
  return `${models.slice(0, -1).join(', ')} e ${models[models.length - 1]}`
}

/** The model split, for the hover title rather than the line itself. */
const modelDetail = computed(() => {
  const consensus = disagreement.value?.consensus
  if (!consensus || consensus.wet.length === 0) return undefined

  const wet = `Pioggia per ${nameList(consensus.wet)}`
  return consensus.dry.length ? `${wet}; ${nameList(consensus.dry)} no` : wet
})
</script>

<template>
  <section class="card current">
    <p class="place">
      {{ place }}
      <span class="elevation numeric">{{ Math.round(elevation) }} m</span>
    </p>

    <div class="reading">
      <span class="glyph" aria-hidden="true">{{ condition.icon }}</span>
      <span class="temp numeric">{{ temperature(current.temperature) }}</span>
      <span class="condition" :title="conditionTitle">{{ condition.label }}</span>
    </div>

    <p v-if="disagreement" class="disagreement" :title="modelDetail">
      💧 Pioggia nel {{ percent(disagreement.share) }} degli scenari.
    </p>

    <p class="feels">
      Percepita <strong class="numeric">{{ temperature(current.apparentTemperature) }}</strong>
      <span v-if="feelsNote" class="feels-note">— {{ feelsNote }}</span>
    </p>

    <ul v-if="today" class="range numeric">
      <li>
        <span>Minima</span>
        <strong>{{ temperature(today.tempMin) }}</strong>
      </li>
      <li>
        <span>Massima</span>
        <strong>{{ temperature(today.tempMax) }}</strong>
      </li>
    </ul>

    <p v-if="rainAhead" class="next-rain">
      <span aria-hidden="true">🌧</span>
      {{ rainAhead.source === 'model' ? 'Pioggia prevista' : 'Pioggia probabile' }} tra
      {{ rainAhead.inHours }} h ({{ hourLabel(rainAhead.hour.time) }})
    </p>
  </section>
</template>

<style scoped>
.current {
  padding: 20px;
}

.place {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.elevation {
  font-size: 0.78rem;
  color: var(--text-faint);
}

.reading {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.glyph {
  font-size: 3rem;
  line-height: 1;
}

.temp {
  font-size: 3.6rem;
  font-weight: 700;
  line-height: 1;
}

.condition {
  font-size: 1.05rem;
  color: var(--text-muted);
}

/* Follows the day's range. */
.next-rain {
  margin: 16px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
  align-items: center;
}

.disagreement {
  margin: 10px 0 0;
  padding: 8px 10px;
  font-size: 0.85rem;
  color: var(--text-muted);
  background: var(--bg-sunken);
  border-radius: var(--radius-sm);
}

.feels {
  margin: 10px 0 0;
  font-size: 1rem;
}

.feels strong {
  font-size: 1.25rem;
}

.feels-note {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.range {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: flex;
  gap: 32px;
}

.range li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.range span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.range strong {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
