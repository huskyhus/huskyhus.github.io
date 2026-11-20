// 強化学習のデモ：谷の台車。
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const C = PL.C;
  const st = { alpha: 0.5, lambda: 0.9, eps: 0, init: 0, tilings: 8, power: 1, gravity: 1 };
  let agent, env, ruleAvg = null;
  let anim = null;   // { kind, traj, i, steps }
  let lastTraj = null, busy = false;

  function newAgent() {
    agent = RL.makeAgent({ alpha: st.alpha, lambda: st.lambda, eps: st.eps, init: st.init, tilings: st.tilings });
    env = RL.makeEnv({ power: st.power, gravity: st.gravity });
    lastTraj = null; anim = null;
    computeRule();
    drawAll();
  }
  function computeRule() {
    const e = RL.makeEnv({ power: st.power, gravity: st.gravity }), rnd = RL.rng(5);
    let s = 0; for (let i = 0; i < 30; i++) s += RL.ruleEpisode(e, rnd).steps;
    ruleAvg = s / 30;
  }
  function syncUI() {
    $("qAlphaOut").textContent = st.alpha.toFixed(2);
    $("qLambdaOut").textContent = st.lambda.toFixed(2);
    $("qEpsOut").textContent = st.eps.toFixed(2);
    $("qTilOut").textContent = `${st.tilings} 枚 × 8×8`;
    $("qPowOut").textContent = `×${st.power.toFixed(2)}`;
    $("qGravOut").textContent = `×${st.gravity.toFixed(2)}`;
  }
  const bind = (id, key, live) => $(id).addEventListener("input", (e) => { st[key] = Number(e.target.value); syncUI(); live && live(); });
  bind("qAlpha", "alpha", () => (agent.alpha = st.alpha / agent.tiles.n));
  bind("qLambda", "lambda", () => (agent.lambda = st.lambda));
  bind("qEps", "eps", () => (agent.eps = st.eps));
  bind("qTil", "tilings");
  bind("qPow", "power", () => { env.power = st.power; computeRule(); drawCurve(); });
  bind("qGrav", "gravity", () => { env.gravity = st.gravity; computeRule(); drawCurve(); });
  document.querySelectorAll('input[name="qInit"]').forEach((r) => r.addEventListener("change", () => (st.init = Number(r.value))));
  $("qReset").addEventListener("click", newAgent);

  // 速く学習（UI を止めないよう小分けに）
  function trainMany(n) {
    if (busy) return;
    busy = true; anim = null;
    let left = n;
    const chunk = () => {
      const t0 = performance.now();
      while (left > 0 && performance.now() - t0 < 30) { lastTraj = RL.runEpisode(agent, env).traj; left--; }
      drawAll();
      if (left > 0) setTimeout(chunk, 0); else busy = false;
    };
    chunk();
  }
  $("q10").addEventListener("click", () => trainMany(10));
  $("q100").addEventListener("click", () => trainMany(100));
  // 1 回を目で見る：学習しながら（記録してから再生）
  $("qWatch").addEventListener("click", () => {
    if (busy) return;
    const r = RL.runEpisode(agent, env, { maxSteps: 5000 });
    lastTraj = r.traj; anim = { kind: "学習中", traj: r.traj, i: 0 };
    drawAll();
  });
  $("qGreedy").addEventListener("click", () => {
    const e = RL.makeEnv({ power: st.power, gravity: st.gravity });
    const r = RL.runEpisode(agent, e, { learn: false, maxSteps: 3000 });
    anim = { kind: r.reached ? "今の実力" : "今の実力（3000 歩で打ち切り）", traj: r.traj, i: 0 };
  });
  $("qRule").addEventListener("click", () => {
    const e = RL.makeEnv({ power: st.power, gravity: st.gravity });
    anim = { kind: "人の規則", traj: RL.ruleEpisode(e).traj, i: 0 };
  });

  // ------------------------------------------------------------ 描画
  function drawScene() {
    const cv = $("qScene");
    const { ctx, w, h } = PL.fit(cv);
    const X = (x) => 20 + ((x - RL.X_MIN) / (RL.X_MAX - RL.X_MIN)) * (w - 40);
    const Y = (y) => h * 0.55 - y * h * 0.35;
    ctx.fillStyle = C.grid; ctx.beginPath(); ctx.moveTo(X(RL.X_MIN), h);
    for (let i = 0; i <= 200; i++) { const x = RL.X_MIN + ((RL.X_MAX - RL.X_MIN) * i) / 200; ctx.lineTo(X(x), Y(RL.height(x))); }
    ctx.lineTo(X(RL.X_MAX), h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = RL.X_MIN + ((RL.X_MAX - RL.X_MIN) * i) / 200; if (i) ctx.lineTo(X(x), Y(RL.height(x))); else ctx.moveTo(X(x), Y(RL.height(x))); }
    ctx.stroke();
    // 旗
    const gx = X(RL.GOAL), gy = Y(RL.height(RL.GOAL));
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 40); ctx.stroke();
    ctx.fillStyle = C.ok; ctx.beginPath(); ctx.moveTo(gx, gy - 40); ctx.lineTo(gx + 24, gy - 32); ctx.lineTo(gx, gy - 24); ctx.fill();
    // 台車
    let x = -0.5, v = 0, a = 1, label = "";
    if (anim) {
      const p = anim.traj[Math.min(anim.i, anim.traj.length - 1)];
      x = p[0]; v = p[1];
      const q = anim.traj[Math.min(anim.i + 1, anim.traj.length - 1)];
      a = Math.round((q[1] - v + 0.0025 * st.gravity * Math.cos(3 * x)) / (0.001 * st.power)) + 1;
      label = `${anim.kind}：${anim.i} 歩目`;
    }
    const slope = Math.atan(3 * Math.cos(3 * x) * (h * 0.35) / ((w - 40) / (RL.X_MAX - RL.X_MIN)));
    ctx.save(); ctx.translate(X(x), Y(RL.height(x))); ctx.rotate(-slope);
    ctx.fillStyle = C.link1; ctx.fillRect(-16, -18, 32, 14);
    ctx.fillStyle = C.ink; for (const s of [-9, 9]) { ctx.beginPath(); ctx.arc(s, -3, 4, 0, 2 * Math.PI); ctx.fill(); }
    if (a !== 1 && anim) { ctx.fillStyle = C.warn; const d = a === 2 ? 1 : -1; ctx.beginPath(); ctx.moveTo(d * 30, -11); ctx.lineTo(d * 20, -17); ctx.lineTo(d * 20, -5); ctx.fill(); }
    ctx.restore();
    PL.label(ctx, label, 12, 16, { color: C.muted });
    $("qNow").textContent = anim ? anim.i : 0;
  }

  function drawCurve() {
    const cv = $("qCurve");
    const { ctx, w, h } = PL.fit(cv);
    const H = agent.history, n = Math.max(20, H.length);
    const m = PL.axes(ctx, { x: 44, y: 12, w: w - 54, h: h - 32 }, { xmin: 1, xmax: n, ymin: 80, ymax: 5000, ylog: true, yticks: [100, 300, 1000, 3000], xticks: [1, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n], xlabel: "挑戦の回数" });
    const xs = H.map((_, i) => i + 1);
    PL.line(ctx, m, xs, H, { color: C.link3, width: 1, alpha: 0.6 });
    const avg = H.map((_, i) => { const a = Math.max(0, i - 9); const s = H.slice(a, i + 1); return s.reduce((p, q) => p + q, 0) / s.length; });
    PL.line(ctx, m, xs, avg, { color: C.ink, width: 2 });
    if (ruleAvg) PL.line(ctx, m, [1, n], [ruleAvg, ruleAvg], { color: C.warn, dash: [5, 4], width: 1.5 });
  }

  const GRID = 48;
  function drawMaps() {
    for (const [id, kind] of [["qValue", "v"], ["qPolicy", "p"]]) {
      const cv = $(id);
      const { ctx, w, h } = PL.fit(cv);
      const m = PL.axes(ctx, { x: 36, y: 10, w: w - 46, h: h - 34 }, { xmin: RL.X_MIN, xmax: RL.X_MAX, ymin: -RL.V_MAX, ymax: RL.V_MAX, xticks: [-1.2, -0.6, 0, 0.5], yticks: [-0.07, 0, 0.07], xlabel: "位置", yfmt: (v) => v.toFixed(2) });
      const cw = (w - 46) / GRID, ch = (h - 34) / GRID;
      let vmin = 0;
      if (kind === "v") for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) vmin = Math.min(vmin, RL.valueAt(agent, RL.X_MIN + ((i + 0.5) / GRID) * (RL.X_MAX - RL.X_MIN), -RL.V_MAX + ((j + 0.5) / GRID) * 2 * RL.V_MAX));
      for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
        const x = RL.X_MIN + ((i + 0.5) / GRID) * (RL.X_MAX - RL.X_MIN), v = -RL.V_MAX + ((j + 0.5) / GRID) * 2 * RL.V_MAX;
        if (kind === "v") {
          const val = RL.valueAt(agent, x, v);
          ctx.fillStyle = C.link3; ctx.globalAlpha = vmin < 0 ? Math.max(0.03, 1 - val / vmin) : 0.05;
        } else {
          const a = RL.policyAt(agent, x, v);
          ctx.fillStyle = a === 0 ? C.link1 : a === 2 ? C.link3 : C.muted; ctx.globalAlpha = 0.55;
        }
        ctx.fillRect(36 + i * cw, 10 + (GRID - 1 - j) * ch, cw + 0.5, ch + 0.5);
      }
      ctx.globalAlpha = 1;
      if (lastTraj) PL.line(ctx, m, lastTraj.map((p) => p[0]), lastTraj.map((p) => p[1]), { color: C.ink, width: 1.4 });
      ctx.strokeStyle = C.ok; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(m.X(RL.GOAL), 10); ctx.lineTo(m.X(RL.GOAL), h - 24); ctx.stroke(); ctx.setLineDash([]);
      if (kind === "v" && vmin < 0) PL.label(ctx, `最も遠い：あと ${(-vmin).toFixed(0)} 歩`, w - 12, 20, { align: "right" });
    }
  }

  function drawAll() {
    drawCurve(); drawMaps();
    const H = agent.history;
    $("qEp").textContent = agent.episodes;
    $("qLast").textContent = H.length ? H[H.length - 1] : "—";
    const b = $("qBadge");
    const recent = H.slice(-10);
    const avg = recent.length ? recent.reduce((p, q) => p + q, 0) / recent.length : Infinity;
    if (!H.length) { b.className = "badge info"; b.textContent = "学習前"; }
    else if (avg < (ruleAvg || 120) * 1.05) { b.className = "badge ok"; b.textContent = "人の規則に並んだ"; }
    else { b.className = "badge warn"; b.textContent = "学習中"; }
    $("qInfo").innerHTML = `<dt>人の規則（平均）</dt><dd>${ruleAvg ? ruleAvg.toFixed(0) : "—"} 歩</dd><dt>直近 10 回の平均</dt><dd>${recent.length ? avg.toFixed(0) : "—"} 歩</dd><dt>覚えている数（重み）</dt><dd>${agent.tiles.size * 3}</dd>`;
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (anim) {
      acc += dt;
      const per = 1 / 120; // 1 秒に 120 歩
      while (acc >= per) { acc -= per; if (anim.i < anim.traj.length - 1) anim.i++; }
    }
    drawScene();
    requestAnimationFrame(frame);
  }
  PL.onRedraw(drawAll);
  syncUI();
  newAgent();
  requestAnimationFrame(frame);
})();
