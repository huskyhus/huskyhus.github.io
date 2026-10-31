// 画面の流れと、ホスト / クライアントの進行。
//   タイトル → ルームを作る（ホスト）/ ルームに入る（クライアント）/ 練習（通信なしのホスト）→ ロビー → 対戦 → 結果 → ロビー
// ホストは対戦を計算し（sim.js）、30 回/秒スナップショットを配る。クライアントは入力を 60 回/秒送り、届いたスナップショットを補間して描く。
// 通信はすべて state の同期なので（ロビーの状態も対戦の状態も毎回まるごと送る）、何通か落ちても次の 1 通で元に戻る。

import { MOVES, MOVE_BY_ID, DEFAULT_LOADOUT, BUTTONS, stickerSrc, isValidLoadout, moveStats } from "./moves.js";
import { Sim, cpuInput, EMPTY_INPUT, PHASES } from "./sim.js";
import { expandSnapshot, cleanName } from "./protocol.js";
import { hostRoom, joinRoom, randomRoom, isRoomCode } from "./net.js";
import { Renderer, COLORS } from "./render.js";
import { Input, PressTracker } from "./input.js";
import { unlockAudio, playSong, isOn as bgmOn, setOn as setBgm } from "./bgm.js";
import { sfx, isMuted, setMuted } from "./sfx.js";

const $ = id => document.getElementById(id);
const KEY = { name: "hussmash.name", loadout: "hussmash.loadout" };
const STEP = 1000 / 60;
const LOBBY_EVERY_MS = 400, HELLO_EVERY_MS = 800;
const INTERP_DELAY = 5;   // クライアントは何フレーム遅れて描くか（揺れを吸収するため）

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } };

const me = {
  name: cleanName(load(KEY.name, "")) || "",
  loadout: (() => { const l = load(KEY.loadout, null); return isValidLoadout(l) ? l : DEFAULT_LOADOUT.slice(); })(),
};
const myName = () => me.name || "ハスキー";

const renderer = new Renderer($("stage"));
const input = new Input({
  zone: $("stickZone"), base: $("stickBase"), knob: $("stickKnob"),
  buttons: [...document.querySelectorAll("#controls [data-bit]")],
});
const isTouch = matchMedia("(pointer: coarse)").matches;

// ---- 進行の状態 ----

const S = {
  role: null,          // "host" | "client" | null
  offline: false,      // 練習
  net: null,
  room: "",
  screen: "title",
  // ホスト
  slots: [null, null, null, null],   // { kind: 1 人 / 2 CPU, name, loadout, peerId, input, seq, tracker, hello }
  stocks: 3,
  sim: null,
  // クライアント
  you: 0,
  roster: [null, null, null, null],
  phase: "lobby",
  snaps: [],
  clockOffset: null,
  inSeq: 0,
  // 共通
  lastEvent: 0,
  lastCount: -1,
  lastPhase: "",
  resultShown: false,
};

// ---- 画面 ----

function show(name) {
  S.screen = name;
  for (const id of ["title", "lobby", "game"]) $(id).hidden = id !== name;
  input.setEnabled(name === "game");
  if (name !== "game") $("result").hidden = true;
  playSong(name === "game" ? "battle" : "title");
  if (name === "game") { requestWakeLock(); renderer.resize(); }
}

let toastTimer = 0;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c) e.append(c);
  return e;
}

// ---- タイトル ----

function renderLoadout() {
  const box = $("loadoutView");
  box.replaceChildren(...me.loadout.map((id, i) => {
    const m = MOVE_BY_ID[id];
    return el("div", { class: "lo-card" }, [
      el("img", { src: stickerSrc(m.sticker), alt: "" }),
      el("span", { class: "btn-letter", text: BUTTONS[i] }),
      el("div", { text: m.name }),
      el("div", { class: "kind", text: m.kind }),
    ]);
  }));
  document.querySelectorAll(".mbtn").forEach(b => {
    const i = Number(b.dataset.bit);
    b.querySelector("img").src = stickerSrc(MOVE_BY_ID[me.loadout[i]].sticker);
  });
}

