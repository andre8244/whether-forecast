<script setup lang="ts">
import { computed } from 'vue'
import { describeCode, iconFor, isWetCode } from '../lib/wmo'
import { modelsSeeRain } from '../lib/modelConsensus'
import { nextRain, rainingNow } from '../lib/nextRain'
import { hourLabel, percent, speed, temperature, windDirection } from '../lib/format'
import type { CurrentConditions, GeoLocation, HourPoint } from '../types/weather'

const props = defineProps<{
  current: CurrentConditions
  location: GeoLocation
  elevation: number
  sunrise: string
  sunset: string
  /** The 48-hour window, for the cross-checks and the next-rain line. */
  hours: HourPoint[]
}>()

/** Below this share of members, the ensemble is not contradicting anything. */
const RAIN_MAJORITY = 60

/** The hour in progress; the window's first entry, empty while degraded. */
const hour = computed<HourPoint | null>(() => props.hours[0] ?? null)

const condition = computed(() => describeCode(props.current.weatherCode))
const glyph = computed(() => iconFor(props.current.weatherCode, props.current.isDay))

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
 * every hour of the day.
 *
 * Two cross-checks can contradict it. Other global models forecasting rain is
 * the stronger one — runs of the same kind as the headline, and what would
 * have caught that afternoon, when ECMWF and GFS both had rain. The ensemble
 * share is a probability rather than a state, and either one is enough to
 * raise the line.
 *
 * What the line *says* is always the ensemble share, because one number the
 * reader can weigh beats a count of model names they would have to look up.
 * The names go in the title for anyone who wants them. Measured over seven
 * days, the models raise the line without an ensemble majority in a third to a
 * half of the hours, so that number is often modest; it is still the honest
 * one, and the alternative was a sentence about models nobody has heard of.
 *
 * Silent whenever the headline already says rain, and silent without an
 * ensemble share to quote.
 */
const disagreement = computed(() => {
  if (!headlineIsDry.value) return null

  const consensus = hour.value?.modelConsensus ?? null
  const share = hour.value?.rainProbability ?? null
  if (share === null) return null
  if (!modelsSeeRain(consensus) && share < RAIN_MAJORITY) return null

  return { share, consensus }
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
      <span class="glyph" aria-hidden="true">{{ glyph }}</span>
      <span class="temp numeric">{{ temperature(current.temperature) }}</span>
      <span class="condition">{{ condition.label }}</span>
    </div>

    <p v-if="disagreement" class="disagreement" :title="modelDetail">
      💧 Pioggia nel {{ percent(disagreement.share) }} degli scenari.
    </p>

    <p class="feels">
      Percepita <strong class="numeric">{{ temperature(current.apparentTemperature) }}</strong>
      <span v-if="feelsNote" class="feels-note">— {{ feelsNote }}</span>
    </p>

    <ul class="quick numeric">
      <li>
        <span>Vento</span>
        <strong>{{ speed(current.windSpeed) }} {{ windDirection(current.windDirection) }}</strong>
      </li>
      <li>
        <span>Raffiche</span>
        <strong>{{ speed(current.windGusts) }}</strong>
      </li>
      <li>
        <span>Umidità</span>
        <strong>{{ percent(current.humidity) }}</strong>
      </li>
      <li>
        <span>Nuvolosità</span>
        <strong>{{ percent(current.cloudCover) }}</strong>
      </li>
      <li>
        <span>Alba</span>
        <strong>{{ hourLabel(sunrise) }}</strong>
      </li>
      <li>
        <span>Tramonto</span>
        <strong>{{ hourLabel(sunset) }}</strong>
      </li>
    </ul>

    <p v-if="rainAhead" class="next-rain">
      <span aria-hidden="true">🌧</span> Pioggia prevista tra {{ rainAhead.inHours }} h ({{
        hourLabel(rainAhead.hour.time)
      }})
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

/* Follows the readings row, where the sun times now sit. */
.next-rain {
  margin: 6px 0 0;
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

.quick {
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.quick li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.quick strong {
  font-size: 1rem;
  font-weight: 600;
}

</style>
