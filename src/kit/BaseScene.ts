import * as Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { AssetManager } from './AssetsManager';

/**
 * BaseScene — Enhanced Phaser.Scene base class
 *
 * Provides common helper methods to reduce boilerplate code.
 * AI-created game scenes should extend this class.
 *
 * Built-in managers (auto-injected):
 *   this.audio  — AudioManager (synth SFX + real audio)
 *   this.assets — AssetManager (manifest loading + procedural fallback)
 *
 * Example:
 *   class Level1 extends BaseScene {
 *     constructor() { super('Level1'); }
 *     create() {
 *       const ground = this.tileRow(16, 584, 'ground', 25);
 *       const player = this.spawnSprite(96, 552, 'hero', { collideWorldBounds: true });
 *       this.solidCollision(player, ground);
 *       this.audio.play('confirm');  // Synth SFX, no audio files needed
 *     }
 *   }
 */
export class BaseScene extends Phaser.Scene {

  /**
   * Global asset path prefix for all BaseScene instances.
   * Set this once at game init (e.g. in boot.ts):
   *   BaseScene.assetPrefix = '/game';
   *
   * Used by AssetManager and AudioManager to resolve paths.
   * Default '' = root deployment.
   */
  static assetPrefix = '';

  /** AudioManager — Web Audio synth + real audio unified management */
  public audio!: AudioManager;
  /** AssetManager — Declarative manifest loading + procedural fallback */
  public assets!: AssetManager;

  /** Override init to auto-inject managers before subclass logic. */
  init(data?: object): void {
    const prefix = BaseScene.assetPrefix;
    this.audio = new AudioManager(this, prefix);
    this.assets = new AssetManager(this, prefix);
    this.onInit(data);
  }

  /**
   * Subclass hook — override this instead of init() for custom init logic.
   * AudioManager and AssetManager are already available when this runs.
   */
  protected onInit(_data?: object): void {
    // Override in subclasses
  }

  /** Override shutdown to auto-cleanup managers. */
  shutdown(): void {
    this.audio?.destroy();
    this.assets?.reset();
    this.onShutdown();
  }

  /**
   * Subclass hook — override this instead of shutdown() for custom cleanup.
   */
  protected onShutdown(): void {
    // Override in subclasses
  }

  // ═══════════════════════════════════════════════════════════════
  //  ENTITY CREATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a physics-enabled sprite with common options.
   *
   * @param x — X position (center)
   * @param y — Y position (center)
   * @param texture — Texture key (must be preloaded)
   * @param opts — Common physics/visual options
   */
  spawnSprite(x: number, y: number, texture: string, opts?: {
    frame?: number;
    static?: boolean;
    gravity?: boolean;
    bounce?: number;
    collideWorldBounds?: boolean;
    immovable?: boolean;
    scale?: number;
    depth?: number;
    dragX?: number;
    maxVelocityX?: number;
    maxVelocityY?: number;
  }): Phaser.Physics.Arcade.Sprite {
    const sprite = this.physics.add.sprite(x, y, texture, opts?.frame);
    const body = sprite.body as Phaser.Physics.Arcade.Body;

    if (opts?.static) {
      body.setImmovable(true);
      body.setAllowGravity(false);
    }
    if (opts?.immovable) body.setImmovable(true);
    if (opts?.gravity === false) body.setAllowGravity(false);
    if (opts?.bounce !== undefined) body.setBounce(opts.bounce);
    if (opts?.collideWorldBounds) body.setCollideWorldBounds(true);
    if (opts?.scale) sprite.setScale(opts.scale);
    if (opts?.depth !== undefined) sprite.setDepth(opts.depth);
    if (opts?.dragX !== undefined) body.setDragX(opts.dragX);
    if (opts?.maxVelocityX !== undefined || opts?.maxVelocityY !== undefined) {
      body.setMaxVelocity(opts?.maxVelocityX ?? 10000, opts?.maxVelocityY ?? 10000);
    }

    return sprite;
  }

  /**
   * Create a row/grid of static physics tiles.
   * Returns a StaticGroup — use directly in collision calls.
   *
   * Example: `const ground = this.tileRow(16, 584, 'ground', 132);`
   */
  tileRow(x: number, y: number, texture: string, count: number, opts?: {
    stepX?: number;
    stepY?: number;
    frame?: number;
    depth?: number;
  }): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    const stepX = opts?.stepX ?? 32;
    const stepY = opts?.stepY ?? 0;

    for (let i = 0; i < count; i++) {
      const tile = group.create(
        x + i * stepX,
        y + i * stepY,
        texture,
        opts?.frame ?? 0
      ) as Phaser.Physics.Arcade.Sprite;
      if (opts?.depth !== undefined) tile.setDepth(opts.depth);
    }

