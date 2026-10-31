// 描画（Canvas 2D）。ホストもクライアントも、スナップショットを開いた形（protocol.expandSnapshot）を描くだけ。
// 動くカメラ・背景・ステージ・ファイター・技の見た目・飛び道具・エフェクト・上部の % 表示。

import { STAGE, BLAST, BODY } from "./sim.js";
import { MOVES, stickerSrc } from "./moves.js";

export const COLORS = ["#ff5a5a", "#4aa3ff", "#ffc93c", "#43d17a"];
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "BIZ UDPGothic", "Meiryo", system-ui, sans-serif';
const SPRITE_H = 112, SPRITE_W = 80;

const img = src => { const i = new Image(); i.src = src; return i; };
const HUSKY = img("avatars/husky.png");
const STICKERS = Object.fromEntries(MOVES.map(m => [m.id, img(stickerSrc(m.sticker))]));
const ready = i => i.complete && i.naturalWidth > 0;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 背景の星（決まった並び）
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = Math.sin(i * 127.1) * 43758.5453;
  const r2 = Math.sin(i * 311.7) * 12345.678;
  return { x: (r - Math.floor(r)) * 2600 - 500, y: (r2 - Math.floor(r2)) * 1500 - 450, s: 0.6 + ((i * 37) % 10) / 7, d: 0.2 + ((i * 13) % 10) / 14 };
});

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { x: 800, y: 520, z: 1 };
    this.roster = [null, null, null, null];   // { name, kind }
    this.self = -1;
    this.parts = [];
    this.texts = [];
    this.flashes = [];
    this.shake = 0;
    this.time = 0;
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + "px";
    this.cv.style.height = h + "px";
    this.baseZ = Math.min(w / 1150, h / 640);
  }

  resetCamera() { this.cam = { x: 800, y: 520, z: this.baseZ }; this.parts = []; this.texts = []; this.flashes = []; }

  // ---- イベント → エフェクト ----

  burst(x, y, color, n, speed, life = 30, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.8) });
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }
  popText(x, y, text, color, size = 34) { this.texts.push({ x, y, text, color, size, life: 50 }); }

  event(e, view) {
    const color = e.s >= 0 ? COLORS[e.s] : "#fff";
    switch (e.k) {
      case "hit": {
        const big = e.p >= 20;
        this.burst(e.x, e.y, big ? "#fff3a0" : "#ffffff", big ? 26 : 12, big ? 16 : 9, big ? 34 : 22, big ? 6 : 4);
        this.flashes.push({ x: e.x, y: e.y, r: 20 + e.p * 2, life: 8, max: 8, color: "#fff" });
        this.shake = Math.max(this.shake, Math.min(18, e.p * 0.45));
        break;
      }
      case "ko": {
        this.burst(e.x, e.y, color, 60, 26, 50, 8);
        this.flashes.push({ x: e.x, y: e.y, r: 420, life: 24, max: 24, color, ko: true });
        this.shake = 24;
        break;
      }
      case "guard": this.burst(e.x, e.y, "#9fe8ff", 10, 7, 18, 3); break;
      case "counter": this.popText(e.x, e.y - 60, "猛反省！", "#ffffff", 40); this.flashes.push({ x: e.x, y: e.y, r: 140, life: 14, max: 14, color: "#ffffff" }); this.shake = 10; break;
      case "break": this.popText(e.x, e.y - 30, "ガードブレイク！", "#ff7b7b", 36); this.burst(e.x, e.y, "#9fe8ff", 30, 14, 40, 5); break;
      case "heal": if (Math.random() < 0.5) this.popText(e.x + (Math.random() - 0.5) * 50, e.y - 10, "+", "#6dffa0", 30); break;
      case "reflect": this.burst(e.x, e.y, "#c9a6ff", 16, 10, 22, 4); this.popText(e.x, e.y - 40, "不可能です！", "#d6c0ff", 30); break;
      case "swap": this.popText(e.x, e.y - 70, "おまえもな！", "#ffffff", 36); this.burst(e.x, e.y, color, 30, 12, 30, 5); break;
      case "jump": this.burst(e.x, e.y, "rgba(255,255,255,0.7)", e.p ? 6 : 4, 3, 16, 3); break;
    }
  }

  // ---- 1 フレーム描く ----

  frame(view, dt) {
    this.time += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updateCamera(view, dt);
    this.drawBackground();

    const sx = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake *= Math.pow(0.86, dt * 60);
    const { x, y, z } = this.cam;
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.w / 2 - x * z + sx), this.dpr * (this.h / 2 - y * z + sy));

    this.drawStage();
    if (view) {
      for (const p of view.P) this.drawProj(p, view);
      view.F.forEach((F, i) => { if (F) this.drawFighter(F, i, view); });
    }
    this.drawEffects(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (view) {
      this.drawOffscreen(view);
      this.drawHud(view);
      this.drawBanner(view);
    }
  }

  updateCamera(view, dt) {
    let x0 = STAGE.x0 - 80, x1 = STAGE.x1 + 80, y0 = STAGE.y - 260, y1 = STAGE.bottom + 60;
    if (view) {
      for (const F of view.F) {
        if (!F || F.st === "dead" || F.st === "out") continue;
        x0 = Math.min(x0, F.x - 160); x1 = Math.max(x1, F.x + 160);
        y0 = Math.min(y0, F.y - BODY.h - 140); y1 = Math.max(y1, F.y + 80);
      }
    }
    x0 = Math.max(x0, BLAST.x0); x1 = Math.min(x1, BLAST.x1);
    y0 = Math.max(y0, BLAST.top); y1 = Math.min(y1, BLAST.bottom);
    // 上部の % 表示の分だけ上に余白
    const hudPad = 70;
    const z = clamp(Math.min(this.w / (x1 - x0), (this.h - hudPad) / (y1 - y0)), this.baseZ * 0.5, this.baseZ * 1.15);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - hudPad / 2 / z;
    const k = 1 - Math.pow(0.9, dt * 60);
    this.cam.x = lerp(this.cam.x, cx, k);
    this.cam.y = lerp(this.cam.y, cy, k);
    this.cam.z = lerp(this.cam.z, z, k);
  }

  drawBackground() {
    const { ctx, w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#120a2a");
    g.addColorStop(0.55, "#2a1650");
    g.addColorStop(1, "#4b1d5e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 遠くの渦
    const cx = w / 2 + (800 - this.cam.x) * 0.05 * this.cam.z, cy = h * 0.42;
    const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.6);
    rg.addColorStop(0, "rgba(255,170,240,0.35)");
    rg.addColorStop(0.3, "rgba(140,90,255,0.15)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    for (const s of STARS) {
      const px = w / 2 + (s.x - this.cam.x) * this.cam.z * s.d * 0.5;
      const py = h / 2 + (s.y - this.cam.y) * this.cam.z * s.d * 0.5;
      if (px < -5 || px > w + 5 || py < -5 || py > h + 5) continue;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 2 + s.x);
      ctx.fillRect(px, py, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  drawStage() {
    const { ctx } = this;
    const { x0, x1, y, bottom } = STAGE;
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, bottom + 140);
    g.addColorStop(0, "#5c4a8f");
    g.addColorStop(0.4, "#2b2150");
    g.addColorStop(1, "#140d2a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.lineTo(x1 - 20, bottom);
    ctx.lineTo((x0 + x1) / 2 + 60, bottom + 120);
    ctx.lineTo((x0 + x1) / 2, bottom + 170);
    ctx.lineTo((x0 + x1) / 2 - 60, bottom + 120);
    ctx.lineTo(x0 + 20, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "#d7a6ff";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#e9d2ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 表面の模様
    ctx.strokeStyle = "rgba(220,190,255,0.25)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 8; i++) {
      const xx = x0 + (x1 - x0) * i / 8;
      ctx.beginPath(); ctx.moveTo(xx, y + 6); ctx.lineTo(xx + (xx < 800 ? 10 : -10), bottom - 10); ctx.stroke();
    }
    ctx.restore();
  }

  drawFighter(F, slot, view) {
    if (F.st === "dead" || F.st === "out") return;
    const { ctx } = this;
    const color = COLORS[slot];
    const t = this.time;
    const flags = F.flags;
    ctx.save();

    // 復帰台
    if (flags & 32) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse(F.x, F.y + 6, 50, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 影
    if (F.x > STAGE.x0 && F.x < STAGE.x1 && F.y <= STAGE.y + 1) {
      const hgt = STAGE.y - F.y;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(F.x, STAGE.y + 2, Math.max(10, 34 - hgt * 0.05), 7, 0, 0, Math.PI * 2); ctx.fill();
    }

    if ((flags & 1) && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    if (flags & 4) ctx.filter = "brightness(0.6)";

    // 体
    ctx.translate(F.x, F.y);
    let rot = 0, sq = 1;
    if (F.st === "hitstun") rot = t * 14 * F.face;
    else if (F.st === "move" && F.mv) rot = this.moveTilt(F) * F.face;
    else if (!(flags & 64)) sq = 0.96;
    else sq = 1 + Math.sin(t * 5 + slot) * 0.02;
    if (flags & 8) rot = -Math.PI / 2 * F.face * 0.9;   // 寝ている
    ctx.translate(0, -SPRITE_H / 2);
    ctx.rotate(rot);
    ctx.scale(F.face < 0 ? -1 : 1, sq);
    if (ready(HUSKY)) {
      ctx.shadowColor = (flags & 16) ? "#ffffff" : color;
      ctx.shadowBlur = (flags & 16) ? 28 : 12;
      ctx.drawImage(HUSKY, -SPRITE_W / 2, -SPRITE_H / 2, SPRITE_W, SPRITE_H);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(-BODY.hw, -SPRITE_H / 2, BODY.hw * 2, SPRITE_H);
    }
    ctx.restore();
    ctx.save();

    // ため
    if (F.charge > 0) {
      const c = F.charge / 60;
      ctx.globalAlpha = 0.25 + 0.4 * c;
      ctx.fillStyle = F.mv?.id === "tokiwa" ? "#ffe680" : color;
      ctx.beginPath(); ctx.arc(F.x, F.y - 50, 40 + 40 * c + Math.sin(t * 30) * 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // ガード
    if (flags & 2) {
      const r = 34 + 30 * (F.guardHp / 60);
      ctx.fillStyle = "rgba(140,220,255,0.28)";
      ctx.strokeStyle = "rgba(200,245,255,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(F.x, F.y - 48, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (F.st === "dizzy") {
      ctx.fillStyle = "#ffe36b";
      ctx.font = `bold 22px ${FONT}`;
      ctx.textAlign = "center";
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * 2.1;
        ctx.fillText("★", F.x + Math.cos(a) * 34, F.y - SPRITE_H - 6 + Math.sin(a) * 8);
      }
    }
    if (flags & 8) {
      ctx.fillStyle = "#cfe3ff";
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = "center";
      const k = (t * 1.2) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.fillText("Z", F.x + 20 + k * 30, F.y - 60 - k * 50);
      ctx.globalAlpha = 1;
    }

    if (F.st === "move" && F.mv) this.drawMoveFx(F, color);

    // 名札
    const name = this.roster[slot]?.name || `P${slot + 1}`;
    const top = F.y - SPRITE_H - 18;
    ctx.textAlign = "center";
    ctx.font = `bold 20px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    const label = slot === this.self ? `P${slot + 1}（あなた）` : `P${slot + 1} ${name}`;
    ctx.strokeText(label, F.x, top);
    ctx.fillStyle = color;
    ctx.fillText(label, F.x, top);
    ctx.beginPath();
    ctx.moveTo(F.x - 7, top + 5); ctx.lineTo(F.x + 7, top + 5); ctx.lineTo(F.x, top + 13); ctx.closePath();
    ctx.fill();

    // 使った技のステッカーを頭の上に出す（相手の持ち技がここでわかる）
    if (F.st === "move" && F.mv && F.mf < 45) this.drawStickerBubble(F, top - 30);
    ctx.restore();
  }

  moveTilt(F) {
    const id = F.mv.id, f = F.mf;
    if (id === "mori") return f < 17 ? -0.25 * Math.min(1, f / 12) : 0.3;
    if (id === "yatchi") return f >= 9 && f <= 22 ? 0.45 : 0;
    if (id === "itsukan") return f >= 7 && f <= 14 ? -0.2 : 0;
    if (id === "kansha") return f >= 8 && f <= 18 ? (f - 8) * 0.63 : 0;
    if (id === "gomen") return f >= 2 && f <= 16 ? (f - 2) * 0.45 : 0;
    if (id === "saraba") return 0.15;
    if (id === "jab" || id === "kisoku") return 0.12;
    return 0;
  }

  drawStickerBubble(F, y) {
    const { ctx } = this;
    const im = STICKERS[F.mv.id];
    const pop = Math.min(1, F.mf / 6);
    const s = (0.6 + 0.4 * pop) * (F.mf > 38 ? 1 - (F.mf - 38) / 7 : 1);
    if (s <= 0) return;
    const w = 92 * s, h = 80 * s;
    ctx.save();
    ctx.translate(F.x, y - h / 2);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 10 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (ready(im)) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  drawMoveFx(F, color) {
    const { ctx } = this;
    const m = F.mv, f = F.mf;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    if (m.hits) {
      for (const h of m.hits) {
        if (f < h.f[0] - 1 || f > h.f[1] + 2) continue;
        const [ox, oy, w, hh] = h.box;
        const cx = F.x + F.face * ox, cy = F.y + oy;
        ctx.globalAlpha = 0.5;
        if (h.around) {
          ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, hh / 2, 0, 0, Math.PI * 2); ctx.fill();
        } else if (h.grab) {
          ctx.lineWidth = 6; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w / 2, hh / 2, 0, F.face > 0 ? -Math.PI / 2 : Math.PI / 2, F.face > 0 ? Math.PI / 2 : Math.PI * 1.5);
          ctx.fill();
          ctx.globalAlpha = 0.9; ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 0.55;
    switch (m.id) {
      case "junbi":
        if (F.charge === 0 && f > 3) {
          ctx.beginPath(); ctx.ellipse(F.x + F.face * 48, F.y - 50, 40, 26, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case "gyakuten":
        if (f >= 12 && f <= 17) { ctx.beginPath(); ctx.ellipse(F.x + F.face * 50, F.y - 50, 38, 30, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      case "tokiwa":
        if (f >= 47 && f <= 58) {
          const k = (f - 47) / 11;
          ctx.fillStyle = "#fff4b0";
          ctx.globalAlpha = 0.8 * (1 - k);
          ctx.beginPath(); ctx.ellipse(F.x, F.y - 50, 160 + 60 * k, 120 + 40 * k, 0, 0, Math.PI * 2); ctx.fill();
        } else if (f < 47) {
          ctx.strokeStyle = "#ffe680"; ctx.lineWidth = 4; ctx.globalAlpha = 0.9;
          const a = f / 48 * Math.PI * 2;
          ctx.beginPath(); ctx.arc(F.x, F.y - 50, 70, -Math.PI / 2, -Math.PI / 2 + a); ctx.stroke();
        }
        break;
      case "saraba":
        if (!(F.flags & 64) && f >= 6) {
          ctx.fillRect(F.x - 24, F.y - 160, 48, 150);
        } else if (f >= 9 && f <= 14) {
          ctx.beginPath(); ctx.ellipse(F.x, F.y - 10, 80, 18, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case "cheat":
        if (f < 20) { ctx.globalAlpha = 0.35; ctx.fillRect(F.x - 30, F.y, 60, 60 + f * 4); }
        break;
      case "hansei":
        if (F.flags & 16) {
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.time * 40);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(F.x, F.y - 50, 56, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      case "fukanou":
        if (f >= 3 && f <= 20) {
          ctx.fillStyle = "#c9a6ff";
          ctx.fillRect(F.x + F.face * 45 - 10, F.y - 105, 20, 110);
        }
        break;
      case "yatchi":
        if (f >= 9 && f <= 22) { ctx.globalAlpha = 0.3; ctx.fillRect(F.x - F.face * 90 - 30, F.y - 75, 60, 60); }
        break;
    }
    ctx.restore();
  }

  drawProj(p) {
    const { ctx } = this;
    const color = COLORS[p.owner] || "#fff";
    ctx.save();
    switch (p.kind) {
      case "wave": {
        ctx.translate(p.x, p.y);
        ctx.scale(p.dir, 1);
        ctx.shadowColor = color; ctx.shadowBlur = 18;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 26, 0, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(-8, 0, 12, 20, 0, Math.PI / 2, -Math.PI / 2, true);
        ctx.fill();
        ctx.fillStyle = color; ctx.globalAlpha = 0.5;
        ctx.fillRect(-50, -6, 40, 12);
        break;
      }
      case "boomerang": {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 0.4);
        ctx.shadowColor = color; ctx.shadowBlur = 14;
        const im = STICKERS.wasureru;
        if (ready(im)) ctx.drawImage(im, -26, -22, 52, 44);
        break;
      }
      case "bolt": {
        const from = 40;
        if (p.t < from) {
          ctx.globalAlpha = 0.3 + 0.3 * Math.sin(p.t * 0.8);
          ctx.fillStyle = "#ff4d6d";
          ctx.fillRect(p.x - 35, STAGE.y - 900, 70, 900);
          ctx.globalAlpha = 1;
          ctx.font = `bold 40px ${FONT}`; ctx.textAlign = "center"; ctx.fillStyle = "#ffd0d8";
          ctx.fillText("⚡", p.x, p.y - 260);
        } else if (p.t < from + 10) {
          ctx.strokeStyle = "#fffbd0"; ctx.lineWidth = 10; ctx.shadowColor = "#ffe94d"; ctx.shadowBlur = 30;
          ctx.beginPath();
          let yy = BLAST.top, xx = p.x;
          ctx.moveTo(xx, yy);
          while (yy < STAGE.y) { yy += 60; xx = p.x + (Math.random() - 0.5) * 50; ctx.lineTo(xx, yy); }
          ctx.stroke();
        }
        break;
      }
      case "fire": {
        const k = Math.min(1, p.t / 6);
        for (let i = 0; i < 6; i++) {
          const fx = p.x + Math.sin(p.t * 0.7 + i * 1.7) * 26;
          const fy = p.y + 80 - (((p.t * 6 + i * 27) % 160) * k);
          ctx.globalAlpha = 0.65;
          ctx.fillStyle = i % 2 ? "#ff3b3b" : "#ffb02e";
          ctx.beginPath(); ctx.ellipse(fx, fy, 30, 42, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.3; ctx.fillStyle = "#8b0030";
        ctx.fillRect(p.x - 45, p.y - 80 * k, 90, 160 * k);
        break;
      }
    }
    ctx.restore();
  }

  drawEffects(dt) {
    const { ctx } = this;
    const k = dt * 60;
    ctx.save();
    for (const f of this.flashes) {
      f.life -= k;
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = a * (f.ko ? 0.5 : 0.8);
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    this.flashes = this.flashes.filter(f => f.life > 0);
    for (const p of this.parts) {
      p.x += p.vx * k; p.y += p.vy * k;
      p.vx *= Math.pow(0.92, k); p.vy = p.vy * Math.pow(0.92, k) + 0.3 * k;
      p.life -= k;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    this.parts = this.parts.filter(p => p.life > 0);
    ctx.textAlign = "center";
    for (const t of this.texts) {
      t.life -= k; t.y -= 0.8 * k;
      ctx.globalAlpha = Math.min(1, t.life / 15);
      ctx.font = `900 ${t.size}px ${FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    this.texts = this.texts.filter(t => t.life > 0);
    ctx.restore();
  }

  /** 画面の外にいるファイターを、画面の端に丸い印で示す */
  drawOffscreen(view) {
    const { ctx, w, h } = this;
    const { x, y, z } = this.cam;
    view.F.forEach((F, i) => {
      if (!F || F.st === "dead" || F.st === "out") return;
      const sx = w / 2 + (F.x - x) * z, sy = h / 2 + (F.y - 50 - y) * z;
      if (sx > 0 && sx < w && sy > 60 && sy < h) return;
      const px = clamp(sx, 34, w - 34), py = clamp(sy, 94, h - 34);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.clip();
      if (ready(HUSKY)) ctx.drawImage(HUSKY, px - 16, py - 22, 32, 46);
      ctx.restore();
    });
  }

  drawHud(view) {
    const { ctx, w } = this;
    const slots = [0, 1, 2, 3].filter(i => view.F[i]);
    const cw = Math.min(150, (w - 40) / Math.max(slots.length, 1));
    const total = cw * slots.length;
    let x = (w - total) / 2;
    for (const i of slots) {
      const F = view.F[i];
      const color = COLORS[i];
      ctx.save();
      ctx.globalAlpha = F.st === "out" ? 0.4 : 1;
      ctx.fillStyle = "rgba(10,6,24,0.6)";
      roundRect(ctx, x + 4, 6, cw - 8, 56, 12); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = i === this.self ? 3 : 1.5;
      ctx.stroke();
      // 顔
      ctx.save();
      ctx.beginPath(); ctx.arc(x + 30, 34, 20, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.clip();
      if (ready(HUSKY)) ctx.drawImage(HUSKY, x + 15, 15, 30, 44);
      ctx.restore();
      // %
      const dmg = Math.round(F.dmg);
      const heat = Math.min(1, dmg / 150);
      ctx.fillStyle = F.st === "out" ? "#888" : `rgb(255,${Math.round(255 - 170 * heat)},${Math.round(255 - 200 * heat)})`;
      ctx.font = `900 24px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(F.st === "out" ? "OUT" : `${dmg}%`, x + cw - 12, 54);
      // 名前とストック
      ctx.textAlign = "left";
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillStyle = "#fff";
      const nm = this.roster[i]?.name || `P${i + 1}`;
      ctx.fillText(`P${i + 1} ${nm}`.slice(0, 12), x + 54, 22);
      ctx.fillStyle = color;
      for (let s = 0; s < F.stocks && s < 9; s++) {
        ctx.beginPath(); ctx.arc(x + 58 + (s % 5) * 10, 34 + Math.floor(s / 5) * 9, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      x += cw;
    }
  }

  drawBanner(view) {
    const { ctx, w, h } = this;
    let text = "", color = "#fff", size = 96;
    if (view.ph === "countdown") {
      const n = Math.ceil(view.tm / 60);
      text = String(n);
      size = 110 + (view.tm % 60) * 0.8;
    } else if (view.ph === "fight" && view.f - (this.fightStart ?? view.f) < 50) {
      text = "GO!"; color = "#ffe36b";
    } else if (view.ph === "game") {
      text = "GAME!"; color = "#ff6b6b";
    }
    if (view.ph === "countdown") this.fightStart = null;
    if (view.ph === "fight" && this.fightStart == null) this.fightStart = view.f;
    if (!text) return;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.min(size, h * 0.3)}px ${FONT}`;
    ctx.lineWidth = 10; ctx.strokeStyle = "rgba(20,0,40,0.8)";
    ctx.strokeText(text, w / 2, h * 0.45);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h * 0.45);
    ctx.restore();
  }
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
