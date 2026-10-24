// ワールド座標（m、y 上向き）と画面座標（CSS px、y 下向き）の変換。
// ゲーム画面とシェア画像の両方で使う。
export class View {
  constructor(ctx) {
    this.ctx = ctx;
    this.w = 1;          // CSS px
    this.h = 1;
    this.dpr = 1;
    this.ppm = 1;        // 1m あたりの px
    this.camX = 0;       // 画面中央のワールド x
    this.camY = 0;       // 画面下端のワールド y
    this.shakeX = 0;     // 画面揺れ（px）
    this.shakeY = 0;
  }

  get viewH() { return this.h / this.ppm; }
  get viewW() { return this.w / this.ppm; }

  world() {
    const { dpr, ppm, w, h, camX, camY, shakeX, shakeY } = this;
    this.ctx.setTransform(dpr * ppm, 0, 0, -dpr * ppm,
      dpr * (w / 2 - camX * ppm + shakeX), dpr * (h + camY * ppm + shakeY));
  }

  screen() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * this.shakeX, this.dpr * this.shakeY);
  }

  toScreen(x, y) {
    return { x: this.w / 2 + (x - this.camX) * this.ppm, y: this.h - (y - this.camY) * this.ppm };
  }

  toWorldX(sx) {
    return (sx - this.w / 2) / this.ppm + this.camX;
  }
}
