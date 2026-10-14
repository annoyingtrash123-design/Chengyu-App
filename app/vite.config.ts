import { defineConfig } from "vite";

// In the Tauri app the UI talks to Rust directly. In a plain browser
// (`npm run dev:browser`) `/api/*` is proxied to the Rust dev server.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    proxy: { "/api": "http://127.0.0.1:8787" },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { target: "es2021", outDir: "dist" },
});
