// CPU。ホストの上で動き、人と同じ fire / action / pick / throwGrenade を使う（ずるはしない。見えない相手は撃たない）。
// 考えること（0.25 秒ごと）:
//   1. 安全地帯: 「次の安全地帯まで走ってかかる時間」と「残り時間」をくらべて、間に合わなくなる前に動き出す。
//      地帯の外にいる時は、撃ち合い中でも中へ向かいながら撃つ。回復は走りながら（ドリンク優先）
//   2. 見える敵 → 撃ち合い。少し前に見えていた敵が隠れたらグレネードを投げこむ
//   3. 体力が少ない → 回復 / 弾が少ない → 装填
//   4. 欲しいもの（武器・弾・回復・装備・補給物資の探知機）を拾いに行く。地帯が迫っている時は、次の地帯の中のものだけ
//   5. それ以外 → 次の安全地帯の中の建物をめざしてうろうろ
// 歩く道は nav.js の道さがし（扉を通って家に入る・壁や木をよける）。2 階と見張り台は階段の点をたどる。
// 引っかかったら道をさがし直し、何度もだめなら目的をあきらめる。

import { WEAPONS, HEALS, IT, itemInfo, caps, GRENADE, DETECT } from "./items.js";
import { AC, ST } from "./protocol.js";
import { GRAVITY, STAND_H, PAD_JUMP } from "./world.js";
import { dirFromAngles, wrapAngle, clamp } from "./util.js";

const TIER = [0, 1, 2.5, 4, 4.2, 3, 4, 4.5, 4.3];
const RUN = 6.3, WALK = 5.2;
const now = () => performance.now();

export function newBotBrain() {
  return {
    jumpAt: 0.15 + Math.random() * 0.55, land: null,
    legs: [], wp: [], goal: null, think: Math.random() * 0.25,
    enemy: null, visible: false, seenT: -9, last: null, react: 0, strafe: 1, strafeT: 0,
    stuckT: 0, lx: 0, lz: 0, detour: 0, dx: 0, dz: 0, fails: 0, bad: new Set(),
    hurt: null, skill: 0.018 + Math.random() * 0.022, kills: 0, urgent: false, grenT: 0, hunt: null,
  };
}

export function updateBot(p, sim, dt) {
  const B = p.brain, W = sim.world;
  if (p.dummy) { dummyStep(p, sim); return; }
  switch (p.st) {
    case ST.PLANE: {
      if (sim.plane.d / sim.plane.len >= B.jumpAt && sim.planeOverMap()) {
        sim.jump(p);
        // 飛行機の近くで、次の安全地帯の中の建物をめざす
        const Z = sim.zone;
        const cand = W.buildings.filter(b => b.spots.length && !b.tower
          && Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.z0 + b.z1) / 2 - p.z) < 260
          && Math.hypot((b.x0 + b.x1) / 2 - Z.nx, (b.z0 + b.z1) / 2 - Z.nz) < Z.nr + 40);
        const b = cand.length ? cand[(Math.random() * cand.length) | 0] : null;
        B.land = b ? { x: (b.doors[0]?.ox ?? (b.x0 + b.x1) / 2), z: (b.doors[0]?.oz ?? (b.z0 + b.z1) / 2) } : { x: Z.nx, z: Z.nz };
      }
      return;
    }
    case ST.FALL: case ST.CHUTE: {
      const g = W.groundAt(p.x, p.z, p.y);
      const tx = B.land ? B.land.x - p.x : 0, tz = B.land ? B.land.z - p.z : 0, d = Math.hypot(tx, tz) || 1;
      const hs = p.st === ST.FALL ? 24 : 9;
      const sp = Math.min(hs, d * 2);
      p.x += (tx / d) * sp * dt; p.z += (tz / d) * sp * dt;
      p.y -= (p.st === ST.FALL ? 34 : 5.5) * dt;
      p.yaw = Math.atan2(-tx, -tz);
      if (p.st === ST.FALL && p.y - g < 90) p.st = ST.CHUTE;
      if (p.y <= g) { p.y = g; p.st = ST.GROUND; p.vx = p.vy = p.vz = 0; p.onGround = true; }
      return;
    }
    case ST.GROUND: ground(p, sim, dt); return;
  }
}

const eye = p => p.y + 1.6;

