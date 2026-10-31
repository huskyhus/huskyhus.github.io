import { Maze, COLS, ROWS, WALL_HALF } from "./maze.js";
import { ITEMS, UI_STICKERS, stickerSrc } from "./items.js";
import { PLAYER } from "./player.js";
import { TiltInput } from "./input.js";
import { sfx, unlock, isMuted, setMuted } from "./audio.js";
import { startBgm, setOn as setBgmOn, isOn as isBgmOn, setTempoRate } from "./bgm.js";
import { Scene3D, makeItemTexture } from "./render.js";
import { todayJST } from "./rng.js";

// 物理・画面まわりの定数（単位はマス、秒）。プレイヤーの動きは player.js
const BALL_R = 0.27;
const DASH_MULT = 1.6;       // ダッシュ中の加速度・最高速の倍率
const ICE_DAMP = 0.08;       // つるつる中は転がり抵抗をこの倍率に
const ICE_ACCEL = 0.65;
const ICE_BOUNCE = 0.75;
const SLOW_PHYS = 0.6;       // スロー中: 物理の進む速さ
const SLOW_SENS = 0.7;       //           傾きの効き
const SLOW_CLOCK = 0.35;     //           時計の進む速さ（物理より遅いので、そのぶん得をする）
const SLOW_TEMPO = 0.7;      //           BGM のテンポ
const ASSIST_K = 40;         // アシスト: 通路の中心線へ引き寄せるばね
const ASSIST_D = 10;         //           横揺れを抑える減衰
const PICK_DIST = BALL_R + 0.24;
const GOAL_DIST = 0.4;
const WARP_STEPS = 10;
const COUNTDOWN = 3;
const GHOST_HZ = 10;         // ゴースト記録の頻度
const POPUP_MS = 1700;

const canvas = document.getElementById("stage");
const scene = new Scene3D(canvas);
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const debug = params.has("debug");
const input = new TiltInput(canvas);

let images = {};
let itemTextures = null;
let date = null;
let maze = null;
let game = null;
let time = 0;
let shareText = "";
let wakeLock = null;
const view = { w: innerWidth, h: innerHeight };
const tiltVis = { x: 0, y: 0 };

// ---------------------------------------------------------------- 日付・記録

function pickDate() {
  const d = params.get("date");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayJST();
}

const recordKey = d => `husmaze.daily.${d}`;

function loadRecord(d) {
  try { return JSON.parse(localStorage.getItem(recordKey(d))) ?? { time: null, plays: 0 }; }
  catch { return { time: null, plays: 0 }; }
}

function saveRecord(d, rec) {
  try { localStorage.setItem(recordKey(d), JSON.stringify(rec)); } catch { /* 保存できなくても遊べる */ }
}

function recentRecords(limit) {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith("husmaze.daily.")) continue;
      const rec = JSON.parse(localStorage.getItem(k));
      if (rec?.time != null) out.push({ date: k.slice(14), time: rec.time });
    }
  } catch { /* 読めなければ空 */ }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** 秒 → "12.34" / "1:05.32"。アイテムでマイナスにもなる（"−3.20"） */
function fmtTime(t) {
  if (t <= -0.005) return `−${fmtTime(-t)}`;
  if (t < 60) return Math.abs(t).toFixed(2);
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
}

const fmtDate = d => d.replaceAll("-", "/");

// ---------------------------------------------------------------- ゲームの開始・終了

function prepareMaze() {
  const d = pickDate();
  if (d !== date) {
    date = d;
    maze = new Maze(date);
    if (itemTextures) scene.build(maze, itemTextures);
  }
}

