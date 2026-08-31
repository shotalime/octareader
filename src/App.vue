<script setup lang="ts">
import {
  BrainCircuit,
  Languages,
  LibraryBig,
  Settings,
  Sparkles,
} from '@lucide/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PwaUpdateNotice from '@/components/PwaUpdateNotice.vue'

const route = useRoute()
const isFullscreenReader = computed(
  () => route.name === 'reader' && typeof route.params.bookId === 'string',
)

const navigationItems = [
  { to: '/', label: 'Библиотека', icon: LibraryBig },
  { to: '/vocabulary', label: 'Словарь', icon: Languages },
  { to: '/review', label: 'Повторение', icon: BrainCircuit },
  { to: '/settings', label: 'Настройки', icon: Settings },
]
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <PwaUpdateNotice />
    <a
      href="#main-content"
      class="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
    >
      Перейти к содержимому
    </a>

    <aside
      v-if="!isFullscreenReader"
      class="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border/70 bg-sidebar px-5 py-6 lg:flex"
    >
      <RouterLink to="/" class="flex items-center gap-3 px-2">
        <span
          class="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
        >
          <Sparkles class="size-5" aria-hidden="true" />
        </span>
        <span>
          <span class="block font-serif text-xl font-semibold tracking-tight"
            >OctaReader</span
          >
          <span class="block text-xs text-muted-foreground"
            >Читайте. Понимайте. Помните.</span
          >
        </span>
      </RouterLink>

      <nav class="mt-10 space-y-1.5" aria-label="Основная навигация">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          active-class="bg-accent text-accent-foreground"
        >
          <component
            :is="item.icon"
            class="size-5 transition-transform group-hover:scale-105"
            aria-hidden="true"
          />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="mt-auto rounded-2xl border border-border/70 bg-card/70 p-4">
        <div
          class="flex items-center gap-2 text-xs font-semibold text-foreground"
        >
          <span class="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Локальное хранение
        </div>
        <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
          Книги, прогресс и словарь остаются только на этом устройстве.
        </p>
      </div>
    </aside>

    <div :class="{ 'lg:pl-72': !isFullscreenReader }">
      <header
        v-if="!isFullscreenReader"
        class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl lg:hidden"
      >
        <RouterLink to="/" class="flex items-center gap-2.5">
          <span
            class="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"
          >
            <Sparkles class="size-4" aria-hidden="true" />
          </span>
          <span class="font-serif text-lg font-semibold">OctaReader</span>
        </RouterLink>
        <span
          class="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
        >
          Данные локально
        </span>
      </header>

      <main
        id="main-content"
        class="min-h-dvh w-full"
        :class="
          isFullscreenReader
            ? 'max-w-none overflow-hidden p-0'
            : 'mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10'
        "
      >
        <RouterView v-slot="{ Component: routeComponent }">
          <Transition name="page" mode="out-in">
            <component :is="routeComponent" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav
      v-if="!isFullscreenReader"
      class="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-border/80 bg-sidebar/95 p-1.5 shadow-2xl shadow-stone-900/10 backdrop-blur-xl lg:hidden"
      aria-label="Мобильная навигация"
    >
      <RouterLink
        v-for="item in navigationItems"
        :key="item.to"
        :to="item.to"
        class="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
        active-class="bg-accent text-accent-foreground"
      >
        <component :is="item.icon" class="size-5" aria-hidden="true" />
        <span class="max-w-full truncate">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
