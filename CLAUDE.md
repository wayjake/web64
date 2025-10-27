# N64WASM Challenge

A browser-based Nintendo 64 emulator for running Off Road Challenge using WebAssembly, built with Vite and TypeScript.

## Project Overview

This project aims to deliver a functional N64 emulator in the browser capable of running Off Road Challenge at 30-60 FPS. The MVP focuses on getting the game playable with a hardcoded ROM - no dynamic loading, ROM library, or advanced features.

### Philosophy

Following the "motorcycle not car" approach:
- Fast iteration over perfection
- Get it working first, optimize later
- Simple solutions over complex architecture
- Trial and error is expected and documented

## Technical Stack

### Core Technologies
- **Frontend**: TypeScript + Vite
- **Emulator Core**: Libretro Mupen64Plus-Next (compiled to WebAssembly)
- **Graphics**: GLideN64 video plugin → WebGL2
- **Audio**: SDL2 audio bridge → AudioWorklet
- **Build Tool**: Emscripten
- **Development Server**: Vite with COOP/COEP headers

### Browser APIs
- **WebGL2**: Rendering pipeline
- **AudioWorklet**: Low-latency audio output
- **Gamepad API**: Controller input
- **IndexedDB (IDBFS)**: Save file persistence
- **SharedArrayBuffer**: Threading support (with COOP/COEP)

## Project Structure

```
web64/
├── src/
│   ├── main.ts              # Entry point
│   ├── n64-frontend.ts      # Emulator lifecycle management
│   ├── emulator/
│   │   ├── loader.ts        # WebAssembly module loader
│   │   ├── input.ts         # Gamepad/keyboard mapping
│   │   ├── audio.ts         # AudioWorklet setup
│   │   └── saves.ts         # IDBFS persistence
│   └── ui/
│       ├── canvas.ts        # WebGL2 canvas setup
│       └── controls.ts      # UI controls
├── public/
│   ├── core.js              # Emscripten-generated loader
│   ├── core.wasm            # Compiled emulator core
│   └── assets/
├── wasm/
│   └── build-scripts/       # Emscripten compilation scripts
├── Off Road Challenge (USA).n64  # ROM file (not committed)
├── vite.config.ts           # Vite with COOP/COEP headers
├── CLAUDE.md                # This file
├── TECHNICAL.md             # Troubleshooting log
├── ROADMAP.md               # Milestone task tracker
└── PRD.md                   # Product requirements
```

## Development Setup

### Prerequisites
- Node.js 18+
- Emscripten SDK (for compiling the core)
- Modern browser with WebGL2 support

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file (not needed for MVP):
```bash
# Future: Configuration options
# VITE_ROM_PATH=./path-to-rom.n64
```

## WebAssembly Compilation

### Emscripten Build Flags

The Mupen64Plus-Next core must be compiled with these critical flags:

```bash
emcc -O3 \
  -msimd128 \
  -mrelaxed-simd \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s USE_SDL=2 \
  -s FORCE_FILESYSTEM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["FS","IDBFS","cwrap"]' \
  -s ENVIRONMENT=web \
  -s PTHREAD_POOL_SIZE=4 \
  -o public/core.js
```

### Key Flags Explained
- `-O3`: Maximum optimization
- `-msimd128`: Enable SIMD for performance
- `-s MODULARIZE=1`: ES6 module output
- `-s USE_SDL=2`: SDL2 for audio/video/input
- `-s FORCE_FILESYSTEM=1`: Enable filesystem for ROM loading
- `-s ALLOW_MEMORY_GROWTH=1`: Dynamic memory allocation
- `-s EXPORTED_RUNTIME_METHODS`: Expose FS and IDBFS for saves

## Vite Configuration

### COOP/COEP Headers

**CRITICAL**: SharedArrayBuffer requires these headers for threading:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['core.js'], // Exclude WebAssembly module
  },
});
```

## Emulator Integration

### Module Loading Pattern

```typescript
// src/emulator/loader.ts
import createModule from '../../public/core.js';

