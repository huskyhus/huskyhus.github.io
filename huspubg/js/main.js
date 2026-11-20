// 画面の切りかえと通信のつなぎ。
//   ルームを作る: Sim（正本）をこのページで動かし、PeerJS で来た人のメッセージを検査して渡す。ホスト本人は通信を通さずに渡す
//   ルームに入る: ホストへつなぎ、届いたものは検査してから Game へ
//   ひとりで練習: ルームを作るのと同じだが、通信はしない（CPU と戦う）

import { VERSION } from "./version.js";
import { hostRoom, joinRoom, randomRoom, isRoomCode } from "./net.js";
import { Sim, PH, TICK_HZ } from "./sim.js";
import { checkFromClient, checkFromHost, parse, MAX_FROM_HOST, MAX_PLAYERS, cleanName, MODE } from "./protocol.js";
import { AVATARS, STICKER_NAMES, stickerSrc, STK } from "./items.js";
import { Renderer, SLOT_COLORS } from "./render.js";
import { Input } from "./input.js";
import { Hud } from "./hud.js";
import { Game } from "./game.js";
import * as sfx from "./sfx.js";

const $ = id => document.getElementById(id);
const SETTINGS_KEY = "huspubg.settings";

// ---- 設定 ----
const settings = { name: "", av: (Math.random() * 24) | 0, sens: 1, vol: 0.6, fov: 80 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch { /* 読めなければ初期値 */ }
settings.av = Math.max(0, Math.min(AVATARS.length - 1, settings.av | 0));
settings.sens = Math.max(0.2, Math.min(3, Number(settings.sens) || 1));
settings.vol = Math.max(0, Math.min(1, Number(settings.vol) || 0));
settings.fov = Math.max(60, Math.min(100, Number(settings.fov) || 80));
settings.name = cleanName(settings.name);
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 保存できなくても遊べる */ } };
sfx.setVolume(settings.vol);

// ---- 状態 ----
const S = {
  mode: null,       // "host" | "solo" | "client"
  net: null, sim: null, timer: 0,
  mySlot: 0, lobby: null, game: null, ready: 0, helloTimer: 0, seed: -1,
};

const renderer = new Renderer($("view"));
const input = new Input($("view"));
const hud = new Hud();

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
  input.enabled = id === "game";
  if (id !== "game") input.unlock();
}

// ---- タイトル ----
$("ver").textContent = `v${VERSION}`;
$("nameIn").value = settings.name;
$("nameIn").addEventListener("input", () => { settings.name = cleanName($("nameIn").value); save(); sendHello(); });
function buildAvatars(el) {
  el.textContent = "";
  AVATARS.forEach((id, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "av" + (i === settings.av ? " on" : "");
    b.title = STICKER_NAMES[id];
    const im = document.createElement("img"); im.src = stickerSrc(id); im.alt = STICKER_NAMES[id];
    b.append(im);
    b.addEventListener("click", () => {
      if (b.classList.contains("taken")) return;   // ほかの人が使っている（CPU が使っているなら入れかわる）
      settings.av = i; save();
      for (const x of document.querySelectorAll(".av")) x.classList.remove("on");
      for (const g of [$("avatars"), $("lobbyAvatars")]) g.children[i]?.classList.add("on");
      $("myAv").src = stickerSrc(AVATARS[i]);
      sendHello();
    });
    el.append(b);
  });
}
buildAvatars($("avatars"));
buildAvatars($("lobbyAvatars"));
$("myAv").src = stickerSrc(AVATARS[settings.av]);

function bindSlider(id, key, fmt, apply) {
  const el = $(id);
  el.value = settings[key];
  const out = $(id + "Out");
  const upd = () => { settings[key] = Number(el.value); out.textContent = fmt(settings[key]); apply?.(settings[key]); save(); };
  el.addEventListener("input", upd);
  out.textContent = fmt(settings[key]);
}
for (const [a, b] of [["sens", "sens2"], ["vol", "vol2"], ["fov", "fov2"]]) {
  const fmt = a === "sens" ? v => v.toFixed(2) : a === "vol" ? v => `${Math.round(v * 100)}%` : v => `${v}°`;
  const apply = a === "vol" ? v => sfx.setVolume(v) : null;
  bindSlider(a, a, fmt, apply);
  bindSlider(b, a, fmt, apply);
  $(a).addEventListener("input", () => { $(b).value = $(a).value; $(b + "Out").textContent = $(a + "Out").textContent; });
  $(b).addEventListener("input", () => { $(a).value = $(b).value; $(a + "Out").textContent = $(b + "Out").textContent; });
}

function setStatus(text, err = false) { $("status").textContent = text; $("status").className = err ? "status err" : "status"; }