function newGame() {
  prepareMaze();
  const rec = loadRecord(date);
  rec.plays++;
  saveRecord(date, rec);
  game = {
    phase: "count",
    countdown: COUNTDOWN,
    ball: {
      x: maze.cx(maze.start) + 0.5, y: maze.cy(maze.start) + 0.5,
      vx: 0, vy: 0, r: BALL_R,
    },
    items: maze.items.map(it => ({ ...it, taken: false })),
    effects: {},
    elapsed: 0,         // 時計（スロー中はゆっくり進む）
    offset: 0,          // アイテムによるタイムの増減
    trace: [],          // ゴースト用の軌跡 [x, y, x, y, ...]
    ghost: rec.ghost ?? null,
    best: rec.time,
  };
  scene.snapCamera(game.ball.x, game.ball.y);
  for (const id of ["title", "clear", "pause", "help"]) $(id).hidden = true;
  $("hud").hidden = false;
  $("date").textContent = `${fmtDate(date)} の迷路`;
  $("best").textContent = game.best != null ? fmtTime(game.best) : "--";
  $("calib").hidden = input.mode !== "sensor";
  clearChips();
  clearMarkers();
  showCount(COUNTDOWN);
  requestWakeLock();
}

function finish() {
  game.phase = "clear";
  const total = game.elapsed + game.offset;   // アイテム次第でマイナスもありうる
  const rec = loadRecord(date);
  const newBest = rec.time == null || total < rec.time;
  const prevBest = rec.time;
  if (newBest) {
    rec.time = total;
    rec.ghost = game.trace;
    saveRecord(date, rec);
  }
  sfx.goal();
  scene.burst(game.ball.x, game.ball.y, "#ffc83d", 50, { up: 4 });
  game.effects = {};
  setTempoRate(1);

  $("clearSticker").src = stickerSrc(newBest ? UI_STICKERS.newBest : UI_STICKERS.clear);
  $("clearDate").textContent = `${fmtDate(date)} の迷路`;
  $("clearTime").textContent = fmtTime(total);
  const off = game.offset;
  $("clearDetail").textContent = `走行 ${fmtTime(game.elapsed)} 秒` +
    (off ? ` / アイテム ${off > 0 ? "+" : "−"}${Math.abs(off).toFixed(1)} 秒` : "");
  $("clearBest").innerHTML = newBest
    ? (prevBest != null ? `ベスト更新！ <small>（${fmtTime(prevBest - total)} 秒短縮）</small>` : "初クリア！")
    : `ベスト ${fmtTime(prevBest)} 秒 <small>（あと ${fmtTime(total - prevBest)} 秒）</small>`;
  $("clearBest").classList.toggle("newbest", newBest);
  shareText = `ハスメイズ ${fmtDate(date)} の迷路を ${fmtTime(total)} 秒でクリア！ #ハスメイズ`;
  setTimeout(() => {
    $("hud").hidden = true;
    $("clear").hidden = false;
  }, 900);
  releaseWakeLock();
}

function pause() {
  if (!game || game.phase !== "play") return;
  game.phase = "paused";
  $("pause").hidden = false;
}

function resume() {
  $("pause").hidden = true;
  game.phase = "play";
  input.calibrate();
}

function toTitle() {
  game = null;
  releaseWakeLock();
  setTempoRate(1);
  prepareMaze();
  for (const id of ["clear", "pause", "help", "hud"]) $(id).hidden = true;
  $("countdown").hidden = true;
  clearMarkers();
  renderTitle();
  $("title").hidden = false;
}

// ---------------------------------------------------------------- 物理

