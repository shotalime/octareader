<script setup lang="ts">
import { BookOpen, LoaderCircle, Plus, Trash2, Upload } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  INVALID_EPUB_MESSAGE,
  STORAGE_QUOTA_MESSAGE,
} from '@/domain/book-import'
import { libraryService, type LibraryBook } from '@/domain/library'

const books = ref<LibraryBook[]>([])
const isLoading = ref(true)
const isImporting = ref(false)
const errorMessage = ref<string | null>(null)
const duplicateBook = ref<LibraryBook | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const coverUrls = new Map<string, string>()
const booksWithCovers = computed(() =>
  books.value.map((book) => {
    let coverUrl = coverUrls.get(book.id) ?? null
    if (
      coverUrl === null &&
      book.cover !== null &&
      typeof URL.createObjectURL === 'function'
    ) {
      coverUrl = URL.createObjectURL(book.cover)
      coverUrls.set(book.id, coverUrl)
    }
    return { ...book, coverUrl }
  }),
)

const loadBooks = async (): Promise<void> => {
  books.value = await libraryService.listBooks()
}

onMounted(async () => {
  try {
    await loadBooks()
  } catch {
    errorMessage.value = 'Не удалось загрузить библиотеку. Попробуйте ещё раз.'
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (typeof URL.revokeObjectURL === 'function') {
    coverUrls.forEach((url) => URL.revokeObjectURL(url))
  }
})

const selectFile = (): void => fileInput.value?.click()

const importFile = async (event: Event): Promise<void> => {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.files?.[0] === undefined)
    return
  errorMessage.value = null
  duplicateBook.value = null
  isImporting.value = true
  try {
    const result = await libraryService.importBook(input.files[0])
    if (result.status === 'duplicate') {
      duplicateBook.value = { ...result.book, progressPercentage: null }
    }
    await loadBooks()
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error &&
      (error.message === INVALID_EPUB_MESSAGE ||
        error.message === STORAGE_QUOTA_MESSAGE)
        ? error.message
        : INVALID_EPUB_MESSAGE
  } finally {
    isImporting.value = false
    input.value = ''
  }
}

const deleteBook = async (book: LibraryBook): Promise<void> => {
  if (!window.confirm(`Удалить книгу «${book.title}» с этого устройства?`))
    return
  try {
    await libraryService.deleteBook(book.id)
    const url = coverUrls.get(book.id)
    if (url !== undefined && typeof URL.revokeObjectURL === 'function')
      URL.revokeObjectURL(url)
    coverUrls.delete(book.id)
    await loadBooks()
  } catch {
    errorMessage.value = 'Не удалось удалить книгу. Попробуйте ещё раз.'
  }
}
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Ваша библиотека"
      title="Книги"
      description="Добавляйте EPUB-книги и возвращайтесь к чтению с того же места — даже без интернета."
    >
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".epub,application/epub+zip"
        data-testid="epub-input"
        @change="importFile"
      />
      <Button :disabled="isImporting" @click="selectFile">
        <LoaderCircle
          v-if="isImporting"
          class="animate-spin"
          aria-hidden="true"
        />
        <Plus v-else aria-hidden="true" />
        {{ isImporting ? 'Добавляем…' : 'Добавить EPUB' }}
      </Button>
    </PageHeader>

    <p
      v-if="errorMessage"
      role="alert"
      class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {{ errorMessage }}
    </p>
    <div
      v-if="duplicateBook"
      class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-accent p-4"
    >
      <p class="text-sm">
        Эта книга уже добавлена: <strong>{{ duplicateBook.title }}</strong>
      </p>
      <Button as-child size="sm"
        ><RouterLink :to="`/reader/${duplicateBook.id}`"
          >Открыть книгу</RouterLink
        ></Button
      >
    </div>

    <Card v-if="isLoading" class="mt-10 border-dashed bg-card/75">
      <CardContent class="grid min-h-80 place-items-center p-8"
        ><LoaderCircle
          class="size-8 animate-spin text-primary"
          aria-label="Загрузка"
      /></CardContent>
    </Card>
    <Card
      v-else-if="books.length === 0"
      class="mt-10 overflow-hidden border-dashed bg-card/75"
    >
      <CardContent
        class="grid min-h-96 place-items-center p-8 text-center sm:p-12"
      >
        <div class="max-w-md">
          <span
            class="mx-auto grid size-20 place-items-center rounded-3xl bg-accent text-accent-foreground"
            ><BookOpen class="size-9" aria-hidden="true"
          /></span>
          <h2 class="mt-6 font-serif text-2xl font-semibold">
            Библиотека пока пуста
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            Добавьте EPUB-книгу с устройства. Она останется доступной без
            подключения к интернету.
          </p>
          <div
            class="mt-6 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Upload class="size-3.5" aria-hidden="true" /> EPUB 2/3 без DRM
          </div>
        </div>
      </CardContent>
    </Card>
    <div v-else class="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="book in booksWithCovers"
        :key="book.id"
        class="overflow-hidden bg-card/85"
      >
        <CardContent class="flex gap-4 p-4">
          <img
            v-if="book.coverUrl"
            :src="book.coverUrl"
            :alt="`Обложка книги «${book.title}»`"
            class="h-36 w-24 shrink-0 rounded-xl object-cover"
          />
          <span
            v-else
            class="grid h-36 w-24 shrink-0 place-items-center rounded-xl bg-accent text-primary"
            ><BookOpen class="size-8" aria-hidden="true"
          /></span>
          <div class="flex min-w-0 flex-1 flex-col">
            <h2 class="line-clamp-2 font-serif text-xl font-semibold">
              {{ book.title }}
            </h2>
            <p class="mt-1 truncate text-sm text-muted-foreground">
              {{ book.author ?? 'Автор не указан' }}
            </p>
            <p class="mt-3 text-xs font-medium text-primary">
              {{
                book.progressPercentage === null
                  ? 'Прогресс рассчитывается'
                  : `${Math.round(book.progressPercentage)}%`
              }}
            </p>
            <div class="mt-auto flex gap-2 pt-4">
              <Button as-child size="sm" class="flex-1"
                ><RouterLink :to="`/reader/${book.id}`"
                  >Открыть</RouterLink
                ></Button
              >
              <Button
                variant="outline"
                size="icon"
                :aria-label="`Удалить книгу «${book.title}»`"
                @click="deleteBook(book)"
                ><Trash2 aria-hidden="true"
              /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
