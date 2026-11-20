// 台車上の三重振り子（scripts/ipopt_seed.py の dynamics() と同じ式）。
//   状態 s = [x, θ1, θ2, θ3, ẋ, θ̇1, θ̇2, θ̇3]、入力 u = 台車の加速度 [m/s²]
//   θi は鉛直上向きから時計回りに測る（0 = 倒立、π = 懸垂）。リンクは台車側から 1, 2, 3。
//   各リンクは一様な棒：重心は中点、重心まわりの慣性モーメントは m l² / 12。
//
//   運動方程式（台車の加速度 u を入力とするので台車の質量は現れない）
//     Σj μij cos(θi−θj) θ̈j + Σj μij sin(θi−θj) θ̇j² + βi cosθi u − g βi sinθi + 摩擦 = 0
//     βi = mi ai + li Σ_{k>i} mk,  μii = Ji + mi ai² + li² Σ_{k>i} mk,  μij = l_min β_max
(function (root) {
  "use strict";

  function makeModel(p) {
    const m = p.m.slice(), l = p.l.slice(), d = p.d.slice(), g = p.g;
    const a = l.map((v) => v / 2);
    const J = m.map((mi, i) => (mi * l[i] * l[i]) / 12);
    const tail = (i) => m.slice(i + 1).reduce((s, v) => s + v, 0);
    const beta = [0, 1, 2].map((i) => m[i] * a[i] + l[i] * tail(i));
    const mu = [0, 1, 2].map((i) =>
      [0, 1, 2].map((j) => {
        if (i === j) return J[i] + m[i] * a[i] * a[i] + l[i] * l[i] * tail(i);
        const lo = Math.min(i, j), hi = Math.max(i, j);
        return l[lo] * beta[hi];
      })
    );
    return { m, l, a, d, g, J, beta, mu };
  }

  // 割り当てなしの右辺評価。out は長さ 8 の配列。
  function derivInto(md, s, u, out) {
    const t1 = s[1], t2 = s[2], t3 = s[3];
    const w1 = s[5], w2 = s[6], w3 = s[7];
    const mu = md.mu, b = md.beta, g = md.g, d = md.d;
    const c12 = Math.cos(t1 - t2), c13 = Math.cos(t1 - t3), c23 = Math.cos(t2 - t3);
    const s12 = Math.sin(t1 - t2), s13 = Math.sin(t1 - t3), s23 = Math.sin(t2 - t3);
    const m00 = mu[0][0], m11 = mu[1][1], m22 = mu[2][2];
    const m01 = mu[0][1] * c12, m02 = mu[0][2] * c13, m12 = mu[1][2] * c23;
    const r0 = -(mu[0][1] * s12 * w2 * w2 + mu[0][2] * s13 * w3 * w3)
      - b[0] * Math.cos(t1) * u + g * b[0] * Math.sin(t1) - (d[0] * w1 - d[1] * (w2 - w1));
    const r1 = -(-mu[0][1] * s12 * w1 * w1 + mu[1][2] * s23 * w3 * w3)
      - b[1] * Math.cos(t2) * u + g * b[1] * Math.sin(t2) - (d[1] * (w2 - w1) - d[2] * (w3 - w2));
    const r2 = -(-mu[0][2] * s13 * w1 * w1 - mu[1][2] * s23 * w2 * w2)
      - b[2] * Math.cos(t3) * u + g * b[2] * Math.sin(t3) - d[2] * (w3 - w2);
    // 対称 3×3 をクラメルの公式で解く
    const A00 = m11 * m22 - m12 * m12;
    const A01 = m02 * m12 - m01 * m22;
    const A02 = m01 * m12 - m02 * m11;
    const A11 = m00 * m22 - m02 * m02;
    const A12 = m01 * m02 - m00 * m12;
    const A22 = m00 * m11 - m01 * m01;
    const det = m00 * A00 + m01 * A01 + m02 * A02;
    out[0] = s[4]; out[1] = w1; out[2] = w2; out[3] = w3; out[4] = u;
    out[5] = (A00 * r0 + A01 * r1 + A02 * r2) / det;
    out[6] = (A01 * r0 + A11 * r1 + A12 * r2) / det;
    out[7] = (A02 * r0 + A12 * r1 + A22 * r2) / det;
    return out;
  }

  function deriv(md, s, u) {
    return derivInto(md, s, u, new Array(8));
  }

  // RK4 の作業領域を持つ積分器。uFn(t) が与えられれば各段で入力を評価する。
  function makeIntegrator(md) {
    const k1 = new Float64Array(8), k2 = new Float64Array(8), k3 = new Float64Array(8), k4 = new Float64Array(8);
    const tmp = new Float64Array(8);
    // s を h だけ進める（その場で書き換え）。u0, um, u1 は区間の始点・中点・終点の入力。
    return function step(s, h, u0, um, u1) {
      derivInto(md, s, u0, k1);
      for (let i = 0; i < 8; i++) tmp[i] = s[i] + 0.5 * h * k1[i];
      derivInto(md, tmp, um, k2);
      for (let i = 0; i < 8; i++) tmp[i] = s[i] + 0.5 * h * k2[i];
      derivInto(md, tmp, um, k3);
      for (let i = 0; i < 8; i++) tmp[i] = s[i] + h * k3[i];
      derivInto(md, tmp, u1, k4);
      for (let i = 0; i < 8; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      return s;
    };
  }

  // 台車の速度が瞬間的に Δv 変わったときの角速度の跳び：M Δθ̇ = −β cosθ Δv
  function velocityJump(md, s, dv) {
    const f0 = derivInto(md, s, 0, new Array(8));
    const f1 = derivInto(md, s, 1, new Array(8));
    // f1 − f0 = −M⁻¹ β cosθ（入力 1 あたりの角加速度）なので、それに Δv を掛ければよい
    const out = Array.from(s);
    out[4] += dv;
    for (let i = 0; i < 3; i++) out[5 + i] += (f1[5 + i] - f0[5 + i]) * dv;
    return out;
  }

  // 中心差分による線形化 ds/dt ≈ A δs + B δu
  function linearize(md, s0, u0) {
    const n = 8, eps = 1e-6;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const fp = new Array(8), fm = new Array(8);
    const sp = Array.from(s0), sm = Array.from(s0);
    for (let j = 0; j < n; j++) {
      sp[j] = s0[j] + eps; sm[j] = s0[j] - eps;
      derivInto(md, sp, u0, fp);
      derivInto(md, sm, u0, fm);
      for (let i = 0; i < n; i++) A[i][j] = (fp[i] - fm[i]) / (2 * eps);
      sp[j] = s0[j]; sm[j] = s0[j];
    }
    derivInto(md, s0, u0 + eps, fp);
    derivInto(md, s0, u0 - eps, fm);
    const B = fp.map((v, i) => [(v - fm[i]) / (2 * eps)]);
    return { A, B };
  }

  const equilibrium = (code) => [0, ...[...code].map((c) => (c === "U" ? 0 : Math.PI)), 0, 0, 0, 0];

  // 関節と重心の位置（台車中心を原点、上向きを y 正）
  function geometry(md, s) {
    const pts = [[s[0], 0]];
    const coms = [];
    for (let i = 0; i < 3; i++) {
      const [px, py] = pts[i];
      const th = s[1 + i];
      coms.push([px + md.a[i] * Math.sin(th), py + md.a[i] * Math.cos(th)]);
      pts.push([px + md.l[i] * Math.sin(th), py + md.l[i] * Math.cos(th)]);
    }
    return { pts, coms };
  }

  root.TM = { makeModel, derivInto, deriv, makeIntegrator, velocityJump, linearize, equilibrium, geometry };
  if (typeof module !== "undefined") module.exports = root.TM;
})(typeof window !== "undefined" ? window : globalThis);
