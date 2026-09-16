<script setup lang="ts">
import { computed } from 'vue'
import { describeCode, iconFor } from '../lib/wmo'
import { hourLabel, percent, speed, temperature, windDirection } from '../lib/format'
import type { CurrentConditions, GeoLocation } from '../types/weather'

const props = defineProps<{
  current: CurrentConditions
  location: GeoLocation
  elevation: number
  sunrise: string
  sunset: string
}>()

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
