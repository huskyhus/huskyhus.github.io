// 解説ページの小さな動く図。<canvas data-demo="…"> を見つけて動かす。
(function () {
  "use strict";
  const SEED = window.TRIPLE_SEED;
  const TAU = 2 * Math.PI, DEG = Math.PI / 180;

  let C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["ink", "muted", "line", "grid", "card", "bg", "link1", "link2", "link3", "cart", "ref", "ok", "bad", "warn"])
      C[k] = cs.getPropertyValue("--" + k).trim();
  }
  readColors();
  const redraws = [];
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); redraws.forEach((f) => f()); });
  window.addEventListener("resize", () => redraws.forEach((f) => f()));

  function fit(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawPend(ctx, md, s, ox, oy, k, colors, width, alpha = 1) {
    const g = TM.geometry(md, s);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(ox + g.pts[i][0] * k, oy - g.pts[i][1] * k);
      ctx.lineTo(ox + g.pts[i + 1][0] * k, oy - g.pts[i + 1][1] * k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return g;
  }
  function drawCart(ctx, x, y, k, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 0.07 * k, y - 0.025 * k, 0.14 * k, 0.05 * k);
  }

  // 時系列の小さなグラフ
  function plotSeries(ctx, rect, series, opt) {
    const { x, y, w, h } = rect;
    const { tmin, tmax, ymin, ymax, ticks = [], title = "", ylog = false, fmt = String } = opt;
    const X = (t) => x + ((t - tmin) / (tmax - tmin)) * w;
    const tr = (v) => (ylog ? Math.log10(Math.max(v, 1e-300)) : v);
    const Y = (v) => y + h - ((Math.min(Math.max(tr(v), tr(ymin)), tr(ymax)) - tr(ymin)) / (tr(ymax) - tr(ymin))) * h;
    ctx.font = "11px system-ui, sans-serif";
    ctx.strokeStyle = C.grid;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of ticks) {
      ctx.beginPath(); ctx.moveTo(x, Y(t)); ctx.lineTo(x + w, Y(t)); ctx.stroke();
      ctx.fillText(fmt(t), x - 5, Y(t));
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    if (title) ctx.fillText(title, x, y - 3);
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 1.6;
      ctx.globalAlpha = s.alpha || 1;
      ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < s.t.length; i++) {
        const v = s.v[i];
        if (!Number.isFinite(v)) { first = true; continue; }
        if (first) ctx.moveTo(X(s.t[i]), Y(v)); else ctx.lineTo(X(s.t[i]), Y(v));
        first = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    return { X, Y };
  }
  function timeAxis(ctx, X, y, tmin, tmax, step = 1, unit = "s") {
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let t = Math.ceil(tmin / step) * step; t <= tmax + 1e-9; t += step) ctx.fillText(`${+t.toFixed(2)}${unit}`, X(t), y + 4);
  }

  let cachedCtrl = null;
  function seedCtrl() {
    if (!cachedCtrl) {
      const prob = Planner.createProblem(SEED.spec);
      cachedCtrl = TC.buildController(prob, Float64Array.from(SEED.z), { qx: 20, qth: 200, qv: 2, r: 0.05 });
    }
    return cachedCtrl;
  }

  // ------------------------------------------------------------ カオス：ほんの少しだけ違う 2 つの振り子
  function chaosDemo(cv) {
    const md = TM.makeModel(SEED.spec.params);
    const step = TM.makeIntegrator(md);
    const H = 0.001, DUR = 8;
    const readout = document.getElementById(cv.dataset.readout);
    let A, B, diff, t, raf = null;
    const eps = Number(cv.dataset.eps || 1e-6);
    function reset() {
      A = Float64Array.from([0, 0.5, 0.3, 0.8, 0, 0, 0, 0]);
      B = Float64Array.from(A);
      B[3] += eps;
      diff = [];
      t = 0;
    }
    function frame() {
      for (let i = 0; i < 16 && t < DUR; i++) {
        step(A, H, 0, 0, 0);
        step(B, H, 0, 0, 0);
        t += H;
        if (Math.round(t / H) % 20 === 0) {
          let d = 0;
          for (let j = 1; j < 4; j++) d = Math.max(d, Math.abs(TC.wrap(A[j] - B[j])));
          diff.push([t, d]);
        }
      }
      draw();
      if (t < DUR) raf = requestAnimationFrame(frame);
    }
    function draw() {
      const { ctx, w, h } = fit(cv);
      const pw = Math.min(w * 0.42, h);
      const reach = md.l[0] + md.l[1] + md.l[2];
      const k = (pw * 0.48) / reach;
      const ox = pw / 2 + 4, oy = h / 2;
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox - 0.2 * k, oy); ctx.lineTo(ox + 0.2 * k, oy); ctx.stroke();
      drawPend(ctx, md, B, ox, oy, k, [C.warn, C.warn, C.warn], 4, 0.85);
      drawPend(ctx, md, A, ox, oy, k, [C.link1, C.link2, C.link3], 4, 0.9);
      drawCart(ctx, ox, oy, k, C.cart);
      const gx = pw + 50, gw = w - gx - 12;
      const { X } = plotSeries(ctx, { x: gx, y: 22, w: gw, h: h - 54 }, [{ t: diff.map((d) => d[0]), v: diff.map((d) => d[1]), color: C.bad, width: 2 }],
        { tmin: 0, tmax: DUR, ymin: 1e-7, ymax: 4, ylog: true, ticks: [1e-6, 1e-4, 1e-2, 1], title: "2 つの振り子の角度の差 [rad]（対数目盛）", fmt: (v) => v.toExponential(0).replace("e+0", "").replace("e", "e") });
      timeAxis(ctx, X, h - 30, 0, DUR, 2);
      if (readout) {
        const last = diff.length ? diff[diff.length - 1][1] : eps;
        readout.textContent = `t = ${t.toFixed(1)} s　差 = ${last.toExponential(1)} rad（${(last / DEG).toPrecision(2)}°）`;
      }
    }
    reset();
    redraws.push(draw);
    const btn = document.getElementById(cv.dataset.button);
    if (btn) btn.addEventListener("click", () => { cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(frame); });
    // 画面に入ったら動かす
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && t === 0) raf = requestAnimationFrame(frame); }), { threshold: 0.3 }).observe(cv);
    draw();
  }

  // ------------------------------------------------------------ 計画した軌道のストロボ写真
  function planDemo(cv) {
    const ctrl = seedCtrl();
    const xs = ctrl.traj.xs, us = ctrl.traj.us, N = xs.length, md = ctrl.md;
    let i = 0, last = performance.now(), acc = 0;
    function draw() {
      const { ctx, w, h } = fit(cv);
      const sh = h * 0.62;
      const reach = md.l[0] + md.l[1] + md.l[2];
      const k = Math.min(w / (2 * SEED.spec.xmax + 0.4), sh / (2 * reach + 0.1));
      const ox = w / 2, oy = sh / 2 + 4;
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox - (SEED.spec.xmax + 0.1) * k, oy + 0.03 * k); ctx.lineTo(ox + (SEED.spec.xmax + 0.1) * k, oy + 0.03 * k); ctx.stroke();
      for (let j = 0; j < N; j += 60) drawPend(ctx, md, xs[j], ox, oy, k, [C.ref, C.ref, C.ref], 1.5, 0.25 + 0.5 * (j / N));
      drawPend(ctx, md, xs[i], ox, oy, k, [C.link1, C.link2, C.link3], 4);
      drawCart(ctx, ox + xs[i][0] * k, oy, k, C.cart);
      const T = ctrl.T, ts = xs.map((_, j) => (j * T) / (N - 1));
      const gy = sh + 22, gh = (h - sh - 52) / 2;
      const r1 = plotSeries(ctx, { x: 46, y: gy, w: w - 58, h: gh }, [{ t: ts, v: xs.map((s) => s[0]), color: C.cart }],
        { tmin: 0, tmax: T, ymin: -0.8, ymax: 0.8, ticks: [-0.75, 0, 0.75], title: "台車の位置 x [m]" });
      const r2 = plotSeries(ctx, { x: 46, y: gy + gh + 18, w: w - 58, h: gh }, [{ t: ts, v: us, color: C.warn }],
        { tmin: 0, tmax: T, ymin: -9, ymax: 9, ticks: [-8, 0, 8], title: "台車の加速度 u [m/s²]（これが台本）" });
      timeAxis(ctx, r2.X, gy + 2 * gh + 18, 0, T, 0.5);
      ctx.strokeStyle = C.link2;
      ctx.lineWidth = 1.5;
      const tx = r1.X(ts[i]);
      ctx.beginPath(); ctx.moveTo(tx, gy); ctx.lineTo(tx, gy + 2 * gh + 18); ctx.stroke();
    }
    function frame(now) {
      acc += Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      i = Math.floor(acc / 0.002) % (N + 300); // 最後で少し止まる
      if (i >= N) i = N - 1;
      draw();
      requestAnimationFrame(frame);
    }
    redraws.push(draw);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ 時変 LQR のゲインと「各点で LQR を解いた」ゲイン
  function gainsDemo(cv) {
    const ctrl = seedCtrl();
    const TS = TC.TS, N = ctrl.N, STRIDE = 5;
    const btn = document.getElementById(cv.dataset.button);
    let frozen = null;
    const comps = [[1, "θ₁", C.link1], [2, "θ₂", C.link2], [3, "θ₃", C.link3]];
    function computeFrozen() {
      const w = ctrl.weights, q = [w.qx, w.qth, w.qth, w.qth, w.qv, w.qv, w.qv, w.qv];
      const Q = LA.zeros(8);
      q.forEach((v, i) => (Q[i][i] = v * TS));
      frozen = [];
      for (let k = 0; k < N; k += STRIDE) {
        const { A, B } = TM.linearize(ctrl.md, ctrl.traj.xs[k], ctrl.traj.us[k]);
        const { Ad, Bd } = LA.c2d(A, B, TS);
        frozen.push(LA.dare(Ad, Bd, Q, [[w.r * TS]]).K[0]);
      }
    }
    const sinh = (v) => Math.asinh(v / 30);
    function draw() {
      const { ctx, w, h } = fit(cv);
      const ts = [], tsF = [];
      for (let k = 0; k < N; k += STRIDE) { ts.push(k * TS); }
      if (frozen) for (let k = 0; k < N; k += STRIDE) tsF.push(k * TS);
      const ticks = [-10000, -1000, -100, 0, 100, 1000, 10000].map(sinh);
      const series = [];
      for (const [j, , col] of comps) {
        if (frozen) series.push({ t: tsF, v: frozen.map((K) => sinh(K[j])), color: col, width: 1.2, alpha: 0.45, dash: [3, 3] });
        series.push({ t: ts, v: ts.map((_, i) => sinh(ctrl.Ks[i * STRIDE][j])), color: col, width: 2 });
      }
      const { X } = plotSeries(ctx, { x: 60, y: 20, w: w - 72, h: h - 52 }, series, {
        tmin: 0, tmax: ctrl.T, ymin: sinh(-30000), ymax: sinh(30000), ticks,
        title: frozen ? "フィードバックゲイン K(t)（実線：時変 LQR、点線：各時刻で普通の LQR を解いたもの）" : "時変 LQR のフィードバックゲイン K(t)（角度の成分、目盛は ±10000 まで圧縮）",
        fmt: (v) => { const r = Math.round(30 * Math.sinh(v)); return Math.abs(r) >= 1000 ? `${r / 1000}k` : String(r); },
      });
      timeAxis(ctx, X, h - 32, 0, ctrl.T, 0.5);
      ctx.font = "12px system-ui, sans-serif";
      ctx.textBaseline = "top";
      let lx = 66;
      for (const [, name, col] of comps) {
        ctx.fillStyle = col;
        ctx.fillText(`■ ${name} の成分`, lx, 24);
        lx += 86;
      }
    }
    redraws.push(draw);
    if (btn) btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "計算中…";
      setTimeout(() => { computeFrozen(); draw(); btn.textContent = "比べた"; }, 30);
    });
    draw();
  }

  // ------------------------------------------------------------ カルマンフィルタ：微分 vs 推定
  function kalmanDemo(cv) {
    const ctrl = seedCtrl();
    const sel = document.getElementById(cv.dataset.select);
    let rec = null;
    function run() {
      const sth = Number(sel ? sel.value : 0.1) * DEG;
      const sim = new TC.Sim(ctrl, { noise: { sth, sx: 1e-4, su: 0.5 }, ekfQa: 3, seed: 11 });
      let lastY = null;
      const orig = sim.measure.bind(sim);
      rec = { t: [], tru: [], est: [], dif: [] };
      sim.measure = () => {
        const y = orig();
        rec.dif.push(lastY === null ? NaN : (y[3] - lastY) / TC.TS);
        lastY = y[3];
        return y;
      };
      for (let i = 0; i < 50; i++) sim.step();
      sim.startSwing();
      rec = { t: [], tru: [], est: [], dif: [] };
      lastY = null;
      for (let i = 0; i < ctrl.N; i++) {
        sim.step();
        rec.t.push(i * TC.TS);
        rec.tru.push(sim.s[7]);
        rec.est.push(sim.est[7]);
      }
      draw();
    }
    function draw() {
      if (!rec) return;
      const { ctx, w, h } = fit(cv);
      const { X } = plotSeries(ctx, { x: 46, y: 20, w: w - 58, h: h - 52 }, [
        { t: rec.t, v: rec.dif.slice(0, rec.t.length), color: C.warn, width: 1, alpha: 0.7 },
        { t: rec.t, v: rec.tru, color: C.ink, width: 2.5 },
        { t: rec.t, v: rec.est, color: C.link2, width: 1.6, dash: [5, 3] },
      ], { tmin: 0, tmax: ctrl.T, ymin: -30, ymax: 30, ticks: [-20, 0, 20], title: "第 3 リンクの角速度 θ̇₃ [rad/s]" });
      timeAxis(ctx, X, h - 32, 0, ctrl.T, 0.5);
    }
    redraws.push(draw);
    if (sel) sel.addEventListener("change", run);
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !rec) run(); }), { threshold: 0.1 }).observe(cv);
  }

  const DEMOS = { chaos: chaosDemo, plan: planDemo, gains: gainsDemo, kalman: kalmanDemo };
  document.querySelectorAll("canvas[data-demo]").forEach((cv) => {
    const f = DEMOS[cv.dataset.demo];
    if (f) f(cv);
  });
})();
