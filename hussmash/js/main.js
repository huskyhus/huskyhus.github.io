// 画面の流れと、ホスト / クライアントの進行。
//   タイトル → ルームを作る（ホスト）/ ルームに入る（クライアント）/ 練習（通信なしのホスト）→ ロビー → 対戦 → 結果 → ロビー
// ホストは対戦を計算し（sim.js）、60 回/秒スナップショットを配る。クライアントは入力を 60 回/秒送り、届いたスナップショットを補間して描く。
// クライアントの自分のキャラだけは、ホストの結果を待たずに手元で先に動かす（予測）。ホストの結果が届くたびに、その状態から
// ホストがまだ使っていない自分の入力をやり直して合わせる（照合）。当たり・ダメージ・撃墜を決めるのはホストだけ。
// 通信はすべて state の同期なので（ロビーの状態も対戦の状態も毎回まるごと送る）、何通か落ちても次の 1 通で元に戻る。

import { MOVE_BY_ID, SELECTABLE, GROUPS, DEFAULT_LOADOUT, BUTTONS, stickerSrc, repairLoadout, moveStats } from "./moves.js";
import { Sim, cpuInput, EMPTY_INPUT, PHASES, EVENTS, FLAG, CPU_LEVEL_NAMES, CPU_DEFAULT_LEVEL, fighterState, loadFighter, predictSim } from "./sim.js";
import { expandSnapshot, cleanName, INPUT_FRAMES } from "./protocol.js";
import { hostRoom, joinRoom, randomRoom, isRoomCode } from "./net.js";
import { Renderer, COLORS } from "./render.js";
import { Input, PressTracker, InputQueue } from "./input.js";
import { unlockAudio, playSong, isOn as bgmOn, setOn as setBgm } from "./bgm.js";
import { sfx, isMuted, setMuted } from "./sfx.js";
import { VERSION } from "./version.js";

const $ = id => document.getElementById(id);
const KEY = { name: "hussmash.name", loadout: "hussmash.loadout" };
const STEP = 1000 / 60;
const LOBBY_EVERY_MS = 400, HELLO_EVERY_MS = 800;
const INTERP_DELAY = 3;   // クライアントは相手のキャラを何フレーム遅れて描くか（揺れを吸収するため。自分のキャラは予測して遅れなし）
const REPLAY_MAX = 90;    // 照合でやり直す入力の上限（これより遅れていたらホストの状態をそのまま使う）
const SNAP_DIST = 150;    // 予測とホストの結果がこれ以上ずれたら、なめらかに寄せずにその場へ移す（撃墜・復活など）

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } };

