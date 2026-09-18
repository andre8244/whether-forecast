<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Percentages 0-100; null renders as an empty slot, not a zero bar. */
    values: (number | null)[]
    /** Per-bar colour token; falls back to `color` when absent. */
    tokens?: string[]
    color?: string
    height?: number
    label?: string
    /** Slot to emphasise while hovering, or -1 for none. */
    highlight?: number
  }>(),
  { tokens: undefined, color: 'var(--precip-bar)', height: 44, label: '', highlight: -1 },
)

const bars = computed(() =>
  props.values.map((value, i) => ({
    value,
    // A 2% floor keeps a non-zero probability visible as more than a hairline.
    heightPercent: value === null ? 0 : Math.max(value > 0 ? 2 : 0, value),
    token: props.tokens?.[i] ?? props.color,
  })),
)
</script>

<template>
  <div class="bars" :style="{ height: `${height}px` }" role="img" :aria-label="label">
    <div
      v-for="(bar, i) in bars"
      :key="i"
      class="slot"
      :class="{ dim: highlight >= 0 && i !== highlight }"
    >
      <div
        v-if="bar.value !== null"
        class="bar"
        :style="{ height: `${bar.heightPercent}%`, background: bar.token }"
      />
      <div v-else class="missing" />
    </div>
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  align-items: flex-end;
}

.slot {
  flex: 1 1 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  min-width: 0;
}

.slot.dim {
  opacity: 0.45;
}

.bar {
  width: 100%;
  margin: 0 1px;
  border-radius: 2px 2px 0 0;
  min-height: 1px;
}

.missing {
  width: 100%;
  margin: 0 1px;
  height: 2px;
  background: repeating-linear-gradient(90deg, var(--border-strong) 0 2px, transparent 2px 4px);
}
</style>