function ground(p, sim, dt) {
  const B = p.brain, W = sim.world;
  B.think -= dt;
  if (p.kills > B.kills) {
    B.kills = p.kills;
    if (Math.random() < 0.5) sim.action(p, AC.STAMP, Math.random() < 0.5 ? 4 : 0);   // おまえもな！ / 働け！
  }
  if (B.think <= 0) { B.think = 0.25; decide(p, sim); }

  let mvx = 0, mvz = 0, speed = WALK;
  const E = B.enemy;
  const fighting = E && E.st >= ST.FALL && E.st <= ST.GROUND;
  if (fighting) {
    // ねらう（体の向きと、歩く向きは別）
    const ex = E.x - p.x, ez = E.z - p.z, ey = E.y + (E.h ?? STAND_H) * 0.7 - eye(p);
    const dist = Math.hypot(ex, ez);
    const wantYaw = Math.atan2(-ex, -ez), wantPitch = Math.atan2(ey, dist);
    const turn = 5 * dt;
    p.yaw += clamp(wrapAngle(wantYaw - p.yaw), -turn, turn);
    p.pitch += clamp(wantPitch - p.pitch, -turn, turn);
    const err = Math.abs(wrapAngle(wantYaw - p.yaw)) + Math.abs(wantPitch - p.pitch);
    const wid = p.hand <= 1 ? p.w[p.hand] : p.hand === 2 ? 0 : -1;
    const Wp = WEAPONS[Math.max(0, wid)];
    B.strafeT -= dt;
    if (B.strafeT <= 0) { B.strafe = Math.random() < 0.5 ? -1 : 1; B.strafeT = 0.6 + Math.random() * 1.4; }
    const fx = ex / (dist || 1), fz = ez / (dist || 1);
    if (B.urgent && B.legs.length) {
      // 地帯へ向かいながら撃つ
      const [tx, tz] = follow(p, sim);
      mvx = tx + -fz * B.strafe * 0.25; mvz = tz + fx * B.strafe * 0.25;
      speed = RUN;
    } else {
      const want = wid === 0 ? 1.2 : Math.min(Wp.range * 0.8, 40);
      const fw = wid === 0 ? 1 : dist > want + 4 ? 1 : dist < want * 0.4 ? -0.6 : 0;
      const sf = wid === 0 ? 0.25 : 0.8;
      mvx = fx * fw + -fz * B.strafe * sf; mvz = fz * fw + fx * B.strafe * sf;
      speed = wid === 0 ? RUN : 4.2;
    }
    // 撃つ
    B.react -= dt;
    if (B.visible && B.react <= 0 && err < 0.04 && wid >= 0 && dist <= Wp.maxRange) {
      if (wid > 0 && p.m[p.hand] <= 0) {
        if (!p.act) sim.action(p, AC.RELOAD, 0);
      } else {
        const dirs = [];
        const moving = Math.hypot(mvx, mvz) > 0.1;
        const spread = B.skill + (Wp.hip * (moving ? 0.6 : 0.35) * Math.PI) / 180 + Math.min(0.03, dist / 4000);
        for (let i = 0; i < Wp.pellets; i++) dirs.push(dirFromAngles(p.yaw + gauss() * spread, p.pitch + gauss() * spread * 0.8));
        if (sim.fire(p, wid, p.x, eye(p), p.z, dirs, now()) && !Wp.auto) B.react = 0.12 + Math.random() * 0.3;
      }
    }
    // グレネード（持ちかえは decide がする）
    if (p.hand === 3 && B.throwAt) {
      const v = B.throwAt;
      B.throwAt = null;
      sim.throwGrenade(p, [p.x, eye(p), p.z], v);
      B.grenT = sim.time;
    }
  } else if (B.legs.length) {
    const [tx, tz] = follow(p, sim);
    mvx = tx; mvz = tz;
    if (Math.hypot(tx, tz) > 0.01) p.yaw += clamp(wrapAngle(Math.atan2(-tx, -tz) - p.yaw), -6 * dt, 6 * dt);
    p.pitch *= 0.9;
    speed = B.urgent || B.goal?.run ? RUN : WALK;
  }
  if (p.act >= 2) speed *= 0.5;
  // 引っかかったら: 道をさがし直す → 横へよける → あきらめる
  if (B.detour > 0) { B.detour -= dt; mvx = B.dx; mvz = B.dz; }
  const moving = Math.hypot(mvx, mvz) > 0.1;
  B.stuckT += dt;
  if (B.stuckT > 0.8) {
    const moved = Math.hypot(p.x - B.lx, p.z - B.lz);
    const wantsToGo = moving || (B.legs.length && !fighting && !(p.act >= 2));
    if (wantsToGo && moved < 0.5 && B.detour <= 0) {
      B.fails++;
      B.wp = [];
      if (B.fails >= 2) {
        const a = Math.random() * Math.PI * 2;
        B.dx = Math.cos(a); B.dz = Math.sin(a); B.detour = 0.5;
        if (p.onGround && Math.random() < 0.5) p.vy = 6.5;
      }
      // 3 回だめなら今いる場所（何階か）から道を作り直す。それを 2 回やってもだめならあきらめる
      if (B.fails >= 3 && B.goal) {
        const g = B.goal;
        g.replans = (g.replans || 0) + 1;
        if (g.replans > 2) { if (g.loot !== undefined) B.bad.add(g.loot); dropGoal(B); }
        else setGoal(p, sim, g);
      }
    } else if (moved >= 0.5) B.fails = 0;
    B.stuckT = 0; B.lx = p.x; B.lz = p.z;
  }
  const l = Math.hypot(mvx, mvz);
  if (l > 0.01) { p.vx = (mvx / l) * speed; p.vz = (mvz / l) * speed; } else { p.vx = 0; p.vz = 0; }
  p.vy -= GRAVITY * dt;
  p.h = STAND_H;
  W.moveBody(p, dt);
  W.unstick(p);   // 壁などに埋まったら近くの空いている所へ
  if (p.onPad) p.vy = PAD_JUMP;
  p.fl = l > 0.01 && speed > 6 ? 4 : 0;
}

