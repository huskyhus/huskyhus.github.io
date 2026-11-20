// 画面：パラメータ → 軌道計画 → 制御器の構築 → シミュレーション、と耐性試験。
(() => {
  "use strict";
  const SEED = window.TRIPLE_SEED;
  const TS = TC.TS;
  const TAU = 2 * Math.PI;
  const wrap = TC.wrap;
  const DEG = Math.PI / 180;
  const SPAN = 6;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ------------------------------------------------------------ 状態
  let plan = null;   // { prob, z, info }
  let ctrl = null;
  let sim = null;
  const weights = { qx: 20, qth: 200, qv: 2, r: 0.05 };
  const noise = { sth: 0.02 * DEG, sx: 1e-4, su: 0.5 };
  let estimator = "ekf", feedback = true, running = true, speed = 1, autoRecover = true;
  let hist = [], trail = [];
  let job = null;    // 実行中の非同期処理 { cancel }
  let sweepData = null;
  const sweepCv = $("sweepCv");
  let C = {};
  let polesDirty = true;

  // ------------------------------------------------------------ 非同期の実行（UI を止めない）
  function runJob(gen, { onYield, onDone }) {
    const j = { cancelled: false, cancel() { this.cancelled = true; } };
    const tick = () => {
      if (j.cancelled) { onDone(null, true); return; }
      const t0 = performance.now();
      try {
        while (performance.now() - t0 < 24) {
          const r = gen.next();
          if (r.done) { onDone(r.value, false); return; }
          if (r.value && onYield) onYield(r.value);
        }
      } catch (err) {
        console.error(err);
        onDone({ ok: false, error: String(err) }, false);
        return;
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    return j;
  }

  // ------------------------------------------------------------ パラメータ UI
  const PARAM_IDS = ["m1", "m2", "m3", "l1", "l2", "l3", "xmax", "umax", "T"];
  const fmtParam = {
    m1: (v) => `${v.toFixed(2)} kg`, m2: (v) => `${v.toFixed(2)} kg`, m3: (v) => `${v.toFixed(2)} kg`,
    l1: (v) => `${v.toFixed(2)} m`, l2: (v) => `${v.toFixed(2)} m`, l3: (v) => `${v.toFixed(2)} m`,
    xmax: (v) => `${v.toFixed(2)} m`, umax: (v) => `${v.toFixed(0)} m/s²`, T: (v) => `${v.toFixed(1)} s`,
  };
  function setParamUI(spec) {
    const p = spec.params;
    const vals = { m1: p.m[0], m2: p.m[1], m3: p.m[2], l1: p.l[0], l2: p.l[1], l3: p.l[2], xmax: spec.xmax, umax: spec.umax, T: spec.T };
    for (const id of PARAM_IDS) {
      $(id).value = vals[id];
      $(id + "Out").textContent = fmtParam[id](Number($(id).value));
    }
  }
  function specFromUI() {
    const v = (id) => Number($(id).value);
    const base = plan ? plan.prob.spec : SEED.spec;
    return {
      params: { g: base.params.g, m: [v("m1"), v("m2"), v("m3")], l: [v("l1"), v("l2"), v("l3")], d: base.params.d.slice() },
      T: Math.round(v("T") * 10) / 10, xmax: v("xmax"), umax: v("umax"), vmax: base.vmax,
      goal: base.goal.slice(), M: base.M,
    };
  }
  function sameSpec(a, b) {
    const eq = (x, y) => Math.abs(x - y) < 1e-9;
    return a.params.m.every((v, i) => eq(v, b.params.m[i])) && a.params.l.every((v, i) => eq(v, b.params.l[i])) &&
      eq(a.T, b.T) && eq(a.xmax, b.xmax) && eq(a.umax, b.umax);
  }
  function refreshDirty() {
    if (job) return;
    const dirty = plan && !sameSpec(specFromUI(), plan.prob.spec);
    $("solve").disabled = !dirty;
    $("solve").textContent = "軌道を計算";
    if (dirty) setStatus("solveStatus", "パラメータが変わった。「軌道を計算」で解き直す（今の解から少しずつ動かして解く）。", "warn");
    else if (plan) setStatus("solveStatus", plan.info.msg || "", plan.info.cls || "ok");
  }
  for (const id of PARAM_IDS) {
    $(id).addEventListener("input", () => {
      $(id + "Out").textContent = fmtParam[id](Number($(id).value));
      refreshDirty();
    });
  }

  function setStatus(id, html, cls = "") {
    const el = $(id);
    el.className = "status " + cls;
    el.innerHTML = html;
  }

  // ------------------------------------------------------------ 計画の採用
  function adoptPlan(prob, z, meta = {}) {
    const traj = Planner.sampleTrajectory(prob, z, TS);
    const peaks = Planner.constraintPeaks(traj);
    const c = Planner.residuals(prob, z);
    let viol = 0;
    for (const v of c) viol = Math.max(viol, Math.abs(v));
    const obj = Planner.objective(prob, z);
    const ierr = Planner.integrationError(prob, z);
    plan = { prob, z, info: { peaks, viol, cost: obj.J, ierr, ...meta } };
    rebuildController();
    const sp = prob.spec;
    const warn = [];
    if (peaks.x > sp.xmax + 1e-3) warn.push(`台車が ${peaks.x.toFixed(3)} m まで動く（制約 ${sp.xmax} m）`);
    if (peaks.u > sp.umax + 0.05) warn.push(`加速度が ${peaks.u.toFixed(1)} m/s² に達する（制約 ${sp.umax}）`);
    if (peaks.v > sp.vmax + 0.01) warn.push(`台車速度が ${peaks.v.toFixed(2)} m/s に達する（制約 ${sp.vmax}）`);
    plan.info.msg = (meta.msg || "解けている。") + (warn.length ? `<br>注意：${warn.join("、")}。ペナルティ法なので、制約をわずかに破ることがある。` : "");
    plan.info.cls = warn.length ? "warn" : "ok";
    renderPlanInfo();
    refreshDirty();
    $("paramList").innerHTML = paramListHTML(SEED.spec);
  }

  function rebuildController() {
    ctrl = TC.buildController(plan.prob, plan.z, weights);
    computePoleRange();
    computePlanGhost();
    newSim();
    polesDirty = true;
  }

  function newSim() {
    sim = new TC.Sim(ctrl, { noise: { ...noise }, reality: { ...reality }, estimator, feedback, ekfQa, autoRecover, seed: (Math.random() * 2 ** 31) | 0 });
    hist = [];
    trail = [];
    showPlant();
  }

  function renderPlanInfo() {
    const i = plan.info, sp = plan.prob.spec;
    // 懸垂（π）から終端までの正味の回転角（正 = 時計回り）
    const turn = plan.prob.goal.slice(1, 4).map((g) => Math.round(((g - Math.PI) * 180) / Math.PI));
    const rows = [
      ["入力の二乗積分 J", `${i.cost.toFixed(3)} (m/s²)²·s`],
      ["欠損の最大値", `${i.viol.toExponential(1)}`],
      ["RK4 打ち切り誤差の見積もり", `${i.ierr.toExponential(1)}`],
      ["max |u|", `${i.peaks.u.toFixed(2)} / ${sp.umax} m/s²`],
      ["max |x|", `${i.peaks.x.toFixed(3)} / ${sp.xmax} m`],
      ["max |ẋ|", `${i.peaks.v.toFixed(2)} / ${sp.vmax} m/s`],
    ];
    if (i.iters != null) rows.push(["計算", `${i.stages ? i.stages + " 段・" : ""}${i.iters} 反復・${(i.ms / 1000).toFixed(1)} s`]);
    rows.push(["正味の回転角", turn.map((d, k) => `θ${k + 1} ${d > 0 ? "+" : ""}${d}°`).join("　")]);
    $("planInfo").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  // ------------------------------------------------------------ 軌道計算
  function setBusy(kind) {
    const busy = !!kind;
    $("solve").disabled = busy ? kind !== "solve" : false;
    $("solve").textContent = kind === "solve" ? "中止" : "軌道を計算";
    $("defaults").disabled = busy;
    $("mc").disabled = busy;
    $("sweep").disabled = busy;
    $("mcStop").disabled = !(kind === "mc");
    for (const id of PARAM_IDS) $(id).disabled = kind === "solve";
  }

  $("solve").addEventListener("click", () => {
    if (job) { job.cancel(); return; }
    const target = specFromUI();
    if (sameSpec(target, plan.prob.spec)) return;
    let stage = null, iters = 0;
    setBusy("solve");
    const gen = Planner.continuation({ prob: plan.prob, z: plan.z }, target, (st) => (stage = st));
    job = runJob(gen, {
      onYield: (v) => {
        iters++;
        const lam = stage ? `段 ${stage.stages + 1}：目標まで ${(stage.lam * 100).toFixed(0)}% の地点を解いている` : "";
        setStatus("solveStatus", `計算中… ${lam}<br>反復 ${v.it}　欠損 ${v.viol.toExponential(1)}　J ${v.cost.toFixed(2)}${v.polish ? "（仕上げのニュートン射影）" : ""}`, "busy");
      },
      onDone: (res, cancelled) => {
        job = null;
        setBusy(null);
        if (cancelled) { refreshDirty(); setStatus("solveStatus", "中止した。前の解のまま。", "warn"); return; }
        if (res && res.ok) {
          adoptPlan(res.prob, res.z, { iters, stages: res.stages, ms: res.ms, msg: "解けた。台車を下に戻して振り上げる。" });
          sim.startSwing();
        } else {
          const reached = res && res.reached != null ? `目標まで ${(res.reached * 100).toFixed(0)}% の地点までは解けた。` : "";
          setStatus("solveStatus", `解けなかった。${reached}<br>T を長くする、u<sub>max</sub> やレールを広げる、変化を小さくする、などを試す。前の解のまま。`, "bad");
        }
      },
    });
  });

  $("defaults").addEventListener("click", () => {
    setParamUI(SEED.spec);
    const prob = Planner.createProblem(SEED.spec);
    adoptPlan(prob, Float64Array.from(SEED.z), { msg: "既定パラメータの解（IPOPT の解を初期値に、このプランナーで解き直したもの）。" });
  });

  // ------------------------------------------------------------ 現実の不完全さ（雑音・量子化・むだ時間・モデル誤差）と推定
  const NOISE = {
    nth: { lo: 0.001, hi: 3, key: "sth", toSim: (v) => v * DEG, fmt: (v) => `${v < 0.01 ? v.toFixed(4) : v < 0.1 ? v.toFixed(3) : v.toFixed(2)}°` },
    nx: { lo: 0.001, hi: 30, key: "sx", toSim: (v) => v / 1000, fmt: (v) => `${v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(1)} mm` },
    nu: { lo: 0.01, hi: 200, key: "su", toSim: (v) => v, fmt: (v) => `${v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1)} m/s²` },
    qa: { lo: 0.1, hi: 100, key: null, toSim: (v) => v, fmt: (v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} rad/s²` },
  };
  const posToVal = (n, p) => (p <= 0 ? 0 : n.lo * Math.pow(n.hi / n.lo, (p - 1) / 99));
  const valToPos = (n, v) => (v <= 0 ? 0 : clamp(Math.round(1 + (99 * Math.log(v / n.lo)) / Math.log(n.hi / n.lo)), 1, 100));
  const noiseUI = { nth: 0.02, nx: 0.1, nu: 0.5, qa: 3 }; // 表示単位での値
  const reality = { ...TC.REALITY0 };
  let ekfQa = 3;

  function setNoiseSlider(id, v) {
    noiseUI[id] = v;
    $(id).value = valToPos(NOISE[id], v);
    applyNoise(id);
  }
  function applyNoise(id) {
    const n = NOISE[id], v = noiseUI[id];
    if (n.key) noise[n.key] = n.toSim(v);
    else ekfQa = v;
    $(id + "Out").textContent = v === 0 ? "0（なし）" : n.fmt(v);
  }
  for (const id of Object.keys(NOISE)) {
    const el = $(id);
    el.value = valToPos(NOISE[id], noiseUI[id]);
    applyNoise(id);
    el.addEventListener("input", () => {
      noiseUI[id] = posToVal(NOISE[id], Number(el.value));
      applyNoise(id);
      if (!sim) return;
      if (NOISE[id].key) sim.noise = { ...noise };
      else sim.ekfQa = ekfQa;
    });
  }

  // 実機の側の設定は、変えたら最初からやり直す（実機を引き直す）
  const REAL = {
    massErr: { el: "rMass", toVal: (p) => p / 100, fmt: (v) => `±${(v * 100).toFixed(0)}%` },
    lenErr: { el: "rLen", toVal: (p) => p / 100, fmt: (v) => `±${(v * 100).toFixed(1)}%` },
    fric: { el: "rFric", toVal: (p) => Math.pow(30, p / 100), fmt: (v) => `×${v < 10 ? v.toFixed(2) : v.toFixed(1)}` },
    delay: { el: "rDelay", toVal: (p) => Math.round(p / 2), fmt: (v) => `${v * 2} ms` },
  };
  const toPos = { massErr: (v) => v * 100, lenErr: (v) => v * 100, fric: (v) => (100 * Math.log(v)) / Math.log(30), delay: (v) => v * 2 };
  function syncReality() {
    for (const [k, r] of Object.entries(REAL)) {
      $(r.el).value = toPos[k](reality[k]);
      $(r.el + "Out").textContent = r.fmt(reality[k]);
    }
    $("rComp").checked = reality.comp;
    $("rPpr").value = String(reality.ppr);
  }
  for (const [k, r] of Object.entries(REAL)) {
    $(r.el).addEventListener("input", () => {
      reality[k] = r.toVal(Number($(r.el).value));
      $(r.el + "Out").textContent = r.fmt(reality[k]);
    });
    $(r.el).addEventListener("change", () => { if (plan) newSim(); });
  }
  $("rComp").addEventListener("change", (e) => { reality.comp = e.target.checked; if (plan) newSim(); });
  $("rPpr").addEventListener("change", (e) => { reality.ppr = Number(e.target.value); if (plan) newSim(); });

  const PRESETS = {
    ideal: { noise: { nth: 0, nx: 0, nu: 0, qa: 3 }, reality: { ...TC.REALITY0 } },
    default: { noise: { nth: 0.02, nx: 0.1, nu: 0.5, qa: 3 }, reality: { ...TC.REALITY0 } },
    real: { noise: { nth: 0.01, nx: 0.1, nu: 0.5, qa: 3 }, reality: { massErr: 0.05, lenErr: 0.01, fric: 2, delay: 2, comp: true, ppr: 4096 } },
  };
  for (const [name, pr] of Object.entries(PRESETS)) {
    $("preset-" + name).addEventListener("click", () => {
      for (const [id, v] of Object.entries(pr.noise)) setNoiseSlider(id, v);
      Object.assign(reality, pr.reality);
      syncReality();
      if (plan) newSim();
    });
  }
  syncReality();

  document.querySelectorAll('input[name="est"]').forEach((r) =>
    r.addEventListener("change", () => {
      estimator = r.value;
      if (sim) {
        sim.estimator = estimator;
        sim.est.set(sim.s);
      }
    })
  );
  $("autoRecover").addEventListener("change", (e) => {
    autoRecover = e.target.checked;
    if (sim) sim.autoRecover = autoRecover;
  });
  $("feedback").addEventListener("change", (e) => {
    feedback = e.target.checked;
    if (sim) sim.feedback = feedback;
  });

  function showPlant() {
    if (!sim) return;
    const nom = plan.prob.spec.params, p = sim.plantParams;
    const pct = (a, b) => { const d = (a / b - 1) * 100; return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`; };
    const any = reality.massErr > 0 || reality.lenErr > 0 || reality.fric !== 1;
    $("plantInfo").innerHTML = any
      ? `この回の実機（制御器は知らない）：質量 ${p.m.map((v, i) => pct(v, nom.m[i])).join(" / ")}、長さ ${p.l.map((v, i) => pct(v, nom.l[i])).join(" / ")}、摩擦 ×${reality.fric.toFixed(2)}`
      : "実機は名目モデルと同じ。";
  }

  // ------------------------------------------------------------ 制御器の重み
  const logFmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2));
  for (const [id, key] of [["qth", "qth"], ["qx", "qx"], ["rw", "r"]]) {
    const el = $(id);
    el.value = Math.log10(weights[key]);
    $(id + "Out").textContent = logFmt(weights[key]);
    el.addEventListener("input", () => {
      weights[key] = Math.pow(10, Number(el.value));
      $(id + "Out").textContent = logFmt(weights[key]);
    });
    el.addEventListener("change", () => {
      if (!plan) return;
      rebuildController();
      sweepData = null;
      drawSweep();
    });
  }

  // ------------------------------------------------------------ 再生操作
  $("swing").addEventListener("click", () => {
    if (sim.mode !== "pre") { newSim(); }
    sim.startSwing();
    running = true;
    refreshPlay();
  });
  $("reset").addEventListener("click", () => { newSim(); refreshPlay(); });
  $("play").addEventListener("click", () => { running = !running; refreshPlay(); });
  $("poke").addEventListener("click", () => poke(2, Math.random() < 0.5 ? 1 : -1));
  document.querySelectorAll('input[name="speed"]').forEach((r) => r.addEventListener("change", () => (speed = Number(r.value))));
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      running = !running;
      refreshPlay();
    }
  });
  function refreshPlay() { $("play").textContent = running ? "一時停止" : "再生"; }

  function poke(link, dir, mag = 1.5) {
    const c = Math.cos(sim.s[1 + link]);
    const sgn = Math.abs(c) < 0.2 ? 1 : Math.sign(c);
    sim.poke(link, dir * sgn * mag);
  }

  // ------------------------------------------------------------ 色とキャンバス
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["ink", "muted", "line", "grid", "card", "link1", "link2", "link3", "cart", "ref", "ok", "bad", "warn"])
      C[k] = cs.getPropertyValue("--" + k).trim();
    polesDirty = true;
    drawSweep();
  }
  const linkColor = (i) => [C.link1, C.link2, C.link3][i];

  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  // ------------------------------------------------------------ 場面
  const scene = $("scene");
  let view = { k: 1, cx: 0, cy: 0 };

  function drawLinks(ctx, md, s, colors, width, alpha, joints = true) {
    const g = TM.geometry(md, s);
    const P2 = (p) => [view.cx + p[0] * view.k, view.cy - p[1] * view.k];
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const a = P2(g.pts[i]), b = P2(g.pts[i + 1]);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    if (joints) {
      for (let i = 0; i < 4; i++) {
        const a = P2(g.pts[i]);
        ctx.fillStyle = i === 3 ? colors[2] : C.card;
        ctx.strokeStyle = i === 0 ? C.cart : colors[Math.max(0, i - 1)];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(a[0], a[1], i === 3 ? width * 0.8 : width * 0.55, 0, TAU);
        ctx.fill();
        if (i !== 3) ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawScene() {
    const { ctx, w, h } = fitCanvas(scene);
    const md = sim.md, rail = sim.rail, xmax = plan.prob.spec.xmax; // 実機の寸法で描く
    const reach = md.l[0] + md.l[1] + md.l[2];
    const k = Math.min(w / (2 * rail + 0.3), h / (2 * reach + 0.16));
    view = { k, cx: w / 2, cy: h / 2 };
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -3; x <= 3; x += 0.25) {
      const X = view.cx + x * k;
      if (X >= 0 && X <= w) { ctx.moveTo(X, 0); ctx.lineTo(X, h); }
      const Y = view.cy - x * k;
      if (Y >= 0 && Y <= h) { ctx.moveTo(0, Y); ctx.lineTo(w, Y); }
    }
    ctx.stroke();

    const cartH = 0.06 * k, cartW = 0.15 * k;
    const ry = view.cy + cartH * 0.5 + 3;
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(view.cx - rail * k - cartW / 2, ry);
    ctx.lineTo(view.cx + rail * k + cartW / 2, ry);
    ctx.stroke();
    const hit = sim.hitAt >= 0 && sim.t - sim.hitAt < 0.8;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const sd of [-1, 1]) {
      const X = view.cx + sd * (rail * k + cartW / 2);
      ctx.fillStyle = hit ? C.bad : C.muted;
      ctx.fillRect(X - (sd > 0 ? 0 : 6), ry - 16, 6, 22);
      const Xc = view.cx + sd * xmax * k;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Xc, ry - 10); ctx.lineTo(Xc, ry + 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = C.muted;
    ctx.fillText(`x = ±${xmax.toFixed(2)} m`, view.cx + xmax * k, ry + 22);

    const lw = Math.max(4, 0.022 * k);

    // 計画した軌道の全体（うっすら）：一定間隔の姿勢と、先端の通り道
    if (planGhost && sim.mode !== "hold") {
      const fade = sim.mode === "lost" ? 0.5 : 1;
      for (const st of planGhost.snaps) drawLinks(ctx, ctrl.md, st, [C.ref, C.ref, C.ref], 1.2, 0.18 * fade, false);
      ctx.globalAlpha = 0.45 * fade;
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      planGhost.tip.forEach((p, i) => {
        const X = view.cx + p[0] * k, Y = view.cy - p[1] * k;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 計画の今の姿勢（点線）
    if (sim.ref) {
      ctx.setLineDash([6, 5]);
      drawLinks(ctx, ctrl.md, sim.ref.s, [C.ref, C.ref, C.ref], lw * 0.55, 0.85, false);
      ctx.setLineDash([]);
      const X = view.cx + sim.ref.s[0] * k;
      ctx.strokeStyle = C.ref;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X - cartW / 2, view.cy - cartH / 2, cartW, cartH);
    }

    // 先端の軌跡
    if (trail.length > 1) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.link3;
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        ctx.globalAlpha = Math.max(0, 1 - (sim.t - b.t) / 1.2) * 0.6;
        ctx.beginPath();
        ctx.moveTo(view.cx + a.p[0] * k, view.cy - a.p[1] * k);
        ctx.lineTo(view.cx + b.p[0] * k, view.cy - b.p[1] * k);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // 台車
    const X = view.cx + sim.s[0] * k;
    ctx.fillStyle = C.cart;
    roundRect(ctx, X - cartW / 2, view.cy - cartH / 2, cartW, cartH, 5);
    ctx.fill();
    ctx.fillStyle = C.card;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(X + sd * cartW * 0.3, view.cy + cartH / 2, cartH * 0.18, 0, TAU);
      ctx.fill();
    }
    // 加速度の矢印
    const umax = plan.prob.spec.umax;
    const len = clamp(sim.u / umax, -1.3, 1.3) * 0.25 * k;
    if (Math.abs(len) > 2) {
      const yA = view.cy - cartH / 2 - 12;
      ctx.strokeStyle = sim.sat ? C.bad : C.warn;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(X, yA);
      ctx.lineTo(X + len, yA);
      ctx.stroke();
      const sd = Math.sign(len);
      ctx.beginPath();
      ctx.moveTo(X + len + sd * 7, yA);
      ctx.lineTo(X + len - sd * 2, yA - 6);
      ctx.lineTo(X + len - sd * 2, yA + 6);
      ctx.closePath();
      ctx.fill();
    }

    // 推定器が見ている姿勢（薄い線）
    if (estimator === "ekf") drawLinks(ctx, ctrl.md, sim.est, [C.muted, C.muted, C.muted], 1.5, 0.9, false); // 推定器は名目の寸法しか知らない
    drawLinks(ctx, md, sim.s, [C.link1, C.link2, C.link3], lw, 1);

    if (!running) {
      ctx.fillStyle = C.muted;
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("一時停止中", 10, 20);
    }
  }

  scene.addEventListener("pointerdown", (ev) => {
    const r = scene.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    const g = TM.geometry(sim.md, sim.s);
    let best = 0, bd = Infinity;
    g.coms.forEach((c, i) => {
      const d = Math.hypot(px - (view.cx + c[0] * view.k), py - (view.cy - c[1] * view.k));
      if (d < bd) { bd = d; best = i; }
    });
    poke(best, px < view.cx + g.coms[best][0] * view.k ? 1 : -1);
  });

  // ------------------------------------------------------------ 時系列
  const plots = $("plots");
  function drawPlots() {
    const { ctx, w, h } = fitCanvas(plots);
    ctx.clearRect(0, 0, w, h);
    const L = 46, R = 8, top = 16, gap = 24, bottom = 20;
    const avail = h - top - bottom - 2 * gap;
    const hs = [avail * 0.5, avail * 0.25, avail * 0.25];
    const t1 = Math.max(sim.t, SPAN), t0 = t1 - SPAN;
    const X = (t) => L + ((t - t0) / SPAN) * (w - L - R);
    const umax = plan.prob.spec.umax, xmax = plan.prob.spec.xmax;
    const xr = Math.ceil((xmax + 0.05) * 10) / 10;
    const panels = [
      { title: "リンク角 θ [deg]（−180〜180 に折り返し）", lo: -180, hi: 180, ticks: [-180, -90, 0, 90, 180],
        series: [0, 1, 2].map((i) => ({ v: (e) => wrap(e.th[i]) / DEG, r: (e) => wrap(e.ref[i]) / DEG, c: linkColor(i), wrap: true })) },
      { title: "台車位置 x [m]", lo: -xr, hi: xr, ticks: [-xmax, 0, xmax].map((v) => +v.toFixed(2)),
        series: [{ v: (e) => e.x, r: (e) => e.ref[3], c: C.cart }] },
      { title: "加速度 u [m/s²]", lo: -umax * 1.3, hi: umax * 1.3, ticks: [-umax, 0, umax],
        series: [{ v: (e) => e.u, r: (e) => e.ref[4], c: C.warn }] },
    ];
    let y = top;
    ctx.font = "11px system-ui, sans-serif";
    panels.forEach((pn, idx) => {
      const ph = hs[idx];
      const Y = (v) => y + ph - ((clamp(v, pn.lo, pn.hi) - pn.lo) / (pn.hi - pn.lo)) * ph;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = C.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const tv of pn.ticks) {
        ctx.beginPath();
        ctx.moveTo(L, Y(tv)); ctx.lineTo(w - R, Y(tv));
        ctx.stroke();
        ctx.fillText(String(tv), L - 6, Y(tv));
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(pn.title, L, y - 3);
      for (const sr of pn.series) {
        for (const mode of ["ref", "val"]) {
          ctx.strokeStyle = mode === "ref" ? C.ref : sr.c;
          ctx.lineWidth = mode === "ref" ? 1.5 : 1.8;
          ctx.setLineDash(mode === "ref" ? [5, 4] : []);
          ctx.beginPath();
          let prev = null;
          for (const e of hist) {
            if (e.t < t0) continue;
            if (mode === "ref" && !e.ref) { prev = null; continue; }
            const v = mode === "ref" ? sr.r(e) : sr.v(e);
            if (prev !== null && !(sr.wrap && Math.abs(v - prev) > 180)) ctx.lineTo(X(e.t), Y(v));
            else ctx.moveTo(X(e.t), Y(v));
            prev = v;
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      y += ph + gap;
    });
    ctx.fillStyle = C.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let t = Math.ceil(t0); t <= t1; t++) ctx.fillText(`${t}s`, X(t), h - bottom + 4);
  }

  // ------------------------------------------------------------ 極
  const polesCv = $("poles");
  function niceStep(x) {
    const e = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / e;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
  }
  function drawPoles() {
    const S = TC.FROZEN_STRIDE, fz = ctrl.frozen;
    const kk = sim.k - sim.k0;
    const tracking = sim.started && kk < ctrl.N && sim.mode !== "lost" && sim.mode !== "pre";
    let d, key, title, Rm, K;
    if (tracking) {
      const idx = Math.min(fz.length - 1, Math.floor(kk / S));
      d = fz[idx];
      key = "f" + idx + ctrl.weights.r;
      title = `時変 LQR：t = ${(idx * S * TS).toFixed(2)} s で凍結した極`;
      Rm = poleRange.frozen;
      K = ctrl.Ks[d.k];
    } else {
      d = sim.mode === "pre" || sim.mode === "recover" ? ctrl.down : ctrl.up;
      key = d.code + ctrl.weights.r + ctrl.weights.qth + ctrl.weights.qx;
      title = sim.mode === "pre" || sim.mode === "recover" ? "下下下（下での静止）での極" : "上上上での極（倒立を保つ LQR）";
      Rm = poleRange[d.code];
      K = d.K;
    }
    if (!polesDirty && key === lastPoleKey) return;
    polesDirty = false;
    lastPoleKey = key;
    $("poleTitle").textContent = title;

    const { ctx, w, h } = fitCanvas(polesCv);
    ctx.clearRect(0, 0, w, h);
    const step = niceStep(Rm / 2);
    const pad = 22;
    const sc = (Math.min(w, h) - 2 * pad) / (2 * Rm);
    const cx = w / 2, cy = h / 2;
    const P = (p) => {
      const x = p.re, y = p.im;
      const m = Math.max(Math.abs(x), Math.abs(y));
      const f = m > Rm ? Rm / m : 1; // 範囲の外は縁に寄せる
      return [cx + x * f * sc, cy - y * f * sc, f < 1];
    };
    ctx.fillStyle = C.bad;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(cx, cy - Rm * sc, Rm * sc, 2 * Rm * sc);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = C.muted;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let v = -Math.floor(Rm / step) * step; v <= Rm + 1e-9; v += step) {
      ctx.beginPath();
      ctx.moveTo(cx + v * sc, cy - Rm * sc); ctx.lineTo(cx + v * sc, cy + Rm * sc);
      ctx.moveTo(cx - Rm * sc, cy - v * sc); ctx.lineTo(cx + Rm * sc, cy - v * sc);
      ctx.stroke();
      if (Math.abs(v) > 1e-9) ctx.fillText(String(Math.round(v)), cx + v * sc, cy + 3);
    }
    ctx.strokeStyle = C.muted;
    ctx.beginPath();
    ctx.moveTo(cx - Rm * sc, cy); ctx.lineTo(cx + Rm * sc, cy);
    ctx.moveTo(cx, cy - Rm * sc); ctx.lineTo(cx, cy + Rm * sc);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText("Re [1/s]", cx + Rm * sc, cy + 14);
    ctx.textAlign = "left";
    ctx.fillText("Im", cx + 4, cy - Rm * sc);

    // 振り上げ全体での凍結した極の軌跡（うっすら）
    if (tracking) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = C.link2;
      for (const f of fz) for (const p of f.closed) { const [x, y] = P(p); ctx.fillRect(x - 1, y - 1, 2, 2); }
      ctx.fillStyle = C.muted;
      for (const f of fz) for (const p of f.open) { const [x, y] = P(p); ctx.fillRect(x - 1, y - 1, 2, 2); }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C.muted;
    ctx.lineWidth = 2;
    for (const p of d.open) {
      const [x, y] = P(p);
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5);
      ctx.stroke();
    }
    for (const p of d.closed) {
      const [x, y, clipped] = P(p);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, TAU);
      if (clipped) { ctx.strokeStyle = C.link2; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = C.link2; ctx.fill(); }
    }

    const unstable = d.open.filter((p) => p.re > 1e-6);
    const slow = Math.max(...d.closed.map((p) => p.re));
    const fast = Math.min(...d.closed.map((p) => p.re));
    const kTxt = `K = [${Array.from(K, (v) => v.toFixed(1)).join(", ")}]`;
    $("poleStats").innerHTML = tracking
      ? `この瞬間の線形化の不安定な極：${unstable.length} 個${unstable.length ? `（最大 ${Math.max(...unstable.map((p) => p.re)).toFixed(1)} s⁻¹）` : ""}<br>` +
        `凍結した閉ループ極の実部：${fast.toFixed(1)} 〜 ${slow.toFixed(2)} s⁻¹<br>` +
        `時変系では、凍結した極がすべて左にあっても安定とは限らず、右にはみ出す瞬間があっても不安定とは限らない。薄い点は振り上げ全体での軌跡。<br>K(t) = [${Array.from(K, (v) => v.toFixed(1)).join(", ")}]`
      : `不安定な開ループ極：${unstable.length} 個${unstable.length ? `（最大 ${Math.max(...unstable.map((p) => p.re)).toFixed(1)} s⁻¹）` : ""}<br>` +
        `閉ループ極の実部：${fast.toFixed(1)} 〜 ${slow.toFixed(2)} s⁻¹<br>${kTxt}`;
  }

  // 極の図の表示範囲（振り上げ中は全体の 97% が収まる範囲）
  let poleRange = {};
  let lastPoleKey = "";
  function computePoleRange() {
    const rangeOf = (ps) => {
      let m = 1;
      for (const p of ps) m = Math.max(m, Math.abs(p.re), Math.abs(p.im));
      const st = niceStep(m / 2);
      return Math.ceil((m * 1.08) / st) * st;
    };
    const all = [];
    for (const f of ctrl.frozen) for (const p of [...f.open, ...f.closed]) all.push(Math.max(Math.abs(p.re), Math.abs(p.im)));
    all.sort((a, b) => a - b);
    const q = all[Math.floor(all.length * 0.97)] || 1;
    const st = niceStep(q / 2);
    poleRange = {
      frozen: Math.ceil((q * 1.08) / st) * st,
      UUU: rangeOf([...ctrl.up.open, ...ctrl.up.closed]),
      DDD: rangeOf([...ctrl.down.open, ...ctrl.down.closed]),
    };
  }

  // 計画した軌道の「うっすら」表示用：先端の通り道と、一定間隔の姿勢
  let planGhost = null;
  function computePlanGhost() {
    const xs = ctrl.traj.xs;
    const tip = [], snaps = [];
    for (let i = 0; i < xs.length; i += 4) tip.push(TM.geometry(ctrl.md, xs[i]).pts[3]);
    const every = Math.round(0.15 / TS);
    for (let i = 0; i < xs.length; i += every) snaps.push(xs[i]);
    snaps.push(xs[xs.length - 1]);
    planGhost = { tip, snaps };
  }

  // ------------------------------------------------------------ 耐性試験
  // 掃引できる項目。levels は「やさしい → きびしい」の順。
  const SWEEP = {
    nth: { label: "角度の観測雑音 σθ", unit: "°", levels: [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3], apply: (c, v) => (c.noise.sth = v * DEG), cur: () => `${noiseUI.nth}°` },
    nx: { label: "台車位置の観測雑音 σx", unit: "mm", levels: [0.01, 0.1, 0.3, 1, 3, 10, 30], apply: (c, v) => (c.noise.sx = v / 1000), cur: () => `${noiseUI.nx.toPrecision(2)} mm` },
    nu: { label: "モーター出力の雑音 σu", unit: "m/s²", levels: [0.1, 1, 3, 10, 30, 60, 100], apply: (c, v) => (c.noise.su = v), cur: () => `${noiseUI.nu.toPrecision(2)} m/s²` },
    ppr: { label: "エンコーダの分解能", unit: "カウント/回転", levels: [65536, 16384, 4096, 1024, 512, 256, 128], apply: (c, v) => (c.reality.ppr = v), cur: () => (reality.ppr ? `${reality.ppr}` : "なし") },
    delay: { label: "むだ時間", unit: "ms", levels: [0, 4, 8, 12, 16, 20, 30, 40], apply: (c, v) => (c.reality.delay = Math.round(v / 2)), cur: () => `${reality.delay * 2} ms（補償${reality.comp ? "あり" : "なし"}）` },
    mass: { label: "質量のばらつき", unit: "%", levels: [0, 2, 5, 10, 15, 20, 30], apply: (c, v) => (c.reality.massErr = v / 100), cur: () => `±${(reality.massErr * 100).toFixed(0)}%` },
    len: { label: "長さのばらつき", unit: "%", levels: [0, 1, 2, 3, 5, 7, 10], apply: (c, v) => (c.reality.lenErr = v / 100), cur: () => `±${(reality.lenErr * 100).toFixed(1)}%` },
    fric: { label: "関節摩擦（実機/モデル）", unit: "倍", levels: [1, 1.5, 2, 3, 5, 10], apply: (c, v) => (c.reality.fric = v), cur: () => `×${reality.fric.toFixed(2)}` },
  };
  const trialCfg = () => ({ noise: { ...noise }, reality: { ...reality }, estimator, feedback, ekfQa });
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  $("holdSec").textContent = TC.HOLD;
  $("mc").addEventListener("click", () => {
    const N = 20, results = [];
    function* gen() {
      for (let i = 0; i < N; i++) { results.push(TC.runTrial(ctrl, trialCfg(), 1000 + i)); yield i + 1; }
    }
    setBusy("mc");
    job = runJob(gen(), {
      onYield: (n) => setStatus("mcStatus", `試行中… ${n} / ${N}`, "busy"),
      onDone: (_, cancelled) => {
        job = null;
        setBusy(null);
        const ok = results.filter((r) => r.success).length;
        const n = results.length;
        const lost = results.filter((r) => r.lost).length, hit = results.filter((r) => r.hit).length;
        setStatus("mcStatus",
          `${cancelled ? "（中止）" : ""}成功 <b>${ok} / ${n}</b>（${n ? Math.round((100 * ok) / n) : 0}%）` +
          `　倒れた ${lost}・レール端 ${hit}<br>追従中の角度ずれの最大値（中央値）${(median(results.map((r) => r.peakTrack)) / DEG).toFixed(2)}°`,
          ok === n ? "ok" : ok === 0 ? "bad" : "warn");
      },
    });
  });

  $("sweep").addEventListener("click", () => {
    const vid = $("sweepVar").value, sw = SWEEP[vid];
    const PER = 10;
    sweepData = { vid, cur: sw.cur(), pts: sw.levels.map((lv) => ({ lv, ok: 0, n: 0 })) };
    function* gen() {
      for (const p of sweepData.pts) {
        for (let i = 0; i < PER; i++) {
          const cfg = trialCfg();
          sw.apply(cfg, p.lv);
          const r = TC.runTrial(ctrl, cfg, 2000 + i);
          p.n++; if (r.success) p.ok++;
          yield p;
        }
      }
    }
    setBusy("mc");
    let count = 0;
    const total = sw.levels.length * PER;
    job = runJob(gen(), {
      onYield: () => { count++; setStatus("mcStatus", `掃引中… ${count} / ${total}`, "busy"); drawSweep(); },
      onDone: (_, cancelled) => {
        job = null;
        setBusy(null);
        let lim = null;
        for (const p of sweepData.pts) { if (p.n && p.ok / p.n >= 0.9) lim = p.lv; else break; }
        const limTxt = lim === null ? "最もやさしい水準でも届かなかった" : `${lim} ${sw.unit} まで`;
        setStatus("mcStatus", `${cancelled ? "（中止）" : ""}${sw.label}：成功率 90% 以上を保てたのは ${limTxt}（他の設定は今の値）。`, lim === null ? "bad" : "ok");
        drawSweep();
      },
    });
  });
  $("mcStop").addEventListener("click", () => job && job.cancel());

  function drawSweep() {
    if (!sweepCv || !C.ink) return;
    const { ctx, w, h } = fitCanvas(sweepCv);
    ctx.clearRect(0, 0, w, h);
    const L = 40, R = 16, T = 10, B = 34;
    ctx.font = "11px system-ui, sans-serif";
    if (!sweepData) {
      ctx.fillStyle = C.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("「掃引する」で、条件のきびしさと成功率の関係をここに描く", w / 2, h / 2);
      return;
    }
    const sw = SWEEP[sweepData.vid];
    const n = sweepData.pts.length;
    const X = (i) => L + ((i + 0.5) / n) * (w - L - R);
    const Y = (r) => T + (1 - r) * (h - T - B);
    ctx.strokeStyle = C.grid;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const r of [0, 0.5, 0.9, 1]) {
      ctx.beginPath();
      ctx.moveTo(L, Y(r)); ctx.lineTo(w - R, Y(r));
      ctx.stroke();
      ctx.fillText(`${Math.round(r * 100)}%`, L - 4, Y(r));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    sweepData.pts.forEach((p, i) => ctx.fillText(String(p.lv), X(i), h - B + 4));
    ctx.fillText(`${sw.label} [${sw.unit}]　→ きびしい　（今の設定：${sweepData.cur}）`, (L + w - R) / 2, h - 15);
    ctx.strokeStyle = C.ok;
    ctx.fillStyle = C.ok;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    sweepData.pts.forEach((p, i) => {
      if (!p.n) return;
      if (first) ctx.moveTo(X(i), Y(p.ok / p.n)); else ctx.lineTo(X(i), Y(p.ok / p.n));
      first = false;
    });
    ctx.stroke();
    sweepData.pts.forEach((p, i) => {
      if (!p.n) return;
      ctx.beginPath();
      ctx.arc(X(i), Y(p.ok / p.n), 4, 0, TAU);
      ctx.fill();
    });
  }

  // ------------------------------------------------------------ HUD
  function updateHud() {
    const b = $("badge");
    let cls = sim.mode, text;
    if (sim.mode === "pre") text = "下で静止（LQR）— ▶ で振り上げ";
    else if (sim.mode === "track") text = feedback ? "最適軌道を追従（時変 LQR）" : "計画した入力を流すだけ";
    else if (sim.mode === "hold") text = "倒立を維持（LQR）";
    else if (sim.mode === "recover") text = "倒れた → 立て直し中：揺れのエネルギーを抜いている";
    else text = autoRecover ? "失敗：倒れた" : "失敗：倒れた（自動の立て直しはオフ）";
    if (sim.mode === "pre" && sim.recovering) { cls = "recover"; text = "立て直し中：下で静止するのを待っている"; }
    if (sim.retries > 0 && sim.mode !== "pre") text += `（振り上げ直し ${sim.retries} 回目）`;
    if (sim.hitAt >= 0 && sim.t - sim.hitAt < 0.8) text += "・レール端に衝突";
    if (!running) cls = "paused";
    b.className = "badge " + cls;
    b.textContent = text;
    $("hudT").textContent = sim.t.toFixed(2) + " s";
    $("hudU").textContent = (sim.u >= 0 ? "+" : "") + sim.u.toFixed(1);
    $("hudX").textContent = (sim.s[0] >= 0 ? "+" : "") + sim.s[0].toFixed(3);
    let ee = 0;
    for (let j = 1; j < 4; j++) ee = Math.max(ee, Math.abs(sim.est[j] - sim.s[j]));
    $("hudE").textContent = (ee / DEG).toFixed(ee / DEG < 0.1 ? 3 : 2);
    const tau = sim.mode === "track" ? sim.tau / ctrl.T : sim.mode === "pre" ? 0 : 1;
    $("prog").style.width = (clamp(tau, 0, 1) * 100).toFixed(1) + "%";
  }

  // ------------------------------------------------------------ 既定パラメータの表
  function paramListHTML(sp) {
    const f = (a, d = 2) => a.map((v) => v.toFixed(d)).join(", ");
    return `<li>質量 m = [${f(sp.params.m)}] kg、長さ l = [${f(sp.params.l)}] m（一様な棒）</li>` +
      `<li>関節の粘性摩擦 d = [${f(sp.params.d, 3)}] N·m·s（固定）</li>` +
      `<li>制約：|x| ≤ ${sp.xmax} m、|ẋ| ≤ ${sp.vmax} m/s、|u| ≤ ${sp.umax} m/s²、振り上げ時間 T = ${sp.T} s</li>` +
      `<li>IPOPT（エルミート・シンプソン法、刻み 20 ms）での最適値 J = ${SEED.ipoptCost.toFixed(3)}、このプランナーで解き直した値 J = ${SEED.cost.toFixed(3)}</li>`;
  }

  // ------------------------------------------------------------ ループ
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running && sim) {
      acc += dt * speed;
      let n = 0;
      while (acc >= TS && n < 60) {
        sim.step();
        acc -= TS;
        n++;
        if (sim.k % 2 === 0) {
          hist.push({
            t: sim.t, th: [sim.s[1], sim.s[2], sim.s[3]], x: sim.s[0], u: sim.u,
            ref: sim.ref ? [sim.ref.s[1] + sim.ref.off[0], sim.ref.s[2] + sim.ref.off[1], sim.ref.s[3] + sim.ref.off[2], sim.ref.s[0], sim.ref.u] : null,
          });
        }
        if (sim.k % 4 === 0) {
          trail.push({ t: sim.t, p: TM.geometry(sim.md, sim.s).pts[3] });
        }
      }
      if (n >= 60) acc = 0;
      while (hist.length && hist[0].t < sim.t - SPAN - 0.2) hist.shift();
      while (trail.length && trail[0].t < sim.t - 1.2) trail.shift();
    }
    if (sim) {
      drawScene();
      drawPlots();
      drawPoles();
      updateHud();
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ 起動
  readColors();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);
  window.addEventListener("resize", () => { polesDirty = true; drawSweep(); });
  setParamUI(SEED.spec);
  adoptPlan(Planner.createProblem(SEED.spec), Float64Array.from(SEED.z), { msg: "既定パラメータの解（IPOPT の解を初期値に、このプランナーで解き直したもの）。" });
  if (/[?&]autoplay\b/.test(location.search)) sim.startSwing(); // ?autoplay で開いたらすぐ振り上げる
  refreshPlay();
  drawSweep();
  requestAnimationFrame(frame);
})();
