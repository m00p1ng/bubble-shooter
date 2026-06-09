import { SoundEffects } from './SoundEffects';
import { MusicPlayer } from './MusicPlayer';
import { SFX_VOLUME, MUSIC_VOLUME } from '../config';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private sfx!: SoundEffects;
  private music!: MusicPlayer;
  private scene: any | null = null;
  private _muted = false;
  private sfxVolume = SFX_VOLUME;
  private musicVolume = MUSIC_VOLUME;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init(scene: any): void {
    this.scene = scene;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.sfx = new SoundEffects(this.ctx);
    this.music = new MusicPlayer(this.ctx);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  playPop(): void { if (!this._muted) this.sfx.playPop(); }
  playShoot(): void { if (!this._muted) this.sfx.playShoot(); }
  playBounce(): void { if (!this._muted) this.sfx.playBounce(); }
  playWin(): void { if (!this._muted) this.sfx.playWin(); }
  playLose(): void { if (!this._muted) this.sfx.playLose(); }
  playOrphanDrop(): void { if (!this._muted) this.sfx.playOrphanDrop(); }

  startMusic(type: 'menu' | 'game'): void {
    if (!this._muted && this.ctx) {
      this.music.start(type, this.musicVolume);
    }
  }

  stopMusic(): void {
    this.music?.stop();
  }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.scene) {
      this.scene.sound.mute = this._muted;
    }
    if (this._muted) {
      this.music?.stop();
    } else {
      this.music?.resume();
    }
  }

  isMuted(): boolean {
    return this._muted;
  }

  setSfxVolume(v: number): void { this.sfxVolume = v; }
  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.music?.setVolume(v);
  }
}
