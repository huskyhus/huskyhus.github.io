// モデル予測制御の題材：一定速度で走る車の横方向の動き（車線変更と障害物回避）。
//   制御器が使うモデル（運動学）：状態 x = [y, ψ, δ]（横位置、向き、前輪の切れ角）、入力 r = δ̇（ハンドルを切る速さ）
//     ẏ = v ψ、 ψ̇ = (v/L) δ、 δ̇ = r
//   シミュレーションの「実際の車」は、タイヤの横滑りを含む 2 輪モデル（モデル誤差を入れるとき）。
//   MPC：毎回 N ステップ先までの二次計画問題（QP）を解き、最初の入力だけを使う。QP は主双対内点法で解く。
(function (root) {
  "use strict";
  const LA = root.LA || require("../linalg.js");

  const CAR = { L: 2.8, a: 1.2, b: 1.6, m: 1500, Iz: 2500, Cf: 80000, Cr: 80000, width: 1.8, length: 4.5 };
  const ROAD = { lane: 3.5, lanes: [0, 3.5], left: -1.75, right: 5.25 };
  // 車の中心が出てよい範囲（車幅の半分と余白を引く）
  const Y_MIN = ROAD.left + CAR.width / 2 + 0.15, Y_MAX = ROAD.right - CAR.width / 2 - 0.15;

  // 離散時間の予測モデル（厳密な零次ホールド離散化）
  //   kinematic：x = [y, ψ, δ]
  //   dynamic  ：x = [y, ψ, v_y, ω, δ]（タイヤの横滑り：横速度 v_y とヨーレート ω を持つ線形 2 輪モデル）
  function contModel(v, kind) {
    if (kind === "dynamic") {
      const { a, b, m, Iz, Cf, Cr } = CAR;
      const A = [
        [0, v, 1, 0, 0],
        [0, 0, 0, 1, 0],
        [0, 0, -(Cf + Cr) / (m * v), (b * Cr - a * Cf) / (m * v) - v, Cf / m],
        [0, 0, (b * Cr - a * Cf) / (Iz * v), -(a * a * Cf + b * b * Cr) / (Iz * v), (a * Cf) / Iz],
        [0, 0, 0, 0, 0],
      ];
      return { A, B: [[0], [0], [0], [0], [1]], iy: 0, ipsi: 1, id: 4, nx: 5 };
    }
    return { A: [[0, v, 0], [0, 0, v / CAR.L], [0, 0, 0]], B: [[0], [0], [1]], iy: 0, ipsi: 1, id: 2, nx: 3 };
  }
  function model(v, dt, kind = "kinematic") {
    const c = contModel(v, kind);
    const { Ad, Bd } = LA.c2d(c.A, c.B, dt);
    return { ...c, Ac: c.A, Bc: c.B, A: Ad, B: Bd };
  }
  // 車の状態から、モデルの状態ベクトルを取り出す
  const stateOf = (car, kind) => (kind === "dynamic" ? [car.y, car.psi, car.vy, car.yaw, car.delta] : [car.y, car.psi, car.delta]);

  // ---------------------------------------------------------------- 内点法による QP
  //   min ½ zᵀ P z + qᵀ z  s.t.  l ≤ A z ≤ u  （±∞ の側は省く）
  //   主双対内点法（メロトラの予測子・修正子）。KKT 系は (P + Gᵀ W G) Δz = … に縮約してコレスキー分解で解く。
  function cholesky(M) {
    const n = M.length, L = LA.zeros(n);
    for (let j = 0; j < n; j++) {
      let d = M[j][j];
      for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k];
      if (!(d > 0)) return null;
      L[j][j] = Math.sqrt(d);
      for (let i = j + 1; i < n; i++) {
        let s = M[i][j];
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        L[i][j] = s / L[j][j];
      }
    }
    return L;
  }
  function cholSolve(L, b) {
    const n = L.length, y = b.slice();
    for (let i = 0; i < n; i++) { let s = y[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * y[k]; y[i] = s / L[i][i]; }
    return y;
  }
  function makeQP(P, A) { return { P, A, n: P.length, m: A.length }; }

  function solveQP(qp, q, l, u, ws = null, maxIt = 50, eps = 1e-8) {
    const { P, A, n } = qp;
    // 不等式 G z ≤ h にそろえる
    const G = [], h = [];
    for (let r = 0; r < A.length; r++) {
      if (Number.isFinite(u[r])) { G.push(A[r]); h.push(u[r]); }
      if (Number.isFinite(l[r])) { G.push(A[r].map((v) => -v)); h.push(-l[r]); }
    }
    const m = G.length;
    const Gz = (z) => G.map((row) => row.reduce((s, v, i) => s + v * z[i], 0));
    const GT = (y) => { const out = new Array(n).fill(0); for (let r = 0; r < m; r++) { const c = y[r]; if (c) for (let i = 0; i < n; i++) out[i] += G[r][i] * c; } return out; };
    const Pz = (z) => P.map((row) => row.reduce((s, v, i) => s + v * z[i], 0));
    let z = ws && ws.x && ws.x.length === n ? ws.x.slice() : new Array(n).fill(0);
    if (ws && ws.trace) ws.trace.push(z.slice());
    let s = Gz(z).map((v, r) => Math.max(h[r] - v, 1));
    let lam = new Array(m).fill(1);
    const qn = 1 + Math.max(...q.map(Math.abs)), hn = 1 + Math.max(0, ...h.map(Math.abs));
    let it;
    for (it = 1; it <= maxIt; it++) {
      const gz = Gz(z);
      const rd = Pz(z).map((v, i) => v + q[i]);
      const gl = GT(lam);
      for (let i = 0; i < n; i++) rd[i] += gl[i];
      const rp = gz.map((v, r) => v + s[r] - h[r]);
      const mu = s.reduce((a, v, r) => a + v * lam[r], 0) / m;
      if (Math.max(...rd.map(Math.abs)) < eps * qn && Math.max(...rp.map(Math.abs)) < eps * hn && mu < eps) break;
      const W = lam.map((v, r) => v / s[r]);
      // M = P + Gᵀ W G
      const M = P.map((row) => row.slice());
      for (let r = 0; r < m; r++) {
        const g = G[r], w = W[r];
        for (let i = 0; i < n; i++) { if (!g[i]) continue; const gi = w * g[i]; for (let j = 0; j < n; j++) M[i][j] += gi * g[j]; }
      }
      const L = cholesky(M);
      if (!L) break;
      const solveDir = (rc) => {
        // (P + GᵀWG) Δz = −rd − Gᵀ(W rp − rc/s)
        const t = rp.map((v, r) => W[r] * v - rc[r] / s[r]);
        const gt = GT(t);
        const dz = cholSolve(L, rd.map((v, i) => -v - gt[i]));
        const gdz = Gz(dz);
        const dl = gdz.map((v, r) => W[r] * (v + rp[r]) - rc[r] / s[r]);
        const ds = rc.map((v, r) => (-v - s[r] * dl[r]) / lam[r]);
        return { dz, dl, ds };
      };
      const maxStep = (d) => {
        let a = 1;
        for (let r = 0; r < m; r++) {
          if (d.ds[r] < 0) a = Math.min(a, -s[r] / d.ds[r]);
          if (d.dl[r] < 0) a = Math.min(a, -lam[r] / d.dl[r]);
        }
        return a;
      };
      // 予測子
      const aff = solveDir(s.map((v, r) => v * lam[r]));
      const aa = maxStep(aff);
      const muAff = s.reduce((acc, v, r) => acc + (v + aa * aff.ds[r]) * (lam[r] + aa * aff.dl[r]), 0) / m;
      const sigma = Math.pow(muAff / mu, 3);
      // 修正子
      const cor = solveDir(s.map((v, r) => v * lam[r] + aff.ds[r] * aff.dl[r] - sigma * mu));
      const a = Math.min(1, 0.99 * maxStep(cor));
      for (let i = 0; i < n; i++) z[i] += a * cor.dz[i];
      for (let r = 0; r < m; r++) { s[r] += a * cor.ds[r]; lam[r] += a * cor.dl[r]; }
      if (ws && ws.trace) ws.trace.push(z.slice());
    }
    return { x: z, it: Math.min(it, maxIt) };
  }

  // ---------------------------------------------------------------- MPC
  //   決定変数 Z = [r̃_0 … r̃_{N−1}, s_1 … s_N]（r̃ = r/r_max、s：道幅の制約をやわらげる余裕変数）
  //   予測：x_k = Φ_k x_0 + Σ_{j<k} Γ_{k,j} r̃_j
  function buildMPC(cfg) {
    const { v, dt, N, qy, qpsi, qdelta, rr, rhoSlack, rmax } = cfg;
    const md = model(v, dt, cfg.model || "kinematic");
    const nx = md.nx, sc = rmax;
    // 状態の重み（横位置・向き・切れ角。2 輪モデルの横速度とヨーレートには小さな重み）
    const Qm = LA.zeros(nx);
    for (let i = 0; i < nx; i++) Qm[i][i] = 1e-3;
    Qm[md.iy][md.iy] = qy; Qm[md.ipsi][md.ipsi] = qpsi; Qm[md.id][md.id] = qdelta;
    // 終端の重み：同じ重みの離散 LQR の解（安定性のため）
    const { P: Pf, K: Klqr } = LA.dare(md.A, md.B, Qm, [[rr]]);
    const Phi = [], Gam = [];
    let Ak = LA.eye(nx);
    const AjB = [md.B.map((r) => r[0])];
    for (let p = 1; p < N; p++) AjB.push(md.A.map((row) => row.reduce((acc, v2, j) => acc + v2 * AjB[p - 1][j], 0)));
    for (let k = 1; k <= N; k++) {
      Ak = LA.mul(md.A, Ak);
      Phi.push(Ak);
      const row = [];
      for (let j = 0; j < N; j++) row.push(j >= k ? new Array(nx).fill(0) : AjB[k - 1 - j].map((v2) => v2 * sc));
      Gam.push(row);
    }
    const nz = 2 * N;
    const P = LA.zeros(nz);
    const Qks = [];
    for (let k = 0; k < N; k++) {
      const Qk = k === N - 1 ? LA.add(Qm, Pf) : Qm;
      Qks.push(Qk);
      for (let i = 0; i < N; i++) {
        const gi = Gam[k][i];
        const Qg = Qk.map((row) => row.reduce((acc, v2, b2) => acc + v2 * gi[b2], 0));
        for (let j = 0; j < N; j++) { const gj = Gam[k][j]; let acc = 0; for (let a2 = 0; a2 < nx; a2++) acc += Qg[a2] * gj[a2]; P[i][j] += 2 * acc; }
      }
    }
    for (let i = 0; i < N; i++) { P[i][i] += 2 * rr * sc * sc; P[N + i][N + i] += 2 * rhoSlack; }
    // 制約の行：[r̃_k（N）, δ_k（N）, y_k + s_k（N）, y_k − s_k（N）, s_k（N）]
    const Arows = [];
    const row0 = () => new Array(nz).fill(0);
    for (let k = 0; k < N; k++) { const r = row0(); r[k] = 1; Arows.push(r); }
    for (let k = 0; k < N; k++) { const r = row0(); for (let j = 0; j < N; j++) r[j] = Gam[k][j][md.id]; Arows.push(r); }
    for (let k = 0; k < N; k++) { const r = row0(); for (let j = 0; j < N; j++) r[j] = Gam[k][j][md.iy]; r[N + k] = 1; Arows.push(r); }
    for (let k = 0; k < N; k++) { const r = row0(); for (let j = 0; j < N; j++) r[j] = Gam[k][j][md.iy]; r[N + k] = -1; Arows.push(r); }
    for (let k = 0; k < N; k++) { const r = row0(); r[N + k] = 1; Arows.push(r); }
    return { cfg, md, Phi, Gam, Pf, Klqr: Klqr[0], qp: makeQP(P, Arows), Qm, Qks, N, nz, nx, ws: null };
  }

  // 1 回分の MPC を解く。lo, hi は各ステップの横位置の下限・上限（長さ N）、yref も長さ N
  function solveMPC(mpc, x0, yref, lo, hi) {
    const { cfg, Phi, Gam, N, nz, nx, Qks, md } = mpc;
    const { dmax, rmax, rhoSlack } = cfg;
    const q = new Array(nz).fill(0);
    const free = [];
    for (let k = 0; k < N; k++) {
      const px = Phi[k].map((row) => row.reduce((acc, v2, b2) => acc + v2 * x0[b2], 0));
      free.push(px);
      const e = px.slice(); e[md.iy] -= yref[k];
      const Qe = Qks[k].map((row) => row.reduce((acc, v2, b2) => acc + v2 * e[b2], 0));
      for (let j = 0; j < N; j++) { let acc = 0; for (let a2 = 0; a2 < nx; a2++) acc += Gam[k][j][a2] * Qe[a2]; q[j] += 2 * acc; }
    }
    for (let k = 0; k < N; k++) q[N + k] = rhoSlack;
    const l = [], u = [];
    for (let k = 0; k < N; k++) { l.push(-1); u.push(1); }
    for (let k = 0; k < N; k++) { l.push(-dmax - free[k][md.id]); u.push(dmax - free[k][md.id]); }
    for (let k = 0; k < N; k++) { l.push(lo[k] - free[k][md.iy]); u.push(Infinity); }
    for (let k = 0; k < N; k++) { l.push(-Infinity); u.push(hi[k] - free[k][md.iy]); }
    for (let k = 0; k < N; k++) { l.push(0); u.push(Infinity); }
    // 温め：前回の解を 1 ステップずらして初期値にする
    let ws = null;
    if (mpc.ws && mpc.ws.x.length === nz) {
      const x = mpc.ws.x.slice();
      for (let i = 0; i < N - 1; i++) { x[i] = x[i + 1]; x[N + i] = x[N + i + 1]; }
      ws = { x };
    }
    const clock = typeof performance !== "undefined" ? performance : Date;
    const t0 = clock.now();
    const sol = solveQP(mpc.qp, q, l, u, ws, cfg.maxIt || 50, cfg.eps || 1e-8);
    const ms = clock.now() - t0;
    mpc.ws = sol;
    const Rt = sol.x.slice(0, N);             // r̃
    const R = Rt.map((v2) => v2 * rmax);      // r
    const pred = [];
    for (let k = 0; k < N; k++) pred.push(free[k].map((v2, a2) => v2 + Rt.reduce((acc, r, j) => acc + Gam[k][j][a2] * r, 0)));
    const slack = Math.max(0, ...sol.x.slice(N));
    return { r: Math.max(-rmax, Math.min(rmax, R[0])), R, pred, iy: md.iy, id: md.id, it: sol.it, ms, slack };
  }

  // ---------------------------------------------------------------- 実際の車（シミュレーション）
  //   kinematic：制御器のモデルと同じ。dynamic：タイヤの横滑りを含む線形 2 輪モデル
  function makeCar(kind = "kinematic") {
    return { kind, X: 0, y: 0, psi: 0, delta: 0, vy: 0, yaw: 0 };
  }
  function stepCar(c, v, rcmd, h, cfg, wind = 0) {
    const r = Math.max(-cfg.rmax, Math.min(cfg.rmax, rcmd));
    c.delta = Math.max(-cfg.dmax, Math.min(cfg.dmax, c.delta + r * h));
    if (c.kind === "kinematic") {
      // 横風は、車を横へ流す速さ vy として効かせる（タイヤが滑らない理想の車でも、風で流される）
      c.vy += (h * wind) / CAR.m - h * 2 * c.vy;
      c.y += h * (v * c.psi + c.vy);
      c.psi += h * (v / CAR.L) * c.delta;
      c.yaw = (v / CAR.L) * c.delta;
    } else {
      const { a, b, m, Iz, Cf, Cr } = CAR;
      const af = c.delta - (c.vy + a * c.yaw) / v, ar = -(c.vy - b * c.yaw) / v;
      const Ff = Cf * af, Fr = Cr * ar;
      const dvy = (Ff + Fr + wind) / m - v * c.yaw;
      const dyaw = (a * Ff - b * Fr) / Iz;
      c.vy += h * dvy; c.yaw += h * dyaw;
      c.psi += h * c.yaw;
      c.y += h * (c.vy + v * c.psi);
    }
    c.X += h * v;
    return c;
  }
  const latAcc = (c, v) => (c.kind === "kinematic" ? (v * v / CAR.L) * c.delta : v * c.yaw);

  // ---------------------------------------------------------------- 道と障害物
  // 障害物 {X, lane, len}。予測ホライズンの各ステップで、車の中心が出てよい横位置の範囲を返す
  function corridor(obstacles, Xcar, v, dt, N, margin = 0.3) {
    const lo = [], hi = [];
    for (let k = 1; k <= N; k++) {
      const X = Xcar + v * dt * k;
      let a = Y_MIN, b = Y_MAX;
      for (const o of obstacles) {
        if (Math.abs(X - o.X) < (o.len + CAR.length) / 2 + 1.5) {
          if (o.lane === 0) a = Math.max(a, ROAD.lane / 2 + CAR.width / 2 + margin);
          else b = Math.min(b, ROAD.lane / 2 - CAR.width / 2 - margin);
        }
      }
      lo.push(a); hi.push(b);
    }
    return { lo, hi };
  }
  // 目標の車線：前方 lookahead 秒以内に自分の車線をふさぐ障害物があれば隣へ、なければ右（0）へ戻る
  function laneRef(obstacles, Xcar, v, lookahead, base = 0) {
    let lane = base;
    for (const o of obstacles) {
      const d = o.X - Xcar;
      if (d > -(o.len + CAR.length) / 2 - 3 && d < v * lookahead && o.lane === lane) lane = 1 - lane;
    }
    return ROAD.lanes[lane];
  }
  function collides(c, obstacles) {
    if (c.y - CAR.width / 2 < ROAD.left || c.y + CAR.width / 2 > ROAD.right) return "edge";
    for (const o of obstacles) {
      if (Math.abs(c.X - o.X) < (o.len + CAR.length) / 2 && Math.abs(c.y - ROAD.lanes[o.lane]) < (CAR.width + 1.6) / 2) return "obstacle";
    }
    return null;
  }


  // 各ステップの目標横位置：その位置で道がふさがっていれば隣の車線、そうでなければ base の車線
  function refFromCorridor(lo, hi, base = 0) {
    return lo.map((a, k) => (a > ROAD.lane / 2 ? ROAD.lanes[1] : hi[k] < ROAD.lane / 2 ? ROAD.lanes[0] : ROAD.lanes[base]));
  }

  // シナリオを最後まで走らせる（解説の図と、テスト用）
  //   cfg：{ v, dt, N, qy, qpsi, qdelta, rr, rhoSlack, dmax, rmax }、opt：{ ctrl: "mpc"|"lqr", T, obstacles, plant, wind(t), lookahead }
  function runScenario(cfg, opt) {
    const mpc = buildMPC(cfg);
    const car = makeCar(opt.plant || "kinematic");
    const h = 0.01, every = Math.round(cfg.dt / h), n = Math.round(opt.T / h);
    const obs = opt.obstacles || [];
    let r = 0, hit = null, maxAcc = 0, maxIt = 0, sumMs = 0, solves = 0, maxSlack = 0;
    const log = { X: [], y: [], delta: [], r: [], acc: [], plans: [] };
    for (let i = 0; i < n; i++) {
      if (i % every === 0) {
        const x0 = stateOf(car, cfg.model || "kinematic");
        const { lo, hi } = corridor(obs, car.X, cfg.v, cfg.dt, cfg.N);
        if (opt.ctrl === "lqr") {
          const yref = laneRef(obs, car.X, cfg.v, opt.lookahead ?? 2);
          r = -mpc.Klqr.reduce((acc, k2, i) => acc + k2 * (x0[i] - (i === mpc.md.iy ? yref : 0)), 0);
        } else {
          const sol = solveMPC(mpc, x0, refFromCorridor(lo, hi, opt.base || 0), lo, hi);
          r = sol.r; maxIt = Math.max(maxIt, sol.it); sumMs += sol.ms; solves++; maxSlack = Math.max(maxSlack, sol.slack);
          if (opt.keepPlans && i % (every * 5) === 0) log.plans.push({ X: car.X, pred: sol.pred });
        }
      }
      stepCar(car, cfg.v, r, h, cfg, opt.wind ? opt.wind(i * h) : 0);
      const acc = latAcc(car, cfg.v);
      maxAcc = Math.max(maxAcc, Math.abs(acc));
      if (!hit) { const c = collides(car, obs); if (c) hit = { kind: c, X: car.X }; }
      if (i % 5 === 0) { log.X.push(car.X); log.y.push(car.y); log.delta.push(car.delta); log.r.push(r); log.acc.push(acc); }
    }
    return { log, hit, maxAcc, maxIt, avgMs: solves ? sumMs / solves : 0, maxSlack };
  }

  root.MPC = { CAR, ROAD, Y_MIN, Y_MAX, model, stateOf, makeQP, solveQP, buildMPC, solveMPC, makeCar, stepCar, latAcc, corridor, laneRef, collides, refFromCorridor, runScenario };
  if (typeof module !== "undefined") module.exports = root.MPC;
})(typeof window !== "undefined" ? window : globalThis);
