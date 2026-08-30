<script setup lang="ts">
import { KeyRound, Moon, Palette, ShieldCheck, Type } from '@lucide/vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const settingGroups = [
  {
    title: 'Оформление чтения',
    description: 'Шрифт, размер текста, интервалы и поля',
    icon: Type,
  },
  {
    title: 'Тема',
    description: 'Светлая или тёмная тема читалки',
    icon: Moon,
  },
  {
    title: 'Gemini API key',
    description: 'Ключ хранится локально на этом устройстве',
    icon: KeyRound,
  },
]
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Параметры приложения"
      title="Настройки"
      description="Настройте чтение и локальное подключение к переводу под себя."
    />

    <div class="mt-10 grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Основные параметры</CardTitle>
          <CardDescription
            >Функциональные настройки появятся на следующих
            этапах.</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-2">
          <button
            v-for="group in settingGroups"
            :key="group.title"
            type="button"
            class="flex w-full items-center gap-4 rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-65"
            disabled
          >
            <span
              class="grid size-11 place-items-center rounded-xl bg-muted text-primary"
            >
              <component :is="group.icon" class="size-5" aria-hidden="true" />
            </span>
            <span>
              <span class="block text-sm font-semibold">{{ group.title }}</span>
              <span class="mt-1 block text-xs text-muted-foreground">{{
                group.description
              }}</span>
            </span>
          </button>
        </CardContent>
      </Card>

      <Card class="h-fit bg-accent/70">
        <CardHeader>
          <span
            class="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"
          >
            <ShieldCheck class="size-5" aria-hidden="true" />
          </span>
          <CardTitle class="mt-3">Приватность по умолчанию</CardTitle>
          <CardDescription class="leading-relaxed text-accent-foreground/70">
            У приложения нет собственного backend. Пользовательские данные не
            покидают устройство без явного запроса перевода.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" class="w-full" disabled>
            <Palette aria-hidden="true" />
            Настроить оформление
          </Button>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
