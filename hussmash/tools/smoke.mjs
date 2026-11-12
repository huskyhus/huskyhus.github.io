// 全部の技を、いろいろな場面で出してみる（例外・NaN・終わらない技を探す）
import { MOVES } from "../js/moves.js";
import { Sim, EMPTY_INPUT, fighterState, loadFighter, predictSim, cpuInput } from "../js/sim.js";
const finite = F => [F.x, F.y, F.vx, F.vy, F.dmg].every(Number.isFinite);
let errors = 0;
const scenes = [
  { name: "near", x0: 700, x1: 760 },
  { name: "far", x0: 500, x1: 1100 },
  { name: "air-off", x0: 300, y0: 700, x1: 800 },
  { name: "foe-off", x0: 1150, x1: 1300, y1: 650 },
];
for (const m of MOVES) {
  for (const sc of scenes) for (const holdF of [1, 30, 999]) {
    const sim = new Sim([
      { slot: 0, name: "a", loadout: [m.id, "jab", "mori", "cheat"].filter((v, i, a) => a.indexOf(v) === i).concat(["kando", "zazen"]).slice(0, 4) },
      { slot: 1, name: "b", loadout: ["zazen", "hansei", "kando", "jab"] },
      { slot: 2, name: "c", loadout: ["jab", "mori", "kando", "cheat"] },
    ], { stocks: 3 });
    sim.phase = "fight";
    const [A, B, C] = sim.fighters;
    A.x = sc.x0; if (sc.y0) { A.y = sc.y0; A.grounded = false; }
    B.x = sc.x1; if (sc.y1) { B.y = sc.y1; B.grounded = false; }
    C.x = 900;
    let started = false, endedAt = -1;
    try {
      for (let f = 0; f < 700; f++) {
        const inA = { x: 0, y: 0, held: f < holdF ? 1 : 0, pressed: f === 0 ? 1 : 0 };
        // B と C は CPU（強い）
        B.level = 3; C.level = 3;
        sim.step([inA, cpuInput(B, sim), cpuInput(C, sim), EMPTY_INPUT]);
        if (A.move?.slot === 0) started = true;
        if (started && endedAt < 0 && !(A.move && A.move.slot === 0)) endedAt = f;
        for (const F of sim.list) if (!finite(F)) throw new Error("NaN " + F.slot);
        // 予測の状態の行き来
        if (f % 37 === 0) { const P = predictSim(0); loadFighter(P.fighters[0], fighterState(A)); P.stepSolo(0, inA); }
      }
      if (sc.name === "near" && !started) { console.log("never started", m.id, sc.name); errors++; }
      if (started && endedAt < 0 && A.alive) { console.log("never ended", m.id, sc.name, holdF); errors++; }
    } catch (e) { console.log("ERR", m.id, sc.name, holdF, e.stack.split("\n").slice(0, 3).join(" | ")); errors++; }
  }
}
// ふっとび中に使う技
for (const m of MOVES.filter(m => m.burst)) {
  const sim = new Sim([{ slot: 0, name: "a", loadout: [m.id, "jab", "mori", "cheat"] }, { slot: 1, name: "b", loadout: ["jab", "mori", "kando", "cheat"] }]);
  sim.phase = "fight";
  const [A, B] = sim.fighters;
  sim.applyHit(B, A, { dmg: 10, base: 30, grow: 0, ang: 40, fixed: true }, 1, false);
  let used = false;
  for (let f = 0; f < 60; f++) { sim.step([{ x: 0, y: 0, held: 1, pressed: f === 20 ? 1 : 0 }, EMPTY_INPUT]); if (A.move?.id === m.id) used = true; }
  if (!used) { console.log("burst failed", m.id); errors++; }
}
console.log("errors", errors);
process.exit(errors ? 1 : 0);