function syncToggles() {
  $("bgmBtn").setAttribute("aria-pressed", String(bgmOn()));
  $("sfxBtn").setAttribute("aria-pressed", String(!isMuted()));
}

$("nameInput").value = me.name;
$("nameInput").addEventListener("input", () => {
  me.name = cleanName($("nameInput").value);
  save(KEY.name, me.name);
});
$("roomInput").addEventListener("input", () => {
  $("roomInput").value = $("roomInput").value.replace(/[^0-9]/g, "").slice(0, 5);
});
$("roomInput").addEventListener("keydown", e => { if (e.key === "Enter") $("joinBtn").click(); });

let busy = false;
function setBusy(v, text = "") {
  busy = v;
  for (const id of ["createBtn", "joinBtn", "practiceBtn"]) $(id).disabled = v;
  $("titleMsg").textContent = text;
}

$("createBtn").addEventListener("click", async () => {
  if (busy) return;
  firstGesture();
  setBusy(true, "ルームを作っています…");
  let lastErr = null;
  for (let tries = 0; tries < 4; tries++) {
    const code = randomRoom();
    try {
      const net = await hostRoom(code, { accept: hostAccept, message: hostMessage, leave: hostLeave });
      setBusy(false);
      startHost(net, code);
      return;
    } catch (e) {
      lastErr = e;
      if (!/すでに使われて/.test(e.message)) break;
    }
  }
  setBusy(false, lastErr?.message || "ルームを作れませんでした。");
});

$("joinBtn").addEventListener("click", async () => {
  if (busy) return;
  const code = $("roomInput").value.trim();
  if (!isRoomCode(code)) { $("titleMsg").textContent = "5 桁のルーム番号を入れてください。"; return; }
  firstGesture();
  setBusy(true, `ルーム ${code} につないでいます…`);
  try {
    const net = await joinRoom(code, { message: clientMessage, lost: clientLost });
    setBusy(false);
    startClient(net, code);
  } catch (e) {
    setBusy(false, e.message);
  }
});

$("practiceBtn").addEventListener("click", () => {
  if (busy) return;
  firstGesture();
  startHost(null, "");
  addCpu();
});

$("editBtn").addEventListener("click", openEditor);
$("lobbyEditBtn").addEventListener("click", openEditor);
$("helpBtn").addEventListener("click", () => { $("help").hidden = false; });
$("helpClose").addEventListener("click", () => { $("help").hidden = true; });
$("bgmBtn").addEventListener("click", () => { firstGesture(); setBgm(!bgmOn()); syncToggles(); });
$("sfxBtn").addEventListener("click", () => { firstGesture(); setMuted(!isMuted()); syncToggles(); sfx("ui"); });

// ---- 技の選択 ----

let editSel = 0, editFocus = null;

function openEditor() {
  editSel = 0;
  editFocus = me.loadout[0];
  renderEditor();
  $("editor").hidden = false;
}

