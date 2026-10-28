// 通常曲 1 拡張版 4「1 番・2 番」: A → B → 間奏（ソロ）→ A' → B → C → 落ちサビ → ラスサビ の 64 小節。
// 歌ものの定番の形。2 番の A' は拡張版 1 のカノン風の変奏、落ちサビはドラムとベースを抜いた B、
// ラスサビは拡張版 3 の B'（大サビ）。和音は長調の中だけで、転調もしない。
import { layeredSong } from "../lib/layers.js";
import { SECTIONS, LAYERS, barsOf } from "./hustower-massive.js";
import { A2 } from "./hustower-massive-pop.js";
import { B2 } from "./hustower-massive-straight.js";

const [A, B, C] = SECTIONS;

/** 間奏: A の進行の上で、A の頭の形（3 度下りて 5 度へ）を 2 小節ずつ重ね、7 小節目だけ 16 分で下りる */
const SOLO = {
  name: "間奏（ソロ）", prog: "A の進行", solo: true,
  chords: A.chords,
  lead: [
    "E5 . D5 C5 G5 - E5 C5",
    "D5 . B4 G4 B4 - D5 .",
    "E5 . D5 C5 A5 - E5 C5",
    "F5 . E5 F5 A5 - - .",
    "G5 . E5 G5 C6 - B5 C6",
    "D6 . B5 G5 D5 - G5 B5",
    "C6 B5 A5 G5 A5 - F5 - C6 - A5 - F5 - A5 -",
    "G5 - - - B4 - D5 -",
  ],
  counter: null,
};

export default layeredSong({
  title: "通常曲 1 拡張版 4「1 番・2 番」",
  description: "A → B → 間奏（ソロ）→ A' → B → C → 落ちサビ → ラスサビ の 64 小節。歌ものの定番の形。和音は長調の中だけ。",
  mood: "normal",
  bpm: 120,
  bars: barsOf([
    A, B, SOLO,
    { ...A2, name: "A'（2 番）" }, B, C,
    { ...B, name: "落ちサビ", drop: true },
    // ラスサビの最後は、A の頭（ド）へ下りられるようにレで終える
    { ...B2, name: "ラスサビ", lead: [...B2.lead.slice(0, 7), "B5 - - - D5 - - -"] },
  ]),
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
