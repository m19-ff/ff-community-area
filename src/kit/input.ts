import * as Phaser from 'phaser';

/**
 * UnifiedInput — Keyboard + Virtual Joystick unified input abstraction
 *
 * Usage:
 *   const input = new UnifiedInput(scene);
 *   // in update():
 *   if (input.left) player.moveLeft();
 *   if (input.jumpJustPressed) player.jump();
 */
export class UnifiedInput {
  // Keyboard state
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private shiftKey: Phaser.Input.Keyboard.Key;
  private spaceKey: Phaser.Input.Keyboard.Key;

  // Virtual joystick state (set externally by VirtualJoystick entity)
  private _virtualLeft = false;
  private _virtualRight = false;
  private _virtualUp = false;
  private _virtualDown = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  // ── Directional State ──────────────────────────────────────────────

  get left(): boolean {
    return this.cursors.left.isDown || this.wasd.A.isDown || this._virtualLeft;
  }

  get right(): boolean {
    return this.cursors.right.isDown || this.wasd.D.isDown || this._virtualRight;
  }

  get up(): boolean {
    return this.cursors.up.isDown || this.wasd.W.isDown || this._virtualUp;
  }

  get down(): boolean {
    return this.cursors.down.isDown || this.wasd.S.isDown || this._virtualDown;
  }

  /** Jump input: up arrow, W, or space */
  get jump(): boolean {
    return this.up || this.spaceKey.isDown;
  }

  get jumpJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.wasd.W)
      || Phaser.Input.Keyboard.JustDown(this.spaceKey);
  }

  get sprint(): boolean {
    return this.shiftKey.isDown;
  }

  /** Horizontal axis: -1 (left), 0, or +1 (right) */
  get axisX(): number {
    if (this.left) return -1;
    if (this.right) return 1;
    return 0;
  }

  /** Vertical axis: -1 (up), 0, or +1 (down) */
  get axisY(): number {
    if (this.up) return -1;
    if (this.down) return 1;
    return 0;
  }

  // ── Virtual Joystick Interface ──────────────────────────────────────

  setVirtual(direction: 'left' | 'right' | 'up' | 'down', isDown: boolean) {
    switch (direction) {
      case 'left': this._virtualLeft = isDown; break;
      case 'right': this._virtualRight = isDown; break;
      case 'up': this._virtualUp = isDown; break;
      case 'down': this._virtualDown = isDown; break;
    }
  }

  clearVirtual() {
    this._virtualLeft = false;
    this._virtualRight = false;
    this._virtualUp = false;
    this._virtualDown = false;
  }
}

/**
 * VirtualJoystick — On-screen touch joystick
 *
 * Creates a visual joystick on the game canvas and feeds input
 * into a UnifiedInput instance.
 *
 * Usage:
 *   const input = new UnifiedInput(scene);
 *   new VirtualJoystick(scene, input, 120, 480, 60);
 */
export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private input: UnifiedInput;
  private radius: number;
  private threshold = 0.3;

  constructor(scene: Phaser.Scene, input: UnifiedInput, x: number, y: number, radius = 60) {
    this.input = input;
    this.radius = radius;

    // Base circle
    this.base = scene.add.circle(x, y, radius, 0x000000, 0.3)
      .setScrollFactor(0).setDepth(1000).setInteractive();

    // Thumb
    this.thumb = scene.add.circle(x, y, radius * 0.4, 0xcccccc, 0.6)
      .setScrollFactor(0).setDepth(1001);

    // Touch/drag handling
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < scene.cameras.main.width / 2) {
        this.updateThumb(pointer);
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && pointer.x < scene.cameras.main.width / 2) {
        this.updateThumb(pointer);
      }
    });

    scene.input.on('pointerup', () => {
      this.thumb.setPosition(this.base.x, this.base.y);
      input.clearVirtual();
    });
  }

  private updateThumb(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, this.radius);
    const angle = Math.atan2(dy, dx);

    this.thumb.setPosition(
      this.base.x + Math.cos(angle) * clampedDist,
      this.base.y + Math.sin(angle) * clampedDist
    );

    const nx = clampedDist > 0 ? dx / dist : 0;
    const ny = clampedDist > 0 ? dy / dist : 0;
    const normalizedDist = clampedDist / this.radius;

    this.input.setVirtual('left', nx < -this.threshold && normalizedDist > this.threshold);
    this.input.setVirtual('right', nx > this.threshold && normalizedDist > this.threshold);
    this.input.setVirtual('up', ny < -this.threshold && normalizedDist > this.threshold);
    this.input.setVirtual('down', ny > this.threshold && normalizedDist > this.threshold);
  }

  destroy() {
    this.base.destroy();
    this.thumb.destroy();
  }
}
