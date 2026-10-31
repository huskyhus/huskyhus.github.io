// 対戦のシミュレーション。ホスト（と練習モード）だけが動かし、結果をスナップショットにして配る。
// 1 ステップ = 1/60 秒。座標は y が下向き。ファイターの (x, y) は足もとの中心。

import { MOVES, MOVE_BY_ID, MOVE_INDEX } from "./moves.js";

export const STAGE = { x0: 400, x1: 1200, y: 600, bottom: 700 };
export const BLAST = { x0: -250, x1: 1850, top: -420, bottom: 1250 };
export const BODY = { hw: 25, h: 90 };
export const MAX_PLAYERS = 4;

const GRAV = 0.6, MAXFALL = 12, FASTFALL = 17, HITSTUN_MAXFALL = 22;
const JUMP = -14, AIR_JUMP = -12.5, RUN = 7, AIR_MAX = 5;
const GUARD_MAX = 60;
const KB_GROWTH = 1.3;   // ふっとばしの伸び（全技共通の倍率）
const RESPAWN_WAIT = 90, RESPAWN_HOVER = 150, RESPAWN_INVULN = 150;
const COUNTDOWN = 180, GAME_END = 150;
const SPAWN_X = [520, 1080, 680, 920];

export const PHASES = ["lobby", "countdown", "fight", "game", "result"];
export const STATES = ["normal", "move", "hitstun", "dizzy", "dead", "out"];
export const EVENTS = ["hit", "ko", "guard", "counter", "break", "heal", "reflect", "swap", "jump", "start"];
export const PROJ_KINDS = ["wave", "boomerang", "bolt", "fire"];
export const FLAG = { invuln: 1, guard: 2, helpless: 4, sleep: 8, counter: 16, hover: 32, ground: 64 };

export const EMPTY_INPUT = Object.freeze({ x: 0, y: 0, held: 0, pressed: 0 });
const JUMP_BIT = 4;   // held / pressed のビット: 0..3 = A, B, X, Y、4 = ジャンプ

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

class Fighter {
  constructor({ slot, name, loadout, cpu, level = 2 }, stocks) {
    this.slot = slot;
    this.name = name;
    this.loadout = loadout;
    this.cpu = !!cpu;
    this.level = level;
    this.stocks = stocks;
    this.dmg = 0;
    this.x = SPAWN_X[slot];
    this.y = STAGE.y;
    this.vx = 0; this.vy = 0;
    this.face = this.x < 800 ? 1 : -1;
    this.grounded = true;
    this.jumps = 1;
    this.state = "normal";
    this.move = null;
    this.cd = [0, 0, 0, 0];
    this.hitstun = 0; this.hitlag = 0; this.invuln = 0; this.dizzy = 0;
    this.respawnT = 0; this.hover = 0;
    this.guardHp = GUARD_MAX;
    this.helpless = false; this.fastfall = false;
    this.airUsed = new Set();
    this.charge = 0;
    this.lastHitBy = -1;
    this.ai = { cool: 30, holdSlot: -1, holdT: 0 };
    this.clearFrameFlags();
  }
  clearFrameFlags() {
    this.noGravity = false; this.guarding = false; this.counter = false; this.sleeping = false;
  }
  get alive() { return this.state !== "dead" && this.state !== "out"; }
  hurtbox() {
    return { x0: this.x - BODY.hw, x1: this.x + BODY.hw, y0: this.y - BODY.h, y1: this.y };
  }
}

export class Sim {
  /** players: [{ slot, name, loadout, cpu, level }]。stocks が 0 ならストック無限（技の研究用。終わるのはロビーに戻したとき） */
  constructor(players, { stocks = 3 } = {}) {
    this.infinite = stocks === 0;
    this.fighters = [null, null, null, null];
    for (const p of players) this.fighters[p.slot] = new Fighter(p, this.infinite ? 1 : stocks);
    this.projs = [];
    this.events = [];
    this.eventId = 0;
    this.projId = 0;
    this.frame = 0;
    this.phase = "countdown";
    this.timer = COUNTDOWN;
    this.outOrder = [];
    this.inputs = [EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT];
  }

  get list() { return this.fighters.filter(Boolean); }

