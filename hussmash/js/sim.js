// 対戦のシミュレーション。ホスト（と練習モード）が動かし、結果をスナップショットにして配る。
// クライアントは自分のキャラ 1 体だけを同じ計算で先に動かす（予測。stepSolo / loadFighter）。
// 1 ステップ = 1/60 秒。座標は y が下向き。ファイターの (x, y) は足もとの中心。
//
// 技（moves.js）から使う道具はこのファイルの「技から呼ばれる道具」にまとめてある（G.xxx）。
// 状態（強化・弱体）は STATUS の名前ごとに残りフレームを持つ。

import { MOVES, MOVE_BY_ID, MOVE_INDEX } from "./moves.js";

export const STAGE = { x0: 400, x1: 1200, y: 600, bottom: 700 };
export const BLAST = { x0: -250, x1: 1850, top: -420, bottom: 1250 };
export const BODY = { hw: 25, h: 90 };
export const MAX_PLAYERS = 4;

const GRAV = 0.6, MAXFALL = 12, FASTFALL = 17, HITSTUN_MAXFALL = 22;
const JUMP = -14, AIR_JUMP = -12.5, RUN = 7, AIR_MAX = 5;
export const GUARD_MAX = 60;
const KB_GROWTH = 1.3;   // ふっとばしの伸び（全技共通の倍率）
const RESPAWN_WAIT = 90, RESPAWN_HOVER = 150, RESPAWN_INVULN = 150;
const COUNTDOWN = 180, GAME_END = 150;
const SPAWN_X = [520, 1080, 680, 920];
const BARRIER_MAX = 40;
const MAX_PROJS = 40;
const BURST_AFTER = 10;   // ふっとび始めてから、抜け出しの技を使えるまで（いきなり撃墜を打ち消せないように）
let RANDOM_POOL = null;

export const PHASES = ["lobby", "countdown", "fight", "game", "result"];
export const STATES = ["normal", "move", "hitstun", "dizzy", "dead", "out"];
export const EVENTS = ["hit", "ko", "guard", "counter", "break", "heal", "reflect", "swap", "jump", "start",
  "warp", "buff", "debuff", "parry", "boom", "pickup", "absorb"];
// 飛び道具の見た目（描き方）。技ごとの絵は、スナップショットで送る技の番号から出す
export const PROJ_KINDS = ["wave", "boomerang", "bolt", "fire", "sticker", "orb", "note", "ring", "boom", "beam", "cloud",
  "wall", "mine", "item", "bubble", "wind", "spark", "coin", "heart", "ice", "star", "letter", "minion", "aura", "sun", "ball"];
export const FLAG = { invuln: 1, guard: 2, helpless: 4, sleep: 8, counter: 16, hover: 32, ground: 64, armor: 128, low: 256, barrier: 512 };

// 状態。数値は残りフレーム（barrier だけは別に量で持つ）
export const STATUS = ["pow", "tough", "haste", "regen", "weak", "slow", "burn", "seal", "confuse", "frail",
  "light", "ghost", "quick", "dbl", "armor", "mini", "earn", "nullp", "ward", "nograb"];
export const STATUS_NAME = {
  pow: "攻撃↑", tough: "防御↑", haste: "速さ↑", regen: "回復", weak: "攻撃↓", slow: "鈍足", burn: "やけど", seal: "技封じ",
  confuse: "混乱", frail: "もろい", light: "身軽", ghost: "存在感ゼロ", quick: "再使用↑", dbl: "次の一撃×2", armor: "アーマー",
  mini: "ちびっこ", earn: "稼ぎ", nullp: "弾無効", ward: "1 回防ぐ", nograb: "つかまれない",
};
export const S = Object.fromEntries(STATUS.map((s, i) => [s, i]));
const NST = STATUS.length;
export const NEGATIVE = new Set(["weak", "slow", "burn", "seal", "confuse", "frail"]);

