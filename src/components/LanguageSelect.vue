<script setup lang="ts">
import { computed, ref } from 'vue'

import { languageOptions } from '@/domain/languages'

const props = defineProps<{
  label: string
  searchLabel: string
}>()

const model = defineModel<string>({ required: true })
const query = ref('')
const options = languageOptions()
const filteredOptions = computed(() => {
  const normalizedQuery = query.value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
  if (normalizedQuery.length === 0) return options
  return options.filter(
    ({ code, label }) =>
      code.toLocaleLowerCase().includes(normalizedQuery) ||
      label.toLocaleLowerCase().includes(normalizedQuery),
  )
})
const visibleOptions = computed(() => {
  const selected = options.find(({ code }) => code === model.value)
  if (
    selected === undefined ||
    filteredOptions.value.some(({ code }) => code === selected.code)
  ) {
    return filteredOptions.value
  }
  return [selected, ...filteredOptions.value]
})
</script>

<template>
  <fieldset class="grid min-w-0 gap-2 rounded-xl border p-3">
    <legend class="px-1 text-sm font-medium">{{ props.label }}</legend>
    <input
      v-model="query"
      type="search"
      :aria-label="props.searchLabel"
      placeholder="Найти язык"
      class="h-9 min-w-0 rounded-lg border bg-background px-3 text-sm"
    />
    <select
      v-model="model"
      :aria-label="props.label"
      class="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm"
    >
      <option
        v-for="language in visibleOptions"
        :key="language.code"
        :value="language.code"
      >
        {{ language.label }}
      </option>
    </select>
    <p
      v-if="filteredOptions.length === 0"
      class="text-xs text-muted-foreground"
    >
      Язык не найден
    </p>
  </fieldset>
</template>
