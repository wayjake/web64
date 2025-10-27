// N64 Audio System - Frame-Synced Crystal Clear Audio
// Ties emulator frame rendering to audio buffer for smooth, glitch-free playback

import type { EmscriptenModule } from './loader';

const AUDIO_BUFFER_SIZE = 1024;  // Samples per audio callback
const SAMPLE_RATE = 44100;        // N64 audio sample rate (must match core)
const RING_BUFFER_SIZE = 64000;   // Ring buffer size (matches N64Wasm)

export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
  latencyHint: 'interactive' | 'balanced' | 'playback';
  volume: number;
}

export class N64AudioSystem {
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Ring buffer for audio samples
  private audioBufferResampled: Int16Array | null = null;
  private audioWritePosition: number = 0;
  private audioReadPosition: number = 0;
  private audioThreadLock: boolean = false;
  private audioBackOffCounter: number = 0;

  // Module reference
  private module: EmscriptenModule | null = null;

  // Audio stats
  private audioSkipCount: number = 0;
  private lastAudioTime: number = 0;
  private clipCount: number = 0;

  constructor(private config: AudioConfig = {
    sampleRate: SAMPLE_RATE,
    bufferSize: AUDIO_BUFFER_SIZE,
    latencyHint: 'interactive',
    volume: 0.5
  }) {}

  /**
   * Initialize the audio system
   * This sets up AudioContext, gain node, and connects to the emulator's audio buffer
   */
  async initialize(module: EmscriptenModule): Promise<void> {
    this.module = module;

    // Create audio context with low latency
    this.audioContext = new AudioContext({
      latencyHint: this.config.latencyHint,
      sampleRate: this.config.sampleRate,
    });

    console.log('[Audio] AudioContext created:', {
      sampleRate: this.audioContext.sampleRate,
      state: this.audioContext.state,
      baseLatency: this.audioContext.baseLatency,
      outputLatency: (this.audioContext as any).outputLatency,
    });

    // Create compressor to prevent clipping and improve audio quality
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;      // Start compressing at -24dB
    this.compressor.knee.value = 30;            // Smooth compression curve
    this.compressor.ratio.value = 12;           // 12:1 compression ratio (strong limiting)
    this.compressor.attack.value = 0.003;       // 3ms attack (fast response)
    this.compressor.release.value = 0.25;       // 250ms release (smooth)

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.config.volume;

    // Chain: ScriptProcessor → Compressor → Gain → Destination
    this.compressor.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Point to the emulator's audio buffer in HEAP memory
    // The C code writes audio samples here, we read them
    if (module._neilGetSoundBufferResampledAddress) {
      const bufferAddress = module._neilGetSoundBufferResampledAddress();
      this.audioBufferResampled = new Int16Array(
        module.HEAP16!.buffer,
        bufferAddress,
        RING_BUFFER_SIZE
      );
      console.log('[Audio] Connected to emulator audio buffer at address:', bufferAddress);
    } else {
      console.warn('[Audio] _neilGetSoundBufferResampledAddress not available');
    }

    // Create ScriptProcessor for audio processing
    // Note: ScriptProcessor is deprecated but still most reliable for this use case
    // AudioWorklet has issues with Emscripten's threading model
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.config.bufferSize,
      2, // 2 input channels
      2  // 2 output channels (stereo)
    );

    // Bind audio processing callback
    this.scriptProcessor.onaudioprocess = this.onAudioProcess.bind(this);
    this.scriptProcessor.connect(this.compressor);

    console.log('[Audio] ScriptProcessor created with buffer size:', this.config.bufferSize);

