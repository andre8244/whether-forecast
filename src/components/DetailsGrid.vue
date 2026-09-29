<script setup lang="ts">
import { computed } from 'vue'
import {
  altitude,
  centimetres,
  distance,
  hourLabel,
  index,
  percent,
  relativeDayLabel,
  speed,
  uvLabel,
  windDirection,
} from '../lib/format'
import { describeAqi } from '../lib/aqi'
import { peakUv } from '../lib/uv'
import type { AirQualityPoint, CurrentConditions, HourPoint } from '../types/weather'

const props = defineProps<{
  current: CurrentConditions
  sunrise: string
  sunset: string
  hours: HourPoint[]
  air: AirQualityPoint | null
}>()

/** The hour in progress, which the forecast-only tiles read their values from. */
const hour = computed<HourPoint | null>(() => props.hours[0] ?? null)

/** Not the current hour's UV, which is 0 all night; see `peakUv`. */
const uv = computed(() => peakUv(props.hours))

/*
 * The tiles after the sun times appear only when they have something to say.
 *
 * Not every model publishes them — the run behind a Norwegian forecast carries
 * no freezing level at all — and snow reads 0 cm for most of the year in most
 * places. A tile that is permanently a dash is the same dead weight as an
 * hourly UV index at midnight.
 */
const visibility = computed(() => hour.value?.visibility ?? null)
const freezingLevel = computed(() => hour.value?.freezingLevel ?? null)

const snowfall = computed(() => {
  const value = hour.value?.snowfall ?? null
  return value !== null && value > 0 ? value : null
})

/** Dropped like the others when the air-quality endpoint has nothing here. */
const aqi = computed(() => {
  const value = props.air?.europeanAqi ?? null
  const description = describeAqi(value)
  return value !== null && description ? { value, ...description } : null
})
</script>

<template>
  <section class="card details">
    <h2>Dettagli</h2>

    <dl>
      <div>
        <dt>Vento</dt>
        <dd class="numeric">
          {{ speed(current.windSpeed) }}
          <span class="dir">{{ windDirection(current.windDirection) }}</span>
        </dd>
      </div>
      <div>
        <dt>Raffiche</dt>
        <dd class="numeric">{{ speed(current.windGusts) }}</dd>
      </div>
      <div>
        <dt>Umidità</dt>
        <dd class="numeric">{{ percent(current.humidity) }}</dd>
      </div>
      <div>
        <dt>Nuvolosità</dt>
        <dd class="numeric">{{ percent(current.cloudCover) }}</dd>
      </div>
      <div>
        <dt>Alba</dt>
        <dd class="numeric">{{ hourLabel(sunrise) }}</dd>
      </div>
      <div>
        <dt>Tramonto</dt>
        <dd class="numeric">{{ hourLabel(sunset) }}</dd>
      </div>
      <div v-if="visibility !== null">
        <dt>Visibilità</dt>
        <dd class="numeric">{{ distance(visibility) }}</dd>
      </div>
      <div v-if="freezingLevel !== null">
        <dt>Zero termico</dt>
        <dd class="numeric">{{ altitude(freezingLevel) }}</dd>
      </div>
      <div v-if="snowfall !== null">
        <dt>Neve</dt>
        <dd class="numeric">{{ centimetres(snowfall) }}</dd>
      </div>
      <div v-if="uv">
        <dt>UV massimo</dt>
        <dd class="numeric">
          {{ index(uv.value, 0) }}
          <span class="dir">{{ uvLabel(uv.value) }}</span>
          <span class="when"> {{ relativeDayLabel(uv.time) }} alle {{ hourLabel(uv.time) }} </span>
        </dd>
      </div>
      <div v-if="aqi" title="Indice europeo EAQI">
        <dt>Qualità dell’aria</dt>
        <dd class="numeric" :style="{ color: aqi.token }">
          {{ Math.round(aqi.value) }}
          <span class="dir">{{ aqi.band }}</span>
          <span class="when">{{ aqi.advice }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.details {
  padding: 18px;
}

h2 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 20px 14px;
}

dl div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

dt {
  font-size: 0.75rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.dir {
  font-size: 0.78rem;
  margin-left: 4px;
}

.when {
  display: block;
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