function renderEditor() {
  $("editSlots").replaceChildren(...me.loadout.map((id, i) => {
    const m = MOVE_BY_ID[id];
    const b = el("button", { class: "edit-slot" + (i === editSel ? " sel" : ""), type: "button" }, [
      el("b", { text: BUTTONS[i] }), el("img", { src: stickerSrc(m.sticker), alt: "" }), el("span", { text: m.name }),
    ]);
    b.addEventListener("click", () => { editSel = i; editFocus = id; sfx("ui"); renderEditor(); });
    return b;
  }));
  $("moveGrid").replaceChildren(...MOVES.map(m => {
    const at = me.loadout.indexOf(m.id);
    const b = el("button", { type: "button", class: (at >= 0 ? "equipped" : "") + (m.id === editFocus ? " focus" : "") }, [
      el("img", { src: stickerSrc(m.sticker), alt: "" }),
      el("div", { text: m.name }),
      at >= 0 ? el("span", { class: "eq", text: BUTTONS[at] }) : null,
    ]);
    b.addEventListener("click", () => {
      sfx("ui");
      if (editFocus === m.id && me.loadout[editSel] !== m.id) assign(m.id);
      else if (editFocus !== m.id) { editFocus = m.id; if (at < 0) assign(m.id); }
      renderEditor();
    });
    return el("li", {}, [b]);
  }));
  const m = MOVE_BY_ID[editFocus] || MOVES[0];
  const st = moveStats(m);
  $("moveDetail").replaceChildren(
    el("img", { src: stickerSrc(m.sticker), alt: "" }),
    el("span", { class: "kind", text: m.kind }),
    el("h3", { text: m.name }),
    el("p", { text: m.desc, style: "margin: 4px 0" }),
    el("dl", {}, [
      el("dt", { text: "発生" }), el("dd", { text: st.startup ? `${st.startup} F` : "—" }),
      el("dt", { text: "ダメージ" }), el("dd", { text: st.dmg ? `${st.dmg}%` : "—" }),
      el("dt", { text: "再使用" }), el("dd", { text: st.cd ? `${(st.cd / 60).toFixed(1)} 秒` : "すぐ" }),
    ]),
  );
}

/** 選んでいるボタンに技を入れる。ほかのボタンに入っていたら入れ替える */
function assign(id) {
  const at = me.loadout.indexOf(id);
  if (at >= 0) me.loadout[at] = me.loadout[editSel];
  me.loadout[editSel] = id;
  editSel = (editSel + 1) % 4;
}

$("editDone").addEventListener("click", () => {
  $("editor").hidden = true;
  save(KEY.loadout, me.loadout);
  renderLoadout();
  if (S.role === "host") { S.slots[0].loadout = me.loadout.slice(); }
  if (S.role === "client") sendHello();
  renderLobby();
});

// ---- ロビー ----

function renderLobby() {
  if (S.screen !== "lobby") return;
  const host = S.role === "host";
  $("roomBox").hidden = S.offline;
  $("practiceBox").hidden = !S.offline;
  $("roomCode").textContent = S.room;
  $("hostCtl").hidden = !host;
  document.querySelectorAll("#stockSeg button").forEach(b => b.classList.toggle("on", Number(b.dataset.v) === S.stocks));

  const roster = host ? S.slots.map(s => s && { k: s.kind, n: s.name, hello: s.hello }) : S.roster;
  const self = host ? 0 : S.you;
  const filled = roster.filter(Boolean).length;
  $("slotList").replaceChildren(...roster.map((p, i) => {
    const li = el("li", { class: p ? "" : "empty", style: `--c: ${COLORS[i]}` });
    li.append(el("div", { class: "face" }, [el("img", { src: "avatars/husky.png", alt: "" })]));
    if (!p) {
      li.append(el("div", { class: "who", text: `P${i + 1} 空き` }));
      if (host && i > 0) {
        const b = el("button", { class: "mini", type: "button", text: "＋ CPU" });
        b.addEventListener("click", () => { addCpu(i); });
        li.append(b);
      }
      return li;
    }
    const who = el("div", { class: "who", text: `P${i + 1} ${p.n || "…"}` });
    if (i === self) who.append(el("small", { text: "あなた" }));
    li.append(who);
    li.append(el("span", { class: "tag", text: p.k === 2 ? "CPU" : host && p.hello === false ? "接続中…" : "準備OK" }));
    if (host && i > 0) {
      const b = el("button", { class: "mini", type: "button", text: p.k === 2 ? "外す" : "退出させる" });
      b.addEventListener("click", () => removeSlot(i));
      li.append(b);
    }
    return li;
  }));
  if (host) {
    const ok = filled >= 2 && S.slots.every(s => !s || s.kind === 2 || s.hello);
    $("startBtn").disabled = !ok;
    $("lobbyMsg").textContent = filled < 2 ? (S.offline ? "CPU を追加してください" : "参加を待っています（CPU を入れることもできます）") : "";
  } else {
    $("lobbyMsg").textContent = "ホストが対戦を始めるのを待っています";
  }
}

