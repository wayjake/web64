# Technical Notes & Troubleshooting

A living document for tracking issues, attempted solutions, and what actually worked during development of the N64WASM emulator.

## Purpose

This is a trial-and-error project. Document everything here:
- Problems encountered
- Solutions attempted (even if they failed)
- What actually worked
- Configuration details that matter
- Performance insights

## Issue Template

When logging a new issue, use this format:

```markdown
### Issue: [Brief description]
**Date**: YYYY-MM-DD
**Category**: [Compilation | Headers | Rendering | Audio | Input | Memory | Performance | Other]

**Problem**:
Clear description of what's broken or not working.

**Context**:
- Browser: Chrome 120 / Safari 17 / etc.
- Environment: Development / Production build
- Error message: [if applicable]

**Attempted Solutions**:
1. First thing tried - Result: Failed/Partial success
2. Second approach - Result: Failed/Partial success
3. etc.

**What Worked**:
Final solution that resolved the issue.

**Code/Config Changes**:
```typescript
// Relevant code snippets or config
```

**Learnings**:
Key takeaways or things to remember for future.
```

---

## Known Issues & Solutions

### Issue: Emscripten Compiler Crash on debugger.c
**Date**: 2025-10-26
**Category**: Compilation

**Problem**:
Emscripten's clang compiler (version 22.0.0git) crashes with exit code 133 when compiling `mupen64plus-core/src/api/debugger.c`. The crash occurs during code generation phase in the AsmPrinter::emitGlobalVariable function.

**Context**:
- Platform: macOS (Darwin 23.6.0)
- Emscripten: 4.0.18
- Error: `clang: error: clang frontend command failed with exit code 133`
- Build command: `make platform=emscripten GLES=1`

**Attempted Solutions**:
1. **Reduce optimization level** (`DEBUG=1` for `-O0` instead of `-O3`) - Result: **Failed** - Same crash occurred
2. **Different compiler flags** - Result: **Failed** - Crash persisted with various flag combinations

**What Worked**:
Excluded the debugger.c file from the build by commenting it out in `Makefile.common` line 41. The debugger functionality is not required for the MVP emulator to run games.

**Code/Config Changes**:
```diff
# Makefile.common line 37-42
SOURCES_C = \
	$(CORE_DIR)/src/asm_defines/asm_defines.c \
	$(CORE_DIR)/src/api/callbacks.c \
	$(ROOT_DIR)/custom/mupen64plus-core/api/config.c \
-	$(CORE_DIR)/src/api/debugger.c \
	$(CORE_DIR)/src/api/frontend.c \
```

**Learnings**:
- Emscripten's LLVM-based compiler can have crashes on complex C codebases
- The N64 emulator core's debugger module is optional for basic emulation
- When hitting compiler crashes, check if the problematic module is actually needed for the MVP
- The "motorcycle not car" approach applies here - ship without debugger, add it later if needed

---

### Issue: Emscripten Compiler Crash on main.c (BLOCKER)
**Date**: 2025-10-26
**Category**: Compilation

**Problem**:
Emscripten's clang compiler (version 22.0.0git / 4.0.18) consistently crashes with exit code 133 when compiling `mupen64plus-core/src/main/main.c`. The crash occurs in the same location as debugger.c - during code generation in `AsmPrinter::emitGlobalVariable`. Unlike debugger.c which is optional, main.c is a critical core file and cannot simply be excluded.

**Context**:
- Platform: macOS (Darwin 23.6.0)
- Emscripten: 4.0.18 (Homebrew)
- Target: wasm32-unknown-emscripten
- Error: `clang: error: clang frontend command failed with exit code 133`
- File: `mupen64plus-core/src/main/main.c`

**Attempted Solutions**:
1. **Excluded debugger.c** - Result: **Partial** - Fixed that specific file but main.c still crashes
2. **Reduce optimization to `-O2`** - Result: **Failed** - Still crashes in same location
3. **Reduce optimization to `-O0` (DEBUG=1)** - Result: **Failed** - Crashes regardless of optimization level

