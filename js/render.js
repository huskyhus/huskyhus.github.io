// 背景・台・ステッカーの描画。View を受け取るので、ゲーム画面とシェア画像で共用できる。
import { PLATFORM_HALF_W } from "./physics.js";

export const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "BIZ UDPGothic", "Meiryo", system-ui, sans-serif';

// 雲と星の配置は固定（毎回同じ景色）
const rand = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32))(12345);
const CLOUDS = Array.from({ length: 70 }, (_, i) => ({
  x: (rand() - 0.5) * 22,
  y: 4 + i * 1.7 + rand() * 1.5,
  s: 0.7 + rand() * 0.9,
  drift: 0.05 + rand() * 0.12,
}));
const STARS = Array.from({ length: 120 }, () => ({ x: rand(), y: rand(), r: 0.5 + rand() * 1.3, tw: rand() * 6 }));

const CLOUD_PARALLAX = 0.6;   // 雲はカメラより少しゆっくり動く

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/** 高さに応じて空の色が変わる: 昼 → 夕方 → 宇宙 */
function skyColors(alt) {
  const stops = [
    [0, [124, 198, 240], [214, 240, 252]],
    [25, [92, 140, 220], [250, 196, 150]],
    [50, [38, 40, 100], [120, 80, 150]],
    [80, [6, 8, 28], [24, 26, 70]],
  ];
  let i = 0;
  while (i < stops.length - 2 && alt > stops[i + 1][0]) i++;
  const [a0, top0, bot0] = stops[i];
  const [a1, top1, bot1] = stops[i + 1];
  const t = Math.min(1, Math.max(0, (alt - a0) / (a1 - a0)));
  return [mix(top0, top1, t), mix(bot0, bot1, t)];
}

export function drawSky(v, time = 0) {
  const { ctx } = v;
  v.screen();
  const alt = Math.max(0, v.camY + v.viewH * 0.5);
  const [top, bottom] = skyColors(alt);
  const g = ctx.createLinearGradient(0, 0, 0, v.h);
  g.addColorStop(0, `rgb(${top})`);
  g.addColorStop(1, `rgb(${bottom})`);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, v.w + 40, v.h + 40);

  // 星（高度 40m あたりから見え始める）
  const starA = Math.min(1, Math.max(0, (alt - 40) / 30));
  if (starA > 0) {
    for (const s of STARS) {
      const y = ((s.y * v.h + v.camY * v.ppm * 0.05) % v.h + v.h) % v.h;
      ctx.globalAlpha = starA * (0.55 + 0.45 * Math.sin(time * 2 + s.tw));
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x * v.w, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 雲（高く登ると薄くなる）
  const cloudA = 0.85 * (1 - Math.min(1, Math.max(0, (alt - 45) / 25)));
  if (cloudA > 0) {
    ctx.fillStyle = "#fff";
    for (const c of CLOUDS) {
      const wx = ((c.x + time * c.drift + 11) % 22 + 22) % 22 - 11;
      const sx = v.w / 2 + (wx - v.camX) * v.ppm;
      const sy = v.h - (c.y - v.camY * CLOUD_PARALLAX) * v.ppm;
      const r = c.s * v.ppm * 0.45;
      if (sy < -r * 2 || sy > v.h + r * 2) continue;
      ctx.globalAlpha = cloudA * 0.8;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 1.6, r * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(sx - r * 0.6, sy - r * 0.25, r * 0.7, r * 0.6, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + r * 0.4, sy - r * 0.4, r * 0.8, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawRuler(v, best) {
  const { ctx } = v;
  v.screen();
  ctx.font = `700 11px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const from = Math.max(1, Math.ceil(v.camY));
  const to = Math.floor(v.camY + v.viewH);
  for (let m = from; m <= to; m++) {
    const { y } = v.toScreen(0, m);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(0, y, m % 5 === 0 ? 18 : 9, 1);
    if (m % 5 === 0) ctx.fillText(`${m}m`, 22, y);
  }
  if (best > 0) {
    const { y } = v.toScreen(0, best);
    ctx.strokeStyle = "rgba(255, 210, 60, 0.9)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(v.w, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgb(255, 210, 60)";
    ctx.textAlign = "right";
    ctx.fillText(`BEST ${best.toFixed(2)}m`, v.w - 10, y - 9);
    ctx.textAlign = "left";
  }
}

export function drawPlatform(v) {
  const { ctx } = v;
  v.world();
  const w = PLATFORM_HALF_W;
  // 柱（画面下まで）
  ctx.fillStyle = "#7d5d43";
  ctx.fillRect(-w * 0.45, -200, w * 0.9, 200);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(w * 0.25, -200, w * 0.2, 200);
  // 台
  ctx.fillStyle = "#a47c5b";
  ctx.fillRect(-w, -0.6, w * 2, 0.6);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(-w, -0.6, w * 2, 0.12);
  // 芝生
  ctx.fillStyle = "#6fbf4a";
  ctx.fillRect(-w, -0.14, w * 2, 0.14);
  ctx.fillStyle = "#8fd667";
  ctx.fillRect(-w, -0.05, w * 2, 0.05);
}

/** squash: 0〜1。着地直後に少し潰れて戻る演出。 */
export function drawSticker(v, img, def, x, y, angle, { alpha = 1, squash = 0 } = {}) {
  const { ctx } = v;
  v.world();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (squash) ctx.scale(1 + 0.07 * squash, 1 - 0.09 * squash);
  ctx.globalAlpha = alpha;
  ctx.scale(1, -1);   // 画像は y 下向き
  ctx.drawImage(img, -def.w / 2, -def.h / 2, def.w, def.h);
  ctx.globalAlpha = 1;
}

export function drawShapes(v, def, x, y, angle) {
  const { ctx } = v;
  v.world();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 2 / v.ppm;
  ctx.strokeStyle = "rgba(255, 40, 40, 0.9)";
  for (const p of def.pieces) {
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
  }
}
