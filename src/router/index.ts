import { createRouter, createWebHistory } from 'vue-router'

import LibraryView from '@/views/LibraryView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ReaderView from '@/views/ReaderView.vue'
import ReviewView from '@/views/ReviewView.vue'
import SettingsView from '@/views/SettingsView.vue'
import VocabularyView from '@/views/VocabularyView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'library',
      component: LibraryView,
    },
    {
      path: '/reader/:bookId?',
      name: 'reader',
      component: ReaderView,
    },
    {
      path: '/vocabulary',
      name: 'vocabulary',
      component: VocabularyView,
    },
    {
      path: '/review',
      name: 'review',
      component: ReviewView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

export default router