/** いまの道の次の点へ向かう向き（[dx, dz]）。着いたら次へ。最後まで着いたら目的を果たす */
function follow(p, sim) {
  const B = p.brain;
  const leg = B.legs[0];
  if (!leg) return [0, 0];
  const last = B.legs.length === 1;
  if (leg.nav && !leg.direct && !B.wp.length) {
    const dl = Math.hypot(leg.x - p.x, leg.z - p.z);
    if (dl > legReach(B, last)) {
      B.wp = sim.nav.findPath(p.x, p.z, leg.x, leg.z);
      // 目的地が地図の上で通れないマス（階段のすぐ下など）で、道が進まない時は、そこからはまっすぐ歩く
      const e = B.wp[B.wp.length - 1];
      if (!e || Math.hypot(e[0] - p.x, e[1] - p.z) < 0.8) { leg.direct = true; B.wp = []; }
    }
  }
  const useWp = leg.nav && !leg.direct && B.wp.length;
  const t = useWp ? B.wp[0] : [leg.x, leg.z];
  const dx = t[0] - p.x, dz = t[1] - p.z, d = Math.hypot(dx, dz);
  const isWp = useWp;
  const reach = isWp ? (B.wp.length > 1 ? 0.5 : Math.min(0.6, legReach(B, last))) : legReach(B, last);
  if (d < reach || (isWp && B.wp.length === 1 && Math.hypot(leg.x - p.x, leg.z - p.z) < legReach(B, last))) {
    if (isWp) B.wp.shift();
    if (!isWp || (!B.wp.length && Math.hypot(leg.x - p.x, leg.z - p.z) < legReach(B, last) + 0.3)) {
      B.legs.shift(); B.wp = [];
      if (!B.legs.length) arrive(p, sim);
    }
    return [0, 0];
  }
  return [dx / d, dz / d];
}

function legReach(B, last) {
  if (!last) return 0.6;
  if (B.goal?.loot !== undefined) return 1.6;
  return B.goal?.zone ? 4 : 2.5;
}

function arrive(p, sim) {
  const B = p.brain;
  const g = B.goal;
  if (g?.loot !== undefined) {
    // 武器が 2 つ埋まっていたら、弱い方に持ち替えてから拾う（拾うと手に持っている方と入れ替わる）
    const l = sim.loot.get(g.loot);
    if (l && l.code < IT.AMMO && p.w[0] && p.w[1]) {
      const worst = TIER[p.w[0]] <= TIER[p.w[1]] ? 0 : 1;
      if (p.hand !== worst) sim.action(p, AC.HAND, worst);
    }
    sim.pick(p, g.loot);
    B.bad.add(g.loot);
  }
  dropGoal(B);
  B.think = 0;
}