    return group;
  }

  /**
   * Build a staircase of static tiles (ascending right).
   */
  buildStairs(x: number, groundY: number, texture: string, steps: number, opts?: {
    tileSize?: number;
    depth?: number;
  }): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    const size = opts?.tileSize ?? 32;

    for (let i = 0; i < steps; i++) {
      const tile = group.create(x + i * size, groundY - i * size, texture) as Phaser.Physics.Arcade.Sprite;
      if (opts?.depth !== undefined) tile.setDepth(opts.depth);
    }

    return group;
  }

  // ═══════════════════════════════════════════════════════════════
  //  COLLISION SETUP
  // ═══════════════════════════════════════════════════════════════

  /**
   * Solid blocking collision between two entities/groups.
   * Shorthand for `this.physics.add.collider(a, b, callback)`.
   */
  solidCollision(
    a: Phaser.Types.Physics.Arcade.ArcadeColliderType,
    b: Phaser.Types.Physics.Arcade.ArcadeColliderType,
    onCollide?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
  ): Phaser.Physics.Arcade.Collider {
    return this.physics.add.collider(a, b, onCollide, undefined, this);
  }

  /**
   * Overlap trigger between two entities/groups.
   * Shorthand for `this.physics.add.overlap(a, b, callback)`.
   */
  onOverlap(
    a: Phaser.Types.Physics.Arcade.ArcadeColliderType,
    b: Phaser.Types.Physics.Arcade.ArcadeColliderType,
    callback: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
  ): Phaser.Physics.Arcade.Collider {
    return this.physics.add.overlap(a, b, callback, undefined, this);
  }

  // ═══════════════════════════════════════════════════════════════
  //  TEXTURE UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate a procedural texture if it doesn't already exist.
   * Useful for prototyping without real assets.
   *
   * Example:
   *   this.ensureTexture('ground', 32, 32, g => {
   *     g.fillStyle(0x8b4513); g.fillRect(0, 0, 32, 32);
   *   });
   */
  ensureTexture(key: string, width: number, height: number,
    draw: (g: Phaser.GameObjects.Graphics) => void
  ) {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * Generate a spritesheet texture with multiple frames drawn left-to-right.
   * After generation, frames are automatically added to the texture.
   *
   * @param key — Texture key
   * @param frameWidth — Width of each frame
   * @param frameHeight — Height of each frame
   * @param frameCount — Number of frames
   * @param draw — Drawing function. Receives graphics + frame index + frame X offset.
   */
  ensureSpritesheet(key: string, frameWidth: number, frameHeight: number,
    frameCount: number,
    draw: (g: Phaser.GameObjects.Graphics, frameIndex: number, offsetX: number) => void
  ) {
    if (this.textures.exists(key)) return;
    const totalWidth = frameWidth * frameCount;
    const g = this.add.graphics();
    for (let i = 0; i < frameCount; i++) {
      draw(g, i, i * frameWidth);
    }
    g.generateTexture(key, totalWidth, frameHeight);
    g.destroy();

    // Add frame definitions
    const tex = this.textures.get(key);
    if (tex) {
      for (let i = 0; i < frameCount; i++) {
        tex.add(i.toString(), 0, i * frameWidth, 0, frameWidth, frameHeight);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ASSET UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Helper to load an asset. Best used in Scene.preload().
   */
  loadAsset(key: string, path: string, type: 'image' | 'spritesheet' | 'audio', opts?: { frameWidth?: number; frameHeight?: number }) {
    if (type === 'image') {
      this.load.image(key, path);
    } else if (type === 'spritesheet') {
      this.load.spritesheet(key, path, { frameWidth: opts?.frameWidth ?? 32, frameHeight: opts?.frameHeight ?? 32 });
    } else if (type === 'audio') {
      this.load.audio(key, path);
    }
  }

  /**
   * Quick camera setup: follow a sprite with optional bounds and deadzone.
   */
  setupCamera(target: Phaser.GameObjects.Sprite, opts?: {
    bounds?: { x: number; y: number; width: number; height: number };
    deadzone?: { width: number; height: number };
    zoom?: number;
  }) {
    const cam = this.cameras.main;
    cam.startFollow(target);
    if (opts?.bounds) {
      const b = opts.bounds;
      cam.setBounds(b.x, b.y, b.width, b.height);
    }
    if (opts?.deadzone) {
      cam.setDeadzone(opts.deadzone.width, opts.deadzone.height);
    }
    if (opts?.zoom !== undefined) {
      cam.setZoom(opts.zoom);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  SOUND HELPERS (delegates to AudioManager)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Play a sound effect.
   * @deprecated Use `this.audio.play(key)` directly.
   */
  playSFX(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    this.audio.play(key, { volume: opts?.volume as number | undefined });
  }

  /**
   * Play or swap background music.
   * @deprecated Use `this.audio.playBGM(key)` directly.
   */
  playBGM(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    this.audio.playBGM(key, { volume: opts?.volume as number | undefined });
  }

  // ═══════════════════════════════════════════════════════════════
  //  STATE & SYNC (DEPRECATED — use useGameStore.getState() directly)
  //
  //  The standard pattern for Phaser → Zustand communication is:
  //    import { useGameStore } from '@/store/useGameStore';
  //    useGameStore.getState().addScore(100);
  //    useGameStore.getState().setGameState('PLAYING');
  //
  //  These event-based methods below are kept for backward compatibility
  //  but should NOT be used in new code — they emit events that nobody
  //  listens to by default, causing silent state desync bugs.
  // ═══════════════════════════════════════════════════════════════

  /**
   * @deprecated Use `useGameStore.getState().addScore(amount)` instead.
   * This method emits a scene event that is NOT automatically connected
   * to the Zustand store.
   */
  addScore(amount: number) {
    this.events.emit('score_up', amount);
  }

  /**
   * @deprecated Use Zustand store directly. Example:
   *   `useGameStore.getState().setHp(hp)`
   * This method emits a scene event that is NOT automatically connected
   * to the Zustand store.
   */
  updateHp(hp: number) {
    this.events.emit('update-hp', hp);
  }

  /**
   * @deprecated Use `useGameStore.getState().setGameState(state)` instead.
   * This method emits a scene event that is NOT automatically connected
   * to the Zustand store.
   */
  setGameState(state: 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'MENU') {
    this.events.emit('game-state-change', state);
  }

  /**
   * Add a popup text message at (x, y). Use for damage numbers or secrets.
   */
  popupText(x: number, y: number, text: string, color = '#ffffff') {
    const txt = this.add.text(x, y, text, {
      fontSize: '20px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: txt, y: y - 50, alpha: 0, duration: 800,
      onComplete: () => txt.destroy()
    });
  }
}