document.querySelectorAll("#stockSeg button").forEach(b => b.addEventListener("click", () => {
  S.stocks = Number(b.dataset.v);
  sfx("ui");
  renderLobby();
  broadcastLobby();
}));

$("startBtn").addEventListener("click", () => { if (S.role === "host") startMatch(); });
$("leaveBtn").addEventListener("click", () => leaveToTitle());
$("quitBtn").addEventListener("click", () => {
  const text = S.role === "host" && !S.offline ? "ルームを閉じてタイトルに戻りますか？" : "対戦をやめてタイトルに戻りますか？";
  if (confirm(text)) leaveToTitle();
});

// ---- ホスト ----

function startHost(net, code) {
  S.role = "host";
  S.offline = !net;
  S.net = net;
  S.room = code;
  S.slots = [{ kind: 1, name: myName(), loadout: me.loadout.slice(), peerId: null, hello: true }, null, null, null];
  S.sim = null;
  S.stocks = S.stocks || 3;
  $("gameRoom").textContent = code ? `ルーム ${code}` : "練習";
  show("lobby");
  renderLobby();
  clearInterval(S.lobbyTimer);
  if (net) S.lobbyTimer = setInterval(broadcastLobby, LOBBY_EVERY_MS);
}

function randomLoadout() {
  const ids = MOVES.map(m => m.id).sort(() => Math.random() - 0.5).slice(0, 4);
  if (!ids.includes("cheat") && Math.random() < 0.6) ids[3] = "cheat";
  return [...new Set(ids)].length === 4 ? ids : DEFAULT_LOADOUT.slice();
}

function addCpu(at) {
  const i = at ?? S.slots.findIndex((s, k) => k > 0 && !s);
  if (i < 0 || S.slots[i]) return;
  S.slots[i] = { kind: 2, name: `CPU${i + 1}`, loadout: randomLoadout(), peerId: null, hello: true };
  renderLobby();
  broadcastLobby();
}

function removeSlot(i) {
  const s = S.slots[i];
  if (!s) return;
  if (s.peerId) S.net?.kick(s.peerId);   // leave が呼ばれて片付く
  S.slots[i] = null;
  renderLobby();
  broadcastLobby();
}

function hostAccept(peerId) {
  if (S.sim) return "started";
  const i = S.slots.findIndex((s, k) => k > 0 && !s);
  if (i < 0) return "full";
  S.slots[i] = { kind: 1, name: "", loadout: DEFAULT_LOADOUT.slice(), peerId, hello: false,
    input: EMPTY_INPUT, seq: -1, tracker: new PressTracker() };
  renderLobby();
  broadcastLobby();
  return i;
}

function hostMessage(peerId, msg) {
  const i = S.slots.findIndex(s => s && s.peerId === peerId);
  if (i < 0) return;
  const s = S.slots[i];
  if (msg.t === "hi") {
    if (S.sim) return;   // 対戦中は名前・技を変えない
    const changed = !s.hello || s.name !== msg.n;
    s.name = msg.n || `P${i + 1}`;
    s.loadout = msg.l;
    if (!s.hello) toast(`${s.name} さんが入りました`);
    s.hello = true;
    if (changed) { renderLobby(); broadcastLobby(); }
  } else if (msg.t === "in") {
    if (msg.s <= s.seq) return;   // 古い（順番が入れ替わって届いた）入力は捨てる
    s.seq = msg.s;
    s.raw = msg;
  }
}

function hostLeave(peerId) {
  const i = S.slots.findIndex(s => s && s.peerId === peerId);
  if (i < 0) return;
  const name = S.slots[i].name || `P${i + 1}`;
  S.slots[i] = null;
  if (S.sim) S.sim.removeSlot(i);
  toast(`${name} さんが抜けました`);
  renderLobby();
  broadcastLobby();
}

