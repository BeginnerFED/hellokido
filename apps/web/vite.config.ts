import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The site is served from GitHub Pages under /hellokido/ (public/404.html repeats this path).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/hellokido/',
  // An inline (empty) PostCSS config stops Vite from picking up the old app's
  // postcss.config.js (Tailwind 3) in the repository root.
  css: { postcss: {} },
  define: {
    // Build day, shown in Settings › Version
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10))
  },
  server: {
    port: 5173
  }
})
