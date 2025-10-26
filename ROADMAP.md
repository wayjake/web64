# N64WASM Challenge - Development Roadmap

Track progress through 5 milestones from PRD. Use `[ ]` for incomplete tasks and `[·]` for completed tasks.

---

## M1: Project Scaffold with Vite + Basic Emscripten Loader
**Target**: Week 1
**Goal**: Get the basic project structure running with Vite and a minimal WebAssembly loader.

### Environment Setup
- [·] Install Node.js and npm
- [·] Install Emscripten SDK
- [·] Configure Emscripten environment variables
- [·] Test `emcc` command availability

### Project Initialization
- [·] Create Vite project with TypeScript template
- [·] Configure `vite.config.ts` with COOP/COEP headers
- [·] Set up `tsconfig.json` for strict type checking
- [·] Install necessary dependencies
- [·] Create basic project structure (src/, public/, etc.)

### Basic HTML/Canvas Setup
- [·] Create `index.html` with canvas element
- [·] Add basic CSS for full-screen canvas
- [·] Implement canvas resize handling
- [·] Test canvas renders in browser

### Minimal Emscripten Loader
- [·] Create hello-world C program for testing
- [·] Compile test program to WebAssembly with Emscripten
- [·] Generate `core.js` and `core.wasm` in public/
- [·] Create TypeScript loader module (`src/emulator/loader.ts`)
- [·] Successfully instantiate WebAssembly module in browser
- [·] Verify COOP/COEP headers work (check SharedArrayBuffer availability)

### Documentation
- [·] Create CLAUDE.md with project overview
- [·] Create TECHNICAL.md for troubleshooting
- [·] Create ROADMAP.md (this file)
- [·] Document environment setup in TECHNICAL.md

### Milestone Success Criteria
- [·] Vite dev server runs without errors
- [·] WebAssembly module loads in browser
- [·] Console shows "Module initialized" message
- [·] No CORS or header errors

---

## M2: Libretro Mupen64Plus-Next Builds to WASM
**Target**: Week 2
**Goal**: Compile the actual N64 emulator core to WebAssembly.

### Source Code Acquisition
- [ ] Clone Mupen64Plus-Next repository
- [ ] Clone GLideN64 repository (video plugin)
- [ ] Verify source code structure
- [ ] Review Libretro API integration points

### Build System Setup
- [ ] Create `wasm/` directory for build scripts
- [ ] Write Emscripten build script for Mupen64Plus-Next
- [ ] Configure Emscripten flags from PRD:
  - [ ] `-O3` optimization
  - [ ] `-msimd128` SIMD support
  - [ ] `-s MODULARIZE=1` for ES6 modules
  - [ ] `-s USE_SDL=2` for SDL integration
  - [ ] `-s FORCE_FILESYSTEM=1` for ROM loading
  - [ ] `-s ALLOW_MEMORY_GROWTH=1` for dynamic memory
  - [ ] `-s EXPORTED_RUNTIME_METHODS` for FS/IDBFS

### GLideN64 Integration
- [ ] Compile GLideN64 plugin with Emscripten
- [ ] Link GLideN64 with Mupen64Plus-Next core
- [ ] Verify WebGL2 backend compilation
- [ ] Test GLES → WebGL2 translation layer

### Core Compilation
- [ ] Successfully compile core to `core.wasm`
- [ ] Verify `core.js` loader generated correctly
- [ ] Check WASM file size (should be <10MB)
- [ ] Test module instantiation (may not run yet)

### Libretro API Integration
- [ ] Implement `retro_init()` binding
- [ ] Implement `retro_load_game()` binding
- [ ] Implement `retro_run()` binding
- [ ] Implement `retro_deinit()` binding
- [ ] Create TypeScript wrapper functions

### Troubleshooting
- [ ] Document compilation errors in TECHNICAL.md
- [ ] Document flag combinations that work/don't work
- [ ] Note memory requirements
- [ ] Record build time

### Milestone Success Criteria
- [ ] Core compiles without errors
- [ ] Module loads in browser
- [ ] Libretro API functions callable from TypeScript
- [ ] No missing symbol errors

---

## M3: ROM Loads and Renders Frames
**Target**: Week 3
**Goal**: Load Off Road Challenge ROM and see graphics on screen.

### Filesystem Integration
- [ ] Implement Emscripten FS access in TypeScript
- [ ] Create ROM loading function
- [ ] Copy ROM file to virtual filesystem
- [ ] Verify ROM file accessible to core

