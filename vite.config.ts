import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      // Required for SharedArrayBuffer (threading support)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      strict: false, // Allow serving files outside root
    },
  },
  optimizeDeps: {
    exclude: ['core.js'], // Exclude WebAssembly module from optimization
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          emulator: ['./public/core.js'],
        },
      },
    },
  },
});
