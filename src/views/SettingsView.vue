<script setup lang="ts">
import {
  KeyRound,
  LoaderCircle,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  Type,
} from '@lucide/vue'
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
  aiErrorMessage,
  apiKeyService,
  type KeyValidationStatus,
} from '@/domain/api-key'
import {
  DEFAULT_READER_APPEARANCE,
  settingsRepository,
  type ReaderAppearanceSettings,
} from '@/domain/settings'

const settings = ref<ReaderAppearanceSettings>({ ...DEFAULT_READER_APPEARANCE })
const isLoading = ref(true)
const isSaving = ref(false)
const statusMessage = ref<string | null>(null)
const apiKey = ref('')
const keyStatus = ref<KeyValidationStatus>('missing')
const keyMessage = ref<string | null>(null)
const isCheckingKey = ref(false)

onMounted(async () => {
  try {
    const [appearance, savedKey] = await Promise.all([
      settingsRepository.getReaderAppearance(),
      apiKeyService.getState(),
    ])
    settings.value = appearance
    apiKey.value = savedKey.apiKey ?? ''
    keyStatus.value = savedKey.validationStatus
    keyMessage.value = messageForKeyStatus(savedKey.validationStatus)
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

const messageForKeyStatus = (status: KeyValidationStatus): string => {
  switch (status) {
    case 'valid':
      return 'API key действителен.'
    case 'invalid':
      return 'API key недействителен. Проверьте ключ в настройках.'
    case 'offline':
      return 'Нет подключения к интернету. Ключ не помечен недействительным.'
    case 'unchecked':
      return 'API key сохранён и ещё не проверен.'
    case 'missing':
      return 'API key не сохранён.'
  }
}

const saveApiKey = async (): Promise<void> => {
  try {
    const state = await apiKeyService.save(apiKey.value)
    keyStatus.value = state.validationStatus
    keyMessage.value = messageForKeyStatus(state.validationStatus)
  } catch (error: unknown) {
    keyMessage.value = aiErrorMessage(error)
  }
}

const checkApiKey = async (): Promise<void> => {
  isCheckingKey.value = true
  keyMessage.value = null
  try {
    const state = await apiKeyService.validate(apiKey.value)
    keyStatus.value = state.validationStatus
    keyMessage.value = messageForKeyStatus(state.validationStatus)
  } catch (error: unknown) {
    keyMessage.value = aiErrorMessage(error)
  } finally {
    isCheckingKey.value = false
  }
}

const deleteApiKey = async (): Promise<void> => {
  try {
    await apiKeyService.delete()
    apiKey.value = ''
    keyStatus.value = 'missing'
    keyMessage.value = messageForKeyStatus('missing')
  } catch {
    keyMessage.value = 'Не удалось удалить API key. Попробуйте ещё раз.'
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
      <div class="space-y-6">
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
                /><Save v-else aria-hidden="true" /> Сохранить
                оформление</Button
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

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2"
              ><KeyRound class="size-5" aria-hidden="true" /> Gemini API
              key</CardTitle
            >
            <CardDescription
              >Ключ хранится только локально в IndexedDB.</CardDescription
            >
          </CardHeader>
          <CardContent class="space-y-4">
            <label class="grid gap-2 text-sm font-medium">
              API key
              <input
                v-model="apiKey"
                type="password"
                autocomplete="off"
                spellcheck="false"
                class="h-10 rounded-xl border bg-background px-3"
                placeholder="Введите ключ Gemini"
              />
            </label>
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                :disabled="apiKey.trim().length === 0"
                @click="saveApiKey"
                ><Save aria-hidden="true" /> Сохранить ключ</Button
              >
              <Button
                :disabled="isCheckingKey || apiKey.trim().length === 0"
                @click="checkApiKey"
                ><LoaderCircle
                  v-if="isCheckingKey"
                  class="animate-spin"
                  aria-hidden="true"
                /><ShieldCheck v-else aria-hidden="true" /> Проверить
                ключ</Button
              >
              <Button
                variant="outline"
                :disabled="keyStatus === 'missing'"
                @click="deleteApiKey"
                ><Trash2 aria-hidden="true" /> Удалить ключ</Button
              >
            </div>
            <p
              v-if="keyMessage"
              role="status"
              class="text-sm text-muted-foreground"
            >
              {{ keyMessage }}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card class="h-fit bg-accent/70">
        <CardHeader>
          <span
            class="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"
            ><ShieldCheck class="size-5" aria-hidden="true"
          /></span>
          <CardTitle class="mt-3">Приватность по умолчанию</CardTitle>
          <CardDescription class="leading-relaxed text-accent-foreground/70"
            >Настройки и книги хранятся только на этом устройстве. IndexedDB не
            защищает API key от JavaScript-кода страницы, XSS и расширений
            браузера; этот риск принят для MVP.</CardDescription
          >
        </CardHeader>
      </Card>
    </div>
  </section>
</template>
