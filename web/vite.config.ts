import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME } from '../shared/brand';
export default defineConfig({
  root: 'web', envDir: '..',
  plugins: [{ name: 'app-name', transformIndexHtml: (html: string) => html.replaceAll('__APP_NAME__', APP_NAME) }, tailwindcss(), VitePWA({
    registerType: 'prompt', injectRegister: 'auto',
    includeAssets: ['icons/*.png', 'fonts/*.woff2', 'fonts/OFL-*.txt', 'landmarks/*.svg', 'states.json'],
    manifest: { name: APP_NAME, short_name: APP_NAME, description: 'A little less planning. A lot more going.', theme_color: '#f6f1e4', background_color: '#f6f1e4', display: 'standalone', start_url: '/', icons: [{ src: '/icons/spotland-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/spotland-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,woff2,txt,svg,json}'], navigateFallbackDenylist: [/^\/api(?:\/|$)/], importScripts: ['/sos-push.js'] },
  })],
  server: { host: '127.0.0.1', headers: { 'Referrer-Policy': 'no-referrer-when-downgrade', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' }, proxy: { '/api': 'http://127.0.0.1:8787' } },
});

