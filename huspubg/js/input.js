// PC の入力。マウスはポインターロック（画面をクリックで固定、Esc で解除）。
// キーは押している間の集合と、このフレームで押したもの（pressed）を分けて持つ。

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.buttons = 0;
    this.clicked = 0;     // このフレームで押したマウスボタン（ビット）
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.enabled = false;
    this.locked = false;

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.buttons = 0; this.keys.clear(); }
      this.onLockChange?.(this.locked);
    });
    canvas.addEventListener("mousedown", e => {
      if (!this.enabled) return;
      if (!this.locked) { if (!this.noAutoLock) this.lock(); return; }
      this.buttons |= 1 << e.button;
      this.clicked |= 1 << e.button;
      e.preventDefault();
    });
    addEventListener("mouseup", e => { this.buttons &= ~(1 << e.button); });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    addEventListener("mousemove", e => {
      if (!this.locked) return;
      // まれに巨大な値が来るブラウザがあるので丸める
      this.dx += Math.max(-300, Math.min(300, e.movementX));
      this.dy += Math.max(-300, Math.min(300, e.movementY));
    });
    addEventListener("wheel", e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener("keydown", e => {
      if (!this.enabled || e.target instanceof HTMLInputElement) return;
      if (["Space", "Tab", "KeyF", "ControlLeft", "AltLeft"].includes(e.code) || (this.locked && !e.code.startsWith("F"))) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener("keyup", e => { this.keys.delete(e.code); });
    addEventListener("blur", () => { this.keys.clear(); this.buttons = 0; });
  }
  lock() { try { const r = this.canvas.requestPointerLock({ unadjustedMovement: true }); r?.catch?.(() => this.canvas.requestPointerLock()); } catch { this.canvas.requestPointerLock(); } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  /** 1 フレームぶんの出来事を受け取って空にする */
  endFrame() { this.pressed.clear(); this.clicked = 0; this.dx = 0; this.dy = 0; this.wheel = 0; }
}