function step(realDt) {
  const g = game;
  const b = g.ball;
  const fx = g.effects;
  const dt = fx.slow ? realDt * SLOW_PHYS : realDt;
  let tilt = g.phase === "play" ? input.read() : { x: 0, y: 0 };
  if (fx.reverse) tilt = { x: -tilt.x, y: -tilt.y };

  let { accel, damp, maxSpeed, bounce } = PLAYER;
  if (fx.dash) { accel *= DASH_MULT; maxSpeed *= DASH_MULT; }
  if (fx.ice) { accel *= ICE_ACCEL; damp *= ICE_DAMP; bounce = ICE_BOUNCE; }
  if (fx.slow) accel *= SLOW_SENS;

  b.vx += tilt.x * accel * dt;
  b.vy += tilt.y * accel * dt;
  if (fx.assist) assist(b, tilt, dt);
  const k = Math.exp(-damp * dt);
  b.vx *= k;
  b.vy *= k;
  let speed = Math.hypot(b.vx, b.vy);
  if (speed > maxSpeed) {
    b.vx *= maxSpeed / speed;
    b.vy *= maxSpeed / speed;
    speed = maxSpeed;
  }

  // すり抜け防止に、1 回で進む距離が半径の半分以下になるよう分割する
  const n = Math.max(1, Math.ceil(speed * dt / (BALL_R * 0.5)));
  let impact = 0;
  for (let i = 0; i < n; i++) {
    b.x += b.vx * dt / n;
    b.y += b.vy * dt / n;
    if (!fx.ghost) impact = Math.max(impact, collide(b, bounce));
    const lo = WALL_HALF + BALL_R;
    b.x = Math.min(COLS - lo, Math.max(lo, b.x));
    b.y = Math.min(ROWS - lo, Math.max(lo, b.y));
  }
  if (impact > 1.2) {
    sfx.bump(Math.min(1, impact / 6));
    if (impact > 3.5) navigator.vibrate?.(10);
  }
}

/**
 * 通路の真ん中を走るアシスト。進みたい向き（強く傾けていればその向き、弱ければ今の進行方向）と
 * 垂直な方向にだけ、マスの中心線へ引き寄せる。曲がるときは傾けた向きに切り替わるので邪魔をしない
 */
function assist(b, tilt, dt) {
  const strong = Math.hypot(tilt.x, tilt.y) > 0.3;
  const horizontal = strong ? Math.abs(tilt.x) >= Math.abs(tilt.y) : Math.abs(b.vx) >= Math.abs(b.vy);
  if (horizontal) {
    const cy = Math.floor(b.y) + 0.5;
    b.vy += ((cy - b.y) * ASSIST_K - b.vy * ASSIST_D) * dt;
  } else {
    const cx = Math.floor(b.x) + 0.5;
    b.vx += ((cx - b.x) * ASSIST_K - b.vx * ASSIST_D) * dt;
  }
}

/** 壁との衝突を解決し、いちばん強くぶつかった速さを返す */
function collide(b, bounce) {
  let impact = 0;
  for (const r of maze.rects) {
    if (b.x < r.x0 - BALL_R || b.x > r.x1 + BALL_R || b.y < r.y0 - BALL_R || b.y > r.y1 + BALL_R) continue;
    const qx = Math.min(r.x1, Math.max(r.x0, b.x));
    const qy = Math.min(r.y1, Math.max(r.y0, b.y));
    let dx = b.x - qx, dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= BALL_R * BALL_R) continue;
    let nx, ny, push;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = dx / d; ny = dy / d;
      push = BALL_R - d;
    } else {
      // 中心が壁の中（すり抜け終了直後など）: いちばん浅い向きへ押し出す
      const pens = [[b.x - r.x0, -1, 0], [r.x1 - b.x, 1, 0], [b.y - r.y0, 0, -1], [r.y1 - b.y, 0, 1]];
      const [pen, px, py] = pens.reduce((m, p) => (p[0] < m[0] ? p : m));
      nx = px; ny = py;
      push = pen + BALL_R;
    }
    b.x += nx * push;
    b.y += ny * push;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + bounce) * vn * nx;
      b.vy -= (1 + bounce) * vn * ny;
      impact = Math.max(impact, -vn);
    }
  }
  return impact;
}

// ---------------------------------------------------------------- アイテム

function checkItems() {
  const b = game.ball;
  for (const it of game.items) {
    if (it.taken || Math.hypot(it.x - b.x, it.y - b.y) > PICK_DIST) continue;
    it.taken = true;
    applyItem(it);
  }
}

