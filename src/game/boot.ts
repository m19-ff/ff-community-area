import * as Phaser from 'phaser';
import { GAME, ASSET_PREFIX } from './config';
import { BaseScene } from '@/kit/BaseScene';

// ─── Import your scenes here ───────────────────────────────────
// import { MyScene } from './scenes/MyScene';
// ────────────────────────────────────────────────────────────────

export function initGame(containerId: string): Phaser.Game {
  BaseScene.assetPrefix = ASSET_PREFIX;
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME.width,
    height: GAME.height,
    parent: containerId,
    backgroundColor: '#000000',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: GAME.gravity },
        debug: GAME.debug,
      },
    },
    scene: [
      // Add your scenes here, e.g.:
      // MyScene,
    ],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: dpr,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
  };

  return new Phaser.Game(config);
}