function dropGoal(B) { B.goal = null; B.legs = []; B.wp = []; B.fails = 0; }

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.15; }

/** 安全地帯の状況。urgent: 今すぐ動く / soon: 地帯の外のものは拾わない */
function zoneNeed(p, sim) {
  const Z = sim.zone;
  const final = sim.zoneFinal;
  const inCur = Math.hypot(p.x - Z.cx, p.z - Z.cz) < Z.r - 6;
  const nr = final ? Z.r : Z.nr;
  const nx = final ? Z.cx : Z.nx, nz = final ? Z.cz : Z.nz;
  const need = Math.max(0, Math.hypot(p.x - nx, p.z - nz) - nr * 0.7);
  const timeNeed = need / 5 + 8;   // 道は曲がるので少し遅めに見積もる
  const avail = final ? 0 : Z.shrinking ? Z.left * 0.6 : Z.left + 20;
  return { urgent: !inCur || (need > 0 && timeNeed > avail - 10), soon: need > 0 && timeNeed > avail - 45, nx, nz, nr };
}

/** 射撃訓練場の的: その場に立つか、左右にゆっくり動く。いつも自分の方を向く */
function dummyStep(p, sim) {
  const d = p.dummy;
  if (d.moving) {
    const k = Math.sin(sim.time * 0.7 + d.ph) * 4;
    p.x = d.x + d.side * k; p.z = d.z + d.sz * k;
    p.y = sim.world.groundAt(p.x, p.z, p.y + 1);
  }
  const me = sim.players.find(q => q && !q.bot);
  if (me) p.yaw = Math.atan2(-(me.x - p.x), -(me.z - p.z));
}