function applyItem(it) {
  const def = ITEMS[it.kind];
  const fx = game.effects;
  const b = game.ball;
  if (!def.good && fx.barrier) {
    sfx.guard();
    scene.burst(it.x, it.y, "#50c8ff", 16);
    showPopup(def, "ガード！ 効果を無効化した");
    return;
  }
  if (def.special) {
    scene.burst(it.x, it.y, "#ffc83d", 40, { up: 5 });
    scene.burst(it.x, it.y, "#ff6b4a", 30, { up: 4 });
    sfx.jackpot();
    navigator.vibrate?.([40, 40, 80]);
  } else {
    scene.burst(it.x, it.y, def.good ? "#ffc83d" : "#9b4dff", 20);
    if (def.good) sfx.good(); else { sfx.bad(); navigator.vibrate?.(60); }
  }
  showPopup(def);
  if (def.time) {
    game.offset += def.time;
    floatTime(def.time);
  }

  switch (it.kind) {
    case "warp": {
      const path = maze.pathToGoal(maze.cellAt(b.x, b.y));
      const to = path[Math.min(WARP_STEPS, path.length - 1)];
      scene.burst(b.x, b.y, "#ff6b4a", 24, { up: 4 });
      b.x = maze.cx(to) + 0.5;
      b.y = maze.cy(to) + 0.5;
      b.vx = b.vy = 0;
      scene.snapCamera(b.x, b.y);
      scene.burst(b.x, b.y, "#ff6b4a", 24, { up: 4 });
      sfx.warp();
      break;
    }
    case "barrier":
      for (const k of Object.keys(fx)) if (!ITEMS[k].good) delete fx[k];
      fx.barrier = def.duration;
      break;
    default:
      if (def.duration) fx[it.kind] = def.duration;
  }
}

function tickEffects(dt) {
  for (const k of Object.keys(game.effects)) {
    game.effects[k] -= dt;
    if (game.effects[k] <= 0) delete game.effects[k];
  }
}

// ---------------------------------------------------------------- 演出

let popupTimer = 0;
function showPopup(def, note) {
  const el = $("popup");
  el.className = `popup ${def.special ? "special" : def.good ? "good" : "bad"}`;
  $("popupImg").src = stickerSrc(def.sticker);
  $("popupName").textContent = def.name;
  $("popupEffect").textContent = note ?? def.effect;
  el.hidden = false;
  void el.offsetWidth;   // アニメーションをやり直す
  el.classList.add("show");
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => { el.hidden = true; }, POPUP_MS);
}

function floatTime(sec) {
  const el = document.createElement("div");
  el.className = `float-time ${sec < 0 ? "good" : "bad"}${Math.abs(sec) >= 10 ? " big" : ""}`;
  el.textContent = `${sec < 0 ? "−" : "+"}${Math.abs(sec).toFixed(1)}`;
  $("timerBox").append(el);
  setTimeout(() => el.remove(), 1200);
}

function showCount(n) {
  const el = $("countdown");
  el.hidden = false;
  el.textContent = n > 0 ? n : "GO!";
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  sfx.count(n <= 0);
  if (n <= 0) setTimeout(() => { el.hidden = true; }, 600);
}

// 状態アイコン（残り時間のバーつき）
const chips = new Map();
function clearChips() {
  chips.clear();
  $("chips").replaceChildren();
}

function updateChips() {
  const fx = game.effects;
  for (const [k, el] of chips) {
    if (!(k in fx)) { el.remove(); chips.delete(k); }
  }
  for (const k of Object.keys(fx)) {
    let el = chips.get(k);
    if (!el) {
      el = document.createElement("div");
      el.className = `chip ${ITEMS[k].good ? "good" : "bad"}`;
      el.innerHTML = `<img alt="" src="${stickerSrc(ITEMS[k].sticker)}"><i></i>`;
      el.title = ITEMS[k].name;
      $("chips").append(el);
      chips.set(k, el);
    }
    el.style.setProperty("--p", fx[k] / ITEMS[k].duration);
  }
}

// ---------------------------------------------------------------- ゴースト