const me = {
  name: cleanName(load(KEY.name, "")) || "",
  loadout: repairLoadout(load(KEY.loadout, null)),   // 禁止になった技が入っていたら差し替える
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
  slots: [null, null, null, null],   // { kind: 1 人 / 2 CPU, name, loadout, peerId, inq（届いた入力）, hello, ready }
  stocks: 3,
  sim: null,
  // クライアント
  you: 0,
  roster: [null, null, null, null],
  phase: "lobby",
  snaps: [],
  clockOffset: null,
  ready: false,       // 自分が「準備OK」を押しているか
  inSeq: 0,           // 自分の入力の番号（1 フレームに 1 つ）
  inHist: [],         // 送った入力 { s, i: [x, y, held, pressed] }（照合でやり直すため、ホストが使い終わるまで持っておく）
  inTracker: null,
  pred: null,         // 予測: { sim, F, ox, oy }（ox, oy = ずれをなめらかに寄せるための見た目のずらし）
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
    const b = el("button", { class: "lo-card", type: "button", "aria-label": `${BUTTONS[i]}: ${m.name}（タップで変更）` }, [
      el("img", { src: stickerSrc(m.sticker), alt: "" }),
      el("span", { class: "btn-letter", text: BUTTONS[i] }),
      el("div", { text: m.name }),
      el("div", { class: "kind", text: m.kind }),
    ]);
    b.addEventListener("click", () => openEditor(i));
    return b;
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

$("editBtn").addEventListener("click", () => openEditor(0));
$("lobbyEditBtn").addEventListener("click", () => openEditor(0));
$("helpBtn").addEventListener("click", () => { $("help").hidden = false; });
$("helpClose").addEventListener("click", () => { $("help").hidden = true; });
$("bgmBtn").addEventListener("click", () => { firstGesture(); setBgm(!bgmOn()); syncToggles(); });
$("sfxBtn").addEventListener("click", () => { firstGesture(); setMuted(!isMuted()); syncToggles(); sfx("ui"); });

// ---- 技の選択 ----

// 操作は 2 つだけ: 「技をタップして見る」→「入れたいボタン（A / B / X / Y）を押す」。
// 上の 4 つのボタン欄をタップすると、そこに入っている技を見る。
let editFocus = null, editFlash = -1;

function openEditor(slot = 0) {
  editFocus = me.loadout[slot];
  editFlash = -1;
  renderEditor();
  $("editor").hidden = false;
  $("moveGrid").querySelector(".focus")?.scrollIntoView({ block: "nearest" });
}

/** 性能の 1 行。数値で比べられる欄は 5 段階のバー、数値のない欄（ガード・回復など）は説明の文だけ */
function bars(lv, label, value) {
  const segs = [1, 2, 3, 4, 5].map(k => el("i", { class: k <= lv ? "on" : "" }));
  return el("div", { class: "stat" }, [
    el("span", { text: label }),
    el("div", { class: "stat-v" }, [lv ? el("span", { class: "bars" }, segs) : null, el("small", { text: value })]),
  ]);
}

function renderEditor() {
  $("editSlots").replaceChildren(...me.loadout.map((id, i) => {
    const m = MOVE_BY_ID[id];
    const b = el("button", { class: "edit-slot" + (id === editFocus ? " sel" : "") + (i === editFlash ? " flash" : ""), type: "button" }, [
      el("b", { text: BUTTONS[i] }), el("img", { src: stickerSrc(m.sticker), alt: "" }), el("span", { text: m.name }),
    ]);
    b.addEventListener("click", () => { editFocus = id; editFlash = -1; sfx("ui"); renderEditor(); });
    return b;
  }));

  const items = [];
  for (const g of GROUPS) {
    items.push(el("li", { class: "grp", text: g.name }));
    for (const id of g.ids) {
      const m = MOVE_BY_ID[id];
      if (!m || m.banned) continue;
      const at = me.loadout.indexOf(id);
      const b = el("button", { type: "button", class: (at >= 0 ? "equipped" : "") + (id === editFocus ? " focus" : "") }, [
        el("img", { src: stickerSrc(m.sticker), alt: "" }),
        el("div", { text: m.name }),
        el("small", { text: m.kind }),
        at >= 0 ? el("span", { class: "eq", text: BUTTONS[at] }) : null,
      ]);
      b.addEventListener("click", () => { editFocus = id; editFlash = -1; sfx("ui"); renderEditor(); });
      items.push(el("li", {}, [b]));
    }
  }
  $("moveGrid").replaceChildren(...items);

  const m = MOVE_BY_ID[editFocus] || SELECTABLE[0];
  const st = moveStats(m);
  const at = me.loadout.indexOf(m.id);
  const setRow = el("div", { class: "set-row" }, BUTTONS.map((B, i) => {
    const cur = MOVE_BY_ID[me.loadout[i]];
    const b = el("button", { type: "button", class: "set-btn" + (i === at ? " here" : "") }, [
      el("b", { text: B }),
      el("img", { src: stickerSrc(cur.sticker), alt: "" }),
      el("small", { text: i === at ? "セット中" : at >= 0 ? "入れ替え" : "ここに入れる" }),
    ]);
    b.addEventListener("click", () => { if (i !== at) { setMove(m.id, i); sfx("ui"); } });
    return b;
  }));
  $("moveDetail").replaceChildren(
    el("div", { class: "detail-top" }, [
      el("img", { src: stickerSrc(m.sticker), alt: "" }),
      el("div", {}, [
        el("span", { class: "kind", text: m.kind }),
        el("h3", { text: m.name }),
        bars(st.speedLv, "速さ", st.speedText),
        bars(st.dmgLv, "威力", st.dmgText),
        bars(st.powerLv, "ふっとび", st.powerText),
        el("div", { class: "stat cd", text: `再使用 ${st.cd ? `${(st.cd / 60).toFixed(1)} 秒` : "すぐ"}` }),
      ]),
    ]),
    el("p", { class: "desc", text: m.desc }),
    el("p", { class: "legend", text: "F = 1/60 秒（小さいほど早く出る）。ふっとびが 30 前後なら、相手が 100% 前後で撃墜を狙える" }),
    el("div", { class: "set-box" }, [el("div", { class: "set-head", text: "どのボタンに入れる？" }), setRow]),
  );
}

/** 技をボタン i に入れる。ほかのボタンに入っていたら、そのボタンとは中身を入れ替える */
function setMove(id, i) {
  const at = me.loadout.indexOf(id);
  if (at >= 0) me.loadout[at] = me.loadout[i];
  me.loadout[i] = id;
  editFlash = i;
  save(KEY.loadout, me.loadout);
  renderEditor();
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

  $("readyBtn").hidden = host;
  $("readyBtn").setAttribute("aria-pressed", String(S.ready));
  const roster = host ? S.slots.map((s, i) => s && { k: s.kind, n: s.name, hello: s.hello, lv: s.level, r: isReady(s, i) })
    : S.roster.map((p, i) => (p && i === S.you ? { ...p, r: S.ready } : p));   // 自分の準備OK は押したらすぐ反映
  const self = host ? 0 : S.you;
  const matchOn = !host && (S.phase === "countdown" || S.phase === "fight" || S.phase === "game");
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
    if (p.k === 2 && host) {
      // CPU の強さ（押すたびに 動かない → よわい → ふつう → つよい）
      const b = el("button", { class: "mini lv", type: "button", text: `CPU: ${CPU_LEVEL_NAMES[p.lv]} ▸` });
      b.addEventListener("click", () => { S.slots[i].level = (S.slots[i].level + 1) % CPU_LEVEL_NAMES.length; sfx("ui"); renderLobby(); broadcastLobby(); });
      li.append(b);
    } else {
      const tag = p.k === 2 ? `CPU: ${CPU_LEVEL_NAMES[p.lv]}`
        : host && p.hello === false ? "接続中…"
        : matchOn && !p.m ? "次の対戦から" : matchOn ? "対戦中" : p.r ? "準備OK" : "準備中";
      li.append(el("span", { class: "tag" + (tag === "準備OK" ? " ok" : ""), text: tag }));
    }
    if (host && i > 0) {
      const b = el("button", { class: "mini", type: "button", text: p.k === 2 ? "外す" : "退出させる" });
      b.addEventListener("click", () => removeSlot(i));
      li.append(b);
    }
    return li;
  }));
  if (host) {
    const st = startState();
    $("startBtn").disabled = !st.ok;
    $("lobbyMsg").textContent = st.msg || (S.stocks === 0 ? "ストック∞: 対戦は ✕ でロビーに戻るまで続きます" : "");
  } else {
    $("lobbyMsg").textContent = matchOn ? "対戦中です。終わったら次の対戦から参加できます"
      : S.ready ? "ホストが対戦を始めるのを待っています" : "準備ができたら「準備OK」を押してください";
  }
}

