<script setup lang="ts">
import { ArrowLeft, Compass } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
</script>

<template>
  <section class="grid min-h-[70dvh] place-items-center">
    <Card class="w-full max-w-xl bg-card/85 text-center">
      <CardContent class="p-8 sm:p-12">
        <span
          class="mx-auto grid size-20 place-items-center rounded-3xl bg-muted text-primary"
        >
          <Compass class="size-9" aria-hidden="true" />
        </span>
        <p
          class="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary"
        >
          Ошибка 404
        </p>
        <h1 class="mt-2 font-serif text-4xl font-semibold">
          Страница не найдена
        </h1>
        <p
          class="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground"
        >
          Возможно, адрес изменился или такой страницы ещё не существует.
        </p>
        <Button as-child class="mt-7">
          <RouterLink to="/">
            <ArrowLeft aria-hidden="true" />
            Вернуться в библиотеку
          </RouterLink>
        </Button>
      </CardContent>
    </Card>
  </section>
</template>
