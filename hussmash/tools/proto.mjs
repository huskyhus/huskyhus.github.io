// スナップショットと予測用の状態が、通信の検査（protocol.js）を通るか・上限の文字数に収まるか
import { SELECTABLE } from "../js/moves.js";
import { Sim, cpuInput, fighterState, EMPTY_INPUT } from "../js/sim.js";
import { checkFromHost, parse, MAX_FROM_HOST, expandSnapshot } from "../js/protocol.js";
const ids = SELECTABLE.map(m => m.id);
let fail = 0, maxLen = 0, n = 0;
for (let g = 0; g < 150; g++) {
  const pick = () => { const s = new Set(); while (s.size < 4) s.add(ids[Math.floor(Math.random() * ids.length)]); return [...s]; };
  const sim = new Sim([0, 1, 2, 3].map(slot => ({ slot, name: "c", loadout: pick(), cpu: true, level: 3 })), { stocks: 2 });
  for (let f = 0; f < 6000 && sim.phase !== "result"; f++) {
    sim.step(sim.fighters.map(F => cpuInput(F, sim)));
    if (f % 7) continue;
    for (const F of sim.list) {
      const txt = `${JSON.stringify(sim.snapshot()).slice(0, -1)},"Y":${JSON.stringify([5, ...fighterState(F)])}}`;
      maxLen = Math.max(maxLen, txt.length); n++;
      const o = parse(txt, MAX_FROM_HOST);
      const c = o && checkFromHost(o); if (c) { const v = expandSnapshot(c); if (v.F.some(F => F && !F.st) || v.P.some(p => !p.kind)) fail++; }
      if (!o || !c) { if (fail++ < 3) console.log("REJECT", txt.length, o ? "" : "(too long or bad json)", txt.slice(0, 200)); }
    }
  }
}
console.log("checked", n, "fail", fail, "max length", maxLen, "/", MAX_FROM_HOST);
process.exit(fail ? 1 : 0);
