<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  LibraryBig,
  LoaderCircle,
  List,
  X,
} from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import ReaderTocList from '@/components/ReaderTocList.vue'
import TranslationPopup from '@/components/TranslationPopup.vue'
import { Button } from '@/components/ui/button'
import { type TranslationResult } from '@/domain/ai/provider'
import { aiErrorMessage } from '@/domain/api-key'
import {
  READER_ERROR_MESSAGE,
  readerService,
  type ReaderSession,
  type ReaderState,
} from '@/domain/reader'
import { settingsRepository } from '@/domain/settings'
import type { TappedText } from '@/domain/text-selection'
import { translationService } from '@/domain/translation'
import { vocabularyService } from '@/domain/vocabulary'

type TranslationPopupStatus =
  'needs-languages' | 'loading' | 'success' | 'error'

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
const translationStatus = ref<TranslationPopupStatus>('loading')
const translationResult = ref<TranslationResult | null>(null)
const translationErrorMessage = ref<string | null>(null)
const translationFromCache = ref(false)
const sourceLanguage = ref('en')
const targetLanguage = ref('ru')
const hasBookLanguages = ref(false)
const currentCfi = ref<string | null>(null)
const isSavingVocabulary = ref(false)
const isVocabularySaved = ref(false)
let translationRequestId = 0

