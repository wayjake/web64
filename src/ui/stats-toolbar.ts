// Stats Toolbar - Real-time display of FPS, audio, and volume metrics

import type { N64AudioSystem } from '../emulator/audio';

export class StatsToolbar {
  private fpsElement: HTMLElement;
  private volumeElement: HTMLElement;
  private sampleRateElement: HTMLElement;
  private bufferFillElement: HTMLElement;
  private audioStateElement: HTMLElement;

  // FPS tracking
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 0;

  // Audio system reference
  private audioSystem: N64AudioSystem | null = null;

  constructor() {
    this.fpsElement = document.getElementById('fps')!;
    this.volumeElement = document.getElementById('volume')!;
    this.sampleRateElement = document.getElementById('sampleRate')!;
    this.bufferFillElement = document.getElementById('bufferFill')!;
    this.audioStateElement = document.getElementById('audioState')!;
  }

  /**
   * Set the audio system reference for pulling stats
   */
  setAudioSystem(audioSystem: N64AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Call this every frame to track FPS
   */
  recordFrame(): void {
    this.frameCount++;

    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    // Update FPS display every 500ms
    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount / elapsed) * 1000);
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      this.updateDisplay();
    }
  }

  /**
   * Update all toolbar values
   */
  private updateDisplay(): void {
    // Update FPS
    this.fpsElement.textContent = this.currentFps.toString();

    // Update FPS color based on performance
    if (this.currentFps >= 55) {
      this.fpsElement.style.color = '#4ade80'; // Green - good
    } else if (this.currentFps >= 45) {
      this.fpsElement.style.color = '#fbbf24'; // Yellow - okay
    } else if (this.currentFps >= 30) {
      this.fpsElement.style.color = '#fb923c'; // Orange - poor
    } else {
      this.fpsElement.style.color = '#ef4444'; // Red - bad
    }

    // Update audio stats if available
    if (this.audioSystem) {
      const stats = this.audioSystem.getStats();

      // Volume
      const volumePercent = Math.round(stats.volume * 100);
      this.volumeElement.textContent = `${volumePercent}%`;

      // Sample rate
      this.sampleRateElement.textContent = `${(stats.sampleRate / 1000).toFixed(1)}kHz`;

      // Buffer fill
      const bufferFillPercent = Math.round((stats.bufferFill / 64000) * 100);
      this.bufferFillElement.textContent = `${bufferFillPercent}%`;

      // Buffer fill color based on health
      if (bufferFillPercent >= 40) {
        this.bufferFillElement.style.color = '#4ade80'; // Green - healthy
      } else if (bufferFillPercent >= 20) {
        this.bufferFillElement.style.color = '#fbbf24'; // Yellow - low
      } else {
        this.bufferFillElement.style.color = '#ef4444'; // Red - critical
      }

      // Audio state
      this.audioStateElement.textContent = stats.state;

      // Audio state color
      if (stats.state === 'running') {
        this.audioStateElement.style.color = '#4ade80'; // Green
      } else if (stats.state === 'suspended') {
        this.audioStateElement.style.color = '#fbbf24'; // Yellow
      } else {
        this.audioStateElement.style.color = '#ef4444'; // Red
      }
    }
  }

  /**
   * Force immediate update (useful after volume changes)
   */
  forceUpdate(): void {
    this.updateDisplay();
  }
}