### ROM Loading (Hardcoded)
- [ ] Move `Off Road Challenge (USA).n64` to `public/` directory
- [ ] Fetch ROM via `fetch()` API
- [ ] Convert ROM to Uint8Array
- [ ] Write ROM to Emscripten FS (`FS.writeFile`)
- [ ] Call `retro_load_game()` with ROM path
- [ ] Handle load errors gracefully

### WebGL2 Canvas Setup
- [ ] Get WebGL2 context from canvas
- [ ] Verify WebGL2 supported in browser
- [ ] Configure canvas for emulator output
- [ ] Set up proper viewport dimensions (320x240 → canvas size)

### Frame Rendering Pipeline
- [ ] Implement game loop calling `retro_run()`
- [ ] Configure RequestAnimationFrame for smooth rendering
- [ ] Connect Libretro video callback to WebGL
- [ ] Handle frame buffer updates
- [ ] Display first frame from ROM

### Visual Debugging
- [ ] Add FPS counter overlay
- [ ] Add frame time display
- [ ] Log rendering pipeline events
- [ ] Verify frame buffer format (RGB565/RGBA8888)

### Graphics Troubleshooting
- [ ] Document black screen issues in TECHNICAL.md
- [ ] Test different WebGL configurations
- [ ] Verify GLideN64 plugin active
- [ ] Check for GL errors in console

### Milestone Success Criteria
- [ ] ROM loads without errors
- [ ] Canvas displays game graphics
- [ ] Game intro/title screen visible
- [ ] FPS counter shows activity (even if low)

---

## M4: Audio, Input, and Save Persistence Integrated
**Target**: Week 4
**Goal**: Make the game fully playable with sound, controls, and saves.

### Audio Integration

#### AudioWorklet Setup
- [ ] Create `audio-processor.js` worklet file
- [ ] Implement N64 audio buffer processing
- [ ] Register AudioWorklet with AudioContext
- [ ] Connect worklet to destination node

#### SDL Audio Bridge
- [ ] Configure SDL2 audio in Emscripten build
- [ ] Set sample rate: 48000 Hz
- [ ] Set buffer size: 4096 samples
- [ ] Bridge Libretro audio callback to AudioWorklet
- [ ] Test audio playback

#### Audio Debugging
- [ ] Handle browser autoplay policy
- [ ] Add user interaction trigger for audio
- [ ] Monitor audio buffer underruns
- [ ] Fix crackling/popping issues
- [ ] Document audio latency in TECHNICAL.md

### Input System

#### Keyboard Input
- [ ] Create keyboard event listeners
- [ ] Map keys to N64 controller:
  - [ ] Arrow keys → D-Pad
  - [ ] Z → A button
  - [ ] X → B button
  - [ ] A → L trigger
  - [ ] S → R trigger
  - [ ] Enter → Start
- [ ] Send input to Libretro core
- [ ] Test input response in game

#### Gamepad API Integration
- [ ] Listen for `gamepadconnected` event
- [ ] Poll `navigator.getGamepads()` in game loop
- [ ] Map standard gamepad layout to N64
- [ ] Support analog stick input
- [ ] Handle gamepad disconnection
- [ ] Test with Xbox/PlayStation controller

#### Input Debugging
- [ ] Add on-screen input display for debugging
- [ ] Log button presses to console
- [ ] Verify input lag acceptable (<50ms)
- [ ] Document input mapping in TECHNICAL.md

### Save Persistence (IDBFS)

#### IDBFS Setup
- [ ] Create `/saves` directory in Emscripten FS
- [ ] Mount IDBFS to `/saves`
- [ ] Implement save sync on load: `IDBFS.syncfs(true, ...)`
- [ ] Implement save sync on write: `IDBFS.syncfs(false, ...)`

#### Save Integration
- [ ] Configure Mupen64Plus save paths
- [ ] Detect save file writes from core
- [ ] Auto-sync to IndexedDB every 10 seconds
- [ ] Sync on page unload/visibility change
- [ ] Test save/load cycle

#### Save Verification
- [ ] Play game and create save
- [ ] Refresh page and verify save loads
- [ ] Check IndexedDB in DevTools
- [ ] Test save file size and format
- [ ] Document save issues in TECHNICAL.md

### Milestone Success Criteria
- [ ] Game audio plays without crackling
- [ ] Keyboard controls responsive
- [ ] Gamepad detected and functional
- [ ] Saves persist between sessions
- [ ] Can complete a full game session

---

## M5: Stabilization + Documentation Polish
**Target**: Week 5
**Goal**: Optimize performance, fix bugs, and finalize documentation.

### Performance Optimization