const updateReaderState = (state: ReaderState): void => {
  currentCfi.value = state.cfi
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

const translateTappedText = async (): Promise<void> => {
  const selection = tappedText.value
  if (selection === null) return
  if (!hasBookLanguages.value) {
    translationStatus.value = 'needs-languages'
    return
  }
  const requestId = ++translationRequestId
  translationStatus.value = 'loading'
  translationResult.value = null
  translationErrorMessage.value = null
  translationFromCache.value = false
  isVocabularySaved.value = false
  try {
    const outcome = await translationService.translate({
      sourceText: selection.word,
      sentence: selection.sentence,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
    })
    if (requestId !== translationRequestId) return
    translationResult.value = outcome.result
    translationFromCache.value = outcome.fromCache
    translationStatus.value = 'success'
  } catch (error: unknown) {
    if (requestId !== translationRequestId) return
    translationErrorMessage.value = aiErrorMessage(error)
    translationStatus.value = 'error'
  }
}

const handleTextTap = (selection: TappedText): void => {
  tappedText.value = selection
  void translateTappedText()
}

const saveBookLanguages = async (): Promise<void> => {
  const bookId = route.params.bookId
  if (typeof bookId !== 'string') return
  try {
    await settingsRepository.saveBookLanguages(
      bookId,
      sourceLanguage.value,
      targetLanguage.value,
    )
    hasBookLanguages.value = true
    await translateTappedText()
  } catch {
    translationErrorMessage.value =
      'Не удалось сохранить языки книги. Попробуйте ещё раз.'
    translationStatus.value = 'error'
  }
}

const closeTranslation = (): void => {
  translationRequestId += 1
  tappedText.value = null
  translationResult.value = null
  translationErrorMessage.value = null
}

const saveVocabulary = async (): Promise<void> => {
  const result = translationResult.value
  const selection = tappedText.value
  const bookId = route.params.bookId
  if (
    result?.status !== 'translated' ||
    result.translation === null ||
    selection === null ||
    typeof bookId !== 'string' ||
    session.value === null
  )
    return
  isSavingVocabulary.value = true
  try {
    await vocabularyService.save({
      sourceText: selection.word,
      lemma: result.lemma,
      partOfSpeech: result.partOfSpeech,
      translation: result.translation,
      sentence: selection.sentence,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
      bookId,
      bookTitle: session.value.title,
      cfi: currentCfi.value,
    })
    isVocabularySaved.value = true
  } catch {
    translationErrorMessage.value =
      'Не удалось сохранить слово. Попробуйте ещё раз.'
    translationStatus.value = 'error'
  } finally {
    isSavingVocabulary.value = false
  }
}

onMounted(async () => {
  const bookId = route.params.bookId
  if (typeof bookId !== 'string' || viewport.value === null) return
  isLoading.value = true
  try {
    const openedSession = await readerService.open(
      bookId,
      viewport.value,
      updateReaderState,
      handleTextTap,
    )
    session.value = openedSession
    sourceLanguage.value =
      openedSession.bookLanguages?.sourceLanguage ??
      openedSession.suggestedSourceLanguage
    targetLanguage.value = openedSession.bookLanguages?.targetLanguage ?? 'ru'
    hasBookLanguages.value = openedSession.bookLanguages !== null
    if (tappedText.value !== null) void translateTappedText()
  } catch {
    errorMessage.value = READER_ERROR_MESSAGE
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => void session.value?.destroy())
</script>

<template>
  <section class="flex h-dvh min-h-0 flex-col overflow-hidden bg-stone-900">
    <h1 class="sr-only">Читалка</h1>
    <p
      v-if="errorMessage"
      role="alert"
      class="m-3 shrink-0 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {{ errorMessage }}
    </p>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        class="relative min-h-0 flex-1"
        :class="
          session?.appearance.theme === 'dark' ? 'bg-stone-950' : 'bg-[#f5f0e4]'
        "
      >
        <aside
          v-if="isTableOfContentsOpen && session"
          id="reader-toc"
          class="absolute inset-y-2 left-2 z-10 w-[min(22rem,calc(100%-1rem))] overflow-y-auto rounded-2xl border bg-card p-4 shadow-2xl"
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
          class="mx-auto h-full w-full max-w-5xl overflow-hidden"
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
        <TranslationPopup
          v-if="tappedText"
          v-model:source-language="sourceLanguage"
          v-model:target-language="targetLanguage"
          :selection="tappedText"
          :status="translationStatus"
          :result="translationResult"
          :error-message="translationErrorMessage"
          :from-cache="translationFromCache"
          :is-saving="isSavingVocabulary"
          :is-saved="isVocabularySaved"
          @close="closeTranslation"
          @retry="translateTappedText"
          @save-languages="saveBookLanguages"
          @save="saveVocabulary"
        />
      </div>

      <nav
        aria-label="Управление чтением"
        class="grid shrink-0 grid-cols-[auto_auto_minmax(0,1fr)_minmax(2.75rem,5rem)_minmax(2.75rem,5rem)] items-center gap-1 border-t border-white/10 bg-stone-900 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-white sm:px-4"
      >
        <Button
          as-child
          variant="ghost"
          size="icon"
          class="text-white hover:bg-white/10"
        >
          <RouterLink to="/" aria-label="Вернуться в библиотеку">
            <LibraryBig aria-hidden="true" />
          </RouterLink>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="text-white hover:bg-white/10"
          :disabled="!session"
          :aria-expanded="isTableOfContentsOpen"
          aria-controls="reader-toc"
          aria-label="Открыть оглавление"
          @click="isTableOfContentsOpen = !isTableOfContentsOpen"
          ><List aria-hidden="true"
        /></Button>
        <span
          class="truncate px-1 text-center text-[11px] text-white/70 sm:text-xs"
          >{{
            !session
              ? 'Книга не выбрана'
              : isProgressCalculating
                ? 'Прогресс рассчитывается'
                : `${Math.round(progressPercentage ?? 0)}%`
          }}</span
        >
        <Button
          variant="ghost"
          size="icon"
          class="w-full border border-white/15 bg-white/10 text-white shadow-sm transition-all hover:border-white/25 hover:bg-white/20 active:scale-[0.97] [&_svg]:size-5"
          :disabled="!session || isNavigating"
          aria-label="Предыдущая страница"
          @click="runNavigation((reader) => reader.previousPage())"
          ><ArrowLeft aria-hidden="true"
        /></Button>
        <Button
          variant="ghost"
          size="icon"
          class="w-full border border-white/15 bg-white/10 text-white shadow-sm transition-all hover:border-white/25 hover:bg-white/20 active:scale-[0.97] [&_svg]:size-5"
          :disabled="!session || isNavigating"
          aria-label="Следующая страница"
          @click="runNavigation((reader) => reader.nextPage())"
          ><ArrowRight aria-hidden="true"
        /></Button>
      </nav>
    </div>
  </section>
</template>