function ghostAt(t) {
  const tr = game.ghost;
  if (!tr) return null;
  const n = tr.length / 2;
  const f = Math.min(t * GHOST_HZ, n - 1);
  const i = Math.floor(f), j = Math.min(i + 1, n - 1), u = f - i;
  const ax = tr[i * 2], ay = tr[i * 2 + 1], bx = tr[j * 2], by = tr[j * 2 + 1];
  // ワープした所は補間しない
  if (Math.hypot(bx - ax, by - ay) > 1.5) return { x: ax, y: ay };
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u };
}

function recordTrace() {
  const need = Math.floor(game.elapsed * GHOST_HZ) + 1;
  while (game.trace.length / 2 < need) {
    game.trace.push(Math.round(game.ball.x * 100) / 100, Math.round(game.ball.y * 100) / 100);
  }
}

// ---------------------------------------------------------------- メインループ

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;

  if (game) {
    if (game.phase === "count") {
      const before = Math.ceil(game.countdown);
      game.countdown -= dt;
      const after = Math.ceil(game.countdown);
      if (after !== before) showCount(after);
      if (game.countdown <= 0) {
        game.phase = "play";
        input.calibrate();
      }
    }
    if (game.phase === "play") {
      game.elapsed += game.effects.slow ? dt * SLOW_CLOCK : dt;
      recordTrace();
      step(dt);
      checkItems();
      tickEffects(dt);
      setTempoRate(game.effects.slow ? SLOW_TEMPO : 1);
      const b = game.ball;
      if (Math.hypot(maze.cx(maze.goal) + 0.5 - b.x, maze.cy(maze.goal) + 0.5 - b.y) < GOAL_DIST) finish();
    } else if (game.phase === "clear") {
      step(dt);
    }
    const tilt = updateHud();
    scene.update({
      ball: game.ball,
      items: game.items,
      effects: game.effects,
      ghostPos: game.phase === "play" ? ghostAt(game.elapsed) : null,
      tilt, time, dt: game.phase === "paused" ? 0 : dt,
    });
    updateOverlays();
  } else if (maze && itemTextures) {
    const s = maze.start;
    scene.update({
      ball: { x: maze.cx(s) + 0.5, y: maze.cy(s) + 0.5, r: BALL_R },
      items: maze.items, effects: {}, ghostPos: null,
      tilt: { x: 0, y: 0 }, time, dt, title: true,
    });
  }
  requestAnimationFrame(frame);
}

/** HUD を更新し、見た目用の傾き（なめらかにしたもの）を返す */
function updateHud() {
  const total = game.elapsed + game.offset;
  $("timer").textContent = fmtTime(total);
  $("timer").classList.toggle("minus", total <= -0.005);
  updateChips();

  const t = game.phase === "play" ? input.read() : { x: 0, y: 0 };
  tiltVis.x += (t.x - tiltVis.x) * 0.25;
  tiltVis.y += (t.y - tiltVis.y) * 0.25;
  $("levelDot").style.transform = `translate(${tiltVis.x * 15}px, ${tiltVis.y * 15}px)`;
  const stick = $("stick");
  const a = input.touchAnchor;
  stick.hidden = !(a && input.mode === "touch");
  if (a) {
    stick.style.left = `${a.x}px`;
    stick.style.top = `${a.y}px`;
    $("stickKnob").style.transform = `translate(${t.x * 36}px, ${t.y * 36}px)`;
  }
  return tiltVis;
}

/** 暗闇（ボールのまわりだけ見える）とスローモーションの画面効果 */
function updateOverlays() {
  const fx = game.effects;
  const dark = $("dark");
  dark.hidden = !fx.dark;
  if (fx.dark) {
    const p = scene.project(game.ball.x, game.ball.y, view.w, view.h);
    dark.style.background = `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(10, 5, 20, 0) ${p.cell * 0.6}px, rgba(10, 5, 20, 0.97) ${p.cell * 1.6}px)`;
  }
  document.body.classList.toggle("slowmo", !!fx.slow);
  updateMarkers();
}

