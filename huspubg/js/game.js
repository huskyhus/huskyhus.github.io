// 対戦中のクライアント。ホストでもクライアントでも同じこれが動く（ホストの本人のメッセージは通信を通らずに渡る）。
//   自分の体は手元で動かし（すぐ反応するように）、位置をホストへ申告する。ホストに戻されたら（corr が変わったら）従う
//   ほかの人はスナップショットを 110ms 遅らせて補間して描く。撃った時はその「見ていた時刻」を送り、ホストが巻き戻して判定する

import { World, STAND_H, CROUCH_H, GRAVITY, rayPlayer, HALF, PAD_JUMP, grenadeStep, PLAYER_R } from "./world.js";
import { WEAPONS, GRENADE, STK, STAMPS, itemInfo, W_GRENADE, stickerSrc, weaponStats, attFits } from "./items.js";
import { AC, expandY, MAX_PLAYERS, ST, MODE } from "./protocol.js";
import { PLANE_ALT, EYE } from "./sim.js";
import { dirFromAngles, clamp, lerp, wrapAngle, r2, r3 } from "./util.js";
import { SLOT_COLORS, THREE } from "./render.js";
import * as sfx from "./sfx.js";
import { Menu } from "./menu.js";

// ほかの人の表示: スナップショット（毎秒 30 回）を少し遅らせて補間する。遅らせる量は届く間隔の揺れから自動で決める（70〜250ms）。
// 次が届かない間は、直前の動きから最大 EXTRAP_MS 先まで先読みする（止まって見えないように）
const INTERP_MIN = 70, INTERP_MAX = 250, EXTRAP_MS = 150;
const DEG = Math.PI / 180;
const CAUSE_TEXT = { 9: "グレネード", 10: "安全地帯の外", 11: "退出" };

export class Game {
  constructor({ renderer, input, hud, send, mySlot, lobby, seed, settings, onOver }) {
    Object.assign(this, { R: renderer, input, hud, send, me: mySlot, lobby, settings, onOver });
    this.world = new World(seed);
    this.R.buildWorld(this.world);
    this.hud.setMap(this.world);
    this.hud.setColor(mySlot);
    this.loot = new Map();
    for (const l of this.world.loot) { this.loot.set(l.id, { ...l }); this.R.addLoot(l); }
    this.evAck = -1;
    this.snaps = [];
    this.off = null;
    this.delay = 110;      // いまの補間の遅れ（ms）
    this.jitter = 15;      // 届く間隔の揺れ（ms）
    this.lastArrive = 0;
    this.last = null;   // 最新のスナップショット
    this.Y = null;
    this.body = { x: 0, y: PLANE_ALT, z: 0, vx: 0, vy: 0, vz: 0, h: STAND_H, onGround: false, inWater: false };
    this.st = ST.PLANE;
    this.yaw = 0; this.pitch = -0.2;
    this.corr = -1;
    this.crouch = false; this.ads = false; this.tpp = false; this.showMap = false;
    this.hand = 2; this.handT = 0;
    this.shotSeq = 0; this.lastFire = 0; this.bloom = 0; this.kick = 0; this.punch = 0;
    this.mvSeq = 0; this.lastMv = 0;
    this.eyeH = EYE.stand;
    this.prevHp = 100;
    this.spec = -1;
    this.flashT = 0; this.stepT = 0;
    this.planeLine = null;
    this.zoneStage = 0;
    this.dead = false; this.done = false;
    this.lastGren = 0;
    this.pendingT = [];    // まだ出していない、ほかの人の弾の線
    this.recoilDebt = 0;   // 反動で上がった分（撃ち終わると少し戻る）
    this.burst = 0;        // 連射の何発目か
    this.vault = null;     // 乗り越え中 { t, dur, x0, y0, z0, x1, y1, z1, top }
    this.menu = new Menu(a => this.send({ t: "ac", ...a }));
    this.menuOpen = false;
    this.killcam = null;   // { killer, t0, from, to, lastT }
    this.hud.death(null);
    this.hud.killcam(null);
    this.myGren = [];      // 自分が投げたグレネード（ホストと同じ物理で手元で動かす）
    this.grenSeq = 0;
    this.camPos = new THREE.Vector3();
    this.mode = lobby?.md ?? MODE.BR;
    if (this.mode === MODE.RANGE) this.hud.banner(STK.itsukan, "射撃訓練場", "足もとの武器・アタッチメントを拾って、10〜200m の的を撃とう（的の防具は Lv がばらばら）", 5000);
    else if (this.mode === MODE.TEAM) this.hud.banner(STK.kisoku, "チーム戦", "人間チームで協力して、CPU チームを全滅させよう！（敵は赤い名前・味方には当たらない）", 4500);
    else this.hud.banner(STK.saraba, "飛行機から降下しよう！", "F で降下 ・ マウスで見回す", 3500);
  }

  /** チーム戦で CPU チームか */
  isCpuTeam(slot) { return this.mode === MODE.TEAM && this.lobby?.P[slot]?.k === 2; }
  name(slot) {
    const n = this.lobby?.P[slot]?.n || `P${slot + 1}`;
    if (this.mode === MODE.RANGE && this.lobby?.P[slot]?.k === 2) return "的";
    return n;
  }
  avatar(slot) { return this.lobby?.P[slot]?.a ?? 0; }

