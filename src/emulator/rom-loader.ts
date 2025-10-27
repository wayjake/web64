// ROM Loader for N64 Emulator
// Handles loading ROM files into Emscripten's virtual filesystem

import type { EmscriptenModule } from './loader';

export interface ROMInfo {
  name: string;
  path: string;
  size: number;
}

/**
 * Load required assets (shaders, fonts, etc.) for the emulator
 */
export async function loadAssets(Module: EmscriptenModule): Promise<void> {
  console.log('[ROM Loader] Loading emulator assets...');

  const response = await fetch('/assets.zip');
  if (!response.ok) {
    throw new Error(`Failed to fetch assets: ${response.status}`);
  }

  const assetsData = await response.arrayBuffer();
  const assetsArray = new Uint8Array(assetsData);

  console.log('[ROM Loader] Assets fetched:', {
    size: `${(assetsData.byteLength / 1024).toFixed(2)} KB`
  });

  // Write assets to FS
  const FS = Module.FS || (window as any).FS;
  if (!FS) {
    throw new Error('FS not available for assets');
  }

  FS.writeFile('assets.zip', assetsArray);
  console.log('[ROM Loader] Assets written to FS');
}

/**
 * Load a ROM file from the server and write it to Emscripten's filesystem
 */
export async function loadROM(Module: EmscriptenModule, romPath: string): Promise<ROMInfo> {
  console.log('[ROM Loader] Fetching ROM:', romPath);

  // Fetch the ROM file
  const response = await fetch(romPath);

  if (!response.ok) {
    throw new Error(`Failed to fetch ROM: ${response.status} ${response.statusText}`);
  }

  // Get the ROM data as ArrayBuffer
  const romData = await response.arrayBuffer();
  const romArray = new Uint8Array(romData);

  console.log('[ROM Loader] ROM fetched:', {
    size: `${(romData.byteLength / 1024 / 1024).toFixed(2)} MB`,
    bytes: romData.byteLength
  });

  // Write ROM to Emscripten's virtual filesystem
  const virtualPath = '/offroad.n64';

  // Check if FS is available
  if (!Module.FS) {
    console.error('[ROM Loader] Module.FS not available, checking window.FS');

    // Try global FS as fallback
    if (typeof (window as any).FS === 'undefined') {
      throw new Error('Emscripten FS not available - runtime may not be initialized');
    }

    // Use global FS
    (window as any).FS.writeFile(virtualPath, romArray);
  } else {
    Module.FS.writeFile(virtualPath, romArray);
  }

  console.log('[ROM Loader] ROM written to virtual FS:', virtualPath);

  return {
    name: 'Off Road Challenge',
    path: virtualPath,
    size: romData.byteLength
  };
}

/**
 * Write emulator configuration file
 */
function writeConfigFile(Module: EmscriptenModule): void {
  console.log('[ROM Loader] Writing config file...');

  const FS = Module.FS || (window as any).FS;
  if (!FS) {
    throw new Error('FS not available for config');
  }

  // Create a basic config with keyboard mappings
  // Format: each line is a key mapping or setting
  const configLines = [
    // Gamepad mappings (using defaults - we'll add proper gamepad support later)
    ...Array(11).fill('0'),  // 11 gamepad mappings (all disabled for now)

    // Keyboard mappings (SDL scancodes)
    '5',    // B (D-Pad Left)
    '17',   // N (D-Pad Right)
    '28',   // Y (D-Pad Up)
    '11',   // H (D-Pad Down)
    '40',   // Enter (Start)
    '12',   // I (C-Up)
    '14',   // K (C-Down)
    '13',   // J (C-Left)
    '15',   // L (C-Right)
    '7',    // D (A button)
    '20',   // Q (L trigger)
    '8',    // E (R trigger)
    '22',   // S (B button)
    '6',    // C (unused)
    '41',   // Escape (Menu)
    '82',   // Up Arrow (Analog Up)
    '81',   // Down Arrow (Analog Down)
    '80',   // Left Arrow (Analog Left)
    '79',   // Right Arrow (Analog Right)

    // Save file flags (0 = no save data)
    '0',    // EEP
    '0',    // SRA
    '0',    // FLA

    // Show FPS (0 = off, 1 = on)
    '0',

    // Swap sticks (0 = normal)
    '0'
  ];

  const configString = configLines.join('\r\n');
  FS.writeFile('config.txt', configString);

  console.log('[ROM Loader] Config file written');
}

/**
 * Start the game loop using requestAnimationFrame
 */
function startGameLoop(Module: EmscriptenModule): void {
  console.log('[ROM Loader] Starting game loop...');

  let lastFrameTime = performance.now();
  const targetFrameTime = 1000 / 60; // Target 30fps (N64's typical frame rate)

  const gameLoop = (currentTime: number) => {
    // Calculate time since last frame
    const deltaTime = currentTime - lastFrameTime;

    // Only run emulator frame if enough time has passed
    if (deltaTime >= targetFrameTime) {
      // Run one frame of the emulator
      (Module as any)._runMainLoop();

      lastFrameTime = currentTime - (deltaTime % targetFrameTime);
    }

    // Schedule next frame
    requestAnimationFrame(gameLoop);
  };

  // Start the loop
  requestAnimationFrame(gameLoop);

  console.log('[ROM Loader] Game loop running at ~30fps');
}

/**
 * Start the emulator with the loaded ROM
 */
export function startEmulator(Module: EmscriptenModule, romPath: string): void {
  console.log('[ROM Loader] Starting emulator with ROM:', romPath);

  // Write configuration file before starting
  writeConfigFile(Module);

  if (!Module.callMain) {
    throw new Error('Module.callMain not available');
  }

  try {
    // Call the emulator's main function with the ROM path
    // This initializes the emulator but does NOT start the game loop
    console.log('[ROM Loader] Calling Module.callMain with args:', [romPath]);
    const result = Module.callMain([romPath]);
    console.log('[ROM Loader] callMain returned:', result);
  } catch (error) {
    console.error('[ROM Loader] callMain error:', error);
    throw error;
  }

  // Start the game loop
  startGameLoop(Module);

  console.log('[ROM Loader] Emulator started!');
}