/** 準備OKか（ホスト自身と CPU はいつも OK。ほかの人は、名前と技が届いていて「準備OK」を押している） */
const isReady = (s, i) => !!s && (s.kind === 2 || i === 0 || (s.hello && s.ready));

/** ホスト: 対戦を始められるか（2 人以上いて、全員が準備OK）と、始められないときの案内 */
function startState() {
  const L = S.slots.map((s, i) => s && { s, i }).filter(Boolean);
  if (L.length < 2) return { ok: false, msg: S.offline ? "CPU を追加してください" : "参加を待っています（CPU を入れることもできます）" };
  const wait = L.filter(({ s, i }) => !isReady(s, i)).map(({ s, i }) => `P${i + 1} ${s.name || "…"}`);
  return wait.length ? { ok: false, msg: `準備OKを待っています: ${wait.join("、")}` } : { ok: true, msg: "" };
}

/** ホスト: 結果画面の「もう一度」も、全員が準備OK のときだけ押せる */
function syncAgain() {
  if (S.role !== "host" || $("result").hidden) return;
  const st = startState();
  $("againBtn").disabled = !st.ok;
  $("resultMsg").textContent = st.msg;
}

$("readyBtn").addEventListener("click", () => {
  if (S.role !== "client") return;
  S.ready = !S.ready;
  sfx("ui");
  sendHello();   // すぐ知らせる（このあとも自己紹介のたびに送る）
  renderLobby();
});

