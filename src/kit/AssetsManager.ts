import * as Phaser from 'phaser';

/**
 * AssetManager — Declarative visual asset manifest loading + procedural fallback
 *
 * Design philosophy:
 *   1. Declarative manifest: Declare all visual assets in a centralized manifest, loaded at once in BootScene
 *   2. Graceful degradation: When real assets fail to load → automatically invokes procedural texture generators as fallback
 *   3. Non-intrusive: Uses native Phaser loader internally, no private cache layer
 *   4. Single responsibility: Only manages visual assets (images/spritesheets/tilemaps); audio is managed by AudioManager
 *
 * Usage:
 *   // 1. Define manifest
 *   const manifest: AssetManifest = {
 *     images: [
 *       { key: 'bg_city', path: '/assets/images/city.png' },
 *       { key: 'ground',  path: '/assets/images/ground.png' },
 *     ],
 *     spritesheets: [
 *       { key: 'hero', path: '/assets/spritesheets/hero.png', frameWidth: 64, frameHeight: 64 },
 *     ],
 *     tilemaps: [
 *       { key: 'level1', path: '/assets/tilemaps/level1.json' },
 *     ],
 *   };
 *
 *   // 2. In BootScene.preload():
 *   this.assets.loadManifest(manifest);
 *   this.audio.load([...]);  // Audio via AudioManager
 *
 *   // 3. In BootScene.create():
 *   this.assets.applyFallbacks(fallbackMap);
 *
 * Directory conventions:
 *   public/assets/
 *   ├── images/       # Static images
 *   ├── spritesheets/ # Character/animation sprite sheets
 *   └── tilemaps/     # Tiled-exported JSON + tilesets
 *
 * For audio assets, use AudioManager:
 *   this.audio.load([{ key, path, category }])
 *   this.audio.loadOne(key, path, category)
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ImageAsset {
  key: string;
  path: string;
}

export interface SpritesheetAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  /** Number of frames (optional, Phaser auto-detects) */
  frameCount?: number;
  /** Spacing between frames in pixels */
  spacing?: number;
  /** Margin around frames in pixels */
  margin?: number;
}

export interface TilemapAsset {
  key: string;
  path: string;
}

export interface AssetManifest {
  images?: ImageAsset[];
  spritesheets?: SpritesheetAsset[];
  tilemaps?: TilemapAsset[];
}

/**
 * Fallback generator map.
 * Keys match asset keys; values are functions that generate procedural textures
 * when the real asset fails to load.
 *
 * Example:
 *   {
 *     hero: (scene) => scene.ensureSpritesheet('hero', 64, 64, 8, (g, i, ox) => { ... }),
 *     ground: (scene) => scene.ensureTexture('ground', 32, 32, (g) => { ... }),
 *   }
 */
export type FallbackMap = Record<string, (scene: Phaser.Scene) => void>;

// ─── AssetManager Class ─────────────────────────────────────────

export class AssetManager {
  private scene: Phaser.Scene;
  private manifestKeys: Set<string> = new Set();
  private failedKeys: Set<string> = new Set();
  private prefix: string;

  /**
   * @param scene — Phaser scene
   * @param prefix — Path prefix for all asset URLs (e.g. '/game' for sub-path deployment).
   *                  Default '' (root). Set via ASSET_PREFIX in config.ts.
   */
  constructor(scene: Phaser.Scene, prefix = '') {
    this.scene = scene;
    this.prefix = prefix.replace(/\/$/, ''); // strip trailing slash
  }

  /** Resolve a path with the configured prefix. */
  private resolvePath(path: string): string {
    if (!this.prefix || path.startsWith('http') || path.startsWith('data:')) return path;
    // Avoid double-prefix
    if (path.startsWith(this.prefix)) return path;
    return this.prefix + path;
  }

