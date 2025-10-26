// N64WASM Emulator Entry Point
import { checkBrowserCompatibility, loadEmulatorCore } from './emulator/loader';
import { loadAssets, loadROM, startEmulator } from './emulator/rom-loader';

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

    // Load emulator assets (shaders, fonts)
    showStatus('Loading emulator assets...');
    await loadAssets(Module);
    showStatus('Assets loaded ✓');

    // Load Off Road Challenge ROM
    showStatus('Loading ROM...');
    const romInfo = await loadROM(Module, '/offroad.n64');

    showStatus(`ROM loaded: ${romInfo.name} (${(romInfo.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log('[N64WASM] ROM info:', romInfo);

    // Initialize input controller (from N64Wasm)
    if (typeof (window as any).InputController === 'function') {
      (window as any).inputController = new (window as any).InputController();
      console.log('[N64WASM] Input controller initialized');
    } else {
      console.warn('[N64WASM] InputController not available, keyboard input may not work');
    }

    // Start the emulator
    showStatus('Starting emulator...');
    startEmulator(Module, romInfo.path);

    showStatus('✓ Game running!');

    // Log canvas state
    console.log('[N64WASM] Canvas:', {
      width: canvas.width,
      height: canvas.height,
      context: canvas.getContext('webgl2') ? 'WebGL2 available' : 'No WebGL2'
    });

    // Debug: Log keyboard events to verify they're being captured
    document.addEventListener('keydown', (e) => {
      console.log('[Input Debug] Keydown:', e.key, 'Code:', e.code, 'KeyCode:', e.keyCode);
    });

    document.addEventListener('keyup', (e) => {
      console.log('[Input Debug] Keyup:', e.key, 'Code:', e.code);
    });

  } catch (error) {
    showError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Load input controller script dynamically
function loadInputController(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/input_controller.js';
    script.onload = () => {
      console.log('[N64WASM] input_controller.js loaded');
      resolve();
    };
    script.onerror = () => {
      console.error('[N64WASM] Failed to load input_controller.js');
      reject(new Error('Failed to load input_controller.js'));
    };
    document.head.appendChild(script);
  });
}

// Start initialization
showStatus('Starting N64WASM...');
loadInputController()
  .then(() => initEmulator())
  .catch((error) => {
    showError(`Failed to load input controller: ${error.message}`);
  });