export const EMPTY_INPUT = Object.freeze({ x: 0, y: 0, held: 0, pressed: 0 });
const JUMP_BIT = 4;   // held / pressed のビット: 0..3 = A, B, X, Y、4 = ジャンプ

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inR = (f, r) => r && f >= r[0] && f <= r[1];
const r1 = v => Math.round(v * 10) / 10;

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
    this.lastHitMs = -1;   // 最後に受けた技が、相手のどのボタンの技か（撃墜を技ごとに数えるため）
    this.st = new Array(NST).fill(0);   // 状態の残りフレーム
    this.barrier = 0;                   // バリアの残り（受けるダメージをこの量まで肩代わり）
    this.cnt = [0, 0, 0, 0];            // ボタンの技ごとの数え（使うほど強くなる技など）
    this.lastMv = -1;                   // 最後に使った技の番号（ものまね用）
    this.bub = -1;                      // 頭の上に出すステッカー（フェイントでは別の技）
    this.stockDmg = 0;                  // このストックで与えたダメージ
    // 成績（結果画面用）: 与えたダメージ・撃墜・撃墜された・自滅・受けたダメージ、相手ごと [ダメージ, 撃墜]、ボタンの技ごと [当てた回数, ダメージ, 撃墜]
    this.stats = { dmg: 0, kos: 0, falls: 0, sds: 0, taken: 0, foe: [0, 1, 2, 3].map(() => [0, 0]), mv: [0, 1, 2, 3].map(() => [0, 0, 0]) };
    this.ai = { cool: 30, holdSlot: -1, holdT: 0 };
    this.clearFrameFlags();
  }
  clearFrameFlags() {
    this.noGravity = false; this.guarding = false; this.counter = false; this.sleeping = false;
    this.projInv = false; this.low = false; this.gcounter = false; this.guardMode = 0; this.armorNow = 0;
  }
  get alive() { return this.state !== "dead" && this.state !== "out"; }
  hurtbox() {
    let hw = BODY.hw, h = BODY.h;
    if (this.st[S.mini] > 0) { hw *= 0.75; h *= 0.62; }
    if (this.low) h = Math.min(h, 42);
    return { x0: this.x - hw, x1: this.x + hw, y0: this.y - h, y1: this.y };
  }
  has(name) { return this.st[S[name]] > 0; }
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
    this.predict = false;
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
    for (let i = 0; i < this.projs.length; i++) this.updateProj(this.projs[i]);
    this.projs = this.projs.filter(p => !p.dead);
    this.events = this.events.filter(e => this.frame - e.frame < 45);
  }

  /**
   * 予測用（クライアントが自分のキャラだけ手元で先に動かす）: slot の 1 体だけを 1 フレーム進める。
   * 相手への当たり・押し合い・飛び道具・撃墜はホストに任せるので、ここでは計算しない
   */
  stepSolo(slot, inp) {
    this.frame++;
    this.inputs[slot] = inp;
    this.updateFighter(this.fighters[slot], inp);
    this.projs.length = 0;
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
    // 状態の時間を進める（回復・やけどは残りフレームで刻むので、予測とホストで同じになる）
    for (let i = 0; i < NST; i++) if (F.st[i] > 0) F.st[i]--;
    if (F.st[S.regen] > 0 && F.st[S.regen] % 15 === 0) this.heal(F, 1, true);
    if (F.st[S.burn] > 0 && F.st[S.burn] % 30 === 0) { F.dmg = Math.min(999, F.dmg + 1); F.stats.taken += 1; }
    const tick = F.st[S.quick] > 0 ? 2 : 1;
    for (let i = 0; i < 4; i++) if (F.cd[i] > 0 && !(F.move && F.move.slot === i)) F.cd[i] = Math.max(0, F.cd[i] - tick);
    if (F.invuln > 0) F.invuln--;
    if (!(F.move && F.move.def.guardMove)) F.guardHp = Math.min(GUARD_MAX, F.guardHp + 0.1);
    if (F.st[S.confuse] > 0 && inp.x) {   // 混乱: 左右が逆になる
      inp = { ...inp, x: -inp.x };
      this.inputs[F.slot] = inp;
    }

    if (F.hover > 0) {
      F.hover--;
      F.vx = 0; F.vy = 0; F.noGravity = true;
      if (inp.pressed || Math.abs(inp.x) > 0.3 || Math.abs(inp.y) > 0.3) F.hover = 0;
      if (F.hover > 0) return;
    }

    switch (F.state) {
      case "hitstun":
        F.hsT = (F.hsT || 0) + 1;
        if (F.hsT >= BURST_AFTER && this.tryBurst(F, inp)) break;
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

  speedMul(F) {
    let k = 1;
    if (F.st[S.haste] > 0) k *= 1.35;
    if (F.st[S.slow] > 0) k *= 0.6;
    if (F.st[S.mini] > 0) k *= 1.15;
    return k;
  }

  control(F, inp) {
    const sx = Math.abs(inp.x) > 0.2 ? inp.x : 0;
    const spd = this.speedMul(F);
    if (F.grounded) {
      if (Math.abs(sx) > 0.3) F.face = sign(sx);
      if (sx) F.vx += clamp(sx * RUN * spd - F.vx, -1.5, 1.5);
      else F.vx *= 0.7;
    } else {
      this.airDrift(F, sx, 0.6);
    }
    if (inp.pressed & (1 << JUMP_BIT) && !F.helpless) {
      const jk = F.st[S.haste] > 0 ? 1.08 : F.st[S.slow] > 0 ? 0.88 : 1;
      if (F.grounded) {
        F.vy = JUMP * jk; F.grounded = false;
        this.emit("jump", F.x, F.y, F.slot, 0);
      } else if (F.jumps > 0) {
        F.jumps--; F.vy = AIR_JUMP * jk; F.vx = sx * AIR_MAX * Math.min(spd, 1.2); F.fastfall = false;
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
    const max = AIR_MAX * Math.min(1.3, Math.max(0.7, this.speedMul(F)));
    if (sx) F.vx += sx * accel;
    if (Math.abs(F.vx) > max) F.vx -= sign(F.vx) * Math.min(0.4, Math.abs(F.vx) - max);
    if (!sx) F.vx *= 0.97;
  }

  /** ふっとび中でも使える技（burst）を押したか */
  tryBurst(F, inp) {
    if (!inp.pressed) return false;
    for (let i = 0; i < 4; i++) {
      if (!(inp.pressed & (1 << i))) continue;
      const def = MOVE_BY_ID[F.loadout[i]];
      if (def?.burst && this.tryMove(F, i, 0, true)) return true;
    }
    return false;
  }

  tryMove(F, i, sx, burst = false) {
    const def = MOVE_BY_ID[F.loadout[i]];
    if (!def || F.cd[i] > 0) return false;
    if (F.st[S.seal] > 0) return false;
    if (def.oncePerAir && F.airUsed.has(def.id)) return false;
    if (Math.abs(sx) > 0.3) F.face = sign(sx);
    if (def.oncePerAir && !F.grounded) F.airUsed.add(def.id);
    if (burst) { F.hitstun = 0; F.helpless = false; }
    F.state = "move";
    F.move = { id: def.id, def, slot: i, f: 0, hitSet: new Set(), v: 0, w: 0, cdx: -1 };
    F.fastfall = false;
    F.lastMv = MOVE_INDEX[def.id];
    F.bub = F.lastMv;
    this.emit("start", F.x, F.y, F.slot, MOVE_INDEX[def.id]);
    def.start?.(F, this);
    return true;
  }

  /** 今の技を、別の技に化けさせる（ものまね・ランダム）。再使用までの時間は cdMin 以上 */
  become(F, def, cdMin = 0) {
    const m = F.move;
    if (!m || !def) return;
    m.def = def; m.id = def.id; m.f = 0; m.hitSet = new Set(); m.v = 0; m.w = 0;
    m.fire = undefined; m.air = undefined; m.dir = undefined;
    m.cdx = Math.max(def.cd, cdMin);
    def.start?.(F, this);
  }

  runMove(F, inp) {
    const m = F.move;
    const def = m.def;
    m.f++;
    const f = m.f;
    const sx = Math.abs(inp.x) > 0.2 ? inp.x : 0;
    if (!def.noDrift) {
      if (F.grounded) F.vx *= 0.8;
      else this.airDrift(F, sx, 0.3);
    }
    // 書いておくだけで効く性能（無敵・アーマー・動き・飛び道具）
    if (inR(f, def.inv)) F.invuln = Math.max(F.invuln, 1);
    if (inR(f, def.armor)) F.armorNow = def.armor[2];
    if (inR(f, def.pinv)) F.projInv = true;
    if (inR(f, def.low)) F.low = true;
    if (inR(f, def.counter)) F.counter = true;
    if (inR(f, def.gcounter)) F.gcounter = true;
    if (def.vel) {
      for (const [f0, f1, vx, vy, ng] of def.vel) {
        if (f < f0 || f > f1) continue;
        if (vx != null) F.vx = F.face * vx;
        if (vy != null) F.vy = vy;
        if (ng) F.noGravity = true;
      }
    }
    if (def.shots) for (const s of def.shots) if (s.f === f) this.shot(F, s);
    const r = def.tick?.(F, this, f);
    if (F.move !== m) return;   // tick の中で終わった（ガードが割れたなど）
    if (m.def !== def) return;  // 別の技に化けた
    if (def.hits) {
      def.hits.forEach((h, gi) => { if (f >= h.f[0] && f <= h.f[1]) this.strike(F, h, gi); });
    }
    if (F.move === m && (r === false || f >= def.total)) this.endMove(F);
  }

  endMove(F) {
    if (!F.move) return;
    const m = F.move;
    F.cd[m.slot] = m.cdx >= 0 ? m.cdx : (m.def.cdOf ? m.def.cdOf(F, m) : m.def.cd);
    F.move = null;
    F.charge = 0;
    if (F.state === "move") F.state = "normal";
  }

  physics(F) {
    if (!F.noGravity) {
      const light = F.st[S.light] > 0;
      F.vy += GRAV * (light ? 0.55 : 1);
      const cap = F.state === "hitstun" ? HITSTUN_MAXFALL : F.fastfall ? FASTFALL : MAXFALL * (light ? 0.6 : 1);
      if (F.fastfall && F.vy > 0) F.vy = FASTFALL;
      F.vy = Math.min(F.vy, Math.max(cap, F.move?.def.fallCap ?? 0));
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
      } else {
        this.land(F);
        if (F.move?.def.onLand?.(F, this) === false) this.endMove(F);
      }
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
        if (F.move?.def.endOnLedge) this.endMove(F);
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
    if (this.predict) return;   // 予測の中では撃墜しない（撃墜を決めるのはホストだけ）
    const cx = clamp(F.x, BLAST.x0, BLAST.x1), cy = clamp(F.y, BLAST.top, BLAST.bottom);
    const A = F.lastHitBy >= 0 && F.lastHitBy !== F.slot ? this.fighters[F.lastHitBy] : null;
    F.stats.falls++;
    if (A) {
      A.stats.kos++;
      A.stats.foe[F.slot][1]++;
      if (F.lastHitMs >= 0) A.stats.mv[F.lastHitMs][2]++;
    } else F.stats.sds++;   // 誰にも触られずに落ちた
    this.emit("ko", cx, cy, F.slot, F.lastHitBy);
    F.move = null; F.charge = 0;
    if (!this.infinite) F.stocks--;
    F.dmg = 0;
    F.vx = F.vy = 0;
    F.helpless = false;
    F.st.fill(0);
    F.barrier = 0;
    F.stockDmg = 0;
    // 自分が出した「ついてくる」飛び道具は消す
    for (const p of this.projs) if (p.owner === F.slot && p.follow) p.dead = true;
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
    F.lastHitMs = -1;
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
  stickY(F) { const y = this.inputs[F.slot].y; return Math.abs(y) > 0.2 ? y : 0; }
  rand(n) { return Math.floor(Math.random() * n); }
  onStage(x) { return x >= STAGE.x0 && x <= STAGE.x1; }
  /** 一番近い台のふちまでの距離（台の上なら正、外なら負） */
  edgeDist(x) { return Math.min(x - STAGE.x0, STAGE.x1 - x); }

  heal(F, n, quiet = false) {
    if (F.dmg <= 0 || n <= 0) return;
    F.dmg = Math.max(0, r1(F.dmg - n));
    if (!quiet || Math.random() < 0.5) this.emit("heal", F.x, F.y - BODY.h, F.slot, n);
  }

  /** 自分で受けるダメージ（ふっとばない） */
  hurt(F, n) {
    F.dmg = Math.min(999, r1(F.dmg + n));
    F.stats.taken += n;
    this.emit("hit", F.x, F.y - 45, F.slot, 1, n);
  }

  /** 状態を付ける。{ pow: 300, barrier: 15 } のように（長い方を残す。barrier は足し算） */
  give(F, o, quiet = false) {
    if (!F || !F.alive) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "barrier") { F.barrier = Math.min(BARRIER_MAX, F.barrier + v); continue; }
      const i = S[k];
      if (i == null) continue;
      F.st[i] = Math.max(F.st[i], Math.round(v));
      if (!quiet) this.emit(NEGATIVE.has(k) ? "debuff" : "buff", F.x, F.y - BODY.h - 10, F.slot, i);
    }
  }

  /** 悪い状態を消す。消した数を返す */
  cleanse(F, only = null) {
    let n = 0;
    for (const k of NEGATIVE) {
      if (only && !only.includes(k)) continue;
      if (F.st[S[k]] > 0) { F.st[S[k]] = 0; n++; }
    }
    if (n) this.emit("buff", F.x, F.y - BODY.h - 10, F.slot, -1);
    return n;
  }

  /** よい状態とバリアを消す。消したもの { 名前: 残り } を返す */
  dispel(F) {
    const out = {};
    STATUS.forEach((k, i) => {
      if (!NEGATIVE.has(k) && F.st[i] > 0) { out[k] = F.st[i]; F.st[i] = 0; }
    });
    if (F.barrier > 0) { out.barrier = F.barrier; F.barrier = 0; }
    if (Object.keys(out).length) this.emit("debuff", F.x, F.y - BODY.h - 10, F.slot, -1);
    return out;
  }

  positives(F) { return STATUS.some((k, i) => !NEGATIVE.has(k) && F.st[i] > 0) || F.barrier > 0; }

  /** 生きていて狙える相手（復活待ちと、存在感ゼロの人は除く） */
  targetable(F, T) { return T !== F && T.alive && T.hover <= 0 && !(T.st[S.ghost] > 0); }

  nearestFoe(F, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const T of this.list) {
      if (!this.targetable(F, T)) continue;
      const d = Math.hypot(T.x - F.x, T.y - F.y);
      if (d < bd) { bd = d; best = T; }
    }
    return best;
  }

  /** F から半径 r 以内の相手（存在感ゼロでも当たる範囲攻撃用。hover 中は除く） */
  foes(F, r, cx = F.x, cy = F.y - 45) {
    return this.list.filter(T => T !== F && T.alive && T.hover <= 0 && Math.hypot(T.x - cx, T.y - 45 - cy) <= r);
  }

  /** 他のボタンの再使用時間をいじる（fn(残り) → 新しい残り） */
  cds(F, fn) {
    for (let i = 0; i < 4; i++) {
      if (F.move && F.move.slot === i) continue;
      F.cd[i] = Math.max(0, Math.round(fn(F.cd[i], i)));
    }
  }

  warp(F, x, y) {
    this.emit("warp", F.x, F.y - 45, F.slot, 0);
    F.x = x; F.y = y; F.vx = 0; F.vy = 0;
    F.grounded = y >= STAGE.y - 0.5 && this.onStage(x);
    if (F.grounded) F.y = STAGE.y;
    this.emit("warp", F.x, F.y - 45, F.slot, 1);
  }

  /** 目を回させる（技も止まる） */
  stun(T, frames) {
    if (!T.alive) return;
    if (T.move) this.endMove(T);
    T.state = "dizzy";
    T.dizzy = Math.max(T.dizzy, frames);
    T.hitstun = 0;
  }

  /** 相手の技を止める */
  interrupt(T) {
    if (T.move) { this.endMove(T); return true; }
    return false;
  }

  /** 引っぱる・押す（ダメージなし。少しの間ふっとび状態にする） */
  yank(T, vx, vy, stun) {
    if (!T.alive) return;
    if (T.move) this.endMove(T);
    T.state = "hitstun"; T.hitstun = stun; T.hsT = 0;
    T.vx = vx; T.vy = vy;
    if (vy < 0) T.grounded = false;
  }

  /** T のよい状態とバリアを、T から消さずに F にも付ける */
  copyBuffs(F, T) {
    STATUS.forEach((k, i) => { if (!NEGATIVE.has(k) && T.st[i] > 0) F.st[i] = Math.max(F.st[i], T.st[i]); });
    if (T.barrier > 0) F.barrier = Math.min(BARRIER_MAX, F.barrier + T.barrier);
    this.emit("buff", F.x, F.y - BODY.h - 10, F.slot, -1);
  }

  /** 技の定義（番号から）・ランダムな技（ものまね・ランダム用。moves.js から MOVES を直接読むと循環するので、ここを通す） */
  moveAt(i) { return i >= 0 ? MOVES[i] ?? null : null; }
  moveIndex(id) { return MOVE_INDEX[id]; }
  randomMove() {
    RANDOM_POOL ??= MOVES.filter(m => !m.banned && !m.noCopy);
    return RANDOM_POOL[this.rand(RANDOM_POOL.length)];
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
      const hh2 = h.mod ? h.mod(F, T, this, h) : h;
      if (!hh2) continue;   // この相手には当たらない（条件つきの技）
      m.hitSet.add(key);
      const dir = hh2.around ? (sign(T.x - F.x) || F.face) : hh2.dirBack ? -F.face : F.face;
      this.applyHit(F, T, hh2, dir, false, m.slot);
      if (F.move !== m || F.state !== "move") return;   // カウンターされた
    }
    // 相手の壁（豆腐・にんじん）は殴ると崩れる
    for (const p of this.projs) {
      if (!p.wall || p.dead || p.hp == null || p.owner === F.slot) continue;
      if (!overlap(box, { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 })) continue;
      const key = `${group}:w${p.id}`;
      if (m.hitSet.has(key)) continue;
      m.hitSet.add(key);
      p.hp -= Math.max(3, h.dmg);
      this.emit("guard", p.x, p.y, F.slot, h.dmg);
      if (p.hp <= 0) { p.dead = true; this.emit("boom", p.x, p.y, F.slot, 6); }
    }
  }

  /** 当たり判定なしで、相手 T に直接当てる（つかんだ相手を投げる・ねらい撃ち） */
  hitDirect(F, T, h, dir = F.face) {
    return this.applyHit(F, T, h, dir, false, F.move ? F.move.slot : -1);
  }

  /**
   * 攻撃を当てる。ms: 当てた技が A のどのボタンの技か（成績用。わからなければ -1）
   * 返り値: false = 当たらなかった / "absorb" = 飛び道具が消された / それ以外は当たった（ガード・カウンターされたも含む）
   */
  applyHit(A, T, h, dirX, isProj, ms = -1) {
    if (!T.alive || T.hover > 0) return false;
    if (T.invuln > 0 && !(h.pierce && T.state === "move")) return false;
    if (isProj && (T.projInv || T.st[S.nullp] > 0)) { this.emit("absorb", T.x, T.y - 50, T.slot, 0); return "absorb"; }
    const mx = (A && !isProj ? (A.x + T.x) / 2 : T.x), my = T.y - BODY.h / 2;

    // つかみ: つかまれない状態ならすり抜け、つかみ返しの構えなら返される
    if (h.grab) {
      if (T.st[S.nograb] > 0) { this.emit("guard", mx, my, T.slot, 0); return false; }
      if (T.gcounter && T.move?.def.gctr && A) { T.move.def.gctr(T, A, h, this); return true; }
    }
    // カウンター（つかみと、見破りの技には効かない）
    if (T.counter && !h.grab && !h.pierce && T.move) {
      const c = T.move.def.ctr;
      if (c) { if (c(T, A, h, this, isProj, dirX) !== false) return true; }
      else {
        T.invuln = 24;
        T.move.f = Math.max(T.move.f, 26);
        this.emit("counter", T.x, my, T.slot, 0);
        if (A && !isProj && A.alive) {
          this.applyHit(T, A, { dmg: Math.max(8, Math.round(h.dmg * 1.3)), base: 7, grow: 15, ang: 40 },
            sign(A.x - T.x) || T.face, false, T.move ? T.move.slot : -1);
        }
        return true;
      }
    }
    // ガード（前だけを守るガードは、後ろからの攻撃を通す）
    if (T.guarding && !h.grab && !h.unblock) {
      const fromFront = isProj ? -dirX === T.face : !A || A.x === T.x || sign(A.x - T.x) === T.face;
      if (T.guardMode !== 1 || fromFront) {
        T.guardHp -= h.dmg * 1.6 * (h.brk || 1);
        T.vx = dirX * (2 + h.dmg * 0.25);
        const hl = Math.min(8, 2 + Math.floor(h.dmg * 0.2));
        T.hitlag = hl;
        if (A && !isProj) A.hitlag = hl;
        this.emit("guard", mx, my, T.slot, h.dmg);
        if (T.guardMode === 2 && A && !isProj && A.alive && A.state !== "hitstun") {   // はじくガード
          if (A.move) this.endMove(A);
          A.state = "hitstun"; A.hitstun = 22; A.vx = -dirX * 9; A.vy = -3; A.grounded = false;
        }
        if (T.guardHp <= 0) this.guardBreak(T);
        return true;
      }
    }
    // 1 回だけ防ぐ
    if (T.st[S.ward] > 0 && !h.grab) {
      T.st[S.ward] = 0;
      this.emit("guard", mx, my, T.slot, h.dmg);
      if (A && !isProj) A.hitlag = 6;
      return true;
    }

    // ダメージの倍率
    let dmg = h.dmg, kbm = 1;
    if (A && A !== T) {
      if (A.st[S.pow] > 0) { dmg *= 1.25; kbm *= 1.1; }
      if (A.st[S.weak] > 0) { dmg *= 0.7; kbm *= 0.85; }
      if (A.st[S.mini] > 0) { dmg *= 0.8; kbm *= 0.9; }
      if (A.st[S.dbl] > 0 && h.dmg > 0) { dmg *= 2; kbm *= 1.25; A.st[S.dbl] = 0; }
    }
    if (T.st[S.tough] > 0) { dmg *= 0.75; kbm *= 0.85; }
    if (T.st[S.frail] > 0) { dmg *= 1.3; kbm *= 1.15; }
    if (T.move?.def.takeMul) dmg *= T.move.def.takeMul;
    dmg = r1(dmg);
    // バリアが先に受ける
    if (T.barrier > 0 && dmg > 0) {
      const ab = Math.min(T.barrier, dmg);
      T.barrier = r1(T.barrier - ab);
      dmg = r1(dmg - ab);
      this.emit("guard", mx, my, T.slot, ab);
      if (dmg <= 0) {
        T.vx = dirX * 3;
        T.hitlag = 4;
        if (A && !isProj) A.hitlag = 4;
        return true;
      }
    }

    const before = T.dmg;
    T.dmg = Math.min(999, r1(T.dmg + dmg));
    const dealt = T.dmg - before;
    T.stats.taken += dealt;
    if (A && A !== T) {
      A.stats.dmg += dealt;
      A.stockDmg += dealt;
      A.stats.foe[T.slot][0] += dealt;
      if (ms >= 0) { A.stats.mv[ms][0]++; A.stats.mv[ms][1] += dealt; }
      if (A.st[S.earn] > 0 && dealt > 0) this.cds(A, c => c - 60);
    }
    if (h.drain && A) this.heal(A, dealt * h.drain);
    if (h.heal && A) this.heal(A, h.heal);
    if (h.st) this.give(T, h.st);
    if (h.self && A) this.give(A, h.self);
    if (h.cdcut && A) this.cds(A, c => c - h.cdcut);
    if (A) { T.lastHitBy = A.slot; T.lastHitMs = ms; }

    // アーマー: 小さい攻撃ではふっとばない（ダメージは受ける）
    const thr = Math.max(T.armorNow, T.st[S.armor] > 0 ? 12 : 0);
    if (thr > 0 && dmg <= thr && !h.grab && !h.stun) {
      const hl = Math.min(10, Math.floor(2 + dmg * 0.3));
      T.hitlag = hl;
      if (A && !isProj) A.hitlag = hl;
      if (T.move) T.move.v += dealt;   // 受けたダメージをためる技（耐えて反撃）
      this.emit("hit", mx, my, T.slot, 1, dealt);
      h.onHit?.(A, T, this, dirX, isProj);
      return true;
    }

    let kb = h.fixed ? h.base : h.base + h.grow * KB_GROWTH * T.dmg / 100;
    kb = Math.min(kb * (h.fixed ? 1 : kbm), 50);
    const ang = h.ang * Math.PI / 180;
    let vx = Math.cos(ang) * kb * dirX, vy = -Math.sin(ang) * kb;
    if (T.grounded && vy > 0) vy = -vy * 0.6;   // 地上でメテオを受けたら跳ね上がる
    if (T.move) this.endMove(T);
    T.vx = vx; T.vy = vy;
    if (vy < -0.5) T.grounded = false;
    T.state = "hitstun";
    T.hsT = 0;
    T.hitstun = Math.floor(clamp(kb * 1.7, 8, 80));
    T.helpless = false; T.fastfall = false; T.hover = 0;
    T.jumps = Math.max(T.jumps, 1);
    const hl = Math.min(15, Math.floor(3 + dmg * 0.4));
    T.hitlag = hl;
    if (A && !isProj) A.hitlag = hl;
    if (h.stun) {   // 目を回す（ふっとびは小さく）
      T.state = "dizzy"; T.dizzy = h.stun; T.hitstun = 0;
      T.vx *= 0.3; T.vy = Math.min(T.vy, 0) * 0.3;
    }
    this.emit("hit", mx, my, T.slot, kb, dealt);
    h.onHit?.(A, T, this, dirX, isProj);
    return true;
  }

  // ---- 飛び道具 ----
  // 技の shots（または tick の中の G.shot）に書いた形で出す。座標は自分の足もとからのずれ（x は向きに合わせる）。
  //   vis: 見た目 / x, y: 出る位置 / vx, vy: 速さ（vx は前向きが正）/ aim: 一番近い相手に向けて撃つ速さ / at: "foe" なら相手の位置に出す
  //   life: 消えるまで / w, h: 大きさ / from: 当たり始め / until: 当たり終わり / g: 重力 / bounce: 床ではねる / stick: 床で止まる
  //   walk: 床を歩く / homing: 曲がる強さ / sine: 上下にゆれる / boom: ブーメラン / follow: "owner"（自分についてくる）/ "foe"（相手について行く）
  //   pierce: 当たっても消えない / every: 何フレームごとにもう一度当たるか / col: 縦の柱（落雷）/ last: 最後の一撃
  //   trig: 触れたら爆発（arm フレーム後から）/ ex: 消えるとき（land: 着地で）爆発 / eat: 相手の飛び道具を消す / wall: 相手の飛び道具と体を止める
  //   item: 拾った人を回復 / noReflect: はね返せない / hit(p, T, G) / tick(p, G): その技だけの動き
  //   当たったときの効果は strike と同じ（dmg, base, grow, ang, fixed, around, st, stun ...）

  shot(F, s, over = {}) {
    const o = { ...s, ...over };
    const face = o.face ?? F.face;
    let x = F.x + face * (o.x ?? 40), y = F.y + (o.y ?? -50);
    if (o.at === "foe") {
      const T = this.nearestFoe(F);
      x = T ? T.x : F.x + face * 200;
      y = T ? T.y + (o.y ?? -50) : F.y + (o.y ?? -50);
      if (T) o.tgt = T.slot;
    }
    let vx = (o.vx ?? 0) * face, vy = o.vy ?? 0;
    if (o.aim) {
      const T = this.nearestFoe(F);
      if (T) {
        const dx = T.x - x, dy = T.y - 50 - y, d = Math.hypot(dx, dy) || 1;
        vx = dx / d * o.aim; vy = dy / d * o.aim;
      } else { vx = face * o.aim; vy = 0; }
    }
    if (o.follow === "foe" && o.tgt == null) {
      const T = this.nearestFoe(F, o.range ?? Infinity);
      if (!T) return null;
      o.tgt = T.slot;
    }
    return this.spawn(F, o.vis || "sticker", { ...o, x, y, vx, vy, fx: o.x ?? 40, fy: o.y ?? -50, face });
  }

  spawn(F, kind, o) {
    if (this.projs.length >= MAX_PROJS) return null;
    const p = {
      w: 40, h: 40, life: 60, dmg: 0, base: 0, grow: 0, ang: 0, ...o,
      id: ++this.projId, kind, owner: F.slot, ms: F.move ? F.move.slot : -1,
      mi: F.move ? MOVE_INDEX[F.move.id] : -1, t: 0, dir0: sign(o.vx) || o.face || F.face, hitSet: new Set(),
    };
    this.projs.push(p);
    return p;
  }

  explode(p, ex = p.ex) {
    const O = this.fighters[p.owner];
    if (!O) return;
    const b = this.spawn(O, "boom", {
      x: p.x, y: p.y, vx: 0, vy: 0, w: ex.w ?? ex.r ?? 120, h: ex.h ?? ex.r ?? 120, life: 10, around: true, pierce: true, noReflect: true,
      dmg: ex.dmg, base: ex.base, grow: ex.grow, ang: ex.ang ?? 60, st: ex.st, stun: ex.stun, fixed: ex.fixed,
    });
    if (b) { b.ms = p.ms; b.mi = p.mi; }
    this.emit("boom", p.x, p.y, p.owner, Math.round((ex.r ?? ex.w ?? 120) / 10));
  }

  updateProj(p) {
    if (p.dead) return;
    p.t++;
    const O = this.fighters[p.owner];
    // 動き
    if (p.follow === "owner") {
      if (!O || !O.alive) { p.dead = true; return; }
      p.x = O.x + O.face * p.fx; p.y = O.y + p.fy;
    } else if (p.follow === "foe") {
      const T = this.fighters[p.tgt];
      if (!T || !T.alive) { p.dead = true; return; }
      p.x = T.x; p.y = T.y + (p.fy ?? -50);
    } else {
      if (p.boom) {
        const back = sign(p.vx) !== p.dir0;
        p.vx -= p.dir0 * p.boom;
        if (!back && sign(p.vx) !== p.dir0) { p.hitSet.clear(); p.back = true; }   // 折り返したら、もう一度当たれる
        if (back && O && O.alive) {
          p.y += (O.y - 55 - p.y) * 0.08;
          if (Math.abs(O.x - p.x) < 40 && Math.abs(O.y - 55 - p.y) < 60) {
            if (p.retHeal) this.heal(O, p.retHeal);
            p.dead = true; return;
          }
        }
      }
      if (p.homing && p.t > (p.homeAfter ?? 0)) {
        const T = O ? this.nearestFoe(O) : null;
        if (T) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const want = Math.atan2(T.y - 50 - p.y, T.x - p.x), cur = Math.atan2(p.vy, p.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const a = cur + clamp(d, -p.homing, p.homing);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        }
      }
      if (p.g) p.vy = Math.min(p.vy + p.g, 16);
      const prevY = p.y;
      p.x += p.vx;
      p.y += p.vy + (p.sine ? Math.cos(p.t * (p.sf ?? 0.15)) * p.sine : 0);
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      // 床
      const floor = STAGE.y - p.h / 2;
      if (this.onStage(p.x) && prevY <= floor + 1 && p.y >= floor && (p.g || p.walk || p.vy > 0)) {
        if (p.bounce && Math.abs(p.vy) > 1.5) { p.y = floor; p.vy = -Math.abs(p.vy) * p.bounce; }
        else if (p.ex && p.land) { this.explode(p); p.dead = true; return; }
        else if (p.stick) { p.y = floor; p.vx = 0; p.vy = 0; p.g = 0; p.landed = true; }
        else if (p.walk || p.bounce) { p.y = floor; p.vy = 0; }
        else if (p.g) { p.dead = true; return; }
      }
      if (p.walk && !this.onStage(p.x)) p.g = p.g || 0.6;   // 台から落ちる
    }
    p.tick?.(p, this);
    if (p.dead) return;
    if (p.t >= p.life || p.x < BLAST.x0 - 200 || p.x > BLAST.x1 + 200 || p.y > BLAST.bottom + 200 || p.y < BLAST.top - 300) {
      if (p.ex && !p.land && p.t >= p.life) this.explode(p);
      p.dead = true; return;
    }
    if (p.t < (p.from ?? 0) || (p.until != null && p.t >= p.until)) return;

    const box = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 };
    if (p.col) { box.y0 = BLAST.top; box.y1 = STAGE.y + 10; }

    // 相手の飛び道具を消す・止める
    if (p.eat || p.wall) {
      for (const q of this.projs) {
        if (q === p || q.dead || q.owner === p.owner || q.wall || q.item || q.follow) continue;
        if (!overlap(box, { x0: q.x - q.w / 2, x1: q.x + q.w / 2, y0: q.y - q.h / 2, y1: q.y + q.h / 2 })) continue;
        q.dead = true;
        this.emit("absorb", q.x, q.y, p.owner, 1);
        if (p.wall && p.hp != null) { p.hp -= Math.max(3, q.dmg || 0); if (p.hp <= 0) { p.dead = true; return; } }
      }
    }
    // 拾える物
    if (p.item) {
      if (p.t < 20) return;
      for (const T of this.list) {
        if (!T.alive || T.hover > 0 || !overlap(box, T.hurtbox())) continue;
        this.heal(T, p.item);
        this.emit("pickup", p.x, p.y, T.slot, p.item);
        p.dead = true; return;
      }
      return;
    }
    if (p.aura) { p.aura(p, this); return; }
    for (const T of this.list) {
      if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
      const hb = T.hurtbox();
      if (!overlap(box, hb)) continue;
      if (p.wall) {   // 壁: 押し出す
        if (p.wallHit && !p.hitSet.has(`w${T.slot}:${Math.floor(p.t / 30)}`)) {
          p.hitSet.add(`w${T.slot}:${Math.floor(p.t / 30)}`);
          this.applyHit(O, T, p.wallHit, sign(T.x - p.x) || 1, true, p.ms);
        }
        if (T.state !== "hitstun") { T.x = T.x < p.x ? box.x0 - BODY.hw : box.x1 + BODY.hw; T.vx = 0; }
        continue;
      }
      if (p.trig) {
        if (p.t < (p.arm ?? 0)) continue;
        if (p.trig === true) this.explode(p); else p.trig(p, T, this);
        p.dead = true; return;
      }
      let key = `${T.slot}`;
      if (p.every) key = p.last && p.t === p.life - 1 ? `L${T.slot}` : `${T.slot}:${Math.floor(p.t / p.every)}`;
      if (p.hitSet.has(key)) continue;
      const h0 = p.last && p.t === p.life - 1 ? p.last : p;
      const h = p.mod ? p.mod(p, T, this, h0) : h0;
      if (!h) continue;
      p.hitSet.add(key);
      const dir = p.around ? (sign(T.x - p.x) || 1) : sign(p.vx) || p.dir0;
      const res = this.applyHit(O, T, h, dir, true, p.ms);
      if (res === "absorb") { p.dead = true; return; }
      if (res) {
        p.hit?.(p, T, this);
        if (p.ex && !p.pierce) this.explode(p);
        if (!p.pierce) { p.dead = true; return; }
      }
    }
  }

  reflect(F, b) {
    const [ox, oy, w, h] = b;
    const cx = F.x + F.face * ox, cy = F.y + oy;
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
    for (const p of this.projs) {
      if (p.noReflect || p.owner === F.slot || p.dead || p.follow || p.item || p.wall) continue;
      if (!overlap(box, { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 })) continue;
      p.owner = F.slot;
      p.ms = F.move ? F.move.slot : -1;   // はね返した飛び道具は、はね返した技の成績にする
      p.dir0 = F.face;
      p.vx = F.face * Math.max(Math.abs(p.vx), 11) * (p.boom ? 1 : 1.3);
      p.vy = 0; p.g = 0; p.homing = 0;
      p.dmg = Math.round(p.dmg * 1.3);
      p.t = 0;
      p.hitSet.clear();
      this.emit("reflect", p.x, p.y, F.slot, 0);
    }
  }

  /** 相手の飛び道具を消す（中心 cx, cy から半径 r）。消した数を返す */
  clearProjs(F, r, cx = F.x, cy = F.y - 50) {
    let n = 0;
    for (const p of this.projs) {
      if (p.dead || p.owner === F.slot || p.item || p.follow) continue;
      if (Math.hypot(p.x - cx, p.y - cy) > r) continue;
      p.dead = true; n++;
      this.emit("absorb", p.x, p.y, F.slot, 1);
    }
    return n;
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
        r(F.dmg), F.stocks, viewFlags(F),
        r(F.guardHp), ...F.cd.map(c => Math.min(c, 999)), r(F.charge),
        statusBits(F), F.bub, r(F.barrier),
      ]),
      P: this.projs.slice(0, 24).map(p => [p.id, PROJ_KINDS.indexOf(p.kind), r(p.x), r(p.y), p.owner, p.dir0, Math.min(p.t, 999),
        p.mi, clamp(r(p.w), 0, 999), clamp(r(p.h), 0, 999)]),
      E: this.events.slice(-24).map(e => [e.id, e.k, r(e.x), r(e.y), e.s, r(e.p), r(e.q)]),
      I: this.infinite ? 1 : 0,
      R: this.phase === "game" || this.phase === "result" ? this.ranking() : [],
      // 成績は対戦が終わってから送る（並びは STATS_RANGES）
      ...(this.phase === "game" || this.phase === "result" ? { S: this.fighters.map(F => F && [
        r(F.stats.dmg), F.stats.kos, F.stats.falls, F.stats.sds, r(F.stats.taken),
        ...F.stats.foe.flatMap(([d, k]) => [r(d), k]), ...F.stats.mv.flatMap(([n, d, k]) => [n, r(d), k]),
        ...F.loadout.map(id => MOVE_INDEX[id]),
      ]) } : {}),
    };
  }
}

