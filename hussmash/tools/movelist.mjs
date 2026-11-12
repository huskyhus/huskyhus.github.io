// 技の一覧（MOVES.md）を moves.js から作る: node tools/movelist.mjs
import { writeFileSync } from "node:fs";
import { MOVES, GROUPS, MOVE_BY_ID, moveStats } from "../js/moves.js";
const PACKS = [["5071346", "ハス君シリーズpart1"], ["6503527", "ハス君シリ－ズ②"], ["7053818", "ハス君といっしょ③"], ["7442239", "ハス君シリーズ④"],
  ["7726224", "いつもいっしょ！パート(1)"], ["7868759", "ハス君シリ－ズ⑤"], ["7961678", "ハス君シリ－ズ{6}"], ["8207778", "ハスくんと仲間たち"], ["8477732", "ハス君といっしょpart.7"]];
const pack = m => PACKS.find(([p]) => m.sticker.startsWith(p))?.[1] ?? "";
const esc = s => String(s).replace(/\|/g, "／");
let md = `# 技の一覧（${MOVES.length} 種）\n\n[tools/movelist.mjs](tools/movelist.mjs) で [js/moves.js](js/moves.js) から作っています（手で直さない）。\n`
  + `速さ = 出るまでのフレーム（1F = 1/60 秒）、ふっとび = 相手が 100% のときの強さの目安（30 前後で撃墜をねらえる）、再使用 = 秒。\n`;
for (const g of GROUPS) {
  md += `\n## ${g.name}（${g.ids.length}）\n\n| ステッカー | 種類 | 速さ | 威力 | ふっとび | 再使用 | 効果 | シリーズ |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const id of g.ids) {
    const m = MOVE_BY_ID[id], s = moveStats(m);
    md += `| ${esc(m.name)} | ${esc(m.kind)} | ${esc(s.speedText)} | ${esc(s.dmgText)} | ${esc(s.powerText)} | ${s.cd ? (s.cd / 60).toFixed(1) : "すぐ"} | ${esc(m.desc)} | ${pack(m)} |\n`;
  }
}
writeFileSync(new URL("../MOVES.md", import.meta.url), md);
console.log("MOVES.md", MOVES.length);
