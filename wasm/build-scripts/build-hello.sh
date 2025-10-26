#!/bin/bash
# Build script for hello-world test WebAssembly module

set -e  # Exit on error

echo "Building hello-world WebAssembly module..."

# Navigate to wasm directory
cd "$(dirname "$0")/.."

# Compile with Emscripten (non-modular for easy script loading)
emcc hello.c \
  -O3 \
  -s EXPORTED_FUNCTIONS='["_add","_hello_world","_main"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web \
  -o ../public/hello.js

echo "Build complete! Output: public/hello.js and public/hello.wasm"
