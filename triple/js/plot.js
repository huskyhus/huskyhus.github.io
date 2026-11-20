// キャンバスに描くための小道具（各シリーズのデモと解説ページで共有）。
(function (root) {
  "use strict";
  const P = {};
  P.C = {};
  const listeners = [];
  P.readColors = function () {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["ink", "muted", "line", "grid", "card", "bg", "link1", "link2", "link3", "cart", "ref", "ok", "bad", "warn"])
      P.C[k] = cs.getPropertyValue("--" + k).trim();
  };
  P.onRedraw = (f) => listeners.push(f);
  if (typeof window !== "undefined") {
    P.readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { P.readColors(); listeners.forEach((f) => f()); });
    window.addEventListener("resize", () => listeners.forEach((f) => f()));
  }

  P.fit = function (cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px system-ui, sans-serif";
    return { ctx, w, h };
  };

  const fmtNum = (v) => {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1e4 || a < 1e-2) { const e = Math.round(Math.log10(a)); if (Math.abs(a - 10 ** e) / a < 1e-6) return (v < 0 ? "−" : "") + "10" + sup(e); return v.toExponential(0); }
    return String(+v.toPrecision(3)).replace("-", "−");
  };
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sup = (e) => String(e).split("").map((c) => SUP[c] || c).join("");
  P.fmt = fmtNum;

  // 座標軸と格子を描き、写像 {X, Y} を返す
  P.axes = function (ctx, r, o) {
    const C = P.C;
    const tx = (v) => (o.xlog ? Math.log10(v) : v), ty = (v) => (o.ylog ? Math.log10(v) : v);
    const x0 = tx(o.xmin), x1 = tx(o.xmax), y0 = ty(o.ymin), y1 = ty(o.ymax);
    const X = (v) => r.x + ((tx(v) - x0) / (x1 - x0)) * r.w;
    const Y = (v) => {
      const t = ty(v);
      const c = Math.min(Math.max(t, Math.min(y0, y1) - 0.05 * Math.abs(y1 - y0)), Math.max(y0, y1) + 0.05 * Math.abs(y1 - y0));
      return r.y + r.h - ((c - y0) / (y1 - y0)) * r.h;
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid;
    ctx.fillStyle = C.muted;
    ctx.font = "11px system-ui, sans-serif";
    const xt = o.xticks || [], yt = o.yticks || [];
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const v of xt) {
      ctx.beginPath(); ctx.moveTo(X(v), r.y); ctx.lineTo(X(v), r.y + r.h); ctx.stroke();
      if (!o.noXLabels) ctx.fillText((o.xfmt || fmtNum)(v), X(v), r.y + r.h + 4);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const v of yt) {
      ctx.beginPath(); ctx.moveTo(r.x, Y(v)); ctx.lineTo(r.x + r.w, Y(v)); ctx.stroke();
      ctx.fillText((o.yfmt || fmtNum)(v), r.x - 5, Y(v));
    }
    if (o.zeroY) {
      ctx.strokeStyle = C.muted;
      ctx.beginPath(); ctx.moveTo(r.x, Y(0)); ctx.lineTo(r.x + r.w, Y(0)); ctx.stroke();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    if (o.title) { ctx.fillStyle = C.muted; ctx.fillText(o.title, r.x, r.y - 3); }
    if (o.xlabel) { ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(o.xlabel, r.x + r.w, r.y + r.h + 16); }
    return { X, Y, r };
  };

  // 折れ線。maxJump を与えると、その画素以上の跳びで線を切る
  P.line = function (ctx, m, xs, ys, o = {}) {
    ctx.strokeStyle = o.color || P.C.ink;
    ctx.lineWidth = o.width || 1.8;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.setLineDash(o.dash || []);
    ctx.beginPath();
    let first = true, py = 0;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], y = ys[i];
      if (!Number.isFinite(x) || !Number.isFinite(y)) { first = true; continue; }
      const X = m.X(x), Y = m.Y(y);
      if (first || (o.maxJump && Math.abs(Y - py) > o.maxJump)) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      first = false; py = Y;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  P.dot = function (ctx, x, y, r, color, hollow) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (hollow) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
  };
  P.cross = function (ctx, x, y, r, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
  };
  P.label = function (ctx, text, x, y, o = {}) {
    ctx.fillStyle = o.color || P.C.muted;
    ctx.font = o.font || "11px system-ui, sans-serif";
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "middle";
    ctx.fillText(text, x, y);
  };
  P.decades = (a, b) => { const out = []; for (let e = Math.ceil(Math.log10(a) - 1e-9); e <= Math.floor(Math.log10(b) + 1e-9); e++) out.push(10 ** e); return out; };
  P.logspace = (a, b, n) => Array.from({ length: n }, (_, i) => 10 ** (Math.log10(a) + ((Math.log10(b) - Math.log10(a)) * i) / (n - 1)));

  // 複素数（[re, im] の配列で表す）
  const Cx = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    abs: (a) => Math.hypot(a[0], a[1]),
    arg: (a) => Math.atan2(a[1], a[0]),
    expj: (t) => [Math.cos(t), Math.sin(t)],
    scale: (a, s) => [a[0] * s, a[1] * s],
  };
  P.Cx = Cx;
  // 多項式（係数は高次から）を複素数 s で評価
  P.polyval = (c, s) => { let r = [0, 0]; for (const v of c) r = Cx.add(Cx.mul(r, s), [v, 0]); return r; };
  // 位相を連続につなぐ（度）
  P.unwrapDeg = (ph) => { const out = ph.slice(); for (let i = 1; i < out.length; i++) { while (out[i] - out[i - 1] > 180) out[i] -= 360; while (out[i] - out[i - 1] < -180) out[i] += 360; } return out; };

  root.PL = P;
  if (typeof module !== "undefined") module.exports = P;
})(typeof window !== "undefined" ? window : globalThis);
