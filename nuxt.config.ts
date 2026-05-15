import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@vueuse/motion/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    minimaxApiKey: '',
    minimaxGroupId: '',
    unlockCode: '',
    sessionSecret: '',
    sqlitePath: './data/app.sqlite',
    public: {
      appName: '给你的信',
    },
  },
})
