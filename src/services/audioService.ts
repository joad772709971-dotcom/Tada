
/**
 * Audio Service for JAM System Pro
 * Provides clean, short UI sounds using Web Audio API
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private async init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn("AudioContext not supported or blocked", e);
        return;
      }
    }
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("Could not resume AudioContext", e);
      }
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async playSuccess() {
    if (!this.enabled) return;
    await this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;
    
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, this.ctx.currentTime + 0.1); // E6

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {
      console.warn("Audio play interrupted or failed", e);
    }
  }

  async playError() {
    if (!this.enabled) return;
    await this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime); // A3
      osc.frequency.linearRampToValueAtTime(110, this.ctx.currentTime + 0.2); // A2

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio play interrupted or failed", e);
    }
  }

  async playPrint() {
    if (!this.enabled) return;
    await this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    try {
      // Simulate a mechanical "zip" sound
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize / 4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(3000, this.ctx.currentTime + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {
      console.warn("Audio play interrupted or failed", e);
    }
  }
}

export const audioService = new AudioService();
