<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  List,
  SlidersHorizontal,
} from '@lucide/vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Режим чтения"
      title="Читалка"
      description="Здесь откроется выбранная книга, оглавление и настройки текста."
    />

    <div class="mt-8 overflow-hidden rounded-3xl border bg-stone-900 shadow-xl">
      <div
        class="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white"
      >
        <div class="flex items-center gap-2 text-sm font-medium">
          <BookOpenText class="size-4" aria-hidden="true" />
          Предпросмотр читалки
        </div>
        <div class="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="text-white hover:bg-white/10"
            disabled
          >
            <List aria-label="Оглавление" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="text-white hover:bg-white/10"
            disabled
          >
            <SlidersHorizontal aria-label="Настройки текста" />
          </Button>
        </div>
      </div>

      <div class="bg-[#f5f0e4] p-3 sm:p-8">
        <Card
          class="mx-auto max-w-3xl rounded-2xl border-stone-200 bg-[#fffdf7] shadow-none"
        >
          <CardContent class="min-h-[30rem] px-7 py-12 sm:px-16 sm:py-16">
            <p
              class="text-center text-xs font-semibold uppercase tracking-[0.24em] text-stone-400"
            >
              Глава первая
            </p>
            <h2
              class="mt-5 text-center font-serif text-3xl font-semibold text-stone-800"
            >
              Новая история
            </h2>
            <p class="mt-10 font-serif text-lg leading-9 text-stone-700">
              Выберите книгу в библиотеке, чтобы начать чтение. Текст EPUB будет
              доступен здесь без подключения к интернету, а прогресс сохранится
              на устройстве.
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="flex items-center justify-between px-4 py-3 text-white">
        <Button variant="ghost" class="text-white hover:bg-white/10" disabled>
          <ArrowLeft aria-hidden="true" />
          Назад
        </Button>
        <span class="text-xs text-white/60">Книга не выбрана</span>
        <Button variant="ghost" class="text-white hover:bg-white/10" disabled>
          Вперёд
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  </section>
</template>