#### Profiling
- [ ] Run Chrome Performance profiler during gameplay
- [ ] Identify frame time bottlenecks
- [ ] Measure JavaScript execution time
- [ ] Measure WebGL overhead
- [ ] Monitor memory usage

#### WASM Optimization
- [ ] Verify `-O3` optimization enabled
- [ ] Test SIMD flags: `-msimd128 -mrelaxed-simd`
- [ ] Enable threaded mode if possible (pthreads)
- [ ] Reduce WASM file size (remove debug info)
- [ ] Test different memory settings

#### JavaScript Optimization
- [ ] Minimize allocations in game loop
- [ ] Batch WebGL state changes
- [ ] Optimize audio buffer handling
- [ ] Reduce input polling overhead
- [ ] Profile and optimize hot paths

#### Rendering Optimization
- [ ] Verify vsync alignment
- [ ] Optimize frame buffer copies
- [ ] Test different canvas sizes
- [ ] Implement resolution scaling if needed
- [ ] Document GPU usage in TECHNICAL.md

### Performance Targets
- [ ] Achieve 30 FPS minimum
- [ ] Achieve 60 FPS target (if possible)
- [ ] Load time <5 seconds
- [ ] Memory usage <512MB
- [ ] No frame drops during gameplay

### Bug Fixing

#### Critical Bugs
- [ ] Fix any crashes or hard errors
- [ ] Fix black screen issues
- [ ] Fix audio silence or crackling
- [ ] Fix input not responding
- [ ] Fix saves not persisting

#### Known Issues
- [ ] Document unfixed issues in TECHNICAL.md
- [ ] Create workarounds for Safari issues
- [ ] Note browser compatibility limitations
- [ ] List features not working in MVP

### Browser Testing
- [ ] Test in Chrome (macOS)
- [ ] Test in Chrome (Windows)
- [ ] Test in Edge
- [ ] Test in Firefox
- [ ] Test in Safari (basic functionality)
- [ ] Document compatibility in TECHNICAL.md

### User Experience

#### UI Polish
- [ ] Add loading screen during initialization
- [ ] Show progress during ROM load
- [ ] Add error messages for failures
- [ ] Implement basic control instructions overlay
- [ ] Add mute/unmute button

#### Error Handling
- [ ] Graceful handling of WebAssembly failures
- [ ] User-friendly error messages
- [ ] Fallback for unsupported browsers
- [ ] Recovery from runtime errors
- [ ] Log errors for debugging

### Documentation

#### Code Documentation
- [ ] Add JSDoc comments to key functions
- [ ] Document Emscripten API usage
- [ ] Add inline comments for complex logic
- [ ] Document WebGL pipeline
- [ ] Document audio pipeline

#### Project Documentation
- [ ] Update CLAUDE.md with final architecture
- [ ] Complete TECHNICAL.md with all solutions
- [ ] Update ROADMAP.md with completion status
- [ ] Add performance benchmarks to TECHNICAL.md
- [ ] Create README.md for public release (if applicable)

#### Development Guide
- [ ] Document build process step-by-step
- [ ] Create troubleshooting guide
- [ ] List all dependencies and versions
- [ ] Document environment setup
- [ ] Add contribution guidelines (if open source)

### Final Testing

#### Playthrough Testing
- [ ] Complete game boot to title screen
- [ ] Start a race and complete it
- [ ] Test all menu navigation
- [ ] Create and load save file
- [ ] Test 30+ minutes of continuous play

#### Stress Testing
- [ ] Run for extended period (2+ hours)
- [ ] Monitor memory for leaks
- [ ] Check save file corruption
- [ ] Test rapid input mashing
- [ ] Test tab switch/focus loss

### Milestone Success Criteria
- [ ] All P0 and P1 features working
- [ ] Performance meets targets (30+ FPS)
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Project ready for demo/release

---

## Post-MVP Ideas (Not in Scope)

These are NOT part of the MVP but documented for future consideration:

- [ ] Save state system with thumbnails
- [ ] In-browser ROM library/management
- [ ] CRT shader effects
- [ ] Performance overlay/profiler
- [ ] Touch controls for mobile
- [ ] Multiple ROM support
- [ ] Online multiplayer (netplay)
- [ ] Rewind feature
- [ ] Fast-forward/slow-motion
- [ ] Screenshot/video recording

---

## Success Metrics

Track against PRD targets:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| FPS | 30-60 | TBD | [ ] |
| Load Time | <5s | TBD | [ ] |
| Save Persistence | 100% | TBD | [ ] |
| Bundle Size | <20MB gzipped | TBD | [ ] |
| Browser Compat | Chrome/Edge | TBD | [ ] |

---

## Notes

Add any general notes or observations here:

-
-
-
