// ロバスト制御のデモ：ばねでつながった台車。
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const C = PL.C, Cx = PL.Cx;
  const H = 0.005;
  const KS = []; for (let k = 0.2; k <= 3.0001; k += 0.025) KS.push(+k.toFixed(3));
  const IMP_KS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  let lqg = null, hinf = null;
  let sel = "hinf";
  let kTrue = 1.25, noise = false;
  let rangeL = [], rangeH = [], sgL = [], sgH = [], imp = [];
  const WS = PL.logspace(0.05, 20, 300);

  // ------------------------------------------------------------ 設計
  const st = { k0: 1.25, r: 0.1, kmin: 0.5, kmax: 2, auto: true, perf: 1 };
  function syncUI() {
    $("rK0Out").textContent = st.k0.toFixed(2);
    $("rROut").textContent = st.r.toPrecision(2);
    $("rKminOut").textContent = st.kmin.toFixed(2);
    $("rKmaxOut").textContent = st.kmax.toFixed(2);
    $("rPerfOut").textContent = st.auto ? (hinf ? `${hinf.perf.toFixed(2)}（自動）` : "自動") : st.perf.toFixed(2);
    $("rPerf").disabled = st.auto;
    $("rKOut").textContent = kTrue.toFixed(2);
  }
  $("rK0").addEventListener("input", (e) => { st.k0 = Number(e.target.value); redesign("lqg"); });
  $("rR").addEventListener("input", (e) => { st.r = 10 ** Number(e.target.value); redesign("lqg"); });
  $("rKmin").addEventListener("input", (e) => { st.kmin = Number(e.target.value); redesign("hinf"); });
  $("rKmax").addEventListener("input", (e) => { st.kmax = Number(e.target.value); redesign("hinf"); });
  $("rAuto").addEventListener("change", (e) => { st.auto = e.target.checked; redesign("hinf"); });
  $("rPerf").addEventListener("input", (e) => { st.perf = 10 ** Number(e.target.value); redesign("hinf"); });
  $("rK").addEventListener("input", (e) => { kTrue = Number(e.target.value); syncUI(); drawRange(); });
  $("rNoise").addEventListener("change", (e) => (noise = e.target.checked));
  document.querySelectorAll('input[name="rCtrl"]').forEach((r) => r.addEventListener("change", () => { sel = r.value; resetSim(); analyzeImp(); }));

  let pending = new Set(), timer = null;
  function redesign(which) {
    pending.add(which);
    syncUI();
    clearTimeout(timer);
    $("rHStatus").className = "status busy";
    $("rHStatus").textContent = "設計中…";
    timer = setTimeout(() => {
      if (pending.has("lqg")) lqg = RB.designLQG(st.k0, { q: 1, r: st.r, W: 1, V: 1e-4 });
      if (pending.has("hinf")) hinf = RB.designHinfAuto(st.kmin, st.kmax, st.auto ? {} : { perf: st.perf });
      pending.clear();
      analyzeAll();
      resetSim();
    }, 30);
  }

  function rangeOf(ctrl) {
    if (!ctrl) return [];
    return KS.map((k) => ({ k, re: RB.maxRe(ctrl, k) }));
  }
  function stableSpan(r) {
    let lo = null, hi = null;
    for (const p of r) if (p.re < -1e-6) { if (lo === null) lo = p.k; hi = p.k; }
    return lo === null ? null : [lo, hi];
  }
  function analyzeAll() {
    rangeL = rangeOf(lqg); rangeH = rangeOf(hinf);
    const kc = hinf ? hinf.k0 : 1.25;
    sgL = lqg ? WS.map((w) => Cx.abs(RB.uncT(lqg, kc, w))) : [];
    sgH = hinf ? WS.map((w) => Cx.abs(RB.uncT(hinf, kc, w))) : [];
    const sL = stableSpan(rangeL), sH = stableSpan(rangeH);
    const ldk = lqg ? 1 / Math.max(...WS.map((w) => Cx.abs(RB.uncT(lqg, lqg.k0, w)))) : 0;
    $("rLqgInfo").innerHTML = lqg
      ? `<dt>実際に安定な k</dt><dd>${sL ? `${sL[0].toFixed(2)}〜${sL[1].toFixed(2)}` : "なし"}</dd>` +
        `<dt>小ゲインで保証できる k</dt><dd>${(lqg.k0 - ldk).toFixed(2)}〜${(lqg.k0 + ldk).toFixed(2)}</dd>`
      : "<dt>設計できなかった</dt><dd></dd>";
    if (hinf) {
      const ok = hinf.gamma <= 1;
      $("rHStatus").className = "status " + (ok ? "ok" : "warn");
      $("rHStatus").innerHTML = ok
        ? `γ = ${hinf.gamma.toFixed(3)} ≤ 1：k = ${hinf.guaranteed[0].toFixed(2)}〜${hinf.guaranteed[1].toFixed(2)} のどの値でも安定と保証できる。`
        : `γ = ${hinf.gamma.toFixed(3)} &gt; 1：性能の要求が強すぎて、保証できる範囲が ${hinf.guaranteed[0].toFixed(2)}〜${hinf.guaranteed[1].toFixed(2)} に縮んだ。`;
      $("rHInfo").innerHTML = `<dt>実際に安定な k</dt><dd>${sH ? `${sH[0].toFixed(2)}〜${sH[1].toFixed(2)}` : "なし"}</dd>` +
        `<dt>性能の要求（重みの倍率）</dt><dd>${hinf.perf.toFixed(2)}</dd><dt>D スケーリング α</dt><dd>${hinf.opt.alpha}</dd>`;
    } else {
      $("rHStatus").className = "status bad";
      $("rHStatus").textContent = "設計できなかった。";
    }
    syncUI();
    analyzeImp();
    drawRange(); drawSG();
  }

  function analyzeImp() {
    const c = sel === "lqg" ? lqg : hinf;
    imp = c ? IMP_KS.map((k) => ({ k, stable: RB.maxRe(c, k) < -1e-6, r: RB.impulse(c, k, 40, 0.02) })) : [];
    const ts = imp.filter((i) => i.stable).map((i) => RB.settleTime(i.r));
    const bad = imp.filter((i) => !i.stable).map((i) => i.k);
    $("rImpNote").textContent = `${sel === "lqg" ? "LQG" : "H∞"}：` +
      (bad.length ? `k = ${bad.join(", ")} では不安定（発散）。` : "どの k でも収まる。") +
      (ts.length ? ` 安定なものの整定時間（|x₂| < 0.1）は ${Math.min(...ts).toFixed(1)}〜${Math.max(...ts).toFixed(1)} 秒。` : "");
    drawImp();
  }

  // ------------------------------------------------------------ 実時間のシミュレーション
  let xp = [0, 0, 0, 0], xc = [], t = 0, hist = [], kickT = -1, u = 0;
  function resetSim() { const c = sel === "lqg" ? lqg : hinf; xp = [0, 0, 0, 0]; xc = c ? new Array(c.Ak.length).fill(0) : []; t = 0; hist = []; }
  $("rReset").addEventListener("click", resetSim);
  $("rKick").addEventListener("click", () => { xp[3] += 1; kickT = t; });
  function gauss() { let a = 0, b = 0; while (a === 0) a = Math.random(); b = Math.random(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
  function stepSim() {
    const c = sel === "lqg" ? lqg : hinf;
    if (!c) return;
    const P = RB.plant(kTrue);
    const y = xp[1] + (noise ? 0.01 * gauss() : 0);
    const f = (xp_, xc_) => {
      const uu = c.Ck[0].reduce((a, v, j) => a + v * xc_[j], 0);
      const dp = P.A.map((row, i) => row.reduce((a, v, j) => a + v * xp_[j], 0) + P.Bu[i][0] * uu);
      const dc = c.Ak.map((row, i) => row.reduce((a, v, j) => a + v * xc_[j], 0) + c.Bk[i][0] * y);
      return [dp, dc];
    };
    const add = (a, d, s) => a.map((v, i) => v + s * d[i]);
    const [p1, c1] = f(xp, xc);
    const [p2, c2] = f(add(xp, p1, H / 2), add(xc, c1, H / 2));
    const [p3, c3] = f(add(xp, p2, H / 2), add(xc, c2, H / 2));
    const [p4, c4] = f(add(xp, p3, H), add(xc, c3, H));
    xp = xp.map((v, i) => v + (H / 6) * (p1[i] + 2 * p2[i] + 2 * p3[i] + p4[i]));
    xc = xc.map((v, i) => v + (H / 6) * (c1[i] + 2 * c2[i] + 2 * c3[i] + c4[i]));
    u = c.Ck[0].reduce((a, v, j) => a + v * xc[j], 0);
    t += H;
    if (!xp.every((v) => Number.isFinite(v) && Math.abs(v) < 50)) resetSim();
  }

  const scene = $("rScene");
  function drawScene() {
    const { ctx, w, h } = PL.fit(scene);
    const k = Math.min(w / 8, h / 2.2);
    const base = w / 2, y0 = h * 0.62;
    const X1 = base - 1.6 * k + xp[0] * k, X2 = base + 1.6 * k + xp[1] * k;
    ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, y0 + 0.35 * k); ctx.lineTo(w - 10, y0 + 0.35 * k); ctx.stroke();
    // ばね（強さで太さを変える）
    const n = 12, sx = X1 + 0.35 * k, ex = X2 - 0.35 * k;
    ctx.strokeStyle = C.warn; ctx.lineWidth = 1 + kTrue * 1.2;
    ctx.beginPath(); ctx.moveTo(sx, y0);
    for (let i = 1; i < n; i++) ctx.lineTo(sx + ((ex - sx) * i) / n, y0 + (i % 2 ? -1 : 1) * 0.15 * k);
    ctx.lineTo(ex, y0); ctx.stroke();
    // 台車
    for (const [X, col, lab] of [[X1, C.cart, "押す"], [X2, C.link2, "測る"]]) {
      ctx.fillStyle = col;
      ctx.fillRect(X - 0.35 * k, y0 - 0.3 * k, 0.7 * k, 0.6 * k);
      PL.label(ctx, lab, X, y0 - 0.45 * k, { align: "center", color: C.muted });
    }
    // 力の矢印
    const L = Math.max(-1, Math.min(1, u / 3)) * 1.2 * k;
    if (Math.abs(L) > 2) {
      ctx.strokeStyle = C.warn; ctx.fillStyle = C.warn; ctx.lineWidth = 3;
      const yA = y0;
      const x0 = L > 0 ? X1 - 0.35 * k - Math.abs(L) : X1 + 0.35 * k + Math.abs(L);
      const x1 = L > 0 ? X1 - 0.35 * k : X1 + 0.35 * k;
      ctx.beginPath(); ctx.moveTo(x0, yA); ctx.lineTo(x1, yA); ctx.stroke();
      const s = Math.sign(x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, yA); ctx.lineTo(x1 - s * 8, yA - 6); ctx.lineTo(x1 - s * 8, yA + 6); ctx.fill();
    }
    ctx.strokeStyle = C.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(base + 1.6 * k, y0 - 0.7 * k); ctx.lineTo(base + 1.6 * k, y0 + 0.5 * k); ctx.stroke(); ctx.setLineDash([]);
    PL.label(ctx, "目標 x₂ = 0", base + 1.6 * k, y0 - 0.8 * k, { align: "center" });
  }

  function drawLive() {
    const cv = $("rLive");
    const { ctx, w, h } = PL.fit(cv);
    const span = 20, t1 = Math.max(t, span), t0 = t1 - span;
    const xt = []; for (let s = Math.ceil(t0 / 5) * 5; s <= t1; s += 5) xt.push(s);
    const m = PL.axes(ctx, { x: 36, y: 12, w: w - 46, h: h - 30 }, { xmin: t0, xmax: t1, ymin: -2.5, ymax: 2.5, yticks: [-2, -1, 0, 1, 2], xticks: xt, xfmt: (v) => `${v}s`, zeroY: true });
    const ts = hist.map((e) => e.t);
    PL.line(ctx, m, ts, hist.map((e) => Math.max(-3, Math.min(3, e.u / 3))), { color: C.warn, width: 1.2, alpha: 0.8 });
    PL.line(ctx, m, ts, hist.map((e) => e.x2), { color: C.link2, width: 2 });
  }

  // ------------------------------------------------------------ 図
  function drawRange() {
    const cv = $("rRange");
    const { ctx, w, h } = PL.fit(cv);
    const m = PL.axes(ctx, { x: 44, y: 14, w: w - 54, h: h - 36 }, { xmin: 0.2, xmax: 3, ymin: -0.6, ymax: 0.3, xticks: [0.5, 1, 1.5, 2, 2.5, 3], yticks: [-0.6, -0.4, -0.2, 0, 0.2], xlabel: "ばねの強さ k", zeroY: true });
    ctx.fillStyle = C.bad; ctx.globalAlpha = 0.07; ctx.fillRect(44, 14, w - 54, m.Y(0) - 14); ctx.globalAlpha = 1;
    if (hinf) {
      const [a, b] = hinf.guaranteed;
      ctx.fillStyle = C.ok; ctx.globalAlpha = 0.12;
      ctx.fillRect(m.X(Math.max(0.2, a)), 14, m.X(Math.min(3, b)) - m.X(Math.max(0.2, a)), h - 36); ctx.globalAlpha = 1;
    }
    const clip = (v) => Math.max(-0.6, Math.min(0.3, v));
    PL.line(ctx, m, rangeL.map((p) => p.k), rangeL.map((p) => clip(p.re)), { color: C.bad, width: 2 });
    PL.line(ctx, m, rangeH.map((p) => p.k), rangeH.map((p) => clip(p.re)), { color: C.ok, width: 2 });
    ctx.strokeStyle = C.link2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(m.X(kTrue), 14); ctx.lineTo(m.X(kTrue), h - 22); ctx.stroke(); ctx.setLineDash([]);
    if (lqg) PL.label(ctx, "LQG の設計点", m.X(lqg.k0), m.Y(0.25), { align: "center", color: C.bad });
    PL.label(ctx, "不安定", w - 14, 22, { align: "right", color: C.bad });
  }

  function drawSG() {
    const cv = $("rSG");
    const { ctx, w, h } = PL.fit(cv);
    const dk = hinf ? hinf.dk : 0.75;
    const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 36 }, { xmin: WS[0], xmax: WS[WS.length - 1], xlog: true, ymin: 0.01, ymax: 100, ylog: true, xticks: [0.1, 1, 10], yticks: [0.01, 0.1, 1, 10, 100], xlabel: "ω [rad/s]" });
    ctx.strokeStyle = C.ink; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(40, m.Y(1)); ctx.lineTo(w - 10, m.Y(1)); ctx.stroke(); ctx.setLineDash([]);
    PL.line(ctx, m, WS, sgL.map((v) => v * dk), { color: C.bad, width: 2 });
    PL.line(ctx, m, WS, sgH.map((v) => v * dk), { color: C.ok, width: 2 });
    PL.label(ctx, `δ = ${dk.toFixed(2)}（k = ${(hinf ? hinf.k0 : 1.25).toFixed(2)} ± ${dk.toFixed(2)}）`, w - 12, 22, { align: "right" });
  }

  function drawImp() {
    const cv = $("rImp");
    const { ctx, w, h } = PL.fit(cv);
    const m = PL.axes(ctx, { x: 40, y: 14, w: w - 50, h: h - 34 }, { xmin: 0, xmax: 40, ymin: -2, ymax: 2.5, xticks: [0, 10, 20, 30, 40], yticks: [-2, -1, 0, 1, 2], xfmt: (v) => `${v}s`, zeroY: true, title: "右の台車の位置 x₂" });
    const cols = [C.link1, C.warn, C.link3, C.link2, C.ok, C.ink];
    imp.forEach((it, i) => {
      PL.line(ctx, m, it.r.t, it.r.x2.map((v) => (Math.abs(v) < 5 ? v : NaN)), { color: it.stable ? cols[i] : C.bad, width: it.stable ? 1.8 : 1.2, dash: it.stable ? [] : [3, 3] });
    });
    let lx = 48;
    imp.forEach((it, i) => { PL.label(ctx, `k=${it.k}${it.stable ? "" : "（不安定）"}`, lx, h - 46, { color: it.stable ? cols[i] : C.bad }); lx += it.stable ? 54 : 100; });
  }

  // ------------------------------------------------------------ ループ
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    acc += dt;
    while (acc >= H) { stepSim(); acc -= H; if (Math.round(t / H) % 4 === 0) hist.push({ t, x2: xp[1], u }); }
    while (hist.length && hist[0].t < t - 21) hist.shift();
    const c = sel === "lqg" ? lqg : hinf;
    const stable = c && RB.maxRe(c, kTrue) < -1e-6;
    const b = $("rBadge");
    b.className = "badge " + (stable ? "ok" : "bad");
    b.textContent = `${sel === "lqg" ? "LQG" : "H∞"}：この k では${stable ? "安定" : "不安定"}`;
    $("rKnow").textContent = kTrue.toFixed(2);
    $("rU").textContent = u.toFixed(2);
    $("rX2").textContent = xp[1].toFixed(2);
    drawScene(); drawLive();
    requestAnimationFrame(frame);
  }
  PL.onRedraw(() => { drawRange(); drawSG(); drawImp(); });
  syncUI();
  redesign("lqg"); redesign("hinf");
  requestAnimationFrame(frame);
})();