function decide(p, sim) {
  const B = p.brain, W = sim.world;
  // 敵をさがす（見えるか）
  let best = null, bd = 1e9;
  for (const q of sim.players) {
    if (!q || q === p || q.st < ST.FALL || q.st > ST.GROUND) continue;
    if (sim.team(p) && sim.team(q) === sim.team(p)) continue;   // チーム戦では味方を狙わない
    const d = Math.hypot(q.x - p.x, q.z - p.z, q.y - p.y);
    if (d > 160 || d > bd) continue;
    if (!W.visible(p.x, eye(p), p.z, q.x, q.y + 1.2, q.z)) continue;
    best = q; bd = d;
  }
  const hurt = B.hurt && sim.time - B.hurt.t < 3 ? B.hurt : null;
  B.visible = !!best;
  if (best) {
    if (B.enemy !== best) B.react = 0.3 + Math.random() * 0.45 + bd / 220;
    B.enemy = best; B.seenT = sim.time;
    B.last = { x: best.x, y: best.y, z: best.z };
  } else if (hurt?.by && hurt.by.st <= ST.GROUND && hurt.by !== p && !(sim.team(p) && sim.team(hurt.by) === sim.team(p))) {
    B.enemy = hurt.by;   // 撃たれた方を向く（見えるまでは撃たない）
  } else if (B.enemy && sim.time - B.seenT > 5) B.enemy = null;
  if (B.enemy && B.enemy.st === ST.DEAD) B.enemy = null;

  const Zn = zoneNeed(p, sim);
  B.urgent = Zn.urgent;

  // 持つもの
  const dist = B.enemy ? Math.hypot(B.enemy.x - p.x, B.enemy.z - p.z) : 50;
  let slot = bestSlot(p, dist);
  if (slot === 2 && B.enemy && dist > 12) B.enemy = null;   // 素手なら、すぐ近くの相手以外はほうっておいて武器を探す

  // 隠れた敵にグレネード
  if (B.enemy && !B.visible && B.last && p.gren > 0 && sim.time - B.seenT > 0.8 && sim.time - B.seenT < 5 && sim.time - B.grenT > 6) {
    const v = grenadeVel(p, B.last);
    if (v) { slot = 3; B.throwAt = v; }
  }
  if (slot !== p.hand && !(p.act >= 2)) sim.action(p, AC.HAND, slot);

  // 地帯へ（撃ち合い中でも道は作っておく）
  if (B.urgent) {
    // 段階が変わった・目的地が次の地帯の外になった → 選び直す（古い目的地へ走って外に出ないように）
    const g = B.goal;
    if (!g || !g.zone || g.stage !== sim.zone.stage || Math.hypot(g.x - Zn.nx, g.z - Zn.nz) > Zn.nr * 0.8) {
      setGoal(p, sim, { ...zonePoint(sim, Zn), zone: true, run: true, stage: sim.zone.stage });
    }
  }
  // 回復: 地帯の外ではドリンクを走りながら、ほかは安全な時だけ
  if (!p.act) {
    if (B.urgent && p.hp < 80 && p.heals[2] > 0 && p.boost < 60) sim.action(p, AC.HEAL, 2);
    else if (!B.enemy && !hurt && !B.urgent && p.hp < 75) {
      for (const h of [1, 0, 2]) if (p.heals[h] > 0 && (h === 2 ? p.boost < 60 : p.hp < HEALS[h].upto)) { sim.action(p, AC.HEAL, h); break; }
    } else if (!B.enemy && !B.urgent && p.boost < 40 && p.heals[2] > 1) sim.action(p, AC.HEAL, 2);
  }
  // 探知機: 敵が見えない時に使って、いちばん近い敵の方へ
  if (p.det > 0 && !B.enemy && !B.urgent && sim.time >= p.detUntil && Math.random() < 0.1) {
    sim.action(p, AC.DETECT, 0);
    let near = null, nd = 1e9;
    for (const q of sim.players) if (q && q !== p && q.st >= ST.FALL && q.st <= ST.GROUND) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < nd) { nd = d; near = q; } }
    if (near && nd < 150) setGoal(p, sim, { x: near.x, z: near.z, hunt: true, run: true });
  }
  if (B.enemy || B.urgent) return;
  if (p.act >= 2) return;
  // 装填
  if (!p.act && p.hand <= 1 && p.w[p.hand]) {
    const Wd = WEAPONS[p.w[p.hand]];
    if (p.m[p.hand] < Wd.mag * 0.5 && p.ammo[Wd.ammo] > 0) sim.action(p, AC.RELOAD, 0);
  }
  if (B.goal && B.goal.loot !== undefined && !sim.loot.has(B.goal.loot)) dropGoal(B);
  if (B.goal && B.goal.zone) dropGoal(B);   // もう急がなくてよい
  if (B.goal && !B.goal.wander) return;
  // 拾いに行く
  let pick = null, ps = 1e9;
  const C = caps(p.pack);
  for (const l of sim.loot.values()) {
    if (B.bad.has(l.id)) continue;
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    const isDet = l.code === IT.DETECT;
    if (d > (isDet ? 90 : 45)) continue;
    if (Zn.soon && Math.hypot(l.x - Zn.nx, l.z - Zn.nz) > Zn.nr * 0.85) continue;
    if (!reachable(sim, l)) { B.bad.add(l.id); continue; }
    const v = want(p, l, C);
    if (v <= 0) continue;
    const s = d - v * 12 + Math.abs(l.y - p.y) * 2;
    if (s < ps) { ps = s; pick = l; }
  }
  if (pick) { setGoal(p, sim, { x: pick.x, z: pick.z, y: pick.y, loot: pick.id, b: pick.b }); return; }
  // うろうろ（次の安全地帯の中の建物か、適当な場所）
  if (!B.goal) {
    const cand = W.buildings.filter(b => b.spots.length && !b.solid && Math.hypot((b.x0 + b.x1) / 2 - Zn.nx, (b.z0 + b.z1) / 2 - Zn.nz) < Zn.nr * 0.85);
    if (cand.length && Math.random() < 0.6) {
      const b = cand[(Math.random() * cand.length) | 0];
      const sp = b.spots[(Math.random() * b.spots.length) | 0];
      setGoal(p, sim, { x: sp.x, z: sp.z, y: sp.y, b: W.buildings.indexOf(b), wander: true });
    } else setGoal(p, sim, { ...zonePoint(sim, Zn), wander: true });
  }
}

/** 次の安全地帯の中の、陸で歩ける点 */
function zonePoint(sim, Zn) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * Zn.nr * 0.5;
    const x = Zn.nx + Math.cos(a) * r, z = Zn.nz + Math.sin(a) * r;
    if (sim.world.heightAt(x, z) > 0.8 && sim.nav.freeAt(x, z)) return { x, z };
  }
  return { x: Zn.nx, z: Zn.nz };
}

