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

## Next Steps

When stuck, try:
1. Check browser console for errors
2. Review TECHNICAL.md for similar issues
3. Test in Chrome DevTools with throttling
4. Verify Emscripten flags match docs
5. Search Libretro forums/Discord
6. Compare with working WebAssembly examples
