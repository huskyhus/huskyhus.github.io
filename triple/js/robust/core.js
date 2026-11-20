// ロバスト制御の題材：ばねでつながった 2 つの台車（ロバスト制御の有名なベンチマーク問題に倣ったもの）。
//   m1 ẍ1 = −k(x1 − x2) + u、 m2 ẍ2 = k(x1 − x2) + w     u：台車 1 を押す力、w：台車 2 への外乱
//   測れるのは台車 2 の位置 x2 だけ（動かす場所と測る場所が違う＝非コロケーション）。
//   ばねの強さ k は名目値から大きくずれうる（既定では 0.5〜2）。
//
//   設計する制御器は 2 種類：
//   ・LQG：名目値 k0 で最適な LQR とカルマンフィルタの組み合わせ
//   ・H∞：k の範囲をフィードバックの中の不確かさ Δ（|Δ| ≤ 1）として表し、小ゲイン定理で
//          範囲全体の安定を保証する（DGKF の状態空間公式、γ の二分探索）
(function (root) {
  "use strict";
  const LA = root.LA || require("../linalg.js");
  const LTI = root.LTI || require("../lti.js");
  const { mul, add, sub, scale, T, inv, eye, zeros } = LA;

  const M1 = 1, M2 = 1;
  function plant(k) {
    return {
      A: [[0, 0, 1, 0], [0, 0, 0, 1], [-k / M1, k / M1, 0, 0], [k / M2, -k / M2, 0, 0]],
      Bu: [[0], [0], [1 / M1], [0]],
      Bw: [[0], [0], [0], [1 / M2]],
      Cy: [[0, 1, 0, 0]],
    };
  }

  // ---------------------------------------------------------------- 行列の小道具
  function det(A) {
    const n = A.length, M = A.map((r) => r.slice());
    let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (M[p][c] === 0) return 0;
      if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let j = c; j < n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return d;
  }
  const fro = (A) => Math.sqrt(A.reduce((s, r) => s + r.reduce((t, v) => t + v * v, 0), 0));
  const block = (A, B, C, D) => [...A.map((r, i) => [...r, ...B[i]]), ...C.map((r, i) => [...r, ...D[i]])];
  const sym = (X) => scale(add(X, T(X)), 0.5);

  // 連続時間リッカチ方程式 AᵀX + XA + XRX + Q = 0 の安定化解を、ハミルトン行列の符号関数で求める。
  //   H = [A, R; −Q, −Aᵀ]。H が虚軸上に固有値を持つと解はない（null を返す）。
  function ric(A, R, Q) {
    const n = A.length;
    const H = block(A, R, scale(Q, -1), scale(T(A), -1));
    let Z = H;
    for (let it = 0; it < 100; it++) {
      const d = Math.abs(det(Z));
      if (!(d > 0) || !Number.isFinite(d)) return null;
      const c = Math.pow(d, -1 / (2 * n));
      const Zi = inv(Z);
      const Zn = scale(add(scale(Z, c), scale(Zi, 1 / c)), 0.5);
      const diff = fro(sub(Zn, Z)) / Math.max(1e-300, fro(Zn));
      Z = Zn;
      if (!Z.every((r) => r.every(Number.isFinite))) return null;
      if (diff < 1e-13) break;
      if (it === 99) return null;
    }
    // [S12; S22 + I] X = −[S11 + I; S21] を最小二乗で解く
    const S11 = Z.slice(0, n).map((r) => r.slice(0, n)), S12 = Z.slice(0, n).map((r) => r.slice(n));
    const S21 = Z.slice(n).map((r) => r.slice(0, n)), S22 = Z.slice(n).map((r) => r.slice(n));
    const Mm = [...S12, ...add(S22, eye(n))];
    const Nn = scale([...add(S11, eye(n)), ...S21], -1);
    const MtM = mul(T(Mm), Mm);
    if (Math.abs(det(MtM)) < 1e-300) return null;
    const X = sym(mul(inv(MtM), mul(T(Mm), Nn)));
    // 残差で確かめる
    const res = add(add(add(mul(T(A), X), mul(X, A)), mul(mul(X, R), X)), Q);
    if (fro(res) > 1e-6 * Math.max(1, fro(Q), fro(X))) return null;
    return X;
  }

  const eigMin = (X) => Math.min(...(LA.eig(X) || [{ re: -1 }]).map((z) => z.re));
  const specRad = (X) => Math.max(...(LA.eig(X) || [{ re: Infinity, im: 0 }]).map((z) => Math.hypot(z.re, z.im)));

  // ---------------------------------------------------------------- LQG（名目値で最適）
  // 重み：q（台車 2 の位置）、r（力）、カルマンフィルタ：外乱の強さ W、観測雑音 V
  function designLQG(k0, opt = {}) {
    const { q = 1, r = 0.01, W = 1, V = 1e-4 } = opt;
    const P = plant(k0);
    const Q = mul(T(P.Cy), P.Cy).map((row) => row.map((v) => v * q));
    for (let i = 0; i < 4; i++) Q[i][i] += 1e-6;
    // LQR：AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0
    const X = ric(P.A, scale(mul(P.Bu, T(P.Bu)), -1 / r), Q);
    const Y = ric(T(P.A), scale(mul(T(P.Cy), P.Cy), -1 / V), add(scale(mul(P.Bw, T(P.Bw)), W), scale(eye(4), 1e-8)));
    if (!X || !Y) return null;
    const K = scale(mul(T(P.Bu), X), 1 / r);   // u = −K x̂
    const L = scale(mul(Y, T(P.Cy)), 1 / V);   // x̂' = A x̂ + B u + L (y − C x̂)
    // 制御器（入力 y、出力 u）
    const Ak = sub(sub(P.A, mul(P.Bu, K)), mul(L, P.Cy));
    return { type: "lqg", k0, Ak, Bk: L, Ck: scale(K, -1), Dk: [[0]], opt: { q, r, W, V } };
  }

  // ---------------------------------------------------------------- H∞（k の範囲を保証）
  //   一般化プラント：w = [外乱 w_d, 不確かさの入口 w_Δ, 観測雑音 n]、z = [性能 z_x, 不確かさの出口 z_Δ, 力 z_u]
  //   k = k0 + dk·Δ とすると、ばねの力のずれ dk·Δ·(x1 − x2) は、z_Δ = √dk (x1 − x2)、w_Δ = Δ z_Δ を
  //   B_Δ = √dk [0, 0, −1/m1, 1/m2]ᵀ から入れることと同じ。‖T_zw‖∞ < γ ≤ 1 なら |Δ| ≤ 1/γ で安定。
  function hinfPlant(k0, dk, opt) {
    const { wd = 1, rho_x = 1, rho_v = 0, rho_u = 1, sigma = 0.01, alpha = 1 } = opt;
    const P = plant(k0);
    // α：不確かさの出口と入口の釣り合い（D スケーリング）。積 dk は変わらないので、保証する範囲は同じ
    const sdk = Math.sqrt(dk);
    const bi = sdk / alpha, zo = sdk * alpha;
    const B1 = [[0, 0, 0], [0, 0, 0], [0, -bi / M1, 0], [wd / M2, bi / M2, 0]];
    // 性能：台車 2 の位置と速さ（速さに重みをつけると、揺れの減衰を直接要求できる）
    const C1 = [[0, rho_x, 0, 0], [0, 0, 0, rho_v], [zo, -zo, 0, 0], [0, 0, 0, 0]];
    // 正規化：ũ = ρ_u u（D12 = [0;0;1]）、ỹ = y/σ（D21 = [0 0 1]）
    const B2 = scale(P.Bu, 1 / rho_u);
    const C2 = scale(P.Cy, 1 / sigma);
    return { A: P.A, B1, B2, C1, C2, rho_u, sigma };
  }

  function hinfAt(G, gamma) {
    const { A, B1, B2, C1, C2 } = G;
    const g2 = 1 / (gamma * gamma);
    const X = ric(A, sub(scale(mul(B1, T(B1)), g2), mul(B2, T(B2))), mul(T(C1), C1));
    if (!X || eigMin(X) < -1e-9) return null;
    const Y = ric(T(A), sub(scale(mul(T(C1), C1), g2), mul(T(C2), C2)), mul(B1, T(B1)));
    if (!Y || eigMin(Y) < -1e-9) return null;
    if (specRad(mul(X, Y)) >= gamma * gamma * (1 - 1e-9)) return null;
    const F = scale(mul(T(B2), X), -1);
    const L = scale(mul(Y, T(C2)), -1);
    const Z = inv(sub(eye(A.length), scale(mul(Y, X), g2)));
    const Ah = add(add(add(A, scale(mul(mul(B1, T(B1)), X), g2)), mul(B2, F)), mul(mul(Z, L), C2));
    const Bh = scale(mul(Z, L), -1);
    return { Ah, Bh, Ch: F, X, Y };
  }

  // γ を二分探索して、最小に近い γ（少し余裕を持たせる）で制御器を作る
  function designHinf(kmin, kmax, opt = {}) {
    const k0 = (kmin + kmax) / 2, dk = (kmax - kmin) / 2;
    const G = hinfPlant(k0, dk, opt);
    let lo = 0.01, hi = 1;
    let sol = hinfAt(G, hi);
    while (!sol && hi < 1e4) { hi *= 2; sol = hinfAt(G, hi); }
    if (!sol) return null;
    for (let i = 0; i < 40; i++) {
      const mid = Math.sqrt(lo * hi);
      if (hinfAt(G, mid)) hi = mid; else lo = mid;
      if (hi / lo < 1.002) break;
    }
    const gamma = hi * 1.03; // 最適値ぎりぎりは数値的に悪条件なので少し離す
    sol = hinfAt(G, gamma) || hinfAt(G, hi);
    // 元の単位に戻す：u = ũ/ρ_u = (Ch/ρ_u) x̂、x̂' = Ah x̂ + Bh ỹ = Ah x̂ + (Bh/σ) y
    return {
      type: "hinf", k0, dk, gamma, kmin, kmax, opt,
      guaranteed: [k0 - dk / gamma, k0 + dk / gamma],
      Ak: sol.Ah, Bk: scale(sol.Bh, 1 / G.sigma), Ck: scale(sol.Ch, 1 / G.rho_u), Dk: [[0]],
    };
  }


  // γ ≤ 1（＝範囲全体で安定を保証）に収まる範囲で、性能の要求（位置と速さの重み）をできるだけ強くする
  const BASE = { wd: 0.1, rho_x: 1, rho_v: 0.3, rho_u: 0.1, sigma: 0.03 };
  function designHinfAuto(kmin, kmax, opt = {}) {
    const base = { ...BASE, ...opt };
    const tryPerf = (perf) => {
      let best = null;
      for (const alpha of [1, 1.7, 3]) {
        const h = designHinf(kmin, kmax, { ...base, rho_x: base.rho_x * perf, rho_v: base.rho_v * perf, alpha });
        if (h && (!best || h.gamma < best.gamma)) best = h;
      }
      return best;
    };
    if (opt.perf != null) { const h = tryPerf(opt.perf); if (h) h.perf = opt.perf; return h; }
    let lo = 0.01, hi = 10, best = tryPerf(lo);
    if (!best || best.gamma > 0.98) { if (best) best.perf = lo; return best; }
    for (let i = 0; i < 14; i++) {
      const mid = Math.sqrt(lo * hi), h = tryPerf(mid);
      if (h && h.gamma <= 0.98) { lo = mid; best = h; } else hi = mid;
      if (hi / lo < 1.08) break;
    }
    best.perf = lo;
    return best;
  }

  // 制御器の周波数応答 K(jω)（y → u）と、対象 P(jω)（u → y）、一巡伝達関数 L = −K P（台車を押す入口で切る）
  const ctrlSS = (c) => LTI.ss(c.Ak, c.Bk, c.Ck, c.Dk);
  function loopJ(c, k, w) {
    const P = plant(k);
    const Pj = LTI.freq(LTI.ss(P.A, P.Bu, P.Cy, [[0]]), w);
    const Kj = LTI.freq(ctrlSS(c), w);
    const re = -(Kj[0] * Pj[0] - Kj[1] * Pj[1]), im = -(Kj[0] * Pj[1] + Kj[1] * Pj[0]);
    return [re, im];
  }
  // 不確かさの通り道：ばねの力のずれ（台車 1 に −f、台車 2 に +f）から、ばねの伸び x1 − x2 までの閉ループ
  //   k = k0 + δ について、|δ|·|T(jω)| < 1 がすべての ω で成り立てば安定（小ゲイン定理）
  function uncT(c, k0, w) {
    const cl = closedLoop(c, k0);
    const n = cl.A.length;
    const B = LTI.zeros(n, 1), C = [new Array(n).fill(0)];
    B[2][0] = -1 / M1; B[3][0] = 1 / M2; C[0][0] = 1; C[0][1] = -1;
    return LTI.freq(LTI.ss(cl.A, B, C, [[0]]), w);
  }

  // ---------------------------------------------------------------- 閉ループの解析
  // 状態 [x(4), x̂(nk)]、入力 [w（台車 2 への力）]、出力 [x2, u]
  function closedLoop(ctrl, k) {
    const P = plant(k), nk = ctrl.Ak.length, n = 4 + nk;
    const A = zeros(n, n), B = zeros(n, 1), C = zeros(2, n);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) A[i][j] = P.A[i][j];
      for (let j = 0; j < nk; j++) A[i][4 + j] = P.Bu[i][0] * ctrl.Ck[0][j];
      B[i][0] = P.Bw[i][0];
    }
    for (let i = 0; i < nk; i++) {
      for (let j = 0; j < 4; j++) A[4 + i][j] = ctrl.Bk[i][0] * P.Cy[0][j];
      for (let j = 0; j < nk; j++) A[4 + i][4 + j] = ctrl.Ak[i][j];
    }
    C[0][1] = 1;
    for (let j = 0; j < nk; j++) C[1][4 + j] = ctrl.Ck[0][j];
    return LTI.ss(A, B, C, zeros(2, 1));
  }
  function maxRe(ctrl, k) {
    const ps = LTI.poles(closedLoop(ctrl, k));
    return ps.length ? Math.max(...ps.map((z) => z.re)) : Infinity;
  }
  // k を走査して、安定な範囲を返す
  function stableRange(ctrl, ks) {
    return ks.map((k) => ({ k, re: maxRe(ctrl, k) }));
  }
  // インパルス外乱（台車 2 を叩く）への応答
  function impulse(ctrl, k, Tend = 20, h = 0.01) {
    const cl = closedLoop(ctrl, k);
    const x0 = new Array(cl.A.length).fill(0);
    x0[3] = 1 / M2; // 力積 1 を台車 2 へ
    const sim = LTI.simulate(cl, () => [0], Tend, h, x0);
    return { t: sim.t, x2: sim.y.map((v) => v[0]), u: sim.y.map((v) => v[1]) };
  }
  function settleTime(r, tol = 0.1) {
    for (let i = r.t.length - 1; i >= 0; i--) if (Math.abs(r.x2[i]) > tol) return r.t[i];
    return 0;
  }

  root.RB = { plant, ric, designLQG, designHinf, designHinfAuto, hinfPlant, hinfAt, loopJ, uncT, closedLoop, maxRe, stableRange, impulse, settleTime, det };
  if (typeof module !== "undefined") module.exports = root.RB;
})(typeof window !== "undefined" ? window : globalThis);