$("hostBtn").addEventListener("click", () => startHost(false));
$("soloBtn").addEventListener("click", () => startHost(true));
$("rangeBtn").addEventListener("click", () => startHost(true, MODE.RANGE));
$("joinBtn").addEventListener("click", () => startJoin());
$("codeIn").addEventListener("keydown", e => { if (e.key === "Enter") startJoin(); });
$("codeIn").addEventListener("input", () => { $("codeIn").value = $("codeIn").value.replace(/[^0-9]/g, "").slice(0, 5); });

function busy(on) { for (const id of ["hostBtn", "soloBtn", "rangeBtn", "joinBtn"]) $(id).disabled = on; }

async function startHost(solo, mode = MODE.BR) {
  sfx.unlockAudio();
  busy(true);
  const sim = new Sim();
  S.sim = sim; S.mode = solo ? "solo" : "host";
  if (!solo) {
    setStatus("ルームを作っています…");
    let net = null, lastErr = null;
    for (let i = 0; i < 3 && !net; i++) {
      try {
        net = await hostRoom(randomRoom(), {
          accept: id => sim.addHuman(id),
          message: (id, msg) => {
            if (msg.t === "hi") sim.setHello(id, msg);
            else { const slot = sim.slotOf(id); if (slot >= 0) sim.onMessage(slot, msg); }
          },
          leave: id => sim.removeHuman(id),
        });
      } catch (e) { lastErr = e; }
    }
    if (!net) { busy(false); setStatus(lastErr?.message || "ルームを作れませんでした。", true); S.sim = null; return; }
    S.net = net;
  }
  S.mySlot = sim.addHuman("local", true);
  sim.setHello("local", { n: settings.name, a: settings.av, r: 1 });
  if (mode === MODE.RANGE) {
    // 射撃訓練場: 的（CPU 8 人）を置いて、ロビーを通らずにすぐ始める
    for (let i = 0; i < 8; i++) sim.addBot();
    sim.setMode(MODE.RANGE);
    sim.start();
  } else if (solo) for (let i = 0; i < 9; i++) sim.addBot();
  busy(false);
  setStatus("");
  S.timer = setInterval(hostTick, 1000 / TICK_HZ);
  hostTick();
}

function hostTick() {
  const sim = S.sim;
  if (!sim) return;
  sim.tick();
  const lobbyNow = sim.lobbyDirty || sim.f % TICK_HZ === 0;
  sim.lobbyDirty = false;
  const common = sim.phase !== PH.LOBBY ? sim.commonSnap() : null;
  sim.slots.forEach((s, i) => {
    if (!s || s.k !== 1) return;
    if (lobbyNow) {
      const m = sim.lobbyMsg(i);
      if (s.local) onHostMessage(checkFromHost(JSON.parse(JSON.stringify(m))));
      else S.net?.send(s.id, m);
    }
    if (common) {
      const text = sim.snapFor(i, common);
      if (s.local) { const o = parse(text, MAX_FROM_HOST); const m = o && checkFromHost(o); if (m) onHostMessage(m); }
      else S.net?.sendText(s.id, text);
    }
  });
  sim.endTick();
}

async function startJoin() {
  const code = $("codeIn").value.trim();
  if (!isRoomCode(code)) { setStatus("5 桁の部屋番号を入れてください。", true); return; }
  sfx.unlockAudio();
  busy(true);
  setStatus("ルームにつないでいます…");
  try {
    S.net = await joinRoom(code, {
      message: onHostMessage,
      lost: text => backToTitle(text),
    });
    S.mode = "client";
    setStatus("");
    sendHello();
    S.helloTimer = setInterval(() => { if (!S.game) sendHello(); }, 1000);   // 届かないこともあるので、ロビーにいる間は送り続ける
  } catch (e) {
    setStatus(e.message || "つながりませんでした。", true);
  }
  busy(false);
}

/** ホストへ送る（ホスト本人は検査を通して Sim へ直接） */
function send(obj) {
  if (S.mode === "client") { S.net?.send(obj); return; }
  if (!S.sim) return;
  const m = checkFromClient(JSON.parse(JSON.stringify(obj)));
  if (!m) return;
  if (m.t === "hi") S.sim.setHello("local", m);
  else S.sim.onMessage(S.mySlot, m);
}
function sendHello() {
  if (!S.mode) return;
  send({ t: "hi", n: settings.name, a: settings.av, r: S.mode === "client" ? S.ready : 1 });
}

