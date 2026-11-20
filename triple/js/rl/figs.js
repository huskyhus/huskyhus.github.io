// 強化学習の解説ページの動く図。
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

  // ------------------------------------------------------------ 格子の世界（迷路）
  const MAZE = [
    "S..#....",
    ".#.#.##.",
    ".#...#..",
    ".####.#.",
    "......#G",
  ];
  const H = MAZE.length, W = MAZE[0].length;
  const isWall = (r, c) => r < 0 || c < 0 || r >= H || c >= W || MAZE[r][c] === "#";
  const MOVES = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 上右下左
  const ARROW = ["↑", "→", "↓", "←"];
  function gridStep(r, c, a) {
    const nr = r + MOVES[a][0], nc = c + MOVES[a][1];
    if (isWall(nr, nc)) return [r, c, -1, false];
    return [nr, nc, -1, MAZE[nr][nc] === "G"];
  }
  function drawGrid(ctx, w, h, cell, fn) {
    const s = Math.min((w - 20) / W, (h - 20) / H), ox = (w - s * W) / 2, oy = (h - s * H) / 2;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const x = ox + c * s, y = oy + r * s;
      if (MAZE[r][c] === "#") { ctx.fillStyle = C.ink; ctx.fillRect(x, y, s, s); continue; }
      cell(ctx, r, c, x, y, s);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x, y, s, s);
      if (MAZE[r][c] === "G") PL.label(ctx, "ゴール", x + s / 2, y + s / 2, { align: "center", color: C.ok, font: "600 12px system-ui, sans-serif" });
      if (MAZE[r][c] === "S") PL.label(ctx, "S", x + 6, y + 10, { color: C.muted });
    }
    if (fn) fn(ox, oy, s);
  }

  // Q 学習で迷路を覚える
  function gridQ(root) {
    const cv = q(root, "canvas"), out = q(root, ".readout");
    const btn = q(root, "button"), btnR = root.querySelectorAll("button")[1];
    let Q, pos, ep, steps, hist, running = false;
    const reset = () => { Q = Array.from({ length: H * W }, () => [0, 0, 0, 0]); pos = [0, 0]; ep = 0; steps = 0; hist = []; draw(); };
    const idx = (r, c) => r * W + c;
    function act() {
      const qs = Q[idx(...pos)];
      if (Math.random() < 0.1) return Math.floor(Math.random() * 4);
      const m = Math.max(...qs), best = [0, 1, 2, 3].filter((a) => qs[a] === m);
      return best[Math.floor(Math.random() * best.length)];
    }
    function tick() {
      const a = act();
      const [nr, nc, r, done] = gridStep(pos[0], pos[1], a);
      const target = r + (done ? 0 : 0.95 * Math.max(...Q[idx(nr, nc)]));
      Q[idx(...pos)][a] += 0.5 * (target - Q[idx(...pos)][a]);
      pos = [nr, nc]; steps++;
      if (done || steps > 300) { hist.push(steps); ep++; steps = 0; pos = [0, 0]; }
    }
    function draw() {
      const { ctx, w, h } = PL.fit(cv);
      drawGrid(ctx, w, h, (ctx2, r, c, x, y, s) => {
        const v = Math.max(...Q[idx(r, c)]);
        ctx2.fillStyle = C.link3; ctx2.globalAlpha = Math.min(0.7, Math.max(0.03, 1 + v / 20)) ; ctx2.fillRect(x, y, s, s); ctx2.globalAlpha = 1;
        if (MAZE[r][c] !== "G" && Q[idx(r, c)].some((v2) => v2 !== 0)) {
          const qs = Q[idx(r, c)], a = qs.indexOf(Math.max(...qs));
          PL.label(ctx2, ARROW[a], x + s / 2, y + s / 2, { align: "center", color: C.ink, font: `${Math.round(s * 0.45)}px system-ui, sans-serif` });
        }
      }, (ox, oy, s) => PL.dot(ctx, ox + (pos[1] + 0.5) * s, oy + (pos[0] + 0.5) * s, s * 0.22, C.link1));
      out.textContent = `${ep} 回目の挑戦。直近の歩数：${hist.length ? hist.slice(-5).join("、") : "—"}（最短は 15 歩）`;
    }
    let last = 0;
    function loop(now) {
      if (running && now - last > 30) { for (let i = 0; i < (ep < 3 ? 1 : 8); i++) tick(); last = now; draw(); }
      requestAnimationFrame(loop);
    }
    btn.addEventListener("click", () => { running = !running; btn.textContent = running ? "止める" : "学習を進める"; });
    btnR.addEventListener("click", reset);
    reset(); PL.onRedraw(draw); requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 自分で谷を抜けてみる
  function manual(root) {
    const cv = q(root, "canvas"), out = q(root, ".readout");
    const env = RL.makeEnv();
    let a = 1, done = false, best = null;
    const reset = () => { RL.resetEnv(env); env.x = -0.5; done = false; };
    reset();
    const bs = root.querySelectorAll("button");
    const hold = (b, val) => {
      b.addEventListener("pointerdown", () => (a = val));
      b.addEventListener("pointerup", () => (a = 1));
      b.addEventListener("pointerleave", () => (a = 1));
    };
    hold(bs[0], 0); hold(bs[1], 2);
    bs[2].addEventListener("click", reset);
    root.tabIndex = 0;
    root.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { a = 0; e.preventDefault(); } if (e.key === "ArrowRight") { a = 2; e.preventDefault(); } });
    root.addEventListener("keyup", (e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") a = 1; });
    let acc = 0, last = performance.now();
    function loop(now) {
      acc += Math.min(0.05, (now - last) / 1000); last = now;
      while (acc > 1 / 60) { acc -= 1 / 60; if (!done) { done = RL.stepEnv(env, a).done; if (done) best = best === null ? env.t : Math.min(best, env.t); } }
      const { ctx, w, h } = PL.fit(cv);
      const X = (x) => 20 + ((x - RL.X_MIN) / (RL.X_MAX - RL.X_MIN)) * (w - 40), Y = (y) => h * 0.55 - y * h * 0.35;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 160; i++) { const x = RL.X_MIN + ((RL.X_MAX - RL.X_MIN) * i) / 160; if (i) ctx.lineTo(X(x), Y(RL.height(x))); else ctx.moveTo(X(x), Y(RL.height(x))); }
      ctx.stroke();
      ctx.fillStyle = C.ok; ctx.fillRect(X(RL.GOAL) - 2, Y(RL.height(RL.GOAL)) - 30, 4, 30);
      PL.dot(ctx, X(env.x), Y(RL.height(env.x)) - 9, 9, a === 1 ? C.link1 : C.warn);
      PL.label(ctx, done ? `着いた！ ${env.t} 歩` : `${env.t} 歩`, 12, 16, { color: done ? C.ok : C.muted, font: "600 13px system-ui, sans-serif" });
      out.textContent = best !== null ? `あなたの最短：${best} 歩（学習した台車はおよそ 100 歩）` : "← → キー（またはボタンを押し続ける）で台車を押す。";
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 価値反復
  function valueIter(root) {
    const cv = q(root, "canvas"), out = q(root, ".readout");
    const [bStep, bRun, bReset] = root.querySelectorAll("button");
    let V, k, timer = null;
    const reset = () => { V = new Array(H * W).fill(0); k = 0; draw(); };
    function sweep() {
      const Vn = V.slice();
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (MAZE[r][c] === "#" || MAZE[r][c] === "G") continue;
        let best = -Infinity;
        for (let a = 0; a < 4; a++) { const [nr, nc, rew] = gridStep(r, c, a); best = Math.max(best, rew + V[nr * W + nc]); }
        Vn[r * W + c] = best;
      }
      V = Vn; k++; draw();
    }
    function draw() {
      const { ctx, w, h } = PL.fit(cv);
      const vmin = Math.min(-1, ...V);
      drawGrid(ctx, w, h, (ctx2, r, c, x, y, s) => {
        const v = V[r * W + c];
        ctx2.fillStyle = C.link2; ctx2.globalAlpha = Math.max(0.04, 1 - v / vmin) * 0.7; ctx2.fillRect(x, y, s, s); ctx2.globalAlpha = 1;
        if (MAZE[r][c] !== "G") PL.label(ctx2, v.toFixed(0), x + s / 2, y + s / 2, { align: "center", color: C.ink, font: `${Math.round(s * 0.3)}px system-ui, sans-serif` });
      });
      out.textContent = `${k} 回更新した。数字は「ゴールまであと何歩か」をマイナスにしたもの。`;
    }
    bStep.addEventListener("click", sweep);
    bRun.addEventListener("click", () => { clearInterval(timer); timer = setInterval(() => { sweep(); if (k > 30) clearInterval(timer); }, 250); });
    bReset.addEventListener("click", () => { clearInterval(timer); reset(); });
    reset(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 多腕バンディット
  function bandit(root) {
    const cv = q(root, "canvas");
    const E = slider(root, "eps", (v) => v.toFixed(2), () => {});
    const btn = q(root, "button");
    let res = null;
    function run() {
      const steps = 1000, runs = 200, rnd = RL.rng(11);
      const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
      const eps = [0, 0.01, 0.1, E.v];
      res = eps.map((e) => ({ e, avg: new Float64Array(steps) }));
      for (let r = 0; r < runs; r++) {
        const mu = Array.from({ length: 10 }, gauss);
        for (const s of res) {
          const Qv = new Float64Array(10), N = new Float64Array(10);
          for (let t = 0; t < steps; t++) {
            let a;
            if (rnd() < s.e) a = Math.floor(rnd() * 10);
            else { let m = -Infinity; a = 0; for (let i = 0; i < 10; i++) if (Qv[i] > m) { m = Qv[i]; a = i; } }
            const rew = mu[a] + gauss();
            N[a]++; Qv[a] += (rew - Qv[a]) / N[a];
            s.avg[t] += rew / runs;
          }
        }
      }
      draw();
    }
    function draw() {
      if (!res) return;
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: 1, xmax: 1000, ymin: 0, ymax: 1.6, xticks: [1, 250, 500, 750, 1000], yticks: [0, 0.5, 1, 1.5], xlabel: "引いた回数", title: "平均の報酬（200 回の実験の平均）" });
      const cols = [C.bad, C.warn, C.link3, C.link2];
      res.forEach((s, i) => {
        const xs = [], ys = [];
        for (let t = 0; t < 1000; t += 5) { xs.push(t + 1); let a = 0; for (let j = t; j < t + 5; j++) a += s.avg[j]; ys.push(a / 5); }
        PL.line(ctx, m, xs, ys, { color: cols[i], width: i === 3 ? 2.6 : 1.6, dash: i === 3 ? [6, 3] : [] });
        PL.label(ctx, i === 3 ? `ε = ${s.e}（スライダー）` : `ε = ${s.e}`, w - 14, h - 110 + i * 16, { align: "right", color: cols[i] });
      });
    }
    btn.addEventListener("click", run);
    E.upd();
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !res) run(); }), { threshold: 0.05 }).observe(root);
    PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ タイルコーディング
  function tiles(root) {
    const cv = q(root, "canvas"), out = q(root, ".readout");
    const N = slider(root, "n", (v) => `${v} 枚`, draw);
    let pt = [-0.5, 0.01];
    cv.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      const fx = (e.clientX - r.left - 36) / (r.width - 46), fy = 1 - (e.clientY - r.top - 10) / (r.height - 34);
      pt = [RL.X_MIN + fx * (RL.X_MAX - RL.X_MIN), -RL.V_MAX + fy * 2 * RL.V_MAX];
      draw();
    });
    function draw() {
      const n = N.v, T = RL.makeTiles(n, 8);
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 36, y: 10, w: w - 46, h: h - 34 }, { xmin: RL.X_MIN, xmax: RL.X_MAX, ymin: -RL.V_MAX, ymax: RL.V_MAX, xticks: [-1.2, -0.6, 0, 0.5], yticks: [-0.07, 0, 0.07], xlabel: "位置", yfmt: (v) => v.toFixed(2) });
      // 他の点との「重なりの数」（汎化の広がり）
      const F = new Set(T.active(pt[0], pt[1]));
      const G = 60, cw = (w - 46) / G, ch = (h - 34) / G;
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        const x = RL.X_MIN + ((i + 0.5) / G) * (RL.X_MAX - RL.X_MIN), v = -RL.V_MAX + ((j + 0.5) / G) * 2 * RL.V_MAX;
        const k = T.active(x, v).filter((f) => F.has(f)).length;
        if (k) { ctx.fillStyle = C.link3; ctx.globalAlpha = (0.6 * k) / n; ctx.fillRect(36 + i * cw, 10 + (G - 1 - j) * ch, cw + 0.5, ch + 0.5); }
      }
      ctx.globalAlpha = 1;
      // 1 枚目の格子
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const X = 36 + (i / 8) * (w - 46), Y = 10 + (i / 8) * (h - 34);
        ctx.beginPath(); ctx.moveTo(X, 10); ctx.lineTo(X, h - 24); ctx.moveTo(36, Y); ctx.lineTo(w - 10, Y); ctx.stroke();
      }
      PL.dot(ctx, m.X(pt[0]), m.Y(pt[1]), 5, C.link1);
      out.textContent = `この点は ${n} 枚の格子それぞれで 1 つずつ、計 ${n} 個のタイルに属する。濃いところほど、この点と多くのタイルを共有している（学んだことが伝わる）。`;
    }
    N.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 方策反復は LQR に収束する
  function lqrPI(root) {
    const cv = q(root, "canvas"), out = q(root, ".readout");
    const dt = 0.1, A = [[1, dt], [0, 1]], B = [[dt * dt / 2], [dt]], Q = [[1, 0], [0, 0.1]], R = [[0.1]];
    const opt = LA.dare(A, B, Q, R).K[0];
    function evalP(K) { // P = Q + KᵀRK + (A−BK)ᵀ P (A−BK)
      const Ac = LA.sub(A, LA.mul(B, [K]));
      const Qc = LA.add(Q, LA.mul(LA.T([K]), LA.mul(R, [K])));
      let P = Qc;
      for (let i = 0; i < 3000; i++) P = LA.add(Qc, LA.mul(LA.mul(LA.T(Ac), P), Ac));
      return P;
    }
    const iters = [];
    let K = [1, 1];
    for (let i = 0; i < 7; i++) {
      iters.push(K);
      const P = evalP(K);
      const BtP = LA.mul(LA.T(B), P);
      K = LA.mul(LA.inv(LA.add(R, LA.mul(BtP, B))), LA.mul(BtP, A))[0];
    }
    function draw() {
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: 0, xmax: 6, ymin: 0, ymax: 4, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 1, 2, 3, 4], xlabel: "方策反復の回数", title: "フィードバックゲイン K = [k₁, k₂]" });
      for (const [j, col] of [[0, C.link1], [1, C.link3]]) {
        PL.line(ctx, m, [0, 6], [opt[j], opt[j]], { color: col, dash: [5, 4], width: 1.2 });
        PL.line(ctx, m, iters.map((_, i) => i), iters.map((k) => k[j]), { color: col, width: 2.2 });
        iters.forEach((k, i) => PL.dot(ctx, m.X(i), m.Y(k[j]), 3.5, col));
      }
      PL.label(ctx, "点線：リッカチ方程式の解（LQR）", w - 14, 24, { align: "right" });
      out.textContent = `適当な K = [1, 1] から始めて、「評価」と「改善」を ${iters.length - 1} 回繰り返すと、K = [${iters[iters.length - 1].map((v) => v.toFixed(3)).join(", ")}]。LQR の K = [${opt.map((v) => v.toFixed(3)).join(", ")}] に一致する。`;
    }
    draw(); PL.onRedraw(draw);
  }

  const FIGS = { gridQ, manual, valueIter, bandit, tiles, lqrPI };
  document.querySelectorAll("[data-fig]").forEach((el) => { const f = FIGS[el.dataset.fig]; if (f) f(el); });
})();
