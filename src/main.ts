// N64WASM Emulator Entry Point
import { checkBrowserCompatibility, loadEmulatorCore } from './emulator/loader';
import { loadAssets, loadROM, startEmulator } from './emulator/rom-loader';
import { createAudioSystem, N64AudioSystem } from './emulator/audio';
import { StatsToolbar } from './ui/stats-toolbar';

// Limit console log buffer to prevent memory leaks
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
let logCount = 0;
const MAX_LOGS = 1000; // Clear console after 1000 logs

console.log = (...args: any[]) => {
  logCount++;
  if (logCount > MAX_LOGS) {
    console.clear();
    logCount = 0;
    originalConsoleLog('[Console] Cleared to prevent memory leak');
  }
  originalConsoleLog(...args);
};

console.warn = (...args: any[]) => {
  logCount++;
  if (logCount > MAX_LOGS) {
    console.clear();
    logCount = 0;
  }
  originalConsoleWarn(...args);
};

const statusEl = document.getElementById('status') as HTMLParagraphElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

let audioSystem: N64AudioSystem | null = null;
let statsToolbar: StatsToolbar | null = null;

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
    try {
      audioSystem = await createAudioSystem(Module, {
        sampleRate: 44100,
        bufferSize: 1024,
        latencyHint: 'interactive',
        volume: 0.5
      });
      console.log('[N64WASM] Audio system initialized:', audioSystem.getStats());
    } catch (audioError) {
      console.error('[N64WASM] Audio system initialization failed:', audioError);
      throw audioError;
    }

    // Initialize stats toolbar
    statsToolbar = new StatsToolbar();
    statsToolbar.setAudioSystem(audioSystem);

    // Update stats toolbar periodically (audio system provides the actual FPS)
    setInterval(() => {
      if (statsToolbar) {
        statsToolbar.forceUpdate();
      }
    }, 500); // Update display every 500ms

    console.log('[N64WASM] Stats toolbar initialized');

    // Memory monitoring - log memory usage every 30 seconds to detect leaks
    if ((performance as any).memory) {
      setInterval(() => {
        const mem = (performance as any).memory;
        const usedMB = (mem.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const limitMB = (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
        const percent = ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1);
        console.log(`[Memory] ${usedMB} MB / ${limitMB} MB (${percent}%)`);

        // Warn if memory usage is high
        if (mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.8) {
          console.warn('[Memory] WARNING: High memory usage detected!');
        }
      }, 30000); // Every 30 seconds
    }

    // Resume audio - requires user interaction due to browser autoplay policy
    showStatus('Click anywhere to start...');

    const startAudio = async () => {
      await audioSystem!.resume();
      console.log('[N64WASM] Audio enabled:', audioSystem!.getStats());
      showStatus('✓ Game running!');
    };

    document.addEventListener('click', startAudio, { once: true });
    document.addEventListener('keydown', startAudio, { once: true });

    // Focus canvas for input - CRITICAL for SDL keyboard events
    canvas.focus();
    console.log('[N64WASM] Canvas focused - keyboard input should work now');

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
    });

    // Volume control keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!audioSystem || !statsToolbar) return;

      // Volume controls (only handle if not focused on canvas to avoid conflicts)
      if (document.activeElement !== canvas) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          const currentVolume = audioSystem.getVolume();
          const newVolume = Math.min(1.0, currentVolume + 0.1);
          audioSystem.setVolume(newVolume);
          statsToolbar.forceUpdate();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const currentVolume = audioSystem.getVolume();
          const newVolume = Math.max(0.0, currentVolume - 0.1);
          audioSystem.setVolume(newVolume);
          statsToolbar.forceUpdate();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          const currentVolume = audioSystem.getVolume();
          if (currentVolume > 0) {
            audioSystem.setVolume(0);
          } else {
            audioSystem.setVolume(0.5);
          }
          statsToolbar.forceUpdate();
        }
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
