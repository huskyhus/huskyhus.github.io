// 通常曲 1 拡張版 3「まっすぐ」: イントロ → A → A' → B → C → ソロ → B'（大サビ）の 52 小節。
// イントロはサビ（B）の後半 4 小節。A' は前半を A のまま、後半を 1 段上で歌い直す。
// ソロは王道進行（IV–V–iii–vi）の上で、A の「ド・ソ・ド・ミ」の形を 1 段ずつ下げて重ねる。和音は長調の中だけ。
import { layeredSong } from "../lib/layers.js";
import { SECTIONS, LAYERS, barsOf } from "./hustower-massive.js";

const [A, B, C] = SECTIONS;

/** イントロ: サビの後半（vi–IV–ii–V）をそのまま先に聴かせる */
const INTRO = {
  name: "イントロ", prog: "vi–IV–ii–V",
  chords: B.chords.slice(4),
  lead: B.lead.slice(4),
  counter: null,
};

/** A': 前半 4 小節は A のまま。後半は和音の 3 度・5 度から入り直して、サビへ上っていく */
export const A2 = {
  name: "A'", prog: "I–V–vi–IV 系",
  chords: A.chords,
  lead: [
    ...A.lead.slice(0, 4),
    "E5 . C5 E5 G5 . C6 G5",
    "B5 . G5 D5 B5 - A5 G5",
    "A5 . F5 C5 A5 G5 F5 E5",
    "D5 . . B4 D5 - G5 -",
  ],
  counter: A.counter,
};

/** ソロ: 王道進行 × 2。前半は「ド・ソ・ド・ミ」の形を 1 音ずつ下げて重ね、後半は上へ。最後の I で 1 小節だけ 16 分 */
const SOLO = {
  name: "ソロ", prog: "王道進行 IV–V–iii–vi–IV–V–I–V", solo: true,
  chords: ["F", "G", "Em", "Am", "F", "G", "C", "G"],
  lead: [
    "C5 . A4 C5 F5 . G5 A5",
    "G5 . D5 B4 D5 - - .",
    "B4 . G4 B4 E5 . D5 E5",
    "C5 - A4 - E5 - - .",
    "A5 . F5 A5 C6 . B5 A5",
    "D6 . B5 G5 D6 C6 B5 A5",
    "G5 A5 G5 E5 C5 E5 G5 C6 E6 - D6 - C6 - G5 -",
    "B5 - - - D5 - G5 -",
  ],
  counter: null,
};

/** B': 前半は B のまま。後半は 1 段上で、最後は音階を駆け上がって V で伸ばす（ループしてイントロへ） */
export const B2 = {
  name: "B'（大サビ）", prog: "vi–IV–I–V", big: true,
  chords: B.chords,
  lead: [
    ...B.lead.slice(0, 4),
    "A5 . G5 A5 C6 - B5 A5",
    "F5 . E5 F5 A5 - G5 E5",
    "D5 E5 F5 G5 A5 B5 C6 D6",
    "B5 - - - G5 - - -",
  ],
  counter: null,
};

export default layeredSong({
  title: "通常曲 1 拡張版 3「まっすぐ」",
  description: "イントロ → A → A' → B → C → ソロ → B'（大サビ）の 52 小節。イントロはサビの後半、ソロは王道進行の上で。和音は長調の中だけ。",
  mood: "normal",
  bpm: 120,
  bars: barsOf([INTRO, A, A2, B, C, SOLO, B2]),
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