  /** inputs: スロットごとの { x, y, held, pressed } */
  step(inputs) {
    this.frame++;
    if (this.phase === "result") return;
    if (this.phase === "game") {
      if (--this.timer <= 0) this.phase = "result";
      return;
    }
    const live = this.phase === "fight";
    for (const F of this.list) {
      this.inputs[F.slot] = live ? (inputs[F.slot] || EMPTY_INPUT) : EMPTY_INPUT;
    }
    if (this.phase === "countdown" && --this.timer <= 0) { this.phase = "fight"; this.timer = 0; }

    for (const F of this.list) this.updateFighter(F, this.inputs[F.slot]);
    this.separate();
    for (const p of this.projs) this.updateProj(p);
    this.projs = this.projs.filter(p => !p.dead);
    this.events = this.events.filter(e => this.frame - e.frame < 45);
  }

  // ---- ファイター ----

  updateFighter(F, inp) {
    if (F.state === "out") return;
    if (F.state === "dead") {
      if (--F.respawnT <= 0) this.respawn(F);
      return;
    }
    if (F.hitlag > 0) { F.hitlag--; return; }
    F.clearFrameFlags();
    for (let i = 0; i < 4; i++) if (F.cd[i] > 0 && !(F.move && F.move.slot === i)) F.cd[i]--;
    if (F.invuln > 0) F.invuln--;
    if (!(F.move && F.move.id === "zazen")) F.guardHp = Math.min(GUARD_MAX, F.guardHp + 0.1);

    if (F.hover > 0) {
      F.hover--;
      F.vx = 0; F.vy = 0; F.noGravity = true;
      if (inp.pressed || Math.abs(inp.x) > 0.3 || Math.abs(inp.y) > 0.3) F.hover = 0;
      if (F.hover > 0) return;
    }

    switch (F.state) {
      case "hitstun":
        F.vx *= 0.975;
        if (--F.hitstun <= 0) F.state = "normal";
        break;
      case "dizzy":
        F.vx *= 0.8;
        if (--F.dizzy <= 0) F.state = "normal";
        break;
      case "move":
        this.runMove(F, inp);
        break;
      default:
        this.control(F, inp);
    }
    this.physics(F);
  }

  control(F, inp) {
    const sx = Math.abs(inp.x) > 0.2 ? inp.x : 0;
    if (F.grounded) {
      if (Math.abs(sx) > 0.3) F.face = sign(sx);
      if (sx) F.vx += clamp(sx * RUN - F.vx, -1.5, 1.5);
      else F.vx *= 0.7;
    } else {
      this.airDrift(F, sx, 0.6);
    }
    if (inp.pressed & (1 << JUMP_BIT) && !F.helpless) {
      if (F.grounded) {
        F.vy = JUMP; F.grounded = false;
        this.emit("jump", F.x, F.y, F.slot, 0);
      } else if (F.jumps > 0) {
        F.jumps--; F.vy = AIR_JUMP; F.vx = sx * AIR_MAX; F.fastfall = false;
        this.emit("jump", F.x, F.y, F.slot, 1);
      }
    }
    if (!F.grounded && F.vy > 0 && inp.y > 0.6) F.fastfall = true;
    if (F.helpless) return;
    for (let i = 0; i < 4; i++) {
      if (inp.pressed & (1 << i) && this.tryMove(F, i, sx)) break;
    }
  }

  airDrift(F, sx, accel) {
    if (sx) F.vx += sx * accel;
    if (Math.abs(F.vx) > AIR_MAX) F.vx -= sign(F.vx) * Math.min(0.4, Math.abs(F.vx) - AIR_MAX);
    if (!sx) F.vx *= 0.97;
  }

  tryMove(F, i, sx) {
    const def = MOVE_BY_ID[F.loadout[i]];
    if (!def || F.cd[i] > 0) return false;
    if (def.oncePerAir && F.airUsed.has(def.id)) return false;
    if (Math.abs(sx) > 0.3) F.face = sign(sx);
    if (def.oncePerAir && !F.grounded) F.airUsed.add(def.id);
    F.state = "move";
    F.move = { id: def.id, def, slot: i, f: 0, hitSet: new Set() };
    F.fastfall = false;
    this.emit("start", F.x, F.y, F.slot, MOVE_INDEX[def.id]);
    def.start?.(F, this);
    return true;
  }

