<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  List,
  X,
} from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import ReaderTocList from '@/components/ReaderTocList.vue'
import { Button } from '@/components/ui/button'
import {
  READER_ERROR_MESSAGE,
  readerService,
  type ReaderSession,
  type ReaderState,
} from '@/domain/reader'
import type { TappedText } from '@/domain/text-selection'

const route = useRoute()
const viewport = ref<HTMLElement | null>(null)
const session = ref<ReaderSession | null>(null)
const isLoading = ref(false)
const isNavigating = ref(false)
const errorMessage = ref<string | null>(null)
const isTableOfContentsOpen = ref(false)
const progressPercentage = ref<number | null>(null)
const isProgressCalculating = ref(true)
const tappedText = ref<TappedText | null>(null)

const updateReaderState = (state: ReaderState): void => {
  progressPercentage.value = state.progressPercentage
  isProgressCalculating.value = state.isProgressCalculating
}

const runNavigation = async (
  action: (reader: ReaderSession) => Promise<void>,
): Promise<void> => {
  if (session.value === null || isNavigating.value) return
  isNavigating.value = true
  try {
    await action(session.value)
  } catch {
    errorMessage.value = READER_ERROR_MESSAGE
  } finally {
    isNavigating.value = false
  }
}

const goToTableOfContentsItem = async (href: string): Promise<void> => {
  await runNavigation((reader) => reader.goTo(href))
  if (errorMessage.value === null) isTableOfContentsOpen.value = false
}

onMounted(async () => {
  const bookId = route.params.bookId
  if (typeof bookId !== 'string' || viewport.value === null) return
  isLoading.value = true
  try {
    session.value = await readerService.open(
      bookId,
      viewport.value,
      updateReaderState,
      (selection) => {
        tappedText.value = selection
      },
    )
  } catch {
    errorMessage.value = READER_ERROR_MESSAGE
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => void session.value?.destroy())
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Режим чтения"
      :title="session?.title ?? 'Читалка'"
      :description="
        session
          ? (session.author ?? 'Автор не указан')
          : 'Выберите книгу в библиотеке, чтобы начать чтение.'
      "
    />
    <p
      v-if="errorMessage"
      role="alert"
      class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {{ errorMessage }}
    </p>

    <div class="mt-8 overflow-hidden rounded-3xl border bg-stone-900 shadow-xl">
      <div
        class="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white"
      >
        <div class="flex items-center gap-2 text-sm font-medium">
          <BookOpenText class="size-4" aria-hidden="true" />{{
            session?.title ?? 'Книга не выбрана'
          }}
        </div>
        <div v-if="session" class="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="text-white hover:bg-white/10"
            :aria-expanded="isTableOfContentsOpen"
            aria-controls="reader-toc"
            @click="isTableOfContentsOpen = !isTableOfContentsOpen"
            ><List aria-hidden="true" /> Оглавление</Button
          >
          <Button
            variant="ghost"
            size="sm"
            class="text-white hover:bg-white/10"
            :disabled="isNavigating"
            aria-label="Предыдущая глава"
            @click="runNavigation((reader) => reader.previousChapter())"
            ><ChevronsLeft aria-hidden="true" /> Глава</Button
          >
          <Button
            variant="ghost"
            size="sm"
            class="text-white hover:bg-white/10"
            :disabled="isNavigating"
            aria-label="Следующая глава"
            @click="runNavigation((reader) => reader.nextChapter())"
            >Глава <ChevronsRight aria-hidden="true"
          /></Button>
        </div>
      </div>

      <div
        class="relative p-2 sm:p-5"
        :class="
          session?.appearance.theme === 'dark' ? 'bg-stone-950' : 'bg-[#f5f0e4]'
        "
      >
        <aside
          v-if="isTableOfContentsOpen && session"
          id="reader-toc"
          class="absolute inset-y-2 left-2 z-10 w-[min(22rem,calc(100%-1rem))] overflow-y-auto rounded-2xl border bg-card p-4 shadow-2xl sm:inset-y-5 sm:left-5"
          aria-label="Оглавление книги"
        >
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-serif text-xl font-semibold">Оглавление</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Закрыть оглавление"
              @click="isTableOfContentsOpen = false"
              ><X aria-hidden="true"
            /></Button>
          </div>
          <p
            v-if="session.tableOfContents.length === 0"
            class="mt-6 text-sm text-muted-foreground"
          >
            В этой книге оглавление отсутствует.
          </p>
          <ReaderTocList
            v-else
            class="mt-4"
            :items="session.tableOfContents"
            @select="goToTableOfContentsItem"
          />
        </aside>
        <div
          ref="viewport"
          data-testid="reader-viewport"
          class="mx-auto h-[65dvh] min-h-[30rem] max-w-5xl overflow-hidden rounded-2xl shadow-sm"
          :class="
            session?.appearance.theme === 'dark'
              ? 'bg-stone-900'
              : 'bg-[#fffdf7]'
          "
        />
        <div
          v-if="isLoading"
          class="absolute inset-0 grid place-items-center bg-[#f5f0e4]"
        >
          <LoaderCircle
            class="size-8 animate-spin text-primary"
            aria-label="Открываем книгу"
          />
        </div>
        <p
          v-else-if="!session && !errorMessage"
          class="absolute inset-0 grid place-items-center p-8 text-center text-stone-600"
        >
          Откройте книгу из библиотеки — она доступна для чтения без интернета.
        </p>
      </div>

      <div class="flex items-center justify-between px-4 py-3 text-white">
        <Button
          variant="ghost"
          class="text-white hover:bg-white/10"
          :disabled="!session || isNavigating"
          @click="runNavigation((reader) => reader.previousPage())"
          ><ArrowLeft aria-hidden="true" /> Назад</Button
        >
        <span class="text-xs text-white/60">{{
          !session
            ? 'Книга не выбрана'
            : isProgressCalculating
              ? 'Прогресс рассчитывается'
              : `${Math.round(progressPercentage ?? 0)}%`
        }}</span>
        <Button
          variant="ghost"
          class="text-white hover:bg-white/10"
          :disabled="!session || isNavigating"
          @click="runNavigation((reader) => reader.nextPage())"
          >Вперёд <ArrowRight aria-hidden="true"
        /></Button>
      </div>
    </div>
    <div
      v-if="tappedText"
      class="mt-4 rounded-2xl border bg-card p-4"
      role="status"
      aria-live="polite"
    >
      <p
        class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Выбранное слово
      </p>
      <p class="mt-1 font-serif text-xl font-semibold">{{ tappedText.word }}</p>
      <p v-if="tappedText.sentence" class="mt-2 text-sm text-muted-foreground">
        {{ tappedText.sentence }}
      </p>
    </div>
  </section>
</template>
