// 技データの検査: id の重複・ステッカーの有無・役割
import { existsSync } from "node:fs";
import { MOVES, GROUPS } from "../js/moves.js";
import { Sim } from "../js/sim.js";
const ids = new Set(), stk = new Set();
let bad = 0;
for (const m of MOVES) {
  if (ids.has(m.id)) { console.log("dup id", m.id); bad++; }
  if (stk.has(m.sticker)) { console.log("dup sticker", m.sticker, m.id); bad++; }
  ids.add(m.id); stk.add(m.sticker);
  if (!existsSync(new URL(`../stickers/${m.sticker}.png`, import.meta.url))) { console.log("no sticker", m.id); bad++; }
  if (!m.ai) { console.log("no ai", m.id); bad++; }
  if (!m.desc || !m.kind || !m.name) { console.log("missing text", m.id); bad++; }
}
console.log("moves", MOVES.length, "groups", GROUPS.map(g => `${g.name}:${g.ids.length}`).join(" "));
new Sim([{ slot: 0, name: "a", loadout: ["jab", "mori", "kando", "cheat"] }, { slot: 1, name: "b", loadout: ["jab", "mori", "kando", "cheat"] }]);
process.exit(bad ? 1 : 0);
