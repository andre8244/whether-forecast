<script setup lang="ts">
import { computed, watch } from "vue";
import { storeToRefs } from "pinia";
import LocationBar from "./components/LocationBar.vue";
import CurrentCard from "./components/CurrentCard.vue";
import StormPanel from "./components/StormPanel.vue";
import HourlyStrip from "./components/HourlyStrip.vue";
import DailyList from "./components/DailyList.vue";
import DetailsGrid from "./components/DetailsGrid.vue";
import AirQualityCard from "./components/AirQualityCard.vue";
import { useForecast } from "./composables/useForecast";
import { useAutoRefresh } from "./composables/useAutoRefresh";
import { useLocationStore } from "./stores/location";
import { useThemeStore } from "./stores/theme";
import { fullTimeLabel, fullTimeLabelIn } from "./lib/format";

const locationStore = useLocationStore();
const { current: location } = storeToRefs(locationStore);
const { model, loading, error, stale, refresh } = useForecast(location);

const theme = useThemeStore();

// Silent background refresh; the visible data is replaced only on success.
useAutoRefresh(() => void refresh(true));

// The sky theme redraws on the minute. Cheap, and paused while the tab is
// hidden by the same helper.
useAutoRefresh(() => theme.tick(), 60_000);

watch(
  model,
  (loaded) => {
    if (loaded) theme.setSunTimes(loaded.sunrise, loaded.sunset, loaded.timezone);
  },
  { immediate: true },
);

const degradedStorm = computed(
  () => model.value?.degraded.includes("ensemble") ?? false,
);
</script>

<template>
  <div class="page">
    <LocationBar
      :theme-label="theme.label"
      :theme-glyph="theme.glyph"
      @cycle-theme="theme.cycle()"
    />

    <p v-if="stale && model" class="banner stale">
      Dati non aggiornati: previsione delle
      {{ fullTimeLabelIn(model.observedAt, model.timezone) }} ora locale.
      Probabilmente sei offline.
    </p>
    <p v-else-if="error" class="banner error">{{ error }}</p>

    <p v-if="loading && !model" class="banner">Caricamento previsioni…</p>

    <main v-if="model" class="grid" :aria-busy="loading">
      <CurrentCard
        class="span-2"
        :current="model.current"
        :location="model.location"
        :elevation="model.elevation"
        :sunrise="model.sunrise"
        :sunset="model.sunset"
      />

      <HourlyStrip class="span-2" :hours="model.hourly" />

      <StormPanel
        class="span-2"
        :hours="model.hourly"
        :degraded="degradedStorm"
      />

      <DailyList class="span-2" :days="model.daily" />

      <DetailsGrid :current="model.current" :hour="model.hourly[0] ?? null" />

      <AirQualityCard :air="model.airQuality" />
    </main>

    <footer>
      <p>
        Dati meteo
        <a
          href="https://open-meteo.com/"
          rel="noreferrer noopener"
          target="_blank"
          >Open-Meteo</a
        >
        (CC BY 4.0) da ECMWF, DWD ICON e NOAA GFS. Unità metriche.
      </p>
      <p class="method">
        La probabilità di temporale è la quota di scenari ensemble dei tre
        modelli che prevedono un temporale in quell’ora, non una stima del
        singolo modello.
      </p>
      <p class="method">
        Anche la probabilità di pioggia viene dagli scenari ensemble, mentre i
        millimetri vengono dalla singola previsione deterministica. Per questo
        un’ora può avere alta probabilità e nessun accumulo: molti scenari
        prevedono pioggia, la previsione principale no.
      </p>
      <p v-if="model" class="updated">
        Previsione delle
        {{ fullTimeLabelIn(model.observedAt, model.timezone) }} ora locale,
        scaricata alle
        {{ fullTimeLabel(model.fetchedAt) }}
      </p>
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 20px var(--gutter) 48px;
  display: grid;
  gap: 16px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.grid > * {
  min-width: 0;
}

.banner {
  margin: 0;
  padding: 10px 14px;
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.banner.stale {
  border-color: var(--risk-moderate);
  color: var(--text);
}

.banner.error {
  border-color: var(--risk-extreme);
  color: var(--risk-extreme);
}

footer {
  margin-top: 8px;
  font-size: 0.75rem;
  /* Directly on the page background, so it follows the on-sky token. */
  color: var(--on-bg-muted);
  display: grid;
  gap: 4px;
}

footer p {
  margin: 0;
}

footer a {
  color: var(--on-bg);
  text-decoration-color: var(--on-bg-muted);
}

.method {
  max-width: 62ch;
}

@media (min-width: 860px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }

  .span-2 {
    grid-column: 1 / -1;
  }
}
</style>
