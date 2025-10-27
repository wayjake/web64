// Manual SDL keyboard event injection
// This bridges browser keyboard events to SDL input

import { EmscriptenModule } from './loader';

/**
 * SDL key codes mapping
 * Based on SDL_scancode.h from SDL2
 */
const SDL_SCANCODE = {
  // Arrow keys
  UP: 82,
  DOWN: 81,
  LEFT: 80,
  RIGHT: 79,

  // Letters
  A: 4,
  B: 5,
  C: 6,
  D: 7,
  E: 8,
  F: 9,
  G: 10,
  H: 11,
  I: 12,
  J: 13,
  K: 14,
  L: 15,
  M: 16,
  N: 17,
  O: 18,
  P: 19,
  Q: 20,
  R: 21,
  S: 22,
  T: 23,
  U: 24,
  V: 25,
  W: 26,
  X: 27,
  Y: 28,
  Z: 29,

  // Numbers
  1: 30,
  2: 31,
  3: 32,
  4: 33,
  5: 34,
  6: 35,
  7: 36,
  8: 37,
  9: 38,
  0: 39,

  // Special keys
  RETURN: 40,
  ESCAPE: 41,
  BACKSPACE: 42,
  TAB: 43,
  SPACE: 44,

  // More special keys
  MINUS: 45,
  EQUALS: 46,
  LEFTBRACKET: 47,
  RIGHTBRACKET: 48,
  BACKSLASH: 49,
  SEMICOLON: 51,
  APOSTROPHE: 52,
  GRAVE: 53,
  COMMA: 54,
  PERIOD: 55,
  SLASH: 56,
};

/**
 * Map browser KeyboardEvent.key to SDL scancode
 */
function keyToScancode(key: string): number | null {
  // Arrow keys
  if (key === 'ArrowUp') return SDL_SCANCODE.UP;
  if (key === 'ArrowDown') return SDL_SCANCODE.DOWN;
  if (key === 'ArrowLeft') return SDL_SCANCODE.LEFT;
  if (key === 'ArrowRight') return SDL_SCANCODE.RIGHT;

  // Special keys
  if (key === 'Enter') return SDL_SCANCODE.RETURN;
  if (key === 'Escape') return SDL_SCANCODE.ESCAPE;
  if (key === 'Backspace') return SDL_SCANCODE.BACKSPACE;
  if (key === 'Tab') return SDL_SCANCODE.TAB;
  if (key === ' ') return SDL_SCANCODE.SPACE;

  // Single letter keys (a-z)
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') {
      return SDL_SCANCODE[upper as keyof typeof SDL_SCANCODE] as number;
    }
    // Numbers
    if (upper >= '0' && upper <= '9') {
      return SDL_SCANCODE[upper as keyof typeof SDL_SCANCODE] as number;
    }
  }

  // Punctuation
  if (key === '-') return SDL_SCANCODE.MINUS;
  if (key === '=') return SDL_SCANCODE.EQUALS;
  if (key === '[') return SDL_SCANCODE.LEFTBRACKET;
  if (key === ']') return SDL_SCANCODE.RIGHTBRACKET;
  if (key === '\\') return SDL_SCANCODE.BACKSLASH;
  if (key === ';') return SDL_SCANCODE.SEMICOLON;
  if (key === '\'') return SDL_SCANCODE.APOSTROPHE;
  if (key === '`') return SDL_SCANCODE.GRAVE;
  if (key === ',') return SDL_SCANCODE.COMMA;
  if (key === '.') return SDL_SCANCODE.PERIOD;
  if (key === '/') return SDL_SCANCODE.SLASH;

  return null;
}

/**
 * Initialize manual keyboard input bridge to SDL
 * This captures keyboard events and injects them directly into SDL's event queue
 */
export function initializeKeyboardInput(Module: EmscriptenModule, canvas: HTMLCanvasElement) {
  console.log('[Input] Initializing manual SDL keyboard bridge');

  // Inspect what SDL structure exists
  const SDL = (window as any).SDL;
  console.log('[Input] SDL object:', SDL);
  console.log('[Input] SDL keys:', SDL ? Object.keys(SDL) : 'SDL is undefined');

  // Check Module for SDL-related functions
  console.log('[Input] Module._SDL_PushEvent:', typeof (Module as any)._SDL_PushEvent);
  console.log('[Input] Module.SDL:', (Module as any).SDL);

  // Check if there's a keyboard state array we can write to directly
  if ((Module as any).HEAP8) {
    console.log('[Input] Module.HEAP8 available - can potentially write to SDL keyboard state');
  }

  // Store keyboard state in a more direct way
  const keyState = new Uint8Array(512); // SDL keyboard state array

  const handleKeyDown = (event: KeyboardEvent) => {
    const scancode = keyToScancode(event.key);

    if (scancode !== null) {
      console.log(`[Input] Key DOWN: ${event.key} -> scancode ${scancode}`);

      // Update our local state
      keyState[scancode] = 1;

      // Method 1: Try SDL.events array
      const SDL = (window as any).SDL;
      if (SDL && SDL.events) {
        try {
          SDL.events.push({
            type: 'keydown',
            keyCode: scancode,
          });
          console.log('[Input] Pushed to SDL.events');
        } catch (e) {
          console.warn('[Input] Failed to push to SDL.events:', e);
        }
      }

      // Method 2: Try calling Module._SDL_PushEvent if it exists
      if (typeof (Module as any)._SDL_PushEvent === 'function') {
        try {
          // SDL_KEYDOWN event type is 0x300
          (Module as any)._SDL_PushEvent(0x300, scancode);
          console.log('[Input] Called Module._SDL_PushEvent');
        } catch (e) {
          console.warn('[Input] Failed to call _SDL_PushEvent:', e);
        }
      }

      // Method 3: Let the event propagate naturally to canvas
      // Don't prevent default to allow SDL's built-in handlers to work
      // event.preventDefault();
      // event.stopPropagation();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const scancode = keyToScancode(event.key);

    if (scancode !== null) {
      console.log(`[Input] Key UP: ${event.key} -> scancode ${scancode}`);

      // Update our local state
      keyState[scancode] = 0;

      // Method 1: Try SDL.events array
      const SDL = (window as any).SDL;
      if (SDL && SDL.events) {
        try {
          SDL.events.push({
            type: 'keyup',
            keyCode: scancode,
          });
          console.log('[Input] Pushed to SDL.events');
        } catch (e) {
          console.warn('[Input] Failed to push to SDL.events:', e);
        }
      }

      // Method 2: Try calling Module._SDL_PushEvent if it exists
      if (typeof (Module as any)._SDL_PushEvent === 'function') {
        try {
          // SDL_KEYUP event type is 0x301
          (Module as any)._SDL_PushEvent(0x301, scancode);
          console.log('[Input] Called Module._SDL_PushEvent');
        } catch (e) {
          console.warn('[Input] Failed to call _SDL_PushEvent:', e);
        }
      }

      // Method 3: Let the event propagate naturally to canvas
      // Don't prevent default to allow SDL's built-in handlers to work
      // event.preventDefault();
      // event.stopPropagation();
    }
  };

  // Listen on document for maximum compatibility
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Also listen on canvas
  canvas.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('keyup', handleKeyUp);

  console.log('[Input] Keyboard event listeners attached');

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    canvas.removeEventListener('keydown', handleKeyDown);
    canvas.removeEventListener('keyup', handleKeyUp);
  };
}
