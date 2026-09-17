<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '../stores/location'
import type { GeoLocation } from '../types/weather'

const store = useLocationStore()
const { current, favorites, results, searching, searchError, locating, locationError, isFavorite } =
  storeToRefs(store)
const { select, toggleFavorite, removeFavorite, search, clearResults, locate } = store

const query = ref('')
const open = ref(false)
let debounce: ReturnType<typeof setTimeout> | undefined

watch(query, (value) => {
  if (debounce !== undefined) clearTimeout(debounce)
  debounce = setTimeout(() => void search(value), 250)
  open.value = true
})

function choose(location: GeoLocation): void {
  select(location)
  query.value = ''
  open.value = false
  clearResults()
}

function describe(location: GeoLocation): string {
  return [location.admin1, location.country].filter(Boolean).join(', ')
}
</script>

<template>
  <header class="bar">
    <div class="search">
      <input
        id="location-search"
        name="location-search"
        v-model="query"
        type="search"
        inputmode="search"
        placeholder="Cerca una località"
        aria-label="Cerca una località"
        autocomplete="off"
        @focus="open = true"
        @keydown.escape="open = false"
      />

      <ul v-if="open && (results.length || searching || searchError)" class="results">
        <li v-if="searching" class="state">Ricerca…</li>
        <li v-else-if="searchError" class="state error">{{ searchError }}</li>
        <li v-for="result in results" :key="result.id">
          <button type="button" @click="choose(result)">
            <strong>{{ result.name }}</strong>
            <span>{{ describe(result) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="actions">
      <button
        type="button"
        class="icon"
        :disabled="locating"
        :title="locating ? 'Individuazione in corso' : 'Usa la mia posizione'"
        aria-label="Usa la mia posizione"
        @click="locate()"
      >
        {{ locating ? '⏳' : '📍' }}
      </button>

      <button
        type="button"
        class="icon"
        :class="{ active: isFavorite }"
        :title="isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
        :aria-pressed="isFavorite"
        aria-label="Aggiungi ai preferiti"
        @click="toggleFavorite()"
      >
        {{ isFavorite ? '★' : '☆' }}
      </button>
    </div>

    <p v-if="locationError" class="error line">{{ locationError }}</p>

    <ul v-if="favorites.length" class="favorites">
      <li
        v-for="favorite in favorites"
        :key="favorite.id"
        :class="{ active: favorite.id === current.id }"
      >
        <button type="button" class="chip" @click="select(favorite)">
          {{ favorite.name }}
        </button>
        <button
          type="button"
          class="chip-remove"
          :aria-label="`Rimuovi ${favorite.name} dai preferiti`"
          @click="removeFavorite(favorite.id)"
        >
          ×
        </button>
      </li>
    </ul>
  </header>
</template>

<style scoped>
.bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.search {
  position: relative;
  min-width: 0;
}

input {
  width: 100%;
  padding: 10px 12px;
  font-size: 0.95rem;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

input::placeholder {
  color: var(--text-faint);
}

.results {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 4px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
}

.results button {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 10px;
  background: none;
  border: 0;
  border-radius: 6px;
  text-align: left;
}

.results button:hover {
  background: var(--bg-sunken);
}

.results strong {
  font-size: 0.92rem;
}

.results span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.state {
  padding: 8px 10px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.error {
  color: var(--risk-extreme);
}

.line {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.8rem;
}

.actions {
  display: flex;
  gap: 6px;
}

.icon {
  width: 42px;
  height: 42px;
  font-size: 1.05rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
}

.icon.active {
  color: var(--accent);
  border-color: var(--accent);
}

.icon:disabled {
  opacity: 0.6;
  cursor: progress;
}

.favorites {
  grid-column: 1 / -1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/*
 * The pill is one surface with two buttons inside it, rather than two bordered
 * buttons pushed together: that earlier shape put a seam down the middle and,
 * once selected, left the two halves on different backgrounds and borders.
 */
.favorites li {
  display: flex;
  align-items: stretch;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.favorites li.active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.chip,
.chip-remove {
  background: none;
  border: 0;
  /* So the focus ring follows the pill rather than boxing a half of it. */
  border-radius: 999px;
  font-size: 0.8rem;
}

.chip {
  padding: 5px 4px 5px 10px;
}

.chip-remove {
  padding: 5px 10px 5px 4px;
  font-size: 0.85rem;
  line-height: 1;
  color: var(--text-muted);
}

.chip-remove:hover {
  color: var(--text);
}
</style>
