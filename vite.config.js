import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
// PWA config - install vite-plugin-pwa for full PWA support
// npm install -D vite-plugin-pwa
 
export default defineConfig({
  plugins: [
    react(),
    // Uncomment after: npm install -D vite-plugin-pwa
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   manifest: {
    //     name: 'Super Coach',
    //     short_name: 'SuperCoach',
    //     description: 'English · Mandarin · VLSI · Taiwan',
    //     theme_color: '#6ee7b7',
    //     background_color: '#08090a',
    //     display: 'standalone',
    //     icons: [
    //       { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    //       { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    //     ],
    //   },
    // }),
  ],
  server: {
    port: 5173,
  },
})
 