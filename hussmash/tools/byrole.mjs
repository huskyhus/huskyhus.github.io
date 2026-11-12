// balance.mjs の出力を役割ごとに並べる: node tools/byrole.mjs 結果.json
import { readFileSync } from "node:fs";
import { MOVE_BY_ID, ROLES } from "../js/moves.js";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const [r, name] of ROLES) {
  const L = rows.filter(x => (MOVE_BY_ID[x.id].ai || "atk") === r).sort((a, b) => b.wr - a.wr);
  const avg = L.reduce((s, x) => s + x.wr, 0) / L.length;
  console.log(`== ${name} avg ${(avg * 100).toFixed(0)}%`);
  console.log(L.map(x => `${x.id}:${(x.wr * 100).toFixed(0)}(${(x.dmg / x.n).toFixed(0)}/${(x.ko / x.n).toFixed(2)})`).join("  "));
}
