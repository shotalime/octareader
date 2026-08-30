<script setup lang="ts">
import { BrainCircuit, CalendarClock, Flame, Layers3 } from '@lucide/vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const stats = [
  { label: 'На сегодня', value: '0', icon: Layers3 },
  { label: 'Серия дней', value: '—', icon: Flame },
  { label: 'Следующее', value: '—', icon: CalendarClock },
]
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Интервальное повторение"
      title="Повторение"
      description="Возвращайтесь к словам вовремя, чтобы они оставались в долговременной памяти."
    >
      <Button disabled>
        <BrainCircuit aria-hidden="true" />
        Начать повторение
      </Button>
    </PageHeader>

    <div class="mt-10 grid gap-4 sm:grid-cols-3">
      <Card v-for="stat in stats" :key="stat.label" class="bg-card/80">
        <CardContent class="flex items-center gap-4 p-5">
          <span
            class="grid size-11 place-items-center rounded-2xl bg-muted text-primary"
          >
            <component :is="stat.icon" class="size-5" aria-hidden="true" />
          </span>
          <div>
            <p class="text-2xl font-semibold">{{ stat.value }}</p>
            <p class="text-xs text-muted-foreground">{{ stat.label }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="mt-6 bg-primary text-primary-foreground">
      <CardHeader>
        <CardTitle class="text-2xl">Карточек на сегодня нет</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="max-w-xl text-sm leading-relaxed text-primary-foreground/75">
          Новые карточки появятся сразу после сохранения слов. OctaReader сам
          рассчитает подходящее время следующего повторения.
        </p>
      </CardContent>
    </Card>
  </section>
</template>
