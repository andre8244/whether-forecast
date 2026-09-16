<script setup lang="ts">
import HourlyChart from './charts/HourlyChart.vue'
import { iconFor } from '../lib/wmo'
import { probabilityToken } from '../lib/stormRisk'
import { hourLabel, isToday, millimetres, percent, speed, temperature } from '../lib/format'
import type { HourPoint } from '../types/weather'

defineProps<{ hours: HourPoint[] }>()

function isNight(hour: HourPoint): boolean {
  const at = new Date(hour.timestamp).getHours()
  return at < 6 || at >= 20
}

function dayBreak(hour: HourPoint, i: number): boolean {
  if (i === 0) return false
  return new Date(hour.timestamp).getHours() === 0
}
</script>

<template>
  <section class="card hourly">
    <header>
      <h2>Prossime 48 ore</h2>
      <p class="legend">
        <span class="swatch temp" aria-hidden="true" /> reale
        <span class="swatch apparent" aria-hidden="true" /> percepita
        <span class="swatch precip" aria-hidden="true" /> prob. pioggia
      </p>
    </header>

    <HourlyChart :hours="hours" />

    <ol class="strip">
      <li
        v-for="(hour, i) in hours"
        :key="hour.time"
        :class="{ night: isNight(hour), break: dayBreak(hour, i) }"
      >
        <span class="when numeric">
          {{ i === 0 ? 'Ora' : hourLabel(hour.time) }}
          <em v-if="dayBreak(hour, i) || (i === 0 && !isToday(hour.time))">
            {{ new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(new Date(hour.timestamp)) }}
          </em>
        </span>
        <span class="glyph" aria-hidden="true">{{ iconFor(hour.weatherCode, !isNight(hour)) }}</span>
        <span class="temp numeric">{{ temperature(hour.temperature) }}</span>
        <span class="apparent numeric">perc. {{ temperature(hour.apparentTemperature) }}</span>
        <span class="precip numeric">{{ percent(hour.precipitationProbability) }}</span>
        <!--
          Only shown when there is something to show. The probability comes
          from the ensemble and the depth from the deterministic run, so a
          high percentage beside a flat "0 mm" reads as a contradiction rather
          than as the two different quantities they are.
        -->
        <span v-if="hour.precipitation" class="mm numeric">
          {{ millimetres(hour.precipitation) }}
        </span>
        <span v-else class="mm placeholder" aria-hidden="true"></span>
        <span class="wind numeric">{{ speed(hour.windSpeed) }}</span>
        <span
          v-if="hour.stormProbability !== null && hour.stormProbability >= 5"
          class="storm numeric"
          :style="{ color: probabilityToken(hour.stormProbability) }"
        >
          ⛈ {{ percent(hour.stormProbability) }}
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.hourly {
  padding: 18px;
  min-width: 0;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.legend {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  display: inline-block;
}

.swatch.temp { background: var(--temp-line); }
.swatch.apparent { background: var(--temp-line-apparent); }
.swatch.precip { background: var(--precip-bar); }
.swatch:not(:first-child) { margin-left: 8px; }

.strip {
  list-style: none;
  display: flex;
  gap: 4px;
  margin: 14px 0 0;
  padding: 0 0 8px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
}

.strip li {
  flex: 0 0 auto;
  width: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  scroll-snap-align: start;
}

.strip li.night {
  background: color-mix(in srgb, var(--bg-sunken) 70%, var(--border) 30%);
}

.strip li.break {
  box-shadow: inset 2px 0 0 var(--accent);
}

.when {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

.when em {
  display: block;
  font-style: normal;
  font-size: 0.68rem;
  color: var(--accent);
}

.glyph {
  font-size: 1.2rem;
}

.temp {
  font-size: 1.05rem;
  font-weight: 600;
}

.apparent,
.precip,
.mm,
.wind {
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Holds the row height so the columns stay aligned across hours. */
.placeholder {
  min-height: 1lh;
}

.storm {
  font-size: 0.72rem;
  font-weight: 600;
}
</style>
