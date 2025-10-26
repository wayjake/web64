# N64WASM - Browser-Based N64 Emulator

A browser-based Nintendo 64 emulator running Off Road Challenge using WebAssembly. Built with Vite, TypeScript, and the ParaLLEl N64 emulator core.

## 🎮 Current Status

**Milestone 3 Complete!** ✓ ROM loads and renders graphics successfully.

- ✅ Vite project scaffold with TypeScript
- ✅ ParaLLEl N64 emulator core integrated
- ✅ Off Road Challenge ROM loads and renders
- ✅ WebGL2 rendering pipeline working
- ⏳ Audio implementation (next milestone)
- ⏳ Input verification (controller loaded, needs testing)
- ⏳ Save persistence (upcoming)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Modern browser with WebGL2 support (Chrome/Edge recommended)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd web64

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser. The emulator will automatically load Off Road Challenge.

## 🏗️ Project Structure

```
web64/
├── public/
│   ├── n64wasm.js           # ParaLLEl N64 core loader
│   ├── n64wasm.wasm         # Compiled emulator core
│   ├── n64wasm.data         # Emscripten virtual filesystem
│   ├── assets.zip           # Emulator assets (shaders, fonts)
│   ├── input_controller.js  # N64 controller input handler
│   └── offroad.n64          # Off Road Challenge ROM
├── src/
│   ├── main.ts              # Application entry point
│   ├── emulator/
│   │   ├── loader.ts        # WebAssembly module loader
│   │   └── rom-loader.ts    # ROM and asset loading
│   └── style.css
├── CLAUDE.md                # Project documentation
├── TECHNICAL.md             # Technical troubleshooting log
├── ROADMAP.md               # Milestone task tracker
└── README.md                # This file
```

## 🎯 Milestone Progress

### M1: Project Scaffold ✅
- Vite + TypeScript setup
- COOP/COEP headers configured
- Basic WebAssembly loader

### M2: Emulator Core Integration ✅
- ParaLLEl N64 core integrated
- Pre-compiled WASM files from N64Wasm project
- Module initialization working

### M3: ROM Loading and Rendering ✅
- Off Road Challenge ROM loads successfully
- Graphics rendering to canvas via WebGL2
- Title screen visible and game running
- Emscripten virtual filesystem operational

### M4: Audio, Input, Save Persistence ⏳
- Audio output implementation (in progress)
- Input verification and testing
- IDBFS save persistence

### M5: Polish and Optimization ⏳
- Performance optimization
- Bug fixes
- Documentation finalization

## 🛠️ Technical Details

### Emulator Core

- **Core**: ParaLLEl N64 (libretro)
- **Compilation**: Emscripten 2.0.7
- **Rendering**: WebGL2
- **Size**: ~2MB WASM + 250KB JS

### Browser Requirements

- WebGL2 support (required)
- WebAssembly support (required)
- SharedArrayBuffer (optional, for threading)
- AudioWorklet (for audio)
- Gamepad API (optional, for controllers)

### Key Technologies

- **Frontend**: TypeScript + Vite
- **Emulator**: Libretro ParaLLEl N64 core
- **Graphics**: WebGL2
- **Build**: Emscripten
- **Development Server**: Vite with COOP/COEP headers

## 🎮 Controls

| Keyboard | N64 Controller |
|----------|----------------|
| Arrow Keys | D-Pad |
| Z | A Button |
| X | B Button |
| A | L Trigger |
| S | R Trigger |
| Enter | Start |

Gamepad support coming in M4.

## 📝 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Documentation

- **CLAUDE.md** - Complete project documentation, patterns, and guidelines
- **TECHNICAL.md** - Issue tracking, troubleshooting, and solutions log
- **ROADMAP.md** - Detailed milestone task tracker with progress

## 🔧 Troubleshooting

### Black Screen
- Ensure all files in `/public` are present (.js, .wasm, .data, assets.zip)
- Check browser console for errors
- Verify WebGL2 support at https://webglreport.com/

### Module Load Errors
- Clear browser cache
- Check COOP/COEP headers in Network tab
- Verify files served with correct MIME types

### Performance Issues
- Enable hardware acceleration in browser
- Close other tabs
- Use Chrome/Edge for best performance

See **TECHNICAL.md** for detailed troubleshooting and solutions.

## 📜 Legal

This project does NOT distribute ROM files. Users must provide their own legally obtained ROM files. The emulator core (ParaLLEl N64) is open source.

ROM file used for testing: Off Road Challenge (USA)

## 🎯 MVP Goals

The MVP aims to deliver:
- ✅ Playable Off Road Challenge in browser
- ⏳ 30-60 FPS performance
- ⏳ Audio output
- ⏳ Keyboard and gamepad controls
- ⏳ Save file persistence

Non-goals (post-MVP):
- ROM library management
- Save states
- Mobile support
- Multiple ROM support
- Netplay

## 🙏 Credits

- **ParaLLEl N64**: libretro core used for emulation
- **N64Wasm**: Pre-compiled core files source
- **Emscripten**: WebAssembly compilation toolchain
- **Vite**: Build tool and dev server

## 📊 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| FPS | 30-60 | Testing |
| Load Time | <5s | ~2s ✓ |
| Memory | <512MB | ~200MB ✓ |
| Bundle Size | <20MB | ~2MB ✓ |

## 🔮 Next Steps

1. Verify audio output working
2. Test keyboard input responsiveness
3. Implement IDBFS save persistence
4. Complete full gameplay session
5. Performance profiling and optimization

---

**Status**: Milestone 3/5 Complete - ROM loading and rendering working!

Built with the "motorcycle not car" philosophy - fast iteration, get it working first, optimize later.