function hostPhase() { return S.sim ? S.sim.phase : "lobby"; }

function broadcastLobby() {
  if (S.role !== "host" || !S.net) return;
  S.lobbySeq = (S.lobbySeq || 0) + 1;
  const P = S.slots.map(s => (s ? { k: s.kind, n: s.name || "…" } : { k: 0 }));
  const base = { t: "lb", s: S.lobbySeq, ph: PHASES.indexOf(hostPhase()), st: S.stocks, P };
  S.slots.forEach((s, i) => { if (s?.peerId) S.net.send(s.peerId, { ...base, you: i }); });
}

function startMatch() {
  const players = [];
  S.slots.forEach((s, i) => {
    if (!s) return;
    if (i === 0) s.loadout = me.loadout.slice();
    players.push({ slot: i, name: s.name, loadout: s.loadout, cpu: s.kind === 2 });
    if (s.kind === 1 && i > 0) s.tracker = new PressTracker();
  });
  if (players.length < 2) return;
  S.localTracker = new PressTracker();
  S.sim = new Sim(players, { stocks: S.stocks });
  renderer.roster = S.slots.map(s => s && { name: s.name });
  renderer.self = 0;
  enterGame();
  broadcastLobby();
}

function hostStep() {
  const sim = S.sim;
  const inputs = [EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT];
  S.slots.forEach((s, i) => {
    if (!s) return;
    const F = sim.fighters[i];
    if (!F) return;
    if (i === 0) {
      const r = input.read();
      inputs[0] = { x: r.x, y: r.y, held: r.held, pressed: S.localTracker.pressed(r.c) };
    } else if (s.kind === 2) {
      inputs[i] = cpuInput(F, sim);
    } else if (s.raw) {
      const r = s.raw;
      inputs[i] = { x: r.x / 100, y: r.y / 100, held: r.h, pressed: s.tracker.pressed(r.c) };
    }
  });
  sim.step(inputs);
}

function hostBackToLobby() {
  S.sim = null;
  show("lobby");
  renderLobby();
  broadcastLobby();
}

// ---- クライアント ----

function startClient(net, code) {
  S.role = "client";
  S.offline = false;
  S.net = net;
  S.room = code;
  S.roster = [null, null, null, null];
  S.phase = "lobby";
  S.snaps = [];
  S.inSeq = 0;
  $("gameRoom").textContent = `ルーム ${code}`;
  show("lobby");
  renderLobby();
  sendHello();
  clearInterval(S.helloTimer);
  S.helloTimer = setInterval(() => { if (S.phase === "lobby") sendHello(); }, HELLO_EVERY_MS);
}

function sendHello() {
  S.net?.send({ t: "hi", n: myName(), l: me.loadout });
}

function clientMessage(msg) {
  if (msg.t === "lb") {
    if (msg.s <= (S.lobbySeqSeen || 0)) return;
    S.lobbySeqSeen = msg.s;
    S.you = msg.you;
    S.stocks = msg.st;
    S.roster = msg.P.map(p => (p.k ? { k: p.k, n: p.n } : null));
    renderer.roster = S.roster.map(p => p && { name: p.n });
    renderer.self = S.you;
    setClientPhase(msg.ph);
    renderLobby();
  } else if (msg.t === "st") {
    const snap = expandSnapshot(msg);
    const newest = S.snaps[S.snaps.length - 1];
    if (newest && snap.f <= newest.f - 120) { S.snaps = []; S.lastEvent = 0; }   // ホストが新しい対戦を始めた
    if (S.snaps.some(s => s.f === snap.f)) return;
    S.snaps.push(snap);
    S.snaps.sort((a, b) => a.f - b.f);
    if (S.snaps.length > 10) S.snaps.shift();
    const o = snap.f - performance.now() / STEP;
    if (S.clockOffset === null || o > S.clockOffset || Math.abs(o - S.clockOffset) > 60) S.clockOffset = o;
    else S.clockOffset += (o - S.clockOffset) * 0.05;
    if (snap !== S.snaps[S.snaps.length - 1]) return;   // 遅れて届いた古いもの（補間には使う）
    setClientPhase(snap.ph);
    handleEvents(snap);
    if (snap.ph === "result") showResult(snap.R);
  }
}

