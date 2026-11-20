// 古典制御の解説ページの動く図。<div class="fig" data-fig="…"> の中の要素を使う。
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
  const visible = (el, f) => new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && f()), { threshold: 0.05 }).observe(el);

  // ------------------------------------------------------------ 1 次遅れ：お茶が冷める・部屋が温まる
  function firstOrder(root) {
    const cv = q(root, "canvas");
    const K = slider(root, "K", (v) => v.toFixed(1), draw);
    const T = slider(root, "T", (v) => `${v.toFixed(1)} 分`, draw);
    function draw() {
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 44, y: 16, w: w - 56, h: h - 40 }, { xmin: 0, xmax: 30, ymin: 0, ymax: 30, xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 10, 20, 30], xfmt: (v) => `${v}分`, title: "部屋の温度の上がり方 [℃]（ヒーターを入れた瞬間から）" });
      const ts = [], ys = [], us = [];
      for (let i = 0; i <= 300; i++) { const t = i / 10; ts.push(t); ys.push(K.v * 10 * (1 - Math.exp(-t / T.v))); us.push(t > 0 ? 10 : 0); }
      PL.line(ctx, m, [0, 30], [K.v * 10, K.v * 10], { color: C.muted, dash: [4, 4], width: 1 });
      PL.line(ctx, m, [T.v, T.v], [0, K.v * 10 * 0.632], { color: C.ok, dash: [3, 3], width: 1.2 });
      PL.label(ctx, "時定数：最終値の 63% に届く時刻", m.X(T.v) + 6, m.Y(K.v * 6.32) + 12, { color: C.ok });
      PL.line(ctx, m, ts, ys, { color: C.link1, width: 2.4 });
      PL.label(ctx, `最終値 = ゲイン × 入力 = ${(K.v * 10).toFixed(0)}℃`, m.X(29), m.Y(K.v * 10) - 10, { align: "right" });
    }
    K.upd(); T.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 2 次遅れ：減衰比と極
  function secondOrder(root) {
    const [cv, cp] = root.querySelectorAll("canvas");
    const Z = slider(root, "z", (v) => v.toFixed(2), draw);
    const W = slider(root, "w", (v) => `${v.toFixed(1)} rad/s`, draw);
    function resp(z, wn, t) {
      if (z < 1) { const wd = wn * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * wn * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t)); }
      if (z === 1) return 1 - Math.exp(-wn * t) * (1 + wn * t);
      const r = Math.sqrt(z * z - 1), s1 = -wn * (z - r), s2 = -wn * (z + r);
      return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
    }
    function draw() {
      const z = Z.v, wn = W.v;
      let { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 36, y: 16, w: w - 46, h: h - 40 }, { xmin: 0, xmax: 6, ymin: 0, ymax: 1.8, xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 0.5, 1, 1.5], xfmt: (v) => `${v}s`, title: "ステップ応答" });
      const ts = [], ys = [];
      for (let i = 0; i <= 600; i++) { const t = i / 100; ts.push(t); ys.push(resp(z, wn, t)); }
      PL.line(ctx, m, [0, 6], [1, 1], { color: C.muted, dash: [4, 4], width: 1 });
      PL.line(ctx, m, ts, ys, { color: C.link2, width: 2.4 });
      const os = Math.max(...ys) - 1;
      PL.label(ctx, `行き過ぎ ${(Math.max(0, os) * 100).toFixed(0)}%`, w - 12, 26, { align: "right" });
      ({ ctx, w, h } = PL.fit(cp));
      const R = 6;
      const mp = PL.axes(ctx, { x: 24, y: 12, w: w - 34, h: h - 30 }, { xmin: -R, xmax: 1, ymin: -R * 0.6, ymax: R * 0.6, xticks: [-6, -4, -2, 0], yticks: [-3, 0, 3], zeroY: true, title: "極の位置（複素平面）" });
      ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.moveTo(mp.X(0), mp.Y(-R)); ctx.lineTo(mp.X(0), mp.Y(R)); ctx.stroke();
      const poles = z < 1 ? [[-z * wn, wn * Math.sqrt(1 - z * z)], [-z * wn, -wn * Math.sqrt(1 - z * z)]]
        : [[-wn * (z - Math.sqrt(z * z - 1)), 0], [-wn * (z + Math.sqrt(z * z - 1)), 0]];
      for (const [re, im] of poles) PL.cross(ctx, mp.X(re), mp.Y(im), 6, C.link2);
      PL.label(ctx, "左ほど速く収まる / 上下に離れるほど揺れる", w - 10, h - 20, { align: "right" });
    }
    Z.upd(); W.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ PID：むだ時間のある温度調節と、積分の巻き上がり
  function pidHeater(root) {
    const cv = q(root, "canvas");
    const kp = slider(root, "kp", (v) => v.toFixed(2), draw);
    const ki = slider(root, "ki", (v) => v.toFixed(3), draw);
    const kd = slider(root, "kd", (v) => v.toFixed(1), draw);
    const aw = q(root, '[data-k="aw"]');
    aw.addEventListener("change", draw);
    function draw() {
      // 対象：むだ時間 L = 2 分、時定数 T = 8 分、ゲイン 1（ヒーター出力 0〜100% → 0〜100℃ 上昇）
      const L = 2, T = 8, h = 0.02, N = Math.round(60 / h);
      let y = 20, xi = 0, yf = 20;
      const buf = [];
      const ts = [], ys = [], us = [], rs = [];
      for (let k = 0; k <= N; k++) {
        const t = k * h;
        const r = t < 30 ? 80 : 50;
        const dist = t >= 45 ? -15 : 0; // 窓を開けた
        const e = r - y;
        let u = kp.v * e + ki.v * xi - kd.v * (y - yf) / 0.2;
        const us0 = u;
        u = Math.max(0, Math.min(100, u));
        if (!(aw.checked && u !== us0 && Math.sign(e) === Math.sign(us0 - u))) xi += h * e;
        yf += (h * (y - yf)) / 0.2;
        buf.push(u);
        const ud = buf.length > L / h ? buf.shift() : 0;
        y += (h * (20 + ud + dist - y)) / T;
        if (k % 10 === 0) { ts.push(t); ys.push(y); us.push(u); rs.push(r); }
      }
      const { ctx, w, h: H } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 40, y: 16, w: w - 80, h: H - 40 }, { xmin: 0, xmax: 60, ymin: 10, ymax: 100, xticks: [0, 10, 20, 30, 40, 50, 60], yticks: [20, 40, 60, 80, 100], xfmt: (v) => `${v}分`, title: "温度 [℃]（30 分で目標を下げ、45 分で窓を開ける）" });
      const m2 = { X: m.X, Y: (v) => 16 + (H - 40) * (1 - v / 100) };
      PL.line(ctx, m2, ts, us, { color: C.warn, width: 1.2, alpha: 0.6 });
      PL.line(ctx, m, ts, rs, { color: C.muted, dash: [4, 4], width: 1.2 });
      PL.line(ctx, m, ts, ys, { color: C.link1, width: 2.4 });
      PL.label(ctx, "ヒーター 0〜100%（右）", w - 6, 22, { align: "right", color: C.warn });
    }
    kp.upd(); ki.upd(); kd.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ 揺すって測る：周波数応答
  function shake(root) {
    const [cw, cb] = root.querySelectorAll("canvas");
    const F = slider(root, "f", (v) => `${(10 ** v).toFixed(2)} Hz`, () => {});
    const p = { ...Servo.DEFAULT };
    const P = Servo.plantSS(p);
    // 対象：トルク → モーターの角度（バネの効いた 2 慣性系）に、ゆるい位置のフィードバックを掛けたもの（積分を消して見やすくする）
    const Gj = (w) => {
      const Pj = LTI.freq(P, w, 0, 0);
      const Cj = Cx.add([1.2, 0], Cx.mul([0, w], [0.12, 0]));
      const L = Cx.mul(Cj, Pj);
      return Cx.div(L, Cx.add([1, 0], L));
    };
    const ws = PL.logspace(2 * Math.PI * 0.2, 2 * Math.PI * 60, 400);
    const G = ws.map(Gj);
    const mag = G.map((z) => 20 * Math.log10(Cx.abs(z)));
    const ph = PL.unwrapDeg(G.map((z) => (Cx.arg(z) * 180) / Math.PI));
    let t0 = performance.now();
    function frame(now) {
      const t = (now - t0) / 1000;
      const f = 10 ** F.v, w = 2 * Math.PI * f, g = Gj(w), A = Cx.abs(g), phi = Cx.arg(g);
      // 見やすいように、実時間を周波数に応じて遅くする（いつも 1 秒に約 1 周期）
      const tau = (t * 1) / f;
      let { ctx, w: W, h } = PL.fit(cw);
      const span = 3 / f;
      const m = PL.axes(ctx, { x: 30, y: 14, w: W - 40, h: h - 30 }, { xmin: tau - span, xmax: tau, ymin: -2.2, ymax: 2.2, yticks: [-2, -1, 0, 1, 2], noXLabels: true, title: "入力（灰）と出力（青）" });
      const xs = [], yi = [], yo = [];
      for (let i = 0; i <= 300; i++) { const s = tau - span + (span * i) / 300; xs.push(s); yi.push(Math.sin(w * s)); yo.push(A * Math.sin(w * s + phi)); }
      PL.line(ctx, m, xs, yi, { color: C.muted, width: 1.6 });
      PL.line(ctx, m, xs, yo, { color: C.link2, width: 2.4 });
      PL.label(ctx, `振幅比 ${A.toFixed(2)}（${(20 * Math.log10(A)).toFixed(1)} dB）・位相 ${((phi * 180) / Math.PI).toFixed(0)}°`, W - 10, 22, { align: "right" });
      ({ ctx, w: W, h } = PL.fit(cb));
      const xr = { xmin: ws[0], xmax: ws[ws.length - 1], xlog: true, xticks: [2 * Math.PI, 2 * Math.PI * 10], xfmt: (v) => `${(v / 2 / Math.PI).toFixed(0)} Hz` };
      const gh = (h - 50) / 2;
      const mg = PL.axes(ctx, { x: 40, y: 14, w: W - 50, h: gh }, { ...xr, ymin: -40, ymax: 20, yticks: [-40, -20, 0, 20], noXLabels: true, title: "ゲイン [dB]", zeroY: true });
      PL.line(ctx, mg, ws, mag, { color: C.ink, width: 2 });
      const mp = PL.axes(ctx, { x: 40, y: 30 + gh, w: W - 50, h: gh }, { ...xr, ymin: -360, ymax: 0, yticks: [-360, -270, -180, -90, 0], title: "位相 [°]" });
      PL.line(ctx, mp, ws, ph, { color: C.ink, width: 2 });
      PL.dot(ctx, mg.X(w), mg.Y(20 * Math.log10(A)), 6, C.link2);
      const phd = ph[Math.max(0, Math.min(ws.length - 1, Math.round(((Math.log10(w) - Math.log10(ws[0])) / (Math.log10(ws[ws.length - 1]) - Math.log10(ws[0]))) * (ws.length - 1))))];
      PL.dot(ctx, mp.X(w), mp.Y(phd), 6, C.link2);
      requestAnimationFrame(frame);
    }
    F.upd();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ ナイキスト：ゲインを上げると −1 を回り込む
  function nyquistGain(root) {
    const [cn, cs] = root.querySelectorAll("canvas");
    const K = slider(root, "K", (v) => v.toFixed(2), draw);
    // L(s) = K e^{−0.1 s} / (s (0.5 s + 1))
    const Lj = (w, k) => Cx.mul(Cx.div([k, 0], Cx.mul([0, w], [1, 0.5 * w])), Cx.expj(-0.1 * w));
    function draw() {
      const k = K.v;
      const ws = PL.logspace(0.05, 200, 800);
      const L = ws.map((w) => Lj(w, k));
      let { ctx, w, h } = PL.fit(cn);
      const R = 2.5;
      const m = PL.axes(ctx, { x: 24, y: 12, w: w - 34, h: h - 30 }, { xmin: -R, xmax: R * 0.6, ymin: -R, ymax: R * 0.6, xticks: [-2, -1, 0], yticks: [-2, -1, 0], zeroY: true });
      ctx.strokeStyle = C.muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(m.X(0), m.Y(0), Math.max(0, m.X(1) - m.X(0)), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      const re = L.map((z) => (Cx.abs(z) < 6 ? z[0] : NaN)), im = L.map((z) => (Cx.abs(z) < 6 ? z[1] : NaN));
      PL.line(ctx, m, re, im, { color: C.link2, width: 2.2 });
      PL.cross(ctx, m.X(-1), m.Y(0), 7, C.bad);
      // 位相交差での |L|
      let gm = Infinity;
      for (let i = 1; i < L.length; i++) if (L[i - 1][1] < 0 && L[i][1] >= 0 && L[i][0] < 0) gm = -L[i][0];
      const stable = gm < 1;
      PL.label(ctx, stable ? `安定：−1 の右を通る（ゲイン余裕 ${(-20 * Math.log10(gm)).toFixed(1)} dB）` : "不安定：−1 を囲む", 30, h - 16, { color: stable ? C.ok : C.bad, font: "600 12px system-ui, sans-serif" });
      // 閉ループのステップ応答（むだ時間はバッファ）
      ({ ctx, w, h } = PL.fit(cs));
      const hh = 0.002, N = Math.round(10 / hh), d = Math.round(0.1 / hh);
      let y = 0, v = 0; const buf = new Array(d).fill(0); const ts = [], ys = [];
      for (let i = 0; i <= N; i++) {
        const u = k * (1 - y);
        buf.push(u); const ud = buf.shift();
        const a = (ud - v) / 0.5; v += hh * a; y += hh * v;
        if (i % 10 === 0) { ts.push(i * hh); ys.push(y); }
      }
      const ms = PL.axes(ctx, { x: 30, y: 14, w: w - 40, h: h - 34 }, { xmin: 0, xmax: 10, ymin: -0.5, ymax: 2.5, xticks: [0, 2, 4, 6, 8, 10], yticks: [0, 1, 2], xfmt: (v) => `${v}s`, title: "閉ループのステップ応答" });
      PL.line(ctx, ms, [0, 10], [1, 1], { color: C.muted, dash: [4, 4], width: 1 });
      PL.line(ctx, ms, ts, ys, { color: stable ? C.link2 : C.bad, width: 2.2 });
    }
    K.upd(); PL.onRedraw(draw);
  }

  // ------------------------------------------------------------ ループ整形：遅れとノッチ
  function shaping(root) {
    const cv = q(root, "canvas");
    const out = q(root, ".readout");
    const p = { ...Servo.DEFAULT, Kp: 25, Ki: 50, Kd: 1.5 };
    const Td = slider(root, "td", (v) => `${v.toFixed(1)} ms`, draw);
    const nt = q(root, '[data-k="notch"]');
    nt.addEventListener("change", draw);
    function draw() {
      p.Td = Td.v / 1000; p.notch = nt.checked;
      const a = Servo.analyze(p, 5, 3000, 500);
      const { ctx, w, h } = PL.fit(cv);
      const xr = { xmin: 5, xmax: 3000, xlog: true, xticks: [10, 100, 1000] };
      const gh = (h - 56) / 2;
      const mg = PL.axes(ctx, { x: 44, y: 14, w: w - 54, h: gh }, { ...xr, ymin: -40, ymax: 40, yticks: [-20, 0, 20], noXLabels: true, zeroY: true, title: "|L| [dB]" });
      PL.line(ctx, mg, a.ws, a.mag, { color: C.ink, width: 2 });
      const mp = PL.axes(ctx, { x: 44, y: 34 + gh, w: w - 54, h: gh }, { ...xr, ymin: -540, ymax: 0, yticks: [-540, -360, -180, 0], title: "∠L [°]", xlabel: "ω [rad/s]" });
      ctx.strokeStyle = C.bad; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(44, mp.Y(-180)); ctx.lineTo(w - 10, mp.Y(-180)); ctx.stroke(); ctx.setLineDash([]);
      PL.line(ctx, mp, a.ws, a.ph, { color: C.ink, width: 2 });
      for (const g of a.pc) { ctx.strokeStyle = C.warn; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mg.X(g.w), mg.Y(0)); ctx.lineTo(mg.X(g.w), mg.Y(-g.gm)); ctx.stroke(); }
      out.innerHTML = a.stable.ok
        ? `安定　位相余裕 ${a.pm.toFixed(0)}°　ゲイン余裕 ${a.gm.toFixed(1)} dB`
        : '<span class="badv">不安定</span>';
    }
    Td.upd(); PL.onRedraw(draw);
  }

  const FIGS = { firstOrder, secondOrder, pidHeater, shake, nyquistGain, shaping };
  document.querySelectorAll("[data-fig]").forEach((el) => { const f = FIGS[el.dataset.fig]; if (f) f(el); });
})();
