// 通常曲 1 拡張版 2「掛け合い」: イントロ → A → B → C → ソロ → 掛け合い → A' → B' の 60 小節。
// ソロは A の進行の上でリードが弾き、掛け合いは B の進行の上でリードと対旋律が 2 小節ずつ応える。
// A' は 3 + 3 + 2 のシンコペーションと 7 の和音、B' は 16 分の装飾変奏（骨組みの音は B のまま）+ E7（V7/vi）。
import { layeredSong } from "../lib/layers.js";
import { REST } from "../lib/compose.js";
import { SECTIONS, LAYERS, barsOf } from "./hustower-massive.js";

const [A, B, C] = SECTIONS;
const REST16 = ". . . . . . . . . . . . . . . .";

const INTRO = {
  name: "イントロ", prog: "I–vi–IV–V", soft: true,
  chords: ["C", "Am", "F", "G"],
  lead: [REST, REST, REST, REST],
  counter: null,
};

/** ソロ: A の進行（I–V–vi–IV–I–V–IV–V）の上で。前半は和音をなぞって上り、後半は上から 16 分で下りる */
const SOLO = {
  name: "ソロ", prog: "A の進行", solo: true,
  chords: A.chords,
  lead: [
    "C5 - G4 - C5 - E5 - G5 - E5 - G5 A5 G5 E5",
    "D5 - B4 - G4 - B4 - D5 - G5 - D6 - - -",
    "C6 B5 A5 G5 E5 - A5 - E6 - - - C6 - A5 -",
    "C6 - A5 - F5 - A5 C6 F6 - - - E6 - C6 -",
    "E6 D6 C6 B5 C6 G5 E5 G5 C6 - - - G5 - E5 -",
    "D6 C6 B5 A5 B5 G5 D5 G5 B5 - - - D6 - B5 -",
    "A5 G5 F5 E5 F5 - A5 - C6 - B5 - A5 - G5 -",
    "G5 - - - D5 - - - B4 - D5 - G5 - - -",
  ],
  counter: null,
};

/** 掛け合い: B の進行の上で、リード（2 小節）→ 対旋律が低い所で答える（2 小節）→ リードが 1 段上で → 最後は一緒に */
const TRADE = {
  name: "掛け合い", prog: "B の進行", solo: true,
  chords: B.chords,
  trade: [false, false, true, true, false, false, true, true],
  lead: [
    "A5 - - - E5 - A5 - C6 - B5 - A5 - E5 -",
    "F5 - A5 - C6 - - - A5 - F5 - C5 - - -",
    REST16,
    REST16,
    "C6 - - - A5 - C6 - E6 - D6 - C6 - A5 -",
    "A5 - C6 - F6 - - - C6 - A5 - C6 - - -",
    "D6 C6 A5 F5 D5 F5 A5 C6 D6 - - - A5 - F5 -",
    "G5 - D5 - B4 - D5 - G5 - - - . . . .",
  ],
  counter: [
    null,
    null,
    "E5 - - - G4 - C5 - E5 - D5 - C5 - G4 -",
    "B4 - D5 - G5 - - - D5 - B4 - G4 - - -",
    null,
    null,
    "F4 - - - A4 - - - D5 - - - F5 - - -",
    "D5 - - - B4 - - - G4 - - - - - - -",
  ],
};

/** A': 旋律の音はほぼ A のまま、3 + 3 + 2 の位置に置き直す。和音は 7 の和音に、6 小節目は G → Em7 */
const A2 = {
  name: "A'", prog: "I△7–V–vi7–IV△7–I△7–iii7–ii7–V",
  chords: ["Cmaj7", "G", "Am7", "Fmaj7", "Cmaj7", "Em7", "Dm7", "G"],
  lead: [
    "C5 - - G4 - - C5 - E5 - - D5 - - C5 -",
    "D5 - - B4 - - G4 - D5 - - - B4 - D5 -",
    "E5 - - C5 - - A4 - E5 - F5 - E5 - D5 -",
    "C5 - - A4 - - C5 - E5 - - - . . . .",
    "C5 - - G4 - - C5 - E5 - - G5 - - A5 -",
    "B5 - - G5 - - E5 - D5 - - E5 - G5 - -",
    "A5 - - F5 - - D5 - C6 - - A5 - F5 E5 -",
    "D5 - - B4 - - G4 - . . B4 - D5 - G5 -",
  ],
  counter: null,
};

/** B': B の骨組みの音（拍の頭）を残して、あいだを 16 分の経過音・刺繍音で埋める。4 小節目は E7 で vi へ引き寄せる */
const B2 = {
  name: "B'", prog: "vi7–IV△7–I–III7–vi7–IV△7–ii7–V7", big: true,
  chords: ["Am7", "Fmaj7", "C", "E7", "Am7", "Fmaj7", "Dm7", "G7"],
  lead: [
    "A5 B5 A5 E5 - - C5 D5 E5 - C5 - E5 G5 A5 -",
    "A5 G5 F5 C5 - - A4 C5 F5 - E5 F5 G5 - - -",
    "E5 F5 G5 - C6 - - - E6 D6 C6 - G5 - E5 -",
    "D5 - - - B4 - G#4 - E4 - G#4 - B4 - - -",
    "C5 E5 A5 - - - G5 A5 E5 - - - C5 - E5 -",
    "F5 E5 F5 - A5 - - - C6 - B5 A5 G5 - A5 -",
    "D5 E5 F5 G5 A5 B5 C6 D6 C6 A5 F5 A5 C6 - - -",
    "B5 - - - G5 - F5 - D5 - B4 - G4 - - -",
  ],
  counter: null,
};

export default layeredSong({
  title: "通常曲 1 拡張版 2「掛け合い」",
  description: "イントロ → A → B → C → ソロ → 掛け合い → A' → B' の 60 小節。ソロのあと、リードと対旋律が 2 小節ずつ応え合う。A' はシンコペーション、B' は 16 分の装飾変奏。",
  mood: "normal",
  bpm: 120,
  bars: barsOf([INTRO, A, B, C, SOLO, TRADE, A2, B2]),
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
