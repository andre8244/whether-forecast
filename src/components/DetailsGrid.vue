<script setup lang="ts">
import { computed } from 'vue'
import { index, percent, pressure, speed, uvLabel, windDirection } from '../lib/format'
import type { CurrentConditions, HourPoint } from '../types/weather'

const props = defineProps<{ current: CurrentConditions; hour: HourPoint | null }>()

const uv = computed(() => props.hour?.uvIndex ?? null)
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
        <dt>Pressione</dt>
        <dd class="numeric">{{ pressure(current.pressure) }}</dd>
      </div>
      <div>
        <dt>Nuvolosità</dt>
        <dd class="numeric">{{ percent(current.cloudCover) }}</dd>
      </div>
      <div>
        <dt>Indice UV</dt>
        <dd class="numeric">
          {{ index(uv, 0) }}
          <span class="dir">{{ uvLabel(uv) }}</span>
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
</style>