**What Didn't Work**:
Cannot compile Mupen64Plus-Next core with current Emscripten version due to persistent compiler bugs. The crashes appear to be in Emscripten's LLVM backend when generating WebAssembly code for certain large/complex C files.

**Next Steps / Alternatives**:
1. **Try different Emscripten version** - Older/newer versions might not have this bug
2. **Use pre-compiled WASM cores** - RetroArch/libretro might have pre-built WASM cores
3. **Try different N64 core** - Look for simpler N64 emulators (e.g., simple64, n64js)
4. **Compile on different platform** - Try Linux or use GitHub Actions with different Emscripten version
5. **Report bug to Emscripten** - This appears to be a legitimate compiler bug

**Learnings**:
- Emscripten is still evolving and can have bugs with complex C codebases
- Large emulator projects may need specific Emscripten versions to compile successfully
- The libretro Mupen64Plus-Next core, while feature-rich, may be too complex for current Emscripten
- MVP approach: might need to start with a simpler core or use pre-built binaries

**Status**: ⚠️ **BLOCKED** - Cannot proceed with this approach without resolving compiler crashes

**Resolution**: See alternative approach using ParaLLEl N64 core below.

---

### Solution: Using Pre-Compiled ParaLLEl N64 Core
**Date**: 2025-10-26
**Category**: Compilation

**Problem**:
After hitting a blocker with Mupen64Plus-Next compilation crashes, needed to find an alternative N64 emulator core that's already compiled to WebAssembly.

**Research Findings**:

1. **RetroArch Web Player**:
   - RetroArch has a web player but currently does NOT support Mupen64Plus N64 core
   - Website: https://web.libretro.com/
   - Buildbot at https://buildbot.libretro.com/nightly/emscripten/ contains full RetroArch builds (~750MB 7z archives)
   - Individual cores are bundled inside these archives, not available separately

