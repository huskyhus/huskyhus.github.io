// 傾きの入力。どの方式でも最後は「画面の右・下を正とする、長さ 1 以下のベクトル」にそろえる。
//   sensor : スマホの傾きセンサー（DeviceOrientation）。始めた瞬間の姿勢を「水平」とみなす
//   mouse  : PC。画面中央からマウスまでのずれを傾きとみなす（ボールは常にほぼ中央にいる）
//   touch  : センサーが使えないスマホ。指を置いた所からドラッグした向きが傾き
//   キーボード（矢印 / WASD）はどの方式でも上書きで効く

const MAX_DEG = 22;          // この角度まで傾けると最大
const DEAD_DEG = 1.2;        // これ未満の傾きは無視（手ぶれ対策）
const MOUSE_RANGE = 0.32;    // 画面の短辺 × この値だけ離すと最大
const MOUSE_DEAD = 0.05;
const TOUCH_RANGE = 70;      // ドラッグ量（px）でこれだけ動かすと最大
const SENSOR_WAIT = 700;     // この時間内にセンサーの値が来なければ使えないと判断（ms）

export class TiltInput {
  constructor(target) {
    this.mode = matchMedia("(pointer: coarse)").matches ? "touch" : "mouse";
    this.raw = null;           // センサーの生の値（画面の向きを補正済み、度）
    this.base = null;          // 「水平」とみなす姿勢
    this.pointer = { x: 0, y: 0 };
    this.touchAnchor = null;   // ドラッグ開始位置（touch モード）
    this.keys = new Set();

    window.addEventListener("deviceorientation", e => this.onOrientation(e));
    target.addEventListener("pointerdown", e => this.onPointerDown(e));
    window.addEventListener("pointermove", e => this.onPointerMove(e));
    window.addEventListener("pointerup", e => this.onPointerUp(e));
    window.addEventListener("pointercancel", e => this.onPointerUp(e));
    document.documentElement.addEventListener("mouseleave", () => { this.pointer = { x: 0, y: 0 }; });
    window.addEventListener("keydown", e => {
      if (KEY_DIRS[e.code]) { this.keys.add(e.code); e.preventDefault(); }
    });
    window.addEventListener("keyup", e => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /**
   * センサーを使えるようにする。iOS は許可ダイアログが必要で、
   * これはボタンを押した直後（ユーザー操作の中）でしか出せない。
   * 戻り値: 実際に使う方式
   */
  async enableSensor() {
    if (!("DeviceOrientationEvent" in window) || !matchMedia("(pointer: coarse)").matches) return this.mode;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return this.mode;
      }
    } catch {
      return this.mode;   // http で開いた iOS など
    }
    if (this.raw) return (this.mode = "sensor");
    await new Promise(r => setTimeout(r, SENSOR_WAIT));
    if (this.raw) this.mode = "sensor";
    return this.mode;
  }

  /** 今の姿勢を水平とみなす */
  calibrate() {
    this.base = this.raw ? { ...this.raw } : null;
  }

  onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    // 画面の回転に合わせて、端末の軸 → 画面の軸に直す
    const angle = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
    const { beta: b, gamma: g } = e;
    let x = g, y = b;
    if (angle === 90) { x = b; y = -g; }
    else if (angle === 180) { x = -g; y = -b; }
    else if (angle === 270) { x = -b; y = g; }
    this.raw = { x, y };
    if (!this.base) this.calibrate();
  }

  onPointerDown(e) {
    if (e.pointerType === "mouse") return;
    if (this.mode === "touch") this.touchAnchor = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  onPointerMove(e) {
    if (e.pointerType === "mouse") {
      const s = Math.min(innerWidth, innerHeight) * MOUSE_RANGE;
      this.pointer = { x: (e.clientX - innerWidth / 2) / s, y: (e.clientY - innerHeight / 2) / s };
      // マウスを動かしたらタッチ端末でもマウス操作に切り替える（タブレット＋マウスなど）
      if (this.mode === "touch") this.mode = "mouse";
    } else if (this.touchAnchor && e.pointerId === this.touchAnchor.id) {
      this.pointer = {
        x: (e.clientX - this.touchAnchor.x) / TOUCH_RANGE,
        y: (e.clientY - this.touchAnchor.y) / TOUCH_RANGE,
      };
    }
  }

  onPointerUp(e) {
    if (this.touchAnchor && e.pointerId === this.touchAnchor.id) {
      this.touchAnchor = null;
      this.pointer = { x: 0, y: 0 };
    }
  }

  /** 今の傾き { x, y }（長さ 1 以下） */
  read() {
    if (this.keys.size) {
      let x = 0, y = 0;
      for (const k of this.keys) { x += KEY_DIRS[k][0]; y += KEY_DIRS[k][1]; }
      return clampLen(x, y, 0);
    }
    if (this.mode === "sensor" && this.raw && this.base) {
      const dx = this.raw.x - this.base.x, dy = this.raw.y - this.base.y;
      const deg = Math.hypot(dx, dy);
      if (deg < DEAD_DEG) return { x: 0, y: 0 };
      const k = (deg - DEAD_DEG) / (MAX_DEG - DEAD_DEG) / deg;
      return clampLen(dx * k, dy * k, 0);
    }
    return clampLen(this.pointer.x, this.pointer.y, this.mode === "mouse" ? MOUSE_DEAD : 0.08);
  }
}

const KEY_DIRS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
};

function clampLen(x, y, dead) {
  const len = Math.hypot(x, y);
  if (len <= dead) return { x: 0, y: 0 };
  const k = Math.min(1, (len - dead) / (1 - dead)) / len;
  return { x: x * k, y: y * k };
}
