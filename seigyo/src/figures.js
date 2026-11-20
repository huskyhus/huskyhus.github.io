// 図とアニメーション。FIG.<名前>(el, opts, ctx) は {step(n), destroy()} を返す。
// 数値は window.DATA（scripts/build_data.py の出力）から読み、ここには打ち込まない。
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;

  function S(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, text, attrs) {
    const t = S("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = text;
    return t;
  }
  function svg(el, w, h) {
    const s = S("svg", { viewBox: `0 0 ${w} ${h}` }, el);
    const id = `ah${++uid}`;
    const defs = S("defs", {}, s);
    for (const [name, cls] of [["", "arrowhead"], ["k", "inkhead"], ["m", "mutedhead"]]) {
      const mk = S("marker", { id: id + name, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" }, defs);
      S("path", { d: "M0,0 L10,5 L0,10 z", fill: cls === "arrowhead" ? "var(--accent)" : cls === "inkhead" ? "var(--ink)" : "var(--muted)" }, mk);
    }
    s.arrow = `url(#${id})`;
    s.inkArrow = `url(#${id}k)`;
    s.mutedArrow = `url(#${id}m)`;
    return s;
  }
  function title(el, html) {
    const t = document.createElement("div");
    t.className = "fig-title";
    t.innerHTML = html;
    el.appendChild(t);
    return t;
  }
  // ステップで出し入れする SVG の部品
  function parts() {
    const list = [];
    return {
      add(g, at, until) { g.classList.add("svgpart"); list.push({ g, at, until: until || Infinity }); return g; },
      step(n) { for (const p of list) p.g.classList.toggle("hidden", !(n >= p.at && n <= p.until)); },
    };
  }

  // ---- 台車と振り子（模式図とアニメーションで共用） ----
  function makePendulum(parent, o) {
    const cartW = o.cartW || 150, cartH = o.cartH || 60, wheelR = o.wheelR || 12;
    const g = S("g", {}, parent);
    const cart = S("g", {}, g);
    S("rect", { x: -cartW / 2, y: -cartH - 2 * wheelR, width: cartW, height: cartH, rx: 6, class: "cart" }, cart);
    S("circle", { cx: -cartW / 3, cy: -wheelR, r: wheelR, class: "wheel" }, cart);
    S("circle", { cx: cartW / 3, cy: -wheelR, r: wheelR, class: "wheel" }, cart);
    const rod = S("line", { class: "rod" }, g);
    const bob = S("circle", { r: o.bobR || 16, class: "bob" }, g);
    const api = {
      g, cart, rod, bob, cartW, cartH,
      set(xpx, theta, lpx) {
        const py = o.groundY - 2 * wheelR - cartH;
        cart.setAttribute("transform", `translate(${xpx},${o.groundY})`);
        const bx = xpx + lpx * Math.sin(theta), by = py - lpx * Math.cos(theta);
        rod.setAttribute("x1", xpx); rod.setAttribute("y1", py);
        rod.setAttribute("x2", bx); rod.setAttribute("y2", by);
        bob.setAttribute("cx", bx); bob.setAttribute("cy", by);
        api.pivot = [xpx, py];
        api.tip = [bx, by];
      },
    };
    return api;
  }

  // 図1：台車型倒立振り子の模式図
  FIG.pendulumSchematic = function (el, opts) {
    const P = parts();
    if (opts.title !== false) title(el, "台車型倒立振り子　θ は鉛直上向きから測る");
    const W = 720, H = 500, groundY = 400, x0 = 140, xc = 400, th = 0.38, L = 240;
    const s = svg(el, W, H);
    S("line", { x1: 30, y1: groundY, x2: W - 20, y2: groundY, class: "ground" }, s);
    for (let x = 40; x < W - 20; x += 24) S("line", { x1: x, y1: groundY, x2: x - 12, y2: groundY + 12, class: "grid", style: "stroke:var(--line)" }, s);
    const pend = makePendulum(s, { groundY });
    pend.set(xc, th, L);
    const [px, py] = pend.pivot, [bx, by] = pend.tip;
    const lab = P.add(S("g", {}, s), opts.labelsAt || 1);
    // 鉛直線と角度
    S("line", { x1: px, y1: py, x2: px, y2: py - L - 20, class: "dash" }, lab);
    const r = 80;
    S("path", { d: `M${px},${py - r} A${r},${r} 0 0 1 ${px + r * Math.sin(th)},${py - r * Math.cos(th)}`, class: "dim-arrow", "marker-end": s.mutedArrow }, lab);
    T(lab, px + 100 * Math.sin(th / 2) - 6, py - 100 * Math.cos(th / 2) - 4, "θ", { class: "var", "font-size": 30 });
    T(lab, (px + bx) / 2 + 18, (py + by) / 2 + 8, "ℓ", { class: "var", "font-size": 30 });
    T(lab, bx + 22, by - 10, "m", { class: "var", "font-size": 30 });
    T(lab, xc - 12, groundY - 42, "M", { class: "var", "font-size": 30 });
    // 原点と x
    S("line", { x1: x0, y1: groundY + 18, x2: x0, y2: groundY + 58, class: "axis" }, lab);
    T(lab, x0 - 8, groundY + 84, "0", { "font-size": 22, class: "muted" });
    S("line", { x1: x0, y1: groundY + 40, x2: xc, y2: groundY + 40, class: "dim-arrow", "marker-end": s.mutedArrow }, lab);
    S("line", { x1: xc, y1: groundY + 18, x2: xc, y2: groundY + 58, class: "axis" }, lab);
    T(lab, (x0 + xc) / 2 - 6, groundY + 76, "x", { class: "var", "font-size": 30 });
    // 入力 u
    S("line", { x1: xc - 300, y1: groundY - 54, x2: xc - pend.cartW / 2 - 6, y2: groundY - 54, class: "arrow", "marker-end": s.arrow }, lab);
    T(lab, xc - 296, groundY - 66, "u", { class: "var", "font-size": 32, style: "fill:var(--accent)" });
    T(lab, xc - 300, groundY - 16, "入力：台車を押す力", { "font-size": 20, style: "fill:var(--accent)" });
    // 重力
    S("line", { x1: W - 70, y1: 70, x2: W - 70, y2: 140, class: "dim-arrow", "marker-end": s.mutedArrow }, lab);
    T(lab, W - 58, 116, "g", { class: "var", "font-size": 28 });
    // 質点の位置（ステップ2）
    if (opts.coordsAt) {
      const c = P.add(S("g", {}, s), opts.coordsAt);
      T(c, bx - 180, by - 44, "(x + ℓ sin θ,  ℓ cos θ)", { class: "var", "font-size": 26, style: "fill:var(--accent)" });
    }
    return { step: P.step };
  };

  // 系の箱：u → [ż = f(z,u), y = h(z,u)] → y
  FIG.sysBox = function (el, opts) {
    const P = parts();
    const s = svg(el, 760, 330);
    const bx = 230, by = 110, bw = 300, bh = 130;
    const box = S("rect", { x: bx, y: by, width: bw, height: bh, rx: 8, class: "box" }, s);
    T(s, bx + 40, by + 55, "ż = f(z, u)", { class: "var", "font-size": 32 });
    T(s, bx + 40, by + 102, "y = h(z, u)", { class: "var", "font-size": 32 });
    S("line", { x1: 60, y1: by + bh / 2, x2: bx - 4, y2: by + bh / 2, class: "wire", "marker-end": s.inkArrow }, s);
    S("line", { x1: bx + bw, y1: by + bh / 2, x2: 700, y2: by + bh / 2, class: "wire", "marker-end": s.inkArrow }, s);
    T(s, 70, by + bh / 2 - 16, "u", { class: "var", "font-size": 32 });
    T(s, 660, by + bh / 2 - 16, "y", { class: "var", "font-size": 32 });
    const g2 = P.add(S("g", {}, s), opts.namesAt || 2);
    T(g2, 40, by + bh / 2 + 50, "入力", { "font-size": 24 });
    T(g2, 40, by + bh / 2 + 80, "こちらが選ぶ", { "font-size": 20, class: "muted" });
    T(g2, 630, by + bh / 2 + 50, "出力", { "font-size": 24 });
    T(g2, 630, by + bh / 2 + 80, "センサで測る", { "font-size": 20, class: "muted" });
    T(g2, bx + 80, by + bh + 42, "状態 z(t) ∈ ℝⁿ", { "font-size": 24 });
    const g3 = P.add(S("g", {}, s), opts.plantAt || 3);
    T(g3, bx + 46, by - 24, "制御対象（プラント）", { "font-size": 26, style: "fill:var(--accent)" });
    return {
      step(n) {
        P.step(n);
        box.classList.toggle("hl", n >= (opts.plantAt || 3));
      },
    };
  };

  // 開ループとフィードバック
  FIG.loops = function (el, opts) {
    const P = parts();
    const s = svg(el, 780, 600);
    // 開ループ
    const a = P.add(S("g", {}, s), 1);
    T(a, 20, 40, "開ループ", { "font-size": 26, "font-weight": 700 });
    S("rect", { x: 330, y: 70, width: 140, height: 90, rx: 8, class: "box" }, a);
    T(a, 390, 125, "P", { class: "var", "font-size": 34 });
    S("line", { x1: 120, y1: 115, x2: 326, y2: 115, class: "wire", "marker-end": s.inkArrow }, a);
    S("line", { x1: 470, y1: 115, x2: 700, y2: 115, class: "wire", "marker-end": s.inkArrow }, a);
    T(a, 20, 100, "前もって", { "font-size": 20, class: "muted" });
    T(a, 20, 124, "決めた u(t)", { "font-size": 22 });
    T(a, 680, 100, "y", { class: "var", "font-size": 30 });
    // フィードバック
    const b = P.add(S("g", {}, s), opts.feedbackAt || 2);
    T(b, 20, 270, "フィードバック", { "font-size": 26, "font-weight": 700 });
    S("rect", { x: 330, y: 300, width: 140, height: 90, rx: 8, class: "box" }, b);
    T(b, 390, 355, "P", { class: "var", "font-size": 34 });
    const cBox = S("rect", { x: 330, y: 460, width: 140, height: 90, rx: 8, class: "box" }, b);
    T(b, 390, 515, "C", { class: "var", "font-size": 34 });
    S("line", { x1: 470, y1: 345, x2: 700, y2: 345, class: "wire", "marker-end": s.inkArrow }, b);
    const back = S("path", { d: "M600,345 V505 H474", class: "wire", "marker-end": s.inkArrow }, b);
    const fwd = S("path", { d: "M330,505 H220 V345 H326", class: "wire", "marker-end": s.inkArrow }, b);
    S("circle", { cx: 600, cy: 345, r: 5, fill: "var(--ink)" }, b);
    T(b, 680, 330, "y", { class: "var", "font-size": 30 });
    T(b, 186, 430, "u", { class: "var", "font-size": 30 });
    T(b, 500, 400, "測った y から", { "font-size": 20, class: "muted" });
    T(b, 500, 425, "u を作る", { "font-size": 20, class: "muted" });
    const c = P.add(S("g", {}, s), opts.lawAt || 3);
    T(c, 500, 540, "制御器：y から u を作る規則", { "font-size": 22, style: "fill:var(--accent)" });
    T(c, 500, 570, "（制御則）を実装したもの", { "font-size": 22, style: "fill:var(--accent)" });
    return {
      step(n) {
        P.step(n);
        const hl = n >= (opts.lawAt || 3);
        cBox.classList.toggle("hl", hl);
        back.classList.toggle("hl", hl);
        fwd.classList.toggle("hl", hl);
      },
    };
  };

  // ---- 非線形の振り子（入力なし）の数値解。ℓ を変えたときだけ使う。既定値では DATA の解を使う ----
  function simulateFall(prm, theta0, dt, tmax) {
    const { M, m, g } = prm, l = prm.l;
    const f = (s) => {
      const [, xd, th, thd] = s;
      const c = Math.cos(th), sn = Math.sin(th);
      // [[M+m, m l c],[c, l]] [xdd, thdd] = [m l thd^2 sn, g sn]
      const a11 = M + m, a12 = m * l * c, a21 = c, a22 = l;
      const r1 = m * l * thd * thd * sn, r2 = g * sn;
      const det = a11 * a22 - a12 * a21;
      return [xd, (r1 * a22 - a12 * r2) / det, thd, (a11 * r2 - a21 * r1) / det];
    };
    let s = [0, 0, theta0, 0];
    const h = dt / 10;
    const out = { t: [0], x: [0], theta: [theta0] };
    for (let k = 1; k * dt <= tmax; k++) {
      for (let j = 0; j < 10; j++) {
        const k1 = f(s);
        const k2 = f(s.map((v, i) => v + (h / 2) * k1[i]));
        const k3 = f(s.map((v, i) => v + (h / 2) * k2[i]));
        const k4 = f(s.map((v, i) => v + h * k3[i]));
        s = s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      }
      out.t.push(+(k * dt).toFixed(4));
      out.x.push(s[0]);
      out.theta.push(s[2]);
      if (Math.abs(s[2]) >= Math.PI / 2) break;
    }
    return out;
  }

  // 図2（第1部版）：A の固有値と、放っておいた振り子が倒れる様子
  FIG.ch1Instability = function (el, opts, ctx) {
    const D = ctx.data.ch1;
    const prm = Object.assign({}, D.params);
    const P = parts();
    const ttl = title(el, "");
    // 固有値の平面
    const W = 760, H = 220, RE = 12, IM = 4;
    const s = svg(el, W, H);
    const X = (re) => 40 + ((re + RE) / (2 * RE)) * (W - 80);
    const Y = (im) => H / 2 - (im / IM) * (H / 2 - 20);
    S("rect", { x: X(-RE), y: 10, width: X(0) - X(-RE), height: H - 20, class: "shade" }, s);
    T(s, X(-RE) + 12, 42, "ℂ₋ = {Re s < 0}", { "font-size": 22, class: "muted" });
    S("line", { x1: X(-RE), y1: Y(0), x2: X(RE), y2: Y(0), class: "axis" }, s);
    S("line", { x1: X(0), y1: 10, x2: X(0), y2: H - 10, class: "axis" }, s);
    T(s, X(RE) - 40, Y(0) - 10, "Re", { "font-size": 20, class: "muted" });
    T(s, X(0) + 8, 30, "Im", { "font-size": 20, class: "muted" });
    for (let k = -10; k <= 10; k += 5) {
      if (k === 0) continue;
      S("line", { x1: X(k), y1: Y(0) - 6, x2: X(k), y2: Y(0) + 6, class: "axis" }, s);
      T(s, X(k) - 12, Y(0) + 30, String(k), { "font-size": 18, class: "muted" });
    }
    const cross = (cls) => {
      const g = S("g", { class: cls }, s);
      S("line", { x1: -10, y1: -10, x2: 10, y2: 10, "stroke-width": 4 }, g);
      S("line", { x1: -10, y1: 10, x2: 10, y2: -10, "stroke-width": 4 }, g);
      return g;
    };
    const zeroMark = cross("stable-mark");
    zeroMark.setAttribute("transform", `translate(${X(0)},${Y(0)})`);
    T(s, X(0) - 70, Y(0) - 18, "0（2重）", { "font-size": 20 });
    const negMark = cross("stable-mark");
    const posMark = cross("unstable");
    const negLab = T(s, 0, 0, "", { "font-size": 20, class: "var" });
    const posLab = T(s, 0, 0, "", { "font-size": 22, class: "var", style: "fill:var(--unstable)" });

    // 倒れる様子
    const fallWrap = P.add(document.createElement("div"), opts.fallAt || 2);
    el.appendChild(fallWrap);
    const s2 = svg(fallWrap, W, 300);
    const groundY = 270;
    S("line", { x1: 20, y1: groundY, x2: 330, y2: groundY, class: "ground" }, s2);
    const pend = makePendulum(s2, { groundY, cartW: 90, cartH: 36, wheelR: 8, bobR: 11 });
    // θ(t) のグラフ
    const gx0 = 400, gx1 = 740, gy0 = 260, gy1 = 30;
    S("line", { x1: gx0, y1: gy0, x2: gx1, y2: gy0, class: "axis" }, s2);
    S("line", { x1: gx0, y1: gy0, x2: gx0, y2: gy1, class: "axis" }, s2);
    T(s2, gx1 - 14, gy0 + 26, "t", { class: "var", "font-size": 22 });
    T(s2, gx0 - 30, gy1 + 10, "θ", { class: "var", "font-size": 22 });
    T(s2, gx0 - 42, gy1 + 40, "π/2", { "font-size": 16, class: "muted" });
    S("line", { x1: gx0 - 5, y1: gy1 + 34, x2: gx1, y2: gy1 + 34, class: "grid" }, s2);
    const linPath = S("path", { class: "curve lin" }, s2);
    const nlPath = S("path", { class: "curve" }, s2);
    const cursor = S("line", { class: "cursor", y1: gy0, y2: gy1 }, s2);
    const tLab = T(s2, gx0 + 10, gy0 + 26, "", { "font-size": 18, class: "muted" });
    T(s2, gx0 + 16, gy1 + 60, "実線：非線形の数値解", { "font-size": 17 });
    T(s2, gx0 + 16, gy1 + 84, "破線：線形化 θ₀ cosh pt", { "font-size": 17, class: "muted" });
    const speedLab = T(s2, 20, 24, "θ(0) = 0.02 rad から放す　1/4 倍速", { "font-size": 18, class: "muted" });

    // スライダー
    const row = P.add(document.createElement("div"), opts.sliderAt || 3);
    row.className = "controls-row interactive";
    row.innerHTML = `<span>棒の長さ ℓ</span><input type="range" min="0.15" max="2" step="0.05"><span class="val"></span><button type="button">もう一度</button>`;
    el.appendChild(row);
    const range = row.querySelector("input");
    const val = row.querySelector(".val");
    range.value = String(prm.l);

    let traj = D.fall, raf = 0, t0 = 0, p = D.p;
    function layout() {
      const l = prm.l;
      p = Math.sqrt(((prm.M + prm.m) * prm.g) / (prm.M * l));
      if (Math.abs(l - D.params.l) < 1e-9) { p = D.p; traj = D.fall; }
      else traj = Object.assign(simulateFall(prm, D.fall.theta0, D.fall.dt, 3), { theta0: D.fall.theta0 });
      negMark.setAttribute("transform", `translate(${X(-p)},${Y(0)})`);
      posMark.setAttribute("transform", `translate(${X(p)},${Y(0)})`);
      negLab.setAttribute("x", X(-p) - 34); negLab.setAttribute("y", Y(0) - 18); negLab.textContent = `−p`;
      posLab.setAttribute("x", X(p) - 50); posLab.setAttribute("y", Y(0) - 18); posLab.textContent = `+p ≈ ${p.toFixed(2)}`;
      ttl.innerHTML = `A の固有値　+p ≈ <span class="num">${p.toFixed(2)}</span> s⁻¹：ずれは約 <span class="num">${(1 / p).toFixed(2)}</span> 秒ごとに e 倍`;
      val.textContent = `${l.toFixed(2)} m（p ≈ ${p.toFixed(2)}）`;
      // グラフ
      const tEnd = traj.t[traj.t.length - 1];
      const gxT = (t) => gx0 + (t / tEnd) * (gx1 - gx0);
      const gyT = (th) => gy0 - (Math.min(Math.abs(th), Math.PI / 2) / (Math.PI / 2)) * (gy0 - gy1 - 34);
      nlPath.setAttribute("d", traj.t.map((t, i) => `${i ? "L" : "M"}${gxT(t).toFixed(1)},${gyT(traj.theta[i]).toFixed(1)}`).join(""));
      const lin = [];
      for (let i = 0; i <= 100; i++) {
        const t = (tEnd * i) / 100;
        const th = traj.theta0 * Math.cosh(p * t);
        if (th > Math.PI / 2) break;
        lin.push(`${i ? "L" : "M"}${gxT(t).toFixed(1)},${gyT(th).toFixed(1)}`);
      }
      linPath.setAttribute("d", lin.join(""));
      layout.gxT = gxT;
      layout.tEnd = tEnd;
    }
    const pxPerM = () => Math.min(400, 190 / prm.l);
    function draw(i) {
      const k = pxPerM();
      pend.set(175 + traj.x[i] * k, traj.theta[i], prm.l * k);
      const x = layout.gxT(traj.t[i]);
      cursor.setAttribute("x1", x); cursor.setAttribute("x2", x);
      tLab.textContent = `t = ${traj.t[i].toFixed(2)} s`;
    }
    function play() {
      cancelAnimationFrame(raf);
      t0 = performance.now();
      const loop = (now) => {
        const t = ((now - t0) / 1000) * 0.25; // 1/4 倍速
        const i = Math.min(traj.t.length - 1, Math.round(t / D.fall.dt));
        draw(i);
        if (i < traj.t.length - 1) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    range.addEventListener("input", () => { prm.l = +range.value; layout(); draw(0); });
    range.addEventListener("change", play);
    row.querySelector("button").addEventListener("click", play);
    layout();
    draw(0);
    let shownFall = false;
    return {
      step(n) {
        P.step(n);
        const on = n >= (opts.fallAt || 2);
        if (on && !shownFall) setTimeout(play, 400);
        shownFall = on;
      },
      destroy() { cancelAnimationFrame(raf); },
    };
  };

  // helper exported for later chapters
  FIG._util = { S, T, svg, title, parts, makePendulum, simulateFall };
})();