/** 描画用のフラグ（スナップショットと予測で同じものを使う） */
export function viewFlags(F) {
  return (F.invuln > 0 ? FLAG.invuln : 0) | (F.guarding ? FLAG.guard : 0) | (F.helpless ? FLAG.helpless : 0)
    | (F.sleeping ? FLAG.sleep : 0) | (F.counter || F.gcounter ? FLAG.counter : 0) | (F.hover > 0 ? FLAG.hover : 0)
    | (F.grounded ? FLAG.ground : 0) | (F.armorNow > 0 ? FLAG.armor : 0) | (F.low ? FLAG.low : 0)
    | (F.barrier > 0 ? FLAG.barrier : 0);
}

/** 付いている状態のビット（STATUS の並び） */
export function statusBits(F) {
  let b = 0;
  for (let i = 0; i < NST; i++) if (F.st[i] > 0) b |= 1 << i;
  return b;
}

// 結果画面の成績: 与えたダメージ, 撃墜, 撃墜された, 自滅, 受けたダメージ, 相手ごと [ダメージ, 撃墜] × 4, ボタンの技ごと [当てた回数, ダメージ, 撃墜] × 4, 技 × 4
export const STATS_RANGES = [
  [0, 99999], [0, 999], [0, 999], [0, 999], [0, 99999],
  ...Array(4).fill([[0, 99999], [0, 999]]).flat(),
  ...Array(4).fill([[0, 9999], [0, 99999], [0, 999]]).flat(),
  ...Array(4).fill([0, MOVES.length - 1]),
];

