// ホストが持つ対戦の正本。ホストの画面にいる本人もクライアントと同じ形のメッセージでここを動かす。
//   位置: クライアントが自分で動かして申告し、ホストは速さが範囲内か確かめてから受け入れる（はみ出したら戻す）
//   射撃: クライアントは「どこから・どの向きに撃ったか」だけ送る。当たったかはホストが、撃った人が見ていた時刻まで
//         みんなの位置を巻き戻して判定する（ラグの補正）
//   持ち物・体力・安全地帯・落ちているもの・CPU はすべてホストが決める
// 落ちているもの・撃破などの「できごと」は番号付きで記録し、相手が受け取ったと返事するまで毎回送る（reliable: false でも取りこぼさない）。

import { World, rayPlayer, STAND_H, CROUCH_H, HALF, grenadeStep, PAD_JUMP } from "./world.js";
import { WEAPONS, GRENADE, HEALS, ARMOR_CUT, IT, caps, W_GRENADE, itemInfo, AVATARS, DETECT, ATTS, attFits, weaponStats, MAX_SPARES, AMMO_STACK, ITEM_COUNT } from "./items.js";
import { Nav } from "./nav.js";
import { MAX_PLAYERS, AC, MAX_LOOT_ID, cleanName, ST, MODE } from "./protocol.js";
import { r2, r3, clamp, lerp } from "./util.js";
const r1 = v => Math.round(v * 10) / 10;
import { updateBot, newBotBrain } from "./bots.js";

export const TICK_HZ = 30;   // ホストの計算と、みんなへの配信の回数（毎秒）
export const PH = { LOBBY: 0, GAME: 1, OVER: 2 };
export const PLANE_ALT = 300;
export const PLANE_SPEED = 32;
export const EYE = { stand: 1.6, crouch: 1.2 };
export const CAUSE = { GRENADE: 9, ZONE: 10, LEFT: 11 };
// 安全地帯: 待ち秒, 縮む秒, 縮んだ後の半径, 外にいる時の毎秒ダメージ
export const ZONES = [[110, 55, 190, 0.8], [60, 45, 120, 1.5], [50, 40, 70, 3], [40, 30, 35, 5], [30, 25, 15, 8], [25, 25, 0, 12]];
export const ZONE_R0 = 340;
export const DROP_ALT = 230, DROP_SPEED = 6;   // 補給物資: 高さ 230m から毎秒 6m で降りてくる（約 40 秒）
// 状態ごとの横の速さの上限（m/s。申告された位置の検査に使う。少し余裕を持たせる）
const MAX_SPEED = { 2: 42, 3: 15, 4: 10.5 };
const BOT_NAMES = ["ハス丸", "ハスオ", "ハス美", "ハス吉", "ハスキー", "ハス助", "ハスヨ", "ハス太", "ハス子", "ハス平", "ハス之進", "ハスミン",
  "ハス蔵", "ハス代", "ハス郎", "ハス江", "ハス兵衛", "ハスリン", "ハス衛門", "ハス奈", "ハスゾウ", "ハス坊", "ハス姫", "ハス殿",
  "ハス若", "ハスオ二世", "ハス助二号", "ハス之丞", "ハスパン", "ハスもち", "ハス大福", "ハス将軍"];
const now = () => performance.now();

export class Sim {
  constructor() {
    this.slots = new Array(MAX_PLAYERS).fill(null);   // { k: 1 人 / 2 CPU, id, n, a, r }
    this.phase = PH.LOBBY;
    this.mode = MODE.BR;
    this.seed = (Math.random() * 2 ** 31) >>> 0;
    this.players = [];
    this.f = 0;
  }

  // ---- ロビー ----
  addHuman(id, local = false) {
    if (this.phase !== PH.LOBBY) return "started";
    const i = this.slots.findIndex(s => !s);
    if (i < 0) return "full";
    this.slots[i] = { k: 1, id, n: "", a: 0, r: local ? 1 : 0, local };
    this.slots[i].a = this.freeAvatar(true);
    this.lobbyChanged();
    return i;
  }
  slotOf(id) { return this.slots.findIndex(s => s && s.id === id); }
  // アバター（頭のパネル）は 24 枚 = 最大人数なので、全員別になる（空きは必ずある）
  /** 新しく入る人・CPU のアバター: 空きがあればそこから。なければ（CPU だけが使っているものを）いちばん使われていないものから */
  freeAvatar(forHuman = false) {
    const count = new Array(AVATARS.length).fill(0), human = new Array(AVATARS.length).fill(false);
    for (const s of this.slots) if (s) { count[s.a]++; if (s.k === 1) human[s.a] = true; }
    const free = AVATARS.map((_, i) => i).filter(i => !count[i]);
    if (free.length) return free[(Math.random() * free.length) | 0];
    const cand = AVATARS.map((_, i) => i).filter(i => !human[i]).sort((x, y) => count[x] - count[y]);
    const a = cand[0] ?? 0;
    if (forHuman) this.moveBotsOff(a, -1);
    return a;
  }
  /** アバター a を使っている CPU を、ほかの「CPU しか使っていない」アバターへ移す（人と同じにならないように） */
  moveBotsOff(a, give) {
    for (const s of this.slots) {
      if (!s || s.k !== 2 || s.a !== a) continue;
      if (give >= 0 && !this.slots.some(t => t && t.k === 1 && t.a === give)) { s.a = give; continue; }
      const count = new Array(AVATARS.length).fill(0), human = new Array(AVATARS.length).fill(false);
      for (const t of this.slots) if (t) { count[t.a]++; if (t.k === 1) human[t.a] = true; }
      const cand = AVATARS.map((_, i) => i).filter(i => i !== a && !human[i]).sort((x, y) => count[x] - count[y]);
      if (cand.length) s.a = cand[0];
    }
  }
  /** アバターを変える。人が使っていたら変えない。CPU が使っていたら、その CPU たちと入れかえる */
  setAvatar(i, a) {
    const me = this.slots[i];
    if (!me || me.a === a) return;
    if (this.slots.some((s, k) => s && k !== i && s.k === 1 && s.a === a)) return;
    const old = me.a;
    me.a = a;
    this.moveBotsOff(a, old);
  }
  removeHuman(id) {
    const i = this.slotOf(id);
    if (i < 0) return;
    if (this.phase !== PH.LOBBY && this.players[i] && this.players[i].st !== ST.DEAD && this.players[i].st !== ST.NONE) {
      this.kill(this.players[i], -1, CAUSE.LEFT, 0);
    }
    this.slots[i] = null;
    this.lobbyChanged();
  }
  addBot() {
    const i = this.slots.findIndex(s => !s);
    if (i < 0 || this.phase !== PH.LOBBY) return;
    const used = new Set(this.slots.filter(Boolean).map(s => s.n));
    const n = BOT_NAMES.find(x => !used.has("CPU " + x)) ?? "ハス" + i;
    this.slots[i] = { k: 2, id: "bot" + i, n: "CPU " + n, a: this.freeAvatar(), r: 1 };
    this.lobbyChanged();
  }
  fillBots() { while (this.slots.some(s => !s)) this.addBot(); }
  removeBot() {
    for (let i = MAX_PLAYERS - 1; i >= 0; i--) if (this.slots[i]?.k === 2) { this.slots[i] = null; break; }
    this.lobbyChanged();
  }
  setHello(id, msg) {
    const s = this.slots[this.slotOf(id)];
    if (!s) return;
    s.n = cleanName(msg.n) || "ハス" + (this.slotOf(id) + 1);
    this.setAvatar(this.slotOf(id), msg.a);
    s.r = msg.r;
    this.lobbyChanged();
  }
  lobbyChanged() { this.lobbyDirty = true; }
  setMode(m) { if (this.phase === PH.LOBBY && Object.values(MODE).includes(m)) { this.mode = m; this.lobbyChanged(); } }
  /** チーム: チーム戦では 1 人間 / 2 CPU。ほかのモードは全員ばらばら（0） */
  team(p) { return this.mode === MODE.TEAM ? (p.cpuTeam ? 2 : 1) : 0; }
  lobbyMsg(you) {
    return {
      t: "lb", seed: this.seed, ph: this.phase, you, md: this.mode,
      P: this.slots.map((s, i) => s ? { k: s.k, n: s.n, a: s.a, r: s.r, m: this.players[i] ? 1 : 0 } : { k: 0, n: "", a: 0, r: 0, m: 0 }),
    };
  }
  canStart() { return this.phase === PH.LOBBY && this.slots.filter(Boolean).length >= 1; }

