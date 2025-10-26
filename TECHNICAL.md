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