export async function loadEmulator() {
  const Module = await createModule({
    canvas: document.getElementById('canvas') as HTMLCanvasElement,
    onRuntimeInitialized: () => {
      console.log('Emulator ready');
    },
  });

  return Module;
}
```

### ROM Loading (Hardcoded for MVP)

```typescript
// src/n64-frontend.ts
export async function loadROM(Module: any) {
  // Fetch the hardcoded ROM
  const response = await fetch('/Off Road Challenge (USA).n64');
  const romData = await response.arrayBuffer();

  // Write to Emscripten filesystem
  const romArray = new Uint8Array(romData);
  Module.FS.writeFile('/rom.n64', romArray);

  // Initialize core with ROM
  Module._retro_load_game('/rom.n64');
}
```

### Save Persistence (IDBFS)

```typescript
// src/emulator/saves.ts
export function setupSaves(Module: any) {
  // Mount IDBFS for persistent saves
  Module.FS.mkdir('/saves');
  Module.FS.mount(Module.IDBFS, {}, '/saves');

  // Load existing saves
  Module.IDBFS.syncfs(true, (err: any) => {
    if (err) console.error('Save load failed:', err);
  });

  // Persist saves on interval
  setInterval(() => {
    Module.IDBFS.syncfs(false, (err: any) => {
      if (err) console.error('Save persist failed:', err);
    });
  }, 10000); // Every 10 seconds
}
```

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| FPS | 30-60 | ≥30 |
| Load Time | <5s to playable | <10s |
| Memory | <512MB | <1GB |
| Bundle Size | <20MB gzipped | <30MB |

## Browser Compatibility

### Tier 1 (MVP Focus)
- Chrome 90+ (macOS/Windows)
- Edge 90+

### Tier 2 (Best Effort)
- Firefox 90+
- Safari 15+ (may require unthreaded mode)

### Known Limitations
- Safari may have SharedArrayBuffer restrictions
- Mobile browsers not optimized in MVP

## Input Mapping

### Keyboard Controls
```
Arrow Keys → D-Pad
Z → A Button
X → B Button
A → L Trigger
S → R Trigger
Enter → Start
```

### Gamepad
- Automatic detection via Gamepad API
- Standard mapping for Xbox/PlayStation controllers

## Audio Configuration

### AudioWorklet Setup
- Sample rate: 48000 Hz
- Buffer size: 4096 samples
- Latency target: <50ms

## Testing Checklist

When testing emulator functionality:

- [ ] ROM loads without errors
- [ ] Canvas displays game frames
- [ ] Audio plays without crackling
- [ ] Keyboard input responds
- [ ] Gamepad connects and responds
- [ ] Game runs at ≥30 FPS
- [ ] Saves persist after page reload
- [ ] No console errors during gameplay

## Common Patterns

### Emulator Lifecycle

```typescript
// 1. Initialize
const Module = await loadEmulator();

// 2. Setup systems
setupSaves(Module);
setupInput(Module);
setupAudio(Module);

// 3. Load ROM
await loadROM(Module);

// 4. Start game loop
Module._retro_run(); // Call per frame
```

### Error Handling

```typescript
try {
  await loadEmulator();
} catch (error) {
  console.error('Emulator failed to load:', error);
  // Show user-friendly error message
  showError('Failed to initialize emulator. Please refresh.');
}
```

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Compile WebAssembly core (when needed)
npm run build:wasm
```

## Troubleshooting

For detailed troubleshooting and solutions, see **TECHNICAL.md**.

Common issues:
- COOP/COEP headers not set → Check Vite config
- WebAssembly load failure → Check Emscripten flags
- Black screen → Check WebGL2 context creation
- No audio → Check AudioWorklet registration
- Poor performance → Check browser profiler

## Milestones

See **ROADMAP.md** for detailed task breakdown.

### MVP Definition
- [x] Vite project scaffold
- [ ] WebAssembly core compiled
- [ ] ROM loads in browser
- [ ] Game renders frames
- [ ] Audio works
- [ ] Input responds
- [ ] Playable at 30+ FPS

## Resources

### Documentation
- [Emscripten Docs](https://emscripten.org/docs/)
- [Libretro API](https://docs.libretro.com/)
- [WebGL2 Spec](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [AudioWorklet Guide](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

### References
- Mupen64Plus-Next: https://github.com/libretro/mupen64plus-libretro-nx
- GLideN64: https://github.com/gonetz/GLideN64
- Emscripten Ports: https://github.com/emscripten-ports

## Git Commit Guidelines

**IMPORTANT**: Always run `npm run build` before committing to ensure there are no build errors.

### Pre-Commit Checklist:
1. Run `npm run build` - verify it completes without errors
2. Review changed files with `git diff`
3. Test functionality if applicable
4. Commit with a clear, descriptive message

Keep commits clean and professional:

```bash
# Pre-commit check
npm run build

# Good commit messages
git commit -m "Add WebAssembly loader module"
git commit -m "Fix audio crackling in AudioWorklet"
git commit -m "Implement IDBFS save persistence"

# Bad (no watermarks or attribution)
git commit -m "Add loader 🤖 Generated with Claude Code"
```

## License & Legal

**IMPORTANT**: This project does NOT distribute ROM files. Users must provide their own legally obtained ROM files. The emulator core (Mupen64Plus-Next) is GPL-licensed.
