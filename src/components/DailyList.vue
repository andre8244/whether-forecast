<script setup lang="ts">
import { computed } from 'vue'
import { describeCode, iconFor } from '../lib/wmo'
import { probabilityToken } from '../lib/stormRisk'
import {
  dayLabel,
  hourLabel,
  isToday,
  millimetres,
  percent,
  speed,
  temperature,
  weekdayLabel,
} from '../lib/format'
import type { DayPoint } from '../types/weather'

const props = defineProps<{ days: DayPoint[] }>()

/** Shared min/max so the range bars are comparable across rows. */
const scale = computed(() => {
  const lows = props.days.map((day) => day.tempMin).filter((v): v is number => v !== null)
  const highs = props.days.map((day) => day.tempMax).filter((v): v is number => v !== null)
  if (!lows.length || !highs.length) return null

  const min = Math.min(...lows)
  const max = Math.max(...highs)
  return { min, span: max - min || 1 }
})

function barStyle(day: DayPoint) {
  const box = scale.value
  if (!box || day.tempMin === null || day.tempMax === null) return { display: 'none' }
  return {
    marginLeft: `${((day.tempMin - box.min) / box.span) * 100}%`,
    width: `${Math.max(4, ((day.tempMax - day.tempMin) / box.span) * 100)}%`,
  }
}
</script>

<template>
  <section class="card daily">
    <h2>Prossimi 7 giorni</h2>

    <ol>
      <li v-for="day in days" :key="day.date">
        <div class="when">
          <strong>{{ isToday(day.date) ? 'Oggi' : weekdayLabel(day.date) }}</strong>
          <span>{{ dayLabel(day.date) }}</span>
        </div>

        <span class="glyph" :title="describeCode(day.weatherCode).label" aria-hidden="true">
          {{ iconFor(day.weatherCode) }}
        </span>

        <div class="range">
          <span class="low numeric">{{ temperature(day.tempMin) }}</span>
          <span class="track"><span class="fill" :style="barStyle(day)" /></span>
          <span class="high numeric">{{ temperature(day.tempMax) }}</span>
        </div>

        <div class="meta numeric">
          <span class="perceived">
            perc. {{ temperature(day.apparentMin) }} / {{ temperature(day.apparentMax) }}
          </span>
          <span
            >💧 {{ percent(day.precipitationProbabilityMax) }} ·
            {{ millimetres(day.precipitationSum) }}</span
          >
          <span>💨 {{ speed(day.windGustsMax) }}</span>
          <span class="storm" :style="{ color: probabilityToken(day.stormProbabilityMax) }"
            >⛈ {{ percent(day.stormProbabilityMax) }}</span
          >
          <span class="sun">🌅 {{ hourLabel(day.sunrise) }} · 🌇 {{ hourLabel(day.sunset) }}</span>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.daily {
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

ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

li {
  display: grid;
  grid-template-columns: 4.5rem 2rem minmax(120px, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: var(--radius-sm);
}

li:nth-child(odd) {
  background: var(--bg-sunken);
}

.when {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.when strong {
  font-size: 0.9rem;
}

.when span {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.glyph {
  font-size: 1.35rem;
  text-align: center;
}

.range {
  display: grid;
  grid-template-columns: 2.4rem 1fr 2.4rem;
  align-items: center;
  gap: 8px;
}

.low {
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: right;
}

.high {
  font-size: 0.95rem;
  font-weight: 600;
}

.track {
  height: 6px;
  border-radius: 3px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--precip-bar), var(--temp-line));
}

.meta {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.storm {
  font-weight: 600;
}

@media (min-width: 720px) {
  li {
    grid-template-columns: 4.5rem 2rem minmax(140px, 1fr) minmax(240px, 1.4fr);
  }

  .meta {
    grid-column: auto;
    justify-content: flex-end;
  }
}
</style>