  // ---- 対戦の開始 ----
  start() {
    if (!this.canStart()) return;
    this.seed = (Math.random() * 2 ** 31) >>> 0;
    this.world = new World(this.seed);
    this.nav = new Nav(this.world);   // CPU の道さがし
    this.drops = [];
    this.nextDrop = 0;
    this.loot = new Map();
    for (const l of this.world.loot) this.loot.set(l.id, { id: l.id, code: l.code, qty: l.qty, x: l.x, y: l.y, z: l.z, b: l.b });
    this.nextLoot = this.world.loot.length;
    this.events = [];
    this.tracers = [];
    this.grenades = [];
    this.nextGren = 1;
    this.time = 0;
    this.f = 0;
    this.over = false;
    this.winner = -1;
    // 飛行機: 島のまん中あたりを通るまっすぐな線
    const a = Math.random() * Math.PI * 2;
    const cx = (Math.random() - 0.5) * 120, cz = (Math.random() - 0.5) * 120;
    const dx = Math.cos(a), dz = Math.sin(a);
    const L = HALF + 100;
    this.plane = { sx: cx - dx * L, sz: cz - dz * L, dx, dz, len: L * 2, d: 0, x: 0, z: 0, yaw: Math.atan2(-dx, -dz), on: 1 };
    this.planeAt();
    // 安全地帯
    const zc = this.pickInside(0, 0, 50, 0);
    this.zone = { cx: zc[0], cz: zc[1], r: ZONE_R0, nx: 0, nz: 0, nr: ZONES[0][2], stage: 0, left: ZONES[0][0], shrinking: 0, dps: 0.4, fx: 0, fz: 0, fr: 0 };
    const nc = this.pickInside(this.zone.cx, this.zone.cz, this.zone.r - this.zone.nr - 40, this.zone.nr);
    this.zone.nx = nc[0]; this.zone.nz = nc[1];
    this.players = this.slots.map((s, i) => s ? this.newPlayer(i, s) : null);
    if (this.mode === MODE.TEAM) for (const p of this.players) if (p && p.bot) p.cpuTeam = true;
    if (this.mode === MODE.RANGE) this.setupRange();
    this.phase = PH.GAME;
    this.lobbyChanged();
  }

