// 古典制御のデモ：サーボの調整画面。
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const C = PL.C;
  const DEG = 180 / Math.PI;
  const H = 0.0002; // シミュレーションの刻み [s]

  // ------------------------------------------------------------ パラメータと UI
  const p = { ...Servo.DEFAULT, Jl: 0.012 };
  const st = { ratio: p.Jl / p.Jm, fr: Servo.resonanceHz(p) };
  const logMap = (lo, hi, zero) => ({
    toVal: (pos) => (zero && pos <= 0 ? 0 : 10 ** (Math.log10(lo) + ((zero ? pos - 1 : pos) / (zero ? 99 : 100)) * Math.log10(hi / lo))),
    toPos: (v) => (zero && v <= 0 ? 0 : Math.round((zero ? 1 : 0) + ((Math.log10(v / lo)) / Math.log10(hi / lo)) * (zero ? 99 : 100))),
  });
  const G = { Kp: logMap(0.3, 100, false), Ki: logMap(0.1, 300, true), Kd: logMap(0.01, 5, true) };
  const fmtG = (v) => (v === 0 ? "0（なし）" : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3));

  function applyPlant() {
    p.Jl = st.ratio * p.Jm;
    const w = 2 * Math.PI * st.fr;
    p.k = (w * w) / (1 / p.Jm + 1 / p.Jl);
  }
  function syncUI() {
    for (const k of ["Kp", "Ki", "Kd"]) { $("c" + k).value = G[k].toPos(p[k]); $("c" + k + "Out").textContent = fmtG(p[k]); }
    $("cNotch").checked = p.notch;
    $("cFn").value = p.fn; $("cFnOut").textContent = `${p.fn.toFixed(1)} Hz`;
    $("cAw").checked = p.antiwindup;
    $("cSm").checked = p.sensor === "motor"; $("cSl").checked = p.sensor === "load";
    $("cFr").value = st.fr; $("cFrOut").textContent = `${st.fr.toFixed(1)} Hz（反共振 ${Servo.antiResonanceHz(p).toFixed(1)} Hz）`;
    $("cRatio").value = st.ratio; $("cRatioOut").textContent = st.ratio.toFixed(1);
    $("cTd").value = p.Td * 1000; $("cTdOut").textContent = `${(p.Td * 1000).toFixed(1)} ms`;
    $("cTmax").value = p.tmax; $("cTmaxOut").textContent = `${p.tmax.toFixed(1)} N·m`;
  }
  for (const k of ["Kp", "Ki", "Kd"]) $("c" + k).addEventListener("input", (e) => { p[k] = G[k].toVal(Number(e.target.value)); changed(); });
  $("cNotch").addEventListener("change", (e) => { p.notch = e.target.checked; changed(); });
  $("cFn").addEventListener("input", (e) => { p.fn = Number(e.target.value); changed(); });
  $("cAw").addEventListener("change", (e) => { p.antiwindup = e.target.checked; changed(); });
  document.querySelectorAll('input[name="cSensor"]').forEach((r) => r.addEventListener("change", () => { p.sensor = r.value; changed(); }));
  $("cFr").addEventListener("input", (e) => { st.fr = Number(e.target.value); applyPlant(); changed(); });
  $("cRatio").addEventListener("input", (e) => { st.ratio = Number(e.target.value); applyPlant(); changed(); });
  $("cTd").addEventListener("input", (e) => { p.Td = Number(e.target.value) / 1000; changed(); });
  $("cTmax").addEventListener("input", (e) => { p.tmax = Number(e.target.value); changed(); });

  const PRESETS = [
    { name: "P だけ", set: { Kp: 3, Ki: 0, Kd: 0, notch: false, sensor: "motor" }, note: "ずれに比例して押すだけ。ブレーキ役（D）がないので、ほとんど減衰せずに揺れ続ける。" },
    { name: "PD", set: { Kp: 3, Ki: 0, Kd: 0.25, notch: false, sensor: "motor" }, note: "微分でブレーキがかかり、すっと止まる。ただし腕を叩くと、元の角度に戻りきらない（定常偏差）。" },
    { name: "PID（標準）", set: { Kp: 3, Ki: 5, Kd: 0.25, notch: false, sensor: "motor" }, note: "積分が残ったずれを消す。位相余裕は約 50°。行き過ぎは積分の分だけ増える。" },
    { name: "攻めた PID", set: { Kp: 25, Ki: 50, Kd: 1.5, notch: false, sensor: "motor" }, note: "速いが、軸の共振のあたりでゲイン余裕が 3 dB を切る。叩くとキーンと鳴くように揺れる。" },
    { name: "攻めた PID ＋ ノッチ", set: { Kp: 25, Ki: 50, Kd: 1.5, notch: true, fn: 15, sensor: "motor" }, note: "共振の周波数だけ制御器のゲインを下げると、同じ速さのまま余裕が戻る。" },
    { name: "腕を測る", set: { Kp: 3, Ki: 5, Kd: 0.25, notch: false, sensor: "load" }, note: "動かす場所（モーター）と測る場所（腕）の間に共振があると、位相が 180° 回って不安定になる。余裕の数字は普通に見えるのに！" },
    { name: "腕を測る ＋ ノッチ", set: { Kp: 3, Ki: 5, Kd: 0.25, notch: true, fn: 15, sensor: "load" }, note: "共振を制御器から見えなくすれば、腕を直接測っても安定にできる。" },
  ];
  const presetBox = $("cPresets");
  PRESETS.forEach((pr, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = pr.name;
    b.addEventListener("click", () => {
      Object.assign(p, Servo.DEFAULT, { tmax: p.tmax, antiwindup: p.antiwindup }, pr.set);
      st.ratio = 3; st.fr = 15; applyPlant();
      syncUI();
      presetBox.querySelectorAll("button").forEach((x, j) => x.classList.toggle("on", j === i));
      $("cPresetNote").className = "status ok";
      $("cPresetNote").textContent = pr.note;
      sim.reset(); hist = [];
      changed();
    });
    presetBox.appendChild(b);
  });

  // ------------------------------------------------------------ 解析
  let ana = null, step = null, dirty = true;
  function changed() {
    syncUI();
    sim.setParams(p);
    dirty = true;
  }
  function analyzeNow() {
    ana = Servo.analyze(p, 1, 3000, 700);
    step = Servo.stepInfo(p, 1.5);
    const unstable = ana.stable.poles.filter((z) => z.re >= -1e-6).length;
    const b = $("cBadge");
    if (!ana.stable.ok) { b.className = "badge bad"; b.textContent = `不安定（右半平面の極 ${unstable} 個）`; }
    else if (ana.gm < 6 || Math.abs(ana.pm) < 30) { b.className = "badge warn"; b.textContent = "安定だが余裕が少ない"; }
    else { b.className = "badge ok"; b.textContent = "安定"; }
    const hz = (w) => `${(w / (2 * Math.PI)).toFixed(1)} Hz`;
    const rows = [
      ["閉ループ", ana.stable.ok ? '<span class="good">安定</span>' : `<span class="badv">不安定（極 ${unstable} 個が右）</span>`],
      ["位相余裕", Number.isFinite(ana.pm) ? `${ana.pm.toFixed(1)}°（${hz(ana.wpm)}）` : "—"],
      ["ゲイン余裕（上げる向き）", Number.isFinite(ana.gm) ? `${ana.gm.toFixed(1)} dB` : "∞"],
      ["ゲイン余裕（下げる向き）", Number.isFinite(ana.gmDown) ? `${ana.gmDown.toFixed(1)} dB` : "−∞"],
      ["ゲイン交差", Number.isFinite(ana.wc) ? hz(ana.wc) : "—"],
      ["感度の最大 |S|", `${ana.peakS.toFixed(1)} dB`],
      ["行き過ぎ", ana.stable.ok ? `${step.overshoot.toFixed(0)}%` : "—"],
      ["整定時間（±2%）", ana.stable.ok ? `${step.settle.toFixed(2)} s` : "—"],
      ["軸の共振 / 反共振", `${Servo.resonanceHz(p).toFixed(1)} / ${Servo.antiResonanceHz(p).toFixed(1)} Hz`],
    ];
    $("cInfo").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    drawBode(); drawNyq(); drawStep();
  }

  // ------------------------------------------------------------ 時間応答（実時間）
  const sim = new Servo.ServoSim(p);
  let hist = [], target = 0, speed = 1, running = true;
  $("cStep").addEventListener("click", () => {
    target = Math.abs(target) < 1e-9 ? 60 / DEG : 0;
    sim.r = target;
    $("cStep").textContent = target ? "目標を 0° へ" : "目標を 60° へ";
  });
  $("cKick").addEventListener("click", () => { sim.d = 3; kickUntil = sim.t + 0.02; });
  $("cReset").addEventListener("click", () => { sim.reset(); sim.r = target = 0; hist = []; $("cStep").textContent = "目標を 60° へ"; });
  document.querySelectorAll('input[name="cSpeed"]').forEach((r) => r.addEventListener("change", () => (speed = Number(r.value))));
  let kickUntil = -1;
  const scene = $("cScene");
  scene.addEventListener("pointerdown", (ev) => {
    const r = scene.getBoundingClientRect();
    const g = sceneGeom(r.width, r.height);
    const a = Math.atan2(-(ev.clientY - r.top - g.cy), ev.clientX - r.left - g.cx);
    target = a;
    sim.r = target;
  });

  function sceneGeom(w, h) { return { cx: w * 0.42, cy: h * 0.55, R: Math.min(w * 0.38, h * 0.42) }; }
  function drawScene() {
    const { ctx, w, h } = PL.fit(scene);
    const g = sceneGeom(w, h);
    const th = sim.x[1], tm = sim.x[0];
    // 目標
    ctx.strokeStyle = C.muted; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(g.cx + g.R * 1.05 * Math.cos(sim.r), g.cy - g.R * 1.05 * Math.sin(sim.r)); ctx.stroke();
    ctx.setLineDash([]);
    // 腕
    const ax = g.cx + g.R * Math.cos(th), ay = g.cy - g.R * Math.sin(th);
    ctx.strokeStyle = C.link2; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(ax, ay); ctx.stroke();
    PL.dot(ctx, ax, ay, 16, C.link2);
    // モーター（円盤と目印）
    PL.dot(ctx, g.cx, g.cy, g.R * 0.2, C.card);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.2, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = C.warn; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(g.cx + g.R * 0.32 * Math.cos(tm), g.cy - g.R * 0.32 * Math.sin(tm)); ctx.stroke();
    // ねじれの目盛（拡大表示）
    const tw = (tm - th) * DEG;
    const bx = w * 0.82, by = h * 0.18, bh = h * 0.64;
    ctx.fillStyle = C.grid; ctx.fillRect(bx - 8, by, 16, bh);
    const lim = 5;
    const yv = by + bh / 2 - (Math.max(-lim, Math.min(lim, tw)) / lim) * (bh / 2);
    ctx.fillStyle = C.warn; ctx.fillRect(bx - 8, Math.min(yv, by + bh / 2), 16, Math.abs(yv - (by + bh / 2)));
    PL.label(ctx, "軸のねじれ", bx, by - 10, { align: "center" });
    PL.label(ctx, `${tw.toFixed(2)}°`, bx, by + bh + 12, { align: "center" });
    PL.label(ctx, `±${lim}°`, bx + 12, by + 6);
    // トルク
    const tq = sim.tau / p.tmax;
    ctx.strokeStyle = sim.sat ? C.bad : C.warn; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.27, -tm, -tm - tq * Math.PI * 0.9, tq > 0); ctx.stroke();
    if (sim.sat) PL.label(ctx, "トルク飽和", g.cx, g.cy + g.R * 0.45, { align: "center", color: C.bad });
  }

  function drawLive() {
    const cv = $("cLive");
    const { ctx, w, h } = PL.fit(cv);
    const span = 3, t1 = Math.max(sim.t, span), t0 = t1 - span;
    const m = PL.axes(ctx, { x: 44, y: 14, w: w - 92, h: h - 34 }, { xmin: t0, xmax: t1, ymin: -100, ymax: 100, yticks: [-90, -45, 0, 45, 90], xticks: [Math.ceil(t0), Math.ceil(t0) + 1, Math.ceil(t0) + 2].filter((v) => v <= t1), xfmt: (v) => `${v}s`, title: "角度 [°]" });
    const ts = hist.map((e) => e.t);
    PL.line(ctx, m, ts, hist.map((e) => e.r), { color: C.muted, dash: [5, 4], width: 1.4 });
    PL.line(ctx, m, ts, hist.map((e) => e.tm), { color: C.warn, width: 1.4 });
    PL.line(ctx, m, ts, hist.map((e) => e.tl), { color: C.link2, width: 2 });
    const m2 = { X: m.X, Y: (v) => 14 + (h - 34) * (1 - (Math.max(-p.tmax * 1.2, Math.min(p.tmax * 1.2, v)) + p.tmax * 1.2) / (2.4 * p.tmax)) };
    PL.line(ctx, m2, ts, hist.map((e) => e.tau), { color: C.bad, width: 1, alpha: 0.7 });
    PL.label(ctx, `±${p.tmax.toFixed(1)}`, w - 44, 20, { color: C.bad });
  }

  // ------------------------------------------------------------ ボード線図
  function drawBode() {
    const cv = $("cBode");
    const { ctx, w, h } = PL.fit(cv);
    const a = ana;
    const xr = { xmin: 1, xmax: 3000, xlog: true, xticks: PL.decades(1, 3000), xfmt: (v) => `${v}` };
    const gh = (h - 70) * 0.55, ph = (h - 70) * 0.45;
    const gmin = -60, gmax = 60;
    const mg = PL.axes(ctx, { x: 48, y: 16, w: w - 60, h: gh }, { ...xr, ymin: gmin, ymax: gmax, yticks: [-40, -20, 0, 20, 40], title: "ゲイン [dB]", noXLabels: true, zeroY: true });
    PL.line(ctx, mg, a.ws, a.S, { color: C.link1, dash: [5, 3], width: 1.3 });
    PL.line(ctx, mg, a.ws, a.mag, { color: C.ink, width: 2 });
    const pmin = Math.max(-540, Math.floor(Math.min(...a.ph) / 90) * 90), pmax = Math.min(180, Math.ceil(Math.max(...a.ph) / 90) * 90);
    const yt = []; for (let v = pmin; v <= pmax; v += 90) yt.push(v);
    const mp = PL.axes(ctx, { x: 48, y: 30 + gh, w: w - 60, h: ph }, { ...xr, ymin: pmin, ymax: pmax, yticks: yt, title: "位相 [°]", xlabel: "角周波数 ω [rad/s]" });
    ctx.strokeStyle = C.bad; ctx.globalAlpha = 0.5; ctx.setLineDash([3, 3]);
    for (const v of yt) if ((v + 180) % 360 === 0) { ctx.beginPath(); ctx.moveTo(48, mp.Y(v)); ctx.lineTo(w - 12, mp.Y(v)); ctx.stroke(); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    PL.line(ctx, mp, a.ws, a.ph, { color: C.ink, width: 2 });
    // 位相余裕：ゲイン交差での位相と −180° の差
    for (const g of a.gc) {
      const X = mg.X(g.w);
      ctx.strokeStyle = C.ok; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(X, mg.Y(0)); ctx.lineTo(X, mp.Y(pmin)); ctx.stroke(); ctx.globalAlpha = 1;
      const phv = a.ph[nearest(a.ws, g.w)];
      const base = phv - (((phv + 180) % 360 + 540) % 360 - 180);
      ctx.strokeStyle = C.ok; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X, mp.Y(base)); ctx.lineTo(X, mp.Y(phv)); ctx.stroke();
    }
    // ゲイン余裕
    for (const g of a.pc) {
      const X = mg.X(g.w);
      ctx.strokeStyle = C.warn; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(X, mg.Y(0)); ctx.lineTo(X, mg.Y(-g.gm)); ctx.stroke();
    }
    const fr = 2 * Math.PI * Servo.resonanceHz(p);
    PL.label(ctx, "共振", mg.X(fr), 24, { align: "center" });
  }
  const nearest = (arr, v) => { let b = 0; for (let i = 1; i < arr.length; i++) if (Math.abs(Math.log(arr[i] / v)) < Math.abs(Math.log(arr[b] / v))) b = i; return b; };

  // ------------------------------------------------------------ ナイキスト線図
  function drawNyq() {
    const cv = $("cNyq");
    const { ctx, w, h } = PL.fit(cv);
    const R = 3;
    const m = PL.axes(ctx, { x: 30, y: 12, w: w - 42, h: h - 36 }, { xmin: -R, xmax: R, ymin: -R, ymax: R, xticks: [-3, -2, -1, 0, 1, 2, 3], yticks: [-3, -2, -1, 0, 1, 2, 3], zeroY: true });
    ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.moveTo(m.X(0), m.Y(-R)); ctx.lineTo(m.X(0), m.Y(R)); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(m.X(0), m.Y(0), Math.max(0, m.X(1) - m.X(0)), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
    const re = ana.L.map((z) => z[0]), im = ana.L.map((z) => z[1]);
    const inR = (i) => Math.abs(re[i]) < R * 1.5 && Math.abs(im[i]) < R * 1.5;
    const clipRe = re.map((v, i) => (inR(i) ? v : NaN)), clipIm = im.map((v, i) => (inR(i) ? v : NaN));
    PL.line(ctx, m, clipRe, clipIm.map((v) => -v), { color: C.muted, width: 1, alpha: 0.6 }); // ω < 0
    PL.line(ctx, m, clipRe, clipIm, { color: C.link2, width: 2 });
    // 向きの矢印
    for (const f of [0.3, 0.55, 0.75]) {
      const i = Math.floor(f * re.length);
      if (!inR(i) || !inR(i + 3)) continue;
      const x0 = m.X(re[i]), y0 = m.Y(im[i]), x1 = m.X(re[i + 3]), y1 = m.Y(im[i + 3]);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.fillStyle = C.link2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4)); ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4)); ctx.fill();
    }
    PL.cross(ctx, m.X(-1), m.Y(0), 6, ana.stable.ok ? C.bad : C.bad);
    PL.label(ctx, "−1", m.X(-1) - 4, m.Y(0) + 14, { align: "right", color: C.bad });
    PL.label(ctx, "実部", w - 14, m.Y(0) - 8, { align: "right" });
    PL.label(ctx, "虚部", m.X(0) + 6, 18);
  }

  // ------------------------------------------------------------ ステップ応答
  function drawStep() {
    const cv = $("cStepCv");
    const { ctx, w, h } = PL.fit(cv);
    const s = step;
    const ymax = Math.min(3, Math.max(1.6, ...s.y.filter(Number.isFinite)));
    const m = PL.axes(ctx, { x: 40, y: 14, w: w - 52, h: h - 36 }, { xmin: 0, xmax: 1.5, ymin: -0.2, ymax, yticks: [0, 0.5, 1, 1.5].filter((v) => v <= ymax), xticks: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], xfmt: (v) => `${v}s`, title: "角度 [rad]" });
    ctx.fillStyle = C.ok; ctx.globalAlpha = 0.1;
    ctx.fillRect(40, m.Y(1.02), w - 52, m.Y(0.98) - m.Y(1.02)); ctx.globalAlpha = 1;
    PL.line(ctx, m, [0, 1.5], [1, 1], { color: C.muted, dash: [5, 4], width: 1.2 });
    PL.line(ctx, m, s.t, s.ym, { color: C.warn, width: 1.4 });
    PL.line(ctx, m, s.t, s.y, { color: C.link2, width: 2.2 });
    if (!ana.stable.ok) PL.label(ctx, "不安定：応答が発散する", w / 2, h / 2, { align: "center", color: C.bad, font: "600 14px system-ui, sans-serif" });
  }

  // ------------------------------------------------------------ ループ
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (dirty) { dirty = false; analyzeNow(); }
    if (running) {
      acc += dt * speed;
      let n = 0;
      while (acc >= H && n < 400) {
        if (kickUntil >= 0 && sim.t > kickUntil) { sim.d = 0; kickUntil = -1; }
        sim.step(H);
        acc -= H; n++;
        if (Math.round(sim.t / H) % 10 === 0) hist.push({ t: sim.t, r: sim.r * DEG, tm: sim.x[0] * DEG, tl: sim.x[1] * DEG, tau: sim.tau });
      }
      while (hist.length && hist[0].t < sim.t - 3.2) hist.shift();
      if (!sim.x.every((v) => Number.isFinite(v) && Math.abs(v) < 1e3)) { sim.reset(); sim.r = target; hist = []; }
    }
    drawScene();
    drawLive();
    $("cTarget").textContent = (sim.r * DEG).toFixed(0);
    $("cArm").textContent = (sim.x[1] * DEG).toFixed(1);
    $("cTau").textContent = sim.tau.toFixed(2);
    requestAnimationFrame(frame);
  }
  PL.onRedraw(() => { if (ana) { drawBode(); drawNyq(); drawStep(); } });
  applyPlant();
  syncUI();
  presetBox.children[2].classList.add("on");
  requestAnimationFrame(frame);
})();
