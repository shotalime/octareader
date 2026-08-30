<script setup lang="ts">
import { Languages, MousePointer2 } from '@lucide/vue'

import PageHeader from '@/components/PageHeader.vue'
import { Card, CardContent } from '@/components/ui/card'
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Личный словарь"
      title="Слова"
      description="Сохранённые переводы и контексты из ваших книг будут собраны здесь."
    />

    <Card class="mt-10 border-dashed bg-card/75">
      <CardContent class="grid min-h-80 place-items-center p-8 text-center">
        <div class="max-w-md">
          <span
            class="mx-auto grid size-20 place-items-center rounded-3xl bg-secondary text-secondary-foreground"
          >
            <Languages class="size-9" aria-hidden="true" />
          </span>
          <h2 class="mt-6 font-serif text-2xl font-semibold">Слов пока нет</h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            Во время чтения коснитесь незнакомого слова, получите перевод и
            сохраните его вместе с предложением.
          </p>
          <p
            class="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary"
          >
            <MousePointer2 class="size-4" aria-hidden="true" />
            Один тап — один перевод
          </p>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
