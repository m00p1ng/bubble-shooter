export class MusicPlayer {
  private currentOscs: OscillatorNode[] = [];
  private currentGains: GainNode[] = [];
  private intervalId: number | null = null;
  private volume = 0.4;
  private type: 'menu' | 'game' | null = null;

  constructor(private ctx: AudioContext) {}

  start(type: 'menu' | 'game', volume: number): void {
    this.stop();
    this.volume = volume;
    this.type = type;
    if (type === 'menu') {
      this.startMenuMusic();
    } else {
      this.startGameMusic();
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentOscs.forEach((o) => {
      try { o.stop(); } catch { /* ignore */ }
    });
    this.currentOscs = [];
    this.currentGains = [];
    this.type = null;
  }

  resume(): void {
    if (this.type) {
      this.start(this.type, this.volume);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    this.currentGains.forEach((g) => {
      g.gain.setValueAtTime(v, this.ctx.currentTime);
    });
  }

  private startMenuMusic(): void {
    const freqs = [110, 164.81, 196];
    freqs.forEach((f) => this.addDrone(f, 4));
  }

  private startGameMusic(): void {
    const notes = [220, 277.18, 329.63, 440, 329.63, 277.18];
    let idx = 0;
    this.intervalId = window.setInterval(() => {
      const f = notes[idx % notes.length];
      idx++;
      this.playArpNote(f);
    }, 250);
  }

  private addDrone(freq: number, durationSec: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.5, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + durationSec);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }

  private playArpNote(freq: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
    this.currentOscs.push(osc);
    this.currentGains.push(gain);
  }
}
