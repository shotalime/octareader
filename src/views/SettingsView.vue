<script setup lang="ts">
import { LoaderCircle, Moon, Save, ShieldCheck, Sun, Type } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DEFAULT_READER_APPEARANCE,
  settingsRepository,
  type ReaderAppearanceSettings,
} from '@/domain/settings'

const settings = ref<ReaderAppearanceSettings>({ ...DEFAULT_READER_APPEARANCE })
const isLoading = ref(true)
const isSaving = ref(false)
const statusMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    settings.value = await settingsRepository.getReaderAppearance()
  } catch {
    statusMessage.value = 'Не удалось загрузить настройки.'
  } finally {
    isLoading.value = false
  }
})

const saveSettings = async (): Promise<void> => {
  isSaving.value = true
  statusMessage.value = null
  try {
    await settingsRepository.saveReaderAppearance({ ...settings.value })
    statusMessage.value = 'Настройки сохранены.'
  } catch {
    statusMessage.value = 'Не удалось сохранить настройки.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section>
    <PageHeader
      eyebrow="Параметры приложения"
      title="Настройки"
      description="Настройте оформление чтения под себя. Параметры применяются ко всем книгам."
    />

    <div class="mt-10 grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"
            ><Type class="size-5" aria-hidden="true" /> Оформление
            чтения</CardTitle
          >
          <CardDescription
            >Изменения применятся при следующем открытии
            читалки.</CardDescription
          >
        </CardHeader>
        <CardContent v-if="isLoading" class="grid min-h-64 place-items-center"
          ><LoaderCircle
            class="size-7 animate-spin"
            aria-label="Загрузка настроек"
        /></CardContent>
        <CardContent v-else class="space-y-6">
          <label class="grid gap-2 text-sm font-medium">
            Семейство шрифта
            <select
              v-model="settings.fontFamily"
              class="h-10 rounded-xl border bg-background px-3"
            >
              <option value="serif">С засечками</option>
              <option value="sans-serif">Без засечек</option>
            </select>
          </label>

          <label class="grid gap-2 text-sm font-medium">
            <span class="flex justify-between"
              ><span>Размер текста</span
              ><output>{{ settings.fontSizePercent }}%</output></span
            >
            <input
              v-model.number="settings.fontSizePercent"
              type="range"
              min="80"
              max="180"
              step="5"
            />
          </label>

          <label class="grid gap-2 text-sm font-medium">
            <span class="flex justify-between"
              ><span>Межстрочный интервал</span
              ><output>{{ settings.lineHeight.toFixed(1) }}</output></span
            >
            <input
              v-model.number="settings.lineHeight"
              type="range"
              min="1.2"
              max="2.2"
              step="0.1"
            />
          </label>

          <label class="grid gap-2 text-sm font-medium">
            <span class="flex justify-between"
              ><span>Ширина полей</span
              ><output>{{ settings.marginPercent }}%</output></span
            >
            <input
              v-model.number="settings.marginPercent"
              type="range"
              min="2"
              max="20"
              step="1"
            />
          </label>

          <fieldset>
            <legend class="text-sm font-medium">Тема читалки</legend>
            <div class="mt-2 grid grid-cols-2 gap-3">
              <label
                class="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"
                :class="settings.theme === 'light' ? 'bg-accent' : ''"
                ><input
                  v-model="settings.theme"
                  type="radio"
                  value="light"
                /><Sun class="size-4" aria-hidden="true" /> Светлая</label
              >
              <label
                class="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"
                :class="settings.theme === 'dark' ? 'bg-accent' : ''"
                ><input
                  v-model="settings.theme"
                  type="radio"
                  value="dark"
                /><Moon class="size-4" aria-hidden="true" /> Тёмная</label
              >
            </div>
          </fieldset>

          <div class="flex flex-wrap items-center gap-3">
            <Button :disabled="isSaving" @click="saveSettings"
              ><LoaderCircle
                v-if="isSaving"
                class="animate-spin"
                aria-hidden="true"
              /><Save v-else aria-hidden="true" /> Сохранить оформление</Button
            >
            <p
              v-if="statusMessage"
              role="status"
              class="text-sm text-muted-foreground"
            >
              {{ statusMessage }}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card class="h-fit bg-accent/70">
        <CardHeader>
          <span
            class="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"
            ><ShieldCheck class="size-5" aria-hidden="true"
          /></span>
          <CardTitle class="mt-3">Приватность по умолчанию</CardTitle>
          <CardDescription class="leading-relaxed text-accent-foreground/70"
            >Настройки и книги хранятся только на этом устройстве в
            IndexedDB.</CardDescription
          >
        </CardHeader>
      </Card>
    </div>
  </section>
</template>