document.querySelectorAll("#stockSeg button").forEach(b => b.addEventListener("click", () => {
  S.stocks = Number(b.dataset.v);
  sfx("ui");
  renderLobby();
  broadcastLobby();
}));

$("startBtn").addEventListener("click", () => { if (S.role === "host") startMatch(); });
$("leaveBtn").addEventListener("click", () => leaveToTitle());
// ✕: ホスト（練習も）は対戦をやめてロビーへ（ルームはそのまま）。クライアントはルームから抜ける（同じ番号で入りなおせる）
$("quitBtn").addEventListener("click", () => {
  if (S.role === "host") { if (confirm("対戦をやめてロビーに戻りますか？")) hostBackToLobby(); }
  else if (confirm("ルームから抜けてタイトルに戻りますか？（同じ番号で入りなおせます）")) leaveToTitle();
});

// ---- ホスト ----

function startHost(net, code) {
  S.role = "host";
  S.offline = !net;
  S.net = net;
  S.room = code;
  S.slots = [{ kind: 1, name: myName(), loadout: me.loadout.slice(), peerId: null, hello: true, ready: true }, null, null, null];
  S.sim = null;
  if (!(S.stocks >= 0)) S.stocks = 3;   // 0 = ストック無限
  $("gameRoom").textContent = code ? `ルーム ${code}` : "練習";
  show("lobby");
  renderLobby();
  clearInterval(S.lobbyTimer);
  if (net) S.lobbyTimer = setInterval(broadcastLobby, LOBBY_EVERY_MS);
}

function randomLoadout() {
  const ids = SELECTABLE.map(m => m.id).sort(() => Math.random() - 0.5).slice(0, 4);
  if (!ids.includes("cheat") && Math.random() < 0.6) ids[3] = "cheat";
  return [...new Set(ids)].length === 4 ? ids : DEFAULT_LOADOUT.slice();
}

