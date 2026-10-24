import { Physics, buildStickerDefs } from "./physics.js";
import { View } from "./view.js";
import { drawSky, drawRuler, drawPlatform, drawSticker, drawShapes, FONT } from "./render.js";
import { Effects } from "./effects.js";
import { sfx, unlock, isMuted, setMuted } from "./audio.js";
import { music } from "./music.js";
import { renderShareImage, shareCanvas, postToXUrl } from "./share.js";

const planck = window.planck;

// 画面・操作まわりの定数（単位はメートル）
const VIEW_W = 8;            // 横方向に最低限見せる幅
const MIN_VIEW_H = 10;       // 縦方向に最低限見せる高さ
const AIM_LIMIT = 3.8;       // 狙える x の範囲
const SPAWN_GAP = 0.5;       // 塔の最上点と落とす前のピースの隙間
const ROT_TAP = Math.PI / 12;          // 1回押すと 15°
const ROT_SPEED = Math.PI * 5 / 6;     // 長押しで 150°/s
const ROT_HOLD_DELAY = 0.22;           // 長押し判定までの秒数
const WHEEL_STEP = Math.PI / 36;       // ホイール 1 目盛り 5°
const WHEEL_NOTCH = 100;               // 1 目盛りとみなすスクロール量（px）
const KEY_SPEED = 3;         // キーボード移動の速さ m/s
const FALL_TIMEOUT = 8;      // 揺れが収まらなくてもこの秒数で次へ
const MILESTONE = 5;         // この高さごとに演出
const TEMPO_BASE = 120;      // BGM のテンポ
const TEMPO_MAX_UP = 30;
const DEG = 180 / Math.PI;

const canvas = document.getElementById("stage");
const view = new View(canvas.getContext("2d"));
const effects = new Effects();
const $ = id => document.getElementById(id);
const debug = new URLSearchParams(location.search).has("debug");

let defs = [];
let images = [];
let game = null;
let showShapes = debug;
let time = 0;
let shareImage = null;
const keys = new Set();

// ---------------------------------------------------------------- モード・記録

function todayJST() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());   // YYYY-MM-DD
}

function makeMode(kind) {
  if (kind === "daily") {
    const date = todayJST();
    return { kind, date, label: `デイリー ${date.slice(5).replace("-", "/")}`, bestKey: `hustower.daily.${date}` };
  }
  return { kind: "normal", label: "スコアアタック", bestKey: "hustower.best" };
}

function loadBest(mode) {
  try { return Number(localStorage.getItem(mode.bestKey)) || 0; } catch { return 0; }
}

function saveBest(mode, v) {
  try { localStorage.setItem(mode.bestKey, String(v)); } catch { /* 保存できなくても遊べる */ }
}

// 日付から決まる乱数（デイリーは全員同じ順番のピースになる）
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 準備

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を読み込めません: " + src));
    img.src = src;
  });
}

async function load() {
  const shapes = await (await fetch("data/shapes.json")).json();
  defs = buildStickerDefs(shapes);
  images = await Promise.all(defs.map(d => loadImage(d.file)));
}

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  view.ppm = Math.min(view.w / VIEW_W, view.h / MIN_VIEW_H);
  // 画面の向きが変わったら、狙い位置を画面内に戻す
  if (game?.current) game.current.x = clampAim(game.current.x, game.current.def);
}

// ---------------------------------------------------------------- ゲーム状態

