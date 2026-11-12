// バランスの計測: つよい CPU どうしを、ランダムな技の組み合わせで何千試合も戦わせ、技ごとの勝率などを出す
//   node tools/balance.mjs [試合数] [出力 JSON]
import { writeFileSync } from "node:fs";
import { SELECTABLE } from "../js/moves.js";
import { Sim, cpuInput, EMPTY_INPUT } from "../js/sim.js";
const N = Number(process.argv[2] || 2000);
const out = process.argv[3];
const ids = SELECTABLE.map(m => m.id);
const st = Object.fromEntries(ids.map(id => [id, { n: 0, w: 0, dmg: 0, ko: 0, hits: 0 }]));
const pick4 = () => { const s = new Set(); while (s.size < 4) s.add(ids[Math.floor(Math.random() * ids.length)]); return [...s]; };
let draws = 0, frames = 0, sds = 0, kos = 0;
for (let g = 0; g < N; g++) {
  const L = [pick4(), pick4()];
  const sim = new Sim(L.map((loadout, slot) => ({ slot, name: "c" + slot, loadout, cpu: true, level: 3 })), { stocks: 2 });
  let f = 0;
  while (sim.phase !== "result" && f < 60 * 240) { sim.step([cpuInput(sim.fighters[0], sim), cpuInput(sim.fighters[1], sim), EMPTY_INPUT, EMPTY_INPUT]); f++; }
  frames += f;
  const R = sim.phase === "result" ? sim.ranking() : null;
  if (!R) draws++;
  sim.fighters.slice(0, 2).forEach((F, i) => {
    sds += F.stats.sds; kos += F.stats.kos;
    F.loadout.forEach((id, k) => {
      const s = st[id];
      s.n++; if (R && R[0] === i) s.w++;
      s.hits += F.stats.mv[k][0]; s.dmg += F.stats.mv[k][1]; s.ko += F.stats.mv[k][2];
    });
  });
}
const rows = ids.map(id => ({ id, ...st[id], wr: st[id].w / Math.max(1, st[id].n) })).sort((a, b) => b.wr - a.wr);
console.log(`games ${N} draws ${draws} avg ${(frames / N / 60).toFixed(1)}s  kos ${kos} selfdestructs ${sds}`);
const fmt = r => `${r.id.padEnd(16)} wr ${(r.wr * 100).toFixed(0).padStart(3)}%  n ${String(r.n).padStart(4)}  dmg/g ${(r.dmg / r.n).toFixed(1).padStart(5)}  ko/g ${(r.ko / r.n).toFixed(2)}`;
console.log("--- top"); rows.slice(0, 25).forEach(r => console.log(fmt(r)));
console.log("--- bottom"); rows.slice(-25).forEach(r => console.log(fmt(r)));
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