// ---- 予測用: ファイターのまるごとの状態 ----
// ホストは各クライアントに、その人のファイターの状態をそのまま（小数も丸めずに）送る。
// クライアントはこれを読み込んで、ホストがまだ使っていない自分の入力をやり直し、今の位置を出す。
// 並び: x, y, vx, vy, face, grounded, jumps, state, move, moveSlot, moveF, fire, air, dir, cd × 4,
//       hitstun, hitlag, invuln, dizzy, respawnT, hover, guardHp, helpless, fastfall, airUsed（ボタンごとのビット）,
//       charge, dmg, stocks, lastHitBy, frameFlags, loadout × 4（技の番号）,
//       move.v, move.w, move.cdx, 状態 × STATUS.length, barrier, cnt × 4, lastMv, bub, stockDmg, armorNow
// 範囲の 3 つ目が true の欄は小数のまま（それ以外は整数）
const N = MOVES.length - 1;
export const FSTATE_RANGES = [
  [-5000, 5000, true], [-5000, 5000, true], [-200, 200, true], [-200, 200, true], [-1, 1], [0, 1], [0, 9],
  [0, STATES.length - 1], [-1, N], [0, 3], [0, 9999], [-1, 9999], [0, 1], [-1, 1],
  [0, 9999], [0, 9999], [0, 9999], [0, 9999],
  [0, 999], [0, 99], [0, 999], [0, 999], [0, 999], [0, 999], [-999, 999, true], [0, 1], [0, 1], [0, 15],
  [0, 99, true], [0, 999, true], [0, 99], [-1, 3], [0, 1023],
  [0, N], [0, N], [0, N], [0, N],
  [-99999, 99999, true], [-99999, 99999, true], [-1, 99999],
  ...Array(NST).fill([0, 9999]), [0, BARRIER_MAX, true], ...Array(4).fill([0, 9999]), [-1, N], [-1, N], [0, 99999, true], [0, 99],
];

