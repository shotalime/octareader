<script setup lang="ts">
import type { TableOfContentsItem } from '@/domain/reader'

defineProps<{ items: TableOfContentsItem[] }>()
const emit = defineEmits<{ select: [href: string] }>()
</script>

<template>
  <ul class="space-y-1">
    <li v-for="item in items" :key="item.id || item.href">
      <button
        type="button"
        class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
        @click="emit('select', item.href)"
      >
        {{ item.label }}
      </button>
      <ReaderTocList
        v-if="item.children.length > 0"
        :items="item.children"
        class="ml-4 border-l pl-2"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>
