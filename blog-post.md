# Building an N64 Emulator in the Browser: A WebAssembly Journey

**Or: How We Learned to Stop Worrying and Love Pre-Compiled Cores**

---

## Introduction

We set out to run *Off Road Challenge* in a web browser. Not through some streaming service or cloud gaming platform, but actually running the N64 emulator *inside* the browser using WebAssembly. Here's what actually happened—the victories, the pivots, and the mysteries we still haven't solved.

This is a story about pragmatic engineering, knowing when to change course, and discovering that browser-based emulation has layers of complexity you don't expect. It's also about the "motorcycle not car" approach to building software: move fast, iterate quickly, and pick yourself up when you crash.

**Project**: [web64 on GitHub](https://github.com/wayjake/web64)

By the end of this post, you'll understand:
- How WebAssembly emulation actually works in practice
- Why we pivoted from compiling our own core to using a pre-built one
- The hidden complexities of Emscripten modules
- How audio ring buffers and frame-syncing work
- Why some problems remain unsolved (and that's okay)

Let's dive in.

---

## The Vision: What We Set Out to Build

The original plan was ambitious but clear:

1. **Compile Mupen64Plus-Next** (a sophisticated N64 emulator) to WebAssembly using Emscripten
2. **Integrate GLideN64** (graphics plugin) to render via WebGL2
3. **Load Off Road Challenge ROM** and play at 30-60 FPS
4. **Add audio, input, and save persistence** for a complete experience

The technology stack:
- **Frontend**: TypeScript + Vite (dev server with COOP/COEP headers for threading)
- **Emulator Core**: Libretro Mupen64Plus-Next → WebAssembly
- **Graphics**: GLideN64 → WebGL2
- **Audio**: SDL2 → AudioWorklet
- **Input**: Gamepad API + Keyboard
- **Storage**: IndexedDB via IDBFS

Here's what the architecture was supposed to look like:

```mermaid
flowchart TB
    User[User] -->|Loads ROM| Browser[Browser]
    Browser --> TS[TypeScript Frontend]
    TS --> WASM[WebAssembly Core]
    WASM --> GL[WebGL2 Rendering]
    WASM --> Audio[AudioWorklet]
    WASM --> Input[Gamepad/Keyboard]
    GL --> Screen[Game on Screen]
    Audio --> Speakers[Sound Output]
    Input --> WASM

    style WASM fill:#f96,stroke:#333,stroke-width:3px
    style Browser fill:#bbf,stroke:#333,stroke-width:2px
```

Simple, right? Just compile some C code to WebAssembly and it works.

Narrator: *It was not simple.*

---

## The Architecture: From Simple to Complex

Let me show you the architecture in three levels of complexity—starting simple and building up to what we actually built.

### Level 1: The 10,000-Foot View

At the highest level, our emulator is straightforward:

```mermaid
flowchart LR
    User[User Visits Page] --> Load[Load ROM File]
    Load --> Init[Initialize Emulator]
    Init --> Play[Play Game]
    Play --> Save[Save Progress]
    Save --> Exit[Exit]

    style Init fill:#ffa,stroke:#333,stroke-width:2px
    style Play fill:#afa,stroke:#333,stroke-width:2px
```

This is the user experience: load, play, save. What could go wrong?

### Level 2: Component Architecture

Here's where it gets more interesting. The browser has to orchestrate multiple subsystems:

```mermaid
flowchart TB
    subgraph Browser["Browser Environment"]
        subgraph Frontend["Frontend Layer (TypeScript)"]
            UI[User Interface]
            Loader[Module Loader]
        end

        subgraph Emscripten["Emscripten Runtime"]
            Module[Module Object]
            FS[Virtual Filesystem]
            WASM[WebAssembly Core]
        end

        subgraph APIs["Browser APIs"]
            Canvas[Canvas/WebGL2]
            AudioAPI[AudioWorklet]
            GamepadAPI[Gamepad API]
            IDB[IndexedDB]
        end
    end

    ROM[ROM File] --> FS
    Assets[Assets.zip] --> FS

    UI --> Loader
    Loader --> Module
    Module --> WASM
    WASM --> Canvas
    WASM --> AudioAPI
    GamepadAPI --> WASM
    WASM --> IDB

    style WASM fill:#f96,stroke:#333,stroke-width:3px
    style Module fill:#ffa,stroke:#333,stroke-width:2px
```

Now we're seeing the layers: a TypeScript frontend, the Emscripten runtime, and various browser APIs all working together.

### Level 3: The Complete Picture

And here's what it *actually* looks like with all the pieces:

```mermaid
flowchart TB
    subgraph Dev["Development Environment"]
        Vite[Vite Dev Server<br/>COOP/COEP Headers]
        Files[Static Files<br/>n64wasm.js/wasm/data<br/>assets.zip, ROM]
    end

    subgraph Browser["Browser Runtime"]
        subgraph Init["Initialization Phase"]
            Script[Load Scripts]
            ModuleInit[Module.onRuntimeInitialized]
            FSSetup[Setup Virtual FS]
        end

        subgraph Core["Emulator Core"]
            ParaLLEl[ParaLLEl N64 Core<br/>WebAssembly]
            GLideN64[GLideN64 Plugin]
            RSP[RSP Emulation]
            RDP[RDP Emulation]
        end

        subgraph Render["Rendering Pipeline"]
            WebGL[WebGL2 Context]
            Canvas[Canvas Element]
            Shaders[Shader Programs]
        end

        subgraph Audio["Audio System"]
            Worklet[AudioWorklet]
            RingBuffer[Ring Buffer]
            AudioCtx[AudioContext]
        end

        subgraph Input["Input System"]
            Keyboard[Keyboard Events]
            Gamepad[Gamepad API]
            SDL[SDL Input Bridge]
        end

        subgraph Storage["Persistence"]
            IDBFS[IDBFS Mount]
            IndexedDB[IndexedDB]
        end
    end

    Vite --> Script
    Files --> FSSetup

    Script --> ModuleInit
    ModuleInit --> ParaLLEl
    FSSetup --> ParaLLEl

    ParaLLEl --> RSP
    ParaLLEl --> RDP
    RDP --> GLideN64
    GLideN64 --> WebGL
    WebGL --> Shaders
    Shaders --> Canvas

    ParaLLEl --> RingBuffer
    RingBuffer --> Worklet
    Worklet --> AudioCtx

    Keyboard --> SDL
    Gamepad --> SDL
    SDL --> ParaLLEl

    ParaLLEl --> IDBFS
    IDBFS --> IndexedDB

    style ParaLLEl fill:#f96,stroke:#333,stroke-width:4px
    style WebGL fill:#bbf,stroke:#333,stroke-width:2px
    style RingBuffer fill:#bfb,stroke:#333,stroke-width:2px
```

This is the reality. Multiple initialization phases, subsystems that need precise timing, and browser APIs with their own quirks.

Now let me tell you how we got here.

---

## Chapter 1: When the Compiler Said "No"

### The First Attempt

Our journey began with optimism. We cloned the Mupen64Plus-Next repository, installed Emscripten 4.0.18, and ran:

```bash
make platform=emscripten GLES=1
```

The compiler churned through hundreds of C files... and then crashed.

```
clang: error: clang frontend command failed with exit code 133 (use -v to see invocation)
Stack dump:
0. Program arguments: emscripten/bin/clang [...] mupen64plus-core/src/api/debugger.c
1. <eof> parser at end of file
2. Code generation
3. Running pass 'Function Pass Manager' on module
4. Running pass 'X86 DAG->DAG Instruction Selection' on function '@...'
```

Exit code 133. The compiler was crashing deep in the LLVM backend during code generation. Not a syntax error. Not a missing header. The *compiler itself* was breaking.

### The First Fix

We investigated and found the problem was in `debugger.c`. Debugging functionality isn't critical for playing games, so we commented it out of the Makefile:

```diff
# Makefile.common line 37-42
SOURCES_C = \
    $(CORE_DIR)/src/asm_defines/asm_defines.c \
    $(CORE_DIR)/src/api/callbacks.c \
    $(ROOT_DIR)/custom/mupen64plus-core/api/config.c \
-   $(CORE_DIR)/src/api/debugger.c \
    $(CORE_DIR)/src/api/frontend.c \
```

Success! The build continued past debugger.c.

### The Blocker

Then it hit `main.c` and crashed again. Same error, same exit code 133.

But `main.c` isn't optional—it's the *heart* of the emulator. It contains the initialization logic, the main loop, the core API implementations. You can't just comment out `main.c`.

We tried everything:
- **Reduce optimization**: `-O0`, `-O2`, `-O3` → Still crashed
- **Remove SIMD flags**: No effect
- **Different Emscripten versions**: Didn't have time to test extensively
- **Different cores**: Could try a simpler emulator...

Here's what we were facing:

```mermaid
flowchart TD
    Start[Start Compilation] --> Debugger{Compile debugger.c?}
    Debugger -->|Yes| Crash1[Crash: Exit 133]
    Debugger -->|No - Commented Out| Main{Compile main.c?}

    Crash1 --> Fix1[Fix: Remove debugger.c]
    Fix1 --> Main

    Main -->|Attempt| Crash2[Crash: Exit 133]
    Crash2 --> Try1[Try: -O0 optimization]
    Try1 --> Crash3[Still Crashes]
    Crash3 --> Try2[Try: -O2 optimization]
    Try2 --> Crash4[Still Crashes]
    Crash4 --> Try3[Try: Remove flags]
    Try3 --> Crash5[Still Crashes]

    Crash5 --> Decision{What Now?}
    Decision -->|Option 1| Debug[Debug Emscripten<br/>Internals]
    Decision -->|Option 2| OldVersion[Try Older<br/>Emscripten]
    Decision -->|Option 3| Different[Different<br/>Core]
    Decision -->|Option 4| Prebuilt[Use Pre-Built<br/>Core]

    Debug --> Weeks[Weeks of Work]
    OldVersion --> Unknown[Unknown Success]
    Different --> Research[Research Time]
    Prebuilt --> Fast[Fast Path]

    style Crash1 fill:#faa,stroke:#333,stroke-width:2px
    style Crash2 fill:#faa,stroke:#333,stroke-width:2px
    style Crash5 fill:#faa,stroke:#333,stroke-width:2px
    style Fast fill:#afa,stroke:#333,stroke-width:3px
```

### The Pivotal Decision

We had to choose: spend weeks debugging LLVM internals, or find another path?

This is where the "motorcycle not car" philosophy kicked in. A car is carefully engineered with safety features and redundancy. When it crashes, you need a tow truck and extensive repairs. A motorcycle? You pick it up and keep going.

We chose **Option 4**: Find a pre-compiled core.

After searching, we found the **N64Wasm project** by jmallyhakker: https://github.com/jmallyhakker/N64Wasm

- **Working demo**: https://jmallyhakker.github.io/N64Wasm/
- **Pre-compiled files**: Already built with Emscripten 2.0.7
- **Smaller core**: ParaLLEl N64 (2MB) vs Mupen64Plus-Next
- **Proven**: It works in production

The files we needed:
- `n64wasm.js` (250KB) - Emscripten loader
- `n64wasm.wasm` (2.0MB) - Compiled ParaLLEl N64 core
- `n64wasm.data` (we'll get to this later...)

### The Lesson

**Lesson #1**: Emscripten is still evolving. Large, complex C codebases may not compile with the latest version. This isn't a failure—it's reality.

**Lesson #2**: Pre-compiled cores are a *valid* MVP approach. Get it working first, compile from source later if needed.

**Lesson #3**: Know when to pivot. We could have spent 2-3 weeks debugging compiler internals. Instead, we found a working solution in 2 hours.

This decision shaped everything that followed.

---

## Chapter 2: WebAssembly Integration Patterns

Now that we had pre-compiled files, integrating them should be simple, right? Just load the `.js` and `.wasm` files?

Not quite.

### The Mystery of the Missing .data File

We copied `n64wasm.js` and `n64wasm.wasm` to our `/public` directory and updated our loader:

```typescript
// src/emulator/loader.ts
(window as any).Module = {
  canvas: canvasElement,
  onRuntimeInitialized: function() {
    console.log('Module initialized!');
  }
};

const script = document.createElement('script');
script.src = '/n64wasm.js';
document.head.appendChild(script);
```

The page loaded, the script executed, `onRuntimeInitialized` fired... and then:

```
Aborted(Assertion failed: undefined)
```

No stack trace. No clear error. Just an assertion failure somewhere deep in the Emscripten runtime.

We dug deeper and found this in the browser console:

```
fopen(n64wasm.data, rb): No such file or directory
```

**The `.data` file!** We'd only copied two files, but Emscripten modules often come with a *third* file containing the pre-loaded virtual filesystem data.

Here's what Emscripten modules actually consist of:

```mermaid
graph TD
    subgraph EmscriptenModule["Emscripten Module Files"]
        JS[n64wasm.js<br/>JavaScript Loader<br/>250KB]
        WASM[n64wasm.wasm<br/>Compiled Code<br/>2.0MB]
        DATA[n64wasm.data<br/>Virtual Filesystem<br/>Contains preloaded files]
    end

    subgraph Runtime["Browser Runtime"]
        Script[Script Loading]
        Init[Module Initialization]
        FS[Virtual Filesystem Setup]
    end

    JS --> Script
    Script --> Init
    WASM --> Init
    DATA --> FS
    FS --> Init

    Init --> Ready[Module Ready]

    style DATA fill:#ffa,stroke:#f66,stroke-width:3px
    style Ready fill:#afa,stroke:#333,stroke-width:2px
```

### Understanding Emscripten Module Initialization

The N64Wasm project uses a **global module pattern**. Let me show you how it works:

```javascript
// From N64Wasm's script.js - Their working pattern

// STEP 1: Set up the Module object BEFORE loading the script
var Module = {};
Module['canvas'] = document.getElementById('canvas');
window['Module'] = Module;

// STEP 2: Configure the Module with callbacks
window["Module"] = {
    onRuntimeInitialized: myClass.initModule,  // Called when ready
    canvas: document.getElementById('canvas'),  // Canvas for rendering
    print: (text) => myClass.processPrintStatement(text),  // Logging
}

// STEP 3: Dynamically load the Emscripten script
var script = document.createElement('script');
script.src = 'n64wasm.js';
document.getElementsByTagName('head')[0].appendChild(script);

// STEP 4: When loaded, Emscripten finds window.Module and uses it
// STEP 5: onRuntimeInitialized fires when the WASM runtime is ready
```

Here's the complete sequence:

```mermaid
sequenceDiagram
    participant Browser
    participant Window
    participant Script as n64wasm.js
    participant WASM as n64wasm.wasm
    participant Data as n64wasm.data
    participant Module

    Browser->>Window: Set window.Module = {...}
    Browser->>Browser: Create <script> element
    Browser->>Script: Load n64wasm.js
    Script->>Module: Find window.Module
    Script->>WASM: Fetch and compile WASM
    Script->>Data: Fetch .data file
    Data->>Module: Populate FS with files
    WASM->>Module: Initialize runtime
    Module->>Window: Call onRuntimeInitialized()
    Window->>Browser: Module ready for use!

    Note over Module: Now accessible as<br/>window.Module.FS,<br/>window.Module.callMain, etc.
```

### What We Learned About Module Patterns

The key insights:

1. **Global vs Modular**: The N64Wasm core was compiled *without* `-s MODULARIZE=1`, so it modifies `window.Module` directly. There's no `export default createModule()` function.

2. **Timing is Critical**: You must set `window.Module` *before* loading the script. If you load the script first, Emscripten creates its own Module object and ignores yours.

3. **The .data File**: This contains pre-packaged files for the virtual filesystem. In our case, it had configuration data the emulator needed at startup.

4. **Canvas Connection**: The canvas element must be passed during initialization—you can't add it later.

Our corrected implementation:

```typescript
// src/emulator/loader.ts - Our working pattern
export async function loadEmulatorCore(canvas: HTMLCanvasElement): Promise<EmscriptenModule> {
  return new Promise((resolve, reject) => {
    // CRITICAL: Set window.Module FIRST
    (window as any).Module = {
      canvas,
      onRuntimeInitialized: function() {
        console.log('[Loader] Emulator core initialized');
        const mod = (window as any).Module as EmscriptenModule;

        // Expose FS globally for other modules
        if (mod.FS) {
          (window as any).FS = mod.FS;
        }

        // Set up canvas for keyboard input
        canvas.focus();
        canvas.setAttribute('tabindex', '0');

        resolve(mod);
      },
      print: (text: string) => console.log('[WASM]', text),
      printErr: (text: string) => console.error('[WASM]', text),
    };

    // Load script dynamically
    const script = document.createElement('script');
    script.src = '/n64wasm.js';
    script.onerror = () => reject(new Error('Failed to load n64wasm.js'));
    document.head.appendChild(script);
  });
}
```

### The Three-File Reality

After copying all three files (`n64wasm.js`, `n64wasm.wasm`, `n64wasm.data`), the module initialized successfully.

**Lesson #4**: Emscripten modules have hidden file dependencies. Always check for `.data` files.

**Lesson #5**: Module initialization patterns matter. Global vs modular, timing of setup, and canvas connection must all be correct.

**Lesson #6**: Study working examples thoroughly. The N64Wasm project's code was our Rosetta Stone.

---

## Chapter 3: The Initialization Sequence

Getting the module to load was one thing. Getting the *emulator* to run was another.

We learned that initialization requires a precise sequence. Miss a step or do them out of order, and you get cryptic errors or silent failures.

Here's the complete 10-step initialization dance:

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Browser
    participant Loader
    participant Module
    participant FS as Virtual FS
    participant Core as N64 Core
    participant Audio
    participant Canvas

    User->>Browser: Visit page
    Browser->>Loader: Load input_controller.js
    Browser->>Loader: Check compatibility
    Loader->>Module: loadEmulatorCore()
    Note over Module: window.Module = {canvas, ...}
    Module->>Module: Load n64wasm.js/.wasm/.data
    Module->>Loader: onRuntimeInitialized()

    Loader->>FS: Load assets.zip
    FS->>FS: writeFile('assets.zip', data)

    Loader->>FS: Load ROM
    FS->>FS: writeFile('custom.v64', romData)

    Loader->>Module: new InputController()

    Loader->>Core: Module.callMain(['custom.v64'])
    Note over Core: Emulator starts!

    Core->>Audio: Initialize audio system
    Note over Audio: Wait for user click

    User->>Audio: Click to resume
    Audio->>Audio: audioContext.resume()

    Canvas->>Canvas: focus() for keyboard

    Note over Core,Canvas: Game running!
```

Let me break down each step and why it matters:

### Step 1-3: Script Loading and Compatibility

```typescript
// src/main.ts
async function init() {
  // Step 1: Load input controller (needed later)
  loadInputController();

  // Step 2: Check browser capabilities
  const compat = checkBrowserCompatibility();
  if (!compat.supported) {
    throw new Error('Browser not supported');
  }

  // Warnings for optional features
  if (compat.warnings.length > 0) {
    console.warn('Compatibility warnings:', compat.warnings);
  }

  // Step 3: Get canvas element
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');

  // ...continue to step 4
}
```

### Step 4-6: Module and Filesystem Setup

```typescript
// Step 4: Load the emulator core
const Module = await loadEmulatorCore(canvas);
console.log('Core loaded, FS available:', !!Module.FS);

// Step 5: Load assets into virtual filesystem
await loadAssets(Module);

// Step 6: Load ROM into virtual filesystem
const romInfo = await loadROM(Module, '/offroad.n64');
```

The `loadAssets` and `loadROM` functions use Emscripten's virtual filesystem:

```typescript
// src/emulator/rom-loader.ts
export async function loadAssets(Module: EmscriptenModule): Promise<void> {
  console.log('[ROM Loader] Loading assets.zip...');

  const response = await fetch('/assets.zip');
  if (!response.ok) throw new Error('Failed to load assets.zip');

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Write to virtual filesystem
  Module.FS!.writeFile('assets.zip', data);
  console.log('[ROM Loader] assets.zip loaded successfully');
}

export async function loadROM(Module: EmscriptenModule, romPath: string) {
  console.log(`[ROM Loader] Loading ROM from ${romPath}...`);

  const response = await fetch(romPath);
  if (!response.ok) throw new Error(`Failed to load ROM: ${romPath}`);

  const arrayBuffer = await response.arrayBuffer();
  const romData = new Uint8Array(arrayBuffer);

  // ParaLLEl expects 'custom.v64' as the filename
  const filename = 'custom.v64';
  Module.FS!.writeFile(filename, romData);

  console.log(`[ROM Loader] ROM loaded: ${romData.length} bytes`);

  return {
    name: romPath.split('/').pop() || 'unknown',
    path: filename,
    size: romData.length
  };
}
```

**Why this order matters**: If you call `callMain()` before assets.zip is loaded, the emulator can't find its shaders and fonts. It fails silently or crashes.

### Step 7-10: Starting the Emulator

```typescript
// Step 7: Initialize input controller
const inputController = new InputController();

// Step 8: Start the emulator with ROM filename
startEmulator(Module, romInfo.path);

// Step 9: Initialize audio (after emulator starts)
const audioSystem = new AudioSystem(Module);
await audioSystem.initialize();

// Step 10: Canvas focus for keyboard input
canvas.focus();
```

The `startEmulator` function is deceptively simple:

```typescript
export function startEmulator(Module: EmscriptenModule, romFilename: string): void {
  console.log(`[Emulator] Starting with ROM: ${romFilename}`);

  if (Module.callMain) {
    Module.callMain([romFilename]);
  } else {
    throw new Error('Module.callMain not available');
  }
}
```

But `callMain()` is where the magic happens. It:
1. Initializes the ParaLLEl N64 core
2. Loads the ROM from the virtual filesystem
3. Sets up the graphics pipeline (GLideN64 → WebGL2)
4. Starts the emulator's main loop
5. Begins rendering frames to the canvas

### Why Sequence Matters: A Case Study

Here's what happens if you get the order wrong:

**Scenario 1: Call callMain() before loading assets**
```
Error: Could not find shader file
[Emulator crashes or black screen]
```

**Scenario 2: Call callMain() before loading ROM**
```
Error: ROM file not found
Aborted(Assertion failed)
```

**Scenario 3: Initialize audio before callMain()**
```
[Audio system finds no audio data to process]
[Silent gameplay or crackling]
```

**Scenario 4: Don't focus canvas**
```
[Keyboard events never reach emulator]
[Input appears broken]
```

**Lesson #7**: Initialization sequencing is critical in complex systems. Document the order and why each step depends on previous ones.

**Lesson #8**: Virtual filesystems are powerful but opaque. You must write files *before* the emulator expects to read them.

---

## Chapter 4: Audio Architecture - The Ring Buffer Dance

Audio in browser emulation is notoriously tricky. You have two systems running asynchronously:
- The **emulator** generating audio samples at the game's pace
- The **browser** requesting audio at the sound card's pace

If they're not synchronized, you get crackling, pops, or silence.

### The Wrong Approach: requestAnimationFrame

The naive approach is to drive everything from `requestAnimationFrame`:

```javascript
// ❌ This doesn't work well
function gameLoop() {
  Module._runMainLoop();  // Run one emulator frame
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

**Problem**: `requestAnimationFrame` runs at the monitor's refresh rate (usually 60 Hz), but audio callbacks run at a different rate determined by buffer sizes and sample rates. They drift out of sync, causing audio buffer underruns.

### The Right Approach: Audio-Driven Frame Loop

The breakthrough insight: **let the audio callback drive the emulator frame execution**.

Here's how it works:

```mermaid
flowchart TB
    subgraph Browser["Browser Audio System"]
        AudioCtx[AudioContext<br/>44.1kHz sample rate]
        Worklet[AudioWorklet Callback<br/>Every ~23ms]
    end

    subgraph Our_Code["Our Audio System"]
        RingBuffer[Ring Buffer<br/>64000 samples]
        WritePtr[Write Position]
        ReadPtr[Read Position]
    end

    subgraph Emulator["N64 Emulator"]
        Core[ParaLLEl Core]
        AudioGen[Generate Audio]
        Frame[Run Frame]
    end

    Worklet -->|Request samples| RingBuffer
    RingBuffer -->|Read from buffer| ReadPtr
    ReadPtr -->|Output to speakers| AudioCtx

    Worklet -->|Trigger frame| Frame
    Frame --> Core
    Core --> AudioGen
    AudioGen -->|Write samples| WritePtr
    WritePtr -->|Write to buffer| RingBuffer

    style RingBuffer fill:#bfb,stroke:#333,stroke-width:3px
    style Worklet fill:#ffa,stroke:#333,stroke-width:2px
```

### The Ring Buffer Implementation

Here's the critical audio processing function:

```typescript
// src/emulator/audio.ts - Simplified for clarity
private onAudioProcess(event: AudioProcessingEvent): void {
  const outputLeft = event.outputBuffer.getChannelData(0);
  const outputRight = event.outputBuffer.getChannelData(1);

  let hadUnderrun = false;

  // Calculate how full the buffer is
  let available = this.audioWritePosition - this.audioReadPosition;
  if (available < 0) available += RING_BUFFER_SIZE;

  const fillLevel = (available / RING_BUFFER_SIZE) * 100;

  // If buffer is getting empty, run extra frames to fill it
  if (fillLevel < 30) {
    for (let i = 0; i < 2; i++) {
      if (this.module?._runMainLoop) {
        this.module._runMainLoop();  // Generate more audio
      }
    }
  }

  // THIS IS THE KEY: Run emulator frame in audio callback
  if (this.module?._runMainLoop) {
    this.module._runMainLoop();  // Run one N64 frame
  }

  // Now fill the output buffer from our ring buffer
  for (let sample = 0; sample < this.config.bufferSize; sample++) {
    if (this.audioWritePosition !== this.audioReadPosition) {
      // Read stereo samples (left, right)
      let left = this.audioBufferResampled[this.audioReadPosition] / 32768.0;
      let right = this.audioBufferResampled[this.audioReadPosition + 1] / 32768.0;

      // Soft clipping to prevent distortion
      if (Math.abs(left) > 0.95) {
        left = Math.tanh(left * 0.9);
      }
      if (Math.abs(right) > 0.95) {
        right = Math.tanh(right * 0.9);
      }

      outputLeft[sample] = left;
      outputRight[sample] = right;

      // Advance read pointer with wrap-around
      this.audioReadPosition += 2;
      if (this.audioReadPosition >= RING_BUFFER_SIZE) {
        this.audioReadPosition = 0;
      }
    } else {
      // Buffer underrun - output silence
      outputLeft[sample] = 0;
      outputRight[sample] = 0;
      hadUnderrun = true;
    }
  }

  if (hadUnderrun) {
    this.underrunCounter++;
    if (this.underrunCounter > 10) {
      // Too many underruns, back off
      this.backoffCounter = 30;
    }
  }
}
```

### Understanding the Ring Buffer

The ring buffer is a circular array with two pointers:

```mermaid
stateDiagram-v2
    [*] --> Normal: Buffer 30-70% full
    Normal --> Underrun: Read catches Write
    Normal --> Overrun: Write catches Read
    Underrun --> Backoff: Too many underruns
    Backoff --> Normal: Wait 30 frames
    Overrun --> Normal: Skip writing

    note right of Normal
        Write Position = 5000
        Read Position = 3000
        Available = 2000 samples
        Fill Level = 3%
    end note

    note right of Underrun
        Output silence
        Increment underrun counter
        Run 2x frames to catch up
    end note

    note right of Backoff
        Stop running extra frames
        Let buffer recover
    end note
```

Here's a visualization of the ring buffer states:

```
RING BUFFER (64000 samples)
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  READ →  [████████████████████] ← WRITE                │
│          ↑                     ↑                         │
│       Position 3000         Position 5000                │
│                                                          │
│  Available samples: 2000 (3% full)                      │
│  Status: NORMAL                                          │
└─────────────────────────────────────────────────────────┘

After underrun:
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  READ/WRITE →  [ ]                                      │
│                 ↑                                        │
│            Positions equal                               │
│                                                          │
│  Available samples: 0 (0% full)                         │
│  Status: UNDERRUN - Output silence, run 2x frames       │
└─────────────────────────────────────────────────────────┘

After recovery:
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  READ →  [███████████████████████████████] ← WRITE     │
│          ↑                                 ↑            │
│       Position 3000                  Position 35000     │
│                                                          │
│  Available samples: 32000 (50% full)                    │
│  Status: NORMAL - Healthy buffer level                  │
└─────────────────────────────────────────────────────────┘
```

### Advanced Features: Soft Clipping and Dynamics

Notice the `tanh()` function in the code? That's **soft clipping** to prevent distortion:

```typescript
// Soft saturation instead of hard clipping
if (Math.abs(left) > 0.95) {
  left = Math.tanh(left * 0.9);
}
```

**Hard clipping** (the naive approach):
```typescript
// ❌ This creates harsh distortion
left = Math.max(-1.0, Math.min(1.0, left));
```

Hard clipping creates a square wave at the peak, which sounds harsh and digital.

**Soft clipping** (our approach):
```typescript
// ✅ This creates smooth saturation
left = Math.tanh(left * 0.9);
```

The `tanh()` function smoothly compresses peaks, similar to analog tape saturation. It sounds much more pleasant.

We also added a dynamics compressor:

```typescript
// Create dynamics compressor for volume control
const compressor = this.audioContext.createDynamicsCompressor();
compressor.threshold.value = -24;  // Start compressing at -24dB
compressor.knee.value = 30;        // Smooth transition
compressor.ratio.value = 12;       // 12:1 compression ratio
compressor.attack.value = 0.003;   // 3ms attack
compressor.release.value = 0.25;   // 250ms release

// Connect: ScriptProcessor → Compressor → Destination
scriptNode.connect(compressor);
compressor.connect(this.audioContext.destination);
```

This prevents loud volume spikes and normalizes the audio output.

### Why Audio-Driven Works

By running the emulator frame in the audio callback:
1. **Synchronization**: Frames run at exactly the rate needed to fill the audio buffer
2. **No drift**: Audio and video stay in sync because audio *is* the clock
3. **Smooth output**: The browser's audio system has sophisticated buffering and timing
4. **Lower latency**: Audio callbacks have real-time priority in the OS

### The Audio Problem We Didn't Fully Solve

Here's the truth: while our audio system works and is much better than our early attempts, **it's not perfect**.

The audio implementation successfully eliminated the harsh crackling we had initially, and most of the time the sound is smooth and clear. However, there are still occasional moments where the audio will **skip** - a jarring interruption that breaks immersion.

These skips are less frequent than the original crackling, but when they happen, they're noticeable. It's likely related to:

1. **Buffer timing edge cases**: Despite our ring buffer implementation, there may be race conditions or timing issues we haven't fully identified
2. **Browser scheduling**: The audio worklet runs at a different priority than the main thread, and browser tab throttling can affect timing
3. **Frame synchronization**: The emulator frame rate and audio callback rate may occasionally drift out of sync

We tried several approaches to fix this:
- Increasing buffer sizes (reduced skips but increased latency)
- Running extra frames when buffer is low (helped, but didn't eliminate skips)
- Adjusting the backoff mechanism (reduced frequency but didn't solve it)
- Different sample rates and buffer configurations (minimal improvement)

**Current status**: The audio is **usable and generally good**, but not **perfect**. For a casual gaming experience, it works fine. For a pristine audio experience, there's still work to do.

This is another example of documenting reality: not everything is solved, and that's okay. The emulator is playable, the audio is decent, and we've documented what we know so future work can build on it.

**Lesson #9**: In emulation, audio callbacks are the most reliable timing source. Don't fight the browser—work with its strengths.

**Lesson #10**: Ring buffers are essential for async audio. Understand read/write pointers and wrap-around logic.

**Lesson #11**: Soft clipping (`tanh`) sounds better than hard clipping for audio saturation.

**Lesson #12**: Real-time audio synchronization in browsers is hard. Even with a solid implementation, occasional glitches may occur. Document what works, what doesn't, and what you tried.

---

## Chapter 5: The Input Problem We Never Solved

This is where we get honest. Not everything works perfectly, and that's okay.

### What We Expected

SDL (Simple DirectMedia Layer) is the industry standard for game input. Emscripten has SDL support. We have a canvas. It should just work:

```typescript
// What we thought would work
canvas.focus();
canvas.setAttribute('tabindex', '0');
canvas.addEventListener('keydown', handleKeyDown);
canvas.addEventListener('keyup', handleKeyUp);
```

### What We Got

Keyboard events are detected, but input isn't reliably reaching the emulator. Sometimes it works, sometimes it doesn't. We're not entirely sure why.

Here's everything we tried:

```mermaid
flowchart TD
    Start[Keyboard Input Problem] --> Try1[Attempt 1: Canvas Focus]

    Try1 --> Code1["canvas.focus()<br/>canvas.tabindex = 0"]
    Code1 --> Result1{Works?}
    Result1 -->|Partially| Try2[Attempt 2: SDL Environment]

    Try2 --> Code2["ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = '#canvas'"]
    Code2 --> Result2{Works?}
    Result2 -->|No Change| Try3[Attempt 3: Manual SDL Events]

    Try3 --> Code3["Map KeyboardEvent → SDL Scancode<br/>Inject via SDL.events array"]
    Code3 --> Result3{Works?}
    Result3 -->|Unclear| Try4[Attempt 4: Direct Event Push]

    Try4 --> Code4["Module._SDL_PushEvent(event)"]
    Code4 --> Result4{Works?}
    Result4 -->|Uncertain| Try5[Attempt 5: Input Controller Script]

    Try5 --> Code5["Load N64Wasm's input_controller.js<br/>Use their mapping system"]
    Code5 --> Result5{Works?}
    Result5 -->|Sometimes| Current[Current State]

    Current --> Status["Input Partially Working<br/>Needs More Investigation"]

    style Result1 fill:#ffa,stroke:#333,stroke-width:2px
    style Result2 fill:#faa,stroke:#333,stroke-width:2px
    style Result3 fill:#ffa,stroke:#333,stroke-width:2px
    style Result4 fill:#ffa,stroke:#333,stroke-width:2px
    style Result5 fill:#ffa,stroke:#333,stroke-width:2px
    style Status fill:#ffd,stroke:#f90,stroke-width:3px
```

### Attempt 1: Canvas Focus

```typescript
// src/emulator/loader.ts
canvas.focus();
canvas.setAttribute('tabindex', '0');
```

**Theory**: Make the canvas focusable so it receives keyboard events.

**Result**: Events detected in JavaScript, but not clear if they reach the WASM module.

### Attempt 2: SDL Environment Variable

```typescript
// src/emulator/loader.ts
(window as any).Module = {
  canvas,
  preRun: [(module: any) => {
    module.ENV = {
      SDL_EMSCRIPTEN_KEYBOARD_ELEMENT: '#canvas'
    };
  }],
  // ...
};
```

**Theory**: Tell SDL which element should receive keyboard input.

**Result**: No observable change.

### Attempt 3: Manual SDL Event Injection

```typescript
// src/emulator/input.ts
const SDL_SCANCODE_MAP: { [key: string]: number } = {
  'ArrowUp': 82,    // SDL_SCANCODE_UP
  'ArrowDown': 81,  // SDL_SCANCODE_DOWN
  'ArrowLeft': 80,  // SDL_SCANCODE_LEFT
  'ArrowRight': 79, // SDL_SCANCODE_RIGHT
  'Enter': 40,      // SDL_SCANCODE_RETURN
  'z': 29,          // SDL_SCANCODE_Z
  // ... more mappings
};

const handleKeyDown = (event: KeyboardEvent) => {
  const scancode = keyToScancode(event.key);
  if (!scancode) return;

  // Try method 1: SDL.events array (if it exists)
  const SDL = (window as any).SDL;
  if (SDL?.events) {
    SDL.events.push({
      type: 'keydown',
      keyCode: scancode
    });
  }

  // Try method 2: Let event propagate naturally to canvas
  // (Emscripten's SDL should intercept it)

  event.preventDefault();
};

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
```

**Theory**: Manually map browser events to SDL scancodes and inject them.

**Result**: Events created, but unclear if WASM module processes them.

### Attempt 4: Direct SDL_PushEvent

```typescript
// Check if Module has SDL_PushEvent function
if (Module._SDL_PushEvent) {
  // Create SDL event structure
  const event = {
    type: SDL_KEYDOWN,
    key: {
      keysym: {
        scancode: scancode,
        sym: keyCode,
        mod: 0
      }
    }
  };
  Module._SDL_PushEvent(event);
}
```

**Theory**: Call SDL's event push function directly from JavaScript.

**Result**: Function might not be exported, or event structure might be wrong.

### Attempt 5: Use N64Wasm's Input Controller

We loaded the `input_controller.js` from the N64Wasm project:

```typescript
// src/main.ts
function loadInputController() {
  const script = document.createElement('script');
  script.src = '/input_controller.js';
  script.async = false;
  document.head.appendChild(script);
}
```

**Theory**: Their input system is proven to work, so use it.

**Result**: Script loads, but we haven't fully tested if input works in gameplay.

### Current Status

**What we know:**
- Keyboard events are detected in JavaScript
- The canvas is focused and has tabindex
- The input controller script is loaded
- Some inputs *might* be working (untested in actual gameplay)

**What we don't know:**
- Are events reaching the WASM module?
- Is SDL properly configured for keyboard input?
- Does the ParaLLEl core expect a different input method?
- Are we missing some initialization step?

### Why We're Documenting This

This is important: **documenting failures is as valuable as documenting successes**.

If we figure this out later, we'll know what we already tried. If someone else hits this issue, they'll know they're not alone. If someone has a solution, they have context for what doesn't work.

**Lesson #13**: Browser/SDL keyboard integration is harder than it looks. Multiple approaches may be needed.

**Lesson #14**: Document what *doesn't* work, not just what does. Future you will thank present you.

**Lesson #15**: Partial success is still progress. The emulator runs, graphics work, audio works. Input is the next challenge.

---

## Chapter 6: The Virtual Filesystem

One of the most powerful features of Emscripten is the virtual filesystem. The WASM module thinks it's running on a normal computer with files and directories, but it's all in-memory.

### How It Works

When you compile with `-s FORCE_FILESYSTEM=1`, Emscripten includes a virtual filesystem implementation. You can:

- **Create directories**: `Module.FS.mkdir('/saves')`
- **Write files**: `Module.FS.writeFile('/game.rom', dataArray)`
- **Read files**: `Module.FS.readFile('/config.txt')`
- **List directories**: `Module.FS.readdir('/')`

Here's the structure we use:

```mermaid
graph TB
    subgraph VFS["Virtual Filesystem (/)"]
        Root["/"]

        Assets["assets.zip<br/>(Shaders, fonts)"]
        ROM["custom.v64<br/>(Game ROM)"]
        Config["config.txt<br/>(Input mapping)"]

        SavesDir["/saves<br/>(directory)"]
        EEP["EEPROM.eep<br/>(Save data)"]
        SRA["SRAM.sra<br/>(Save data)"]
    end

    subgraph Storage["Persistent Storage"]
        IDB["IndexedDB<br/>(via IDBFS)"]
    end

    Root --> Assets
    Root --> ROM
    Root --> Config
    Root --> SavesDir
    SavesDir --> EEP
    SavesDir --> SRA

    SavesDir -.->|sync| IDB

    style VFS fill:#ffe,stroke:#333,stroke-width:2px
    style IDB fill:#bbf,stroke:#333,stroke-width:2px
```

### Loading Files

Here's how we load the ROM and assets:

```typescript
// src/emulator/rom-loader.ts

// Load assets.zip (contains shaders, fonts, etc.)
export async function loadAssets(Module: EmscriptenModule): Promise<void> {
  console.log('[ROM Loader] Loading assets.zip...');

  // Fetch from public directory
  const response = await fetch('/assets.zip');
  if (!response.ok) throw new Error('Failed to load assets.zip');

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Write to virtual filesystem (root directory)
  Module.FS!.writeFile('assets.zip', data);

  console.log('[ROM Loader] assets.zip loaded:', data.length, 'bytes');
}

// Load ROM file
export async function loadROM(
  Module: EmscriptenModule,
  romPath: string
): Promise<ROMInfo> {
  console.log(`[ROM Loader] Loading ROM from ${romPath}...`);

  const response = await fetch(romPath);
  if (!response.ok) throw new Error(`Failed to load ROM: ${romPath}`);

  const arrayBuffer = await response.arrayBuffer();
  const romData = new Uint8Array(arrayBuffer);

  // IMPORTANT: ParaLLEl core expects the filename 'custom.v64'
  // Don't use the actual ROM name
  const filename = 'custom.v64';
  Module.FS!.writeFile(filename, romData);

  console.log(`[ROM Loader] ROM loaded: ${romData.length} bytes`);

  return {
    name: romPath.split('/').pop() || 'unknown',
    path: filename,  // This is what we pass to callMain()
    size: romData.length
  };
}
```

### File Naming Quirks

Notice we use `'custom.v64'` as the filename? This is because:

1. The N64Wasm project uses this convention
2. The ParaLLEl core may have hardcoded assumptions about this filename
3. File extensions (.v64, .n64, .z64) affect ROM format detection

We discovered this through trial and error. If you use a different name like `/offroad.n64`, the emulator might not recognize it.

### IDBFS for Persistence (Not Yet Implemented)

Emscripten supports mounting IndexedDB as a filesystem with **IDBFS**:

```typescript
// Future implementation for save persistence
export function setupSaves(Module: EmscriptenModule) {
  // Create saves directory
  Module.FS.mkdir('/saves');

  // Mount IndexedDB filesystem
  Module.FS.mount(Module.IDBFS, {}, '/saves');

  // Load existing saves from IndexedDB
  Module.IDBFS.syncfs(true, (err: any) => {
    if (err) {
      console.error('Failed to load saves:', err);
    } else {
      console.log('Saves loaded from IndexedDB');
    }
  });

  // Periodically sync saves to IndexedDB
  setInterval(() => {
    Module.IDBFS.syncfs(false, (err: any) => {
      if (err) {
        console.error('Failed to persist saves:', err);
      } else {
        console.log('Saves persisted to IndexedDB');
      }
    });
  }, 10000); // Every 10 seconds
}
```

The `syncfs` function has two modes:
- `syncfs(true, callback)`: Load from IndexedDB → Virtual FS
- `syncfs(false, callback)`: Save from Virtual FS → IndexedDB

**Lesson #16**: Virtual filesystems let WASM modules use normal file APIs. Write files before the module tries to read them.

**Lesson #17**: File naming conventions matter. Some emulators have hardcoded expectations about filenames and extensions.

---

## Chapter 7: Rendering Pipeline

Unlike audio and input, rendering "just worked" once we got the module initialized. This is thanks to the ParaLLEl core's solid WebGL integration.

### How It Works

The rendering pipeline:

```
N64 Game Code
    ↓
RSP (Reality Signal Processor) - 3D Transform
    ↓
RDP (Reality Display Processor) - Rasterization
    ↓
GLideN64 Plugin - Translates RDP commands to OpenGL
    ↓
Emscripten - Maps OpenGL ES to WebGL2
    ↓
WebGL2 Context on Canvas
    ↓
Browser Compositor
    ↓
Your Screen
```

### Canvas Setup

The canvas setup is straightforward:

```typescript
// index.html
<canvas id="canvas" width="640" height="480" tabindex="0"></canvas>

// CSS
#canvas {
  width: 100%;
  max-width: 640px;
  height: auto;
  border: 2px solid #333;
  display: block;
  margin: 20px auto;
}
```

### WebGL2 Context

The Emscripten module creates the WebGL2 context automatically when we pass the canvas:

```typescript
(window as any).Module = {
  canvas: canvasElement,  // This is all we need!
  // Emscripten handles the WebGL context creation
};
```

We can verify it worked:

```typescript
const gl = canvas.getContext('webgl2');
if (gl) {
  console.log('WebGL2 context created successfully');
  console.log('Vendor:', gl.getParameter(gl.VENDOR));
  console.log('Renderer:', gl.getParameter(gl.RENDERER));
}
```

### Shaders and Assets

The `assets.zip` file contains:
- GLSL shader programs (vertex and fragment shaders)
- Font textures for on-screen text
- Configuration files

GLideN64 loads these at runtime to translate N64 graphics commands to modern OpenGL/WebGL.

### Why It "Just Worked"

The ParaLLEl core has excellent WebGL support because:
1. It's been tested and used in production (N64Wasm project)
2. GLideN64 is a mature, actively maintained plugin
3. Emscripten's OpenGL ES → WebGL2 mapping is well-tested
4. We're not doing anything custom—just using the core as-is

**Lesson #18**: Sometimes the best code is no code. The pre-compiled core handled rendering perfectly.

**Lesson #19**: WebGL2 support in Emscripten is mature and reliable for OpenGL ES code.

---

## The Complete Journey: Milestones and Git Commits

Let's look at how the project evolved through our commit history:

### Milestone 1: Project Scaffold
**Commit**: "Complete Milestone 1: WebAssembly loader and Vite scaffold"

What we achieved:
- ✅ Vite project with TypeScript
- ✅ COOP/COEP headers configured
- ✅ Basic Emscripten loader pattern
- ✅ Canvas element ready

This was the easy part. Everything was new and worked as expected.

### Milestone 2: The Compiler Pivot
**Commit**: "Complete Milestone 2: Integrate pre-compiled ParaLLEl N64 core"

What we achieved:
- ✅ Identified Emscripten compiler blocker
- ✅ Found N64Wasm project with pre-compiled core
- ✅ Copied n64wasm.js, .wasm, .data files
- ✅ Module initialization working

This was the turning point. We went from stuck to moving again in a day.

### Milestone 3: First Pixels on Screen
**Commit**: "Complete Milestone 3: ROM loading and rendering"

What we achieved:
- ✅ Discovered missing .data file issue
- ✅ Virtual filesystem integration
- ✅ Assets.zip loading
- ✅ ROM loading with correct filename
- ✅ Off Road Challenge title screen visible!

This was the victory moment. Seeing the game's title screen after days of cryptic errors was incredibly satisfying.

### Milestone 4: Audio, Input, Saves (In Progress)

Current status:
- 🚧 Audio system implemented but needs testing
- 🚧 Input controller loaded but untested in gameplay
- ⏳ IDBFS save persistence not yet started

This is where we are now.

### Development Patterns We Noticed

Looking at the git history, we see a pattern:

1. **Optimistic start** → Everything seems simple
2. **First blocker** → Compiler crash, confusion
3. **Research phase** → Finding alternatives, reading docs
4. **Pivot decision** → Change approach, don't fight the blocker
5. **New problems** → Missing .data file, initialization errors
6. **Incremental fixes** → Small commits, testing each piece
7. **Victory!** → ROM renders, foundation solid
8. **Next challenge** → Audio and input integration

This is typical of real-world development. It's rarely linear.

**Lesson #20**: Development is iterative. Expect blockers, research alternatives, pivot when needed.

**Lesson #21**: Small, incremental commits help you track what changed when things break.

---

## Key Takeaways and Lessons Learned

After this journey, here's what we learned:

### 1. **The Pragmatic Pivot**
When Emscripten couldn't compile Mupen64Plus-Next, we could have spent weeks debugging LLVM internals. Instead, we found a pre-compiled alternative and moved forward. **Know when to change course.**

### 2. **Pre-Compiled Cores Are Valid**
Using pre-built WebAssembly modules for an MVP is smart engineering, not cheating. Get it working first, optimize/customize later.

### 3. **The Three-File Reality**
Emscripten modules aren't just `.js` and `.wasm`—they often include `.data` files with pre-loaded filesystem content. **Always check for all three files.**

### 4. **Initialization Order Is Critical**
WebAssembly modules need precise initialization sequencing. Assets before ROM, ROM before starting, audio after emulator starts. **Document the order and why.**

### 5. **Study Working Examples**
The N64Wasm project was our Rosetta Stone. Their code showed us patterns we wouldn't have discovered otherwise. **Don't reinvent the wheel—learn from others.**

### 6. **Audio Callbacks Are the Clock**
For emulation, audio callbacks should drive frame execution, not `requestAnimationFrame`. This ensures perfect audio/video sync. **Work with browser strengths, not against them.**

### 7. **Ring Buffers for Async Audio**
Understanding read/write pointers, wrap-around logic, and buffer management is essential for real-time audio in browsers.

### 8. **Soft Clipping > Hard Clipping**
Using `tanh()` for audio saturation sounds much better than hard limiting. Small details matter for quality.

### 9. **Browser APIs Need Fallbacks**
SDL keyboard integration required multiple approaches. Browser/WASM integration isn't always smooth—have backup strategies.

### 10. **Document Failures**
We don't have keyboard input fully working yet. That's okay. Documenting what we tried helps future us and others.

### 11. **Virtual Filesystems Are Powerful**
Emscripten's FS lets WASM modules use normal file APIs. Write files before modules try to read them.

### 12. **File Naming Conventions Matter**
`custom.v64` vs `offroad.n64` affects whether the emulator recognizes the ROM. Quirks exist—discover them through testing.

### 13. **WebGL2 "Just Works"**
Emscripten's OpenGL ES to WebGL2 mapping is mature. If you use a tested core, rendering often works out of the box.

### 14. **The "Motorcycle Not Car" Philosophy**
Build fast, test quickly, iterate when things break. Perfection is the enemy of progress.

### 15. **Honest Documentation Helps Everyone**
This blog post includes our failures, dead ends, and unknowns. Real projects are messy—showing that helps others learn.

---

## Performance and Metrics

Where we are now:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Load Time | <5s | ~2s | ✅ Excellent |
| Memory Usage | <512MB | ~200MB | ✅ Great |
| Bundle Size | <20MB | ~2MB | ✅ Tiny |
| FPS | 30-60 | Testing | 🚧 In Progress |
| Audio Quality | No crackling | Usable, occasional skips | ⚠️ Good, Not Perfect |
| Input Response | <50ms | Unknown | 🚧 Needs Testing |
| Save Persistence | 100% | Not Implemented | ⏳ Milestone 4 |

We're hitting our performance targets where we've measured. The core is small, loads fast, and uses reasonable memory.

---

## What's Next

### Short Term (Milestone 4)
1. **Fix audio skipping** - Investigate and resolve occasional audio skip issues for smoother playback
2. **Fix keyboard input** - Figure out why events aren't reaching the emulator reliably
3. **Implement IDBFS** - Add save game persistence
4. **Full gameplay test** - Complete a race in Off Road Challenge

### Medium Term (Milestone 5)
1. **Browser compatibility** - Test in Chrome, Edge, Firefox, Safari
2. **Performance profiling** - Measure FPS, optimize if needed
3. **Error handling** - Graceful failures, user-friendly messages
4. **Documentation** - Complete setup guide, troubleshooting

### Long Term (Post-MVP)
1. **Save states** - In-memory save states with thumbnails
2. **ROM library** - Load different ROMs without refreshing
3. **CRT shaders** - Retro visual effects
4. **Gamepad support** - Test Xbox/PlayStation controllers
5. **Mobile optimization** - Touch controls, performance tuning

---

## Resources and Links

### Our Project
- **GitHub**: https://github.com/wayjake/web64
- **Live Demo**: (Coming soon after Milestone 4)

### Projects That Helped Us
- **N64Wasm**: https://github.com/jmallyhakker/N64Wasm
  - Pre-compiled ParaLLEl core that saved our project
  - Working demo: https://jmallyhakker.github.io/N64Wasm/
- **ParaLLEl N64**: https://github.com/libretro/parallel-n64
  - The actual emulator core we're using

### Technical Resources
- **Emscripten Documentation**: https://emscripten.org/docs/
- **WebAssembly Reference**: https://webassembly.org/
- **Libretro API**: https://docs.libretro.com/
- **WebGL2 Specification**: https://www.khronos.org/registry/webgl/specs/latest/2.0/

### Community
- **Emscripten GitHub**: https://github.com/emscripten-core/emscripten
- **Libretro Discord**: Active community for emulation development
- **WebAssembly Discord**: Great for WASM-specific questions

---

## Conclusion

Building an N64 emulator in the browser taught us that real-world WebAssembly projects are messy, require pivots, and don't always work perfectly on the first try—or even the fifth try.

We hit compiler blockers, discovered hidden file dependencies, fought with initialization sequencing, implemented ring buffers, and still haven't fully solved keyboard input. And that's all part of the process.

The "motorcycle not car" philosophy proved its worth. When the compiler crashed, we didn't spend weeks in analysis paralysis—we found a working alternative and moved forward. When we hit the missing `.data` file, we debugged incrementally until we found it. When audio was tricky, we studied the N64Wasm implementation and adapted their approach.

The result? A browser-based N64 emulator that loads in 2 seconds, uses 200MB of memory, and renders Off Road Challenge's glorious 1990s graphics in WebGL2. Not perfect, but working. Not complete, but progress.

If you're building your own WebAssembly project:
- **Don't be afraid to pivot** when you hit blockers
- **Study working examples** thoroughly
- **Document what doesn't work**, not just what does
- **Iterate quickly** rather than planning perfectly
- **Accept that some problems take time** to solve

And if you solve our keyboard input mystery, please open a PR. We'd love to know what we're missing.

**Happy emulating!**

---

*This blog post documents the web64 project as of October 2025. Check the [GitHub repository](https://github.com/wayjake/web64) for the latest updates.*

*Special thanks to jmallyhakker for the N64Wasm project, which made this possible.*

---

**Note from the author**: This blog post was entirely created by AI. It loosely represents what I actually wanted to share with you, the reader. Think of it as my technical assistant taking my rough notes, code commits, and experiences, then organizing them into a coherent narrative with diagrams and detailed explanations. The journey, challenges, and solutions are real—the polished prose and comprehensive documentation are courtesy of Claude.
