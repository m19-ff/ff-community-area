import * as Phaser from 'phaser';

/**
 * AudioManager — Web Audio synth + real audio unified management
 *
 * Design philosophy:
 *   1. Zero external dependencies: Built-in Web Audio synthesizer, produces sound without any audio files
 *   2. Real assets first: When the Phaser audio cache has a matching key, real audio is used automatically
 *   3. Non-intrusive: Returns native Phaser audio objects or plays directly, no private type wrappers
 *
 * Usage:
 *   // Load audio assets in Scene.preload():
 *   this.audio.load([
 *     { key: 'bgm_battle', path: ['/assets/audio/bgm/battle.ogg', '/assets/audio/bgm/battle.mp3'], category: 'bgm' },
 *     { key: 'sfx_punch',  path: '/assets/audio/sfx/punch.ogg' },
 *   ]);
 *   // Or load individually:
 *   this.audio.loadOne('sfx_kick', '/assets/audio/sfx/kick.ogg', 'sfx');
 *
 *   // Play in Scene.create() / update():
 *   this.audio.play('sfx_punch');       // Real audio (loaded)
 *   this.audio.play('punch');           // Synth SFX (auto-fallback when not loaded)
 *   this.audio.playBGM('bgm_battle');   // Looping background music
 *   this.audio.stopBGM();
 *   this.audio.setVolume('sfx', 0.8);
 *
 * Built-in synth presets (no loading required, ready to use):
 *   punch, kick, heavy_hit, block, ko, jump, land, dash, projectile,
 *   explosion, coin, powerup, hurt, select, confirm, cancel, countdown,
 *   round_start, victory, defeat, whoosh, click
 */

// ─── Types ──────────────────────────────────────────────────────

/** Volume category for grouped control */
export type AudioCategory = 'master' | 'sfx' | 'bgm' | 'ui';

/** Audio asset entry for loading */
export interface AudioLoadEntry {
  /** Cache key — used to play the sound later */
  key: string;
  /** File path, or array of paths for format fallback (e.g. ['.ogg', '.mp3']) */
  path: string | string[];
  /** Volume category for routing (default: 'sfx') */
  category?: AudioCategory;
}

/** Synth preset definition */
interface SynthPreset {
  /** Oscillator type */
  type: OscillatorType;
  /** Start frequency (Hz) */
  freq: number;
  /** End frequency (Hz), for pitch sweep */
  freqEnd?: number;
  /** Duration in seconds */
  duration: number;
  /** Gain (0-1) */
  gain: number;
  /** Gain decay end value (for envelope) */
  gainEnd?: number;
  /** Optional second oscillator for richness */
  detune?: number;
  /** Noise burst duration (seconds, 0 = none) */
  noise?: number;
  /** Noise gain */
  noiseGain?: number;
  /** Category for volume routing */
  category?: AudioCategory;
}

// ─── Synth Presets ──────────────────────────────────────────────