// 画面の外にあるお宝・ぶっ壊れの方向を、画面の端の矢印で知らせる
const markers = new Map();
function updateMarkers() {
  const pad = 28;
  const box = { x0: pad, y0: pad + 70, x1: view.w - pad, y1: view.h - pad };
  for (const it of game.items) {
    if (!ITEMS[it.kind].special) continue;
    let el = markers.get(it);
    if (!el) {
      el = document.createElement("div");
      el.className = `marker ${it.kind}`;
      el.innerHTML = `<i></i><span>${ITEMS[it.kind].time}</span>`;
      $("markers").append(el);
      markers.set(it, el);
    }
    const p = scene.project(it.x, it.y, view.w, view.h);
    const inside = p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1 && p.front;
    el.hidden = it.taken || inside || game.phase !== "play";
    if (el.hidden) continue;
    // 画面の中心から目標へ向かう線が、枠とぶつかる所に置く
    const cx = view.w / 2, cy = view.h / 2;
    let dx = p.x - cx, dy = p.y - cy;
    if (!p.front) { dx = -dx; dy = -dy; }
    const kx = ((dx > 0 ? box.x1 : box.x0) - cx) / (dx || 1e-6);
    const ky = ((dy > 0 ? box.y1 : box.y0) - cy) / (dy || 1e-6);
    const k = Math.min(kx, ky);
    el.style.left = `${cx + dx * k}px`;
    el.style.top = `${cy + dy * k}px`;
    el.style.setProperty("--a", `${Math.atan2(dy, dx)}rad`);
  }
}

function clearMarkers() {
  markers.clear();
  $("markers").replaceChildren();
}

// ---------------------------------------------------------------- 画面

function resize() {
  view.w = innerWidth;
  view.h = innerHeight;
  scene.resize(view.w, view.h);
}

