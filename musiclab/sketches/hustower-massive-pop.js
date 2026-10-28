// 通常曲 1 拡張版 1「王道」: A → B → A' → B' → C → ソロ → B'（大サビ）の 56 小節。
// A' は旋律の変奏 + カノン風の和音、B' は旋律を上の音域へ広げて、最後の 3 小節を 8 分で駆け上がる。
// ソロは新しい進行（IV△7–V–iii7–vi → ii7–iii7–IV△7–V。後半はベースが 1 音ずつ上る）の上で、16 分で歌う。
import { layeredSong } from "../lib/layers.js";
import { SECTIONS, LAYERS, barsOf } from "./hustower-massive.js";

const [A, B, C] = SECTIONS;

/** A': 頭の「ド・ソ・ド・ミ」は残し、後半は上へ広げる。和音は I–V–vi–iii–IV–I–ii7–V（カノン進行の形） */
export const A2 = {
  name: "A'", prog: "カノン風 I–V–vi–iii–IV–I–ii7–V",
  chords: ["C", "G", "Am", "Em", "F", "C", "Dm7", "G"],
  lead: [
    "C5 . G4 C5 E5 G5 E5 C5",
    "D5 . B4 G4 B4 D5 G5 -",
    "A5 . E5 C5 E5 F5 E5 D5",
    "B4 - G4 - B4 . D5 .",
    "C5 . A4 C5 F5 . A5 F5",
    "G5 . E5 C5 G5 - A5 G5",
    "F5 . D5 F5 A5 - G5 F5",
    "D5 . B4 G4 G5 - - .",
  ],
  counter: null,
};

/** B': 旋律を 3 度〜オクターブ上へ。和音は B と同じく長調の中だけ（大サビでは最後を G7 に） */
export const B2 = {
  name: "B'", prog: "vi–IV–I–V–vi–IV–ii7–V",
  chords: ["Am", "F", "C", "G", "Am", "F", "Dm7", "G"],
  lead: [
    "A5 . E5 . C6 . B5 A5",
    "A5 . F5 . C6 . A5 G5",
    "G5 . C6 . E6 - D6 C6",
    "B5 - G5 - D5 . G5 D6",
    "C6 . B5 C6 . A5 E5 A5",
    "A5 . G5 A5 . F5 C5 F5",
    "F5 A5 C6 A5 F5 D5 F5 A5",
    "G5 - F5 - D5 . B4 D5",
  ],
  counter: null,
};

/** ソロ: A の「ド・ソ・ド・ミ」を Fmaj7 の上で始め、山を 2 つ作って F6 で頂点、V へ下りる（16 分音符 16 個 / 小節）
 * 後半はベースが D → E → F → G と上るので、旋律は小節の頭で反対へ動かす（連続 8 度を避ける） */
export const SOLO = {
  name: "ソロ", prog: "IV△7–V–iii7–vi–ii7–iii7–IV△7–V", solo: true,
  chords: ["Fmaj7", "G", "Em7", "Am", "Dm7", "Em7", "Fmaj7", "G"],
  lead: [
    "A4 - C5 - F5 - E5 - C5 - A4 C5 E5 - G5 -",
    "G5 - - - D5 - B4 - D5 E5 F5 E5 D5 - - -",
    "E5 - G5 - B5 - - - D6 - B5 - G5 - E5 -",
    "C6 - B5 A5 E5 - A5 - C6 - B5 A5 G5 - E5 -",
    "D5 E5 F5 A5 C6 A5 F5 A5 D6 C6 A5 F5 A5 B5 C6 D6",
    "B5 G5 E5 G5 B5 D6 E6 - D6 - B5 - G5 - B5 -",
    "A5 - C6 - F6 - - - E6 - C6 - A5 - G5 F5",
    "D5 - G4 - B4 - D5 - G5 - - - . . . .",
  ],
  counter: null,
};

export default layeredSong({
  title: "通常曲 1 拡張版 1「王道」",
  description: "A → B → A' → B' → C → ソロ → B'（大サビ）の 56 小節。A' はカノン風の変奏、B' は旋律を上の音域へ広げた変奏。ソロは新しい進行の上で 16 分で歌う。",
  mood: "normal",
  bpm: 120,
  bars: barsOf([A, B, A2, B2, C, SOLO, { ...B2, name: "B'（大サビ）", big: true, chords: [...B2.chords.slice(0, 7), "G7"] }]),
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
