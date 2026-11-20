// ch2〜ch6 の図。figures.js の後に読む。数値は window.DATA から読む。
// スライダーで値を変えたときの再計算だけはここで行う（既定値では DATA と一致する）。
(function () {
  "use strict";
  const { S, T, svg, title, parts, makePendulum } = FIG._util;
  const get = (path) => path.split(".").reduce((o, k) => o[k], window.DATA);
  const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d).replace("-", "−");

  // ---- 座標軸 ----
  function axes(s, o) {
    const lx = o.xlog ? Math.log10 : (v) => v;
    const ly = o.ylog ? Math.log10 : (v) => v;
    const X = (v) => o.x0 + ((lx(v) - lx(o.xr[0])) / (lx(o.xr[1]) - lx(o.xr[0]))) * (o.x1 - o.x0);
    const Y = (v) => o.y0 - ((ly(v) - ly(o.yr[0])) / (ly(o.yr[1]) - ly(o.yr[0]))) * (o.y0 - o.y1);
    const g = S("g", {}, s);
    for (const t of o.xticks || []) {
      S("line", { x1: X(t), x2: X(t), y1: o.y0, y2: o.y1, class: "grid" }, g);
      T(g, X(t), o.y0 + 22, o.xfmt ? o.xfmt(t) : String(t).replace("-", "−"), { "font-size": 16, class: "muted", "text-anchor": "middle" });
    }
    for (const t of o.yticks || []) {
      S("line", { x1: o.x0, x2: o.x1, y1: Y(t), y2: Y(t), class: "grid" }, g);
      T(g, o.x0 - 8, Y(t) + 5, o.yfmt ? o.yfmt(t) : String(t).replace("-", "−"), { "font-size": 16, class: "muted", "text-anchor": "end" });
    }
    const ax = o.xAxisAt !== undefined ? Y(o.xAxisAt) : o.y0;
    const ay = o.yAxisAt !== undefined ? X(o.yAxisAt) : o.x0;
    S("line", { x1: o.x0, x2: o.x1, y1: ax, y2: ax, class: "axis" }, g);
    S("line", { x1: ay, x2: ay, y1: o.y0, y2: o.y1, class: "axis" }, g);
    if (o.xlabel) T(g, o.x1, ax - 8, o.xlabel, { "font-size": 18, class: "muted", "text-anchor": "end" });
    if (o.ylabel) T(g, ay + 8, o.y1 + 14, o.ylabel, { "font-size": 18, class: "muted" });
    const id = `clip${Math.random().toString(36).slice(2)}`;
    const cp = S("clipPath", { id }, s);
    S("rect", { x: o.x0, y: o.y1, width: o.x1 - o.x0, height: o.y0 - o.y1 }, cp);
    const plot = S("g", { "clip-path": `url(#${id})` }, s);
    return { X, Y, g, plot };
  }
  function pathD(xs, ys, X, Y) {
    let d = "", pen = false;
    for (let i = 0; i < xs.length; i++) {
      const x = X(xs[i]), y = Y(ys[i]);
      if (!isFinite(x) || !isFinite(y) || Math.abs(y) > 1e5) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    }
    return d;
  }
  function cross(parent, x, y, cls, size = 10) {
    const g = S("g", { class: cls || "stable-mark", transform: `translate(${x},${y})` }, parent);
    S("line", { x1: -size, y1: -size, x2: size, y2: size, "stroke-width": 4 }, g);
    S("line", { x1: -size, y1: size, x2: size, y2: -size, "stroke-width": 4 }, g);
    return g;
  }
  function ring(parent, x, y, cls, r = 10) {
    return S("circle", { cx: x, cy: y, r, fill: "#fff", "stroke-width": 3.5, class: cls || "stable-mark" }, parent);
  }
  function sliderRow(el, label, attrs) {
    const row = document.createElement("div");
    row.className = "controls-row interactive";
    row.innerHTML = `<span>${label}</span><input type="range"><span class="val"></span>`;
    const input = row.querySelector("input");
    for (const k in attrs) input.setAttribute(k, attrs[k]);
    el.appendChild(row);
    return { row, input, val: row.querySelector(".val") };
  }
  const markCls = (re) => (re >= -1e-9 ? "unstable" : "stable-mark");

  // ---- 複素平面上の極（×）と零点（○） ----
  // opts.sets: [{ label, poles: "ch2.Ptheta.poles" | [..], zeros, eig: "ch1.eig" }], opts.range: [re, im]
  FIG.polePlane = function (el, opts) {
    const P = parts();
    if (opts.title) title(el, opts.title);
    const sets = opts.sets;
    const W = 760, H = opts.height || 220 * sets.length;
    const s = svg(el, W, H);
    const [RE, IM] = opts.range || [8, 3];
    const h = H / sets.length;
    sets.forEach((set, k) => {
      const grp = P.add(S("g", {}, s), set.at || 1);
      const top = k * h + 10, bot = (k + 1) * h - 30;
      const a = axes(grp, { x0: 40, x1: W - 20, y0: bot, y1: top, xr: [-RE, RE], yr: [-IM, IM], xAxisAt: 0, yAxisAt: 0,
        xticks: opts.xticks || [-RE / 2, RE / 2], xlabel: "Re", ylabel: "Im" });
      S("rect", { x: 40, y: top, width: a.X(0) - 40, height: bot - top, class: "shade" }, a.g).parentNode.insertBefore(a.g.lastChild, a.g.firstChild);
      if (set.label) T(grp, 50, top + 26, set.label, { "font-size": 22 });
      const pts = (src) => (typeof src === "string" ? get(src) : src || []);
      const poles = set.eig ? pts(set.eig) : pts(set.poles).map((re) => ({ re, im: 0 }));
      const counts = {};
      for (const z of poles) {
        const key = `${z.re.toFixed(3)},${z.im.toFixed(3)}`;
        counts[key] = (counts[key] || 0) + 1;
        cross(grp, a.X(z.re), a.Y(z.im), markCls(z.re));
        if (counts[key] === 2) T(grp, a.X(z.re) + 10, a.Y(z.im) - 14, "2重", { "font-size": 17 });
      }
      for (const re of pts(set.zeros)) ring(grp, a.X(re), a.Y(0), re > 0 ? "unstable" : "stable-mark");
      for (const lab of set.labels || []) T(grp, a.X(lab.re), a.Y(lab.im || 0) - 18, lab.text, { "font-size": 18, "text-anchor": "middle", class: lab.cls || "" });
    });
    return { step: P.step };
  };

  // ---- ε-δ の図（模式図） ----
  FIG.epsDelta = function (el, opts) {
    const P = parts();
    const s = svg(el, 700, 520);
    const cx = 350, cy = 260;
    S("circle", { cx, cy, r: 210, class: "dash" }, s);
    S("circle", { cx, cy, r: 80, class: "dash" }, s);
    T(s, cx + 150, cy - 160, "ε", { class: "var", "font-size": 30 });
    T(s, cx + 50, cy - 70, "δ", { class: "var", "font-size": 30 });
    S("circle", { cx, cy, r: 5, fill: "var(--ink)" }, s);
    T(s, cx + 10, cy + 26, "0", { "font-size": 20 });
    // リアプノフ安定：出ていかないが収束もしない
    const orbit = [];
    for (let t = 0; t <= 6.3; t += 0.05) orbit.push(`${t ? "L" : "M"}${cx + 140 * Math.cos(t) + 20 * Math.cos(3 * t)},${cy + 110 * Math.sin(t)}`);
    const g1 = P.add(S("g", {}, s), 1, opts.asympAt ? opts.asympAt - 1 : Infinity);
    S("path", { d: orbit.join("") + "z", class: "curve" }, g1);
    S("circle", { cx: cx + 60, cy: cy + 30, r: 6, fill: "var(--accent)" }, g1);
    S("path", { d: `M${cx + 60},${cy + 30} Q${cx + 140},${cy + 40} ${cx + 160},${cy}`, class: "curve" }, g1);
    // 漸近安定：渦を巻いて原点へ
    const g2 = P.add(S("g", {}, s), opts.asympAt || 2);
    const sp = [];
    for (let t = 0; t <= 14; t += 0.05) {
      const r = 70 * Math.exp(-0.18 * t);
      sp.push(`${t ? "L" : "M"}${cx + r * Math.cos(t) * 1.6},${cy + r * Math.sin(t)}`);
    }
    S("path", { d: sp.join(""), class: "curve", style: "stroke:var(--accent)" }, g2);
    T(g2, 20, 500, "漸近安定：原点の近くから出た解は 0 に収束する", { "font-size": 20, style: "fill:var(--accent)" });
    return { step: P.step };
  };

  // ---- 2次式の根（ラウス・フルビッツの2次の場合） ----
  FIG.quadRoots = function (el) {
    const t = title(el, "");
    const W = 760, H = 380, R = 6;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 40, x1: W - 20, y0: H - 30, y1: 10, xr: [-R, R], yr: [-4, 4], xAxisAt: 0, yAxisAt: 0, xticks: [-4, -2, 2, 4], xlabel: "Re", ylabel: "Im" });
    a.g.insertBefore(S("rect", { x: 40, y: 10, width: a.X(0) - 40, height: H - 40, class: "shade" }), a.g.firstChild);
    const marks = [cross(s, 0, 0), cross(s, 0, 0)];
    const r1 = sliderRow(el, "a₁", { min: -4, max: 6, step: 0.1, value: 2 });
    const r0 = sliderRow(el, "a₀", { min: -4, max: 10, step: 0.1, value: 5 });
    function update() {
      const a1 = +r1.input.value, a0 = +r0.input.value;
      r1.val.textContent = fmt(a1, 1); r0.val.textContent = fmt(a0, 1);
      const disc = a1 * a1 - 4 * a0;
      const roots = disc >= 0
        ? [{ re: (-a1 + Math.sqrt(disc)) / 2, im: 0 }, { re: (-a1 - Math.sqrt(disc)) / 2, im: 0 }]
        : [{ re: -a1 / 2, im: Math.sqrt(-disc) / 2 }, { re: -a1 / 2, im: -Math.sqrt(-disc) / 2 }];
      roots.forEach((z, i) => {
        marks[i].setAttribute("transform", `translate(${a.X(Math.max(-R, Math.min(R, z.re)))},${a.Y(Math.max(-3.9, Math.min(3.9, z.im)))})`);
        marks[i].setAttribute("class", markCls(z.re));
      });
      const ok = a1 > 0 && a0 > 0;
      t.innerHTML = `s² + a₁s + a₀ の根：${ok ? "<span class='num'>a₁ > 0 かつ a₀ > 0</span> なので、根はどちらも ℂ₋ にある" : "<span style='color:var(--unstable)'>a₁ > 0 かつ a₀ > 0 が崩れ、根が ℂ₋ の外に出る</span>"}`;
    }
    r1.input.addEventListener("input", update);
    r0.input.addEventListener("input", update);
    update();
    return {};
  };

  // ---- 標準フィードバック系のブロック線図 ----
  FIG.feedbackDiagram = function (el, opts) {
    const P = parts();
    const s = svg(el, 1000, 360);
    const yM = 140;
    const box = (x, label, cls) => {
      const r = S("rect", { x, y: yM - 45, width: 130, height: 90, rx: 8, class: "box" + (cls ? " " + cls : "") }, s);
      T(s, x + 65, yM + 12, label, { class: "var", "font-size": 34, "text-anchor": "middle" });
      return r;
    };
    const sum = (x, signs) => {
      S("circle", { cx: x, cy: yM, r: 20, class: "box" }, s);
      T(s, x - 34, yM - 18, signs[0], { "font-size": 22 });
      T(s, x + 8, yM + 44, signs[1], { "font-size": 22 });
    };
    const w = (d, cls) => S("path", { d, class: "wire" + (cls ? " " + cls : ""), "marker-end": s.inkArrow }, s);
    T(s, 20, yM - 14, "r", { class: "var", "font-size": 30 });
    w(`M40,${yM} H158`);
    sum(180, ["+", "−"]);
    w(`M200,${yM} H296`);
    T(s, 238, yM - 14, "e", { class: "var", "font-size": 30 });
    box(300, "C");
    w(`M430,${yM} H538`);
    T(s, 470, yM - 14, "u", { class: "var", "font-size": 30 });
    sum(560, ["+", "+"]);
    const dPath = w(`M560,40 V${yM - 22}`);
    T(s, 572, 52, "d", { class: "var", "font-size": 30 });
    w(`M580,${yM} H666`);
    const Pbox = box(670, "P");
    w(`M800,${yM} H960`);
    T(s, 940, yM - 14, "y", { class: "var", "font-size": 30 });
    const fb = w(`M880,${yM} V280 H180 V${yM + 22}`);
    S("circle", { cx: 880, cy: yM, r: 5, fill: "var(--ink)" }, s);
    const lab = P.add(S("g", {}, s), opts.namesAt || 1);
    T(lab, 20, yM + 60, "参照信号", { "font-size": 18, class: "muted" });
    T(lab, 214, yM + 70, "偏差", { "font-size": 18, class: "muted" });
    T(lab, 600, 40, "外乱", { "font-size": 18, class: "muted" });
    T(lab, 360, 320, "L = PC：ループを一周する伝達関数", { "font-size": 20, class: "muted" });
    return {
      step(n) {
        P.step(n);
        const hd = opts.dAt && n >= opts.dAt;
        dPath.classList.toggle("hl", !!hd);
        Pbox.classList.toggle("hl", !!hd);
        fb.classList.toggle("hl", !!(opts.loopAt && n >= opts.loopAt));
      },
    };
  };

  // ---- 2次系のステップ応答 ----
  function step2(zeta, wn, t) {
    if (zeta < 1 - 1e-6) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      return 1 - (Math.exp(-zeta * wn * t) / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t + Math.acos(zeta));
    }
    if (zeta < 1 + 1e-6) return 1 - Math.exp(-wn * t) * (1 + wn * t);
    const r = Math.sqrt(zeta * zeta - 1), s1 = -wn * (zeta - r), s2 = -wn * (zeta + r);
    return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
  }
  FIG.stepResponse = function (el, opts) {
    const D = window.DATA.ch3.step;
    const P = parts();
    const t = title(el, "");
    const W = 760, H = 400;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 60, x1: W - 20, y0: H - 30, y1: 20, xr: [0, 2], yr: [0, 1.4], xticks: [0.5, 1, 1.5, 2], yticks: [0.5, 1], xlabel: "t [s]", ylabel: "y" });
    const band = P.add(S("rect", { x: 60, width: W - 80, y: a.Y(1.02), height: a.Y(0.98) - a.Y(1.02), class: "shade", style: "fill:var(--accent-soft)" }, a.plot), opts.annotateAt || 1);
    const curve = S("path", { class: "curve" }, a.plot);
    const ann = P.add(S("g", {}, s), opts.annotateAt || 1);
    const pk = S("line", { class: "dash" }, ann);
    const pkLab = T(ann, 0, 0, "", { "font-size": 18, style: "fill:var(--accent)" });
    const st = S("line", { class: "cursor" }, ann);
    const stLab = T(ann, 0, 0, "", { "font-size": 18, style: "fill:var(--accent)" });
    T(ann, W - 22, a.Y(1.02) - 6, "±2%", { "font-size": 16, class: "muted", "text-anchor": "end" });
    let zeta = D.zeta, wn = D.wn;
    function draw() {
      let ts, ys;
      if (zeta === D.zeta && wn === D.wn) { ts = D.t; ys = D.y; }
      else { ts = []; ys = []; for (let i = 0; i <= 1000; i++) { ts.push(i * 0.002); ys.push(step2(zeta, wn, i * 0.002)); } }
      curve.setAttribute("d", pathD(ts, ys, a.X, a.Y));
      let ip = 0;
      ys.forEach((y, i) => { if (y > ys[ip]) ip = i; });
      let is = 0;
      ys.forEach((y, i) => { if (Math.abs(y - 1) > 0.02) is = i + 1; });
      const os = ys[ip] - 1, tp = ts[ip], tsl = ts[Math.min(is, ts.length - 1)];
      const settled = is < ts.length;
      pk.setAttribute("x1", a.X(tp)); pk.setAttribute("x2", a.X(tp)); pk.setAttribute("y1", a.Y(0)); pk.setAttribute("y2", a.Y(ys[ip]));
      pkLab.setAttribute("x", a.X(tp) + 8); pkLab.setAttribute("y", a.Y(ys[ip]) - 8);
      pkLab.textContent = os > 0.001 ? `行き過ぎ ${(os * 100).toFixed(1)}%（t = ${tp.toFixed(2)} s）` : "行き過ぎなし";
      st.setAttribute("x1", a.X(tsl)); st.setAttribute("x2", a.X(tsl)); st.setAttribute("y1", a.Y(0)); st.setAttribute("y2", a.Y(1.3));
      st.style.display = settled ? "" : "none";
      stLab.setAttribute("x", Math.min(a.X(tsl) + 8, W - 170)); stLab.setAttribute("y", a.Y(1.3) + 4);
      stLab.textContent = settled ? `整定 ${tsl.toFixed(2)} s` : "2 s 以内に整定しない";
      t.innerHTML = `2次系のステップ応答　ζ = <span class="num">${zeta.toFixed(2)}</span>、ωₙ = <span class="num">${wn.toFixed(1)}</span>：行き過ぎ量 約${Math.round(Math.max(0, os) * 100)}%`;
    }
    if (opts.slidersAt) {
      const z = P.add(sliderRow(el, "ζ", { min: 0.1, max: 1.5, step: 0.01, value: D.zeta }).row, opts.slidersAt);
      const w = P.add(sliderRow(el, "ωₙ", { min: 2, max: 16, step: 0.1, value: D.wn }).row, opts.slidersAt);
      const zi = z.querySelector("input"), wi = w.querySelector("input");
      const upd = () => { zeta = +zi.value; wn = +wi.value; z.querySelector(".val").textContent = zeta.toFixed(2); w.querySelector(".val").textContent = `${wn.toFixed(1)} rad/s`; draw(); };
      zi.addEventListener("input", upd); wi.addEventListener("input", upd);
      upd();
    } else draw();
    return { step: P.step };
  };

  // ---- 根軌跡（k_d 固定、k_p を動かす） ----
  FIG.rootLocus = function (el, opts) {
    const D = window.DATA.ch3.pd;
    const t = title(el, "");
    const W = 760, H = 420;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 40, x1: W - 20, y0: H - 30, y1: 10, xr: [-10, 6], yr: [-8, 8], xAxisAt: 0, yAxisAt: 0, xticks: [-8, -4, 4], yticks: [-4, 4], xlabel: "Re", ylabel: "Im" });
    a.g.insertBefore(S("rect", { x: 40, y: 10, width: a.X(0) - 40, height: H - 40, class: "shade" }), a.g.firstChild);
    const roots = (kp) => {
      const a1 = D.b * D.kd, a0 = D.b * kp - D.p2, disc = a1 * a1 - 4 * a0;
      return disc >= 0 ? [[(-a1 + Math.sqrt(disc)) / 2, 0], [(-a1 - Math.sqrt(disc)) / 2, 0]] : [[-a1 / 2, Math.sqrt(-disc) / 2], [-a1 / 2, -Math.sqrt(-disc) / 2]];
    };
    // 軌跡全体（k_p = 0〜60）を薄く描く
    const br = [[], []];
    for (let kp = 0; kp <= 60; kp += 0.05) roots(kp).sort((u, v) => v[1] - u[1] || v[0] - u[0]).forEach((r, i) => br[i].push(r));
    for (const b of br) S("path", { d: pathD(b.map((r) => r[0]), b.map((r) => r[1]), a.X, a.Y), class: "curve", style: "stroke:var(--muted);stroke-width:3;opacity:.55" }, a.plot);
    T(s, a.X(0) + 6, a.Y(0) + 26, `k_p = ${D.kp_min}`, { "font-size": 16, class: "muted" });
    T(s, a.X(-D.b * D.kd / 2) - 30, a.Y(0) + 26, `k_p = ${D.kp_double}`, { "font-size": 16, class: "muted" });
    const marks = [cross(s, 0, 0), cross(s, 0, 0)];
    const r = sliderRow(el, "k_p", { min: 0, max: 60, step: 0.1, value: D.kp });
    function update() {
      const kp = +r.input.value;
      const rs = roots(kp);
      rs.forEach((z, i) => {
        marks[i].setAttribute("transform", `translate(${a.X(z[0])},${a.Y(z[1])})`);
        marks[i].setAttribute("class", markCls(z[0]));
      });
      r.val.textContent = kp.toFixed(1);
      const unstable = rs.some((z) => z[0] >= 0);
      t.innerHTML = `閉ループ極（k_d = ${D.kd}）：` + (unstable
        ? `<span style="color:var(--unstable)">k_p < ${D.kp_min} なので正の実根があり、倒れる</span>`
        : `${rs.map((z) => `${fmt(z[0])}${z[1] ? ` ± ${fmt(Math.abs(z[1]))}j` : ""}`).filter((v, i, arr) => arr.indexOf(v) === i).join("、 ")}`);
    }
    r.input.addEventListener("input", update);
    update();
    return {};
  };

  // ---- 台車と振り子の数値解のアニメーション（1台または2台を並べる） ----
  // opts.sims: [{ data: "ch3.pdSim", label }]
  FIG.cartAnim = function (el, opts) {
    const sims = opts.sims.map((o) => Object.assign({}, o, { d: get(o.data) }));
    const prm = window.DATA.ch1.params;
    const P = parts();
    if (opts.title) title(el, opts.title);
    const W = 760, laneH = 130;
    const s = svg(el, W, laneH * sims.length + 10);
    const k = 160; // px / m
    const x0 = 120;
    const lanes = sims.map((sm, i) => {
      const gy = laneH * (i + 1) - 10;
      S("line", { x1: 10, y1: gy, x2: W - 10, y2: gy, class: "ground" }, s);
      for (let m = 0; m * k + x0 < W; m++) {
        S("line", { x1: x0 + m * k, x2: x0 + m * k, y1: gy, y2: gy + 8, class: "axis" }, s);
      }
      T(s, 14, gy - laneH + 40, sm.label, { "font-size": 22, style: sm.accent ? "fill:var(--accent)" : "" });
      const pend = makePendulum(s, { groundY: gy, cartW: 70, cartH: 28, wheelR: 7, bobR: 9 });
      return { sm, pend };
    });
    // x(t) と θ(t)
    const tEnd = sims[0].d.t[sims[0].d.t.length - 1];
    const plots = document.createElement("div");
    el.appendChild(plots);
    const ps = svg(plots, W, 190);
    const xmax = Math.max(...sims.map((sm) => Math.max(...sm.d.x.map(Math.abs))));
    const ax1 = axes(ps, { x0: 60, x1: 360, y0: 165, y1: 15, xr: [0, tEnd], yr: [-0.2, Math.max(0.5, xmax * 1.1)], xAxisAt: 0, xticks: [2, 4, 6].filter((v) => v < tEnd), yticks: [0.5, 1, 1.5, 2].filter((v) => v < xmax * 1.1), xlabel: "t", ylabel: "x [m]" });
    const ax2 = axes(ps, { x0: 440, x1: 740, y0: 165, y1: 15, xr: [0, tEnd], yr: [-0.15, 0.25], xAxisAt: 0, xticks: [2, 4, 6].filter((v) => v < tEnd), yticks: [0.1, 0.2], xlabel: "t", ylabel: "θ [rad]" });
    for (const sm of sims) {
      const st = sm.accent ? "stroke:var(--accent)" : "stroke:var(--muted)";
      S("path", { d: pathD(sm.d.t, sm.d.x, ax1.X, ax1.Y), class: "curve", style: st }, ax1.plot);
      S("path", { d: pathD(sm.d.t, sm.d.theta, ax2.X, ax2.Y), class: "curve", style: st }, ax2.plot);
    }
    const cur = [S("line", { class: "cursor", y1: 165, y2: 15 }, ps), S("line", { class: "cursor", y1: 165, y2: 15 }, ps)];
    const tl = T(s, W - 16, 30, "", { "font-size": 20, class: "muted", "text-anchor": "end" });
    const row = document.createElement("div");
    row.className = "controls-row interactive";
    row.innerHTML = `<button type="button">もう一度</button><span class="val muted" style="font-size:18px">θ(0) = 0.2 rad、実時間で再生</span>`;
    el.appendChild(row);
    function draw(i) {
      for (const ln of lanes) {
        const d = ln.sm.d;
        const j = Math.min(i, d.t.length - 1);
        ln.pend.set(x0 + d.x[j] * k, d.theta[j], prm.l * k * 0.75);
      }
      const t = sims[0].d.t[Math.min(i, sims[0].d.t.length - 1)];
      cur[0].setAttribute("x1", ax1.X(t)); cur[0].setAttribute("x2", ax1.X(t));
      cur[1].setAttribute("x1", ax2.X(t)); cur[1].setAttribute("x2", ax2.X(t));
      tl.textContent = `t = ${t.toFixed(1)} s`;
    }
    let raf = 0;
    function play() {
      cancelAnimationFrame(raf);
      const t0 = performance.now(), dt = sims[0].d.dt, n = sims[0].d.t.length;
      const loop = (now) => {
        const i = Math.min(n - 1, Math.round((now - t0) / 1000 / dt));
        draw(i);
        if (i < n - 1) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    row.querySelector("button").addEventListener("click", play);
    draw(0);
    let started = false;
    return {
      step(n) { P.step(n); if (!started && n >= (opts.playAt || 1)) { started = true; setTimeout(play, 500); } },
      destroy() { cancelAnimationFrame(raf); },
    };
  };

  // ---- 正弦波を入れたときの定常応答（2次系） ----
  FIG.sineResponse = function (el) {
    const D = window.DATA.ch3.step;
    const t = title(el, "");
    const W = 760, H = 330;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 50, x1: W - 20, y0: H - 30, y1: 20, xr: [0, 4], yr: [-2.2, 2.2], xAxisAt: 0, yticks: [-1, 1], xlabel: "周期", ylabel: "" });
    const inp = S("path", { class: "curve lin" }, a.plot);
    const out = S("path", { class: "curve", style: "stroke:var(--accent)" }, a.plot);
    T(s, 60, 44, "破線：入力 sin ωt", { "font-size": 17, class: "muted" });
    T(s, 60, 68, "実線：出力（過渡項が消えたあと）", { "font-size": 17, style: "fill:var(--accent)" });
    const r = sliderRow(el, "ω", { min: Math.log10(0.5), max: Math.log10(64), step: 0.005, value: Math.log10(4) });
    function update() {
      const w = 10 ** +r.input.value;
      const re = D.wn ** 2 - w * w, im = 2 * D.zeta * D.wn * w;
      const mag = D.wn ** 2 / Math.hypot(re, im), ph = -Math.atan2(im, re);
      const xs = [], yi = [], yo = [];
      for (let i = 0; i <= 400; i++) {
        const c = (4 * i) / 400; // 周期の数
        xs.push(c); yi.push(Math.sin(2 * Math.PI * c)); yo.push(mag * Math.sin(2 * Math.PI * c + ph));
      }
      inp.setAttribute("d", pathD(xs, yi, a.X, a.Y));
      out.setAttribute("d", pathD(xs, yo, a.X, a.Y));
      r.val.textContent = `${w.toFixed(2)} rad/s`;
      t.innerHTML = `G(jω) のゲイン <span class="num">${mag.toFixed(2)}</span>（${(20 * Math.log10(mag)).toFixed(1)} dB）、位相 <span class="num">${(ph * 180 / Math.PI).toFixed(0)}°</span>`;
    }
    r.input.addEventListener("input", update);
    update();
    return {};
  };

  // ---- ボード線図とナイキスト線図（ω のスライダーで連動、ゲインの倍率も変えられる） ----
  // opts: bode, nyquist（表示するか）、omegaAt, gainAt, marginsAt, kd0At（k_d = 0 の線分を見せる）
  function winding(re, im) {
    // ω < 0（共役を逆順）→ ω > 0 で閉じた曲線が −1 を反時計回りに回る回数
    const xs = re.slice().reverse().concat(re), ys = im.slice().reverse().map((v) => -v).concat(im);
    let tot = 0;
    for (let i = 1; i <= xs.length; i++) {
      const j = i % xs.length;
      const a0 = Math.atan2(ys[i - 1], xs[i - 1] + 1), a1 = Math.atan2(ys[j], xs[j] + 1);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      tot += d;
    }
    return Math.round(tot / (2 * Math.PI));
  }
  FIG.bodeNyquist = function (el, opts) {
    const D = window.DATA.ch4;
    const P = parts();
    const t = title(el, "");
    const both = opts.bode && opts.nyquist;
    const W = both ? 1400 : 760;
    const H = both ? 420 : opts.bode ? 470 : 470;
    const s = svg(el, W, H);
    let bode = null, nyq = null;
    if (opts.bode) {
      const bx0 = 70, bx1 = both ? 640 : W - 20;
      const mid = H / 2;
      const m = axes(s, { x0: bx0, x1: bx1, y0: mid - 20, y1: 10, xr: [0.1, 316], xlog: true, yr: [-40, 30], xticks: [0.1, 1, 10, 100], yticks: [-20, 0, 20], xfmt: () => "", xlabel: "", ylabel: "ゲイン [dB]" });
      const ph = axes(s, { x0: bx0, x1: bx1, y0: H - 30, y1: mid + 10, xr: [0.1, 316], xlog: true, yr: [-200, -60], xticks: [0.1, 1, 10, 100], yticks: [-180, -135, -90], xlabel: "ω [rad/s]", ylabel: "位相 [°]" });
      const magP = S("path", { class: "curve" }, m.plot);
      const phP = S("path", { class: "curve" }, ph.plot);
      const z0 = S("line", { x1: bx0, x2: bx1, y1: m.Y(0), y2: m.Y(0), class: "axis" }, m.g);
      const vline = [S("line", { class: "cursor" }, s), S("line", { class: "cursor" }, s)];
      const mg = P.add(S("g", {}, s), opts.marginsAt || Infinity);
      S("line", { x1: bx0, x2: bx1, y1: ph.Y(-180), y2: ph.Y(-180), class: "dash" }, mg);
      S("line", { x1: ph.X(D.wc), x2: ph.X(D.wc), y1: ph.Y(-180), y2: ph.Y(D.pm - 180), style: "stroke:var(--accent);stroke-width:5" }, mg);
      T(mg, ph.X(D.wc) + 10, ph.Y(-160), `位相余裕 ${D.pm.toFixed(0)}°`, { "font-size": 18, style: "fill:var(--accent)" });
      S("circle", { cx: m.X(D.wc), cy: m.Y(0), r: 6, fill: "var(--accent)" }, mg);
      T(mg, m.X(D.wc) + 8, m.Y(0) - 10, `ω_c ≈ ${D.wc.toFixed(1)}`, { "font-size": 18, style: "fill:var(--accent)" });
      bode = { m, ph, magP, phP, vline, z0 };
    }
    if (opts.nyquist) {
      const nx0 = both ? 720 : 60, nx1 = W - 20;
      const R = opts.nyRange || [-5, 1.5, -2.6, 2.6];
      const a = axes(s, { x0: nx0, x1: nx1, y0: H - 30, y1: 10, xr: [R[0], R[1]], yr: [R[2], R[3]], xAxisAt: 0, yAxisAt: 0, xticks: [-4, -3, -2, -1, 1], yticks: [-2, -1, 1, 2], xlabel: "Re", ylabel: "Im" });
      const unit = P.add(S("circle", { cx: a.X(0), cy: a.Y(0), r: a.X(1) - a.X(0), class: "dash" }, a.plot), opts.marginsAt || Infinity);
      const neg = S("path", { class: "curve" }, a.plot);
      const pos = S("path", { class: "curve" }, a.plot);
      const seg = P.add(S("line", { y1: a.Y(0), y2: a.Y(0), style: "stroke:var(--unstable);stroke-width:6" }, a.plot), opts.kd0At || Infinity);
      cross(s, a.X(-1), a.Y(0), "unstable", 7);
      T(s, a.X(-1) - 36, a.Y(0) - 12, "−1", { "font-size": 18, style: "fill:var(--unstable)" });
      const l0 = T(s, 0, 0, "", { "font-size": 17, class: "muted" });
      const dot = S("circle", { r: 8, fill: "var(--accent)" }, s);
      const mg = P.add(S("g", {}, s), opts.marginsAt || Infinity);
      const pmArc = S("path", { class: "arrow", style: "stroke-width:4" }, mg);
      const pmLab = T(mg, 0, 0, "", { "font-size": 18, style: "fill:var(--accent)" });
      const arrows = [S("path", { class: "arrowhead" }, s), S("path", { class: "arrowhead" }, s)];
      nyq = { a, neg, pos, seg, dot, l0, pmArc, pmLab, arrows, unit };
    }
    let k = 1, wi = D.w.findIndex((w) => w >= D.wc);
    const readout = document.createElement("div");
    readout.className = "controls-row";
    readout.style.fontSize = "20px";
    function arrowAt(tri, xs, ys, i, X, Y, dir) {
      const x = X(xs[i]), y = Y(ys[i]), x2 = X(xs[i + dir]), y2 = Y(ys[i + dir]);
      const ang = Math.atan2(y2 - y, x2 - x);
      const p = (r, a) => `${x + r * Math.cos(ang + a)},${y + r * Math.sin(ang + a)}`;
      tri.setAttribute("d", `M${p(12, 0)} L${p(10, 2.5)} L${p(10, -2.5)} Z`);
    }
    function draw() {
      const re = D.re.map((v) => v * k), im = D.im.map((v) => v * k);
      if (bode) {
        bode.magP.setAttribute("d", pathD(D.w, D.magdB.map((v) => v + 20 * Math.log10(k)), bode.m.X, bode.m.Y));
        bode.phP.setAttribute("d", pathD(D.w, D.phase, bode.ph.X, bode.ph.Y));
        const x = bode.m.X(D.w[wi]);
        for (const [ln, ax] of [[bode.vline[0], bode.m], [bode.vline[1], bode.ph]]) {
          ln.setAttribute("x1", x); ln.setAttribute("x2", x); ln.setAttribute("y1", ax === bode.m ? 10 : H / 2 + 10); ln.setAttribute("y2", ax === bode.m ? H / 2 - 20 : H - 30);
        }
      }
      if (nyq) {
        const { a } = nyq;
        nyq.pos.setAttribute("d", pathD(re, im, a.X, a.Y));
        nyq.neg.setAttribute("d", pathD(re, im.map((v) => -v), a.X, a.Y));
        const N = winding(re, im);
        const stable = N === 1;
        nyq.pos.style.stroke = nyq.neg.style.stroke = stable ? "" : "var(--unstable)";
        const iMid = D.w.findIndex((w) => w >= 6);
        arrowAt(nyq.arrows[0], re, im, iMid, a.X, a.Y, 1);
        arrowAt(nyq.arrows[1], re, im.map((v) => -v), iMid, a.X, a.Y, -1);
        nyq.l0.setAttribute("x", a.X(re[0]) - 10); nyq.l0.setAttribute("y", a.Y(-1.35));
        nyq.l0.textContent = `ω = 0：L(0) ≈ ${fmt(D.L0 * k)}`;
        nyq.dot.setAttribute("cx", a.X(re[wi])); nyq.dot.setAttribute("cy", a.Y(im[wi]));
        nyq.dot.style.display = opts.omegaAt ? "" : "none";
        // k_d = 0 のときは L(jω) = b k_p /(−ω² − p²) で、実軸上の線分 [L(0), 0) になる
        nyq.seg.setAttribute("x1", a.X(-D.b * D.kp / D.p2)); nyq.seg.setAttribute("x2", a.X(0));
        // 位相余裕の弧
        const ang = Math.atan2(D.im[D.w.findIndex((w) => w >= D.wc)], D.re[D.w.findIndex((w) => w >= D.wc)]);
        const r0 = a.X(1) - a.X(0);
        nyq.pmArc.setAttribute("d", `M${a.X(-1)},${a.Y(0)} A${r0},${r0} 0 0 0 ${a.X(Math.cos(ang))},${a.Y(Math.sin(ang))}`);
        nyq.pmLab.setAttribute("x", a.X(-0.9)); nyq.pmLab.setAttribute("y", a.Y(-1.15));
        nyq.pmLab.textContent = `位相余裕 ${D.pm.toFixed(0)}°`;
        const gainPart = opts.gainAt ? `ゲイン ${k.toFixed(2)} 倍（${(20 * Math.log10(k)).toFixed(1)} dB）：` : "";
        t.innerHTML = opts.titleFn ? opts.titleFn(D) : `${gainPart}−1 を反時計回りに <span class="num">${N}</span> 回、P = 1 なので ` +
          (stable ? `<span class="num">閉ループは安定</span>` : `<span style="color:var(--unstable)">閉ループは不安定</span>`);
      } else {
        t.innerHTML = opts.titleFn(D);
      }
      const L = { re: re[wi], im: im[wi] };
      readout.textContent = `ω = ${D.w[wi].toFixed(2)} rad/s　|L| = ${(20 * Math.log10(Math.hypot(L.re, L.im))).toFixed(1)} dB　arg L = ${D.phase[wi].toFixed(0)}°`;
    }
    if (opts.omegaAt) {
      const r = sliderRow(el, "ω", { min: 0, max: D.w.length - 1, step: 1, value: wi });
      P.add(r.row, opts.omegaAt);
      r.val.style.display = "none";
      r.input.addEventListener("input", () => { wi = +r.input.value; draw(); });
      P.add(readout, opts.omegaAt);
      el.appendChild(readout);
    }
    if (opts.gainAt) {
      const r = sliderRow(el, "ゲインの倍率", { min: Math.log10(0.1), max: Math.log10(3), step: 0.002, value: 0 });
      P.add(r.row, opts.gainAt);
      r.input.addEventListener("input", () => { k = 10 ** +r.input.value; r.val.textContent = `${k.toFixed(2)} 倍`; draw(); });
      r.val.textContent = "1.00 倍";
    }
    draw();
    return { step: P.step };
  };

  // ---- ナイキストの証明の閉曲線 ----
  FIG.contour = function (el, opts) {
    const P = parts();
    const s = svg(el, 700, 520);
    const a = axes(s, { x0: 40, x1: 680, y0: 500, y1: 20, xr: [-3, 5], yr: [-3, 3], xAxisAt: 0, yAxisAt: 0, xlabel: "Re s", ylabel: "Im s" });
    const R = 2.6;
    S("path", { d: `M${a.X(0)},${a.Y(-R)} L${a.X(0)},${a.Y(R)} A${a.X(R) - a.X(0)},${a.Y(-R) - a.Y(0)} 0 0 1 ${a.X(0)},${a.Y(-R)}`, class: "arrow", style: "fill:var(--accent-soft);fill-opacity:.5" }, s);
    S("path", { d: `M${a.X(0)},${a.Y(-0.4)} L${a.X(0)},${a.Y(0.6)}`, class: "arrow", "marker-end": s.arrow }, s);
    T(s, a.X(0) + 10, a.Y(1.4), "ω：−∞ → +∞", { "font-size": 20, style: "fill:var(--accent)" });
    T(s, a.X(R * 0.7) + 20, a.Y(R * 0.75), "半径 R", { "font-size": 20, style: "fill:var(--accent)" });
    T(s, a.X(0.4), a.Y(-1.9), "時計回り", { "font-size": 20, style: "fill:var(--accent)" });
    const g = P.add(S("g", {}, s), opts.marksAt || 1);
    cross(g, a.X(1.2), a.Y(0), "unstable");
    T(g, a.X(1.2) - 40, a.Y(0) - 18, "L の極（P 個）", { "font-size": 18, style: "fill:var(--unstable)" });
    ring(g, a.X(0.8), a.Y(1.2), "unstable");
    T(g, a.X(0.8) + 14, a.Y(1.2) - 12, "1 + L の零点（Z 個）", { "font-size": 18, style: "fill:var(--unstable)" });
    return { step: P.step };
  };

  // ---- ループ整形の考え方（模式図、数値なし） ----
  FIG.loopShape = function (el, opts) {
    const P = parts();
    const s = svg(el, 760, 420);
    const a = axes(s, { x0: 60, x1: 740, y0: 390, y1: 20, xr: [0.1, 1000], xlog: true, yr: [-60, 60], xticks: [], yticks: [0], xlabel: "log ω", ylabel: "|L| [dB]" });
    const g1 = P.add(S("g", {}, s), 1);
    S("rect", { x: a.X(0.1), y: a.Y(20), width: a.X(2) - a.X(0.1), height: a.Y(-60) - a.Y(20), class: "shade", style: "fill:#f3e3e3" }, g1);
    T(g1, a.X(0.12), a.Y(-40), "低い周波数：|L| を大きく", { "font-size": 18 });
    T(g1, a.X(0.12), a.Y(-48) + 10, "（追従と外乱の抑制）", { "font-size": 16, class: "muted" });
    const g2 = P.add(S("g", {}, s), opts.highAt || 2);
    S("rect", { x: a.X(100), y: a.Y(60), width: a.X(1000) - a.X(100), height: a.Y(-15) - a.Y(60), class: "shade", style: "fill:#f3e3e3" }, g2);
    T(g2, a.X(110), a.Y(48), "高い周波数：|L| を小さく", { "font-size": 18 });
    T(g2, a.X(110), a.Y(40) + 10, "（雑音、モデルの誤差）", { "font-size": 16, class: "muted" });
    const g3 = P.add(S("g", {}, s), opts.highAt || 2);
    const xs = [], ys = [];
    for (let e = -1; e <= 3; e += 0.02) { const w = 10 ** e; xs.push(w); ys.push(40 - 20 * Math.log10(1 + w / 0.5) - 20 * Math.log10(1 + w / 60)); }
    S("path", { d: pathD(xs, ys, a.X, a.Y), class: "curve", style: "stroke:var(--accent)" }, g3);
    T(g3, a.X(9), a.Y(0) - 12, "交差：ω が10倍で20 dB の割合で下げる", { "font-size": 16, style: "fill:var(--accent)" });
    return { step: P.step };
  };

  // ---- 状態フィードバック（オブザーバつき） ----
  FIG.stateFeedback = function (el, opts) {
    const P = parts();
    const s = svg(el, 900, 420);
    const box = (x, y, w, label, g) => {
      const r = S("rect", { x, y, width: w, height: 80, rx: 8, class: "box" }, g);
      T(g, x + w / 2, y + 50, label, { class: "var", "font-size": 28, "text-anchor": "middle" });
      return r;
    };
    const w = (d, g, cls) => S("path", { d, class: "wire" + (cls ? " " + cls : ""), "marker-end": s.inkArrow }, g);
    box(320, 40, 260, "ż = Az + Bu", s);
    w("M120,80 H316", s);
    T(s, 150, 66, "u", { class: "var", "font-size": 28 });
    const direct = P.add(S("g", {}, s), 1, opts.observerAt ? opts.observerAt - 1 : Infinity);
    w("M580,80 H780 V340 H560", direct);
    T(direct, 640, 66, "z（すべて測れるとする）", { "font-size": 20 });
    box(380, 300, 180, "−K", direct);
    w("M380,340 H120 V84", direct, "");
    const obs = P.add(S("g", {}, s), opts.observerAt || Infinity);
    w("M580,80 H840", obs);
    T(obs, 600, 66, "y = Cz", { class: "var", "font-size": 24 });
    box(560, 200, 260, "オブザーバ", obs);
    w("M820,80 V196", obs);
    w("M200,80 V240 H556", obs);
    T(obs, 660, 315, "ẑ", { class: "var", "font-size": 28 });
    w("M690,280 V340 H564", obs);
    box(380, 300, 180, "−K", obs);
    w("M380,340 H120 V84", obs);
    return { step: P.step };
  };

  // ---- 極配置：4つの極をスライダーで選び、アッカーマンの公式で K を計算する ----
  function solve(Am, bv) {
    const n = bv.length, M = Am.map((r, i) => r.concat([bv[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  const mm = (X, Y) => X.map((r) => Y[0].map((_, j) => r.reduce((s, v, k) => s + v * Y[k][j], 0)));
  function ackermann(A, B, poles) {
    const n = A.length;
    let c = [1];
    for (const p of poles) c = c.concat([0]).map((v, i) => v - p * (c[i - 1] || 0)); // (s − p) を順に掛ける
    // c は s^n の係数から順。χ(A) = Σ c_i A^{n−i}
    const I = A.map((r, i) => r.map((_, j) => +(i === j)));
    const pw = [I];
    for (let k = 1; k <= n; k++) pw.push(mm(pw[k - 1], A));
    const chi = I.map((r, i) => r.map((_, j) => c.reduce((s, ci, k) => s + ci * pw[n - k][i][j], 0)));
    const ctrl = [];
    let v = B.map((r) => r[0]);
    for (let k = 0; k < n; k++) { ctrl.push(v); v = A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0)); }
    // 𝒞 の列は ctrl[k]。e_nᵀ 𝒞⁻¹ = qᵀ、𝒞ᵀ q = e_n
    const Ct = ctrl; // 𝒞ᵀ の行 = 𝒞 の列
    const q = solve(Ct, Array.from({ length: n }, (_, i) => +(i === n - 1)));
    return chi[0].map((_, j) => q.reduce((s, qi, i) => s + qi * chi[i][j], 0));
  }
  FIG.polePlace = function (el, opts) {
    const D = window.DATA.ch5a;
    const t = title(el, "");
    const W = 760, H = 230;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 40, x1: W - 20, y0: H - 30, y1: 10, xr: [-10, 2], yr: [-1, 1], xAxisAt: 0, yAxisAt: 0, xticks: [-8, -6, -4, -2], xlabel: "Re" });
    a.g.insertBefore(S("rect", { x: 40, y: 10, width: a.X(0) - 40, height: H - 40, class: "shade" }), a.g.firstChild);
    const marks = D.poles.map(() => cross(s, 0, 0));
    const rows = D.poles.map((p, i) => sliderRow(el, `λ${"₁₂₃₄"[i]}`, { min: -10, max: -0.5, step: 0.1, value: p }));
    const kOut = document.createElement("div");
    kOut.className = "b-math";
    el.appendChild(kOut);
    function update() {
      const poles = rows.map((r) => +r.input.value);
      rows.forEach((r, i) => { r.val.textContent = fmt(poles[i], 1); marks[i].setAttribute("transform", `translate(${a.X(poles[i])},${a.Y(0)})`); });
      const same = poles.every((p, i) => p === D.poles[i]);
      const K = same ? D.K : ackermann(D.A, D.B, poles);
      katex.render(`K \\approx (${K.map((v) => fmt(v)).join(",\\ ")})`, kOut, { displayMode: true, throwOnError: false });
      t.innerHTML = `極を置く：台車の位置への係数 <span class="num">${fmt(K[0])}</span>、角度への係数 <span class="num">${fmt(K[2])}</span>`;
    }
    rows.forEach((r) => r.input.addEventListener("input", update));
    update();
    return {};
  };

  // ---- LQR のループのナイキスト線図と、−1 を中心とする単位円 ----
  FIG.lqrNyquist = function (el) {
    const D = window.DATA.ch5b.loop;
    title(el, `入力で切ったループ：|1 + L(jω)| の最小値 <span class="num">${D.minDist.toFixed(2)}</span>`);
    const W = 760, H = 470;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 50, x1: W - 20, y0: H - 30, y1: 10, xr: [-4, 2], yr: [-2.6, 2.6], xAxisAt: 0, yAxisAt: 0, xticks: [-3, -2, -1, 1], yticks: [-2, -1, 1, 2], xlabel: "Re", ylabel: "Im" });
    S("circle", { cx: a.X(-1), cy: a.Y(0), r: a.X(0) - a.X(-1), class: "shade", style: "fill:#f3e3e3" }, a.plot);
    T(s, a.X(-1.6), a.Y(0.35), "曲線が入れない円", { "font-size": 17 });
    S("path", { d: pathD(D.re, D.im, a.X, a.Y), class: "curve", style: "stroke:var(--accent)" }, a.plot);
    S("path", { d: pathD(D.re, D.im.map((v) => -v), a.X, a.Y), class: "curve", style: "stroke:var(--accent)" }, a.plot);
    cross(s, a.X(-1), a.Y(0), "unstable", 7);
    return {};
  };

  // ---- ボードの感度積分 ----
  FIG.sensIntegral = function (el, opts) {
    const D = window.DATA.ch6;
    const P = parts();
    const t = title(el, `log|S(jω)| の面積の合計 = <span class="num">${D.integral.toFixed(2)}</span> = πp`);
    const W = 760, H = 380, wmax = 200;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 60, x1: W - 20, y0: H - 30, y1: 20, xr: [0, wmax], yr: [-1.2, 0.6], xAxisAt: 0, xticks: [50, 100, 150, 200], yticks: [-1, -0.5, 0.5], xlabel: "ω [rad/s]", ylabel: "log|S|" });
    const n = D.w.findIndex((w) => w > wmax);
    const ws = D.w.slice(0, n), ls = D.logS.slice(0, n);
    const area = (f) => `M${a.X(0)},${a.Y(0)}` + ws.map((w, i) => `L${a.X(w).toFixed(1)},${a.Y(f(ls[i])).toFixed(1)}`).join("") + `L${a.X(ws[n - 1])},${a.Y(0)}Z`;
    S("path", { d: area((v) => Math.min(v, 0)), style: "fill:var(--accent-soft)" }, a.plot);
    const posA = P.add(S("path", { d: area((v) => Math.max(v, 0)), style: "fill:#f3e3e3" }, a.plot), opts.posAt || 1);
    S("path", { d: pathD(ws, ls, a.X, a.Y), class: "curve" }, a.plot);
    T(s, a.X(14), a.Y(-0.75), `外乱を抑える側 ${fmt(D.neg)}`, { "font-size": 18, style: "fill:var(--accent)" });
    const pl = P.add(T(s, a.X(60), a.Y(0.45), `増幅する側 +${(D.integral - D.neg).toFixed(2)}（ω → ∞ まで）`, { "font-size": 18 }), opts.posAt || 1);
    T(s, W - 22, H - 44, `微分に時定数 ${D.tau} s のフィルタを掛けた PD`, { "font-size": 15, class: "muted", "text-anchor": "end" });
    void posA; void pl; void t;
    return { step: P.step };
  };

  // ---- 非最小位相の下界：m/M を変える ----
  FIG.nmpBound = function (el) {
    const D = window.DATA.ch6;
    const t = title(el, "");
    const W = 760, H = 200;
    const s = svg(el, W, H);
    const a = axes(s, { x0: 40, x1: W - 20, y0: H - 40, y1: 20, xr: [-1, 8], yr: [-1, 1], xAxisAt: 0, yAxisAt: 0, xticks: [2, 4, 6], xlabel: "Re" });
    const zm = ring(s, 0, a.Y(0), "unstable", 10);
    const pm = cross(s, 0, a.Y(0), "unstable");
    const zl = T(s, 0, 0, "", { "font-size": 18, style: "fill:var(--unstable)", "text-anchor": "middle" });
    const pl = T(s, 0, 0, "", { "font-size": 18, style: "fill:var(--unstable)", "text-anchor": "middle" });
    const r = sliderRow(el, "m / M", { min: Math.log10(0.01), max: Math.log10(2), step: 0.005, value: Math.log10(D.params.m / D.params.M) });
    function update() {
      const ratio = 10 ** +r.input.value;
      const pz = Math.sqrt(1 + ratio); // p / z = √((M+m)/M)、ℓ によらない
      const z = D.zero, p = z * pz;
      const bound = (z + p) / (p - z);
      zm.setAttribute("cx", a.X(z)); pm.setAttribute("transform", `translate(${a.X(p)},${a.Y(0)})`);
      zl.setAttribute("x", a.X(z) - 24); zl.setAttribute("y", a.Y(0) + 34); zl.textContent = `z ≈ ${z.toFixed(2)}`;
      pl.setAttribute("x", a.X(p) + 24); pl.setAttribute("y", a.Y(0) - 18); pl.textContent = `p ≈ ${p.toFixed(2)}`;
      r.val.textContent = ratio.toFixed(2);
      t.innerHTML = `x だけを測るとき ‖S‖∞ ≥ |(z+p)/(z−p)| ≈ <span class="num">${bound.toFixed(bound < 10 ? 1 : 0)}</span>`;
    }
    r.input.addEventListener("input", update);
    update();
    return {};
  };
})();
