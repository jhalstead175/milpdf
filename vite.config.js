import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    // mupdf ships wasm + top-level await; let it load as-is rather than pre-bundle.
    exclude: ['mupdf'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    // es2022 enables top-level await (used by mupdf's wasm glue). MilPDF targets
    // modern Chromium (Electron) + current browsers, all of which support it.
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist'],
          pdflib: ['pdf-lib'],
          docx: ['docx'],
        },
      },
    },
  },
})
