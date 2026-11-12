// 技の定義を短く書くための道具（moves.js と moves/*.js で使う）。
// sim.js は import しない（sim.js → moves.js → ここ、の順に読まれるので、循環させない）。
// 台の位置などは G（Sim）の道具（G.onStage / G.edgeDist など）から使う。

export const D = (lo, hi) => [lo, hi];

/** 攻撃判定 1 つ。box: [前方向の中心, 高さの中心(上が負), 幅, 高さ] */
export const H = (f0, f1, box, dmg, base, grow, ang, x = {}) => ({ f: [f0, f1], box, dmg, base, grow, ang, ...x });

export const STAGE_Y = 600;     // 台の上面（sim.js の STAGE.y と同じ）
export const LEDGE_L = 440, LEDGE_R = 1160;   // 台のふちより少し内側（瞬間移動の行き先）

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** 地上の相手にだけ当たる */
export const onlyGround = (F, T, G, h) => (T.grounded ? h : null);

/**
 * 押してためて離す技の共通部分。ためている間は -1、離したら「離してから何フレーム目か」を返す。
 * ため具合（0〜1）は F.move.w に入る（max フレームで満タン）
 */
export function holdCharge(F, G, f, max) {
  const m = F.move;
  if (m.fire == null) {
    F.charge = Math.min(60, Math.round(Math.min(f, max) * 60 / max));
    if (!G.held(F, m.slot) || f >= max) { m.fire = f; m.w = Math.min(f, max) / max; F.charge = 0; }
    return -1;
  }
  return f - m.fire;
}

/** 押している間だけ続く技: 離したか max を過ぎたら true（tick で return false する合図） */
export const released = (F, G, f, max, min = 4) => f > max || (f > min && !G.held(F, F.move.slot));

/** 決まったフレームに状態を付けるだけの技の tick */
export const giveAt = (at, o) => (F, G, f) => { if (f === at) G.give(F, o); };

/** 能力の説明（技の一覧に出す。数値のない欄は文で） */
export const I = (startup, speed, dmg, power) => ({ startup, text: { speed, dmg, power } });
