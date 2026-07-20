// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  // Десктопное приложение: чистый SPA без сервера, статика уедет в Electron.
  ssr: false,

  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  app: {
    // Относительный baseURL, чтобы ассеты корректно резолвились под протоколом app://.
    baseURL: '/',
    head: {
      title: 'S3 UI',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },

  // Для полностью статической выдачи (nuxt generate) без пререндер-краулинга.
  nitro: {
    preset: 'static',
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  dir: {
    // Nuxt 4 по умолчанию использует app/ как srcDir — оставляем стандарт.
  },
})
