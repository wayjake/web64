// WebAssembly Module Loader
// Handles loading and initialization of Emscripten-compiled modules

export interface EmscriptenModule {
  // Module initialization
  onRuntimeInitialized?: () => void;

  // Canvas for rendering
  canvas?: HTMLCanvasElement;

  // Memory and file system
  FS?: any;
  IDBFS?: any;

  // Core functions (will be populated by Emscripten)
  ccall?: (name: string, returnType: string, argTypes: string[], args: any[]) => any;
  cwrap?: (name: string, returnType: string, argTypes: string[]) => Function;

  // Custom exports from our C code
  _add?: (a: number, b: number) => number;
  _hello_world?: () => void;
  _main?: () => number;
}

export type ModuleFactory = (config: Partial<EmscriptenModule>) => Promise<EmscriptenModule>;

/**
 * Load the test WebAssembly module (hello.js)
 * Files in /public are served as static assets, so we load them via script tag
 */
export async function loadTestModule(): Promise<EmscriptenModule> {
  return new Promise((resolve, reject) => {
    // Set up the Module config on the window before loading the script
    // Emscripten will use this config when it initializes
    (window as any).Module = {
      onRuntimeInitialized: function() {
        console.log('[Loader] Test module initialized');
        // Resolve with the Module object which now has all the WASM exports
        resolve((window as any).Module as EmscriptenModule);
      }
    };

    try {
      // Load the Emscripten-generated JS file via script tag
      const script = document.createElement('script');
      script.src = '/hello.js';
      script.async = true;

      script.onerror = (error) => {
        reject(new Error(`Failed to load hello.js: ${error}`));
      };

      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Load the full emulator core (core.js) - for future use
 */
export async function loadEmulatorCore(canvas: HTMLCanvasElement): Promise<EmscriptenModule> {
  return new Promise((resolve, reject) => {
    // Set up the Module config on the window before loading the script
    (window as any).Module = {
      canvas,
      onRuntimeInitialized: function() {
        console.log('[Loader] Emulator core initialized');
        resolve((window as any).Module as EmscriptenModule);
      }
    };

    try {
      // Load the Emscripten-generated JS file via script tag
      const script = document.createElement('script');
      script.src = '/core.js';
      script.async = true;

      script.onerror = (error) => {
        reject(new Error(`Failed to load core.js: ${error}`));
      };

      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Test if the browser supports required features
 */
export function checkBrowserCompatibility(): {
  supported: boolean;
  features: Record<string, boolean>;
  warnings: string[];
} {
  const features = {
    webgl2: !!document.createElement('canvas').getContext('webgl2'),
    webassembly: typeof WebAssembly !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    audioWorklet: typeof AudioWorklet !== 'undefined',
    gamepad: typeof navigator.getGamepads === 'function',
  };

  const warnings: string[] = [];

  if (!features.sharedArrayBuffer) {
    warnings.push('SharedArrayBuffer not available - threading will be disabled');
  }

  if (!features.audioWorklet) {
    warnings.push('AudioWorklet not available - may use fallback audio');
  }

  if (!features.gamepad) {
    warnings.push('Gamepad API not available - only keyboard controls');
  }

  const supported = features.webgl2 && features.webassembly;

  return { supported, features, warnings };
}
