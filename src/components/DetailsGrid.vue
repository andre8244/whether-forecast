<script setup lang="ts">
import { computed } from 'vue'
import {
  altitude,
  centimetres,
  distance,
  hourLabel,
  index,
  relativeDayLabel,
  uvLabel,
} from '../lib/format'
import { peakUv } from '../lib/uv'
import type { HourPoint } from '../types/weather'

const props = defineProps<{ hours: HourPoint[] }>()

/** The hour in progress, which the tiles below read their values from. */
const hour = computed<HourPoint | null>(() => props.hours[0] ?? null)

/** Not the current hour's UV, which is 0 all night; see `peakUv`. */
const uv = computed(() => peakUv(props.hours))

/*
 * The last three tiles appear only when they have something to say.
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
</script>

<template>
  <section class="card details">
    <h2>Dettagli</h2>

    <!--
      Wind, gusts, humidity and cloud cover live in the current card and are
      not repeated here: this grid is for what that card does not already say.
    -->
    <dl>
      <div v-if="uv">
        <dt>UV massimo</dt>
        <dd class="numeric">
          {{ index(uv.value, 0) }}
          <span class="dir">{{ uvLabel(uv.value) }}</span>
          <span class="when">
            {{ relativeDayLabel(uv.time) }} alle {{ hourLabel(uv.time) }}
          </span>
        </dd>
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
  gap: 14px;
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
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-left: 4px;
}

.when {
  display: block;
  font-weight: 400;
  font-size: 0.78rem;
  color: var(--text-muted);
}
</style>