function setClientPhase(ph) {
  const prev = S.phase;
  S.phase = ph;
  if (ph === "lobby") {
    if (S.screen !== "lobby") { S.snaps = []; show("lobby"); sendHello(); }
    return;
  }
  // 対戦が始まった（ロビーから、または結果画面から「もう一度」）
  if ((ph === "countdown" || ph === "fight") && (S.screen !== "game" || prev === "result" || prev === "game")) enterGame();
}

function clientLost(text) {
  S.net = null;
  resetSession();
  show("title");
  $("titleMsg").textContent = text;
}

// ---- 対戦画面 ----

function enterGame() {
  S.lastEvent = 0;
  S.lastCount = -1;
  S.lastPhase = "";
  S.resultShown = false;
  $("result").hidden = true;
  renderer.resetCamera();
  renderLoadout();
  $("pcHint").hidden = isTouch;
  show("game");
}

function handleEvents(view) {
  for (const e of view.E) {
    if (e.id <= S.lastEvent) continue;
    S.lastEvent = Math.max(S.lastEvent, e.id);
    renderer.event(e, view);
    if (e.k === "start" || e.k === "jump") { if (e.s === renderer.self || e.k === "start") sfx(e.k); }
    else sfx(e.k, e.p);
  }
  // 掛け声
  if (view.ph === "countdown") {
    const n = Math.ceil(view.tm / 60);
    if (n !== S.lastCount) { S.lastCount = n; sfx("count"); }
  }
  if (view.ph !== S.lastPhase) {
    if (view.ph === "fight" && S.lastPhase === "countdown") sfx("go");
    if (view.ph === "game") sfx("game");
    S.lastPhase = view.ph;
  }
}

/** クライアント: 少し前の時刻のスナップショット 2 つの間を補間する */
function clientView() {
  const snaps = S.snaps;
  if (!snaps.length) return null;
  const target = performance.now() / STEP + S.clockOffset - INTERP_DELAY;
  let a = snaps[0], b = null;
  for (const s of snaps) {
    if (s.f <= target) a = s;
    else { b = s; break; }
  }
  if (!b || a.f > target) return a;
  const t = (target - a.f) / (b.f - a.f);
  const L = (x, y) => x + (y - x) * t;
  const view = { ...b };
  view.F = b.F.map((F, i) => {
    const A = a.F[i];
    if (!F || !A || A.st === "dead" || F.st === "dead" || Math.hypot(F.x - A.x, F.y - A.y) > 250) return F;
    return { ...F, x: L(A.x, F.x), y: L(A.y, F.y) };
  });
  const prevP = new Map(a.P.map(p => [p.id, p]));
  view.P = b.P.map(p => { const q = prevP.get(p.id); return q ? { ...p, x: L(q.x, p.x), y: L(q.y, p.y) } : p; });
  return view;
}

function updateButtons(view) {
  const F = view?.F[renderer.self];
  document.querySelectorAll(".mbtn").forEach(b => {
    const i = Number(b.dataset.bit);
    const def = MOVE_BY_ID[me.loadout[i]];
    const cd = F ? F.cd[i] : 0;
    const frac = cd > 0 && def.cd > 0 ? Math.min(1, cd / def.cd) : 0;
    b.style.setProperty("--cd", frac.toFixed(3));
  });
}