  runMove(F, inp) {
    const m = F.move;
    m.f++;
    const sx = Math.abs(inp.x) > 0.2 ? inp.x : 0;
    if (F.grounded) F.vx *= 0.8;
    else this.airDrift(F, sx, 0.3);
    const r = m.def.tick?.(F, this, m.f);
    if (F.move !== m) return;   // tick の中で終わった（ガードが割れたなど）
    if (m.def.hits) {
      m.def.hits.forEach((h, gi) => { if (m.f >= h.f[0] && m.f <= h.f[1]) this.strike(F, h, gi); });
    }
    if (F.move === m && (r === false || m.f >= m.def.total)) this.endMove(F);
  }

  endMove(F) {
    if (!F.move) return;
    F.cd[F.move.slot] = F.move.def.cd;
    F.move = null;
    F.charge = 0;
    if (F.state === "move") F.state = "normal";
  }

  physics(F) {
    if (!F.noGravity) {
      F.vy += GRAV;
      const cap = F.state === "hitstun" ? HITSTUN_MAXFALL : F.fastfall ? FASTFALL : MAXFALL;
      if (F.fastfall && F.vy > 0) F.vy = FASTFALL;
      F.vy = Math.min(F.vy, Math.max(cap, F.move?.id === "saraba" ? 18 : 0));
    }
    const prevY = F.y;
    F.x += F.vx;
    F.y += F.vy;
    const onX = F.x >= STAGE.x0 && F.x <= STAGE.x1;

    if (F.grounded && !onX) F.grounded = false;   // 歩いて落ちた
    if (!F.grounded && F.vy >= 0 && prevY <= STAGE.y && F.y >= STAGE.y && onX) {
      F.y = STAGE.y;
      if (F.state === "hitstun" && F.vy > 7) {
        F.vy = -F.vy * 0.45;   // たたきつけられて跳ねる
        this.emit("hit", F.x, F.y, -1, 2);
      } else this.land(F);
    }
    if (F.grounded) { F.y = STAGE.y; F.vy = 0; }

    // 台の側面と底
    const inside = F.y > STAGE.y && F.y - BODY.h < STAGE.bottom
      && F.x + BODY.hw > STAGE.x0 && F.x - BODY.hw < STAGE.x1;
    if (inside) {
      if (prevY - BODY.h >= STAGE.bottom - 1) {
        F.y = STAGE.bottom + BODY.h; F.vy = Math.max(F.vy, 0);
      } else {
        F.x = F.x < (STAGE.x0 + STAGE.x1) / 2 ? STAGE.x0 - BODY.hw : STAGE.x1 + BODY.hw;
        F.vx = F.state === "hitstun" ? -F.vx * 0.4 : 0;
      }
    }

    // 崖のそばまで戻ってきたら、自動でよじ登る
    if (!F.grounded && F.state !== "hitstun" && F.state !== "dizzy"
      && F.y > STAGE.y && F.y < STAGE.y + 70 && F.vy > -6) {
      const nearL = F.x < STAGE.x0 && F.x > STAGE.x0 - 50;
      const nearR = F.x > STAGE.x1 && F.x < STAGE.x1 + 50;
      if (nearL || nearR) {
        F.x = nearL ? STAGE.x0 + 12 : STAGE.x1 - 12;
        F.y = STAGE.y;
        F.face = nearL ? 1 : -1;
        F.invuln = Math.max(F.invuln, 20);
        if (F.move?.id === "saraba") this.endMove(F);
        this.land(F);
      }
    }

    if (F.x < BLAST.x0 || F.x > BLAST.x1 || F.y > BLAST.bottom || F.y < BLAST.top) this.ko(F);
  }

  land(F) {
    F.grounded = true;
    F.vy = 0;
    F.jumps = 1;
    F.helpless = false;
    F.fastfall = false;
    F.airUsed.clear();
  }