export function fighterState(F) {
  const m = F.move;
  const b = v => (v ? 1 : 0);
  return [
    F.x, F.y, F.vx, F.vy, F.face, b(F.grounded), F.jumps,
    STATES.indexOf(F.state), m ? MOVE_INDEX[m.id] : -1, m ? m.slot : 0, m ? m.f : 0, m?.fire ?? -1, b(m?.air), m?.dir ?? 0,
    ...F.cd,
    F.hitstun, F.hitlag, F.invuln, F.dizzy, F.respawnT, F.hover, F.guardHp, b(F.helpless), b(F.fastfall),
    F.loadout.reduce((bits, id, i) => bits | (F.airUsed.has(id) ? 1 << i : 0), 0),
    F.charge, F.dmg, F.stocks, F.lastHitBy,
    b(F.noGravity) | b(F.guarding) << 1 | b(F.counter) << 2 | b(F.sleeping) << 3 | b(F.projInv) << 4 | b(F.low) << 5
      | b(F.gcounter) << 6 | (F.guardMode & 3) << 7,
    ...F.loadout.map(id => MOVE_INDEX[id]),
    m ? m.v : 0, m ? m.w : 0, m ? m.cdx : -1,
    ...F.st, F.barrier, ...F.cnt, F.lastMv, F.bub, F.stockDmg, F.armorNow,
  ];
}