// ---- ホストからのメッセージ（検査済み） ----
function onHostMessage(msg) {
  if (!msg) return;
  if (msg.t === "lb") {
    S.lobby = msg;
    S.mySlot = msg.you;
    if (S.game) S.game.lobby = msg;
    if (msg.ph === PH.LOBBY) {
      if (S.game) { endGame(); S.ready = 0; sendHello(); }
      showLobby();
    } else if (!S.game && msg.P[msg.you]?.m) {
      startGame(msg.seed);
    }
    return;
  }
  if (msg.t === "st" && S.game) S.game.onSnap(msg);
}

// ---- ロビー ----
function showLobby() {
  show("lobby");
  const L = S.lobby;
  const isHost = S.mode !== "client";
  $("roomCode").textContent = S.mode === "solo" ? "ひとりで練習" : S.mode === "host" ? S.net?.code ?? "" : $("codeIn").value;
  $("roomLabel").hidden = S.mode === "solo";
  $("hostCtl").hidden = !isHost;
  $("readyBtn").hidden = isHost;
  $("readyBtn").textContent = S.ready ? "準備OK！（取り消す）" : "準備OK";
  $("readyBtn").classList.toggle("on", !!S.ready);
  const list = $("players");
  list.textContent = "";
  if (!L) return;
  let n = 0;
  L.P.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "prow" + (p.k ? "" : " empty");
    row.style.setProperty("--c", SLOT_COLORS[i]);
    if (p.k) {
      n++;
      const im = document.createElement("img"); im.src = stickerSrc(AVATARS[p.a]); im.alt = "";
      const nm = document.createElement("span"); nm.className = "pn"; nm.textContent = p.n || "（名前なし）";
      const tag = document.createElement("span"); tag.className = "ptag";
      tag.textContent = p.k === 2 ? "CPU" : i === 0 ? "ホスト" : p.r ? "準備OK" : "準備中…";
      if (p.k === 1 && (p.r || i === 0)) tag.classList.add("ok");
      if (i === L.you) nm.textContent += "（あなた）";
      row.append(im, nm, tag);
    } else {
      const nm = document.createElement("span"); nm.className = "pn"; nm.textContent = "あき";
      row.append(nm);
    }
    list.append(row);
  });
  if (isHost) {
    const humans = L.P.filter(p => p.k === 1);
    const allReady = humans.every((p, i) => p.r || i === 0);
    $("startBtn").disabled = n < 2;
    $("startHint").textContent = n < 2 ? "2 人以上（CPU を足しても OK）で始められます" : allReady ? "" : "準備中の人がいます（このまま始めることもできます）";
    const full = n >= MAX_PLAYERS, anyBot = L.P.some(p => p.k === 2);
    for (const id of ["addBot", "add5Bot", "fillBot"]) $(id).disabled = full;
    for (const id of ["delBot", "clearBot"]) $(id).disabled = !anyBot;
  }
  $("pcount").textContent = `${n} / ${MAX_PLAYERS}`;
  // モード（決めるのはホスト。ほかの人には表示だけ）
  const md = L.md ?? MODE.BR;
  $("modeBR").classList.toggle("on", md === MODE.BR);
  $("modeT").classList.toggle("on", md === MODE.TEAM);
  $("modeBR").disabled = $("modeT").disabled = !isHost;
  const humans = L.P.filter(p => p.k === 1).length, bots = L.P.filter(p => p.k === 2).length;
  $("modeInfo").textContent = md === MODE.TEAM
    ? `人間 ${humans} 人のチーム vs CPU ${bots} 人のチーム。CPU もふつうに武器を拾って戦う。どちらかが全滅したら決着（味方には当たらない）`
    : "最後の 1 人になったら勝ち";
  if (isHost && md === MODE.TEAM && !bots) $("startHint").textContent = "チーム戦は CPU を 1 人以上足してください";
  if (isHost) $("startBtn").disabled = n < 2 || (md === MODE.TEAM && !bots);
  // アバター: ほかの人が使っているものは選べない。CPU が使っているものは選ぶと入れかわる
  const mine = L.P[L.you]?.a;
  for (const g of [$("avatars"), $("lobbyAvatars")]) {
    [...g.children].forEach((b, i) => {
      const owner = L.P.findIndex((p, k) => p.k && k !== L.you && p.a === i);
      b.classList.toggle("on", i === mine);
      b.classList.toggle("taken", owner >= 0 && L.P[owner].k === 1);
      b.classList.toggle("bot", owner >= 0 && L.P[owner].k === 2);
      b.title = STICKER_NAMES[AVATARS[i]] + (owner >= 0 ? `（${L.P[owner].n} が使用中）` : "");
    });
  }
  if (mine !== undefined) $("myAv").src = stickerSrc(AVATARS[mine]);
}
$("addBot").addEventListener("click", () => S.sim?.addBot());
$("delBot").addEventListener("click", () => S.sim?.removeBot());
$("add5Bot").addEventListener("click", () => { for (let i = 0; i < 5; i++) S.sim?.addBot(); });
$("fillBot").addEventListener("click", () => S.sim?.fillBots());
$("clearBot").addEventListener("click", () => { for (let i = 0; i < MAX_PLAYERS; i++) S.sim?.removeBot(); });
$("startBtn").addEventListener("click", () => { S.sim?.start(); });
$("modeBR").addEventListener("click", () => S.sim?.setMode(MODE.BR));
$("modeT").addEventListener("click", () => S.sim?.setMode(MODE.TEAM));
$("readyBtn").addEventListener("click", () => { S.ready = S.ready ? 0 : 1; sendHello(); showLobby(); });
$("leaveBtn").addEventListener("click", () => backToTitle(""));
$("copyBtn").addEventListener("click", () => { navigator.clipboard?.writeText($("roomCode").textContent).catch(() => {}); });