  /** 重なったファイター同士を少しずつ押し離す */
  separate() {
    const L = this.list.filter(F => F.alive && F.hover <= 0);
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < BODY.hw * 1.6 && Math.abs(b.y - a.y) < 50 && a.grounded && b.grounded) {
          const s = dx === 0 ? (a.slot < b.slot ? 1 : -1) : sign(dx);
          a.x -= s * 1.5; b.x += s * 1.5;
        }
      }
    }
  }

  ko(F) {
    const cx = clamp(F.x, BLAST.x0, BLAST.x1), cy = clamp(F.y, BLAST.top, BLAST.bottom);
    this.emit("ko", cx, cy, F.slot, F.lastHitBy);
    F.move = null; F.charge = 0;
    if (!this.infinite) F.stocks--;
    F.dmg = 0;
    F.vx = F.vy = 0;
    F.helpless = false;
    if (F.stocks <= 0) {
      F.state = "out";
      this.outOrder.push(F.slot);
      this.checkEnd();
    } else {
      F.state = "dead";
      F.respawnT = RESPAWN_WAIT;
    }
  }

  respawn(F) {
    F.state = "normal";
    F.x = 800; F.y = 260;
    F.vx = F.vy = 0;
    F.grounded = false;
    F.jumps = 1;
    F.hover = RESPAWN_HOVER;
    F.invuln = RESPAWN_INVULN;
    F.guardHp = GUARD_MAX;
    F.lastHitBy = -1;
    F.airUsed.clear();
  }

  /** 接続が切れたプレイヤーを退場させる */
  removeSlot(slot) {
    const F = this.fighters[slot];
    if (!F || F.state === "out") return;
    F.state = "out"; F.stocks = 0; F.move = null;
    this.outOrder.push(slot);
    this.checkEnd();
  }

  checkEnd() {
    if (this.phase !== "fight" && this.phase !== "countdown") return;
    if (this.list.filter(F => F.state !== "out").length <= 1) {
      this.phase = "game";
      this.timer = GAME_END;
    }
  }

  /** 順位（1 位から順のスロット） */
  ranking() {
    const alive = this.list.filter(F => F.state !== "out").map(F => F.slot);
    return [...alive, ...[...this.outOrder].reverse()];
  }

  // ---- 技から呼ばれる道具 ----

  held(F, slot) { return !!(this.inputs[F.slot].held & (1 << slot)); }
  stickX(F) { const x = this.inputs[F.slot].x; return Math.abs(x) > 0.2 ? x : 0; }

  heal(F, n) {
    if (F.dmg <= 0) return;
    F.dmg = Math.max(0, F.dmg - n);
    this.emit("heal", F.x, F.y - BODY.h, F.slot, n);
  }

  nearestFoe(F) {
    let best = null, bd = Infinity;
    for (const T of this.list) {
      if (T === F || !T.alive || T.hover > 0) continue;
      const d = Math.hypot(T.x - F.x, T.y - F.y);
      if (d < bd) { bd = d; best = T; }
    }
    return best;
  }

  swap(F, T) {
    for (const k of ["x", "y", "vx", "vy", "grounded", "jumps"]) [F[k], T[k]] = [T[k], F[k]];
    F.invuln = Math.max(F.invuln, 10);
    if (T.move) this.endMove(T);
    if (T.state === "normal") { T.state = "dizzy"; T.dizzy = 24; }
    this.emit("swap", F.x, F.y - 45, F.slot, T.slot);
  }

  guardBreak(F) {
    this.endMove(F);
    F.state = "dizzy";
    F.dizzy = 150;
    F.guardHp = GUARD_MAX * 0.6;
    this.emit("break", F.x, F.y - BODY.h, F.slot, 0);
  }

  /** 技の攻撃判定を今のフレームで出す（box は向きに合わせて反転） */
  strike(F, h, group = "s") {
    const [ox, oy, w, hh] = h.box;
    const cx = F.x + F.face * ox, cy = F.y + oy;
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - hh / 2, y1: cy + hh / 2 };
    const m = F.move;
    if (!m) return;
    for (const T of this.list) {
      if (T === F || !T.alive || T.hover > 0) continue;
      if (!overlap(box, T.hurtbox())) continue;
      const key = `${group}:${T.slot}`;
      if (m.hitSet.has(key)) continue;
      m.hitSet.add(key);
      const dir = h.around ? (sign(T.x - F.x) || F.face) : F.face;
      this.applyHit(F, T, h, dir, false);
      if (F.state !== "move") return;   // カウンターされた
    }
  }

  applyHit(A, T, h, dirX, isProj) {
    if (T.invuln > 0) return false;
    const mx = (A && !isProj ? (A.x + T.x) / 2 : T.x), my = T.y - BODY.h / 2;
    if (T.counter && !h.grab) {
      T.invuln = 24;
      if (T.move) T.move.f = Math.max(T.move.f, 26);
      this.emit("counter", T.x, my, T.slot, 0);
      if (A && !isProj && A.alive) {
        this.applyHit(T, A, { dmg: Math.max(8, Math.round(h.dmg * 1.3)), base: 7, grow: 15, ang: 40 },
          sign(A.x - T.x) || T.face, false);
      }
      return true;
    }
    if (T.guarding && !h.grab) {
      T.guardHp -= h.dmg * 1.6;
      T.vx = dirX * (2 + h.dmg * 0.25);
      const hl = Math.min(8, 2 + Math.floor(h.dmg * 0.2));
      T.hitlag = hl;
      if (A && !isProj) A.hitlag = hl;
      this.emit("guard", mx, my, T.slot, h.dmg);
      if (T.guardHp <= 0) this.guardBreak(T);
      return true;
    }
    T.dmg = Math.min(999, T.dmg + h.dmg);
    if (h.drain && A) this.heal(A, h.dmg * h.drain);
    let kb = h.fixed ? h.base : h.base + h.grow * KB_GROWTH * T.dmg / 100;
    kb = Math.min(kb, 50);
    const ang = h.ang * Math.PI / 180;
    let vx = Math.cos(ang) * kb * dirX, vy = -Math.sin(ang) * kb;
    if (T.grounded && vy > 0) vy = -vy * 0.6;   // 地上でメテオを受けたら跳ね上がる
    if (T.move) this.endMove(T);
    T.vx = vx; T.vy = vy;
    if (vy < -0.5) T.grounded = false;
    T.state = "hitstun";
    T.hitstun = Math.floor(clamp(kb * 1.7, 8, 80));
    T.helpless = false; T.fastfall = false; T.hover = 0;
    T.jumps = Math.max(T.jumps, 1);
    const hl = Math.min(15, Math.floor(3 + h.dmg * 0.4));
    T.hitlag = hl;
    if (A && !isProj) A.hitlag = hl;
    if (A) T.lastHitBy = A.slot;
    this.emit("hit", mx, my, T.slot, kb, h.dmg);
    return true;
  }

  // ---- 飛び道具 ----

  spawn(F, kind, o) {
    if (this.projs.length >= 24) return;
    this.projs.push({ id: ++this.projId, kind, owner: F.slot, t: 0, dir0: sign(o.vx) || F.face, hitSet: new Set(), ...o });
  }

  updateProj(p) {
    p.t++;
    const O = this.fighters[p.owner];
    if (p.kind === "wave") {
      p.x += p.vx;
    } else if (p.kind === "boomerang") {
      const back = sign(p.vx) !== p.dir0;
      p.vx -= p.dir0 * 0.42;
      if (!back && sign(p.vx) !== p.dir0) p.hitSet.clear();   // 折り返したら、もう一度当たれる
      if (back && O && O.alive) {
        p.y += (O.y - 55 - p.y) * 0.08;
        if (Math.abs(O.x - p.x) < 40 && Math.abs(O.y - 55 - p.y) < 60) { p.dead = true; return; }
      }
      p.x += p.vx;
    }
    if (p.t >= p.life || p.x < BLAST.x0 - 200 || p.x > BLAST.x1 + 200) { p.dead = true; return; }

    let active = true;
    if (p.kind === "bolt") active = p.t >= p.from && p.t < p.from + 6;
    if (!active) return;
    const box = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 };
    if (p.kind === "bolt") { box.y0 = BLAST.top; box.y1 = STAGE.y + 10; }
    const lastFire = p.kind === "fire" && p.t === p.life - 1;
    for (const T of this.list) {
      if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
      if (!overlap(box, T.hurtbox())) continue;
      const key = p.kind === "fire" ? (lastFire ? `L${T.slot}` : `${T.slot}:${Math.floor(p.t / p.every)}`) : `${T.slot}`;
      if (p.hitSet.has(key)) continue;
      p.hitSet.add(key);
      const h = lastFire ? p.last : p;
      const dir = p.around ? (sign(T.x - p.x) || 1) : sign(p.vx) || p.dir0;
      const hit = this.applyHit(O, T, h, dir, true);
      if (hit && p.kind === "wave") { p.dead = true; return; }
    }
  }

  reflect(F, b) {
    const [ox, oy, w, h] = b;
    const cx = F.x + F.face * ox, cy = F.y + oy;
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
    for (const p of this.projs) {
      if (p.noReflect || p.owner === F.slot || p.dead) continue;
      if (!overlap(box, { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 })) continue;
      p.owner = F.slot;
      p.dir0 = F.face;
      p.vx = F.face * Math.max(Math.abs(p.vx), 11) * (p.kind === "boomerang" ? 1 : 1.3);
      p.dmg = Math.round(p.dmg * 1.3);
      p.t = 0;
      p.hitSet.clear();
      this.emit("reflect", p.x, p.y, F.slot, 0);
    }
  }

  /** p, q はイベントごとの数値（hit: p = ふっとばしの強さ・q = ダメージ） */
  emit(kind, x, y, slot, p, q = 0) {
    this.events.push({ id: ++this.eventId, frame: this.frame, k: EVENTS.indexOf(kind), x, y, s: slot, p, q });
  }

  // ---- 配信用 ----

  snapshot() {
    const r = v => Math.round(v);
    return {
      t: "st",
      f: this.frame,
      ph: PHASES.indexOf(this.phase),
      tm: this.timer,
      F: this.fighters.map(F => F && [
        r(F.x), r(F.y), F.face, STATES.indexOf(F.state),
        F.move ? MOVE_INDEX[F.move.id] : -1, F.move ? Math.min(F.move.f, 999) : 0,
        r(F.dmg), F.stocks,
        (F.invuln > 0 ? FLAG.invuln : 0) | (F.guarding ? FLAG.guard : 0) | (F.helpless ? FLAG.helpless : 0)
          | (F.sleeping ? FLAG.sleep : 0) | (F.counter ? FLAG.counter : 0) | (F.hover > 0 ? FLAG.hover : 0)
          | (F.grounded ? FLAG.ground : 0),
        r(F.guardHp), ...F.cd.map(c => Math.min(c, 999)), r(F.charge),
      ]),
      P: this.projs.slice(0, 24).map(p => [p.id, PROJ_KINDS.indexOf(p.kind), r(p.x), r(p.y), p.owner, p.dir0, p.t]),
      E: this.events.slice(-24).map(e => [e.id, e.k, r(e.x), r(e.y), e.s, r(e.p), r(e.q)]),
      I: this.infinite ? 1 : 0,
      R: this.phase === "game" || this.phase === "result" ? this.ranking() : [],
    };
  }
}

