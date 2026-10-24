// Planck.js による物理部分。DOM に依存しないので Node でもテストできる（tools/sim_test.mjs）。
// 座標系: メートル、y 軸上向き。台の上面が y = 0。

export const PX_TO_M = 1 / 160;      // ステッカー画像 1px の長さ
export const STEP = 1 / 120;         // 固定タイムステップ
export const VELOCITY_ITERATIONS = 10;
export const POSITION_ITERATIONS = 8;
export const PLATFORM_HALF_W = 3.15;
export const FALL_Y = -1.5;          // これより下に落ちたピースはアウト

const IMPACT_SPEED = 0.6;            // これ以上の速さでぶつかったら onImpact を呼ぶ m/s
const SETTLE_LINEAR = 0.03;          // m/s
const SETTLE_ANGULAR = 0.05;         // rad/s
const SETTLE_HOLD = 0.35;            // 静止がこれだけ続いたら確定（秒）

const FIXTURE = { density: 1, friction: 1.0, restitution: 0 };

/** shapes.json（px・画像中心原点・y 下向き）をメートル・y 上向きに変換する。 */
export function buildStickerDefs(shapes) {
  return shapes.stickers.map((s, id) => {
    const pieces = s.pieces.map(p => p.map(([x, y]) => ({ x: x * PX_TO_M, y: -y * PX_TO_M })));
    let radius = 0;
    for (const p of pieces) for (const v of p) radius = Math.max(radius, Math.hypot(v.x, v.y));
    return { id, file: s.file, w: s.width * PX_TO_M, h: s.height * PX_TO_M, pieces, radius };
  });
}

export class Physics {
  /** onImpact({ pieces, speed, point }): 何かが勢いよくぶつかったときに呼ばれる（演出用）。 */
  constructor(planck, { onImpact } = {}) {
    this.planck = planck;
    this.world = new planck.World({ gravity: planck.Vec2(0, -10) });
    this.pieces = [];   // { body, def }
    this.acc = 0;
    this.stillTime = 0;

    const ground = this.world.createBody({ type: "static" });
    ground.createFixture(planck.Box(PLATFORM_HALF_W, 0.3, planck.Vec2(0, -0.3), 0), { friction: FIXTURE.friction });

    if (onImpact) this.world.on("begin-contact", contact => this.reportImpact(contact, onImpact));
  }

  reportImpact(contact, onImpact) {
    const wm = contact.getWorldManifold(null);
    if (!wm || !contact.getManifold().pointCount) return;
    const a = contact.getFixtureA().getBody();
    const b = contact.getFixtureB().getBody();
    const p = wm.points[0];
    const va = a.getLinearVelocityFromWorldPoint(p);
    const vb = b.getLinearVelocityFromWorldPoint(p);
    const speed = Math.abs((vb.x - va.x) * wm.normal.x + (vb.y - va.y) * wm.normal.y);
    if (speed < IMPACT_SPEED) return;
    const pieces = [a.getUserData(), b.getUserData()].filter(Boolean);
    onImpact({ pieces, speed, point: { x: p.x, y: p.y } });
  }

  drop(def, x, y, angle) {
    const { planck } = this;
    const body = this.world.createBody({
      type: "dynamic",
      position: planck.Vec2(x, y),
      angle,
      angularDamping: 1.2,   // 丸いステッカーが延々と転がらないように
      linearDamping: 0.05,
    });
    for (const p of def.pieces) body.createFixture(planck.Polygon(p.map(v => planck.Vec2(v.x, v.y))), FIXTURE);
    const piece = { body, def };
    body.setUserData(piece);
    this.pieces.push(piece);
    this.stillTime = 0;
    return piece;
  }

  /** 経過時間 dt を固定ステップで進める。返り値は実行したステップ数。 */
  update(dt) {
    this.acc = Math.min(this.acc + dt, 0.1);   // タブ復帰時などの暴走を防ぐ
    let n = 0;
    while (this.acc >= STEP) {
      this.stepOnce();
      this.acc -= STEP;
      n++;
    }
    return n;
  }

  stepOnce() {
    this.world.step(STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
    this.stillTime = this.isStill() ? this.stillTime + STEP : 0;
  }

  isStill() {
    for (const { body } of this.pieces) {
      if (!body.isAwake()) continue;
      if (body.getLinearVelocity().length() > SETTLE_LINEAR) return false;
      if (Math.abs(body.getAngularVelocity()) > SETTLE_ANGULAR) return false;
    }
    return true;
  }

  get settled() {
    return this.stillTime >= SETTLE_HOLD;
  }

  /** 台から落ちたピースがあれば返す。 */
  fallen() {
    return this.pieces.find(({ body }) => body.getPosition().y < FALL_Y) || null;
  }

  /** 塔の最上点の高さ（台上面基準）。 */
  towerTop() {
    let top = 0;
    for (const { body, def } of this.pieces) {
      for (const p of def.pieces) for (const v of p) top = Math.max(top, body.getWorldPoint(v).y);
    }
    return top;
  }
}
