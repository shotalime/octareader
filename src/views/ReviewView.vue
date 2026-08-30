<script setup lang="ts">
import { BrainCircuit } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  reviewService,
  sentenceWithBlank,
  type ReviewCard,
} from '@/domain/review'
import type { ReviewRating } from '@/domain/spaced-repetition'

const cards = ref<ReviewCard[]>([])
const isLoading = ref(true)
const isRevealed = ref(false)
const isRating = ref(false)
const errorMessage = ref<string | null>(null)
const currentCard = computed(() => cards.value[0] ?? null)
const prompt = computed(() => {
  const card = currentCard.value
  if (card === null) return ''
  if (card.context === null) return card.entry.lemma
  return sentenceWithBlank(card.context) ?? card.context.sourceText
})

const labels: Record<string, string> = {
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
const partOfSpeechLabel = (value: string): string => labels[value] ?? value

const loadCards = async (): Promise<void> => {
  try {
    cards.value = await reviewService.due()
  } catch {
    errorMessage.value = 'Не удалось загрузить карточки. Попробуйте ещё раз.'
  } finally {
    isLoading.value = false
  }
}

const rate = async (rating: ReviewRating): Promise<void> => {
  const card = currentCard.value
  if (card === null || isRating.value) return
  isRating.value = true
  errorMessage.value = null
  try {
    await reviewService.rate(card.entry.id, rating)
    cards.value = cards.value.slice(1)
    isRevealed.value = false
  } catch {
    errorMessage.value = 'Не удалось сохранить оценку. Попробуйте ещё раз.'
  } finally {
    isRating.value = false
  }
}

onMounted(loadCards)
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Интервальное повторение"
      title="Повторение"
      description="Возвращайтесь к словам вовремя, чтобы они оставались в долговременной памяти."
    />
    <p v-if="errorMessage" role="alert" class="mt-6 text-sm text-red-700">
      {{ errorMessage }}
    </p>
    <p v-if="isLoading" class="mt-10 text-sm text-muted-foreground">
      Загружаем карточки…
    </p>

    <Card v-else-if="currentCard" class="mx-auto mt-10 max-w-3xl bg-card/90">
      <CardHeader>
        <p
          class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Осталось: {{ cards.length }}
        </p>
        <CardTitle class="mt-4 font-serif text-3xl leading-relaxed">{{
          prompt
        }}</CardTitle>
        <p
          v-if="
            currentCard.context === null ||
            currentCard.context.sentence === null
          "
          class="text-sm text-muted-foreground"
        >
          Вспомните перевод слова
        </p>
      </CardHeader>
      <CardContent>
        <Button v-if="!isRevealed" class="w-full" @click="isRevealed = true"
          >Показать ответ</Button
        >
        <div v-else class="space-y-5">
          <div>
            <p class="text-2xl font-semibold">
              {{ currentCard.context?.sourceText ?? currentCard.entry.lemma }}
            </p>
            <p v-if="currentCard.context" class="mt-1 text-xl text-primary">
              {{ currentCard.context.translation }}
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ currentCard.entry.lemma }} ·
              {{ partOfSpeechLabel(currentCard.entry.partOfSpeech) }}
            </p>
            <p
              v-if="currentCard.context?.sentence"
              class="mt-4 rounded-xl bg-muted p-4 text-sm"
            >
              {{ currentCard.context.sentence }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              variant="outline"
              :disabled="isRating"
              @click="rate('again')"
              >Не помню</Button
            >
            <Button variant="outline" :disabled="isRating" @click="rate('hard')"
              >С трудом</Button
            >
            <Button variant="outline" :disabled="isRating" @click="rate('good')"
              >Помню</Button
            >
            <Button :disabled="isRating" @click="rate('easy')">Легко</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-else class="mt-10 bg-primary text-primary-foreground">
      <CardHeader
        ><BrainCircuit class="size-8" aria-hidden="true" /><CardTitle
          class="text-2xl"
          >Карточек на сегодня нет</CardTitle
        ></CardHeader
      >
      <CardContent
        ><p class="text-sm text-primary-foreground/75">
          Новые карточки появятся сразу после сохранения слов.
        </p></CardContent
      >
    </Card>
  </section>
</template>