function addCpu(at, level = CPU_DEFAULT_LEVEL) {
  const i = at ?? S.slots.findIndex((s, k) => k > 0 && !s);
  if (i < 0 || S.slots[i]) return;
  S.slots[i] = { kind: 2, name: `CPU${i + 1}`, loadout: randomLoadout(), level, peerId: null, hello: true };
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

/** 対戦中・結果画面でも入れる（その対戦は観戦して、次の対戦から参加）。抜けた人も同じ番号で入りなおせる */
function hostAccept(peerId) {
  const i = S.slots.findIndex((s, k) => k > 0 && !s);
  if (i < 0) return "full";
  S.slots[i] = { kind: 1, name: "", loadout: DEFAULT_LOADOUT.slice(), peerId, hello: false, ready: false,
    inq: new InputQueue() };
  renderLobby();
  broadcastLobby();
  return i;
}

function hostMessage(peerId, msg) {
  const i = S.slots.findIndex(s => s && s.peerId === peerId);
  if (i < 0) return;
  const s = S.slots[i];
  if (msg.t === "hi") {
    // 対戦に出ている人の名前・技は、カウントダウンと対戦の間だけ変えない（結果画面の間にロビーで変えたものは次の対戦に使う）
    const playing = S.sim && s.inMatch && (S.sim.phase === "countdown" || S.sim.phase === "fight");
    const before = `${s.hello}|${s.name}|${s.ready}`;
    if (!playing || !s.hello) { s.name = msg.n || `P${i + 1}`; s.loadout = msg.l; }
    s.ready = msg.r;
    if (!s.hello) toast(`${s.name} さんが入りました`);
    s.hello = true;
    if (before !== `${s.hello}|${s.name}|${s.ready}`) { renderLobby(); broadcastLobby(); syncAgain(); }
  } else if (msg.t === "in") {
    s.inq.push(msg.s, msg.i);   // 番号で並べ直して、1 フレームに 1 つずつ使う（重複・古いものは捨てる）
  }
}

function hostLeave(peerId) {
  const i = S.slots.findIndex(s => s && s.peerId === peerId);
  if (i < 0) return;
  const name = S.slots[i].name || `P${i + 1}`;
  if (S.sim && S.slots[i].inMatch) S.sim.removeSlot(i);
  S.slots[i] = null;
  toast(`${name} さんが抜けました`);
  renderLobby();
  broadcastLobby();
  syncAgain();
}

function hostPhase() { return S.sim ? S.sim.phase : "lobby"; }

function broadcastLobby() {
  if (S.role !== "host" || !S.net) return;
  S.lobbySeq = (S.lobbySeq || 0) + 1;
  const P = S.slots.map((s, i) => (s ? { k: s.kind, n: s.name || "…", m: S.sim && s.inMatch ? 1 : 0, lv: s.level ?? 0, r: isReady(s, i) ? 1 : 0 } : { k: 0 }));
  const base = { t: "lb", s: S.lobbySeq, ph: PHASES.indexOf(hostPhase()), st: S.stocks, P };
  S.slots.forEach((s, i) => { if (s?.peerId) S.net.send(s.peerId, { ...base, you: i }); });
}

function startMatch() {
  if (!startState().ok) return;   // 全員が準備OK のときだけ
  const players = [];
  S.slots.forEach((s, i) => {
    if (!s) return;
    s.inMatch = true;
    if (i === 0) s.loadout = me.loadout.slice();
    players.push({ slot: i, name: s.name, loadout: s.loadout, cpu: s.kind === 2, level: s.level });
    if (s.kind === 1 && i > 0) s.inq.resync();
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
    if (!s || !s.inMatch) return;   // 途中から入った人（観戦中）の入力は使わない
    const F = sim.fighters[i];
    if (!F) return;
    if (i === 0) {
      const r = input.read();
      inputs[0] = { x: r.x, y: r.y, held: r.held, pressed: S.localTracker.pressed(r.c) };
    } else if (s.kind === 2) {
      inputs[i] = cpuInput(F, sim);
    } else {
      inputs[i] = s.inq.take();
    }
  });
  sim.step(inputs);
}

/** スナップショットを全員に。対戦に出ている人には、その人のファイターのまるごとの状態と、使い終わった入力の番号（Y）を足す */
function broadcastSnapshot() {
  const base = JSON.stringify(S.sim.snapshot());
  S.slots.forEach((s, i) => {
    if (!s?.peerId) return;
    const F = s.inMatch && S.sim.fighters[i];
    S.net.sendText(s.peerId, F ? `${base.slice(0, -1)},"Y":${JSON.stringify([s.inq.acked, ...fighterState(F)])}}` : base);
  });
}

function hostBackToLobby() {
  S.sim = null;
  for (const s of S.slots) if (s) s.inMatch = false;
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
  S.ready = false;
  S.inSeq = 0;
  S.inHist = [];
  S.inTracker = new PressTracker();
  S.pred = null;
  $("gameRoom").textContent = `ルーム ${code}`;
  show("lobby");
  renderLobby();
  sendHello();
  clearInterval(S.helloTimer);
  S.helloTimer = setInterval(sendHello, HELLO_EVERY_MS);
}

function sendHello() {
  S.net?.send({ t: "hi", n: myName(), l: me.loadout, r: S.ready ? 1 : 0 });
}

function clientMessage(msg) {
  if (msg.t === "lb") {
    if (msg.s <= (S.lobbySeqSeen || 0)) return;
    S.lobbySeqSeen = msg.s;
    S.you = msg.you;
    S.stocks = msg.st;
    S.roster = msg.P.map(p => (p.k ? { k: p.k, n: p.n, m: p.m, lv: p.lv, r: p.r } : null));
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
    reconcile(snap);
    handleEvents(snap);
    if (snap.ph === "result") showResult(snap);
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
  const code = S.room;
  S.net = null;
  resetSession();
  show("title");
  $("roomInput").value = code;   // 同じ番号ですぐ入りなおせるように
  $("titleMsg").textContent = `${text}「ルームに入る」で入りなおせます。`;
}

/** クライアントで、今の対戦に出ていない（途中から入って観戦している） */
function spectating() {
  return S.role === "client" && S.phase !== "lobby" && !S.roster[S.you]?.m;
}

// ---- クライアント: 自分のキャラの予測と照合 ----
// 入力は 1 フレームに 1 つ番号を付けて作り、直近 INPUT_FRAMES フレームぶんをまとめて送る（何通か落ちても次の 1 通で埋まる）。
// ホストはそれを番号順にちょうど 1 つずつ使うので、邪魔が入らなければホストの結果と手元の予測は一致する。

const simInput = i => ({ x: i[0] / 100, y: i[1] / 100, held: i[2], pressed: i[3] });

/** 1 フレームぶんの入力を作り、予測を 1 フレーム進める */
function clientTick() {
  const r = input.read();
  const i = [Math.round(r.x * 100), Math.round(r.y * 100), r.held, S.inTracker.pressed(r.c)];
  S.inHist.push({ s: ++S.inSeq, i });
  if (S.inHist.length > REPLAY_MAX + INPUT_FRAMES) S.inHist.shift();
  const P = S.pred;
  if (!P) return;
  P.sim.stepSolo(S.you, simInput(i));
  // 自分のジャンプ・技の出し始めの音と土ぼこりは、予測で出す（ホストから届く同じものは handleEvents で飛ばす）
  for (const e of P.sim.events) {
    const k = EVENTS[e.k];
    if (k === "jump") { renderer.event({ ...e, k }, null); sfx("jump"); }
    else if (k === "start") sfx("start");
  }
  P.sim.events.length = 0;
}

function sendInputs() {
  const last = S.inHist[S.inHist.length - 1];
  if (last) S.net?.send({ t: "in", s: last.s, i: S.inHist.slice(-INPUT_FRAMES).map(h => h.i) });
}

/** ホストの結果（Y）が届いたら、その状態から、ホストがまだ使っていない入力をやり直す */
function reconcile(snap) {
  const Y = snap.Y;
  if (!Y || snap.ph !== "fight" || spectating()) { S.pred = null; return; }
  let P = S.pred;
  if (!P) {
    const sim = predictSim(S.you);
    P = S.pred = { sim, F: sim.fighters[S.you], ox: 0, oy: 0 };
  }
  const F = P.F;
  const shownX = F.x + P.ox, shownY = F.y + P.oy;
  loadFighter(F, Y.state);
  if (Y.ack >= 0) {
    S.inHist = S.inHist.filter(h => h.s > Y.ack);
    for (const h of S.inHist.slice(-REPLAY_MAX)) P.sim.stepSolo(S.you, simInput(h.i));
  }
  P.sim.events.length = 0;
  // 見た目は今の位置から、数フレームかけて正しい位置へ寄せる（大きくずれたときはその場へ）
  P.ox = shownX - F.x; P.oy = shownY - F.y;
  if (Math.hypot(P.ox, P.oy) > SNAP_DIST || F.state === "dead") P.ox = P.oy = 0;
}

/** 予測した自分のキャラを、スナップショットの形で */
function predictedView(P) {
  const F = P.F;
  P.ox *= 0.75; P.oy *= 0.75;
  return {
    x: F.x + P.ox, y: F.y + P.oy, face: F.face, st: F.state, mv: F.move ? F.move.def : null, mf: F.move ? F.move.f : 0,
    dmg: Math.round(F.dmg), stocks: F.stocks,
    flags: (F.invuln > 0 ? FLAG.invuln : 0) | (F.guarding ? FLAG.guard : 0) | (F.helpless ? FLAG.helpless : 0)
      | (F.sleeping ? FLAG.sleep : 0) | (F.counter ? FLAG.counter : 0) | (F.hover > 0 ? FLAG.hover : 0)
      | (F.grounded ? FLAG.ground : 0),
    guardHp: Math.round(F.guardHp), cd: F.cd.slice(), charge: Math.round(F.charge),
  };
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
    if (S.pred && e.s === S.you && (e.k === "jump" || e.k === "start")) continue;   // 予測で出した
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

/** クライアントの描く状態: 相手は補間、自分は予測 */
function clientFrameView() {
  const v = clientView();
  if (!v || !S.pred || !v.F[S.you]) return v;
  const F = v.F.slice();
  F[S.you] = predictedView(S.pred);
  return { ...v, F };
}

function updateButtons(view) {
  const spec = spectating();
  $("controls").hidden = spec;
  $("spectate").hidden = !spec;
  $("pcHint").hidden = isTouch || spec;
  renderer.self = spec ? -1 : S.role === "client" ? S.you : 0;
  const F = view?.F[renderer.self];
  document.querySelectorAll(".mbtn").forEach(b => {
    const i = Number(b.dataset.bit);
    const def = MOVE_BY_ID[me.loadout[i]];
    const cd = F ? F.cd[i] : 0;
    const frac = cd > 0 && def.cd > 0 ? Math.min(1, cd / def.cd) : 0;
    b.style.setProperty("--cd", frac.toFixed(3));
  });
}

let lastT = performance.now(), acc = 0, clientAcc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (S.screen !== "game") return;

  let view = null;
  if (S.role === "host" && S.sim) {
    view = expandSnapshot({ ...S.sim.snapshot(), ph: S.sim.phase });   // 送るときの ph は番号なので、名前に戻す
    handleEvents(view);
    if (view.ph === "result" && !S.resultShown) showResult(view);
  } else if (S.role === "client") {
    // 60 回/秒、1 フレームに 1 つ入力を作って予測を進める（描画が 30 回/秒の端末でも 1 回に 2 フレームぶん）
    clientAcc += dt * 1000;
    let n = 0;
    while (clientAcc >= STEP && n < 6) { clientTick(); clientAcc -= STEP; n++; }
    if (n >= 6) clientAcc = 0;
    if (n) sendInputs();
    view = clientFrameView();
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
    if (S.net) broadcastSnapshot();
  }
  if (n >= 6) acc = 0;
};

// ---- 結果 ----
// 左に順位と撃墜数・与えたダメージ。行をタップすると、右にその人の成績（相手ごと・技ごと）が出る（はじめは自分）

let resultView = null, resultSel = -1;

function showResult(view) {
  if (S.resultShown || S.screen !== "game") return;
  S.resultShown = true;
  resultView = view;
  resultSel = view.R.includes(renderer.self) ? renderer.self : view.R[0];
  renderResult();
  const host = S.role === "host";
  $("againBtn").hidden = !host;
  $("resultMsg").textContent = host ? "" : "次の対戦はホストが始めます";
  $("result").hidden = false;
  syncAgain();
  input.setEnabled(false);
}

const resultNames = () => (S.role === "host" ? S.slots.map(s => s?.name) : S.roster.map(p => p?.n));
const pct = v => `${v}%`;

function renderResult() {
  const { R, S: St } = resultView;
  const names = resultNames();
  const who = slot => `P${slot + 1} ${names[slot] || ""}`;
  $("rankList").replaceChildren(...R.map((slot, k) => {
    const st = St?.[slot];
    const b = el("button", { type: "button", class: "rank-row" + (slot === resultSel ? " sel" : ""), style: `--c: ${COLORS[slot]}` }, [
      el("span", { class: "no", text: `${k + 1}位` }),
      el("span", { class: "nm", text: who(slot) + (slot === renderer.self ? "（あなた）" : "") }),
      st ? el("span", { class: "nums" }, [
        "撃墜 ", el("b", { text: String(st.kos) }), "　落下 ", el("b", { text: String(st.falls) }),
        "　与えたダメージ ", el("b", { text: pct(st.dmg) }),
      ]) : null,
    ]);
    b.addEventListener("click", () => { resultSel = slot; sfx("ui"); renderResult(); });
    return el("li", {}, [b]);
  }));

  const st = St?.[resultSel];
  if (!st) { $("resultDetail").replaceChildren(); return; }
  const table = (head, rows) => el("table", { class: "st-table" }, [
    el("tr", {}, head.map(h => el("th", { text: h }))),
    ...rows,
  ]);
  const foes = R.filter(s => s !== resultSel).map(s => el("tr", { class: st.foe[s].dmg || st.foe[s].ko ? "" : "dim" }, [
    el("td", {}, [el("span", { class: "st-who", style: `--c: ${COLORS[s]}` }, [el("i"), who(s)])]),
    el("td", { text: pct(st.foe[s].dmg) }),
    el("td", { text: String(st.foe[s].ko) }),
  ]));
  const moves = st.mv.map((m, i) => el("tr", { class: m.hits ? "" : "dim" }, [
    el("td", {}, [el("span", { class: "st-who" }, [el("img", { src: stickerSrc(m.move.sticker), alt: "" }), `${BUTTONS[i]} ${m.move.name}`])]),
    el("td", { text: `${m.hits} 回` }),
    el("td", { text: pct(m.dmg) }),
    el("td", { text: String(m.ko) }),
  ]));
  $("resultDetail").replaceChildren(
    el("h3", { text: `${who(resultSel)} の成績` }),
    el("h4", { text: "相手ごと" }),
    table(["相手", "与えたダメージ", "撃墜"], foes),
    el("h4", { text: "技ごと" }),
    table(["技", "当てた", "ダメージ", "撃墜"], moves),
    el("p", { class: "st-note", text: `受けたダメージ ${pct(st.taken)}　撃墜された ${st.falls - st.sds}　自滅 ${st.sds}` }),
  );
}

$("againBtn").addEventListener("click", () => { $("result").hidden = true; startMatch(); });
// ロビーに戻る: ホストはルームの全員をロビーへ。クライアントは自分だけロビーへ（ホストが次の対戦を始めたら自動で始まる）
$("toLobbyBtn").addEventListener("click", () => {
  $("result").hidden = true;
  if (S.role === "host") hostBackToLobby();
  else { show("lobby"); renderLobby(); }
});

// ---- 退出 ----

function resetSession() {
  clearInterval(S.lobbyTimer);
  clearInterval(S.helloTimer);
  S.role = null; S.net = null; S.sim = null; S.offline = false;
  S.snaps = []; S.clockOffset = null; S.lobbySeqSeen = 0; S.pred = null;
  S.slots = [null, null, null, null];
}

function leaveToTitle() {
  if (S.role === "client") $("roomInput").value = S.room;
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

document.querySelectorAll("[data-ver]").forEach(e => { e.textContent = `v${VERSION}`; });
renderLoadout();
syncToggles();
show("title");
if (new URLSearchParams(location.search).has("debug")) window.hussmash = { S, renderer, input };
