<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
}>()
</script>

<template>
  <header
    class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
  >
    <div class="max-w-2xl">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">
        {{ eyebrow }}
      </p>
      <h1
        class="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl"
      >
        {{ title }}
      </h1>
      <p
        class="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base"
      >
        {{ description }}
      </p>
    </div>
    <slot />
  </header>
</template>