/** 拾いに行けるところにあるか（階段のない高い所のものはあきらめる） */
function reachable(sim, l) {
  const W = sim.world;
  const g = W.heightAt(l.x, l.z);
  if (l.y - g < 2.5) return true;
  const b = W.buildings[l.b];
  return !!(b && b.stairs);
}

/** 届く角度で投げる速さ（届かなければ null） */
function grenadeVel(p, t) {
  const dx = t.x - p.x, dz = t.z - p.z, R = Math.hypot(dx, dz);
  if (R < 8 || R > 34) return null;
  const v = GRENADE.speed, g = 16, h = t.y + 0.5 - eye(p);
  const disc = v ** 4 - g * (g * R * R + 2 * h * v * v);
  if (disc < 0) return null;
  const th = Math.atan((v * v - Math.sqrt(disc)) / (g * R));
  const c = Math.cos(th);
  return [(dx / R) * v * c, v * Math.sin(th), (dz / R) * v * c];
}

function bestSlot(p, dist) {
  let best = 2, bs = 0.5;
  for (let s = 0; s < 2; s++) {
    const id = p.w[s];
    if (!id) continue;
    const Wd = WEAPONS[id];
    if (p.m[s] + p.ammo[Wd.ammo] <= 0) continue;
    let sc = TIER[id];
    if (dist > Wd.range * 2) sc *= 0.6;
    if (id === 5 && dist < 15) sc += 3;
    if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}

function want(p, l, C) {
  const it = itemInfo(l.code);
  switch (it.kind) {
    case "weapon": {
      if (!p.w[0] || !p.w[1]) return 3 + TIER[it.sub];
      const worst = Math.min(TIER[p.w[0]], TIER[p.w[1]]);
      return TIER[it.sub] > worst + 0.5 ? TIER[it.sub] - worst : 0;
    }
    case "ammo": {
      const uses = [p.w[0], p.w[1]].some(id => id && WEAPONS[id].ammo === it.sub);
      return uses && p.ammo[it.sub] < C.ammo * 0.7 ? 2.5 : 0;
    }
    case "heal": return p.heals[it.sub] < C.heal[it.sub] ? (it.sub === 1 ? 2.5 : 1.2) : 0;
    case "grenade": return p.gren < C.gren ? 0.8 : 0;
    case "detect": return p.det < DETECT.max ? 5 : 0;
    case "helmet": return it.sub > p.helmet ? 2 + it.sub : 0;
    case "vest": return it.sub > p.vest ? 2 + it.sub : 0;
    case "pack": return it.sub > p.pack ? 1 + it.sub : 0;
  }
  return 0;
}

/** 目的地までの区間を作る（nav: 道さがしで歩く / そうでなければまっすぐ。階段はまっすぐ） */
function setGoal(p, sim, goal) {
  const B = p.brain, W = sim.world;
  const legs = [];
  const upIn = bi => { const b = W.buildings[bi]; return b && b.stairs && b.floor2 ? b : null; };
  // いま 2 階・見張り台の上にいるか
  const cb = W.buildingAt(p.x, p.z);
  const cbB = upIn(cb);
  const meUp = cbB && p.y > cbB.floor2 - 1.2;
  const tb = goal.b ?? W.buildingAt(goal.x, goal.z);
  const tbB = upIn(tb);
  const goalUp = tbB && goal.y !== undefined && goal.y > tbB.floor2 - 1.2;
  if (meUp && !(goalUp && cb === tb)) for (const [x, z] of cbB.stairs.slice().reverse()) legs.push({ nav: false, x, z });
  if (goalUp && !(meUp && cb === tb)) {
    // 階段の下の点は壁に近く、道さがしの地図では通れないマスのことがあるので、建物の中の近くの歩けるマスを経由する
    const [s0, ...rest] = tbB.stairs;
    const [ax, az] = tbB.tower ? s0 : sim.nav.snapInside(s0[0], s0[1], tbB);
    legs.push({ nav: true, x: ax, z: az });
    for (const [x, z] of [s0, ...rest]) legs.push({ nav: false, x, z });
  }
  legs.push({ nav: !goalUp, x: goal.x, z: goal.z });
  B.goal = goal;
  B.legs = legs;
  B.wp = [];
  B.fails = 0;
}
