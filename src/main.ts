// N64WASM Emulator Entry Point
import { checkBrowserCompatibility, loadTestModule } from './emulator/loader';

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

function showStatus(message: string) {
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log('[N64WASM]', message);
}

function showError(message: string) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
  console.error('[N64WASM]', message);
}

async function initEmulator() {
  try {
    showStatus('Checking browser compatibility...');

    // Check browser support
    const compat = checkBrowserCompatibility();

    if (!compat.supported) {
      const missing = Object.entries(compat.features)
        .filter(([_, supported]) => !supported)
        .map(([name]) => name);
      throw new Error(`Browser missing required features: ${missing.join(', ')}`);
    }

    // Show warnings
    compat.warnings.forEach(warning => console.warn('[N64WASM]', warning));

    showStatus('Browser compatibility ✓');

    // Load test WebAssembly module
    showStatus('Loading WebAssembly test module...');
    const Module = await loadTestModule();

    showStatus('WebAssembly module loaded ✓');

    // Test the exported functions
    if (Module._add) {
      const result = Module._add(5, 7);
      console.log('[N64WASM] Test: 5 + 7 =', result);
      showStatus(`WASM Test successful: 5 + 7 = ${result} ✓`);
    }

    if (Module._hello_world) {
      Module._hello_world();
    }

    showStatus('✓ Emulator ready! (Test module loaded)');

  } catch (error) {
    showError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Start initialization
showStatus('Starting N64WASM...');
initEmulator();
