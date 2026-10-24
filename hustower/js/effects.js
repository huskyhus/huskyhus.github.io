// パーティクル・浮かぶ文字・画面揺れ・フラッシュ
import { FONT } from "./render.js";

const CONFETTI_COLORS = ["#ff6b4a", "#ffd23c", "#4ad0ff", "#7ee36b", "#ff7ad9", "#ffffff"];

export class Effects {
  constructor() {
    this.particles = [];   // ワールド座標
    this.texts = [];       // ワールド座標に浮かぶ文字
    this.banners = [];     // 画面中央の大きな文字
    this.shake = 0;        // 揺れの強さ（px）
    this.flash = 0;        // 0〜1
    this.flashColor = "255,60,60";
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.banners.length = 0;
    this.shake = 0;
    this.flash = 0;
  }

  dust(x, y, strength) {
    const n = Math.round(4 + strength * 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI;
      const sp = 0.4 + Math.random() * 1.2 * strength;
      this.particles.push({
        kind: "dust", x, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 0.6,
        life: 0, max: 0.4 + Math.random() * 0.3, size: 0.06 + Math.random() * 0.08, g: -0.5,
      });
    }
  }

  confetti(x, y, n = 60, spread = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 3 + Math.random() * 5;
      this.particles.push({
        kind: "confetti", x: x + (Math.random() - 0.5) * spread, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.6 + Math.random() * 0.8,
        size: 0.08 + Math.random() * 0.07, g: 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      });
    }
  }

  sparkle(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 1.5;
      this.particles.push({
        kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: 0.5 + Math.random() * 0.3, size: 0.05 + Math.random() * 0.04, g: 0, color: "#fff6b0",
      });
    }
  }

  popText(x, y, text, color = "#fff", size = 22) {
    this.texts.push({ x, y, text, color, size, life: 0, max: 1.1 });
  }

  banner(text, sub = "", color = "#ffd23c") {
    this.banners.push({ text, sub, color, life: 0, max: 1.8 });
  }

  addShake(px) { this.shake = Math.max(this.shake, px); }

  addFlash(alpha, color = "255,60,60") { this.flash = Math.max(this.flash, alpha); this.flashColor = color; }

  update(dt) {
    for (const p of this.particles) {
      p.life += dt;
      p.vy -= p.g * dt;
      if (p.kind === "dust") { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
      if (p.kind === "confetti") { p.vx *= 1 - 1.5 * dt; p.vy = Math.max(p.vy, -2.2); p.rot += p.vr * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter(p => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y += dt * 0.8; }
    this.texts = this.texts.filter(t => t.life < t.max);
    for (const b of this.banners) b.life += dt;
    this.banners = this.banners.filter(b => b.life < b.max);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  /** 揺れを View に反映する */
  applyShake(v) {
    v.shakeX = this.shake ? (Math.random() - 0.5) * 2 * this.shake : 0;
    v.shakeY = this.shake ? (Math.random() - 0.5) * 2 * this.shake : 0;
  }

  drawWorld(v) {
    const { ctx } = v;
    v.world();
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      if (p.kind === "dust") {
        ctx.globalAlpha = 0.55 * k;
        ctx.fillStyle = "#f4ead8";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "confetti") {
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.5 * Math.abs(Math.cos(p.rot * 1.7)), p.size * 2, p.size);
        ctx.restore();
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.01, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawScreen(v) {
    const { ctx } = v;
    v.screen();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      const { x, y } = v.toScreen(t.x, t.y);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `900 ${t.size * pop}px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(40,30,60,0.75)";
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    for (const b of this.banners) {
      const k = b.life / b.max;
      const slide = k < 0.15 ? (1 - k / 0.15) : k > 0.85 ? -(k - 0.85) / 0.15 : 0;
      const x = v.w / 2 + slide * v.w;
      const y = v.h * 0.36;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(30,30,60,0.55)";
      ctx.fillRect(x - v.w / 2, y - 42, v.w, b.sub ? 92 : 72);
      ctx.font = `900 40px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(40,30,60,0.9)";
      ctx.strokeText(b.text, x, y);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, x, y);
      if (b.sub) {
        ctx.font = `700 15px ${FONT}`;
        ctx.fillStyle = "#fff";
        ctx.fillText(b.sub, x, y + 34);
      }
    }
    ctx.globalAlpha = 1;
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.35})`;
      ctx.fillRect(-20, -20, v.w + 40, v.h + 40);
    }
  }
}
