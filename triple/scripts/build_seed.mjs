// IPOPT の解（data/ipopt_seed.json）を初期値にして、ブラウザと同じプランナー（js/planner.js）で
// 解き直し、ページが最初に読み込む解 data/seed.js を作る。
//   実行: node scripts/build_seed.mjs   （triple/ で実行）
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
require(join(ROOT, "js/model.js"));
const Planner = require(join(ROOT, "js/planner.js"));

const seed = JSON.parse(readFileSync(join(ROOT, "data/ipopt_seed.json"), "utf8"));
const spec = {
  params: { g: seed.params.g, m: seed.params.m, l: seed.params.l, d: seed.params.d },
  T: seed.T, xmax: seed.params.xmax, vmax: seed.params.vmax, umax: seed.params.umax,
  goal: seed.goal.map((v, i) => (i >= 1 && i <= 3 ? 2 * Math.PI * Math.round(v / (2 * Math.PI)) : 0)),
  M: seed.M, NU: seed.NU,
};
const prob = Planner.createProblem(spec);
const z0 = new Float64Array(prob.nz);
for (let k = 1; k < prob.M; k++) z0.set(seed.nodes[k], 8 * (k - 1));
for (let i = 1; i < prob.NU; i++) z0[prob.NS + i - 1] = seed.u[i];

console.log(`IPOPT: J = ${seed.cost.toFixed(4)}  初期値の欠損 = ${Math.max(...Planner.residuals(prob, z0).map(Math.abs)).toExponential(2)}`);
const gen = Planner.solve(prob, z0, { maxIt: 200 });
let r = gen.next();
while (!r.done) {
  if (r.value) console.log(`  it ${r.value.it}: 欠損 ${r.value.viol.toExponential(2)}  J ${r.value.cost.toFixed(4)}  pen ${r.value.pen.toExponential(1)}  α ${r.value.alpha}  Δu ${r.value.du?.toExponential(1)}`);
  r = gen.next();
}
const res = r.value;
const err = Planner.integrationError(prob, res.z);
const traj = Planner.sampleTrajectory(prob, res.z, 0.002);
const peaks = Planner.constraintPeaks(traj);
console.log(`JS: ${res.status}  J = ${res.cost.toFixed(4)}  欠損 = ${res.viol.toExponential(2)}  積分誤差 ≈ ${err.toExponential(2)}  ${res.ms} ms`);
console.log(`  max|x| = ${peaks.x.toFixed(3)}  max|ẋ| = ${peaks.v.toFixed(3)}  max|u| = ${peaks.u.toFixed(2)}`);
if (!res.ok) process.exit(1);

const out = { spec, z: Array.from(res.z, (v) => +v.toPrecision(15)), cost: res.cost, ipoptCost: seed.cost };
writeFileSync(join(ROOT, "data/seed.js"),
  "// scripts/build_seed.mjs が生成。手で編集しない。\nwindow.TRIPLE_SEED = " + JSON.stringify(out) + ";\n");
console.log("wrote data/seed.js");
