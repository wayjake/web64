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
    exclude: ['n64wasm.js'], // Exclude WebAssembly module from optimization
  },
  assetsInclude: ['**/*.wasm', '**/*.data', '**/*.n64'], // Ensure WASM, data, and ROM files are treated as assets
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          emulator: ['./public/n64wasm.js'],
        },
      },
    },
  },
});