2. **N64Wasm Project** (SOLUTION FOUND):
   - Repository: https://github.com/jmallyhakker/N64Wasm
   - Live demo: https://jmallyhakker.github.io/N64Wasm/
   - Uses **ParaLLEl N64 core** from libretro (https://github.com/libretro/parallel-n64)
   - Successfully compiled with **Emscripten 2.0.7** (older version than our 4.0.18)
   - Pre-compiled WASM files available in `/dist` directory

**Pre-Compiled Core Details**:
- **n64wasm.js** (250KB) - Emscripten loader
- **n64wasm.wasm** (2.0MB) - Compiled ParaLLEl N64 core
- Much smaller than Mupen64Plus-Next
- Tested and working in production at their demo site

**Integration Pattern**:
```javascript
// From N64Wasm project - script.js line ~1260
var Module = {};
Module['canvas'] = document.getElementById('canvas');
window['Module'] = Module;

// Load the core
var script = document.createElement('script');
script.src = 'n64wasm.js';
document.head.appendChild(script);
```

**What Worked**:
Successfully cloned N64Wasm repository and extracted pre-compiled ParaLLEl core files. These can be integrated into our project as a working MVP alternative to compiling Mupen64Plus-Next from source.

**Code Location**:
Pre-compiled core files located at:
```
/Users/jacobberg/Web/web64/wasm/N64Wasm/dist/n64wasm.js
/Users/jacobberg/Web/web64/wasm/N64Wasm/dist/n64wasm.wasm
```

**Learnings**:
- ParaLLEl N64 is a simpler alternative to Mupen64Plus-Next
- Older Emscripten versions (2.0.7) may be more stable for complex projects than bleeding-edge (4.0.18)
- Pre-compiled cores are a valid MVP approach - get it working first, compile from source later
- N64Wasm project demonstrates successful browser-based N64 emulation
- The "motorcycle not car" philosophy: use what works, iterate later

**Next Steps**:
1. Copy pre-compiled core files to our project's `/public` directory
2. Adapt our TypeScript loader to use ParaLLEl core instead of Mupen64Plus
3. Test ROM loading with Off Road Challenge
4. If needed, can compile ParaLLEl from source later with Emscripten 2.0.7

---

### Issue: Emscripten SDK Installation
**Date**: 2025-10-26
**Category**: Compilation

**Problem**:
Need to compile Mupen64Plus-Next to WebAssembly but unclear on Emscripten setup.

**Solution**:
```bash
# Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

**Learnings**:
- Must run `source ./emsdk_env.sh` in each new terminal session
- Add to `.zshrc` or `.bashrc`: `source ~/path/to/emsdk/emsdk_env.sh`

---

### Issue: COOP/COEP Headers Not Working
**Date**: [Pending]
**Category**: Headers

**Problem**:
SharedArrayBuffer unavailable, threading not working.

**Attempted Solutions**:
- Check browser console for: `SharedArrayBuffer is not defined`
- Verify headers in Network tab

**What to Check**:
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

**Learnings**:
- Headers must be exact: `same-origin` and `require-corp`
- Check Network tab → Response Headers to verify
- If headers missing, SharedArrayBuffer won't be available

---

### Issue: WebAssembly Module Load Failure
**Date**: [Pending]
**Category**: Compilation

**Problem**:
`core.wasm` fails to load or instantiate.

**Potential Causes**:
1. Missing Emscripten flags during compilation
2. MIME type issues on server
3. CORS issues with WebAssembly

**What to Try**:
```typescript
// Check Vite config for WASM handling
export default defineConfig({
  optimizeDeps: {
    exclude: ['core.js'], // Exclude WASM module from optimization
  },
  server: {
    fs: {
      strict: false, // Allow serving files outside root
    },
  },
});
```

**Check Browser Console**:
- Look for: `WebAssembly.instantiateStreaming failed`
- Network tab: Verify `core.wasm` returns 200 status
- Check MIME type: Should be `application/wasm`

---

### Issue: Black Screen / No Rendering
**Date**: [Pending]
**Category**: Rendering

**Problem**:
Canvas element exists but shows black screen.

**Debugging Steps**:
1. Check WebGL2 context creation:
```typescript
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');
if (!gl) {
  console.error('WebGL2 not supported');
}
```

2. Verify GLideN64 plugin is included in WASM build

3. Check Emscripten canvas settings:
```typescript
const Module = await createModule({
  canvas: canvas,
  printErr: (text) => console.error(text),
  print: (text) => console.log(text),
});
```

4. Look for GL errors in console

**Learnings**:
- WebGL2 is REQUIRED (WebGL1 won't work)
- Canvas must be passed to Emscripten Module on init
- Check browser GPU acceleration is enabled

---

### Issue: Audio Crackling or Silence
**Date**: [Pending]
**Category**: Audio

**Problem**:
No audio output or audio has crackling/popping.

**Checklist**:
- [ ] AudioWorklet file registered correctly
- [ ] Sample rate matches: 48000 Hz
- [ ] Buffer size appropriate: 4096 samples
- [ ] SDL2 audio compiled in WASM build

**Code to Try**:
```typescript
// Register AudioWorklet
const audioContext = new AudioContext({ sampleRate: 48000 });
await audioContext.audioWorklet.addModule('/audio-processor.js');

const workletNode = new AudioWorkletNode(audioContext, 'n64-audio-processor');
workletNode.connect(audioContext.destination);
```

**Potential Issues**:
- Browser autoplay policy (audio won't start until user interaction)
- Buffer underruns causing crackling
- Incorrect SDL2 configuration

**Learnings**:
- Always check `audioContext.state === 'running'`
- May need user click to start: `audioContext.resume()`

---

### Issue: Gamepad Not Detected
**Date**: [Pending]
**Category**: Input

**Problem**:
Gamepad API not detecting controller.

**Debugging**:
```typescript
window.addEventListener('gamepadconnected', (e) => {
  console.log('Gamepad connected:', e.gamepad);
});

// Poll in game loop
const gamepads = navigator.getGamepads();
if (gamepads[0]) {
  console.log('Button states:', gamepads[0].buttons);
}
```

**Known Issues**:
- Chrome requires gamepad interaction before detection
- Safari has limited Gamepad API support
- Must poll `navigator.getGamepads()` each frame

**Mapping Example**:
```typescript
// Standard gamepad mapping
const buttonMap = {
  0: 'A',      // Bottom button
  1: 'B',      // Right button
  2: 'X',      // Left button
  3: 'Y',      // Top button
  12: 'Up',    // D-pad up
  13: 'Down',  // D-pad down
  14: 'Left',  // D-pad left
  15: 'Right', // D-pad right
};
```

---

### Issue: Poor Performance / Low FPS
**Date**: [Pending]
**Category**: Performance

**Problem**:
Game running below 30 FPS.

**Profiling Steps**:
1. Open Chrome DevTools → Performance tab
2. Record while playing
3. Look for:
   - Long frames (>33ms for 30 FPS)
   - JavaScript execution time
   - WebGL calls

**Optimization Ideas**:
1. Enable SIMD in Emscripten build: `-msimd128 -mrelaxed-simd`
2. Use threaded mode if SharedArrayBuffer available
3. Reduce WebGL overhead:
   - Batch draw calls
   - Minimize state changes
4. Check Emscripten optimization level: `-O3`

**Browser Settings**:
- Enable hardware acceleration
- Close other tabs
- Check Activity Monitor for CPU usage

**Learnings**:
- First optimize the WASM build, then JS code
- Profile before optimizing (don't guess)

---

### Issue: IDBFS Save Persistence Not Working
**Date**: [Pending]
**Category**: Memory

**Problem**:
Saves not persisting between sessions.

**Verification**:
```typescript
// Check if IDBFS mounted correctly
console.log(Module.FS.readdir('/saves'));

// Manual sync test
Module.IDBFS.syncfs(false, (err) => {
  if (err) console.error('Sync failed:', err);
  else console.log('Save synced to IndexedDB');
});
```

**Check Browser DevTools**:
- Application tab → IndexedDB
- Look for database created by Emscripten
- Verify save files exist

**Common Mistakes**:
- Forgot to call `IDBFS.syncfs(true, callback)` on load
- Forgot to call `IDBFS.syncfs(false, callback)` on save
- Wrong mount path

**Correct Setup**:
```typescript
// On init - load saves
Module.FS.mkdir('/saves');
Module.FS.mount(Module.IDBFS, {}, '/saves');
Module.IDBFS.syncfs(true, (err) => {
  if (err) console.error('Load failed:', err);
});

// On save event - persist
Module.IDBFS.syncfs(false, (err) => {
  if (err) console.error('Persist failed:', err);
});
```

---

### Issue: Memory Errors / Out of Memory
**Date**: [Pending]
**Category**: Memory

**Problem**:
`Out of memory` error or page crashes.

**Causes**:
1. WASM memory limit hit (default 2GB)
2. Memory leak in game loop
3. ROM too large

**Solutions**:
```bash
# In Emscripten build, allow memory growth
-s ALLOW_MEMORY_GROWTH=1
-s MAXIMUM_MEMORY=4GB
```

**Monitoring**:
```typescript
// Log memory usage
console.log('HEAP size:', Module.HEAP8.length);
console.log('Used:', Module._emscripten_get_heap_size());
```

**Learnings**:
- N64 ROMs typically 8-64MB (should be fine)
- Memory growth has performance cost
- Check for memory leaks with Chrome Memory Profiler

---

### Issue: Safari Compatibility
**Date**: [Pending]
**Category**: Other

**Problem**:
Works in Chrome, broken in Safari.

**Known Safari Limitations**:
- SharedArrayBuffer requires additional headers
- Gamepad API limited support
- WebGL2 performance worse than Chrome
- AudioWorklet may have issues

**Safari-Specific Checks**:
1. Test in unthreaded mode (disable pthreads)
2. Check console for specific Safari errors
3. Verify WebGL2 available: `!!canvas.getContext('webgl2')`

**Fallback Strategy**:
```typescript
const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
if (!hasSharedArrayBuffer) {
  console.warn('Threading disabled, using fallback');
  // Load unthreaded WASM build
}
```

---

## Configuration Reference

### Working Emscripten Flags

```bash
emcc -O3 \
  -msimd128 \
  -mrelaxed-simd \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s USE_SDL=2 \
  -s FORCE_FILESYSTEM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=128MB \
  -s MAXIMUM_MEMORY=2GB \
  -s EXPORTED_RUNTIME_METHODS='["FS","IDBFS","cwrap","ccall"]' \
  -s ENVIRONMENT=web \
  -s PTHREAD_POOL_SIZE=4 \
  -s OFFSCREENCANVAS_SUPPORT=1 \
  -o public/core.js
```

### Working Vite Config

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      strict: false,
    },
  },
  optimizeDeps: {
    exclude: ['core.js'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          emulator: ['./public/core.js'],
        },
      },
    },
  },
});
```

---

## Performance Benchmarks

Track performance over time:

| Date | Chrome FPS | Safari FPS | Load Time | Notes |
|------|------------|------------|-----------|-------|
| TBD  | -          | -          | -         | Baseline |

---

## Useful Resources

### Debugging
- Chrome DevTools: chrome://inspect
- WebGL Report: https://webglreport.com/
- Emscripten Debugging: `emcc -g4` (source maps)

### Communities
- Libretro Discord
- Emscripten GitHub Issues
- WebAssembly Discord

### Tools
- WebAssembly Binary Toolkit (WABT): https://github.com/WebAssembly/wabt
- Chrome Performance Monitor: chrome://inspect/#devices

---

## Notes Section

Random notes and observations:

- N64 has 4MB RAM (RDRAM)
- RSP (Reality Signal Processor) handles 3D transform
- RDP (Reality Display Processor) handles rasterization
- GLideN64 emulates RDP in software
- Off Road Challenge uses microcode: F3DEX

---

---

### Issue: ParaLLEl Core Integration - Module Initialization Failures
**Date**: 2025-10-26
**Category**: Compilation | Module Loading

**Problem**:
After copying pre-compiled ParaLLEl N64 core files (`n64wasm.js` and `n64wasm.wasm`) to our project, multiple initialization issues occurred:

1. **Initial Error**: `Aborted(Assertion failed: undefined)`
   - Module loading completed but asserted immediately
   - No clear indication of what assertion failed

2. **Memory Configuration Error**:
   ```
   Aborted(Cannot enlarge memory arrays to size 25186304 bytes (OOM).
   Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value 16777216,
   (2) compile with -sALLOW_MEMORY_GROWTH, or (3) if you want malloc to return NULL (0)
   instead of this abort, compile with -sABORTING_MALLOC=0)
   ```
   - Core requires 25MB but only has 16MB available
   - `ALLOW_MEMORY_GROWTH` not enabled in compilation

3. **Filesystem/ROM Loading Issue** (Current):
   ```
   fopen(n64wasm.data, rb): No such file or directory
   Aborted(Assertion failed: undefined)
   ```
   - Module expects a `.data` file that wasn't copied
   - Data file likely contains assets or configuration

**Context**:
- Browser: Chrome (latest)
- Environment: Development (Vite dev server)
- Files copied: `n64wasm.js`, `n64wasm.wasm`
- Files NOT copied initially: `n64wasm.data`
- Working example: https://jmallyhakker.github.io/N64Wasm/

**Attempted Solutions**:

1. **Basic module loading** - Result: **Failed** - Assertion errors
   ```typescript
   import createModule from '/n64wasm.js';
   const Module = await createModule({
     canvas: document.getElementById('canvas'),
   });
   ```

2. **Added preRun memory configuration** - Result: **Partial Success** - Fixed memory error but revealed data file issue
   ```typescript
   const Module = await createModule({
     canvas: document.getElementById('canvas'),
     preRun: [(module: any) => {
       module.ENV = {
         SDL_EMSCRIPTEN_KEYBOARD_ELEMENT: '#canvas'
       };
     }],
     INITIAL_MEMORY: 33554432, // 32MB
   });
   ```

3. **Need to investigate**: Working example's full initialization pattern

**Files in N64Wasm dist directory**:
```
/Users/jacobberg/Web/web64/wasm/N64Wasm/dist/
├── n64wasm.js      ✅ Copied
├── n64wasm.wasm    ✅ Copied
├── n64wasm.data    ❌ NOT copied (just discovered)
└── index.html      (reference implementation)
```

**What's Missing**:
- `n64wasm.data` file - likely contains Emscripten virtual filesystem data
- Full understanding of N64Wasm initialization sequence
- Comparison between our initialization vs their working example

**Next Steps**:
1. ✅ Copy `n64wasm.data` to `/public/` directory
2. Deep dive into N64Wasm's `script.js` and `index.html` to understand full initialization
3. Compare Module configuration options between working example and ours
4. Test with all three files present

**Learnings So Far**:
- Emscripten modules often come with `.data` files containing virtual filesystem
- Memory configuration must match compilation settings (can't override at runtime easily)
- Need to study working examples thoroughly before adapting code
- Missing files cause cryptic "assertion failed" errors

**Status**: 🔄 **In Progress** - Need to analyze working example initialization

---

### Deep Dive: N64Wasm vs Our Implementation Pattern Comparison
**Date**: 2025-10-26
**Category**: Module Loading

**Analysis Complete**: After analyzing the working N64Wasm project, here are the key differences in initialization patterns:

#### N64Wasm's Working Pattern (script.js):

1. **Module Setup (Before Script Load)**:
```javascript
// Line 15-17: Initial setup in constructor
var Module = {};
Module['canvas'] = document.getElementById('canvas');
window['Module'] = Module;

// Lines 1254-1259: Configuration before script load
window["Module"] = {
    onRuntimeInitialized: myClass.initModule,
    canvas: document.getElementById('canvas'),
    print: (text) => myClass.processPrintStatement(text),
}

// Lines 1261-1263: Dynamic script loading
var script = document.createElement('script');
script.src = 'n64wasm.js'
document.getElementsByTagName('head')[0].appendChild(script);
```

2. **Module Type**: Non-modular (global)
   - `n64wasm.js` was compiled **WITHOUT** `-s MODULARIZE=1`
   - Script modifies `window.Module` in place
   - No `export` or `createModule()` function

3. **Initialization Flow**:
   ```
   1. Set window.Module = { canvas, onRuntimeInitialized, ... }
   2. Load n64wasm.js via <script> tag
   3. Emscripten finds window.Module and uses it
   4. Calls onRuntimeInitialized when ready
   5. Access Module methods via window.Module
   ```

4. **Runtime Initialization**:
```javascript
// Line 522: Simple callback, just marks ready
async initModule(){
    console.log('module initialized');
    myClass.rivetsData.moduleInitializing = false;
}
```

5. **Game Loading** (happens later, after user interaction):
```javascript
// Line 168: LoadEmulator is called by user action
async LoadEmulator(byteArray){
    await this.writeAssets();              // Write assets.zip
    FS.writeFile('custom.v64', byteArray); // Write ROM
    this.beforeRun();
    this.retrieveSettings();
    this.WriteConfigFile();                 // Write config.txt
    await this.LoadSram();                  // Load saves
    $('#canvasDiv').show();
    Module.callMain(['custom.v64']);       // START EMULATOR
    // ... more setup
}
```

#### Our Current Pattern:

1. **Module Setup**:
```typescript
// src/emulator/loader.ts loadEmulatorCore()
(window as any).Module = {
    canvas,
    onRuntimeInitialized: function() {
        console.log('[Loader] Emulator core initialized');
        setTimeout(() => {
            resolve((window as any).Module);
        }, 100);
    }
};

const script = document.createElement('script');
script.src = '/n64wasm.js';  // Changed from '/core.js'
document.head.appendChild(script);
```

2. **Module Type**: Same as N64Wasm (global)
   - We're already using the correct pattern!
   - Using `window.Module` correctly
   - Loading via script tag

3. **Critical Difference - Timing**:
```typescript
// src/main.ts - We do EVERYTHING immediately after init:
const Module = await loadEmulatorCore(canvas);
await loadAssets(Module);           // ✓ Good
const romInfo = await loadROM(Module, '/offroad.n64');  // ✓ Good
startEmulator(Module, romInfo.path);  // ❌ TOO SOON?
```

vs N64Wasm:
```javascript
// onRuntimeInitialized - just marks ready, does NOTHING else
// User clicks "Play Game" button
// THEN: LoadEmulator() → loads assets, ROM, config
// THEN: Module.callMain() to start
```

#### Key Findings:

1. **✅ Our loader pattern is CORRECT** - we're already using window.Module and script tags
2. **❌ Missing files**: We didn't copy `n64wasm.data` initially (now fixed)
3. **❌ Wrong timing**: We're calling `Module.callMain()` immediately after `onRuntimeInitialized`
4. **❌ Missing steps**: N64Wasm does more setup before calling callMain:
   - Writes assets.zip
   - Writes config.txt
   - Loads save data
   - Shows canvas
   - THEN calls callMain

5. **File Requirements**:
   ```
   Required files:
   - n64wasm.js      ✅ Copied
   - n64wasm.wasm    ✅ Copied
   - n64wasm.data    ✅ Now copied
   - assets.zip      ✅ We have this
   - config.txt      ✅ We generate this
   ```

6. **Config File Format**: N64Wasm's config.txt has specific format:
   ```
   Line 1-11: Gamepad mappings (11 lines of "0")
   Line 12-29: Keyboard mappings (SDL scancodes)
   Line 30-32: Save file flags (EEP, SRA, FLA)
   Line 33: Show FPS flag
   Line 34: Swap sticks flag
   ```
   Our config matches this format ✅

#### Root Cause Analysis:

The error `fopen(n64wasm.data, rb): No such file or directory` occurs because:

1. **n64wasm.data is REQUIRED** - it contains Emscripten's preloaded filesystem data
2. **File was not copied** - we only copied .js and .wasm initially
3. **Emscripten loads .data file automatically** when the module initializes
4. **Location matters** - n64wasm.data must be in same directory as n64wasm.js

#### Solution Path:

1. ✅ Copy n64wasm.data to /public/
2. ✅ Update Vite config to serve .data files with correct MIME type
3. Test module initialization
4. If successful, proceed with ROM loading
5. Consider separating init from game start (like N64Wasm does)

**Next Actions**:
1. Copy n64wasm.data file
2. Test initialization
3. If still failing, check browser Network tab for .data file loading
4. May need to adjust file paths or MIME types

---

### Issue: Milestone 3 Complete - ROM Loading and First Frames
**Date**: 2025-10-26
**Category**: Compilation | ROM Loading | Rendering

**Achievement**:
Successfully completed Milestone 3 - Off Road Challenge ROM now loads and renders to the screen!

**Final Implementation**:

1. **Files Required**:
   - `public/n64wasm.js` - ParaLLEl N64 core loader (from N64Wasm project)
   - `public/n64wasm.wasm` - Compiled ParaLLEl N64 core
   - `public/n64wasm.data` - Emscripten virtual filesystem data
   - `public/assets.zip` - Emulator assets (shaders, fonts)
   - `public/input_controller.js` - N64 controller input handler
   - `public/offroad.n64` - Off Road Challenge ROM (renamed from "Off Road Challenge (USA).n64")

2. **Implementation Pattern**:
   ```typescript
   // src/emulator/loader.ts - Module initialization
   (window as any).Module = {
     canvas,
     onRuntimeInitialized: function() {
       console.log('[Loader] Emulator core initialized');
       const mod = (window as any).Module as EmscriptenModule;
       if (mod.FS) {
         (window as any).FS = mod.FS;
       }
       canvas.focus();
       canvas.setAttribute('tabindex', '0');
       resolve(mod);
     }
   };

   // Load via script tag
   const script = document.createElement('script');
   script.src = '/n64wasm.js';
   document.head.appendChild(script);
   ```

3. **ROM Loading Pattern**:
   ```typescript
   // src/emulator/rom-loader.ts
   export async function loadAssets(Module: EmscriptenModule): Promise<void> {
     const response = await fetch('/assets.zip');
     const arrayBuffer = await response.arrayBuffer();
     const data = new Uint8Array(arrayBuffer);
     Module.FS!.writeFile('assets.zip', data);
   }

   export async function loadROM(Module: EmscriptenModule, romPath: string) {
     const response = await fetch(romPath);
     const arrayBuffer = await response.arrayBuffer();
     const romData = new Uint8Array(arrayBuffer);

     const filename = 'custom.v64';
     Module.FS!.writeFile(filename, romData);

     return {
       name: romPath.split('/').pop() || 'unknown',
       path: filename,
       size: romData.length
     };
   }
   ```

4. **Starting the Emulator**:
   ```typescript
   export function startEmulator(Module: EmscriptenModule, romFilename: string): void {
     if (Module.callMain) {
       Module.callMain([romFilename]);
     }
   }
   ```

5. **Initialization Sequence** (main.ts):
   ```typescript
   // 1. Load input controller script
   loadInputController()

   // 2. Check browser compatibility
   const compat = checkBrowserCompatibility();

   // 3. Load ParaLLEl N64 core
   const Module = await loadEmulatorCore(canvas);

   // 4. Load emulator assets
   await loadAssets(Module);

   // 5. Load ROM into virtual filesystem
   const romInfo = await loadROM(Module, '/offroad.n64');

   // 6. Initialize input controller
   inputController = new InputController();

   // 7. Start emulator with ROM
   startEmulator(Module, romInfo.path);
   ```

**What Worked**:
- Using pre-compiled ParaLLEl N64 core from N64Wasm project
- Following N64Wasm's exact initialization pattern
- Writing assets.zip and ROM to Emscripten virtual filesystem
- Calling `Module.callMain([romFilename])` to start emulation
- Canvas properly connected with tabindex for keyboard input

**Key Learnings**:
- **All three files required**: .js, .wasm, AND .data file for Emscripten modules
- **Initialization timing matters**: Assets and ROM must be written to FS BEFORE calling callMain
- **Input controller essential**: N64Wasm's input_controller.js handles keyboard mapping
- **File naming conventions**: Core expects 'custom.v64' as ROM filename internally
- **Canvas focus**: Must set tabindex="0" and focus() for keyboard events
- **Script loading order**: Input controller → Core → Assets → ROM → Start

**Visual Confirmation**:
- Canvas displays game graphics ✓
- Off Road Challenge title screen visible ✓
- No black screen issues ✓
- No JavaScript errors in console ✓

**Next Milestone**: M4 - Audio, Input, and Save Persistence
- [ ] Implement audio output (currently silent)
- [ ] Verify keyboard input working (controller loaded but untested)
- [ ] Add IDBFS save persistence
- [ ] Test full gameplay session

**Status**: ✅ **COMPLETE** - Milestone 3 achieved! ROM loads and renders successfully.

---

## Next Steps

When stuck, try:
1. Check browser console for errors
2. Review TECHNICAL.md for similar issues
3. Test in Chrome DevTools with throttling
4. Verify Emscripten flags match docs
5. Search Libretro forums/Discord
6. Compare with working WebAssembly examples
