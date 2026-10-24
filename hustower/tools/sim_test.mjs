// ヘッドレスで積み上げをシミュレーションし、物理の安定性を確認する。
//   node tools/sim_test.mjs [試行数] [1試行あたりの最大ピース数]
// プレイヤーは置く前に候補（角度×位置）を試し、一番安定するものを選ぶ。
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Physics, buildStickerDefs, STEP } from "../js/physics.js";

const require = createRequire(import.meta.url);
const planck = require("../vendor/planck.min.js");
const defs = buildStickerDefs(JSON.parse(readFileSync(new URL("../data/shapes.json", import.meta.url), "utf8")));

const trials = Number(process.argv[2] ?? 8);
const maxPieces = Number(process.argv[3] ?? 25);
const SETTLE_TIMEOUT = 10;
const ANGLES = [0, 0.5, 1, 1.5].map(k => k * Math.PI);
const OFFSETS = [-0.3, -0.15, 0, 0.15, 0.3];

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function snapshot(phys) {
  return phys.pieces.map(({ body }) => ({
    body, p: body.getPosition().clone(), a: body.getAngle(),
    v: body.getLinearVelocity().clone(), w: body.getAngularVelocity(), awake: body.isAwake(),
  }));
}

function restore(phys, snap) {
  phys.pieces.length = snap.length;
  for (const s of snap) {
    s.body.setTransform(s.p, s.a);
    s.body.setLinearVelocity(s.v);
    s.body.setAngularVelocity(s.w);
    s.body.setAwake(s.awake);
  }
}

/** 落としてから静止までシミュレーションする。返り値は経過秒（タイムアウト時は SETTLE_TIMEOUT）。 */
function settle(phys, limit = SETTLE_TIMEOUT) {
  let time = 0;
  while (!phys.settled && time < limit && !phys.fallen()) { phys.stepOnce(); time += STEP; }
  return time;
}

function choose(phys, def) {
  const base = phys.pieces.at(-1)?.body.getWorldCenter().x ?? 0;
  const snap = snapshot(phys);
  let best = null;
  for (const angle of ANGLES) for (const off of OFFSETS) {
    const x = Math.max(-1, Math.min(1, base + off));
    const piece = phys.drop(def, x, phys.towerTop() + def.radius + 0.3, angle);
    const time = settle(phys, 4);
    let cost = phys.fallen() || !phys.settled ? Infinity : 0;
    // 既存ピースが動いた量 + 新ピースが置いてから回った量 = 不安定さ
    for (const s of snap) cost += s.body.getPosition().clone().sub(s.p).length() + Math.abs(s.body.getAngle() - s.a);
    cost += Math.abs(piece.body.getAngle() - angle) + time * 0.05;
    phys.world.destroyBody(piece.body);
    restore(phys, snap);
    if (!best || cost < best.cost) best = { cost, x, angle };
  }
  return best;
}

let totalPieces = 0, timeouts = 0, settleSum = 0, settleMax = 0, drops = 0;
const t0 = performance.now();

for (let t = 0; t < trials; t++) {
  const rand = rng(t + 1);
  const phys = new Physics(planck);
  let placed = 0, reason = `${maxPieces}個到達`;
  for (let i = 0; i < maxPieces; i++) {
    const def = defs[Math.floor(rand() * defs.length)];
    const { x, angle, cost } = choose(phys, def);
    if (process.env.VERBOSE) console.log(`  #${i} def=${def.id} x=${x.toFixed(2)} ang=${(angle * 180 / Math.PI).toFixed(0)} cost=${cost.toFixed(3)}`);
    phys.drop(def, x, phys.towerTop() + def.radius + 0.3, angle);
    const time = settle(phys);
    drops++;
    if (time >= SETTLE_TIMEOUT) timeouts++;
    settleSum += time; settleMax = Math.max(settleMax, time);
    if (phys.fallen()) { reason = "落下"; break; }
    placed++;
  }
  totalPieces += placed;

  // 静止後の「じわじわ動き（クリープ・振動）」を、落ちていないピースについて測る
  const alive = phys.pieces.filter(({ body }) => body.getPosition().y > -1);
  const before = alive.map(({ body }) => ({ p: body.getPosition().clone(), a: body.getAngle() }));
  for (let k = 0; k < 10 / STEP; k++) phys.stepOnce();
  let drift = 0, rot = 0;
  alive.forEach(({ body }, i) => {
    drift = Math.max(drift, body.getPosition().clone().sub(before[i].p).length());
    rot = Math.max(rot, Math.abs(body.getAngle() - before[i].a));
  });
  const awake = alive.filter(({ body }) => body.isAwake()).length;
  console.log(`trial ${String(t).padStart(2)}: ${String(placed).padStart(2)}個 (${reason}) 高さ ${phys.towerTop().toFixed(2)}m ` +
    `| 10秒放置: 最大移動 ${(drift * 100).toFixed(2)}cm 最大回転 ${(rot * 180 / Math.PI).toFixed(2)}° 起きている ${awake}/${alive.length}`);
}

const ms = performance.now() - t0;
console.log(`\n平均 ${(totalPieces / trials).toFixed(1)}個 / 静止待ち 平均 ${(settleSum / drops).toFixed(2)}s 最大 ${settleMax.toFixed(2)}s ` +
  `/ タイムアウト ${timeouts} / 所要 ${(ms / 1000).toFixed(1)}s`);
