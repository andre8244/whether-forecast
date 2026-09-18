<script setup lang="ts">
import { computed } from 'vue'
import { describeAqi } from '../lib/aqi'
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

.scale,
.empty {
  margin: 12px 0 0;
  font-size: 0.75rem;
  color: var(--text-faint);
}
</style>
