// 結果のシェア画像（塔が崩れる前の最後の静止状態）を作り、共有・保存する。
import { View } from "./view.js";
import { PLATFORM_HALF_W } from "./physics.js";
import { FONT, drawSky, drawPlatform, drawSticker } from "./render.js";

const W = 1080;
const H = 1350;
const HEADER = 330;
const FOOTER = 110;

/** snapshot: [{ def, x, y, angle }] */
export function renderShareImage({ snapshot, images, height, count, modeLabel, url }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const v = new View(ctx);
  v.w = W;
  v.h = H;

  // 塔全体が収まるように縮尺を決める
  const top = Math.max(height, 2) + 0.6;
  const bottom = -1.0;
  let halfW = PLATFORM_HALF_W + 0.6;
  for (const s of snapshot) halfW = Math.max(halfW, Math.abs(s.x) + s.def.radius + 0.3);
  v.ppm = Math.min(W / (halfW * 2), (H - HEADER - FOOTER) / (top - bottom));
  v.camX = 0;
  v.camY = bottom - FOOTER / v.ppm;

  drawSky(v, 0);
  drawPlatform(v);
  for (const s of snapshot) drawSticker(v, images[s.def.id], s.def, s.x, s.y, s.angle);

  // ヘッダー
  v.screen();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, 40, 36, W - 80, HEADER - 40, 36);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ff6b4a";
  ctx.font = `900 54px ${FONT}`;
  ctx.fillText("ハスタワー", W / 2, 108);
  ctx.fillStyle = "#6c7086";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(modeLabel, W / 2, 152);
  ctx.fillStyle = "#2b2d42";
  ctx.font = `900 96px ${FONT}`;
  const num = height.toFixed(2);
  const numW = ctx.measureText(num).width;
  ctx.font = `900 44px ${FONT}`;
  const unitW = ctx.measureText(" m").width;
  const x0 = W / 2 - (numW + unitW) / 2;
  ctx.textAlign = "left";
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText(num, x0, 248);
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText(" m", x0 + numW, 248);
  ctx.textAlign = "center";
  ctx.fillStyle = "#6c7086";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(`${count}個 積み上げ`, W / 2, 290);

  // フッター
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, H - 56, W, 56);
  ctx.fillStyle = "#fff";
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(url, W / 2, H - 19);
  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Web Share API でファイルごと共有。使えなければ PNG をダウンロードする。 */
export async function shareCanvas(canvas, { text, filename }) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "aborted";
    }
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
  return "downloaded";
}

export function postToXUrl(text, url) {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