  /**
   * 射撃訓練場: 飛行機も安全地帯もなし。自分は地上から。まわりに全部の武器・アタッチメント・弾・装備、
   * 前方の見通しのよい方向に 10〜200m の的（CPU。動かない / 左右に動く。倒れない）
   */
  setupRange() {
    const W = this.world, me = this.players.find(p => p && !p.bot);
    this.plane.on = 0;
    this.zone = { cx: 0, cz: 0, r: 600, nx: 0, nz: 0, nr: 600, stage: ZONES.length, left: 0, shrinking: 0, dps: 0, fx: 0, fz: 0, fr: 0 };
    // 見通しのよい場所と向きをさがす（町から少し離れた陸の上で、200m 先まで見える向き）
    const DIST = [10, 20, 35, 50, 75, 100, 150, 200];
    let best = null;
    for (let i = 0; i < 300 && !(best && best.score === DIST.length); i++) {
      const x = (Math.random() - 0.5) * 400, z = (Math.random() - 0.5) * 400;
      if (W.heightAt(x, z) < 2 || !this.nav.freeAt(x, z) || W.buildingAt(x, z) >= 0) continue;
      const y = W.groundAt(x, z);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        let score = 0;
        for (const d of DIST) {
          const tx = x + dx * d, tz = z + dz * d;
          if (Math.abs(tx) > HALF - 10 || Math.abs(tz) > HALF - 10 || W.heightAt(tx, tz) < 0.5) break;
          if (!W.visible(x, y + 1.6, z, tx, W.groundAt(tx, tz) + 1.2, tz)) break;
          score++;
        }
        if (!best || score > best.score) best = { x, z, y, dx, dz, score };
      }
    }
    const { x, z, y, dx, dz } = best;
    me.st = ST.GROUND; me.x = x; me.y = y; me.z = z; me.yaw = Math.atan2(-dx, -dz); me.corr++;
    me.rangeHome = { x, z };
    // 的
    const dummies = this.players.filter(p => p && p.bot);
    dummies.forEach((p, i) => {
      const d = DIST[i % DIST.length] + Math.floor(i / DIST.length) * 4;
      const side = (i % 3) - 1;   // 左・まん中・右に少しずらす
      const tx = x + dx * d - dz * side * 3, tz = z + dz * d + dx * side * 3;
      p.st = ST.GROUND; p.x = tx; p.z = tz; p.y = W.groundAt(tx, tz);
      p.yaw = Math.atan2(dx, dz);   // 自分の方を向く
      p.dummy = { x: tx, z: tz, moving: i % 3 === 1, side: -dz, sz: dx, ph: i };
      p.helmet = i % 4; p.vest = (i + 1) % 4;   // 防具の違いでダメージがどう変わるか試せるように
    });
    // 足もとに、全部の武器・アタッチメント・弾・装備・回復を並べる（自分の後ろ）
    const items = [];
    for (let w = 1; w <= 8; w++) items.push([IT.WEAPON + w - 1, WEAPONS[w].mag]);
    for (let c = IT.ATT; c < ITEM_COUNT; c++) items.push([c, 1]);
    for (let a = 0; a < 4; a++) for (let k = 0; k < 3; k++) items.push([IT.AMMO + a, AMMO_STACK[a]]);
    items.push([IT.HELMET + 2, 1], [IT.VEST + 2, 1], [IT.PACK + 2, 1], [IT.HEAL, 5], [IT.HEAL + 1, 2], [IT.HEAL + 2, 3], [IT.GRENADE, 3]);
    const cols = 7;
    items.forEach(([code, qty], i) => {
      const r = 3 + Math.floor(i / cols) * 1.3, s = ((i % cols) - (cols - 1) / 2) * 1.3;
      const lx = x - dx * r - dz * s, lz = z - dz * r + dx * s;
      this.addLoot(code, qty, lx, W.groundAt(lx, lz, y + 1), lz);
    });
  }

  newPlayer(slot, s) {
    const p = {
      slot, bot: s.k === 2, name: s.n, st: ST.PLANE,
      x: this.plane.x, y: PLANE_ALT, z: this.plane.z, yaw: this.plane.yaw, pitch: 0, fl: 0,
      vx: 0, vy: 0, vz: 0, h: STAND_H, onGround: false,
      hp: 100, boost: 0, helmet: 0, vest: 0, pack: 0, hand: 2, w: [0, 0], m: [0, 0], ammo: [0, 0, 0, 0], heals: [0, 0, 0], gren: 0, det: 0, detUntil: 0, padT: -9,
      att: [[0, 0, 0, 0], [0, 0, 0, 0]], spares: [],   // 銃に付いているアタッチメント（枠ごとに [スコープ, マズル, グリップ, マガジン]）と予備
      kills: 0, dmg: 0, rank: 0, act: 0, actT: 0, actDur: 0,
      corr: 1, mvSeq: -1, lastAccT: now(), shotSeq: -1, lastShotT: 0, tokens: 3, evAck: -1,
      hist: [], H: [], D: [], firedT: 0, lastGrenT: 0, lastStampT: 0, deadAt: 0,
    };
    if (p.bot) p.brain = newBotBrain(p, this);
    return p;
  }

  pickInside(cx, cz, maxR, newR) {
    // 中心が陸になるように何回か試す
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.max(0, maxR);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!this.world || this.world.heightAt(x, z) > 1 || i > 30) return [x, z];
    }
    return [cx, cz];
  }

  planeAt() {
    const P = this.plane;
    P.x = P.sx + P.dx * P.d; P.z = P.sz + P.dz * P.d;
  }
  planeOverMap() { const P = this.plane; return Math.abs(P.x) < HALF - 20 && Math.abs(P.z) < HALF - 20; }

  backToLobby() {
    this.phase = PH.LOBBY;
    this.players = [];
    for (const s of this.slots) if (s && s.k === 1 && !s.local) s.r = 0;
    this.lobbyChanged();
  }

  // ---- できごと ----
  ev(k, a = 0, b = 0, c = 0, d = 0, e = 0, f = 0) {
    this.events.push([this.events.length, k, a, b, c, d, e, f]);
  }
  addLoot(code, qty, x, y, z) {
    if (this.nextLoot > MAX_LOOT_ID) return;
    const id = this.nextLoot++;
    const l = { id, code, qty, x: r2(clamp(x, -HALF + 2, HALF - 2)), y: r2(y), z: r2(clamp(z, -HALF + 2, HALF - 2)), b: this.world.buildingAt(x, z) };
    this.loot.set(id, l);
    this.ev(1, id, code, qty, l.x, l.y, l.z);
  }
  setLootQty(l, qty) {
    if (qty <= 0) { this.loot.delete(l.id); this.ev(0, l.id); return; }
    l.qty = qty;
    this.ev(1, l.id, l.code, qty, l.x, l.y, l.z);
  }
  alivePlayers() { return this.players.filter(p => p && p.st >= ST.PLANE && p.st <= ST.GROUND); }

  // ---- クライアントからのメッセージ（検査済み） ----
  onMessage(slot, msg) {
    const p = this.players[slot];
    if (msg.t === "hi") return;
    if (this.phase === PH.LOBBY || !p) return;
    switch (msg.t) {
      case "mv": this.onMove(p, msg); break;
      case "sh": this.onShot(p, msg); break;
      case "gr": this.throwGrenade(p, msg.o, msg.v); break;
      case "ac": this.action(p, msg.a, msg.v); break;
    }
  }

  onMove(p, msg) {
    p.evAck = Math.max(p.evAck, Math.min(msg.ea, this.events.length - 1));
    if (msg.s <= p.mvSeq) return;   // 古い・重複
    p.mvSeq = msg.s;
    const [x, y, z, yaw, pitch, st, fl] = msg.p;
    p.yaw = yaw; p.pitch = pitch;
    p.fl = (p.fl & ~7) | (fl & 7);
    p.h = fl & 1 ? CROUCH_H : STAND_H;
    if (p.st < ST.FALL || p.st > ST.GROUND) return;
    let ns = st >= p.st && st <= ST.GROUND && st >= ST.FALL ? st : p.st;
    // 速さの検査は「貯金」方式: 待った時間のぶんだけ動いてよい距離が貯まる（最大 2.5 秒ぶん）。
    // 回線がつまって申告がまとめて届いても、正しい動きなら戻されない。戻すのは明らかな瞬間移動だけ
    const t = now();
    const hdt = clamp((t - p.lastAccT) / 1000, 0, 2.5);
    p.lastAccT = t;
    const vmax = MAX_SPEED[p.st] + (p.boost > 60 ? 0.6 : 0);
    p.budget = Math.min(vmax * 2.5, (p.budget ?? vmax) + vmax * hdt);
    const horiz = Math.hypot(x - p.x, z - p.z);
    const up = y - p.y;
    // ジャンプ台の近くにいたら、しばらく上向きに速く動いてよい
    if (this.world.pads.some(q => Math.abs(q.x - p.x) < 2.5 && Math.abs(q.z - p.z) < 2.5 && Math.abs(q.y - p.y) < 1)) p.padT = this.time;
    const vup = p.st === ST.GROUND ? (this.time - p.padT < 1.5 ? PAD_JUMP + 2 : 9) : 1;
    p.ubudget = Math.min(vup * 2.5 + 1.5, (p.ubudget ?? vup) + vup * hdt);
    if (horiz > p.budget + 1.0 || up > p.ubudget + 0.8 || Math.abs(x) > HALF || Math.abs(z) > HALF) {
      this.correct(p);   // 明らかに速すぎる申告は、最後に受け入れた位置へ戻す
      p.budget = vmax; p.ubudget = vup;
      return;
    }
    p.budget -= horiz;
    if (up > 0) p.ubudget -= up;
    p.x = x; p.y = y; p.z = z; p.st = ns;
  }
  correct(p) { p.corr++; }

  // ---- 撃つ ----
  onShot(p, msg) {
    if (msg.s <= p.shotSeq) return;
    p.shotSeq = msg.s;
    if (p.st !== ST.GROUND) return;
    const wid = p.hand <= 1 ? p.w[p.hand] : p.hand === 2 ? 0 : -1;
    if (wid !== msg.w || wid < 0) return;
    // 申告された銃口がホストの知る目の位置から離れすぎていたら、ホストの位置を使う
    const ey = p.y + (p.h < STAND_H ? EYE.crouch : EYE.stand);
    let [ox, oy, oz] = msg.o;
    if (Math.hypot(ox - p.x, oy - ey, oz - p.z) > 2.5) { ox = p.x; oy = ey; oz = p.z; }
    this.fire(p, wid, ox, oy, oz, msg.d, clamp(msg.rt, now() - 600, now()));
  }

  /** 撃つ。連射の速さ・弾数を確かめ、当たりを判定する。dirs は単位ベクトルの配列 */
  fire(p, wid, ox, oy, oz, dirs, rt) {
    const W = WEAPONS[wid];
    const t = now();
    const interval = 60000 / W.rpm;
    p.tokens = Math.min(2, p.tokens + (t - p.lastShotT) / interval);
    if (t - p.lastShotT < interval * 0.55 || p.tokens < 0.9) return false;
    p.tokens -= 1;
    p.lastShotT = t;
    if (wid > 0) {
      const slot = p.hand;
      if (p.m[slot] <= 0) return false;
      p.m[slot]--;
    }
    if (p.act === 1 || p.act >= 2) p.act = 0;   // 撃つと装填・回復は中断
    p.firedT = t;
    const n = Math.min(W.pellets, dirs.length);
    const d0 = dirs[0];
    const hits = new Map();   // 当たった人 → { dmg, head }
    const others = this.players.filter(q => q && q !== p && q.st >= ST.FALL && q.st <= ST.GROUND).map(q => ({ q, pos: this.posAt(q, rt) }));
    for (let i = 0; i < n; i++) {
      const d = dirs[i];
      if (d[0] * d0[0] + d[1] * d0[1] + d[2] * d0[2] < 0.97) continue;   // 散弾の広がりは 14° まで
      const tw = this.world.raycast(ox, oy, oz, d[0], d[1], d[2], W.maxRange);
      let best = tw, who = null, head = false;
      for (const { q, pos } of others) {
        const h = rayPlayer(ox, oy, oz, d[0], d[1], d[2], best, pos);
        if (h && h.t < best) { best = h.t; who = q; head = h.head; }
      }
      if (i < 2 || who) {
        const quiet = p.hand <= 1 && weaponStats(wid, p.att[p.hand]).quiet ? 16 : 0;
        if (this.tracers.length < 30) this.tracers.push([p.slot, wid + quiet, r2(ox), r2(oy), r2(oz), r2(ox + d[0] * best), r2(oy + d[1] * best), r2(oz + d[2] * best)]);
      }
      if (who) {
        let dmg = W.dmg * (head ? W.head : 1);
        if (best > W.range) dmg *= lerp(1, 0.45, clamp((best - W.range) / (W.maxRange - W.range), 0, 1));
        dmg *= 1 - ARMOR_CUT[head ? who.helmet : who.vest];
        const e = hits.get(who) ?? { dmg: 0, head: false };
        e.dmg += dmg; e.head = e.head || head;
        hits.set(who, e);
      }
    }
    for (const [q, e] of hits) this.damage(q, e.dmg, p, wid, e.head ? 1 : 0, p.x, p.z);
    return true;
  }

  /** 時刻 t（ホストの時計）にいた位置。記録の間を補間する */
  posAt(q, t) {
    const H = q.hist;
    if (!H.length || t >= H[H.length - 1].t) return { x: q.x, y: q.y, z: q.z, h: q.h };
    for (let i = H.length - 1; i > 0; i--) {
      const a = H[i - 1], b = H[i];
      if (t >= a.t) {
        const k = (t - a.t) / Math.max(1, b.t - a.t);
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), h: b.h };
      }
    }
    return { x: H[0].x, y: H[0].y, z: H[0].z, h: H[0].h };
  }

  damage(v, amount, src, cause, head, sx, sz) {
    if (v.st < ST.FALL || v.st > ST.GROUND || amount <= 0) return;
    if (src && src !== v && this.team(src) && this.team(src) === this.team(v)) return;   // 味方には当たらない
    if (this.mode === MODE.RANGE) {
      // 訓練場: 的は倒れない（体力 0 になったら「倒した」と表示して満タンに戻す）。自分も倒れない
      const before = v.hp;
      v.hp = Math.max(0, v.hp - amount);
      if (src && src !== v && src.H.length < 20) src.H.push([v.slot, Math.round(amount), head, v.hp <= 0 && before > 0 ? 1 : 0]);
      if (src && src !== v) src.dmg += Math.min(amount, before);
      if (v.hp <= 0) v.hp = v.bot ? 100 : 1;
      return;
    }
    v.hp -= amount;
    const killed = v.hp <= 0;
    if (src && src !== v) {
      src.dmg += Math.min(amount, amount + Math.min(0, v.hp));
      if (src.H.length < 20) src.H.push([v.slot, Math.round(amount), head, killed ? 1 : 0]);
    }
    if (sx !== undefined && v.D.length < 10) v.D.push([r2(sx), r2(sz)]);
    if (v.bot) v.brain.hurt = { x: sx ?? v.x, z: sz ?? v.z, t: this.time, by: src };
    if (killed) this.kill(v, src ? src.slot : -1, cause, head);
  }

  kill(v, killerSlot, cause, head) {
    const aliveBefore = this.alivePlayers().length;
    v.st = ST.DEAD; v.hp = 0; v.act = 0;
    // 空中（降下中・パラシュート・ジャンプ中）で倒れたら、真下の地面（屋根の上なども）に下ろす
    v.y = this.world.groundAt(v.x, v.z, v.y + 0.5);
    v.hist.length = 0;
    v.rank = aliveBefore;
    v.deadAt = this.time;
    const killer = killerSlot >= 0 ? this.players[killerSlot] : null;
    if (killer && killer !== v) killer.kills++;
    this.ev(2, killer && killer !== v ? killerSlot : -1, v.slot, cause, head ? 1 : 0);
    this.dropAll(v);
    const alive = this.alivePlayers();
    if (this.mode === MODE.TEAM) {
      const humans = alive.filter(p => !p.cpuTeam).length, cpus = alive.filter(p => p.cpuTeam).length;
      if ((!humans || !cpus) && !this.over) {
        this.over = true;
        const team = humans ? 1 : cpus ? 2 : 0;
        this.winner = -1;
        for (const p of alive) p.rank = 1;
        this.ev(6, -1, team);
        this.overAt = this.time;
      }
    } else if (alive.length <= 1 && !this.over) {
      this.over = true;
      this.winner = alive[0] ? alive[0].slot : -1;
      if (alive[0]) alive[0].rank = 1;
      this.ev(6, this.winner);
      this.overAt = this.time;
    }
  }

  dropAll(v) {
    const items = [];
    for (let s = 0; s < 2; s++) if (v.w[s]) items.push([IT.WEAPON + v.w[s] - 1, v.m[s]]);
    v.ammo.forEach((n, i) => { while (n > 0) { const k = Math.min(n, 60); items.push([IT.AMMO + i, k]); n -= k; } });
    v.heals.forEach((n, i) => { if (n > 0) items.push([IT.HEAL + i, n]); });
    if (v.gren) items.push([IT.GRENADE, v.gren]);
    if (v.det) items.push([IT.DETECT, v.det]);
    for (const a of [...v.att[0], ...v.att[1], ...v.spares]) if (a) items.push([a, 1]);
    if (v.helmet) items.push([IT.HELMET + v.helmet - 1, 1]);
    if (v.vest) items.push([IT.VEST + v.vest - 1, 1]);
    if (v.pack) items.push([IT.PACK + v.pack - 1, 1]);
    v.w = [0, 0]; v.m = [0, 0]; v.ammo = [0, 0, 0, 0]; v.heals = [0, 0, 0]; v.gren = 0; v.det = 0; v.helmet = v.vest = v.pack = 0; v.hand = 2;
    v.att = [[0, 0, 0, 0], [0, 0, 0, 0]]; v.spares = [];
    items.forEach(([code, qty], i) => {
      const a = (i / Math.max(1, items.length)) * Math.PI * 2, r = 0.5 + (i % 3) * 0.45;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      this.addLoot(code, qty, x, this.world.groundAt(x, z, v.y + 1), z);
    });
  }

  // ---- 行動 ----
  action(p, a, v) {
    if (a === AC.JUMP) {
      if (p.st === ST.PLANE && this.planeOverMap()) this.jump(p);
      return;
    }
    if (a === AC.STAMP) {
      if (p.st === ST.NONE || this.time - p.lastStampT < 1.2) return;
      p.lastStampT = this.time;
      this.ev(4, p.slot, v);
      return;
    }
    if (p.st !== ST.GROUND) return;
    switch (a) {
      case AC.PICK: this.pick(p, v); break;
      case AC.RELOAD: {
        if (p.hand > 1 || p.act) return;
        const wid = p.w[p.hand];
        if (!wid) return;
        const W = WEAPONS[wid];
        if (p.m[p.hand] >= this.magSize(p, p.hand) || p.ammo[W.ammo] <= 0) return;
        this.startAct(p, 1, W.reload);
        break;
      }
      case AC.HEAL: {
        if (v < 0 || v > 2 || p.heals[v] <= 0 || p.act) return;
        const H = HEALS[v];
        if (v < 2 && p.hp >= H.upto) return;
        if (v === 2 && p.boost >= 100) return;
        this.startAct(p, 2 + v, H.time);
        break;
      }
      case AC.HAND: {
        if (v < 0 || v > 3) return;
        if (v <= 1 && !p.w[v]) return;
        if (v === 3 && !p.gren) return;
        if (p.hand !== v && p.act === 1) p.act = 0;
        p.hand = v;
        break;
      }
      case AC.CANCEL: p.act = 0; break;
      case AC.ATTACH: this.attach(p, v >> 1, v & 1); break;
      case AC.DETACH: this.detach(p, (v >> 2) & 1, v & 3); break;
      case AC.DROP_ATT: {
        if (v < 0 || v >= p.spares.length) return;
        const [code] = p.spares.splice(v, 1);
        this.addLoot(code, 1, p.x, p.y + 0.05, p.z);
        break;
      }
      case AC.DETECT: {
        if (p.det <= 0 || this.time < p.detUntil) return;
        p.det--;
        p.detUntil = this.time + DETECT.time;
        break;
      }
    }
  }
  startAct(p, act, dur) { p.act = act; p.actT = 0; p.actDur = dur; }

  /** その枠の銃の装弾数（拡張マガジンを含む） */
  magSize(p, s) { return p.w[s] ? weaponStats(p.w[s], p.att[s]).mag : 0; }

  /** 予備の番号 i のアタッチメントを、枠 s の銃に付ける（付いていた物は予備へ） */
  attach(p, i, s) {
    const code = p.spares[i], wid = p.w[s];
    if (!code || !wid || !attFits(wid, code)) return;
    const part = ATTS[code - IT.ATT].part;
    const old = p.att[s][part];
    p.spares.splice(i, 1);
    p.att[s][part] = code;
    if (old) { this.unmag(p, s, old); p.spares.push(old); }
  }
  /** 枠 s の銃の部位 part を外して予備へ（予備がいっぱいなら足もとに置く） */
  detach(p, s, part) {
    const code = p.att[s]?.[part];
    if (!code) return;
    p.att[s][part] = 0;
    this.unmag(p, s, code);
    if (p.spares.length < MAX_SPARES) p.spares.push(code);
    else this.addLoot(code, 1, p.x, p.y + 0.05, p.z);
  }
  /** 拡張マガジンを外した時、入りきらない弾は予備の弾へ戻す */
  unmag(p, s, code) {
    if (ATTS[code - IT.ATT].part !== 3 || !p.w[s]) return;
    const over = p.m[s] - this.magSize(p, s);
    if (over > 0) { p.m[s] -= over; p.ammo[WEAPONS[p.w[s]].ammo] += over; if (p.act === 1 && p.hand === s) p.act = 0; }
  }
  /** 予備のうち、枠 s の銃の空いている部位に付けられる物を付ける（今のより倍率の高いスコープは付けかえる） */
  autoAttach(p, s) {
    for (let i = 0; i < p.spares.length; i++) {
      const code = p.spares[i];
      if (!attFits(p.w[s], code)) continue;
      const part = ATTS[code - IT.ATT].part, cur = p.att[s][part];
      if (!cur || (part === 0 && ATTS[code - IT.ATT].zoom > ATTS[cur - IT.ATT].zoom)) { this.attach(p, i, s); i = -1; }
    }
  }

  finishAct(p) {
    const a = p.act;
    p.act = 0;
    if (a === 1) {
      const wid = p.w[p.hand];
      if (!wid || p.hand > 1) return;
      const W = WEAPONS[wid];
      const take = Math.min(this.magSize(p, p.hand) - p.m[p.hand], p.ammo[W.ammo]);
      p.m[p.hand] += take; p.ammo[W.ammo] -= take;
    } else if (a >= 2) {
      const h = a - 2, H = HEALS[h];
      if (p.heals[h] <= 0) return;
      p.heals[h]--;
      if (H.hp) p.hp = Math.max(p.hp, Math.min(H.upto, p.hp + H.hp));
      if (H.boost) p.boost = Math.min(100, p.boost + H.boost);
    }
  }

  jump(p) {
    p.st = ST.FALL;
    p.x = this.plane.x; p.z = this.plane.z; p.y = PLANE_ALT - 4;
    p.vx = this.plane.dx * 10; p.vz = this.plane.dz * 10; p.vy = 0;
    p.lastAccT = now();
    this.correct(p);
  }

  pick(p, id) {
    const l = this.loot.get(id);
    if (!l) return;
    if (Math.hypot(l.x - p.x, l.z - p.z) > 3 || Math.abs(l.y - p.y) > 2.2) return;
    const info = itemInfo(l.code);
    const C = caps(p.pack);
    switch (info.kind) {
      case "weapon": {
        let s = !p.w[0] ? 0 : !p.w[1] ? 1 : p.hand <= 1 ? p.hand : 0;
        if (p.w[s]) {
          // 持っていた武器を置く（込めてあった弾も一緒に）。付いていたアタッチメントは外して予備へ（あふれたら足もと）
          for (let part = 0; part < 4; part++) this.detach(p, s, part);
          const old = p.m[s];
          this.addLoot(IT.WEAPON + p.w[s] - 1, Math.min(old, WEAPONS[p.w[s]].mag), p.x, p.y + 0.05, p.z);
        }
        if (p.act === 1) p.act = 0;
        p.w[s] = info.sub; p.m[s] = Math.min(l.qty, WEAPONS[info.sub].mag); p.hand = s;
        p.att[s] = [0, 0, 0, 0];
        this.setLootQty(l, 0);
        this.autoAttach(p, s);
        break;
      }
      case "ammo": {
        const take = Math.min(l.qty, C.ammo - p.ammo[info.sub]);
        if (take <= 0) return;
        p.ammo[info.sub] += take;
        this.setLootQty(l, l.qty - take);
        break;
      }
      case "heal": {
        const take = Math.min(l.qty, C.heal[info.sub] - p.heals[info.sub]);
        if (take <= 0) return;
        p.heals[info.sub] += take;
        this.setLootQty(l, l.qty - take);
        break;
      }
      case "att": {
        // 付けられる銃の空いている部位に自動で付ける（手に持っている銃が先）。だめなら予備へ。予備もいっぱいなら拾わない
        const order = p.hand === 1 ? [1, 0] : [0, 1];
        const part = info.part;
        let done = false;
        for (const s of order) {
          if (!p.w[s] || !attFits(p.w[s], l.code)) continue;
          const cur = p.att[s][part];
          if (!cur || (part === 0 && ATTS[l.code - IT.ATT].zoom > ATTS[cur - IT.ATT].zoom)) {
            if (cur) { if (p.spares.length >= MAX_SPARES) continue; p.spares.push(cur); }
            p.att[s][part] = l.code;
            done = true;
            break;
          }
        }
        if (!done) { if (p.spares.length >= MAX_SPARES) return; p.spares.push(l.code); }
        this.setLootQty(l, l.qty - 1);
        break;
      }
      case "detect": {
        const take = Math.min(l.qty, DETECT.max - p.det);
        if (take <= 0) return;
        p.det += take;
        this.setLootQty(l, l.qty - take);
        break;
      }
      case "grenade": {
        const take = Math.min(l.qty, C.gren - p.gren);
        if (take <= 0) return;
        p.gren += take;
        this.setLootQty(l, l.qty - take);
        break;
      }
      case "helmet": case "vest": case "pack": {
        const cur = p[info.kind];
        if (info.sub <= cur) return;   // 今の方が強い（同じ）なら拾わない
        const base = info.kind === "helmet" ? IT.HELMET : info.kind === "vest" ? IT.VEST : IT.PACK;
        this.setLootQty(l, 0);
        if (cur) this.addLoot(base + cur - 1, 1, p.x, p.y + 0.05, p.z);
        p[info.kind] = info.sub;
        break;
      }
    }
  }

  throwGrenade(p, o, v) {
    if (p.st !== ST.GROUND || p.hand !== 3 || p.gren <= 0) return;
    if (this.time - p.lastGrenT < 1) return;
    p.lastGrenT = this.time;
    p.gren--;
    const ey = p.y + (p.h < STAND_H ? EYE.crouch : EYE.stand);
    let [ox, oy, oz] = o;
    if (Math.hypot(ox - p.x, oy - ey, oz - p.z) > 2.5) { ox = p.x; oy = ey; oz = p.z; }
    let [vx, vy, vz] = v;
    const sp = Math.hypot(vx, vy, vz);
    if (sp > GRENADE.speed + 3) { const k = (GRENADE.speed + 3) / sp; vx *= k; vy *= k; vz *= k; }
    this.grenades.push({ id: this.nextGren++, x: ox, y: oy, z: oz, vx, vy, vz, fuse: GRENADE.fuse, owner: p.slot });
    if (!p.gren) p.hand = p.w[0] ? 0 : p.w[1] ? 1 : 2;
  }

  explode(g) {
    this.ev(3, r2(g.x), r2(g.y), r2(g.z));
    const src = this.players[g.owner];
    for (const q of this.players) {
      if (!q || q.st < ST.FALL || q.st > ST.GROUND) continue;
      const cy = q.y + 1;
      const d = Math.hypot(q.x - g.x, cy - g.y, q.z - g.z);
      if (d > GRENADE.radius) continue;
      if (!this.world.visible(g.x, g.y + 0.3, g.z, q.x, cy, q.z) && !this.world.visible(g.x, g.y + 0.3, g.z, q.x, q.y + q.h - 0.2, q.z)) continue;
      const dmg = GRENADE.dmg * (1 - d / GRENADE.radius) * (1 - ARMOR_CUT[q.vest] * 0.7);
      this.damage(q, dmg, src, CAUSE.GRENADE, 0, g.x, g.z);
    }
  }

  // ---- 1 コマ進める ----
  tick() {
    const dt = 1 / TICK_HZ;
    this.f++;
    if (this.phase === PH.LOBBY) return;
    this.time += dt;
    const t = now();
    // 飛行機
    const P = this.plane;
    if (P.on) {
      P.d += PLANE_SPEED * dt;
      this.planeAt();
      for (const p of this.players) if (p && p.st === ST.PLANE) { p.x = P.x; p.z = P.z; p.y = PLANE_ALT; }
      if (P.d > P.len * 0.84) for (const p of this.players) if (p && p.st === ST.PLANE) this.jump(p);   // 最後まで乗っていた人は降ろす
      if (P.d >= P.len) P.on = 0;
    }
    // 安全地帯
    if (!this.over) this.updateZone(dt);
    const Z = this.zone;
    for (const p of this.players) {
      if (!p) continue;
      if (p.st >= ST.FALL && p.st <= ST.GROUND) {
        // 回復・装填
        if (p.act) { p.actT += dt; if (p.actT >= p.actDur) this.finishAct(p); }
        // ブースト: 少しずつ回復・減っていく
        if (p.boost > 0) {
          p.boost = Math.max(0, p.boost - dt / 2.4);
          if (p.boost > 0) p.hp = Math.min(100, p.hp + dt * (p.boost > 60 ? 1.6 : 0.9));
        }
        // 安全地帯の外
        if (Math.hypot(p.x - Z.cx, p.z - Z.cz) > Z.r && !this.over) this.damage(p, Z.dps * dt, null, CAUSE.ZONE, 0);
      }
      if (p.bot && p.st !== ST.DEAD) updateBot(p, this, dt);
      // 巻き戻し用の位置の記録（1.5 秒ぶん）
      p.hist.push({ t, x: p.x, y: p.y, z: p.z, h: p.h });
      if (p.hist.length > 32) p.hist.shift();
    }
    // グレネード
    for (const g of this.grenades) {
      g.fuse -= dt;
      for (let s = 0; s < 4; s++) grenadeStep(this.world, g, dt / 4);
      if (g.fuse <= 0) { this.explode(g); g.dead = true; }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
    // 補給物資: パラシュートで降りてきて、着地したら中身（探知機）を置く
    for (const d of this.drops) {
      if (d.landed) continue;
      d.y -= DROP_SPEED * dt;
      if (d.y <= d.gy) {
        d.y = d.gy; d.landed = 1;
        this.addLoot(IT.DETECT, 1, d.x, d.gy + 1.05, d.z);
      }
    }
    // 決着から 6 秒で結果へ
    if (this.over && this.phase === PH.GAME && this.time - this.overAt > 6) { this.phase = PH.OVER; this.lobbyChanged(); }
  }

  updateZone(dt) {
    const Z = this.zone;
    if (Z.stage >= ZONES.length) return;
    const [, shrink, , dps] = ZONES[Z.stage];
    Z.left -= dt;
    if (!Z.shrinking) {
      if (Z.left <= 0) {
        Z.shrinking = 1; Z.left = shrink; Z.fx = Z.cx; Z.fz = Z.cz; Z.fr = Z.r;
        Z.dps = dps;
        this.ev(5, Z.stage + 1, 1);
        if (Z.stage <= 2) this.spawnDrop();
      }
    } else {
      const k = clamp(1 - Z.left / shrink, 0, 1);
      Z.cx = lerp(Z.fx, Z.nx, k); Z.cz = lerp(Z.fz, Z.nz, k); Z.r = lerp(Z.fr, Z.nr, k);
      if (Z.left <= 0) {
        Z.stage++;
        Z.shrinking = 0;
        if (Z.stage < ZONES.length) {
          Z.left = ZONES[Z.stage][0];
          const nr = ZONES[Z.stage][2];
          const c = this.pickInside(Z.cx, Z.cz, Z.r - nr, nr);
          Z.nx = c[0]; Z.nz = c[1]; Z.nr = nr;
          this.ev(5, Z.stage + 1, 0);
        } else { Z.left = 0; }
      }
    }
  }

  /** 最後の段階まで縮みきったか（その後は中心へ向かうしかない） */
  get zoneFinal() { return this.zone.stage >= ZONES.length; }

  /** 補給物資を次の安全地帯の中（陸・建物の外）に落とす */
  spawnDrop() {
    const Z = this.zone, W = this.world;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Z.nr * 0.75;
      const x = Z.nx + Math.cos(a) * r, z = Z.nz + Math.sin(a) * r;
      const gy = W.groundAt(x, z);
      if (W.heightAt(x, z) < 1.5 || Math.abs(gy - W.heightAt(x, z)) > 0.05 || !this.nav.freeAt(x, z)) continue;
      const d = { id: this.nextDrop++, x: r2(x), z: r2(z), y: DROP_ALT, gy, landed: 0 };
      this.drops.push(d);
      this.ev(7, d.id, d.x, d.z);
      return;
    }
  }

  // ---- 送るもの ----
  /** みんなに同じ部分（JSON の閉じかっこの手前まで） */
  commonSnap() {
    const Z = this.zone, P = this.plane;
    const o = {
      t: "st", f: this.f, tm: Math.round(now()), ph: this.phase, al: this.alivePlayers().length,
      F: this.players.length ? this.slots.map((s, i) => {
        const p = this.players[i];
        if (!p) return null;
        const fl = (p.fl & 7) | (p.act === 1 ? 8 : 0) | (p.act >= 2 ? 16 : 0) | (now() - p.firedT < 120 ? 32 : 0);
        const hold = p.hand <= 1 ? p.w[p.hand] : p.hand === 3 ? W_GRENADE : 0;
        // 通信量を抑えるため、座標は 10cm、向きは 0.01rad、体力は整数に丸める（見た目は補間するので十分なめらか）
        return [r1(p.x), r1(p.y), r1(p.z), r2(p.yaw), r2(p.pitch), p.st, Math.ceil(Math.max(0, p.hp)), hold, fl, p.helmet + p.vest * 4 + p.pack * 16];
      }) : new Array(MAX_PLAYERS).fill(null),
      Z: Z ? [r2(Z.cx), r2(Z.cz), r2(Z.r), r2(Z.nx), r2(Z.nz), r2(Z.nr), Math.min(Z.stage + 1, 9), r2(Math.max(0, Z.left)), Z.shrinking, Z.dps] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      PL: P ? [r2(P.x), r2(P.z), r3(P.yaw), P.on] : [0, 0, 0, 0],
      T: this.tracers || [],
      G: (this.grenades || []).slice(0, 16).map(g => [g.id, g.owner, r2(g.x), r2(g.y), r2(g.z)]),
      A: (this.drops || []).slice(-8).map(d => [d.id, d.x, r2(d.y), d.z, d.landed]),
    };
    if (this.phase !== PH.LOBBY && this.over) {
      o.R = this.players.filter(Boolean).map(p => [p.slot, Math.max(1, p.rank || 1), p.kills, Math.round(p.dmg)]);
    }
    return JSON.stringify(o).slice(0, -1);
  }

  /** その人だけの部分を足して 1 通にする */
  snapFor(slot, common) {
    const p = this.players[slot];
    if (!p) return common + "}";
    const Y = [p.shotSeq, r2(Math.max(0, p.hp)), r2(p.boost), p.helmet, p.vest, p.pack, p.hand, p.w[0], p.m[0], p.w[1], p.m[1],
      ...p.ammo, ...p.heals, p.gren, p.kills, p.act, p.act ? r2(clamp(p.actT / p.actDur, 0, 1)) : 0,
      p.corr, r2(p.x), r2(p.y), r2(p.z), p.rank, Math.round(p.dmg), p.det, r2(Math.max(0, p.detUntil - this.time)),
      ...p.att[0], ...p.att[1], ...[0, 1, 2, 3, 4, 5].map(i => p.spares[i] || 0)];
    const E = this.events.slice(p.evAck + 1, p.evAck + 1 + 28);
    let s = common + ',"Y":' + JSON.stringify(Y);
    if (E.length) s += ',"E":' + JSON.stringify(E.map(e => e.map(v => (typeof v === "number" ? r2(v) : v))));
    if (p.H.length) { s += ',"H":' + JSON.stringify(p.H); p.H = []; }
    if (p.D.length) { s += ',"D":' + JSON.stringify(p.D); p.D = []; }
    // 探知機を使っている間は、ほかの生きている人の位置を送る
    if (p.detUntil > this.time && p.st !== ST.DEAD) {
      const X = this.players.filter(q => q && q !== p && q.st >= ST.FALL && q.st <= ST.GROUND).map(q => [q.slot, r2(q.x), r2(q.z)]);
      s += ',"X":' + JSON.stringify(X);
    }
    return s + "}";
  }

  endTick() { this.tracers = []; }

}

