import { registerSW as registerVirtualSW } from 'virtual:pwa-register'

export type ServiceWorkerRegistrationOptions = {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

type RegisterServiceWorker = (
  options?: ServiceWorkerRegistrationOptions,
) => UpdateServiceWorker

// Keep the build-time virtual module behind a stable application-owned type.
// Some editor ESLint integrations cannot resolve Vite virtual module types.
export const registerSW: RegisterServiceWorker = registerVirtualSW
