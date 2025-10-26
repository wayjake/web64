// Simple test program to verify Emscripten toolchain
#include <stdio.h>
#include <emscripten.h>

// Export function to JavaScript
EMSCRIPTEN_KEEPALIVE
int add(int a, int b) {
    return a + b;
}

EMSCRIPTEN_KEEPALIVE
void hello_world() {
    printf("Hello from WebAssembly!\n");
}

int main() {
    printf("WebAssembly module initialized successfully!\n");
    return 0;
}