let lastT = performance.now(), acc = 0, sendAcc = 0, hostFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (S.screen !== "game") return;

  let view = null;
  if (S.role === "host" && S.sim) {
    view = expandSnapshot(S.sim.snapshot());
    handleEvents(view);
    if (view.ph === "result" && !S.resultShown) showResult(view.R);
  } else if (S.role === "client") {
    sendAcc += dt * 1000;
    if (sendAcc >= STEP - 1) {
      sendAcc = Math.min(sendAcc - STEP, STEP);
      const r = input.read();
      S.net?.send({ t: "in", s: ++S.inSeq, x: Math.round(r.x * 100), y: Math.round(r.y * 100), h: r.held, c: r.c });
    }
    view = clientView();
  }
  renderer.frame(view, dt);
  updateButtons(view);
}
requestAnimationFrame(loop);

// ホストの計算と配信は、ウィンドウが裏に回っても止まらないように Worker のタイマーで回す（描画だけ rAF）
const ticker = new Worker(URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 8);"], { type: "text/javascript" })));
let hostLast = performance.now();
ticker.onmessage = () => {
  const now = performance.now();
  const dt = Math.min(100, now - hostLast);
  hostLast = now;
  if (S.role !== "host" || !S.sim || S.screen !== "game") { acc = 0; return; }
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 6) {
    hostStep();
    acc -= STEP; n++;
    hostFrames++;
    if (S.net && hostFrames % 2 === 0) S.net.broadcast(S.sim.snapshot());
  }
  if (n >= 6) acc = 0;
};

// ---- 結果 ----

function showResult(R) {
  if (S.resultShown) return;
  S.resultShown = true;
  const names = S.role === "host" ? S.slots.map(s => s?.name) : S.roster.map(p => p?.n);
  $("rankList").replaceChildren(...R.map((slot, k) => el("li", { style: `--c: ${COLORS[slot]}` }, [
    el("span", { class: "no", text: `${k + 1}位` }),
    el("span", { text: `P${slot + 1} ${names[slot] || ""}` }),
  ])));
  const host = S.role === "host";
  $("againBtn").hidden = !host;
  $("toLobbyBtn").hidden = !host;
  $("resultMsg").textContent = host ? "" : "ホストの操作を待っています";
  $("result").hidden = false;
  input.setEnabled(false);
}

$("againBtn").addEventListener("click", () => { $("result").hidden = true; startMatch(); });
$("toLobbyBtn").addEventListener("click", () => { $("result").hidden = true; hostBackToLobby(); });

// ---- 退出 ----

function resetSession() {
  clearInterval(S.lobbyTimer);
  clearInterval(S.helloTimer);
  S.role = null; S.net = null; S.sim = null; S.offline = false;
  S.snaps = []; S.clockOffset = null; S.lobbySeqSeen = 0;
  S.slots = [null, null, null, null];
}

function leaveToTitle() {
  S.net?.close();
  resetSession();
  show("title");
}

// ---- スマホ向けの調整（拡大・スクロール・長押しメニューを止める、全画面・横向き固定・画面を消さない） ----

let gestured = false;
function firstGesture() {
  unlockAudio();
  if (gestured) return;
  gestured = true;
  if (isTouch) {
    const de = document.documentElement;
    const fs = de.requestFullscreen || de.webkitRequestFullscreen;
    if (fs && !document.fullscreenElement) {
      Promise.resolve(fs.call(de, { navigationUI: "hide" }))
        .then(() => screen.orientation?.lock?.("landscape"))
        .catch(() => { /* iOS など全画面にできない環境では、縦向きのときに案内を出すだけ */ });
    }
  }
}
document.addEventListener("pointerdown", () => unlockAudio(), { passive: true });

let wakeLock = null;
async function requestWakeLock() {
  try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } }
  catch { /* 使えなくても遊べる */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.screen === "game") requestWakeLock(); });

for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("touchmove", e => {
  if (e.touches.length > 1 || !e.target.closest?.(".scroll")) e.preventDefault();
}, { passive: false });
document.addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", ";"].includes(e.key)) e.preventDefault();
});
addEventListener("beforeunload", () => S.net?.close());

// ---- 起動 ----

renderLoadout();
syncToggles();
show("title");
if (new URLSearchParams(location.search).has("debug")) window.hussmash = { S, renderer, input };