function renderTitle() {
  $("titleDate").textContent = `${fmtDate(date)} の迷路`;
  const rec = loadRecord(date);
  $("titleBest").textContent = rec.time != null
    ? `今日のベスト ${fmtTime(rec.time)} 秒（${rec.plays} 回プレイ）`
    : rec.plays ? `まだクリアしていません（${rec.plays} 回プレイ）` : "今日の迷路にまだ挑戦していません";
  const list = recentRecords(7);
  $("history").hidden = !list.length;
  $("historyList").replaceChildren(...list.map(r => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${fmtDate(r.date)}</span><b>${fmtTime(r.time)} 秒</b>`;
    return li;
  }));
  const isTouch = matchMedia("(pointer: coarse)").matches;
  $("controlHint").textContent = isTouch
    ? "スマホを傾けてボールを転がそう（センサーが使えないときはドラッグ）"
    : "マウスのある方向へボールが転がります（矢印キー / WASD でも OK）";
}

function renderHelp() {
  const rows = Object.values(ITEMS).map(def => `
    <li class="${def.special ? "special" : def.good ? "good" : "bad"}">
      <img alt="" src="${stickerSrc(def.sticker)}">
      <div><b>${def.name}</b><span>${def.effect}</span></div>
    </li>`);
  $("itemList").innerHTML = rows.join("");
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* 対応していなければ何もしない */ }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------- 起動

async function boot() {
  resize();
  prepareMaze();
  renderTitle();
  renderHelp();
  $("title").hidden = false;

  const ids = new Set([
    ...Object.values(ITEMS).map(d => d.sticker),
    ...Object.values(UI_STICKERS),
  ]);
  const loaded = await Promise.all([...ids].map(async id => [id, await loadImage(stickerSrc(id))]));
  images = Object.fromEntries(loaded);
  scene.setRider(await loadImage(PLAYER.avatar));
  // 迷路を組み立て終わるまで itemTextures は null のまま（frame() が描き始めないように）
  const tex = { tex: {}, good: {}, special: {}, aura: {} };
  const { CanvasTexture, SRGBColorSpace } = await import("../vendor/three.module.min.js");
  for (const [k, d] of Object.entries(ITEMS)) {
    const t = new CanvasTexture(makeItemTexture(images[d.sticker], d.good, d.special));
    t.colorSpace = SRGBColorSpace;
    tex.tex[k] = t;
    tex.good[k] = d.good;
    tex.special[k] = !!d.special;
    tex.aura[k] = !!d.aura;
  }
  scene.build(maze, tex);
  itemTextures = tex;
  renderTitle();
  $("start").disabled = false;
  $("loading").hidden = true;
}

$("start").addEventListener("click", async () => {
  unlock();
  startBgm();
  $("start").disabled = true;
  await input.enableSensor();   // iOS の許可ダイアログはここで出る
  $("start").disabled = false;
  newGame();
});
$("helpBtn").addEventListener("click", () => { $("help").hidden = false; });
$("helpClose").addEventListener("click", () => { $("help").hidden = true; });
$("pauseBtn").addEventListener("click", pause);
$("resume").addEventListener("click", resume);
$("restart").addEventListener("click", newGame);
$("pauseTitle").addEventListener("click", toTitle);
$("retry").addEventListener("click", newGame);
$("clearTitle").addEventListener("click", toTitle);
$("calib").addEventListener("click", () => {
  input.calibrate();
  $("calib").classList.remove("flash");
  void $("calib").offsetWidth;
  $("calib").classList.add("flash");
});

function syncMute() {
  $("mute").textContent = isMuted() ? "🔇" : "🔊";
  $("mute").setAttribute("aria-pressed", String(isMuted()));
}
$("mute").addEventListener("click", () => { unlock(); setMuted(!isMuted()); syncMute(); });
syncMute();

function syncBgmBtn() {
  for (const id of ["bgm", "titleBgm"]) {
    $(id).classList.toggle("off", !isBgmOn());
    $(id).setAttribute("aria-pressed", String(!isBgmOn()));
  }
  $("titleBgm").textContent = isBgmOn() ? "🎵 BGM オン" : "🎵 BGM オフ";
}
for (const id of ["bgm", "titleBgm"]) {
  $(id).addEventListener("click", () => { setBgmOn(!isBgmOn()); syncBgmBtn(); });
}
syncBgmBtn();

// 音は最初のユーザー操作のあとでないと鳴らせないので、BGM はそこから始める
function firstGesture() {
  window.removeEventListener("pointerdown", firstGesture, true);
  window.removeEventListener("keydown", firstGesture, true);
  unlock();
  startBgm();
}
window.addEventListener("pointerdown", firstGesture, true);
window.addEventListener("keydown", firstGesture, true);

$("shareBtn").addEventListener("click", async () => {
  const url = location.origin + location.pathname;
  if (navigator.share) {
    try { await navigator.share({ text: shareText, url }); } catch { /* キャンセル */ }
  } else {
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      $("shareBtn").textContent = "コピーしました";
      setTimeout(() => { $("shareBtn").textContent = "シェア"; }, 1500);
    } catch { /* 何もしない */ }
  }
});
$("shareX").addEventListener("click", () => {
  const url = location.origin + location.pathname;
  const q = new URLSearchParams({ text: shareText, url });
  window.open(`https://x.com/intent/post?${q}`, "_blank", "noopener");
});

window.addEventListener("resize", resize);
window.addEventListener("keydown", e => {
  if (e.code === "Escape" || e.code === "KeyP") {
    if (game?.phase === "play") pause();
    else if (game?.phase === "paused") resume();
  }
  if (e.code === "Enter" && !$("title").hidden && !$("start").disabled) $("start").click();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
  else if (game && game.phase !== "clear" && game.phase !== "paused") requestWakeLock();
});

if (debug) window.husmaze = { get game() { return game; }, get maze() { return maze; }, input, scene };

boot();
requestAnimationFrame(frame);
