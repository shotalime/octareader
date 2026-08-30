/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.vue' {
  import type { Component } from 'vue'

  const component: Component
  export default component
}