// ---- CPU ----
// 人と同じ条件に近づけるため、相手の技は「出し始めてから react フレーム経ってから」しか気づかない。
// （以前は出始めの 1 フレーム目から内部状態を読んでガード・カウンターしていて、人には無理な速さで返していた）

const RANGED = new Set(["kando", "wasureru", "oroka"]);
const DEFENSIVE = new Set(["zazen", "gomen", "hansei", "fukanou"]);

export const CPU_LEVEL_NAMES = ["動かない", "よわい", "ふつう", "つよい"];
export const CPU_DEFAULT_LEVEL = 2;
//   react: 相手の技に気づくまでのフレーム / def: 気づいたとき守りの技で返す確率 / think: 次の行動を考えるまでの間（範囲）
//   speed: 近づく速さ / miss: 場外で復帰技を使い忘れる確率 / ranged: 遠くから飛び道具を使う確率 / hop: 上の相手へ跳ぶ確率（毎フレーム）
const CPU_LEVELS = [
  null,
  { react: 32, def: 0.15, think: [40, 80], speed: 0.6, miss: 0.4, ranged: 0.25, hop: 0.015 },
  { react: 22, def: 0.3, think: [24, 50], speed: 0.85, miss: 0.15, ranged: 0.4, hop: 0.03 },
  { react: 14, def: 0.45, think: [14, 36], speed: 1, miss: 0, ranged: 0.5, hop: 0.04 },
];

