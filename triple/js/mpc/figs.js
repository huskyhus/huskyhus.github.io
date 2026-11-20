// モデル予測制御の解説ページの動く図。
(() => {
  "use strict";
  const C = PL.C;
  const q = (root, sel) => root.querySelector(sel);
  const slider = (root, name, fmt, on) => {
    const el = q(root, `[data-k="${name}"]`), out = q(root, `[data-o="${name}"]`);
    const upd = () => { if (out) out.textContent = fmt(Number(el.value)); on(); };
    el.addEventListener("input", upd);
    return { get v() { return Number(el.value); }, upd };
  };
  const onVisible = (el, f) => { let done = false; new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !done) { done = true; f(); } }), { threshold: 0.05 }).observe(el); };
  const BASE = { v: 20, dt: 0.1, N: 30, qy: 1, qpsi: 10, qdelta: 10, rr: 100, rhoSlack: 1000, dmax: (5 * MPC.CAR.L) / 400, rmax: 0.05 };
  const { ROAD, CAR } = MPC;

  // 道路を横から伸ばした図（横軸：進んだ距離、縦軸：横位置）に、軌跡を重ねる
  function roadAxes(ctx, w, h, X0, X1) {
    const m = PL.axes(ctx, { x: 36, y: 10, w: w - 46, h: h - 30 }, { xmin: X0, xmax: X1, ymin: ROAD.left - 0.5, ymax: ROAD.right + 0.5, xticks: [0, 25, 50, 75, 100, 125, 150].filter((v) => v >= X0 && v <= X1), yticks: [0, 3.5], xfmt: (v) => `${v}m` });
    ctx.fillStyle = C.grid; ctx.fillRect(36, m.Y(ROAD.right), w - 46, m.Y(ROAD.left) - m.Y(ROAD.right));
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
    for (const y of [ROAD.left, ROAD.right]) { ctx.beginPath(); ctx.moveTo(36, m.Y(y)); ctx.lineTo(w - 10, m.Y(y)); ctx.stroke(); }
    ctx.strokeStyle = C.muted; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(36, m.Y(ROAD.lane / 2)); ctx.lineTo(w - 10, m.Y(ROAD.lane / 2)); ctx.stroke(); ctx.setLineDash([]);
    return m;
  }
  function drawObs(ctx, m, obs) {
    for (const o of obs) {
      const y = ROAD.lanes[o.lane];
      ctx.fillStyle = C.warn; ctx.fillRect(m.X(o.X - o.len / 2), m.Y(y + 0.8), m.X(o.X + o.len / 2) - m.X(o.X - o.len / 2), m.Y(y - 0.8) - m.Y(y + 0.8));
    }
  }

  // ------------------------------------------------------------ 予測と再計画（計画を重ね描き）
  function plans(root) {
    const cv = q(root, "canvas");
    let res = null;
    const obs = [{ X: 60, lane: 0, len: CAR.length }];
    function draw() {
      if (!res) return;
      const { ctx, w, h } = PL.fit(cv);
      const m = roadAxes(ctx, w, h, 0, 150);
      drawObs(ctx, m, obs);
      res.log.plans.forEach((p, i) => {
        const xs = p.pred.map((_, k) => p.X + BASE.v * BASE.dt * (k + 1));
        PL.line(ctx, m, xs, p.pred.map((s) => s[0]), { color: C.link2, width: 1.2, alpha: 0.35 + 0.4 * (i / res.log.plans.length), dash: [3, 3] });
        PL.dot(ctx, m.X(p.X), m.Y(res.log.y[Math.round(p.X / (BASE.v * 0.05))] ?? 0), 3, C.link2);
      });
      PL.line(ctx, m, res.log.X, res.log.y, { color: C.link1, width: 2.6 });
    }
    onVisible(root, () => { res = MPC.runScenario(BASE, { ctrl: "mpc", T: 7, obstacles: obs, keepPlans: true }); draw(); });
    PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 壁の手前で止まる：LQR ＋ 飽和 と MPC
  function wall(root) {
    const [cp, cu] = root.querySelectorAll("canvas");
    const Q = slider(root, "q", (v) => (10 ** v).toPrecision(2), draw);
    const dt = 0.05, T = 6, N = 40, WALL = 1, TARGET = 0.95;
    const A = [[1, dt], [0, 1]], B = [[dt * dt / 2], [dt]];
    function sim(kind, qv) {
      const Qm = [[qv, 0], [0, 1]];
      const { K, P } = LA.dare(A, B, Qm, [[1]]);
      let x = [0, 0]; const ts = [], ps = [], us = [];
      // MPC の行列（u だけが変数）
      let qp = null, Gam = null, Phi = null;
      if (kind === "mpc") {
        Phi = []; Gam = [];
        let Ak = [[1, 0], [0, 1]];
        const AjB = [[B[0][0], B[1][0]]];
        for (let p = 1; p < N; p++) AjB.push([A[0][0] * AjB[p - 1][0] + A[0][1] * AjB[p - 1][1], A[1][0] * AjB[p - 1][0] + A[1][1] * AjB[p - 1][1]]);
        for (let k = 1; k <= N; k++) { Ak = LA.mul(A, Ak); Phi.push(Ak); Gam.push(Array.from({ length: N }, (_, j) => (j < k ? AjB[k - 1 - j] : [0, 0]))); }
        const Pq = LA.zeros(N);
        for (let k = 0; k < N; k++) {
          const Qk = k === N - 1 ? LA.add(Qm, P) : Qm;
          for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
            const gi = Gam[k][i], gj = Gam[k][j];
            Pq[i][j] += 2 * (gi[0] * (Qk[0][0] * gj[0] + Qk[0][1] * gj[1]) + gi[1] * (Qk[1][0] * gj[0] + Qk[1][1] * gj[1]));
          }
        }
        for (let i = 0; i < N; i++) Pq[i][i] += 2;
        const rows = [];
        for (let k = 0; k < N; k++) { const r = new Array(N).fill(0); r[k] = 1; rows.push(r); }
        for (let k = 0; k < N; k++) rows.push(Gam[k].map((g) => g[0]));
        qp = MPC.makeQP(Pq, rows);
      }
      let ws = null;
      for (let i = 0; i <= T / dt; i++) {
        let u;
        if (kind === "lqr") u = -(K[0][0] * (x[0] - TARGET) + K[0][1] * x[1]);
        else {
          const qv2 = new Array(N).fill(0), free = [];
          for (let k = 0; k < N; k++) {
            const px = [Phi[k][0][0] * x[0] + Phi[k][0][1] * x[1], Phi[k][1][0] * x[0] + Phi[k][1][1] * x[1]];
            free.push(px);
            const Qk = k === N - 1 ? LA.add(Qm, P) : Qm;
            const e = [px[0] - TARGET, px[1]];
            const Qe = [Qk[0][0] * e[0] + Qk[0][1] * e[1], Qk[1][0] * e[0] + Qk[1][1] * e[1]];
            for (let j = 0; j < N; j++) qv2[j] += 2 * (Gam[k][j][0] * Qe[0] + Gam[k][j][1] * Qe[1]);
          }
          const l = [], uu = [];
          for (let k = 0; k < N; k++) { l.push(-1); uu.push(1); }
          for (let k = 0; k < N; k++) { l.push(-Infinity); uu.push(WALL - free[k][0]); }
          const s = MPC.solveQP(qp, qv2, l, uu, ws);
          ws = { x: s.x.slice(1).concat([0]) };
          u = s.x[0];
        }
        u = Math.max(-1, Math.min(1, u));
        ts.push(i * dt); ps.push(x[0]); us.push(u);
        x = [x[0] + dt * x[1] + (dt * dt / 2) * u, x[1] + dt * u];
        if (x[0] > WALL + 0.3) x[0] = WALL + 0.3;
      }
      return { ts, ps, us };
    }
    function draw() {
      const qv = 10 ** Q.v;
      const a = sim("lqr", qv), b = sim("mpc", qv);
      let { ctx, w, h } = PL.fit(cp);
      let m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 34 }, { xmin: 0, xmax: T, ymin: 0, ymax: 1.4, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 0.5, 1], xfmt: (v) => `${v}s`, title: "位置（1 のところに壁）" });
      ctx.fillStyle = C.bad; ctx.globalAlpha = 0.12; ctx.fillRect(40, 14, w - 50, m.Y(1) - 14); ctx.globalAlpha = 1;
      PL.line(ctx, m, a.ts, a.ps, { color: C.muted, width: 2, dash: [5, 4] });
      PL.line(ctx, m, b.ts, b.ps, { color: C.link1, width: 2.4 });
      ({ ctx, w, h } = PL.fit(cu));
      m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 34 }, { xmin: 0, xmax: T, ymin: -1.2, ymax: 1.2, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [-1, 0, 1], xfmt: (v) => `${v}s`, title: "力（±1 が上限）", zeroY: true });
      PL.line(ctx, m, a.ts, a.us, { color: C.muted, width: 2, dash: [5, 4] });
      PL.line(ctx, m, b.ts, b.us, { color: C.link1, width: 2.4 });
    }
    Q.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 二次計画問題を内点法で解く様子（2 変数）
  function qp2d(root) {
    const cv = q(root, "canvas");
    const out = q(root, ".readout");
    const ANG = slider(root, "a", (v) => `${v}°`, draw);
    const Hm = [[2, 0.8], [0.8, 1]];
    const rows = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
    const ub = [1.5, 1.2, 1.5, 1.2, 1.8];
    function draw() {
      const a = (ANG.v * Math.PI) / 180, c = [2.6 * Math.cos(a), 2.6 * Math.sin(a)];
      const qv = [-(Hm[0][0] * c[0] + Hm[0][1] * c[1]), -(Hm[1][0] * c[0] + Hm[1][1] * c[1])];
      const qp = MPC.makeQP(Hm, rows);
      const ws = { trace: [] };
      const sol = MPC.solveQP(qp, qv, rows.map(() => -Infinity), ub, ws);
      const { ctx, w, h } = PL.fit(cv);
      const R = 3.2;
      const m = PL.axes(ctx, { x: 30, y: 10, w: w - 40, h: h - 30 }, { xmin: -R * (w - 40) / (h - 30), xmax: R * (w - 40) / (h - 30), ymin: -R, ymax: R, xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [-3, -2, -1, 0, 1, 2, 3] });
      // 目的関数の等高線
      const f = (x, y) => { const d = [x - c[0], y - c[1]]; return 0.5 * (Hm[0][0] * d[0] * d[0] + 2 * Hm[0][1] * d[0] * d[1] + Hm[1][1] * d[1] * d[1]); };
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      for (const lev of [0.25, 1, 2.25, 4, 6.25, 9, 12.25]) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const t = (i / 120) * 2 * Math.PI;
          // H の等高線は楕円：(x−c)ᵀH(x−c) = 2 lev
          const ev = LA.eig(Hm).map((e) => e.re).sort((p, q2) => p - q2);
          const th = 0.5 * Math.atan2(2 * Hm[0][1], Hm[0][0] - Hm[1][1]);
          const r1 = Math.sqrt((2 * lev) / ev[1]), r2 = Math.sqrt((2 * lev) / ev[0]);
          const x = c[0] + r1 * Math.cos(t) * Math.cos(th) - r2 * Math.sin(t) * Math.sin(th);
          const y = c[1] + r1 * Math.cos(t) * Math.sin(th) + r2 * Math.sin(t) * Math.cos(th);
          if (i) ctx.lineTo(m.X(x), m.Y(y)); else ctx.moveTo(m.X(x), m.Y(y));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 実行可能領域（多角形）
      const poly = [[1.5, 0.3], [0.6, 1.2], [-1.5, 1.2], [-1.5, -1.2], [1.5, -1.2]];
      ctx.fillStyle = C.ok; ctx.globalAlpha = 0.12; ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(m.X(x), m.Y(y)) : ctx.moveTo(m.X(x), m.Y(y))));
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = C.ok; ctx.lineWidth = 2; ctx.stroke();
      // 内点法の通り道
      PL.line(ctx, m, ws.trace.map((z) => z[0]), ws.trace.map((z) => z[1]), { color: C.link1, width: 1.6 });
      ws.trace.forEach((z, i) => PL.dot(ctx, m.X(z[0]), m.Y(z[1]), i === ws.trace.length - 1 ? 6 : 3, C.link1));
      PL.cross(ctx, m.X(c[0]), m.Y(c[1]), 6, C.ink);
      PL.label(ctx, "制約がなければここが最小", m.X(c[0]) + 8, m.Y(c[1]) - 10);
      out.textContent = `${sol.it} 回の反復で解 (${sol.x[0].toFixed(3)}, ${sol.x[1].toFixed(3)}) に到達。途中の点は、ずっと領域の内側を通る。`;
    }
    ANG.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 予測ホライズンの長さ
  function horizons(root) {
    const cv = q(root, "canvas");
    const obs = [{ X: 60, lane: 0, len: CAR.length }];
    const Ns = [[5, C.bad], [10, C.warn], [15, C.link3], [30, C.link1]];
    let res = null;
    function draw() {
      if (!res) return;
      const { ctx, w, h } = PL.fit(cv);
      const m = roadAxes(ctx, w, h, 0, 150);
      drawObs(ctx, m, obs);
      res.forEach((r) => {
        PL.line(ctx, m, r.log.X, r.log.y.map((y) => Math.max(ROAD.left - 0.4, Math.min(ROAD.right + 0.4, y))), { color: r.col, width: 2.2 });
        if (r.hit) PL.cross(ctx, m.X(r.hit.X), m.Y(r.log.y[Math.min(r.log.y.length - 1, Math.round(r.hit.X / (BASE.v * 0.05)))]), 7, r.col);
      });
      let lx = 44;
      res.forEach((r) => { PL.label(ctx, `N=${r.N}（${(r.N / 10).toFixed(1)} 秒先）${r.hit ? "：接触" : ""}`, lx, 20, { color: r.col }); lx += 150; });
    }
    onVisible(root, () => {
      res = Ns.map(([N, col]) => ({ N, col, ...MPC.runScenario({ ...BASE, N }, { ctrl: "mpc", T: 7, obstacles: obs }) }));
      draw();
    });
    PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ モデル誤差：簡単なモデル vs 横滑りも考えたモデル
  function mismatch(root) {
    const cv = q(root, "canvas");
    const wind = q(root, '[data-k="wind"]');
    const obs = [{ X: 60, lane: 0, len: CAR.length }];
    let res = null;
    function compute() {
      const wf = wind.checked ? (t) => (t > 1 && t < 4 ? 4000 : 0) : null;
      res = [
        { name: "簡単なモデルの MPC", col: C.bad, ...MPC.runScenario({ ...BASE }, { ctrl: "mpc", T: 7, obstacles: obs, plant: "dynamic", wind: wf }) },
        { name: "横滑りも考えたモデルの MPC", col: C.link1, ...MPC.runScenario({ ...BASE, model: "dynamic" }, { ctrl: "mpc", T: 7, obstacles: obs, plant: "dynamic", wind: wf }) },
      ];
      draw();
    }
    function draw() {
      if (!res) return;
      const { ctx, w, h } = PL.fit(cv);
      const m = roadAxes(ctx, w, h, 0, 150);
      drawObs(ctx, m, obs);
      res.forEach((r, i) => {
        PL.line(ctx, m, r.log.X, r.log.y.map((y) => Math.max(ROAD.left - 0.4, Math.min(ROAD.right + 0.4, y))), { color: r.col, width: 2.2 });
        PL.label(ctx, `${r.name}${r.hit ? `：${r.hit.kind === "edge" ? "道からはみ出した" : "接触"}` : "：無事"}`, 44 + i * 260, 20, { color: r.col });
      });
    }
    wind.addEventListener("change", compute);
    onVisible(root, compute);
    PL.onRedraw(draw);
  }

  const FIGS = { plans, wall, qp2d, horizons, mismatch };
  document.querySelectorAll("[data-fig]").forEach((el) => { const f = FIGS[el.dataset.fig]; if (f) f(el); });
})();
