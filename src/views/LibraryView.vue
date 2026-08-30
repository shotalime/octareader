<script setup lang="ts">
import { BookOpen, Plus, Upload } from '@lucide/vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Ваша библиотека"
      title="Книги"
      description="Добавляйте EPUB-книги и возвращайтесь к чтению с того же места — даже без интернета."
    >
      <Button disabled title="Импорт будет добавлен на следующем этапе">
        <Plus aria-hidden="true" />
        Добавить EPUB
      </Button>
    </PageHeader>

    <Card class="mt-10 overflow-hidden border-dashed bg-card/75">
      <CardContent
        class="grid min-h-96 place-items-center p-8 text-center sm:p-12"
      >
        <div class="max-w-md">
          <span
            class="mx-auto grid size-20 place-items-center rounded-3xl bg-accent text-accent-foreground"
          >
            <BookOpen class="size-9" aria-hidden="true" />
          </span>
          <h2 class="mt-6 font-serif text-2xl font-semibold">
            Библиотека пока пуста
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            Здесь появятся ваши книги, обложки и прогресс чтения. Импорт EPUB
            будет подключён на этапе локальной библиотеки.
          </p>
          <div
            class="mt-6 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Upload class="size-3.5" aria-hidden="true" />
            EPUB 2/3 без DRM
          </div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