/** CPU の入力を作る（pressed / held の形でシミュレーションに渡す） */
export function cpuInput(F, sim) {
  const L = CPU_LEVELS[F.level];
  if (!L || !F.alive || sim.phase !== "fight") return EMPTY_INPUT;   // 動かない CPU は何もしない（技の研究用）
  const ai = F.ai;
  let x = 0, y = 0, held = 0, pressed = 0;
  const slotOf = id => F.loadout.indexOf(id);
  const ready = i => i >= 0 && F.cd[i] === 0;
  const between = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo));

  if (F.hover > 0) return ai.cool-- > 0 ? EMPTY_INPUT : { x: 0, y: 1, held: 0, pressed: 0 };

  if (ai.holdT > 0) {
    ai.holdT--;
    held |= 1 << ai.holdSlot;
  }
  if (F.grounded) ai.trip = null;

  // 場外: 中央へ戻る
  const off = F.x < STAGE.x0 + 5 || F.x > STAGE.x1 - 5;
  if (off && !F.grounded) {
    ai.trip ??= { forget: Math.random() < L.miss };
    x = (F.x < 800 ? 1 : -1) * Math.max(L.speed, 0.8);
    if (F.state === "normal" && !F.helpless && F.y > STAGE.y - 60 && F.vy > -3) {
      const up = slotOf("cheat"), dash = slotOf("yatchi");
      if (F.jumps > 0) pressed |= 1 << JUMP_BIT;
      else if (!ai.trip.forget && ready(up) && !F.airUsed.has("cheat")) pressed |= 1 << up;
      else if (!ai.trip.forget && ready(dash) && F.y < STAGE.y + 80) pressed |= 1 << dash;
    }
    return { x, y, held, pressed };
  }

  const T = sim.nearestFoe(F);
  if (!T) return { x, y, held, pressed };
  const dx = T.x - F.x, dy = T.y - F.y, adx = Math.abs(dx);

  if (adx > 70) x = sign(dx) * L.speed;
  else if (adx > 5 && F.state === "normal") x = sign(dx) * 0.35;   // 向きだけ合わせる
  if (F.grounded && ((x < 0 && F.x < STAGE.x0 + 40) || (x > 0 && F.x > STAGE.x1 - 40))) x = 0;
  if (F.grounded && dy < -110 && Math.random() < L.hop) pressed |= 1 << JUMP_BIT;

  const avail = [0, 1, 2, 3].filter(i => ready(i));
  const id = i => F.loadout[i];

  // 相手の技に（react フレーム遅れて）気づいたら、守りの技で返すことがある。1 つの技に 1 回だけ
  if (F.state === "normal" && T.move && T.move !== ai.seenMove && T.move.f >= L.react && adx < 140) {
    ai.seenMove = T.move;
    const d = avail.find(i => DEFENSIVE.has(id(i)));
    if (d != null && Math.random() < L.def) {
      pressed |= 1 << d;
      if (id(d) === "zazen") { ai.holdSlot = d; ai.holdT = 20 + Math.floor(Math.random() * 20); }
      ai.cool = between(L.think);
      return { x, y, held, pressed };
    }
  }

  if (--ai.cool > 0 || F.state !== "normal") return { x, y, held, pressed };
  ai.cool = between(L.think);

  if (adx > 260) {
    const r = avail.find(i => RANGED.has(id(i)));
    if (r != null && Math.random() < L.ranged) pressed |= 1 << r;
    else if (F.dmg > 60 && avail.some(i => id(i) === "neru") && adx > 450) pressed |= 1 << slotOf("neru");
    return { x, y, held, pressed };
  }
  if (adx < 130 && Math.abs(dy) < 110) {
    const atk = avail.filter(i => !DEFENSIVE.has(id(i)) && id(i) !== "neru" && id(i) !== "cheat");
    if (atk.length) {
      const i = atk[Math.floor(Math.random() * atk.length)];
      pressed |= 1 << i;
      if (id(i) === "junbi") { ai.holdSlot = i; ai.holdT = 10 + Math.floor(Math.random() * 40); }
    }
  }
  return { x, y, held, pressed };
}

export { MOVES };
