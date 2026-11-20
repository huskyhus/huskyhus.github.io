// ロバスト制御の解説ページの動く図。
(() => {
  "use strict";
  const C = PL.C, Cx = PL.Cx;
  const q = (root, sel) => root.querySelector(sel);
  const slider = (root, name, fmt, on) => {
    const el = q(root, `[data-k="${name}"]`), out = q(root, `[data-o="${name}"]`);
    const upd = () => { if (out) out.textContent = fmt(Number(el.value)); on(); };
    el.addEventListener("input", upd);
    return { get v() { return Number(el.value); }, upd };
  };
  const onVisible = (el, f) => { let done = false; new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !done) { done = true; f(); } }), { threshold: 0.05 }).observe(el); };
  const plantJ = (k, w) => { const P = RB.plant(k); return LTI.freq(LTI.ss(P.A, P.Bu, P.Cy, [[0]]), w); };

  // ------------------------------------------------------------ k が変わると、伝わり方がどう変わるか
  function family(root) {
    const cv = q(root, "canvas");
    const K = slider(root, "k", (v) => v.toFixed(2), draw);
    const ws = PL.logspace(0.1, 10, 600);
    function draw() {
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 44, y: 14, w: w - 54, h: h - 36 }, { xmin: 0.1, xmax: 10, xlog: true, ymin: 1e-4, ymax: 1e3, ylog: true, xticks: [0.1, 1, 10], yticks: [1e-4, 1e-2, 1, 1e2], xlabel: "ω [rad/s]", title: "|P(jω)|：押す力 → 右の台車の位置" });
      for (const k of [0.5, 0.75, 1, 1.25, 1.5, 2]) PL.line(ctx, m, ws, ws.map((w) => Cx.abs(plantJ(k, w))), { color: C.muted, width: 1, alpha: 0.6 });
      PL.line(ctx, m, ws, ws.map((w) => Cx.abs(plantJ(K.v, w))), { color: C.link2, width: 2.4 });
      const wr = Math.sqrt(2 * K.v);
      PL.label(ctx, `共振 ω = √(2k) = ${wr.toFixed(2)}`, m.X(wr) + 6, 26);
    }
    K.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ LQG の余裕
  function lqgMargins(root) {
    const [cn, cr] = root.querySelectorAll("canvas");
    const out = q(root, ".readout");
    const R = slider(root, "r", (v) => (10 ** v).toPrecision(2), draw);
    const ws = PL.logspace(0.05, 30, 900);
    function draw() {
      const c = RB.designLQG(1.25, { q: 1, r: 10 ** R.v, W: 1, V: 1e-4 });
      if (!c) return;
      const L = ws.map((w) => RB.loopJ(c, 1.25, w));
      let { ctx, w, h } = PL.fit(cn);
      const S = 2;
      const m = PL.axes(ctx, { x: 24, y: 12, w: w - 34, h: h - 30 }, { xmin: -S, xmax: S, ymin: -S, ymax: S, xticks: [-2, -1, 0, 1, 2], yticks: [-2, -1, 0, 1, 2], zeroY: true, title: "一巡伝達関数 L(jω) のナイキスト線図（−1 の近く）" });
      ctx.strokeStyle = C.muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(m.X(0), m.Y(0), Math.max(0, m.X(1) - m.X(0)), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      PL.line(ctx, m, L.map((z) => (Cx.abs(z) < 4 ? z[0] : NaN)), L.map((z) => (Cx.abs(z) < 4 ? z[1] : NaN)), { color: C.bad, width: 2 });
      PL.cross(ctx, m.X(-1), m.Y(0), 6, C.ink);
      const dmin = Math.min(...L.map((z) => Cx.abs(Cx.add([1, 0], z))));
      // 安定な k の範囲
      ({ ctx, w, h } = PL.fit(cr));
      const ks = []; for (let k = 0.3; k <= 3; k += 0.02) ks.push(k);
      const mm = PL.axes(ctx, { x: 24, y: 18, w: w - 34, h: h - 40 }, { xmin: 0.3, xmax: 3, ymin: 0, ymax: 1, xticks: [0.5, 1, 1.5, 2, 2.5, 3], yticks: [], title: "安定な k（緑）" });
      for (const k of ks) { ctx.fillStyle = RB.maxRe(c, k) < -1e-6 ? C.ok : C.bad; ctx.globalAlpha = 0.6; ctx.fillRect(mm.X(k), mm.Y(1), Math.max(1, mm.X(k + 0.02) - mm.X(k)), mm.Y(0) - mm.Y(1)); }
      ctx.globalAlpha = 1;
      out.textContent = `−1 までの最短距離 ${dmin.toFixed(3)}（感度の最大値 ${(20 * Math.log10(1 / dmin)).toFixed(1)} dB）`;
    }
    onVisible(root, () => R.upd());
    PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 小ゲイン定理の保守性
  function smallGain(root) {
    const [cm, cs] = root.querySelectorAll("canvas");
    const out = q(root, ".readout");
    const D = slider(root, "d", (v) => v.toFixed(2), draw);
    // M(s) = 1/(s² + 0.4 s + 1)、δ で正帰還：s² + 0.4 s + 1 − δ = 0
    const ws = PL.logspace(0.1, 10, 400);
    const Mj = (w) => Cx.div([1, 0], [1 - w * w, 0.4 * w]);
    const peak = Math.max(...ws.map((w) => Cx.abs(Mj(w))));
    function draw() {
      const d = D.v;
      let { ctx, w, h } = PL.fit(cm);
      const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: 0.1, xmax: 10, xlog: true, ymin: 0.01, ymax: 10, ylog: true, xticks: [0.1, 1, 10], yticks: [0.01, 0.1, 1, 10], xlabel: "ω", title: "|M(jω)| と 1/|δ|" });
      PL.line(ctx, m, ws, ws.map((w) => Cx.abs(Mj(w))), { color: C.link2, width: 2 });
      if (Math.abs(d) > 1e-6) PL.line(ctx, m, [0.1, 10], [1 / Math.abs(d), 1 / Math.abs(d)], { color: C.warn, width: 2, dash: [5, 4] });
      // 閉ループ：ẍ + 0.4 ẋ + (1 − δ) x = 0 に初速 1
      ({ ctx, w, h } = PL.fit(cs));
      const ts = [], ys = []; let x = 0, v = 1;
      for (let i = 0; i <= 3000; i++) { const t = i * 0.01; if (i % 5 === 0) { ts.push(t); ys.push(x); } const a = -0.4 * v - (1 - d) * x; v += 0.01 * a; x += 0.01 * v; }
      const stable = d < 1;
      const ms = PL.axes(ctx, { x: 30, y: 14, w: w - 40, h: h - 34 }, { xmin: 0, xmax: 30, ymin: -3, ymax: 3, xticks: [0, 10, 20, 30], yticks: [-2, 0, 2], zeroY: true, title: "閉ループの応答" });
      PL.line(ctx, ms, ts, ys.map((v) => (Math.abs(v) < 4 ? v : NaN)), { color: stable ? C.link2 : C.bad, width: 2 });
      const guaranteed = Math.abs(d) * peak < 1;
      out.innerHTML = `小ゲインの条件 |δ|·max|M| = ${(Math.abs(d) * peak).toFixed(2)} ${guaranteed ? "< 1：安定が<b>保証される</b>" : "≥ 1：保証<b>できない</b>"}。実際は${stable ? '<span class="good">安定</span>' : '<span class="badv">不安定</span>'}。`;
    }
    D.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 性能の要求と γ
  function gammaCurve(root) {
    const cv = q(root, "canvas");
    const out = q(root, ".readout");
    let data = null;
    function compute() {
      const perfs = PL.logspace(0.03, 10, 14);
      data = perfs.map((p) => { const h = RB.designHinfAuto(0.5, 2, { perf: p }); return { p, g: h ? h.gamma : NaN, lo: h ? h.guaranteed[0] : NaN, hi: h ? h.guaranteed[1] : NaN }; });
      draw();
    }
    function draw() {
      if (!data) return;
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 44, y: 14, w: w - 56, h: h - 36 }, { xmin: 0.03, xmax: 10, xlog: true, ymin: 0.3, ymax: 5, ylog: true, xticks: [0.1, 1, 10], yticks: [0.5, 1, 2, 4], xlabel: "性能の要求（重みの倍率）", title: "達成できる γ（k = 0.5〜2 を想定）" });
      ctx.strokeStyle = C.bad; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(44, m.Y(1)); ctx.lineTo(w - 12, m.Y(1)); ctx.stroke(); ctx.setLineDash([]);
      PL.line(ctx, m, data.map((d) => d.p), data.map((d) => d.g), { color: C.ok, width: 2.4 });
      for (const d of data) PL.dot(ctx, m.X(d.p), m.Y(d.g), 3.5, d.g <= 1 ? C.ok : C.bad);
      PL.label(ctx, "γ = 1：ここより下なら k = 0.5〜2 全体で安定を保証", 50, m.Y(1) - 10, { color: C.bad });
      const last = data.filter((d) => d.g <= 1).pop();
      out.textContent = last ? `γ ≤ 1 を保てる最大の要求はおよそ ${last.p.toFixed(2)} 倍。それ以上を求めると、保証できる範囲が狭まる（例：${data[data.length - 1].p.toFixed(0)} 倍で k = ${data[data.length - 1].lo.toFixed(2)}〜${data[data.length - 1].hi.toFixed(2)}）。` : "";
    }
    onVisible(root, () => setTimeout(compute, 20));
    PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 保証する範囲と性能のトレードオフ
  function tradeoff(root) {
    const [ct, cs] = root.querySelectorAll("canvas");
    let data = null, lqg = null, hw = null;
    const ws = PL.logspace(0.05, 20, 400);
    function compute() {
      const widths = [0.1, 0.25, 0.4, 0.55, 0.7, 0.75];
      data = widths.map((dk) => {
        const h = RB.designHinfAuto(1.25 - dk, 1.25 + dk);
        let worst = 0;
        for (const k of [1.25 - dk, 1.25, 1.25 + dk]) { const r = RB.impulse(h, k, 60, 0.02); worst = Math.max(worst, RB.settleTime(r)); }
        return { dk, worst, h };
      });
      lqg = RB.designLQG(1.25, { q: 1, r: 0.1 });
      hw = data[data.length - 1].h;
      draw();
    }
    function draw() {
      if (!data) return;
      let { ctx, w, h } = PL.fit(ct);
      const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: 0, xmax: 0.8, ymin: 0, ymax: 40, xticks: [0, 0.2, 0.4, 0.6, 0.8], yticks: [0, 10, 20, 30, 40], xlabel: "保証する範囲の半幅 δ（k = 1.25 ± δ）", title: "いちばん遅い整定時間 [s]" });
      PL.line(ctx, m, data.map((d) => d.dk), data.map((d) => d.worst), { color: C.ok, width: 2.4 });
      for (const d of data) PL.dot(ctx, m.X(d.dk), m.Y(d.worst), 4, C.ok);
      ({ ctx, w, h } = PL.fit(cs));
      const ms = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: 0.05, xmax: 20, xlog: true, ymin: 0.05, ymax: 100, ylog: true, xticks: [0.1, 1, 10], yticks: [0.1, 1, 10, 100], xlabel: "ω [rad/s]", title: "感度 |S(jω)| = |1/(1+L)|（1 より下なら外乱を抑える）" });
      ctx.strokeStyle = C.muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(40, ms.Y(1)); ctx.lineTo(w - 10, ms.Y(1)); ctx.stroke(); ctx.setLineDash([]);
      for (const [c, col] of [[lqg, C.bad], [hw, C.ok]]) PL.line(ctx, ms, ws, ws.map((w) => 1 / Cx.abs(Cx.add([1, 0], RB.loopJ(c, 1.25, w)))), { color: col, width: 2 });
    }
    onVisible(root, () => setTimeout(compute, 20));
    PL.onRedraw(draw);
  }

  const FIGS = { family, lqgMargins, smallGain, gammaCurve, tradeoff };
  document.querySelectorAll("[data-fig]").forEach((el) => { const f = FIGS[el.dataset.fig]; if (f) f(el); });
})();
