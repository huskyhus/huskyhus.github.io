// 入力。スマホは左手の仮想スティック（画面の左側のどこを触っても、そこが中心になる）と、
// 右手の A / B / X / Y（技）とジャンプのボタン。PC はキーボード（ボタンをマウスで押すこともできる）。
//
// 送る形: { x, y（-1〜1、下が +）, held（押している間のビット）, c（ボタンごとの押した回数 mod 256）}
// 押した瞬間は「回数が増えたか」で見るので、通信で何通か落ちても押したことは伝わる。
// ビット: 0 = A、1 = B、2 = X、3 = Y、4 = ジャンプ

const KEYMAP = {
  KeyL: 0, KeyK: 1, KeyI: 2, KeyJ: 3, Space: 4,
};
const STICK_R = 56;
const TAP_JUMP_ON = -0.55, TAP_JUMP_OFF = -0.35;

export class Input {
  constructor({ zone, base, knob, buttons }) {
    this.zone = zone; this.base = base; this.knob = knob;
    this.held = 0;
    this.counts = [0, 0, 0, 0, 0];
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.keys = new Set();
    this.tapArmed = true;
    this.enabled = false;
    this.tapJump = true;

    zone.addEventListener("pointerdown", e => this.stickDown(e));
    zone.addEventListener("pointermove", e => this.stickMove(e));
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) zone.addEventListener(ev, e => this.stickUp(e));

    for (const b of buttons) {
      const bit = Number(b.dataset.bit);
      let pid = null;
      b.addEventListener("pointerdown", e => {
        e.preventDefault();
        pid = e.pointerId;
        try { b.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
        this.press(bit);
        b.classList.add("down");
      });
      const up = e => {
        if (e.pointerId !== pid) return;
        pid = null;
        this.release(bit);
        b.classList.remove("down");
      };
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, up);
    }

    addEventListener("keydown", e => {
      if (!this.enabled || e.target instanceof HTMLInputElement) return;
      if (e.code in KEYMAP || /^(Arrow|Key[WASD])/.test(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code in KEYMAP) this.press(KEYMAP[e.code]);
    });
    addEventListener("keyup", e => {
      this.keys.delete(e.code);
      if (e.code in KEYMAP) this.release(KEYMAP[e.code]);
    });
    addEventListener("blur", () => this.reset());
  }

  press(bit) {
    if (!this.enabled) return;
    this.held |= 1 << bit;
    this.counts[bit] = (this.counts[bit] + 1) & 255;
  }
  release(bit) { this.held &= ~(1 << bit); }

  reset() {
    this.held = 0;
    this.keys.clear();
    this.stickUp({ pointerId: this.stick.id });
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.reset();
  }

  stickDown(e) {
    if (this.stick.id !== null) return;
    e.preventDefault();
    this.stick.id = e.pointerId;
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
    this.stick.ox = e.clientX; this.stick.oy = e.clientY;
    this.stick.x = this.stick.y = 0;
    this.base.style.transform = `translate(${e.clientX - STICK_R}px, ${e.clientY - STICK_R}px)`;
    this.base.classList.add("active");
    this.knob.style.transform = "translate(0px, 0px)";
  }
  stickMove(e) {
    if (e.pointerId !== this.stick.id) return;
    let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
    const d = Math.hypot(dx, dy);
    // 大きく動かしたら中心がついてくる（指がずれても操作し続けられる）
    if (d > STICK_R * 1.6) {
      const k = (d - STICK_R * 1.6) / d;
      this.stick.ox += dx * k; this.stick.oy += dy * k;
      dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
      this.base.style.transform = `translate(${this.stick.ox - STICK_R}px, ${this.stick.oy - STICK_R}px)`;
    }
    const len = Math.hypot(dx, dy);
    const m = Math.min(1, len / STICK_R);
    const nx = len ? dx / len * m : 0, ny = len ? dy / len * m : 0;
    this.stick.x = nx; this.stick.y = ny;
    this.knob.style.transform = `translate(${nx * STICK_R}px, ${ny * STICK_R}px)`;
  }
  stickUp(e) {
    if (e.pointerId !== this.stick.id || this.stick.id === null) return;
    this.stick.id = null;
    this.stick.x = this.stick.y = 0;
    this.base.classList.remove("active");
  }

  /** 毎フレーム呼ぶ。スティックを上へはじいたらジャンプ（タップジャンプ）も数える */
  read() {
    let x = this.stick.x, y = this.stick.y;
    if (this.stick.id === null) {
      const k = this.keys;
      x = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
      y = (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0) - (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0);
    }
    if (!this.enabled) { x = 0; y = 0; }
    if (this.tapJump) {
      if (this.tapArmed && y < TAP_JUMP_ON) { this.tapArmed = false; this.counts[4] = (this.counts[4] + 1) & 255; }
      else if (y > TAP_JUMP_OFF) this.tapArmed = true;
    }
    return { x, y, held: this.held, c: this.counts.slice() };
  }
}

/** 押した回数の差から「このフレームで押したボタン」のビットを作る（ホスト側で使う） */
export class PressTracker {
  constructor() { this.last = null; }
  pressed(c) {
    if (!this.last) { this.last = c.slice(); return 0; }
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      if (((c[i] - this.last[i]) & 255) > 0 && ((c[i] - this.last[i]) & 255) < 128) bits |= 1 << i;
    }
    this.last = c.slice();
    return bits;
  }
}