  // ---- ホストから ----
  onSnap(s) {
    const t = performance.now();
    // 届く間隔の揺れを測って、補間の遅れを決める
    if (this.lastArrive) {
      const gap = t - this.lastArrive, expect = 1000 / 30;
      this.jitter += (Math.abs(gap - expect) - this.jitter) * 0.05;
    }
    this.lastArrive = t;
    const target = clamp(1000 / 30 * 2 + this.jitter * 2.5, INTERP_MIN, INTERP_MAX);
    this.delay += (target - this.delay) * (target > this.delay ? 0.2 : 0.02);   // 悪くなったらすぐ、良くなったらゆっくり
    const sample = s.tm - t;
    if (this.off === null || Math.abs(sample - this.off) > 1000) this.off = sample;
    else this.off += (sample - this.off) * (sample > this.off ? 0.2 : 0.03);   // 早く着いた方へ寄せる（遅れの揺れに強く）
    if (!this.snaps.length || s.tm > this.snaps[this.snaps.length - 1].tm) {
      // キルカメラで 4 秒前から再生できるように、10 秒ぶん（毎秒 30 回 × 10）覚えておく。弾の線も一緒に
      this.snaps.push({ tm: s.tm, F: s.F, PL: s.PL, G: s.G, T: s.T });
      if (this.snaps.length > 300) this.snaps.shift();
    }
    this.last = s;
    if (!this.planeLine && s.PL[3]) this.planeStart = this.planeStart || [s.PL[0], s.PL[1], s.PL[2]];
    if (this.planeStart && !this.planeLine) {
      const [x, z, yaw] = this.planeStart, d = dirFromAngles(yaw, 0);
      this.planeLine = [x - d[0] * 400, z - d[2] * 400, x + d[0] * 700, z + d[2] * 700];
    }
    // 自分
    if (s.Y) {
      const Y = this.Y = expandY(s.Y);
      if (Y.corr !== this.corr) {
        if (this.corr !== -1 || this.st !== ST.PLANE) { this.body.x = Y.cx; this.body.y = Y.cy; this.body.z = Y.cz; this.body.vx = this.body.vy = this.body.vz = 0; }
        this.corr = Y.corr;
      }
      if (Y.hp < this.prevHp - 0.5 && this.st !== ST.DEAD) {
        const dmg = this.prevHp - Y.hp;
        sfx.hurt();
        this.hud.hurt(dmg);
        this.shake = Math.min(1, (this.shake || 0) + dmg / 25);
      }
      this.prevHp = Y.hp;
      if (performance.now() - this.handT > 500) this.hand = Y.hand;
    }
    const mine = s.F[this.me];
    if (mine) {
      const hs = mine[5];
      if (hs <= ST.PLANE || hs === ST.DEAD) this.st = hs;
      else if (this.st <= ST.PLANE) { this.st = hs; this.body.x = mine[0]; this.body.y = mine[1]; this.body.z = mine[2]; this.body.vy = 0; }
    }
    // できごと（番号順に 1 つずつ）
    for (const e of s.E) {
      if (e[0] !== this.evAck + 1) continue;
      this.evAck = e[0];
      this.applyEvent(e);
    }
    // ほかの人の銃声と弾の線: 姿は少し遅らせて描いているので、弾の線も同じ時刻まで待ってから出す（向きと弾がずれて見えないように）
    for (const t of s.T) if (t[0] !== this.me) this.pendingT.push({ tm: s.tm, t });
    if (this.pendingT.length > 200) this.pendingT.splice(0, this.pendingT.length - 200);
    for (const [, dmg, head, kill] of s.H) { this.hud.hit(head, kill, dmg); sfx.hitMarker(head); }
    for (const [x, z] of s.D) {
      const yawTo = Math.atan2(-(x - this.body.x), -(z - this.body.z));
      this.hud.damageFrom(-wrapAngle(yawTo - this.yaw));
    }
    this.R.setDrops(s.A);
    this.drops = s.A;
    if (s.X.length) { this.detected = s.X; this.detectedT = performance.now(); }
    else if (performance.now() - (this.detectedT || 0) > 300) this.detected = null;
    this.R.setZone(s.Z);
    this.R.setPlane(this.interpPlane() ?? s.PL);
    if (s.ph === 2 && !this.done) { this.done = true; this.onOver?.(s.R, { mode: this.mode, winTeam: this.winTeam }); }
  }

  pan(x, z) {
    const yawTo = Math.atan2(-(x - this.camPos.x), -(z - this.camPos.z));
    return -Math.sin(wrapAngle(yawTo - this.yaw));
  }

  applyEvent(e) {
    const [, k, a, b, c, d, f, g] = e;
    switch (k) {
      case 0: this.loot.delete(a); this.R.removeLoot(a); break;
      case 1: { const l = { id: a, code: b, qty: c, x: d, y: f, z: g }; this.loot.set(a, l); this.R.addLoot(l); break; }
      case 2: {
        const killer = a, victim = b;
        const parts = [];
        if (killer >= 0) parts.push({ text: this.name(killer), color: SLOT_COLORS[killer] });
        const wtext = c <= 8 ? WEAPONS[c].short : c === 9 ? "グレネード" : CAUSE_TEXT[c] || "";
        const icon = c >= 1 && c <= 8 ? WEAPONS[c].stk : c === 9 ? GRENADE.stk : c === 10 ? STK.oroka : null;
        if (icon) parts.push({ img: stickerSrc(icon) });
        parts.push({ text: ` ${wtext}${d ? " (ヘッド)" : ""} ` });
        parts.push({ text: this.name(victim), color: SLOT_COLORS[victim] });
        this.hud.feed(parts);
        if (killer === this.me && victim !== this.me) {
          sfx.kill();
          this.hud.banner(STK.omaemo, `${this.name(victim)} をたおした！`, `キル ${this.Y ? this.Y.kills : ""}`, 2200);
        }
        if (victim === this.me) {
          this.dead = true;
          const byOther = killer >= 0 && killer !== this.me;
          this.spec = byOther ? killer : -1;
          const F = this.last?.F || [];
          const kf = byOther ? F[killer] : null, mf = F[this.me];
          this.hud.death({
            killer: byOther ? this.name(killer) : null, color: byOther ? SLOT_COLORS[killer] : "#fff",
            weapon: wtext, icon, head: !!d,
            dist: kf && mf ? Math.round(Math.hypot(kf[0] - mf[0], kf[1] - mf[1], kf[2] - mf[2])) : 0,
            cause: CAUSE_TEXT[c] || "", rank: this.Y?.rank || this.last?.al + 1 || 0,
            total: (this.lobby?.P || []).filter(p => p.k).length, kills: this.Y?.kills ?? 0, dmg: this.Y?.dmg ?? 0,
          });
          // キルカメラ: 倒した人の肩ごしに、倒される 4 秒前から倒れるまでを再生する
          if (byOther && this.last) {
            this.killcam = { killer, t0: performance.now(), from: this.last.tm - 4000, to: this.last.tm + 900, lastT: this.last.tm - 4000 };
            this.hud.killcam(this.name(killer));
          }
          this.menuOpen = false;
        }
        if (this.spec === victim && victim !== this.me) this.spec = -1;
        break;
      }
      case 3: {
        // 自分の手元の予測グレネードのうち、いちばん近いものはここで消す
        if (this.myGren.length) {
          let i = 0;
          this.myGren.forEach((g, k) => { if (Math.hypot(g.x - a, g.z - c) < Math.hypot(this.myGren[i].x - a, this.myGren[i].z - c)) i = k; });
          if (Math.hypot(this.myGren[i].x - a, this.myGren[i].z - c) < 15 || this.myGren[i].t > GRENADE.fuse - 0.5) this.myGren.splice(i, 1);
        }
        this.R.explosion(a, b, c);
        sfx.explosion(Math.hypot(a - this.camPos.x, c - this.camPos.z), this.pan(a, c));
        break;
      }
      case 4: this.R.showStamp(a, b); sfx.stamp(); this.hud.feed([{ text: this.name(a), color: SLOT_COLORS[a] }, { img: stickerSrc(STAMPS[b]) }]); break;
      case 5: {
        if (b === 1) { sfx.alarm(); this.hud.banner(STK.tokiwa, "安全地帯が縮み始めた！", `フェーズ ${a}`, 3000); }
        else this.hud.banner(STK.tokiwa, "次の安全地帯が決まった", "地図（M）の白い円へ向かおう", 3000);
        break;
      }
      case 6: {
        this.winTeam = b;
        if (this.mode === MODE.TEAM) {
          if (b === 1) this.hud.banner(STK.kando, "人間チームの勝ち！", "CPU チームを全滅させた！", 6000);
          else this.hud.banner(STK.yatchi, "CPU チームの勝ち…", "人間チームは全滅", 6000);
        } else if (a === this.me) this.hud.banner(STK.kando, "勝った！勝った！", "今夜はハス勝だ！！", 6000);
        else if (a >= 0) this.hud.banner(STK.omaemo, `${this.name(a)} の勝ち！`, "", 4000);
        break;
      }
      case 7: {
        sfx.alarm();
        this.hud.banner(STK.gyakuten, "補給物資が投下された！", "中身は探知機（地図に赤い□）", 3500);
        break;
      }
    }
  }