const PRESETS: Record<string, SynthPreset> = {
  // ── Combat ──
  punch: {
    type: 'square', freq: 200, freqEnd: 80, duration: 0.08,
    gain: 0.5, noise: 0.03, noiseGain: 0.4, category: 'sfx',
  },
  kick: {
    type: 'square', freq: 150, freqEnd: 50, duration: 0.12,
    gain: 0.55, noise: 0.04, noiseGain: 0.5, category: 'sfx',
  },
  heavy_hit: {
    type: 'sawtooth', freq: 120, freqEnd: 30, duration: 0.2,
    gain: 0.7, noise: 0.06, noiseGain: 0.6, category: 'sfx',
  },
  block: {
    type: 'triangle', freq: 800, freqEnd: 400, duration: 0.06,
    gain: 0.3, category: 'sfx',
  },
  ko: {
    type: 'sawtooth', freq: 300, freqEnd: 20, duration: 0.5,
    gain: 0.8, noise: 0.1, noiseGain: 0.5, category: 'sfx',
  },

  // ── Movement ──
  jump: {
    type: 'sine', freq: 300, freqEnd: 600, duration: 0.15,
    gain: 0.25, category: 'sfx',
  },
  land: {
    type: 'triangle', freq: 100, freqEnd: 40, duration: 0.08,
    gain: 0.3, noise: 0.02, noiseGain: 0.3, category: 'sfx',
  },
  dash: {
    type: 'sawtooth', freq: 500, freqEnd: 200, duration: 0.1,
    gain: 0.3, noise: 0.03, noiseGain: 0.2, category: 'sfx',
  },
  whoosh: {
    type: 'sine', freq: 400, freqEnd: 100, duration: 0.15,
    gain: 0.2, noise: 0.05, noiseGain: 0.15, category: 'sfx',
  },

  // ── Projectile ──
  projectile: {
    type: 'sine', freq: 600, freqEnd: 300, duration: 0.2,
    gain: 0.3, detune: 50, category: 'sfx',
  },
  explosion: {
    type: 'sawtooth', freq: 200, freqEnd: 10, duration: 0.4,
    gain: 0.6, noise: 0.15, noiseGain: 0.7, category: 'sfx',
  },

  // ── Collect / Power ──
  coin: {
    type: 'sine', freq: 988, freqEnd: 1319, duration: 0.12,
    gain: 0.2, category: 'sfx',
  },
  powerup: {
    type: 'sine', freq: 400, freqEnd: 1200, duration: 0.3,
    gain: 0.25, detune: 30, category: 'sfx',
  },
  hurt: {
    type: 'square', freq: 200, freqEnd: 100, duration: 0.15,
    gain: 0.4, category: 'sfx',
  },

  // ── UI ──
  select: {
    type: 'sine', freq: 600, duration: 0.05,
    gain: 0.15, category: 'ui',
  },
  confirm: {
    type: 'sine', freq: 800, freqEnd: 1000, duration: 0.1,
    gain: 0.2, category: 'ui',
  },
  cancel: {
    type: 'square', freq: 300, freqEnd: 150, duration: 0.1,
    gain: 0.15, category: 'ui',
  },
  click: {
    type: 'sine', freq: 1000, duration: 0.03,
    gain: 0.1, category: 'ui',
  },

  // ── Announcer / Round ──
  countdown: {
    type: 'triangle', freq: 440, duration: 0.15,
    gain: 0.3, category: 'sfx',
  },
  round_start: {
    type: 'sawtooth', freq: 200, freqEnd: 800, duration: 0.3,
    gain: 0.4, detune: 20, category: 'sfx',
  },
  victory: {
    type: 'sine', freq: 523, freqEnd: 784, duration: 0.4,
    gain: 0.3, detune: 10, category: 'sfx',
  },
  defeat: {
    type: 'sawtooth', freq: 300, freqEnd: 80, duration: 0.6,
    gain: 0.3, category: 'sfx',
  },
};

// ─── AudioManager Class ─────────────────────────────────────────

export class AudioManager {
  private scene: Phaser.Scene;
  private ctx: AudioContext | null = null;
  private volumes: Record<AudioCategory, number> = {
    master: 0.7,
    sfx: 0.8,
    bgm: 0.4,
    ui: 0.6,
  };
  private currentBGMKey: string | null = null;
  private currentBGM: Phaser.Sound.BaseSound | null = null;
  private customPresets: Record<string, SynthPreset> = {};
  private keyCategories: Map<string, AudioCategory> = new Map();
  private _muted = false;
  private prefix: string;

  /**
   * @param scene — Phaser scene
   * @param prefix — Path prefix for audio URLs (e.g. '/game' for sub-path deployment).
   *                  Default '' (root). Set via ASSET_PREFIX in config.ts.
   */
  constructor(scene: Phaser.Scene, prefix = '') {
    this.scene = scene;
    this.prefix = prefix.replace(/\/$/, '');
  }

  /** Resolve a path (or array of paths) with the configured prefix. */
  private resolvePath(path: string | string[]): string | string[] {
    if (!this.prefix) return path;
    if (Array.isArray(path)) {
      return path.map(p => this.resolveOne(p));
    }
    return this.resolveOne(path);
  }

