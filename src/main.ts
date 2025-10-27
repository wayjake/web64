// N64WASM Emulator Entry Point
import { checkBrowserCompatibility, loadEmulatorCore } from './emulator/loader';
import { loadAssets, loadROM, startEmulator } from './emulator/rom-loader';
import { createAudioSystem, N64AudioSystem } from './emulator/audio';

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const startButton = document.getElementById('startButton') as HTMLButtonElement;

let audioSystem: N64AudioSystem | null = null;
let emulatorReady = false;

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

    // Initialize InputController (from N64Wasm)
    // The compiled binary reads input from window.inputController
    showStatus('Initializing input controller...');
    if (typeof (window as any).InputController === 'function') {
      (window as any).inputController = new (window as any).InputController();
      (window as any).inputController.setupGamePad();
      console.log('[N64WASM] ✓ InputController initialized');

      // Start update loop for InputController (processes gamepad)
      setInterval(() => {
        if ((window as any).inputController) {
          (window as any).inputController.update();
        }
      }, 16); // ~60fps

      showStatus('Input controller ready ✓');
    } else {
      console.warn('[N64WASM] InputController not available - keyboard may not work');
      showStatus('Warning: InputController not loaded');
    }

    // Start the emulator first so we can see the game
    showStatus('Starting emulator...');
    startEmulator(Module, romInfo.path);
    showStatus('Game running (audio starting...)');

    // Initialize audio system - CRITICAL for frame sync!
    showStatus('Initializing audio system...');
    audioSystem = await createAudioSystem(Module, {
      sampleRate: 44100,
      bufferSize: 1024,
      latencyHint: 'interactive',
      volume: 0.5
    });

    console.log('[N64WASM] Audio system initialized:', audioSystem.getStats());

    // Show start button for user to click (required for audio)
    showStatus('Click the button to enable audio');
    startButton.style.display = 'block';
    emulatorReady = true;

    // Wait for user click to resume audio
    startButton.addEventListener('click', async () => {
      startButton.style.display = 'none';

      showStatus('Enabling audio...');
      await audioSystem!.resume();

      console.log('[N64WASM] Audio enabled:', audioSystem!.getStats());

      showStatus('✓ Game running with audio! (Click canvas to focus)');

      // Focus canvas for input - CRITICAL for SDL keyboard events
      canvas.focus();
      console.log('[N64WASM] Canvas focused - keyboard input should work now');
    }, { once: true });

    // Log canvas state
    console.log('[N64WASM] Canvas:', {
      width: canvas.width,
      height: canvas.height,
      context: canvas.getContext('webgl2') ? 'WebGL2 available' : 'No WebGL2'
    });

    // Debug: Check if SDL is receiving events
    console.log('[N64WASM] SDL info:', {
      SDL: typeof (window as any).SDL !== 'undefined' ? 'available' : 'not available',
      Module: typeof Module !== 'undefined' ? 'available' : 'not available'
    });

    // Ensure canvas gets focus when clicked
    canvas.addEventListener('click', () => {
      canvas.focus();
      console.log('[N64WASM] Canvas clicked and focused');
    });

    // Debug: Log keydown events on canvas to verify SDL receives them
    canvas.addEventListener('keydown', (e) => {
      console.log('[Canvas] Keydown:', e.key, '- SDL should receive this');
    });

    // Also log document-level events to compare
    let lastLogTime = 0;
    document.addEventListener('keydown', (e) => {
      const now = Date.now();
      if (now - lastLogTime > 100) {  // Throttle logging
        console.log('[Document] Keydown:', e.key, '- active element:', document.activeElement?.tagName);
        lastLogTime = now;
      }
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
    script.type = 'text/javascript';

    script.onload = () => {
      console.log('[N64WASM] input_controller.js loaded');
      // Wait a bit for class definitions to be available
      setTimeout(resolve, 100);
    };

    script.onerror = (error) => {
      console.error('[N64WASM] Failed to load input_controller.js:', error);
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
