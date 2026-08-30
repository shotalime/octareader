<script setup lang="ts">
import { Check, LoaderCircle, RotateCcw, X } from '@lucide/vue'

import LanguageSelect from '@/components/LanguageSelect.vue'
import { Button } from '@/components/ui/button'
import type { PartOfSpeech, TranslationResult } from '@/domain/ai/provider'
import type { TappedText } from '@/domain/text-selection'

type TranslationPopupStatus =
  'needs-languages' | 'loading' | 'success' | 'error'

defineProps<{
  selection: TappedText
  status: TranslationPopupStatus
  result: TranslationResult | null
  errorMessage: string | null
  fromCache: boolean
  isSaving: boolean
  isSaved: boolean
}>()

const sourceLanguage = defineModel<string>('sourceLanguage', {
  required: true,
})
const targetLanguage = defineModel<string>('targetLanguage', {
  required: true,
})

defineEmits<{
  close: []
  retry: []
  saveLanguages: []
  save: []
}>()

const partOfSpeechLabels: Record<PartOfSpeech, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adjective: 'прилагательное',
  adverb: 'наречие',
  pronoun: 'местоимение',
  preposition: 'предлог',
  conjunction: 'союз',
  interjection: 'междометие',
  determiner: 'определитель',
  numeral: 'числительное',
  particle: 'частица',
  other: 'другая часть речи',
  unknown: 'не определена',
}
</script>

<template>
  <div
    class="absolute inset-x-2 bottom-2 z-20 mx-auto max-w-lg rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl sm:inset-x-5 sm:bottom-5"
    role="dialog"
    aria-labelledby="translation-popup-title"
    aria-live="polite"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Выбранное слово
        </p>
        <h2
          id="translation-popup-title"
          class="mt-1 font-serif text-2xl font-semibold"
        >
          {{ selection.word }}
        </h2>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Закрыть перевод"
        @click="$emit('close')"
      >
        <X aria-hidden="true" />
      </Button>
    </div>

    <p v-if="selection.sentence" class="mt-3 text-sm text-muted-foreground">
      {{ selection.sentence }}
    </p>

    <div v-if="status === 'needs-languages'" class="mt-5 space-y-4">
      <p class="text-sm">Укажите направление перевода для этой книги.</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <LanguageSelect
          v-model="sourceLanguage"
          label="Язык книги"
          search-label="Поиск языка книги"
        />
        <LanguageSelect
          v-model="targetLanguage"
          label="Переводить на"
          search-label="Поиск языка перевода"
        />
      </div>
      <Button @click="$emit('saveLanguages')">Сохранить и перевести</Button>
    </div>

    <div
      v-else-if="status === 'loading'"
      class="mt-5 flex items-center gap-3 text-sm"
    >
      <LoaderCircle class="size-5 animate-spin" aria-hidden="true" />
      Получаем перевод…
    </div>

    <div v-else-if="status === 'error'" class="mt-5">
      <p role="alert" class="text-sm text-red-700">{{ errorMessage }}</p>
      <Button class="mt-3" variant="outline" @click="$emit('retry')">
        <RotateCcw aria-hidden="true" /> Повторить
      </Button>
    </div>

    <div v-else-if="result" class="mt-5 space-y-3">
      <template v-if="result.status === 'translated'">
        <p class="font-serif text-2xl font-semibold text-primary">
          {{ result.translation }}
        </p>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div v-if="result.lemma">
            <dt class="text-muted-foreground">Начальная форма</dt>
            <dd class="font-medium">{{ result.lemma }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">Часть речи</dt>
            <dd class="font-medium">
              {{ partOfSpeechLabels[result.partOfSpeech] }}
            </dd>
          </div>
        </dl>
        <Button :disabled="isSaving || isSaved" @click="$emit('save')">
          <Check v-if="isSaved" aria-hidden="true" />
          {{
            isSaved ? 'Сохранено' : isSaving ? 'Сохраняем…' : 'Сохранить слово'
          }}
        </Button>
      </template>
      <p v-else-if="result.status === 'proper_noun'" class="font-medium">
        Имя собственное — перевод не требуется
      </p>
      <p v-else class="font-medium">Не удалось определить перевод</p>
      <p v-if="fromCache" class="text-xs text-muted-foreground">
        Сохранённый перевод
      </p>
    </div>
  </div>
</template>
