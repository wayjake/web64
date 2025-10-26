Product Requirements Document (PRD)

Project Name: N64WASM Challenge

Owner: Jake Berg
Date: Oct 2025
Version: 0.2 (Updated)

⸻

1. Objective

To build a browser-based Nintendo 64 emulator capable of loading and running Off Road Challenge directly within modern browsers (Chrome, Safari, Firefox) using Emscripten-compiled WebAssembly.
The project aims for a balance between accuracy, performance, and simplicity, delivering a functional demo and foundation for expansion.

⸻

2. Goals & Non-Goals

Goals
	•	Load and emulate Off Road Challenge within the browser at 30–60 FPS.
	•	Allow ROM upload via a simple file picker.
	•	Compile and run using the Libretro Mupen64Plus-Next core.
	•	Use Vite as the dev server and build tool.
	•	Persist saves using IDBFS (IndexedDB).
	•	Use GLideN64 via WebGL2 for rendering.
	•	Map gamepads and keyboard input via the Gamepad API.
	•	Implement audio output via AudioWorklet.

Non-Goals (for MVP)
	•	Online multiplayer or netplay.
	•	Advanced emulator configuration or debugging UI.
	•	Mobile Safari optimization beyond basic functionality.
	•	ROM hosting or distribution (must be user-provided only).

⸻

3. Key Users & Use Cases

Primary User

Retro gaming enthusiasts and developers exploring N64 emulation in the browser.

Use Cases
	1.	Play: Upload ROM, boot emulator, play immediately.
	2.	Persistence: Save files persist between sessions.
	3.	Dev Mode: Developers can rebuild easily, inspect performance, and adjust configuration through Vite.

⸻

4. Technical Overview

Core Architecture
	•	Frontend: TypeScript app built with Vite; controls ROM upload and emulator lifecycle.
	•	Core: Libretro Mupen64Plus-Next compiled to WebAssembly using Emscripten.
	•	Renderer: GLideN64 video plugin translated through Emscripten GLES to WebGL2.
	•	Audio: SDL2 audio bridge redirected to an AudioWorklet node.
	•	Saves: SRAM / EEPROM persisted via IDBFS.
	•	Input: Keyboard and Gamepad API events routed to Libretro core.

Diagram

flowchart LR
  subgraph Dev["macOS + Vite Server"]
    Vite["Vite Dev Server<br/>COOP / COEP headers"]
    Files["Project Files<br/>index.html, main.ts, n64-frontend.ts,<br/>core.js, core.wasm, assets/"]
  end

  subgraph Browser["Browser Runtime"]
    Frontend["Frontend (TypeScript)<br/>UI + ROM Upload"]
    Loader["Emscripten Loader<br/>(core.js)"]
    Core["Libretro Core<br/>(Mupen64Plus-Next)"]
    Vid["GLideN64 → WebGL2"]
    Aud["AudioWorklet → WebAudio"]
    Inp["Gamepad / Keyboard"]
    Storage["IDBFS / IndexedDB<br/>Persistent Saves"]
  end

  Vite -->|Serves| Browser
  Frontend --> Loader
  Loader --> Core
  Core --> Vid -->|"Frame Render"| Frontend
  Core --> Aud -->|"PCM Buffers"| Frontend
  Inp --> Core
  Core -->|"Save Writes"| Storage


⸻

5. Core Features

Feature	Description	Priority
ROM Upload	User selects .z64, .n64, or .v64 file	P0
WASM Boot Pipeline	Asynchronous module instantiation	P0
WebGL2 Rendering	GLideN64 video plugin mapped to <canvas>	P0
AudioWorklet	Low-latency sound output	P1
Gamepad + Keyboard Input	Input mapping via Web APIs	P1
Save Persistence	Auto-sync to IndexedDB	P1
Threaded Mode (Optional)	Use pthreads for RSP/RDP	P2
UI Overlay	Basic performance or FPS overlay	P3


⸻

6. Technical Requirements

Build Targets

Component	Toolchain / Flags
Emscripten	-O3 -msimd128 -mrelaxed-simd -s MODULARIZE=1 -s EXPORT_ES6=1 -s USE_SDL=2 -s FORCE_FILESYSTEM=1 -s EXPORTED_RUNTIME_METHODS=['FS','IDBFS','cwrap']
Vite Server	COOP/COEP headers for threads: same-origin, require-corp
Web APIs	WebGL2, AudioWorklet, Gamepad API, IndexedDB


⸻

7. Success Metrics

Category	Metric
Performance	≥30 FPS stable on M1 Mac Chrome
Load Time	<5 seconds to playable state
Persistence	Saves reliably restored after reload
UX Simplicity	1-click ROM upload to play
Bundle Size	<20 MB (gzipped) total


⸻

8. Milestones

Phase	Deliverable	Target
M1	Project scaffold with Vite + basic Emscripten loader	Week 1
M2	Libretro Mupen64Plus-Next builds to WASM	Week 2
M3	ROM loads and renders frames	Week 3
M4	Audio, input, and save persistence integrated	Week 4
M5	Stabilization + documentation polish	Week 5


⸻

9. Risks & Mitigation

Risk	Impact	Mitigation
WebAssembly memory limits	Medium	Enable ALLOW_MEMORY_GROWTH
Cross-origin isolation required	High	Vite headers configured correctly
Audio latency	Medium	Buffer + AudioWorklet smoothing
Safari compatibility	Medium	Fallback to unthreaded mode
ROM legality	High	Require user-supplied ROM only


⸻

10. Future Enhancements
	•	In-browser ROM library with metadata.
	•	Save states with thumbnails.
	•	Performance analyzer overlay.
	•	Optional shader filters (CRT, upscale, FXAA).
	•	Touch controls for mobile.

⸻

Core Decision:
Use Libretro Mupen64Plus-Next as the baseline N64 core for WebAssembly build.

⸻