function shuffledBag(rng) {
  const bag = defs.map((_, i) => i);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function newGame(kind) {
  const mode = makeMode(kind);
  effects.clear();
  game = {
    mode,                   // スコアアタック / デイリー
    state: "aim",           // aim → falling → aim … → over
    best: loadBest(mode),
    rng: kind === "daily" ? mulberry32(hashString("hustower:" + mode.date)) : Math.random,
    phys: new Physics(planck, { onImpact }),
    bag: [],
    current: null,
    nextId: 0,
    heldId: null,           // ホールド中のピース
    holdUsed: false,        // この手ですでにホールドしたか（1 手 1 回）
    dropped: null,         // 落下中のピースと、落とした時点の状態
    stackTop: 0,            // 最後に静止したときの塔の高さ
    height: 0,              // スコア（静止時の最高到達点）
    count: 0,
    combo: 0,
    bestBroken: false,
    snapshot: [],           // 最後に静止したときの塔（シェア画像用）
    fallTime: 0,
    timeScale: 1,
    rotHold: null,
    angleShow: 0,           // 角度表示を出しておく残り秒数
    lastLandSound: 0,
  };
  view.camY = -2.2;
  game.nextId = drawFromBag();
  nextPiece();
  updateHoldUi();
  $("modeTag").textContent = mode.label;
  updateHud();
}

function drawFromBag() {
  if (!game.bag.length) game.bag = shuffledBag(game.rng);
  return game.bag.pop();
}

function nextPiece() {
  const def = defs[game.nextId];
  game.nextId = drawFromBag();
  setCurrent(def);
  const next = $("next");
  next.src = defs[game.nextId].file;
  popAnim(next);
  game.state = "aim";
}

function setCurrent(def) {
  const x = game.current ? game.current.x : 0;
  game.current = { def, x: clampAim(x, def), angle: 0, shownAngle: 0 };
}

function popAnim(el) {
  el.classList.remove("pop");
  void el.offsetWidth;   // アニメーションを再生し直す
  el.classList.add("pop");
}

/** 今のピースをホールドする。ホールド済みのピースがあれば入れ替える（1 手 1 回） */
function hold() {
  if (game?.state !== "aim" || game.holdUsed) return;
  const prev = game.heldId;
  game.heldId = game.current.def.id;
  if (prev == null) nextPiece();
  else setCurrent(defs[prev]);
  game.holdUsed = true;
  game.rotHold = null;
  game.angleShow = 0;
  sfx.hold();
  updateHoldUi();
  popAnim($("holdImg"));
}

function updateHoldUi() {
  const has = game?.heldId != null;
  const img = $("holdImg");
  img.hidden = !has;
  if (has) img.src = defs[game.heldId].file;
  $("holdEmpty").hidden = has;
  $("hold").classList.toggle("used", !!game?.holdUsed);
}

function spawnY(def) {
  return game.stackTop + def.radius + SPAWN_GAP;
}

function clampAim(x, def) {
  const lim = Math.min(AIM_LIMIT, view.viewW / 2 - def.radius * 0.5);
  return Math.max(-lim, Math.min(lim, x));
}

function rotateBy(da) {
  if (game?.state !== "aim") return;
  const before = Math.round(game.current.angle / ROT_TAP);
  game.current.angle += da;
  game.angleShow = 1.2;
  if (Math.round(game.current.angle / ROT_TAP) !== before) sfx.rotate();
}

/** dir: +1 = 反時計回り, -1 = 時計回り（画面上） */
function startRotate(dir) {
  if (game?.state !== "aim") return;
  rotateBy(dir * ROT_TAP);
  game.rotHold = { dir, t: 0 };
}

function stopRotate() {
  if (game) game.rotHold = null;
}

function drop() {
  if (game?.state !== "aim") return;
  const { def, x, angle } = game.current;
  const piece = game.phys.drop(def, x, spawnY(def), angle);
  game.dropped = {
    piece, angle,
    others: game.phys.pieces.filter(p => p !== piece).map(p => ({ p, x: p.body.getPosition().x, y: p.body.getPosition().y })),
  };
  game.current = null;
  game.rotHold = null;
  game.holdUsed = false;
  game.state = "falling";
  game.fallTime = 0;
  updateHoldUi();
  sfx.drop();
}

function onImpact({ pieces, speed, point }) {
  const s = Math.min(1, speed / 6);
  const now = performance.now();
  if (now - game.lastLandSound > 70) {
    sfx.land(s);
    game.lastLandSound = now;
  }
  effects.dust(point.x, point.y, s);
  for (const p of pieces) if (!p.landed) { p.landed = true; p.squash = 1; }
  if (speed > 4.5) effects.addShake(3 + 4 * s);
}

function onSettled() {
  const { phys, dropped } = game;
  game.count++;
  game.stackTop = phys.towerTop();
  const prev = game.height;
  game.height = Math.max(game.height, game.stackTop);
  game.snapshot = phys.pieces.map(({ body, def }) => ({ def, x: body.getPosition().x, y: body.getPosition().y, angle: body.getAngle() }));

  // 置き方の判定: 置いた後に回らず、下の塔も動かなければ PERFECT
  const body = dropped.piece.body;
  const turned = Math.abs(body.getAngle() - dropped.angle) * DEG;
  let moved = 0;
  for (const o of dropped.others) moved = Math.max(moved, Math.hypot(o.p.body.getPosition().x - o.x, o.p.body.getPosition().y - o.y));
  const at = body.getPosition();
  const labelY = at.y + dropped.piece.def.radius * 0.6;
  if (!dropped.others.length) {
    // 1 個目は台に置くだけなので判定しない（毎回 PERFECT になってしまう）
  } else if (turned < 2 && moved < 0.02) {
    game.combo++;
    effects.popText(at.x, labelY, game.combo > 1 ? `PERFECT ×${game.combo}` : "PERFECT!", "#ffd23c", 26);
    effects.sparkle(at.x, labelY);
    sfx.perfect(game.combo);
  } else if (turned < 6 && moved < 0.06) {
    game.combo = 0;
    effects.popText(at.x, labelY, "NICE!", "#8fe3ff", 22);
    sfx.nice();
  } else {
    game.combo = 0;
  }

  // 高くなるほど BGM を速く（5m ごとに +3 BPM、最大 150）
  music.setTempo(TEMPO_BASE + Math.min(TEMPO_MAX_UP, Math.floor(game.height / MILESTONE) * 3));

  // 高さの節目とベスト更新
  const m = Math.floor(game.height / MILESTONE);
  if (m > Math.floor(prev / MILESTONE)) {
    effects.banner(`${m * MILESTONE}m 突破！`, `${game.count}個目`);
    effects.confetti(0, game.stackTop + 1, 80, 5);
    sfx.milestone();
  } else if (!game.bestBroken && game.best > 0 && game.height > game.best) {
    game.bestBroken = true;
    effects.banner("ベスト更新！", `${game.height.toFixed(2)}m`, "#ff9f4a");
    effects.confetti(0, game.stackTop + 1, 50, 4);
    sfx.milestone();
  }

  game.dropped = null;
  updateHud();
  nextPiece();
}

function gameOver() {
  game.state = "over";
  game.timeScale = 0.25;   // スローモーション
  game.rotHold = null;
  effects.addShake(12);
  effects.addFlash(1);
  music.duck();   // 曲は止めず、失敗音が聞こえるよう一瞬だけ下げる
  sfx.gameOver();

  const isBest = game.height > game.best + 1e-6;
  if (isBest) { game.best = game.height; saveBest(game.mode, game.height); }
  $("resultMode").textContent = game.mode.label;
  $("resultHeight").textContent = game.height.toFixed(2);
  $("resultCount").textContent = game.count;
  $("newBest").hidden = !isBest;
  updateHud();

  shareImage = renderShareImage({
    snapshot: game.snapshot, images, height: game.height, count: game.count,
    modeLabel: game.mode.kind === "daily" ? `デイリーチャレンジ ${game.mode.date}` : "スコアアタック",
    url: shareUrl().replace(/^https?:\/\//, ""),
  });
  $("sharePreview").src = shareImage.toDataURL("image/png");
  $("shareImage").textContent = "画像でシェア";
  setTimeout(() => { $("over").hidden = false; }, 1400);
}

/** 共有するリンク。正式な URL は index.html の og:url に 1 か所だけ書く */
function shareUrl() {
  return document.querySelector('meta[property="og:url"]')?.content
    || location.origin + location.pathname.replace(/index\.html$/, "");
}

function shareText() {
  const h = game.height.toFixed(2);
  return game.mode.kind === "daily"
    ? `ハスタワー デイリーチャレンジ ${game.mode.date}：${h}m（${game.count}個）積み上げた！`
    : `ハスタワーで ${h}m（${game.count}個）積み上げた！`;
}

function updateHud() {
  $("height").textContent = (game?.height ?? 0).toFixed(2);
  $("count").textContent = game?.count ?? 0;
  $("best").textContent = (game?.best ?? 0).toFixed(2);
}

function updateTitle() {
  $("dailyLabel").textContent = makeMode("daily").label;
  const b = loadBest(makeMode("daily"));
  $("dailyBest").textContent = b ? `今日のベスト ${b.toFixed(2)}m` : "まだ挑戦していません";
  const nb = loadBest(makeMode("normal"));
  $("normalBest").textContent = nb ? `ベスト ${nb.toFixed(2)}m` : "ランダムな順番";
}

// ---------------------------------------------------------------- 更新

function update(realDt) {
  time += realDt;
  effects.update(realDt);
  if (!game) return;
  game.timeScale += (1 - game.timeScale) * Math.min(1, realDt * 0.8);
  const dt = realDt * game.timeScale;
  const { phys } = game;
  phys.update(dt);

  for (const p of phys.pieces) if (p.squash) p.squash = Math.max(0, p.squash - realDt * 6);

  if (game.state !== "over" && phys.fallen()) {
    gameOver();
  } else if (game.state === "falling") {
    game.fallTime += dt;
    if ((phys.settled && game.fallTime > 0.3) || game.fallTime > FALL_TIMEOUT) onSettled();
  } else if (game.state === "aim") {
    const c = game.current;
    const dir = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    if (dir) c.x = clampAim(c.x + dir * KEY_SPEED * dt, c.def);
    const h = game.rotHold;
    if (h) {
      h.t += realDt;
      if (h.t > ROT_HOLD_DELAY) rotateBy(h.dir * ROT_SPEED * realDt);
    }
    c.shownAngle += (c.angle - c.shownAngle) * Math.min(1, realDt * 20);
  }
  game.angleShow = Math.max(0, game.angleShow - realDt);

  // カメラ: 次に落とすピースが画面上部に収まるよう追従
  const def = game.current?.def;
  const focus = def ? spawnY(def) + def.radius : game.stackTop + 1.5;
  const target = Math.max(-2.2, focus + 2.4 - view.viewH);
  view.camY += (target - view.camY) * Math.min(1, realDt * 2.5);
}

// ---------------------------------------------------------------- 描画

function drawAim() {
  const c = game.current;
  const y = spawnY(c.def);
  const { ctx } = view;
  view.world();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2 / view.ppm;
  ctx.setLineDash([0.15, 0.15]);
  ctx.beginPath(); ctx.moveTo(c.x, y); ctx.lineTo(c.x, view.camY); ctx.stroke();
  ctx.setLineDash([]);
  // ふわふわ浮いている感じ
  const bob = Math.sin(time * 3) * 0.03;
  drawSticker(view, images[c.def.id], c.def, c.x, y + bob, c.shownAngle);
  if (showShapes) drawShapes(view, c.def, c.x, y + bob, c.shownAngle);

  if (game.angleShow > 0) {
    let deg = Math.round(-c.angle * DEG) % 360;
    if (deg > 180) deg -= 360;
    if (deg <= -180) deg += 360;
    const p = view.toScreen(c.x, y - c.def.radius - 0.15);
    view.screen();
    ctx.globalAlpha = Math.min(1, game.angleShow * 3);
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = `${deg}°`;
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = "rgba(30,30,60,0.7)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(p.x - w / 2, p.y - 12, w, 24, 12); else ctx.rect(p.x - w / 2, p.y - 12, w, 24);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, p.x, p.y + 1);
    ctx.globalAlpha = 1;
  }
}

function render() {
  effects.applyShake(view);
  drawSky(view, time);
  if (!game) { drawPlatform(view); return; }
  drawRuler(view, game.best);
  drawPlatform(view);
  for (const p of game.phys.pieces) {
    const pos = p.body.getPosition();
    drawSticker(view, images[p.def.id], p.def, pos.x, pos.y, p.body.getAngle(), p.squash || 0);
    if (showShapes) drawShapes(view, p.def, pos.x, pos.y, p.body.getAngle());
  }
  if (game.state === "aim") drawAim();
  effects.drawWorld(view);
  effects.drawScreen(view);
}

// ---------------------------------------------------------------- 入力

// 押している指と、押した時点のピース（途中でホールドされたら落とさない）
let press = null;

canvas.addEventListener("pointerdown", e => {
  if (game?.state !== "aim" || press) return;   // 2 本目の指は無視
  press = { id: e.pointerId, current: game.current };
  canvas.setPointerCapture(e.pointerId);
  game.current.x = clampAim(view.toWorldX(e.clientX), game.current.def);
});

canvas.addEventListener("pointermove", e => {
  if (game?.state !== "aim") return;
  if (press?.id === e.pointerId || (!press && e.pointerType === "mouse")) {
    game.current.x = clampAim(view.toWorldX(e.clientX), game.current.def);
  }
});

canvas.addEventListener("pointerup", e => {
  if (press?.id !== e.pointerId) return;
  const p = press;
  press = null;
  // ボタンや HUD の上で離した、または押している間にピースが入れ替わったら落とさない
  const over = document.elementFromPoint(e.clientX, e.clientY);
  if (over && over !== canvas && over.closest("button, .hud")) return;
  if (game?.current !== p.current) return;
  drop();
});

for (const ev of ["pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(ev, e => { if (press?.id === e.pointerId) press = null; });
}

// ホイール: トラックパッドは細かいイベントが大量に来るので、量を貯めて 1 目盛りずつ回す
let wheelAcc = 0;
canvas.addEventListener("wheel", e => {
  if (game?.state !== "aim") return;
  e.preventDefault();
  wheelAcc += e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);   // 行・ページ単位を px に
  while (Math.abs(wheelAcc) >= WHEEL_NOTCH) {
    rotateBy(-Math.sign(wheelAcc) * WHEEL_STEP);
    wheelAcc -= Math.sign(wheelAcc) * WHEEL_NOTCH;
  }
}, { passive: false });

for (const [id, dir] of [["rotL", 1], ["rotR", -1]]) {
  const btn = $(id);
  btn.addEventListener("pointerdown", e => { e.preventDefault(); startRotate(dir); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, stopRotate);
  btn.addEventListener("contextmenu", e => e.preventDefault());
}

$("hold").addEventListener("pointerdown", e => { e.preventDefault(); hold(); });

// プレイ中の HUD ボタンはクリックしてもフォーカスを持たない（Space が落下ではなくボタンに行ってしまうため）
for (const id of ["bgm", "mute"]) $(id).addEventListener("pointerdown", e => e.preventDefault());

const MOVE_KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
const ROT_KEYS = { ArrowUp: -1, e: -1, E: -1, w: -1, W: -1, q: 1, Q: 1 };

window.addEventListener("keydown", e => {
  if (MOVE_KEYS[e.key]) { keys.add(MOVE_KEYS[e.key]); e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.key in ROT_KEYS) { startRotate(ROT_KEYS[e.key]); e.preventDefault(); }
  else if ([" ", "Enter", "ArrowDown", "s", "S"].includes(e.key)) {
    // Tab で選んだボタンは、そのボタンとして押させる（デイリーを選んで Enter など）
    if ((e.key === " " || e.key === "Enter") && e.target.closest?.("button")) return;
    e.preventDefault();
    if (!$("title").hidden) $("startNormal").click();
    else if (!$("over").hidden) $("retry").click();
    else drop();
  } else if (["c", "C", "Shift", "h", "H"].includes(e.key)) hold();
  else if (e.key === "g" || e.key === "G") showShapes = !showShapes;
});

window.addEventListener("keyup", e => {
  if (MOVE_KEYS[e.key]) keys.delete(MOVE_KEYS[e.key]);
  if (e.key in ROT_KEYS) stopRotate();
});
window.addEventListener("blur", () => { keys.clear(); stopRotate(); });
window.addEventListener("resize", resize);

function start(kind) {
  unlock();
  sfx.click();
  $("title").hidden = true;
  $("over").hidden = true;
  document.body.classList.add("playing");
  newGame(kind);
  // 曲は流しっぱなし。リトライではテンポだけ戻す
  if (music.playing) music.setTempo(TEMPO_BASE);
  else music.start();
}

$("startNormal").addEventListener("click", () => start("normal"));
$("startDaily").addEventListener("click", () => start("daily"));
$("retry").addEventListener("click", () => start(game.mode.kind));
$("toTitle").addEventListener("click", () => {
  sfx.click();
  music.setTempo(TEMPO_BASE);
  $("over").hidden = true;
  game = null;
  effects.clear();
  updateTitle();
  updateHud();
  $("modeTag").textContent = "";
  document.body.classList.remove("playing");
  $("title").hidden = false;
});

$("shareImage").addEventListener("click", async () => {
  if (!shareImage) return;
  const name = `hustower-${game.mode.kind === "daily" ? game.mode.date : "score"}-${game.height.toFixed(2)}m.png`;
  const result = await shareCanvas(shareImage, { text: `${shareText()} ${shareUrl()}`, filename: name });
  if (result === "downloaded") $("shareImage").textContent = "画像を保存しました";
});

$("shareX").addEventListener("click", () => {
  window.open(postToXUrl(shareText(), shareUrl()), "_blank", "noopener");
});

function syncMute() {
  $("mute").setAttribute("aria-pressed", String(isMuted()));
  $("mute").textContent = isMuted() ? "🔇" : "🔊";
  $("bgm").setAttribute("aria-pressed", String(!music.enabled));
  $("bgm").classList.toggle("off", !music.enabled);
}
$("mute").addEventListener("click", () => { unlock(); setMuted(!isMuted()); syncMute(); });
$("bgm").addEventListener("click", () => { unlock(); music.setEnabled(!music.enabled); syncMute(); });

// ---------------------------------------------------------------- ループ

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// ?debug のときはコンソールから状態や演出を触れるようにする
if (debug) window.hustower = { effects, view, music, get game() { return game; } };

resize();
view.camY = -2.2;
syncMute();
updateTitle();
updateHud();
requestAnimationFrame(frame);
load().then(() => {
  for (const id of ["startNormal", "startDaily"]) $(id).disabled = false;
  $("loading").hidden = true;
}).catch(err => {
  $("loading").textContent = "読み込みに失敗しました";
  console.error(err);
});