    // Resume audio context if needed (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      console.log('[Audio] AudioContext suspended, will resume on user interaction');
    }
  }

  /**
   * Resume audio context (required for browser autoplay policy)
   * Call this on user interaction (click, key press, etc.)
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[Audio] AudioContext resumed');
    }
  }

  /**
   * Check if we have enough samples buffered to play
   * Prevents audio crackling by ensuring buffer has data
   * Now checks for a safety margin beyond just the needed samples
   */
  private hasEnoughSamples(safetyMargin: number = 512): boolean {
    const samplesNeeded = this.config.bufferSize + safetyMargin;
    let readPositionTemp = this.audioReadPosition;
    let samplesAvailable = 0;

    // Count available samples in the ring buffer
    while (samplesAvailable < samplesNeeded * 2) { // *2 for stereo
      if (this.audioWritePosition !== readPositionTemp) {
        readPositionTemp += 2; // Stereo: 2 samples (L+R)
        samplesAvailable += 2;

        // Wrap around ring buffer
        if (readPositionTemp >= RING_BUFFER_SIZE) {
          readPositionTemp = 0;
        }
      } else {
        break; // No more samples available
      }
    }

    return samplesAvailable >= samplesNeeded * 2;
  }

  /**
   * Get current buffer fill level (0-1 scale)
   */
  private getBufferFillRatio(): number {
    let distance = this.audioWritePosition - this.audioReadPosition;

    // Handle wrap-around
    if (distance < 0) {
      distance += RING_BUFFER_SIZE;
    }

    return distance / RING_BUFFER_SIZE;
  }

  /**
   * Main audio processing callback
   * This is called by the browser when it needs more audio data
   * We sync the emulator frame loop to this callback for smooth audio
   */
  private onAudioProcess(event: AudioProcessingEvent): void {
    // Thread safety check
    if (this.audioThreadLock) {
      return;
    }
    this.audioThreadLock = true;

    try {
      const outputBuffer = event.outputBuffer;
      const outputLeft = outputBuffer.getChannelData(0);
      const outputRight = outputBuffer.getChannelData(1);

      // Back-off mechanism: if we're catching up from underrun, skip a cycle
      if (this.audioBackOffCounter > 0) {
        this.audioBackOffCounter--;
        // Fill with silence during back-off
        for (let i = 0; i < this.config.bufferSize; i++) {
          outputLeft[i] = 0;
          outputRight[i] = 0;
        }
        return;
      }

      // Get buffer fill level
      const bufferFill = this.getBufferFillRatio();

      // Update input controller (process gamepad state)
      if ((window as any).inputController?.update) {
        (window as any).inputController.update();
      }

      // Run emulator main loop - THIS IS THE KEY!
      // Tying frame rendering to audio ensures smooth, synchronized playback
      if (this.module?._runMainLoop) {
        this.module._runMainLoop();
      }

      // Get current write position from emulator
      if (this.module?._neilGetAudioWritePosition) {
        this.audioWritePosition = this.module._neilGetAudioWritePosition();
      }

      // Adaptive frame running: run more frames if buffer is low
      const framesToRun = bufferFill < 0.3 ? 2 : 1; // Run 2 frames if buffer < 30% full

      for (let i = 1; i < framesToRun; i++) {
        if (!this.hasEnoughSamples(256) && this.module?._runMainLoop) {
          this.module._runMainLoop();
          if (this.module?._neilGetAudioWritePosition) {
            this.audioWritePosition = this.module._neilGetAudioWritePosition();
          }
        }
      }

      let hadUnderrun = false;

      // Fill output buffer with audio samples from ring buffer
      for (let sample = 0; sample < this.config.bufferSize; sample++) {
        if (this.audioWritePosition !== this.audioReadPosition && this.audioBufferResampled) {
          // Read stereo samples (L, R) from ring buffer
          // Convert from Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
          let left = this.audioBufferResampled[this.audioReadPosition] / 32768.0;
          let right = this.audioBufferResampled[this.audioReadPosition + 1] / 32768.0;

          // Soft clipping to prevent harsh distortion
          // Apply gentle saturation if samples exceed ±0.95
          if (Math.abs(left) > 0.95) {
            left = Math.tanh(left * 0.9); // Soft saturation
            this.clipCount++;
          }
          if (Math.abs(right) > 0.95) {
            right = Math.tanh(right * 0.9); // Soft saturation
            this.clipCount++;
          }

          outputLeft[sample] = left;
          outputRight[sample] = right;

          this.audioReadPosition += 2; // Advance by 2 (stereo)

          // Wrap around ring buffer
          if (this.audioReadPosition >= RING_BUFFER_SIZE) {
            this.audioReadPosition = 0;
          }
        } else {
          // Buffer underrun - play silence and back off for 2 frames
          outputLeft[sample] = 0;
          outputRight[sample] = 0;
          hadUnderrun = true;
          this.audioSkipCount++;
        }
      }

      // If we had underrun, back off to let buffer fill
      if (hadUnderrun && this.audioBackOffCounter === 0) {
        this.audioBackOffCounter = 2; // Skip 2 audio callbacks to buffer
      }

      // Log audio stats occasionally
      const now = performance.now();
      if (now - this.lastAudioTime > 5000) { // Every 5 seconds
        const bufferFillRatio = this.getBufferFillRatio();
        if (this.audioSkipCount > 0 || this.clipCount > 0 || bufferFillRatio < 0.4) {
          console.log('[Audio] Stats:', {
            skipCount: this.audioSkipCount,
            clipCount: this.clipCount,
            bufferFillRatio: (bufferFillRatio * 100).toFixed(1) + '%',
            bufferFillSamples: Math.abs(this.audioWritePosition - this.audioReadPosition),
            readPos: this.audioReadPosition,
            writePos: this.audioWritePosition,
          });
        }
        this.audioSkipCount = 0;
        this.clipCount = 0;
        this.lastAudioTime = now;
      }
    } finally {
      this.audioThreadLock = false;
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
      this.config.volume = volume;
      console.log('[Audio] Volume set to:', volume);
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.config.volume;
  }

  /**
   * Mute/unmute audio
   */
  setMuted(muted: boolean): void {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.config.volume;
    }
  }

  /**
   * Get audio context state
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  /**
   * Get audio statistics
   */
  getStats() {
    return {
      sampleRate: this.audioContext?.sampleRate || 0,
      state: this.audioContext?.state || 'unknown',
      volume: this.config.volume,
      skipCount: this.audioSkipCount,
      readPosition: this.audioReadPosition,
      writePosition: this.audioWritePosition,
      bufferFill: Math.abs(this.audioWritePosition - this.audioReadPosition),
      latency: {
        base: this.audioContext?.baseLatency || 0,
        output: (this.audioContext as any)?.outputLatency || 0,
      }
    };
  }

  /**
   * Cleanup and disconnect audio
   */
  destroy(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBufferResampled = null;
    this.module = null;

    console.log('[Audio] System destroyed');
  }
}

/**
 * Create and initialize audio system
 */
export async function createAudioSystem(
  module: EmscriptenModule,
  config?: Partial<AudioConfig>
): Promise<N64AudioSystem> {
  const audioSystem = new N64AudioSystem(config as AudioConfig);
  await audioSystem.initialize(module);
  return audioSystem;
}
