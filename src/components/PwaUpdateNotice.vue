<script setup lang="ts">
import { RefreshCw, X } from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { registerSW } from '@/pwa/register'

const updateAvailable = ref(false)
const offlineReady = ref(false)
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    updateAvailable.value = true
  },
  onOfflineReady: () => {
    offlineReady.value = true
  },
})

const applyUpdate = async (): Promise<void> => {
  await updateServiceWorker(true)
}

const dismiss = (): void => {
  updateAvailable.value = false
  offlineReady.value = false
}
</script>

<template>
  <aside
    v-if="updateAvailable || offlineReady"
    class="fixed bottom-24 right-4 z-50 max-w-sm rounded-2xl border bg-card p-4 shadow-xl lg:bottom-6"
    aria-live="polite"
  >
    <p class="text-sm font-semibold">
      {{
        updateAvailable
          ? 'Доступно обновление OctaReader'
          : 'OctaReader готов к работе без интернета'
      }}
    </p>
    <p v-if="updateAvailable" class="mt-1 text-xs text-muted-foreground">
      Перезапустите приложение, чтобы использовать новую версию. Локальные
      данные сохранятся.
    </p>
    <div class="mt-3 flex gap-2">
      <Button v-if="updateAvailable" size="sm" @click="applyUpdate">
        <RefreshCw aria-hidden="true" /> Обновить
      </Button>
      <Button
        size="sm"
        variant="outline"
        @click="dismiss"
      >
        <X aria-hidden="true" /> Закрыть
      </Button>
    </div>
  </aside>
</template>