  interpPlane() {
    const rt = performance.now() + (this.off ?? 0) - this.delay;
    const S = this.snaps;
    for (let i = S.length - 1; i > 0; i--) {
      if (S[i - 1].tm <= rt) {
        const A = S[i - 1].PL, B = S[i].PL, k = clamp((rt - S[i - 1].tm) / Math.max(1, S[i].tm - S[i - 1].tm), 0, 1.5);
        return [lerp(A[0], B[0], k), lerp(A[1], B[1], k), B[2], B[3]];
      }
    }
    return null;
  }

  /** 補間した、ある人の姿（最新より先の時刻なら、直前の 2 つから先読み） */
  interp(slot, rt) {
    const S = this.snaps;
    if (!S.length) return null;
    let A = null, B = null;
    for (let i = S.length - 1; i >= 0; i--) { if (S[i].tm <= rt) { A = S[i]; B = S[i + 1] || null; break; } }
    if (!A) { A = B = S[0]; }
    if (!B) {
      // まだ次が届いていない → 直前の 2 つの動きをのばす（最大 EXTRAP_MS）
      if (S.length >= 2 && A === S[S.length - 1]) { B = A; A = S[S.length - 2]; rt = Math.min(rt, B.tm + EXTRAP_MS); }
      else B = A;
    }
    const a = A.F[slot], b = B.F[slot];
    if (!a || !b) return null;
    const k = B === A ? 0 : clamp((rt - A.tm) / Math.max(1, B.tm - A.tm), 0, 1 + EXTRAP_MS / Math.max(1, B.tm - A.tm));
    if (b[5] !== a[5]) return toF(b);
    return {
      x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), z: lerp(a[2], b[2], k),
      yaw: a[3] + wrapAngle(b[3] - a[3]) * k, pitch: lerp(a[4], b[4], k),
      st: b[5], hp: b[6], hold: b[7], fl: b[8], eq: b[9],
    };
  }

  // ---- 毎フレーム ----
  frame(dt) {
    const I = this.input;
    const now = performance.now();
    const rt = now + (this.off ?? 0) - this.delay;
    const Y = this.Y;
    const sens = (this.settings.sens || 1) * 0.0022;
    const zoom = this.currentZoom();
    if (I.locked) {
      this.yaw -= I.dx * sens / zoom;
      this.pitch = clamp(this.pitch - I.dy * sens / zoom, -1.5, 1.5);
    }
    const stampMode = I.down("KeyT");
    this.hud.stampsShown(stampMode && this.st !== ST.NONE);
    if (stampMode) {
      for (let i = 0; i < STAMPS.length; i++) if (I.hit("Digit" + (i + 1))) this.send({ t: "ac", a: AC.STAMP, v: i });
    }
    if (I.hit("KeyM")) this.showMap = !this.showMap;
    if (I.hit("KeyV")) this.tpp = !this.tpp;

    const b = this.body;
    const fwd = (I.down("KeyW") ? 1 : 0) - (I.down("KeyS") ? 1 : 0);
    const side = (I.down("KeyD") ? 1 : 0) - (I.down("KeyA") ? 1 : 0);
    let prompt = "";

    if (this.st === ST.PLANE) {
      const PL = this.interpPlane() ?? this.last?.PL;
      if (PL) { b.x = PL[0]; b.z = PL[1]; b.y = PLANE_ALT; }
      const over = PL && Math.abs(PL[0]) < HALF - 20 && Math.abs(PL[1]) < HALF - 20;
      prompt = over ? "F で降下" : "島の上に来たら降下できます";
      sfx.loop("plane", 1);
      if (I.hit("KeyF") && over) this.send({ t: "ac", a: AC.JUMP, v: 0 });
    } else sfx.loop("plane", 0);

    if (this.st === ST.FALL || this.st === ST.CHUTE) {
      const fall = this.st === ST.FALL;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const hs = fall ? (fwd > 0 ? 24 : 6) : (fwd > 0 ? 9 : fwd < 0 ? 2.5 : 5);
      const tvx = fx * hs * Math.max(fwd, fall ? 0.2 : 0.6) + -fz * side * (fall ? 8 : 4);
      const tvz = fz * hs * Math.max(fwd, fall ? 0.2 : 0.6) + fx * side * (fall ? 8 : 4);
      b.vx += (tvx - b.vx) * Math.min(1, dt * 1.5);
      b.vz += (tvz - b.vz) * Math.min(1, dt * 1.5);
      const vy = fall ? (fwd > 0 && this.pitch < -0.3 ? -42 : -30) : (fwd > 0 ? -6.5 : fwd < 0 ? -4 : -5.2);
      b.vy += (vy - b.vy) * Math.min(1, dt * 2);
      b.x = clamp(b.x + b.vx * dt, -HALF + 2, HALF - 2); b.z = clamp(b.z + b.vz * dt, -HALF + 2, HALF - 2); b.y += b.vy * dt;
      b.h = STAND_H;
      this.world.pushOut(b, PLAYER_R);   // パラシュートで建物の壁に入りこまないように
      const g = this.world.groundAt(b.x, b.z, b.y + 0.5);
      const alt = b.y - g;
      sfx.loop("wind", fall ? 0.8 : 0.25);
      if (fall) {
        prompt = `高度 ${Math.round(alt)}m ・ F でパラシュート`;
        if (alt < 85 || (I.hit("KeyF") && alt < 280)) { this.st = ST.CHUTE; b.vy = -8; }
      } else prompt = `高度 ${Math.round(alt)}m`;
      if (alt <= 0) { b.y = g; this.st = ST.GROUND; b.vy = 0; b.onGround = true; sfx.loop("wind", 0); sfx.step(0, 0.4); }
    } else if (this.st !== ST.PLANE) sfx.loop("wind", 0);

    if (this.st === ST.GROUND && Y) prompt = this.groundFrame(dt, fwd, side, now, rt);
    else this.R.setTrajectory(null);

    if (this.st === ST.DEAD) {
      prompt = "";
      if (I.clicked & 1 || I.hit("Space")) {
        if (this.killcam) this.endKillcam();
        else this.nextSpec(1);
      }
    }
    // 所持品メニュー（Tab で開け閉め。開いている間は撃たない）
    // 開いている間はマウスを放して、メニューのボタンを押せるようにする
    if ((I.hit("Tab") || (this.menuOpen && I.hit("Escape"))) && this.st !== ST.DEAD) {
      this.menuOpen = !this.menuOpen;
      if (this.menuOpen) I.unlock(); else I.lock();
      I.noAutoLock = this.menuOpen;   // メニューの外をクリックしても、マウスを固定し直さない
    }
    if (this.st === ST.DEAD && this.menuOpen) { this.menuOpen = false; I.noAutoLock = false; I.lock(); }
    this.hud.prompt(stampMode ? "" : prompt);

    // 向きが壊れたら（NaN など。カメラが壊れると画面が空の色だけになる）直前の正しい向きへ戻す
    if (Number.isFinite(this.yaw) && Number.isFinite(this.pitch)) this.goodAng = [this.yaw, this.pitch];
    else { [this.yaw, this.pitch] = this.goodAng || [0, 0]; this.recoilDebt = 0; this.bloom = 0; this.kick = 0; }
    // 体が壁などに埋まっていたら出す。位置が壊れていたら最後の正しい位置へ（画面が空だけになるのを防ぐ）
    if (this.st >= ST.FALL && this.st <= ST.GROUND && !this.vault) {
      if (this.world.unstick(b)) this.good = { x: b.x, y: b.y, z: b.z };
      else if (this.good) { b.x = this.good.x; b.y = this.good.y; b.z = this.good.z; b.vx = b.vy = b.vz = 0; }
    }
    // 申告（30 回/秒）。飛行機や死亡中でも、できごとの受け取り返事のために送る
    if (now - this.lastMv > 33) {
      this.lastMv = now;
      const fl = (this.crouch ? 1 : 0) | (this.ads ? 2 : 0) | (this.sprinting ? 4 : 0);
      this.send({ t: "mv", s: ++this.mvSeq, ea: this.evAck, p: [r2(b.x), r2(b.y), r2(b.z), r3(wrapAngle(this.yaw)), r3(this.pitch), this.st, fl] });
    }
    this.updateGrenades(dt, rt);
    this.draw(dt, rt);
    I.endFrame();
  }

  /** 手に持っている銃の性能（アタッチメント込み）。銃でなければ null */
  heldStats() {
    const wid = this.heldWeapon();
    if (!this.Y || wid <= 0 || wid === W_GRENADE || this.hand > 1) return null;
    return weaponStats(wid, this.Y.att[this.hand]);
  }
  heldAtt() { return this.Y && this.hand <= 1 ? this.Y.att[this.hand] : [0, 0, 0, 0]; }
  currentZoom() {
    if (!this.ads || this.st !== ST.GROUND || !this.Y) return 1;
    return this.heldStats()?.zoom ?? 1;
  }
  heldWeapon() {
    const Y = this.Y;
    if (!Y) return 0;
    return this.hand === 0 ? Y.w1 : this.hand === 1 ? Y.w2 : this.hand === 3 ? W_GRENADE : 0;
  }
  predMag() {
    const Y = this.Y;
    if (!Y || this.hand > 1) return 0;
    const m = this.hand === 0 ? Y.m1 : Y.m2;
    return Math.max(0, m - Math.max(0, this.shotSeq - Y.ack));
  }
  setHand(v) {
    const Y = this.Y;
    if (!Y) return;
    if (v <= 1 && !(v === 0 ? Y.w1 : Y.w2)) return;
    if (v === 3 && !Y.gren) return;
    if (v === this.hand) return;
    this.hand = v; this.handT = performance.now();
    this.ads = false;
    this.send({ t: "ac", a: AC.HAND, v });
  }

  groundFrame(dt, fwd, side, now, rt) {
    const I = this.input, Y = this.Y, b = this.body, W = this.world;
    // しゃがみ（C で切り替え・Ctrl で押している間）
    if (I.hit("KeyC")) this.crouch = !this.crouch;
    const crouch = this.crouch || I.down("ControlLeft");
    if (!crouch && b.h < STAND_H) {
      // 立ち上がれるか（頭の上に何もないか）
      const up = W.raycast(b.x, b.y + 0.5, b.z, 0, 1, 0, STAND_H);
      if (up < STAND_H - 0.4) this.crouch = true;
    }
    const isCrouch = this.crouch || I.down("ControlLeft");
    b.h = isCrouch ? CROUCH_H : STAND_H;
    this.eyeH += ((isCrouch ? EYE.crouch : EYE.stand) - this.eyeH) * Math.min(1, dt * 12);
    // 持ちかえ
    if (!I.down("KeyT")) {
      if (I.hit("Digit1")) this.setHand(0);
      if (I.hit("Digit2")) this.setHand(1);
      if (I.hit("Digit3") || I.hit("KeyG")) this.setHand(3);
      if (I.hit("KeyX")) this.setHand(2);
      if (I.hit("Digit4")) this.send({ t: "ac", a: AC.HEAL, v: 0 });
      if (I.hit("Digit5")) this.send({ t: "ac", a: AC.HEAL, v: 1 });
      if (I.hit("Digit6")) this.send({ t: "ac", a: AC.HEAL, v: 2 });
      if (I.hit("Digit7")) {
        if (Y.det > 0 && Y.detT <= 0) { this.send({ t: "ac", a: AC.DETECT, v: 0 }); sfx.stamp(); }
        else if (!Y.det) this.hud.banner(STK.gyakuten, "探知機を持っていません", "補給物資の中に入っています", 1500);
      }
    }
    if (I.wheel) {
      const order = [0, 1, 3, 2].filter(h => (h === 0 ? Y.w1 : h === 1 ? Y.w2 : h === 3 ? Y.gren : 1));
      const i = order.indexOf(this.hand);
      this.setHand(order[(i + (I.wheel > 0 ? 1 : -1) + order.length) % order.length]);
    }
    if (I.hit("KeyR")) this.send({ t: "ac", a: AC.RELOAD, v: 0 });
    const wid = this.heldWeapon();
    this.ads = !!(I.buttons & 4) && wid > 0 && wid !== W_GRENADE && Y.act !== 1;
    // 移動
    const healing = Y.act >= 2;
    this.sprinting = fwd > 0 && I.down("ShiftLeft") && !this.ads && !isCrouch && !healing;
    let speed = this.sprinting ? 6.3 : isCrouch ? 2.4 : 4.6;
    if (this.ads) speed *= 0.6;
    if (healing) speed *= 0.5;
    if (Y.boost > 60) speed *= 1.06;
    if (b.inWater) speed *= 0.6;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let mx = fx * fwd + -fz * side, mz = fz * fwd + fx * side;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    const accel = b.onGround ? 14 : 3;
    b.vx += (mx * speed - b.vx) * Math.min(1, dt * accel);
    b.vz += (mz * speed - b.vz) * Math.min(1, dt * accel);
    if (this.vault) {
      // 乗り越え中: 体を低くして、上を通って向こう側へ
      const v = this.vault;
      v.t += dt;
      const k = Math.min(1, v.t / v.dur);
      b.h = CROUCH_H - 0.45;
      b.x = lerp(v.x0, v.x1, k); b.z = lerp(v.z0, v.z1, k);
      b.y = k < 0.5 ? lerp(v.y0, v.top, k * 2) : lerp(v.top, v.y1, (k - 0.5) * 2);
      b.vx = b.vz = b.vy = 0;
      // 低い姿勢で終えて、次のフレームの「立ち上がれるか」の判定にまかせる（頭の上がふさがっていればしゃがんだまま）
      if (k >= 1) { this.vault = null; b.onGround = true; b.h = CROUCH_H; this.crouch = false; }
    } else if (I.hit("Space") && b.onGround && !isCrouch) {
      if (!this.tryVault()) { b.vy = 6.5; b.onGround = false; }
    }
    if (!this.vault) {
      b.vy -= GRAVITY * dt;
      W.moveBody(b, dt);
    }
    if (b.onPad) { b.vy = PAD_JUMP; b.onGround = false; sfx.pad(); }
    // 足音
    const hsp = Math.hypot(b.vx, b.vz);
    if (b.onGround && hsp > 1.5) {
      this.stepT -= dt * hsp;
      if (this.stepT <= 0) { this.stepT = 2.6; sfx.step(0, this.sprinting ? 0.14 : 0.08); }
    }
    // 撃つ
    this.bloom = Math.max(0, this.bloom - dt * 5);
    // 撃ち終わって少したったら、反動で上がった分の半分ほどをゆっくり戻す
    if (this.recoilDebt > 0 && now - (this.lastShotT || 0) > 90 && wid > 0 && wid !== W_GRENADE) {
      const back = Math.min(this.recoilDebt, WEAPONS[wid].rec * DEG * dt * 0.5);
      this.pitch -= back; this.recoilDebt -= back * 2;
      if (this.recoilDebt < 0) this.recoilDebt = 0;
    }
    this.kick *= Math.exp(-dt * 14);
    this.punch = Math.max(0, this.punch - dt * 4);
    const fireHeld = (I.buttons & 1) && I.locked && !this.menuOpen;
    const fireClick = (I.clicked & 1) && I.locked && !this.menuOpen;
    if (wid === W_GRENADE) {
      if (fireClick && now - this.lastGren > 1000 && Y.gren > 0) {
        this.lastGren = now;
        const eye = this.eyePos(), v = this.grenadeVel();
        const o = [r2(eye.x), r2(eye.y), r2(eye.z)], vv = v.map(r2);
        this.send({ t: "gr", o, v: vv });
        // 送ったのと同じ値から、ホストと同じ刻み（1/120 秒）で手元でも動かす → 届くのを待たずになめらかに飛ぶ
        this.myGren.push({ id: "me" + this.grenSeq++, x: o[0], y: o[1], z: o[2], vx: vv[0], vy: vv[1], vz: vv[2], t: 0, t0: performance.now() });
        this.punch = 1;
      }
    } else {
      const Wp = WEAPONS[wid];
      const want = Wp.auto ? fireHeld : fireClick;
      if (want && Y.act !== 1 && now - this.lastFire >= 60000 / Wp.rpm) {
        if (wid > 0 && this.predMag() <= 0) {
          if (fireClick) { sfx.empty(); this.send({ t: "ac", a: AC.RELOAD, v: 0 }); }
        } else this.fire(wid, hsp, now, rt);
      }
    }
    // グレネードの予測線（ホストと同じ物理で、爆発するまで）
    if (wid === W_GRENADE && Y.gren > 0) this.R.setTrajectory(this.grenadePath());
    else this.R.setTrajectory(null);
    // 拾う
    let prompt = "";
    const target = this.lootTarget();
    if (target) {
      const it = itemInfo(target.code);
      const qty = it.kind === "ammo" || it.kind === "heal" || it.kind === "grenade" ? ` ×${target.qty}` : "";
      const worse = (it.kind === "helmet" || it.kind === "vest" || it.kind === "pack") && it.sub <= Y[it.kind];
      const fit = it.kind === "att" ? ([Y.w1, Y.w2].some(w => w && attFits(w, target.code)) ? "" : "（今の銃には付かない・予備へ）") : "";
      if (worse) prompt = `${it.name}（今の方が良いので拾わない）`;
      else {
        prompt = `F  拾う：${it.name}${qty}${fit}`;
        if (I.hit("KeyF")) { this.send({ t: "ac", a: AC.PICK, v: target.id }); sfx.pickup(); }
      }
    }
    if (Y.act) {
      if (I.hit("KeyF") && !target) this.send({ t: "ac", a: AC.CANCEL, v: 0 });
    }
    return prompt;
  }

  eyePos() { const b = this.body; return { x: b.x, y: b.y + this.eyeH, z: b.z }; }

  /**
   * 目の前の窓・低い壁を乗り越えられるなら乗り越えを始めて true。
   * 条件: 1m 以内に、足もとから 0.5〜1.4m の高さの物があり、その上に 0.8m 以上のすき間があり、向こう側に立てる
   */
  tryVault() {
    const b = this.body, W = this.world;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const near = W.raycast(b.x, b.y + 0.7, b.z, fx, 0, fz, 1.2);
    if (near >= 1.2) return false;
    let top = -1;
    for (let h = 0.55; h <= 1.45; h += 0.1) {
      if (W.raycast(b.x, b.y + h, b.z, fx, 0, fz, near + 0.4) >= near + 0.4) { top = h; break; }
    }
    if (top < 0) return false;
    const clear = W.raycast(b.x, b.y + top + 0.8, b.z, fx, 0, fz, near + 0.6);
    if (clear < near + 0.5) return false;
    // 向こう側（壁の厚みぶん先）に立てるか
    const dist = near + 0.95;
    const x1 = b.x + fx * dist, z1 = b.z + fz * dist;
    const g = W.groundAt(x1, z1, b.y + top + 0.3);
    if (g > b.y + top + 0.1 || g < b.y - 3) return false;
    if (W.raycast(x1, g + 0.3, z1, 0, 1, 0, 1.0) < 0.9) return false;   // 向こう側の頭の上がふさがっている
    this.vault = { t: 0, dur: 0.55, x0: b.x, y0: b.y, z0: b.z, x1, y1: g, z1, top: b.y + top + 0.08 };
    sfx.step(0, 0.3);
    return true;
  }

  /**
   * 飛んでいるグレネードを毎フレーム描く。
   *   ほかの人のもの: スナップショットを人と同じだけ遅らせて補間（毎秒 30 回の位置をそのまま出すとカクつく）
   *   自分のもの: 手元で同じ物理を進めたもの（ホストからの分は出さない）。爆発の知らせが来るか時間切れで消す
   */
  updateGrenades(dt, rt) {
    const STEP = 1 / 120;
    for (const g of this.myGren) {
      // フレームが重くても遅れないように、投げてからの実時間まで進める
      const target = Math.min(GRENADE.fuse + 0.6, (performance.now() - g.t0) / 1000);
      while (g.t + STEP <= target) { grenadeStep(this.world, g, STEP); g.t += STEP; }
    }
    this.myGren = this.myGren.filter(g => g.t < GRENADE.fuse + 0.6);
    const out = this.myGren.map(g => [g.id, g.x, g.y, g.z]);
    const S = this.snaps;
    let A = null, B = null;
    for (let i = S.length - 1; i >= 0; i--) { if (S[i].tm <= rt) { A = S[i]; B = S[i + 1] || S[i]; break; } }
    if (A && A.G) {
      const k = B === A ? 0 : clamp((rt - A.tm) / Math.max(1, B.tm - A.tm), 0, 1);
      for (const a of A.G) {
        if (a[1] === this.me) continue;
        const b = (B.G || []).find(q => q[0] === a[0]) || a;
        out.push([a[0], lerp(a[2], b[2], k), lerp(a[3], b[3], k), lerp(a[4], b[4], k)]);
      }
    }
    this.R.setGrenades(out);
  }

  /** 投げる速さ（送るものと予測線で同じ） */
  grenadeVel() {
    const d = dirFromAngles(this.yaw, this.pitch + 0.12);
    return [d[0] * GRENADE.speed, d[1] * GRENADE.speed + 2, d[2] * GRENADE.speed];
  }
  grenadePath() {
    const e = this.eyePos(), [vx, vy, vz] = this.grenadeVel();
    const g = { x: e.x, y: e.y, z: e.z, vx, vy, vz };
    const pts = [g.x, g.y, g.z];
    const step = 1 / 80, n = Math.round(GRENADE.fuse / step);
    for (let i = 0; i < n; i++) {
      grenadeStep(this.world, g, step);
      if (i % 2 === 1) pts.push(g.x, g.y, g.z);
    }
    pts.push(g.x, g.y, g.z);
    return pts;
  }

  fire(wid, hsp, now, rt) {
    const Wp = WEAPONS[wid];
    this.lastFire = now;
    const b = this.body;
    // 広がり（度）
    let spread = this.ads ? Wp.ads : Wp.hip;
    spread += Math.min(1, hsp / 6) * (this.ads ? Wp.hip * 0.25 : Wp.hip * 0.5);
    if (!b.onGround) spread += 3;
    if (b.h < STAND_H) spread *= 0.8;
    spread += this.bloom;
    const eye = this.eyePos();
    const dirs = [];
    for (let i = 0; i < Wp.pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread * DEG;
      dirs.push(dirFromAngles(this.yaw + Math.cos(a) * r, this.pitch + Math.sin(a) * r).map(r3));
    }
    this.send({ t: "sh", s: ++this.shotSeq, w: wid, o: [r2(eye.x), r2(eye.y), r2(eye.z)], d: dirs, rt: Math.round(rt) });
    // 反動
    if (wid > 0) {
      const S = this.heldStats() || weaponStats(wid);
      this.burst = now - this.lastShotT < 60000 / Wp.rpm + 120 ? this.burst + 1 : 0;
      this.lastShotT = now;
      const pose = (this.ads ? 0.8 : 1) * (b.h < STAND_H ? 0.85 : 1);
      const v = Wp.rv * S.vk * pose * (1 + Math.min(this.burst, 12) * Wp.climb);
      const h = ((Math.random() * 2 - 1) * Wp.rh + Wp.rb) * S.hk * pose;
      this.pitch = clamp(this.pitch + v * DEG, -1.5, 1.5);
      this.yaw -= h * DEG;
      this.recoilDebt = Math.min(0.35, this.recoilDebt + v * DEG);
      this.bloom = Math.min(6, this.bloom + (Wp.rv + Wp.rh) * 0.25);
      this.kick = Math.min(1.5, 0.6 + Wp.rv * 0.25);
      this.flashT = 0.05;
    } else this.punch = 1;
    sfx.shot(wid, this.heldStats()?.quiet ? 20 : 0, 0);
    // 見た目の弾の線（当たり判定はホスト）
    const muzzle = this.muzzleWorld();
    for (let i = 0; i < Math.min(dirs.length, wid === 5 ? 3 : 1); i++) {
      const d = dirs[i];
      const max = Wp.maxRange;
      let t = this.world.raycast(eye.x, eye.y, eye.z, d[0], d[1], d[2], max);
      let blood = false;
      for (let s = 0; s < MAX_PLAYERS; s++) {
        if (s === this.me) continue;
        const f = this.interp(s, rt);
        if (!f || f.st < 2 || f.st > 4) continue;
        const h = rayPlayer(eye.x, eye.y, eye.z, d[0], d[1], d[2], t, { x: f.x, y: f.y, z: f.z, h: f.fl & 1 ? CROUCH_H : STAND_H });
        if (h && h.t < t) { t = h.t; blood = true; }
      }
      const ex = eye.x + d[0] * t, ey = eye.y + d[1] * t, ez = eye.z + d[2] * t;
      if (wid > 0) this.R.tracer(muzzle.x, muzzle.y, muzzle.z, ex, ey, ez);
      if (t < max) this.R.puff(ex, ey, ez, blood ? "#e0405a" : "#d9c9a3", blood ? 0.6 : 0.35, 0.3);
    }
  }

  muzzleWorld() {
    const c = this.R.camera;
    const v = new THREE.Vector3(0.18, -0.15, -0.8);
    if (this.tpp) v.set(0.3, -0.2, -1.2);
    return v.applyQuaternion(c.quaternion).add(c.position);
  }

  lootTarget() {
    const b = this.body;
    const look = dirFromAngles(this.yaw, this.pitch);
    let best = null, bs = 1e9;
    for (const l of this.loot.values()) {
      const dx = l.x - b.x, dz = l.z - b.z;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
      const d = Math.hypot(dx, dz);
      if (d > 2.6 || Math.abs(l.y - b.y) > 2) continue;
      // 見ている方向に近いものを優先
      const ey = b.y + this.eyeH;
      const vx = l.x - b.x, vy = l.y + 0.3 - ey, vz = l.z - b.z, vl = Math.hypot(vx, vy, vz) || 1;
      const dot = (vx * look[0] + vy * look[1] + vz * look[2]) / vl;
      const s = d - dot * 2;
      if (s < bs) { bs = s; best = l; }
    }
    return best;
  }

  nextSpec(dir) {
    const alive = [];
    const f = this.last?.F || [];
    for (let i = 0; i < MAX_PLAYERS; i++) if (f[i] && f[i][5] >= 2 && f[i][5] <= 4 && i !== this.me) alive.push(i);
    if (!alive.length) { this.spec = -1; return; }
    const i = alive.indexOf(this.spec);
    this.spec = alive[(i + dir + alive.length) % alive.length];
  }

  // ---- 描く ----
  /** 時刻 viewT までの、ほかの人の弾の線と銃声を出す。始まりはその人の見えている銃口 */
  flushTracers(viewT) {
    let n = 0;
    for (const { tm, t } of this.pendingT) {
      if (tm > viewT) break;
      n++;
      this.shotFx(t);
    }
    if (n) this.pendingT.splice(0, n);
  }
  shotFx([slot, w, ox, oy, oz, ex, ey, ez]) {
    const quiet = (w & 16) !== 0, wid = w & 15;
    const m = this.R.muzzleOf(slot);
    if (m) { ox = m.x; oy = m.y; oz = m.z; }
    this.R.tracer(ox, oy, oz, ex, ey, ez, quiet);
    this.R.puff(ex, ey, ez, "#d9c9a3", 0.35, 0.3);
    const d = Math.hypot(ox - this.camPos.x, oz - this.camPos.z);
    sfx.shot(wid, quiet ? d * 4 + 30 : d, this.pan(ox, oz));
  }

  /** キルカメラを終えて、倒した人の観戦に移る */
  endKillcam() {
    if (!this.killcam) return;
    this.spec = this.killcam.killer;
    this.killcam = null;
    this.hud.killcam(null);
  }

  draw(dt, rt) {
    const R = this.R, cam = R.camera, b = this.body;
    // キルカメラ中は、少し前の時刻（倒される 4 秒前から）を再生する。そのあいだに飛んだ弾の線と銃声も
    const kc = this.killcam;
    let viewT = rt;
    this.replayT = [];
    if (kc) {
      viewT = kc.from + (performance.now() - kc.t0);
      if (viewT > kc.to) { this.endKillcam(); viewT = rt; }
      else {
        for (const sn of this.snaps) {
          if (sn.tm <= kc.lastT || sn.tm > viewT) continue;
          for (const t of sn.T || []) this.replayT.push(t);
        }
        kc.lastT = viewT;
      }
    }
    const kcOn = !!this.killcam;
    if (kcOn) this.pendingT.length = 0;
    // 人
    let specF = null;
    for (let s = 0; s < MAX_PLAYERS; s++) {
      const P = this.lobby?.P[s];
      if (!P || !P.k) { R.removePerson(s); continue; }
      if (s === this.me && !kcOn) {
        const show = (this.tpp && this.tppDist > 1.3) || this.st === ST.FALL || this.st === ST.CHUTE || this.st === ST.DEAD;
        const mine = this.last?.F[s];
        const f = { x: b.x, y: b.y, z: b.z, yaw: this.yaw, pitch: this.pitch, st: this.st, hold: this.heldWeapon(), fl: (this.crouch ? 1 : 0) | (this.flashT > 0 ? 32 : 0), eq: mine ? mine[9] : 0 };
        if (this.st === ST.DEAD && mine) { f.x = mine[0]; f.y = mine[1]; f.z = mine[2]; }
        R.updatePerson(s, P.a, this.name(s), f, show, dt, this.camPos);
        continue;
      }
      const f = this.interp(s, viewT);
      if (!f) { R.removePerson(s); continue; }
      if (this.mode === MODE.TEAM) f.tag = this.isCpuTeam(s) ? "#ff7a6a" : "#7fd8ff";   // 敵は赤・味方は水色
      R.updatePerson(s, P.a, this.name(s), f, true, dt, this.camPos);
      if (s === (kcOn ? this.killcam.killer : this.spec)) specF = f;
    }
    for (const t of this.replayT) this.shotFx(t);   // キルカメラの弾の線（人を動かしたあとに、銃口から）
    if (!kcOn) this.flushTracers(viewT);
    // カメラ
    const fovBase = this.settings.fov || 80;
    let zoom = this.currentZoom();
    let view = false;
    cam.rotation.order = "YXZ";
    if (this.st === ST.PLANE) {
      const d = 46;
      const dir = dirFromAngles(this.yaw, this.pitch);
      cam.position.set(b.x - dir[0] * d, PLANE_ALT + 4 - dir[1] * d, b.z - dir[2] * d);
      cam.rotation.set(this.pitch, this.yaw, 0);
    } else if (this.st === ST.FALL || this.st === ST.CHUTE) {
      this.thirdPerson(b.x, b.y + 1.2, b.z, this.yaw, this.pitch, this.st === ST.CHUTE ? 7 : 5);
    } else if (this.st === ST.DEAD && kcOn && specF) {
      // キルカメラ: 倒した人の肩ごし（その人が向いていた方向）
      this.thirdPerson(specF.x, specF.y + (specF.fl & 1 ? 1.25 : 1.55), specF.z, specF.yaw, specF.pitch, 2.3, 0.6);
      this.hud.spectating("");
    } else if (this.st === ST.DEAD) {
      if (this.spec < 0 && Math.random() < 0.02) this.nextSpec(1);
      if (specF) {
        this.thirdPerson(specF.x, specF.y + 1.5, specF.z, specF.yaw, specF.pitch * 0.5, 4);
        this.hud.spectating(this.name(this.spec), Math.ceil(specF.hp));
      } else {
        const mine = this.last?.F[this.me];
        const x = mine ? mine[0] : b.x, y = mine ? mine[1] : b.y, z = mine ? mine[2] : b.z;
        this.thirdPerson(x, y + 1, z, this.yaw, this.pitch - 0.3, 6);
        this.hud.spectating("");
      }
    } else {
      const eye = this.eyePos();
      if (this.tpp) this.thirdPerson(eye.x, eye.y, eye.z, this.yaw, this.pitch, 3.2, 0.65);
      else {
        cam.position.set(eye.x, eye.y, eye.z);
        const sh = (this.shake || 0) * 0.025;
        cam.rotation.set(this.pitch + this.kick * 0.012 + (Math.random() - 0.5) * sh, this.yaw + (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh * 0.6);
        view = true;
      }
    }
    if (this.st !== ST.DEAD) this.hud.spectating("");
    const fov = 2 * Math.atan(Math.tan((fovBase * DEG) / 2) / zoom) / DEG;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 18); if (Math.abs(cam.fov - fov) < 0.05) cam.fov = fov; cam.updateProjectionMatrix(); }
    this.camPos.copy(cam.position);
    // 一人称の銃
    const wid = this.heldWeapon();
    const hs = this.heldStats();
    // スコープの絵に切りかえるのは、拡大がほぼ終わった時（視野角の設定によらず。決まった値とくらべると、広い視野角では
    // いつまでも切りかわらず、一人称のスコープの筒を後ろからのぞいたまま中央が暗くなっていた）
    const scope = !!hs && hs.sight === "scope" && this.ads && cam.fov <= fov * 1.25 + 0.3;
    if (view && !scope) this.viewModel(dt, wid);
    else view = false;
    this.flashT -= dt;
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.5);
    // 体力が少ない: 画面の色が抜ける・縁が赤く脈打つ・心音
    const hp = this.Y && this.st !== ST.DEAD ? this.Y.hp : 100;
    this.hud.lowHp(hp);
    if (hp < 25 && hp > 0) { this.beatT = (this.beatT || 0) - dt; if (this.beatT <= 0) { this.beatT = 0.45 + hp / 40; sfx.heartbeat(); } }
    R.frame(dt, view);
    // 表示
    this.hudFrame(wid, zoom, scope);
  }

  thirdPerson(x, y, z, yaw, pitch, dist, right = 0) {
    const cam = this.R.camera;
    const d = dirFromAngles(yaw, pitch);
    const rx = Math.cos(yaw) * right, rz = -Math.sin(yaw) * right;
    let tx = x - d[0] * dist + rx, ty = y - d[1] * dist + 0.3, tz = z - d[2] * dist + rz;
    const vx = tx - x, vy = ty - y, vz = tz - z, l = Math.hypot(vx, vy, vz);
    const t = this.world.raycast(x, y, z, vx / l, vy / l, vz / l, l);
    this.tppDist = l;
    if (t < l) { const k = Math.max(0.2, t - 0.3) / l; tx = x + vx * k; ty = y + vy * k; tz = z + vz * k; this.tppDist = k * l; }
    cam.position.set(tx, ty, tz);
    cam.rotation.set(pitch, yaw, 0);
  }

  viewModel(dt, wid) {
    const R = this.R, Y = this.Y;
    const m = R.viewModel(wid, wid > 0 && wid !== W_GRENADE ? this.heldAtt() : undefined);
    const b = this.body;
    const hsp = Math.hypot(b.vx, b.vz);
    this.bob = (this.bob || 0) + dt * hsp * 1.6;
    const bobA = b.onGround ? Math.min(1, hsp / 6) : 0;
    const ads = this.ads;
    // のぞきこみ: 銃を下げて、サイトの上端が画面中央のすぐ下に来るようにする（銃で照準が隠れないように。中央には HUD のドット）
    // サイト（照門の上・ドットの窓・スコープの筒）の高さを画面の中心に合わせる
    const tgt = ads ? [0, -(m.userData.sightY ?? 0.1), -0.3] : [0.2, -0.2, -0.38];
    if (wid === 0) { tgt[0] = 0; tgt[1] = -0.17; tgt[2] = -0.5; }
    if (wid === W_GRENADE) { tgt[0] = 0.12; tgt[1] = -0.16; tgt[2] = -0.4; }
    this.vpos = this.vpos || tgt.slice();
    for (let i = 0; i < 3; i++) this.vpos[i] += (tgt[i] - this.vpos[i]) * Math.min(1, dt * 16);
    let [x, y, z] = this.vpos;
    x += Math.cos(this.bob) * 0.012 * bobA * (ads ? 0.2 : 1);
    y += Math.abs(Math.sin(this.bob)) * 0.014 * bobA * (ads ? 0.2 : 1);
    z += this.kick * 0.05 - this.punch * 0.18;
    let rx = this.kick * 0.06, ry = 0, rz = 0;
    if (this.sprinting) { ry = 0.6; rx = -0.25; x -= 0.05; y -= 0.04; }
    if (Y && Y.act === 1) { const p = Y.actP; const k = Math.sin(Math.min(1, p) * Math.PI); y -= k * 0.16; rx -= k * 0.6; rz = k * 0.4; }
    if (Y && Y.act >= 2) { y -= 0.3; }
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    R.flash.visible = this.flashT > 0 && wid > 0 && wid !== W_GRENADE;
    if (R.flash.visible) {
      R.flash.position.copy(m.userData.muzzle).applyEuler(m.rotation).add(m.position);
      R.flash.material.rotation = Math.random() * 6;
    }
  }

  hudFrame(wid, zoom, scope) {
    const Y = this.Y, L = this.last, H = this.hud, b = this.body;
    if (Y && L) {
      H.stats({
        hp: Y.hp, boost: Y.boost, helmet: Y.helmet, vest: Y.vest, pack: Y.pack,
        w: [Y.w1, Y.w2], mag: [this.hand === 0 ? this.predMag() : Y.m1, this.hand === 1 ? this.predMag() : Y.m2],
        ammo: [Y.a0, Y.a1, Y.a2, Y.a3], heals: [Y.h0, Y.h1, Y.h2], gren: Y.gren, hand: this.hand, det: Y.det, detT: Y.detT,
        act: Y.act, actP: Y.actP, alive: L.al, kills: Y.kills, teams: this.mode === MODE.TEAM ? this.teamCounts() : null,
      });
      const Z = L.Z;
      const inZone = this.st !== ST.GROUND || Math.hypot(b.x - Z[0], b.z - Z[1]) <= Z[2];
      H.zone(Z, inZone || this.st === ST.DEAD);
    }
    // 照準の広がり
    let gap = 6;
    if (wid > 0 && wid !== W_GRENADE) {
      const Wp = WEAPONS[wid];
      const sp = (this.ads ? Wp.ads : Wp.hip) + Math.min(1, Math.hypot(b.vx, b.vz) / 6) * Wp.hip * 0.5 + this.bloom;
      gap = 3 + (Math.tan(sp * DEG) / Math.tan((this.R.camera.fov * DEG) / 2)) * (innerHeight / 2);
    }
    // 照準: 腰だめは広がる十字 / のぞきこみはアイアン（照星）・レッドドット（赤い点）・スコープ（倍率ごとの十字線）
    const hs = this.heldStats();
    const sight = this.st !== ST.GROUND || !this.ads || this.tpp || !hs ? "" : scope ? "scope" + hs.zoom : hs.sight;
    H.crosshair(Math.min(gap, 120), this.st === ST.GROUND && !this.ads && wid !== W_GRENADE, sight);
    H.compass(this.yaw);
    const st = {
      me: this.st === ST.DEAD ? null : { x: b.x, z: b.z, yaw: this.yaw },
      Z: L?.Z, PL: L?.PL, plane: this.st <= ST.PLANE ? this.planeLine : null,
      roads: this.world.roads,
      drops: (this.drops || []).map(d => ({ x: d[1], z: d[3], landed: d[4] })),
      marks: (this.detected || []).map(([slot, x, z]) => ({ x, z, c: "#ff3b3b", label: this.name(slot) })),
    };
    H.minimap(st.me ? st : { ...st, me: { x: b.x, z: b.z, yaw: this.yaw } });
    H.bigmap(st, this.showMap);
    this.menu.update(this.menuOpen, this.Y, this.hand);
  }

  /** チーム戦: 生きている人間と CPU の数 */
  teamCounts() {
    let h = 0, z = 0;
    (this.last?.F || []).forEach((f, i) => { if (f && f[5] >= ST.PLANE && f[5] <= ST.GROUND) { if (this.isCpuTeam(i)) z++; else h++; } });
    return [h, z];
  }

  dispose() {
    sfx.loop("plane", 0); sfx.loop("wind", 0);
    for (let s = 0; s < MAX_PLAYERS; s++) this.R.removePerson(s);
    this.R.setGrenades([]);
    this.R.setTrajectory(null);
    this.R.clearDrops();
    this.hud.death(null);
    this.hud.killcam(null);
    this.menu.update(false);
  }
}

function toF(a) {
  return { x: a[0], y: a[1], z: a[2], yaw: a[3], pitch: a[4], st: a[5], hp: a[6], hold: a[7], fl: a[8], eq: a[9] };
}