/** fighterState で作った配列（検査済み）を F に読み込む */
export function loadFighter(F, a) {
  F.loadout = a.slice(33, 37).map(i => MOVES[i].id);
  [F.x, F.y, F.vx, F.vy] = a;
  F.face = a[4] || 1;
  F.grounded = !!a[5];
  F.jumps = a[6];
  F.state = STATES[a[7]];
  const def = a[8] >= 0 ? MOVES[a[8]] : null;
  F.move = def && { id: def.id, def, slot: a[9], f: a[10], hitSet: new Set(),
    fire: a[11] >= 0 ? a[11] : undefined, air: !!a[12], dir: a[13] || undefined, v: a[37], w: a[38], cdx: a[39] };
  F.cd = a.slice(14, 18);
  [F.hitstun, F.hitlag, F.invuln, F.dizzy, F.respawnT, F.hover, F.guardHp] = a.slice(18, 25);
  F.helpless = !!a[25];
  F.fastfall = !!a[26];
  F.airUsed = new Set(F.loadout.filter((id, i) => a[27] & (1 << i)));
  [F.charge, F.dmg, F.stocks, F.lastHitBy] = a.slice(28, 32);
  const ff = a[32];
  F.noGravity = !!(ff & 1); F.guarding = !!(ff & 2); F.counter = !!(ff & 4); F.sleeping = !!(ff & 8);
  F.projInv = !!(ff & 16); F.low = !!(ff & 32); F.gcounter = !!(ff & 64); F.guardMode = (ff >> 7) & 3;
  let k = 40;
  F.st = a.slice(k, k + NST); k += NST;
  F.barrier = a[k++];
  F.cnt = a.slice(k, k + 4); k += 4;
  F.lastMv = a[k++]; F.bub = a[k++]; F.stockDmg = a[k++]; F.armorNow = a[k++];
}

