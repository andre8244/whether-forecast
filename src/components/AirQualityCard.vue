<script setup lang="ts">
import { computed } from 'vue'
import { describeAqi } from '../lib/aqi'
import { concentration } from '../lib/format'
import type { AirQualityPoint } from '../types/weather'

const props = defineProps<{ air: AirQualityPoint | null }>()

const description = computed(() => describeAqi(props.air?.europeanAqi))
</script>

<template>
  <section class="card air">
    <h2>Qualità dell’aria</h2>

    <p v-if="!air || !description" class="empty">Dato non disponibile per questa località.</p>

    <template v-else>
      <div class="head">
        <span class="value numeric" :style="{ color: description.token }">
          {{ Math.round(air.europeanAqi ?? 0) }}
        </span>
        <div>
          <strong :style="{ color: description.token }">{{ description.band }}</strong>
          <p class="advice">{{ description.advice }}</p>
        </div>
      </div>

      <dl class="numeric">
        <div><dt>PM2.5</dt><dd>{{ concentration(air.pm2_5) }}</dd></div>
        <div><dt>PM10</dt><dd>{{ concentration(air.pm10) }}</dd></div>
        <div><dt>Ozono</dt><dd>{{ concentration(air.ozone) }}</dd></div>
        <div><dt>NO₂</dt><dd>{{ concentration(air.nitrogenDioxide) }}</dd></div>
      </dl>

      <p class="scale">Indice europeo EAQI</p>
    </template>
  </section>
</template>

<style scoped>
.air {
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

.head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.value {
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1;
}

.advice {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

dl {
  margin: 16px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

dl div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

dt {
  font-size: 0.72rem;
  color: var(--text-muted);
}

dd {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
}

.scale,
.empty {
  margin: 12px 0 0;
  font-size: 0.75rem;
  color: var(--text-faint);
}
</style>