// ---- 対戦 ----
function startGame(seed) {
  show("game");
  $("results").hidden = true;
  $("pause").hidden = true;
  S.game = new Game({
    renderer, input, hud, send, mySlot: S.mySlot, lobby: S.lobby, seed, settings,
    onOver: (R, info) => showResults(R, info),
  });
  input.lock();
  last = performance.now();
}
function endGame() {
  S.game?.dispose();
  S.game = null;
  $("results").hidden = true;
}

function showResults(R, info = {}) {
  input.unlock();
  const el = $("resultList");
  el.textContent = "";
  const sorted = (R || []).slice().sort((a, b) => a[1] - b[1]);
  const mine = sorted.find(r => r[0] === S.mySlot);
  if (info.mode === MODE.TEAM) {
    // チーム戦: 人間はみんな人間チーム
    const win = info.winTeam === 1;
    $("resultImg").src = stickerSrc(win ? STK.kando : STK.yatchi);
    $("resultTitle").textContent = win ? "人間チームの勝ち！CPU チームを全滅させた！" : "CPU チームの勝ち… 人間チームは全滅";
  } else {
    const win = mine && mine[1] === 1;
    $("resultImg").src = stickerSrc(win ? STK.kando : STK.yatchi);
    $("resultTitle").textContent = win ? "勝った！勝った！今夜はハス勝だ！！" : mine ? `#${mine[1]}　また挑戦しよう` : "対戦終了";
  }
  for (const [slot, rank, kills, dmg] of sorted) {
    const p = S.lobby?.P[slot];
    const row = document.createElement("div");
    row.className = "rrow" + (slot === S.mySlot ? " me" : "");
    row.style.setProperty("--c", SLOT_COLORS[slot]);
    const r = document.createElement("b"); r.textContent = `#${rank}`;
    const im = document.createElement("img"); im.src = stickerSrc(AVATARS[p?.a ?? 0]); im.alt = "";
    const n = document.createElement("span"); n.className = "pn"; n.textContent = p?.n || `P${slot + 1}`;
    const k = document.createElement("span"); k.textContent = `キル ${kills}`;
    const d = document.createElement("span"); d.textContent = `ダメージ ${dmg}`;
    row.append(r, im, n, k, d);
    el.append(row);
  }
  $("resultBack").textContent = S.mode === "client" ? "ホストがロビーに戻すのを待っています…" : "ロビーに戻る";
  $("resultBack").disabled = S.mode === "client";
  $("results").hidden = false;
}
$("resultBack").addEventListener("click", () => { S.sim?.backToLobby(); });

// ポーズ（ポインターロックが外れた時）
input.onLockChange = locked => {
  if (!S.game) return;
  $("pause").hidden = locked || !$("results").hidden || S.game.menuOpen;   // 所持品メニューを開いている間は一時停止の画面を出さない
};
$("resumeBtn").addEventListener("click", () => input.lock());
$("quitBtn").addEventListener("click", () => backToTitle(""));

function backToTitle(text) {
  endGame();
  clearInterval(S.timer); clearInterval(S.helloTimer);
  try { S.net?.close(); } catch { /* もう閉じている */ }
  S.net = null; S.sim = null; S.mode = null; S.lobby = null; S.ready = 0;
  show("title");
  setStatus(text || "", !!text);
}

// ---- 描画ループ ----
let last = performance.now();
function loop() {
  const t = performance.now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (S.game) S.game.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener("beforeunload", () => { try { S.net?.close(); } catch { /* 無視 */ } });
show("title");
if (location.hash === "#debug") window.__S = S;   // 動作確認用（URL の末尾に #debug を付けた時だけ）