/** 予測用のシミュレーション（自分 1 体だけ。撃墜しない） */
export function predictSim(slot) {
  const sim = new Sim([{ slot, name: "", loadout: ["jab", "jab", "jab", "jab"] }], { stocks: 3 });
  sim.predict = true;
  sim.phase = "fight";
  return sim;
}

// ---- CPU ----
// 人と同じ条件に近づけるため、相手の技は「出し始めてから react フレーム経ってから」しか気づかない。
// 技の使いどころは moves.js の ai（役割）で決める:
//   atk / ko / grab: 近くで / far / trap / debuff: 離れて / def: 相手の技に反応して / buff / heal: 離れているとき /
//   rec: 場外で / move: ときどき / special: ときどき

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

/** 技の届く距離（前方向）の目安 */
function reachOf(def) {
  if (def.aiReach) return def.aiReach;
  if (!def.hits) return 90;
  return Math.max(...def.hits.map(h => Math.abs(h.box[0]) + h.box[2] / 2));
}

/** CPU の入力を作る（pressed / held の形でシミュレーションに渡す） */
export function cpuInput(F, sim) {
  const inp = cpuInputRaw(F, sim);
  // 混乱していたら、ふつう以上の CPU は逆に倒して合わせる（人も慣れれば合わせられる）
  if (F.st[S.confuse] > 0 && F.level >= 2 && inp.x) return { ...inp, x: -inp.x };
  return inp;
}

