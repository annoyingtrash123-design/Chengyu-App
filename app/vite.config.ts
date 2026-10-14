import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Three ways the UI runs:
//  - Tauri app (Android/iOS/desktop): talks to Rust directly; no service worker.
//  - Web app / PWA (GitHub Pages): the Rust core runs as WebAssembly; installable, works offline.
//  - `npm run dev:browser`: /api/* is proxied to the Rust dev server.
const inTauri = !!process.env.TAURI_ENV_PLATFORM;
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  clearScreen: false,
  plugins: [
        VitePWA({
          // Disabled in the Tauri app (no service worker); the virtual module becomes a no-op.
          disable: inTauri,
          registerType: "autoUpdate",
          injectRegister: false, // registered by src/updates.ts, which also handles reloading
          includeAssets: ["apple-touch-icon.png", "icon.png"],
          manifest: {
            name: "成语词典 Chengyu Dictionary",
            short_name: "成语词典",
            description: "Chengyu, proverbs and sayings: dictionary, flashcards and games",
            lang: "zh-CN",
            start_url: base,
            scope: base,
            display: "standalone",
            orientation: "portrait",
            background_color: "#f7f7f5",
            theme_color: "#f7f7f5",
            icons: [
              { src: "icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "icon-512.png", sizes: "512x512", type: "image/png" },
              { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
          },
          workbox: {
            globPatterns: ["**/*.{js,css,html,wasm,png,svg,webmanifest}"],
            maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
          },
        }),
  ],
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    proxy: { "/api": "http://127.0.0.1:8787" },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { target: "es2021", outDir: "dist" },
});