  // ═══════════════════════════════════════════════════════════════
  //  MANIFEST LOADING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Queue all visual assets in the manifest for loading.
   * Call this in `preload()`. Phaser's loader will fetch them.
   *
   * For audio loading, use `this.audio.load()` instead (AudioManager).
   *
   * Automatically tracks which keys are in the manifest and
   * listens for load failures to populate the fallback list.
   */
  loadManifest(manifest: AssetManifest): void {
    const loader = this.scene.load;

    // Track load failures
    loader.on('loaderror', (file: Phaser.Loader.File) => {
      this.failedKeys.add(file.key);
    });

    // Images
    if (manifest.images) {
      for (const img of manifest.images) {
        this.manifestKeys.add(img.key);
        if (!this.scene.textures.exists(img.key)) {
          loader.image(img.key, this.resolvePath(img.path));
        }
      }
    }

    // Spritesheets
    if (manifest.spritesheets) {
      for (const ss of manifest.spritesheets) {
        this.manifestKeys.add(ss.key);
        if (!this.scene.textures.exists(ss.key)) {
          loader.spritesheet(ss.key, this.resolvePath(ss.path), {
            frameWidth: ss.frameWidth,
            frameHeight: ss.frameHeight,
            spacing: ss.spacing,
            margin: ss.margin,
          });
        }
      }
    }

    // Tilemaps
    if (manifest.tilemaps) {
      for (const tm of manifest.tilemaps) {
        this.manifestKeys.add(tm.key);
        loader.tilemapTiledJSON(tm.key, this.resolvePath(tm.path));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  FALLBACK APPLICATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Apply procedural fallbacks for any visual assets that failed to load.
   * Call this in `create()` AFTER preload completes.
   *
   * @param fallbacks — Map of key → generator function
   * @returns Array of keys that used fallback generation
   */
  applyFallbacks(fallbacks: FallbackMap): string[] {
    const applied: string[] = [];

    for (const [key, generator] of Object.entries(fallbacks)) {
      // Generate fallback if: asset failed OR texture doesn't exist
      const needsFallback = this.failedKeys.has(key)
        || !this.scene.textures.exists(key);

      if (needsFallback) {
        try {
          generator(this.scene);
          applied.push(key);
        } catch (err) {
          console.error(`[AssetManager] Fallback generation failed for "${key}":`, err);
        }
      }
    }

    if (applied.length > 0 && process.env.NODE_ENV !== 'production') {
      console.info(`[AssetManager] Procedural fallbacks applied for: ${applied.join(', ')}`);
    }

    return applied;
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUERY API
  // ═══════════════════════════════════════════════════════════════

  /** Check if a specific asset key failed to load from the network. */
  didFail(key: string): boolean {
    return this.failedKeys.has(key);
  }

  /** Check if a texture exists (either loaded or fallback-generated). */
  hasTexture(key: string): boolean {
    return this.scene.textures.exists(key);
  }

  /** Get all keys that were declared in the manifest. */
  get declaredKeys(): string[] {
    return [...this.manifestKeys];
  }

  /** Get all keys that failed to load. */
  get failedAssets(): string[] {
    return [...this.failedKeys];
  }

  // ═══════════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convenience: load a single visual asset outside of a manifest.
   * Useful for lazy-loading in later scenes.
   *
   * For audio, use `this.audio.loadOne()` instead.
   *
   * Returns a promise that resolves when the asset is loaded.
   */
  loadSingle(asset: ImageAsset | SpritesheetAsset, type: 'image' | 'spritesheet'): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = this.scene.load;

      loader.once('complete', () => resolve());
      loader.once('loaderror', (file: Phaser.Loader.File) => {
        if (file.key === asset.key) {
          this.failedKeys.add(asset.key);
          reject(new Error(`Failed to load ${type}: ${asset.key}`));
        }
      });

      if (type === 'image') {
        loader.image(asset.key, this.resolvePath((asset as ImageAsset).path));
      } else if (type === 'spritesheet') {
        const ss = asset as SpritesheetAsset;
        loader.spritesheet(ss.key, this.resolvePath(ss.path), {
          frameWidth: ss.frameWidth,
          frameHeight: ss.frameHeight,
          spacing: ss.spacing,
          margin: ss.margin,
        });
      }

      loader.start();
    });
  }

  /** Reset tracking state (call when switching games/levels). */
  reset(): void {
    this.manifestKeys.clear();
    this.failedKeys.clear();
  }
}
