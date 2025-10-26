// N64WASM Emulator Entry Point
import { checkBrowserCompatibility, loadEmulatorCore } from './emulator/loader';

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

    // Load ParaLLEl N64 core
    showStatus('Loading N64 emulator core...');
    const Module = await loadEmulatorCore(canvas);

    showStatus('N64 emulator core loaded ✓');
    console.log('[N64WASM] ParaLLEl N64 core initialized');
    console.log('[N64WASM] Module object:', Module);

    showStatus('✓ N64 Emulator ready!');

  } catch (error) {
    showError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Start initialization
showStatus('Starting N64WASM...');
initEmulator();