function cpuInputRaw(F, sim) {
  const L = CPU_LEVELS[F.level];
  if (!L || !F.alive || sim.phase !== "fight") return EMPTY_INPUT;   // 動かない CPU は何もしない（技の研究用）
  const ai = F.ai;
  let x = 0, y = 0, held = 0, pressed = 0;
  const def = i => MOVE_BY_ID[F.loadout[i]];
  const role = i => def(i).ai || "atk";
  const ready = i => i >= 0 && F.cd[i] === 0 && !(def(i).oncePerAir && F.airUsed.has(def(i).id));
  const between = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo));
  const press = i => {
    pressed |= 1 << i;
    const d = def(i);
    if (d.hold) {
      ai.holdSlot = i;
      ai.holdT = typeof d.aiHold === "function" ? d.aiHold() : d.aiHold ?? (15 + Math.floor(Math.random() * 45));
    }
  };

  if (F.hover > 0) return ai.cool-- > 0 ? EMPTY_INPUT : { x: 0, y: 1, held: 0, pressed: 0 };

  if (ai.holdT > 0) {
    ai.holdT--;
    held |= 1 << ai.holdSlot;
  }
  if (F.grounded) ai.trip = null;

  // ふっとび中: 抜け出しの技があれば、ときどき使う
  if (F.state === "hitstun" && F.hitstun > 20 && Math.random() < 0.08 * L.def) {
    const b = [0, 1, 2, 3].find(i => ready(i) && def(i).burst);
    if (b != null) { pressed |= 1 << b; return { x, y, held, pressed }; }
  }

  // 場外: 中央へ戻る
  const off = F.x < STAGE.x0 + 5 || F.x > STAGE.x1 - 5;
  if (off && !F.grounded) {
    ai.trip ??= { forget: Math.random() < L.miss };
    x = (F.x < 800 ? 1 : -1) * Math.max(L.speed, 0.8);
    if (F.state === "normal" && !F.helpless && F.y > STAGE.y - 60 && F.vy > -3) {
      const recs = [0, 1, 2, 3].filter(i => ready(i) && (role(i) === "rec" || def(i).rec) && (def(i).aiOk?.(F, sim) ?? true));
      if (F.jumps > 0) pressed |= 1 << JUMP_BIT;
      else if (!ai.trip.forget && recs.length) press(recs[0]);
    }
    if (F.state === "move" && F.move.def.hold) held |= 1 << F.move.slot;   // 気球などは押し続ける
    return { x, y, held, pressed };
  }

  // 存在感ゼロの相手も、すぐそば（200 以内）なら気づく
  const T = sim.nearestFoe(F) ?? sim.list.find(U => U !== F && U.alive && U.hover <= 0 && Math.hypot(U.x - F.x, U.y - F.y) < 200);
  if (!T) return { x, y, held, pressed };
  const dx = T.x - F.x, dy = T.y - F.y, adx = Math.abs(dx);

  if (adx > 70) x = sign(dx) * L.speed;
  else if (adx > 5 && F.state === "normal") x = sign(dx) * 0.35;   // 向きだけ合わせる
  if (F.grounded && ((x < 0 && F.x < STAGE.x0 + 40) || (x > 0 && F.x > STAGE.x1 - 40))) x = 0;
  if (F.grounded && dy < -110 && Math.random() < L.hop) pressed |= 1 << JUMP_BIT;

  const avail = [0, 1, 2, 3].filter(i => ready(i));
  const ok = i => def(i).aiOk?.(F, sim, T) ?? true;

  // 相手の技に（react フレーム遅れて）気づいたら、守りの技で返すことがある。1 つの技に 1 回だけ
  if (F.state === "normal" && T.move && T.move !== ai.seenMove && T.move.f >= L.react && adx < 160) {
    ai.seenMove = T.move;
    const d = avail.find(i => role(i) === "def" && ok(i));
    if (d != null && Math.random() < L.def) {
      press(d);
      ai.cool = between(L.think);
      return { x, y, held, pressed };
    }
  }
  // 相手がガード・構えをしていたら、つかみ
  if (F.state === "normal" && (T.guarding || T.counter) && adx < 90) {
    const g = avail.find(i => role(i) === "grab");
    if (g != null && Math.random() < 0.5) { press(g); return { x, y, held, pressed }; }
  }

  if (--ai.cool > 0 || F.state !== "normal") return { x, y, held, pressed };
  ai.cool = between(L.think);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  if (adx > 260) {
    const far = avail.filter(i => ["far", "trap", "debuff", "special"].includes(role(i)) && ok(i));
    const self = avail.filter(i => (role(i) === "buff" || (role(i) === "heal" && F.dmg > 40)) && ok(i));
    if (self.length && Math.random() < 0.35) press(pick(self));
    else if (far.length && Math.random() < L.ranged) press(pick(far));
    else if (Math.random() < 0.1) { const mv = avail.filter(i => role(i) === "move" && ok(i)); if (mv.length) press(pick(mv)); }
    return { x, y, held, pressed };
  }
  if (adx < 220 && Math.abs(dy) < 130) {
    const near = avail.filter(i => ["atk", "ko", "grab"].includes(role(i)) && reachOf(def(i)) + 30 >= adx && ok(i));
    if (near.length) {
      const i = pick(near);
      press(i);
      if (def(i).aiBack) x = -sign(dx);   // 後ろ向きの技は背中を向けて出す
    } else {
      const mid = avail.filter(i => ["far", "trap", "debuff", "special"].includes(role(i)) && ok(i));
      if (mid.length && Math.random() < 0.3) press(pick(mid));
    }
  }
  return { x, y, held, pressed };
}

export { MOVES };
