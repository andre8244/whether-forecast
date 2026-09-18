<script setup lang="ts">
import { computed } from 'vue'
import { describeCode, iconFor, isWetCode } from '../lib/wmo'
import { modelsSeeRain } from '../lib/modelConsensus'
import { hourLabel, percent, speed, temperature, windDirection } from '../lib/format'
import type { CurrentConditions, GeoLocation, HourPoint } from '../types/weather'

const props = defineProps<{
  current: CurrentConditions
  location: GeoLocation
  elevation: number
  sunrise: string
  sunset: string
  /** The hour in progress, for the cross-checks. Null while degraded. */
  hour: HourPoint | null
}>()

/** Below this share of members, the ensemble is not contradicting anything. */
const RAIN_MAJORITY = 60

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
 * Two separate cross-checks can contradict it, and they are not the same
 * claim. Other global models forecasting rain is a disagreement between runs
 * of the same kind — the strong signal, and the one that would have caught
 * that afternoon, when ECMWF and GFS both had rain. The ensemble share is a
 * probability rather than a state: worth reporting alongside, not on its own
 * terms.
 *
 * Silent whenever the headline already says rain, so the line only appears
 * where it settles something.
 */
const disagreement = computed(() => {
  if (!headlineIsDry.value) return null

  const consensus = props.hour?.modelConsensus ?? null
  const share = props.hour?.rainProbability ?? null
  const models = modelsSeeRain(consensus) ? consensus : null
  const scenarios = share !== null && share >= RAIN_MAJORITY ? share : null
  if (!models && scenarios === null) return null

  return { models, scenarios }
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

    <p v-if="disagreement" class="disagreement">
      💧
      <template v-if="disagreement.models">
        Pioggia in quest’ora per {{ disagreement.models.wet.join(' e ') }}<template
          v-if="disagreement.models.dry.length"
        >, non per {{ disagreement.models.dry.join(' e ') }}</template
        >.
      </template>
      <template v-if="disagreement.scenarios !== null">
        Pioggia nel {{ percent(disagreement.scenarios) }} degli scenari d’insieme.
      </template>
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
    </ul>

    <p class="sun numeric">
      <span aria-hidden="true">🌅</span> {{ hourLabel(sunrise) }}
      <span aria-hidden="true">🌇</span> {{ hourLabel(sunset) }}
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
  margin: 18px 0 0;
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

.sun {
  margin: 16px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
