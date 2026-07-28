import * as Phaser from 'phaser';

/**
 * Generate Mario-themed fallback textures procedurally.
 * Call this in BootScene.create() AFTER file assets have been loaded,
 * so procedural textures only generate as fallbacks for missing files.
 */
export function generateFallbackTextures(scene: Phaser.Scene) {
  const W = 32, H = 32;

  // ── Sky ──────────────────────────────────────────────────────────────
  if (!scene.textures.exists('sky')) {
    const g = scene.add.graphics();
    g.fillGradientStyle(0x5c94fc, 0x5c94fc, 0x87ceeb, 0x87ceeb);
    g.fillRect(0, 0, 800, 600);
    g.generateTexture('sky', 800, 600);
    g.destroy();
  }

  // ── Ground tile (32×32) ─────────────────────────────────────────────
  if (!scene.textures.exists('ground')) {
    const g = scene.add.graphics();
    g.fillStyle(0xc84c0c, 1); g.fillRect(0, 8, 32, 24);
    g.fillStyle(0x3a7d44, 1); g.fillRect(0, 0, 32, 10);
    g.fillStyle(0x5ab552, 1); g.fillRect(2, 0, 6, 4);
    g.lineStyle(1, 0xb04808, 0.3); g.strokeRect(0, 0, 32, 32);
    g.generateTexture('ground', 32, 32);
    g.destroy();
  }

  // ── Mario spritesheet (32×32 × 8 frames) ─────────────────────────────
  // 0=idle, 1-4=run, 5=jump, 6=crouch, 7=death
  if (!scene.textures.exists('mario')) {
    const m = scene.add.graphics();
    const red = 0xe52521, blue = 0x1565c0, skin = 0xfca044, brown = 0x4a2c0a;

    const drawMario = (fx: number, eyeX: number) => {
      m.fillStyle(red, 1); m.fillRect(fx + 8, 0, 16, 4);
      m.fillStyle(skin, 1); m.fillRect(fx + 6, 4, 20, 14);
      m.fillStyle(0xffffff, 1); m.fillRect(fx + eyeX, 7, 4, 4);
      m.fillStyle(0x222222, 1); m.fillRect(fx + eyeX + 2, 8, 2, 3);
      m.fillStyle(brown, 1); m.fillRect(fx + 8, 13, 10, 3);
      m.fillStyle(red, 1); m.fillRect(fx + 6, 18, 20, 8);
      m.fillStyle(blue, 1); m.fillRect(fx + 8, 22, 8, 8); m.fillRect(fx + 18, 22, 6, 8);
      m.fillStyle(skin, 1); m.fillRect(fx + 4, 18, 4, 6); m.fillRect(fx + 24, 18, 4, 6);
      m.fillStyle(0x5d3a1a, 1); m.fillRect(fx + 8, 28, 8, 4); m.fillRect(fx + 16, 28, 8, 4);
    };

    drawMario(0, 18);         // 0: idle
    drawMario(W * 1, 20);     // 1: run1
    drawMario(W * 2, 18);     // 2: run2
    drawMario(W * 3, 16);     // 3: run3
    drawMario(W * 4, 20);     // 4: run4
    drawMario(W * 5, 18);     // 5: jump
    // 6: crouch
    m.fillStyle(red, 1); m.fillRect(W * 6 + 8, 14, 16, 4);
    m.fillStyle(skin, 1); m.fillRect(W * 6 + 6, 18, 20, 10);
    m.fillStyle(red, 1); m.fillRect(W * 6 + 6, 24, 20, 6);
    m.fillStyle(blue, 1); m.fillRect(W * 6 + 8, 26, 8, 4);
    // 7: death
    drawMario(W * 7, 18);
    m.lineStyle(2, 0x222222, 1);
    m.lineBetween(W * 7 + 18, 7, W * 7 + 22, 11);
    m.lineBetween(W * 7 + 22, 7, W * 7 + 18, 11);

    m.generateTexture('mario', W * 8, H);
    m.destroy();

    const tex = scene.textures.get('mario');
    if (tex) {
      for (let i = 0; i < 8; i++) tex.add(i.toString(), 0, i * W, 0, W, H);
    }
  }

  // ── Goomba (32×32 × 2 frames) ────────────────────────────────────────
  if (!scene.textures.exists('goomba')) {
    const g = scene.add.graphics();
    // Frame 0: walk-left
    g.fillStyle(0x8b4513, 1); g.fillEllipse(16, 20, 26, 18);
    g.fillStyle(0xffffff, 1); g.fillCircle(10, 14, 4); g.fillCircle(22, 14, 4);
    g.fillStyle(0x222222, 1); g.fillCircle(10, 14, 2); g.fillCircle(22, 14, 2);
    g.lineStyle(2, 0x222222, 1); g.lineBetween(6, 10, 14, 12); g.lineBetween(26, 10, 18, 12);
    g.fillStyle(0x4a2c0a, 1); g.fillEllipse(8, 30, 10, 4); g.fillEllipse(24, 30, 10, 4);
    // Frame 1: walk-right (same art, mirrored in-game via flipX)
    g.fillStyle(0x8b4513, 1); g.fillEllipse(W + 16, 20, 26, 18);
    g.fillStyle(0xffffff, 1); g.fillCircle(W + 10, 14, 4); g.fillCircle(W + 22, 14, 4);
    g.fillStyle(0x222222, 1); g.fillCircle(W + 12, 14, 2); g.fillCircle(W + 20, 14, 2);
    g.lineStyle(2, 0x222222, 1); g.lineBetween(W + 6, 10, W + 14, 12); g.lineBetween(W + 26, 10, W + 18, 12);
    g.fillStyle(0x4a2c0a, 1); g.fillEllipse(W + 10, 30, 10, 4); g.fillEllipse(W + 22, 30, 10, 4);

    g.generateTexture('goomba', W * 2, H);
    g.destroy();

    const tex = scene.textures.get('goomba');
    if (tex) { 
      tex.add('0', 0, 0, 0, W, H); 
      tex.add('1', 0, W, 0, W, H); 
    }
  }

  // ── Coin (16×16 × 4 frames) ──────────────────────────────────────────
  if (!scene.textures.exists('coin')) {
    const c = scene.add.graphics();
    const cw = 16;
    for (let i = 0; i < 4; i++) {
      const fx = i * cw;
      const widthMod = i % 2 === 0 ? 7 : 4;
      c.fillStyle(0xffd700, 1); c.fillCircle(fx + 8, 8, widthMod);
      c.fillStyle(0xffea00, 1); c.fillCircle(fx + 8, 8, Math.max(widthMod - 2, 2));
      c.lineStyle(1, 0xd4a000, 1); c.strokeCircle(fx + 8, 8, widthMod);
    }
    c.generateTexture('coin', cw * 4, 16);
    c.destroy();

    const tex = scene.textures.get('coin');
    if (tex) { for (let i = 0; i < 4; i++) tex.add(i.toString(), 0, i * cw, 0, cw, 16); }
  }

  // ── Mushroom (32×32) ──────────────────────────────────────────────────
  if (!scene.textures.exists('mushroom')) {
    const mu = scene.add.graphics();
    mu.fillStyle(0xe52521, 1); mu.fillEllipse(16, 14, 28, 18);
    mu.fillStyle(0xffffff, 1); mu.fillCircle(10, 10, 4); mu.fillCircle(22, 10, 4); mu.fillCircle(16, 18, 3);
    mu.fillStyle(0xfce0b0, 1); mu.fillRoundedRect(10, 20, 12, 10, 2);
    mu.generateTexture('mushroom', 32, 32);
    mu.destroy();
  }

  // ── Question Block (32×32) ────────────────────────────────────────────
  if (!scene.textures.exists('qblock')) {
    const qb = scene.add.graphics();
    // Active block
    qb.fillStyle(0xffa500, 1); qb.fillRect(0, 0, 32, 32);
    qb.fillStyle(0xffc866, 1); qb.fillRect(0, 0, 32, 4); qb.fillRect(0, 0, 4, 32);
    qb.fillStyle(0xcc7000, 1); qb.fillRect(0, 28, 32, 4); qb.fillRect(28, 0, 4, 32);
    qb.fillStyle(0xffffff, 1);
    qb.fillRect(10, 6, 12, 3); qb.fillRect(20, 9, 3, 6); qb.fillRect(10, 15, 12, 3); qb.fillRect(10, 18, 3, 6);
    // Empty block (frame 1) — darker version
    qb.fillStyle(0x8b6914, 1); qb.fillRect(32, 0, 32, 32);
    qb.fillStyle(0xa07818, 1); qb.fillRect(32, 0, 32, 4); qb.fillRect(32, 0, 4, 32);
    qb.fillStyle(0x6b5010, 1); qb.fillRect(32, 28, 32, 4); qb.fillRect(60, 0, 4, 32);
    qb.generateTexture('qblock', 64, 32);
    qb.destroy();

    const tex = scene.textures.get('qblock');
    if (tex) { tex.add('0', 0, 0, 0, 32, 32); tex.add('1', 0, 32, 0, 32, 32); }
  }

  // ── Brick (32×32) ────────────────────────────────────────────────────
  if (!scene.textures.exists('brick')) {
    const b = scene.add.graphics();
    b.fillStyle(0xcd853f, 1); b.fillRect(0, 0, 32, 32);
    b.lineStyle(2, 0x8b5a2b, 1); b.strokeRect(0, 0, 32, 32);
    b.lineStyle(1, 0x8b5a2b, 1);
    b.lineBetween(0, 16, 32, 16); b.lineBetween(16, 0, 16, 16);
    b.lineBetween(8, 16, 8, 32); b.lineBetween(24, 16, 24, 32);
    b.generateTexture('brick', 32, 32);
    b.destroy();
  }

  // ── Pipe (48 × 64) — single image, not spritesheet ──────────────────
  if (!scene.textures.exists('pipe')) {
    const p = scene.add.graphics();
    p.fillStyle(0x2e8b2e, 1); p.fillRect(4, 0, 40, 64);
    p.fillStyle(0x3aad3a, 1); p.fillRect(4, 0, 40, 8); p.fillRect(4, 0, 8, 64);
    p.fillStyle(0x1a6b1a, 1); p.fillRect(36, 0, 8, 64);
    p.fillStyle(0x2e8b2e, 1); p.fillRect(0, 0, 48, 14);
    p.fillStyle(0x3aad3a, 1); p.fillRect(0, 0, 48, 6);
    p.generateTexture('pipe', 48, 64);
    p.destroy();
  }

  // ── Flagpole (8×300) ──────────────────────────────────────────────────
  if (!scene.textures.exists('flagpole')) {
    const f = scene.add.graphics();
    f.fillStyle(0xaaaaaa, 1); f.fillRect(2, 0, 4, 300);
    f.fillStyle(0xffff00, 1); f.fillCircle(4, 4, 4);
    f.generateTexture('flagpole', 8, 300);
    f.destroy();
  }

  // ── Flag (40×32) ──────────────────────────────────────────────────────
  if (!scene.textures.exists('flag')) {
    const fl = scene.add.graphics();
    fl.fillStyle(0x00c800, 1); fl.fillTriangle(0, 0, 0, 32, 40, 16);
    fl.fillStyle(0xffffff, 1); fl.fillCircle(12, 16, 4);
    fl.generateTexture('flag', 40, 32);
    fl.destroy();
  }

  // ── Flag base (32×32) ────────────────────────────────────────────────
  if (!scene.textures.exists('flagbase')) {
    const fb = scene.add.graphics();
    fb.fillStyle(0x8b4513, 1); fb.fillRect(8, 0, 16, 32);
    fb.fillStyle(0xa0522d, 1); fb.fillRect(0, 0, 32, 8);
    fb.generateTexture('flagbase', 32, 32);
    fb.destroy();
  }

  // ═══════════════════════════════════════════════════════════════
  //  TANK BATTLE CATEGORY
  // ═══════════════════════════════════════════════════════════════

  // ── Player Tank (32×32) ──────────────────────────────────────────────
  if (!scene.textures.exists('tank-player')) {
    const tp = scene.add.graphics();
    tp.fillStyle(0x3a7d44, 1); tp.fillRect(2, 2, 28, 28); // Body
    tp.fillStyle(0x2d5a35, 1); tp.fillRect(0, 0, 8, 32); tp.fillRect(24, 0, 8, 32); // Tracks
    tp.fillStyle(0x5ab552, 1); tp.fillCircle(16, 16, 8); // Turret
    tp.fillStyle(0x2d5a35, 1); tp.fillRect(14, 0, 4, 16); // Barrel (facing UP by default)
    tp.generateTexture('tank-player', 32, 32);
    tp.destroy();
  }

  // ── Enemy Tank (32×32) ───────────────────────────────────────────────
  if (!scene.textures.exists('tank-enemy')) {
    const te = scene.add.graphics();
    te.fillStyle(0x8b0000, 1); te.fillRect(2, 2, 28, 28); // Body
    te.fillStyle(0x5a0000, 1); te.fillRect(0, 0, 8, 32); te.fillRect(24, 0, 8, 32); // Tracks
    te.fillStyle(0xff4444, 1); te.fillCircle(16, 16, 8); // Turret
    te.fillStyle(0x5a0000, 1); te.fillRect(14, 0, 4, 16); // Barrel
    te.generateTexture('tank-enemy', 32, 32);
    te.destroy();
  }

  // ── Bullet (8×8) ─────────────────────────────────────────────────────
  if (!scene.textures.exists('bullet')) {
    const bu = scene.add.graphics();
    bu.fillStyle(0xffff00, 1); bu.fillCircle(4, 4, 3);
    bu.generateTexture('bullet', 8, 8);
    bu.destroy();
  }

  // ── Wall Brick (32×32) ───────────────────────────────────────────────
  if (!scene.textures.exists('wall-brick')) {
    const wb = scene.add.graphics();
    wb.fillStyle(0xc84c0c, 1); wb.fillRect(0, 0, 32, 32);
    wb.lineStyle(1, 0x000000, 0.3);
    wb.strokeRect(0, 0, 16, 16); wb.strokeRect(16, 0, 16, 16);
    wb.strokeRect(0, 16, 16, 16); wb.strokeRect(16, 16, 16, 16);
    wb.generateTexture('wall-brick', 32, 32);
    wb.destroy();
  }

  // ── Wall Steel (32×32) ───────────────────────────────────────────────
  if (!scene.textures.exists('wall-steel')) {
    const ws = scene.add.graphics();
    ws.fillStyle(0xaaaaaa, 1); ws.fillRect(0, 0, 32, 32);
    ws.fillStyle(0xcccccc, 1); ws.fillRect(2, 2, 28, 28);
    ws.lineStyle(2, 0xffffff, 1); ws.strokeRect(8, 8, 16, 16);
    ws.generateTexture('wall-steel', 32, 32);
    ws.destroy();
  }

  // ── Base Home (32×32) ───────────────────────────────────────────────
  if (!scene.textures.exists('base-home')) {
    const bh = scene.add.graphics();
    bh.fillStyle(0xffd700, 1); bh.fillRect(4, 4, 24, 24); // Eagle body
    bh.fillStyle(0x000000, 1); bh.fillTriangle(16, 4, 4, 28, 28, 28); // Silhouette
    bh.generateTexture('base-home', 32, 32);
    bh.destroy();
  }

  // ── Moving Stone Platform (64 × 16) ─────────────────────────────────
  if (!scene.textures.exists('stone-platform')) {
    const sp = scene.add.graphics();
    // Base platform
    sp.fillStyle(0x717171, 1); sp.fillRoundedRect(0, 0, 64, 16, 4);
    // Highlights & Details
    sp.fillStyle(0x919191, 1); sp.fillRect(0, 0, 64, 4);
    sp.fillStyle(0x4a4a4a, 1); sp.fillRect(0, 12, 64, 4);
    // Rivets
    sp.fillStyle(0x333333, 1);
    for (let x = 8; x < 64; x += 16) sp.fillCircle(x, 8, 2);
    
    sp.generateTexture('stone-platform', 64, 16);
    sp.destroy();
  }
}
