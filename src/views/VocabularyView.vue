<script setup lang="ts">
import { Languages, MousePointer2, Trash2 } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PartOfSpeech } from '@/domain/ai/provider'
import { vocabularyService, type VocabularyListItem } from '@/domain/vocabulary'

const entries = ref<VocabularyListItem[]>([])
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const deletingId = ref<string | null>(null)

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
const partOfSpeechLabel = (value: string): string =>
  partOfSpeechLabels[value as PartOfSpeech] ?? value

const loadEntries = async (): Promise<void> => {
  try {
    entries.value = await vocabularyService.list()
  } catch {
    errorMessage.value = 'Не удалось загрузить словарь. Попробуйте ещё раз.'
  } finally {
    isLoading.value = false
  }
}

const deleteEntry = async (entry: VocabularyListItem): Promise<void> => {
  if (!window.confirm(`Удалить слово «${entry.lemma}» из словаря?`)) return
  deletingId.value = entry.id
  errorMessage.value = null
  try {
    await vocabularyService.delete(entry.id)
    entries.value = entries.value.filter(({ id }) => id !== entry.id)
  } catch {
    errorMessage.value = 'Не удалось удалить слово. Попробуйте ещё раз.'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadEntries)
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Личный словарь"
      title="Слова"
      description="Сохранённые переводы и контексты из ваших книг."
    />
    <p v-if="errorMessage" role="alert" class="mt-6 text-sm text-red-700">
      {{ errorMessage }}
    </p>
    <p v-if="isLoading" class="mt-10 text-sm text-muted-foreground">
      Загружаем словарь…
    </p>

    <Card
      v-else-if="entries.length === 0"
      class="mt-10 border-dashed bg-card/75"
    >
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
            <MousePointer2 class="size-4" aria-hidden="true" /> Один тап — один
            перевод
          </p>
        </div>
      </CardContent>
    </Card>

    <div v-else class="mt-8 grid gap-5 lg:grid-cols-2">
      <Card v-for="entry in entries" :key="entry.id" class="bg-card/80">
        <CardHeader class="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle class="font-serif text-2xl">{{ entry.lemma }}</CardTitle>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ partOfSpeechLabel(entry.partOfSpeech) }} ·
              {{ entry.sourceLanguage }} → {{ entry.targetLanguage }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            :disabled="deletingId === entry.id"
            :aria-label="`Удалить ${entry.lemma}`"
            @click="deleteEntry(entry)"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </CardHeader>
        <CardContent>
          <ul class="space-y-4">
            <li
              v-for="context in entry.contexts"
              :key="context.id"
              class="border-t pt-4 first:border-0 first:pt-0"
            >
              <p class="font-medium">
                {{ context.sourceText }} — {{ context.translation }}
              </p>
              <p
                v-if="context.sentence"
                class="mt-1 text-sm text-muted-foreground"
              >
                {{ context.sentence }}
              </p>
              <p class="mt-2 text-xs text-muted-foreground">
                {{ context.bookTitle }}
              </p>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
