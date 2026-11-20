// モデル予測制御のデモ：車線変更と障害物回避。
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const C = PL.C;
  const DEG = 180 / Math.PI;
  const H = 0.01;
  const { CAR, ROAD } = MPC;

  const st = { N: 30, rr: 100, amax: 5, rmax: 0.05, v: 20, model: "kinematic", plant: "kinematic", ghost: true, look: 2, auto: true, base: 0 };
  const cfgOf = () => ({ v: st.v, dt: 0.1, N: st.N, qy: 1, qpsi: 10, qdelta: 10, rr: st.rr, rhoSlack: 1000, dmax: (st.amax * CAR.L) / (st.v * st.v), rmax: st.rmax, model: st.model });
  let cfg = cfgOf(), mpc = MPC.buildMPC(cfg);
  let car, ghost, obstacles, rM = 0, rL = 0, sol = null, hist = [], wind = 0, windUntil = -1, t = 0;
  let hitsM = 0, hitsL = 0, hitM = false, hitL = false, stats = { it: 0, ms: 0, maxMs: 0 };

  function reset() {
    car = MPC.makeCar(st.plant); ghost = MPC.makeCar(st.plant);
    obstacles = [{ X: 70, lane: 0, len: CAR.length }];
    rM = rL = 0; sol = null; hist = []; t = 0; st.base = 0;
    hitsM = hitsL = 0; hitM = hitL = false; mpc.ws = null; stats.maxMs = 0;
    $("mLane").textContent = "追い越し車線へ";
  }
  function rebuild() { cfg = cfgOf(); mpc = MPC.buildMPC(cfg); syncUI(); }

  function syncUI() {
    $("mNOut").textContent = `${st.N} 歩 = ${(st.N * 0.1).toFixed(1)} 秒（${(st.N * 0.1 * st.v).toFixed(0)} m）`;
    $("mRrOut").textContent = st.rr.toPrecision(2);
    $("mAmaxOut").textContent = `${st.amax.toFixed(1)} m/s²（切れ角 ${(cfg.dmax * DEG).toFixed(2)}°）`;
    $("mRmaxOut").textContent = `${(st.rmax * DEG).toFixed(1)} °/s`;
    $("mVOut").textContent = `${st.v} m/s（${(st.v * 3.6).toFixed(0)} km/h）`;
    $("mLookOut").textContent = `${st.look.toFixed(1)} 秒`;
  }
  const bind = (id, key, map, after) => $(id).addEventListener("input", (e) => { st[key] = map(Number(e.target.value)); after(); });
  bind("mN", "N", (v) => v, rebuild);
  bind("mRr", "rr", (v) => 10 ** v, rebuild);
  bind("mAmax", "amax", (v) => v, rebuild);
  bind("mRmax", "rmax", (v) => v, rebuild);
  bind("mV", "v", (v) => v, rebuild);
  bind("mLook", "look", (v) => v, syncUI);
  document.querySelectorAll('input[name="mModel"]').forEach((r) => r.addEventListener("change", () => { st.model = r.value; rebuild(); }));
  document.querySelectorAll('input[name="mPlant"]').forEach((r) => r.addEventListener("change", () => { st.plant = r.value; reset(); }));
  $("mGhost").addEventListener("change", (e) => (st.ghost = e.target.checked));
  $("mAuto").addEventListener("change", (e) => (st.auto = e.target.checked));
  $("mReset").addEventListener("click", reset);
  $("mObs").addEventListener("click", () => obstacles.push({ X: car.X + 60, lane: car.y > ROAD.lane / 2 ? 1 : 0, len: CAR.length }));
  $("mLane").addEventListener("click", () => { st.base = 1 - st.base; $("mLane").textContent = st.base ? "走行車線へ戻る" : "追い越し車線へ"; });
  $("mWind").addEventListener("click", () => { wind = 3500 * (Math.random() < 0.5 ? 1 : -1); windUntil = t + 3; });

  // 画面の座標
  let view = null;
  function makeView(w, h) {
    const X0 = car.X - 20, span = 110;
    const kx = w / span, ky = (h - 20) / (ROAD.right - ROAD.left + 1);
    return { X0, kx, ky, sx: (X) => (X - X0) * kx, sy: (y) => h - 10 - (y - ROAD.left + 0.5) * ky };
  }
  $("mScene").addEventListener("pointerdown", (ev) => {
    if (!view) return;
    const r = $("mScene").getBoundingClientRect();
    const X = view.X0 + (ev.clientX - r.left) / view.kx;
    const y = ROAD.left - 0.5 + (r.height - 10 - (ev.clientY - r.top)) / view.ky;
    if (X > car.X + 10) obstacles.push({ X, lane: y > ROAD.lane / 2 ? 1 : 0, len: CAR.length });
  });

  function spawn() {
    obstacles = obstacles.filter((o) => o.X > car.X - 40);
    if (!st.auto) return;
    const far = Math.max(car.X + 40, ...obstacles.map((o) => o.X));
    if (far < car.X + 160) obstacles.push({ X: far + 70 + Math.random() * 80, lane: Math.random() < 0.6 ? 0 : 1, len: CAR.length });
  }

  function control() {
    const x0 = MPC.stateOf(car, st.model);
    const { lo, hi } = MPC.corridor(obstacles, car.X, st.v, cfg.dt, cfg.N);
    sol = MPC.solveMPC(mpc, x0, MPC.refFromCorridor(lo, hi, st.base), lo, hi);
    sol.lo = lo; sol.hi = hi; sol.X = car.X;
    rM = sol.r;
    stats.it = sol.it; stats.ms = sol.ms; stats.maxMs = Math.max(stats.maxMs, sol.ms);
    // 比べる相手：同じ重みの LQR に、車線の目標を前もって切り替える簡単なルールと、入力の上限を後からかける
    const xg = MPC.stateOf(ghost, st.model);
    const yref = MPC.laneRef(obstacles, ghost.X, st.v, st.look, st.base);
    rL = -mpc.Klqr.reduce((a, k, i) => a + k * (xg[i] - (i === mpc.md.iy ? yref : 0)), 0);
  }

  function step() {
    if (Math.round(t / H) % Math.round(cfg.dt / H) === 0) { spawn(); control(); }
    const w = t < windUntil ? wind : 0;
    MPC.stepCar(car, st.v, rM, H, cfg, w);
    MPC.stepCar(ghost, st.v, rL, H, cfg, w);
    const cm = MPC.collides(car, obstacles), cl = MPC.collides(ghost, obstacles);
    if (cm && !hitM) hitsM++; hitM = !!cm;
    if (cl && !hitL) hitsL++; hitL = !!cl;
    // 道から大きく外れた車は、車線に戻して続ける
    for (const c of [car, ghost]) if (c.y < ROAD.left - 3 || c.y > ROAD.right + 3 || !Number.isFinite(c.y)) { c.y = 0; c.psi = 0; c.delta = 0; c.vy = 0; c.yaw = 0; }
    t += H;
    if (Math.round(t / H) % 5 === 0) hist.push({ t, dM: car.delta, dL: ghost.delta, rM, rL: Math.max(-cfg.rmax, Math.min(cfg.rmax, rL)), aM: MPC.latAcc(car, st.v), aL: MPC.latAcc(ghost, st.v) });
    while (hist.length && hist[0].t < t - 10) hist.shift();
  }

  function drawCar(ctx, c, color, alpha) {
    const x = view.sx(c.X), y = view.sy(c.y);
    const L = CAR.length * view.kx, W = CAR.width * view.ky;
    const ang = -Math.atan((view.ky / view.kx) * Math.tan(c.psi));
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
    ctx.fillStyle = color; ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = C.card; ctx.fillRect(L / 2 - L * 0.28, -W / 2 + 2, L * 0.16, W - 4);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawScene() {
    const cv = $("mScene");
    const { ctx, w, h } = PL.fit(cv);
    view = makeView(w, h);
    const { sx, sy } = view;
    ctx.fillStyle = C.grid; ctx.fillRect(0, sy(ROAD.right), w, sy(ROAD.left) - sy(ROAD.right));
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    for (const y of [ROAD.left, ROAD.right]) { ctx.beginPath(); ctx.moveTo(0, sy(y)); ctx.lineTo(w, sy(y)); ctx.stroke(); }
    ctx.strokeStyle = C.muted; ctx.setLineDash([14, 14]); ctx.lineDashOffset = (view.X0 * view.kx) % 28;
    ctx.beginPath(); ctx.moveTo(0, sy(ROAD.lane / 2)); ctx.lineTo(w, sy(ROAD.lane / 2)); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // 制約の帯と予測
    if (sol) {
      const dx = st.v * cfg.dt;
      ctx.fillStyle = C.link1; ctx.globalAlpha = 0.09;
      for (let k = 0; k < sol.lo.length; k++) {
        const X = sol.X + dx * (k + 1);
        ctx.fillRect(sx(X - dx / 2), sy(sol.hi[k]), dx * view.kx, sy(sol.lo[k]) - sy(sol.hi[k]));
      }
      ctx.globalAlpha = 1;
      for (let k = 0; k < sol.pred.length; k++) PL.dot(ctx, sx(sol.X + dx * (k + 1)), sy(sol.pred[k][sol.iy]), 2.5, C.link1);
    }
    for (const o of obstacles) {
      const y = ROAD.lanes[o.lane];
      ctx.fillStyle = C.warn;
      ctx.fillRect(sx(o.X - o.len / 2), sy(y + 0.8), o.len * view.kx, 1.6 * view.ky);
      ctx.strokeStyle = C.bad; ctx.lineWidth = 2; ctx.strokeRect(sx(o.X - o.len / 2), sy(y + 0.8), o.len * view.kx, 1.6 * view.ky);
    }
    if (st.ghost) drawCar(ctx, ghost, hitL ? C.bad : C.muted, 0.45);
    drawCar(ctx, car, hitM ? C.bad : C.link1, 1);
    if (t < windUntil) PL.label(ctx, `横風 ${wind > 0 ? "↑" : "↓"}`, 12, 16, { color: C.warn, font: "600 13px system-ui, sans-serif" });
  }

  function drawPlot() {
    const cv = $("mPlot");
    const { ctx, w, h } = PL.fit(cv);
    const t1 = Math.max(t, 10), t0 = t1 - 10;
    const xt = []; for (let s = Math.ceil(t0 / 2) * 2; s <= t1; s += 2) xt.push(s);
    const ph = (h - 70) / 3;
    const panels = [
      { title: "切れ角 δ [°]", key: "d", lim: cfg.dmax * DEG, f: DEG },
      { title: "ハンドルを切る速さ [°/s]", key: "r", lim: cfg.rmax * DEG, f: DEG },
      { title: "横加速度 [m/s²]", key: "a", lim: st.amax, f: 1 },
    ];
    panels.forEach((p, i) => {
      const y = 14 + i * (ph + 24), lim = p.lim * 1.4;
      const m = PL.axes(ctx, { x: 44, y, w: w - 54, h: ph }, { xmin: t0, xmax: t1, ymin: -lim, ymax: lim, yticks: [-+p.lim.toFixed(1), 0, +p.lim.toFixed(1)], xticks: i === 2 ? xt : [], xfmt: (v) => `${v}s`, title: p.title, zeroY: true });
      PL.line(ctx, m, [t0, t1], [p.lim, p.lim], { color: C.bad, dash: [4, 4], width: 1 });
      PL.line(ctx, m, [t0, t1], [-p.lim, -p.lim], { color: C.bad, dash: [4, 4], width: 1 });
      const ts = hist.map((e) => e.t);
      if (st.ghost) PL.line(ctx, m, ts, hist.map((e) => e[p.key + "L"] * p.f), { color: C.muted, dash: [4, 3], width: 1.4 });
      PL.line(ctx, m, ts, hist.map((e) => e[p.key + "M"] * p.f), { color: C.link1, width: 2 });
    });
  }

  let last = performance.now(), acc = 0, frameN = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= H && n < 10) { step(); acc -= H; n++; }
    if (n >= 10) acc = 0;
    drawScene(); drawPlot();
    const b = $("mBadge");
    b.className = "badge " + (hitM ? "bad" : sol && sol.slack > 0.05 ? "warn" : "ok");
    b.textContent = hitM ? "接触！" : sol && sol.slack > 0.05 ? "制約を守りきれない（余裕変数を使用）" : "走行中";
    if (++frameN % 6 === 0) {
      $("mDelta").textContent = (car.delta * DEG).toFixed(2);
      $("mAcc").textContent = MPC.latAcc(car, st.v).toFixed(2);
      $("mIt").textContent = stats.it;
      $("mMs").textContent = stats.ms.toFixed(1);
      $("mHitM").textContent = hitsM; $("mHitL").textContent = hitsL;
      $("mInfo").innerHTML = `<dt>QP の大きさ</dt><dd>変数 ${mpc.nz}・不等式 ${mpc.N * 7}</dd><dt>1 回の計算（最大）</dt><dd>${stats.maxMs.toFixed(1)} ms / 制御周期 100 ms</dd>`;
    }
    requestAnimationFrame(frame);
  }
  syncUI();
  reset();
  requestAnimationFrame(frame);
})();