  private resolveOne(p: string): string {
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith(this.prefix)) return p;
    return this.prefix + p;
  }

  // ═══════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Play a sound effect.
   * Priority: Phaser audio cache → synth preset → warn & skip.
   *
   * @param key — Sound key (e.g. 'punch', 'coin', or a loaded audio key)
   * @param opts — Optional Phaser sound config or { volume, pan }
   */
  play(key: string, opts?: { volume?: number; pan?: number; category?: AudioCategory }): void {
    if (this._muted) return;

    // 1. Real audio in Phaser cache? Use it.
    if (this.scene.cache.audio.exists(key)) {
      const cat = opts?.category ?? this.keyCategories.get(key) ?? 'sfx';
      const vol = this.effectiveVolume(cat, opts?.volume);
      this.scene.sound.play(key, { volume: vol });
      return;
    }

    // 2. Synth preset?
    const preset = this.customPresets[key] ?? PRESETS[key];
    if (preset) {
      this.synthPlay(preset, opts?.volume);
      return;
    }

    // 3. Unknown key
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AudioManager] Unknown sound: "${key}"`);
    }
  }

  /**
   * Play or swap background music.
   * Priority: Phaser audio cache → skip (synth BGM not supported — too complex).
   */
  playBGM(key: string, opts?: { volume?: number; loop?: boolean }): void {
    if (this.currentBGMKey === key) return;
    this.stopBGM();

    if (!this.scene.cache.audio.exists(key)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[AudioManager] BGM not in cache: "${key}" (synth BGM not supported)`);
      }
      return;
    }

    const vol = this.effectiveVolume('bgm', opts?.volume);
    this.currentBGMKey = key;
    this.currentBGM = this.scene.sound.add(key, {
      loop: opts?.loop ?? true,
      volume: vol,
    });
    this.currentBGM.play();
  }

  /** Stop current background music. */
  stopBGM(): void {
    if (this.currentBGM) {
      this.currentBGM.stop();
      this.currentBGM.destroy();
      this.currentBGM = null;
      this.currentBGMKey = null;
    }
  }

  /** Fade out current BGM over `duration` ms. */
  fadeBGM(duration = 1000): void {
    if (!this.currentBGM || !(this.currentBGM as Phaser.Sound.WebAudioSound).setVolume) return;
    const bgm = this.currentBGM as Phaser.Sound.WebAudioSound;
    const startVol = bgm.volume;
    this.scene.tweens.addCounter({
      from: startVol * 100,
      to: 0,
      duration,
      onUpdate: (tween) => {
        if (bgm && bgm.isPlaying) {
          const v = tween.getValue();
          if (v != null) bgm.setVolume(v / 100);
        }
      },
      onComplete: () => this.stopBGM(),
    });
  }

  // ── Volume Control ──────────────────────────────────────────

  /** Set volume for a category (0.0 - 1.0). */
  setVolume(category: AudioCategory, value: number): void {
    this.volumes[category] = Phaser.Math.Clamp(value, 0, 1);
    // Update live BGM volume
    if (category === 'bgm' || category === 'master') {
      if (this.currentBGM && (this.currentBGM as Phaser.Sound.WebAudioSound).setVolume) {
        (this.currentBGM as Phaser.Sound.WebAudioSound).setVolume(
          this.effectiveVolume('bgm')
        );
      }
    }
  }

  /** Get current volume for a category. */
  getVolume(category: AudioCategory): number {
    return this.volumes[category];
  }

  /** Mute / unmute all audio. */
  set muted(value: boolean) {
    this._muted = value;
    this.scene.sound.mute = value;
  }

  get muted(): boolean {
    return this._muted;
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUDIO ASSET LOADING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Queue audio files for loading. Call in `preload()`.
   * After load completes, `play(key)` will automatically use the real audio.
   *
   * @param assets — Array of { key, path, category? } or shorthand { key, path }
   *
   * Example:
   *   this.audio.load([
   *     { key: 'bgm_battle', path: ['/assets/audio/bgm/battle.ogg', '/assets/audio/bgm/battle.mp3'] },
   *     { key: 'sfx_punch',  path: '/assets/audio/sfx/punch.ogg' },
   *     { key: 'sfx_kick',   path: '/assets/audio/sfx/kick.mp3', category: 'sfx' },
   *   ]);
   */
  load(assets: AudioLoadEntry[]): void {
    const loader = this.scene.load;
    for (const entry of assets) {
      if (!this.scene.cache.audio.exists(entry.key)) {
        loader.audio(entry.key, this.resolvePath(entry.path));
        // Track category mapping for volume routing
        if (entry.category) {
          this.keyCategories.set(entry.key, entry.category);
        }
      }
    }
  }

  /**
   * Load a single audio file. Call in `preload()`.
   *
   * @param key — Cache key for later playback
   * @param path — File path or array of paths for format fallback
   * @param category — Volume category (default: 'sfx')
   *
   * Example:
   *   this.audio.loadOne('bgm_menu', ['/assets/audio/bgm/menu.ogg', '/assets/audio/bgm/menu.mp3'], 'bgm');
   */
  loadOne(key: string, path: string | string[], category?: AudioCategory): void {
    if (!this.scene.cache.audio.exists(key)) {
      this.scene.load.audio(key, this.resolvePath(path));
      if (category) {
        this.keyCategories.set(key, category);
      }
    }
  }

  /**
   * Check if an audio key is loaded (either in Phaser cache or as synth preset).
   */
  has(key: string): boolean {
    return this.scene.cache.audio.exists(key)
      || key in PRESETS
      || key in this.customPresets;
  }

  /**
   * Get the volume category mapped to a loaded audio key.
   * Falls back to 'sfx' if not explicitly set.
   */
  getCategoryForKey(key: string): AudioCategory {
    return this.keyCategories.get(key) ?? 'sfx';
  }

  // ── Custom Presets ──────────────────────────────────────────

  /**
   * Register custom synth presets at runtime.
   * Games can define their own sound palette beyond the built-in set.
   *
   * @param presets — Record of key → SynthPreset
   *
   * Example:
   *   this.audio.registerPresets({
   *     laser: { type: 'sine', freq: 1200, freqEnd: 200, duration: 0.15, gain: 0.3 },
   *   });
   *   this.audio.play('laser');
   */
  registerPresets(presets: Record<string, SynthPreset>): void {
    Object.assign(this.customPresets, presets);
  }

  /** Get a list of all available synth preset keys (built-in + custom). */
  get presetKeys(): string[] {
    return [...Object.keys(PRESETS), ...Object.keys(this.customPresets)];
  }

  // ── Cleanup ─────────────────────────────────────────────────

  /** Call in scene shutdown to release resources. */
  destroy(): void {
    this.stopBGM();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => { });
    }
    this.ctx = null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  INTERNAL — Web Audio Synthesizer
  // ═══════════════════════════════════════════════════════════════

  private ensureContext(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private effectiveVolume(category: AudioCategory, override?: number): number {
    const base = override ?? this.volumes[category];
    return base * this.volumes.master;
  }

  private synthPlay(preset: SynthPreset, volumeOverride?: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const cat = preset.category ?? 'sfx';
    const vol = this.effectiveVolume(cat, volumeOverride) * preset.gain;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.gain.linearRampToValueAtTime(
      preset.gainEnd ?? 0.001, now + preset.duration
    );
    masterGain.connect(ctx.destination);

    // Primary oscillator
    const osc = ctx.createOscillator();
    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.freq, now);
    if (preset.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(preset.freqEnd, 1), now + preset.duration
      );
    }
    if (preset.detune) {
      osc.detune.setValueAtTime(preset.detune, now);
    }
    osc.connect(masterGain);
    osc.start(now);
    osc.stop(now + preset.duration + 0.01);

    // Optional noise layer (for impact sounds)
    if (preset.noise && preset.noise > 0) {
      const noiseDur = preset.noise;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime((preset.noiseGain ?? 0.3) * vol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
      noiseGain.connect(ctx.destination);

      const bufferSize = Math.ceil(ctx.sampleRate * noiseDur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.connect(noiseGain);
      noise.start(now);
      noise.stop(now + noiseDur + 0.01);
    }
  }
}
