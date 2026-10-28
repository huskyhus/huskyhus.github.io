// ウルトラハスタワー: 熱くて泣ける、いちばん大きな通常曲。ニ長調 → ホ長調・152 BPM。
// イントロ → A → サビ → ソロ → 落ちサビ → ラスサビ（全音上）→ つなぎ → A へ。楽器はスーパーハスタワーと同じ。
//
//   - サビは王道進行（IV△7–V–iii7–vi7）。旋律は各小節の頭を和音の 9 度・7 度（テンション）から始め、1 段ずつ下りる
//     （高い所から少しずつ落ちていく形が「泣き」になる）
//   - ソロは 16 分音符でギターのように。最高音は E6 まで（いちばん上はラスサビに取っておく）
//   - 落ちサビはドラムとベースを抜き、エレピの和音とベルだけ。最後は主和音に行かず vi7（Bm7）へ逃げ（偽終止）、
//     同じ根音の B7sus4 で吊ったまま全音上のラスサビへ（解決しないもどかしさ → 転調で一気に開く）
//   - ラスサビは V7 → vi7 の偽終止で一度はぐらかし、分数コードで低音を下ろしてから、主和音で曲の最高音 F#6 に着く
//   - つなぎは C△7（ニ長調の ♭VII、ホ長調から見ると遠い和音）→ A7sus4。明るさの中に遠くを見るような影を残して A へ戻る
import { superSong, shift, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const D = { tonic: 2, mode: "major" };
const E = { tonic: 4, mode: "major" };

const INTRO = {
  name: "イントロ", prog: "IV△7–V–iii7–vi7（王道進行）", key: D, feel: "intro",
  chords: ["Gmaj7", "A", "F#m7", "Bm7"],
  lead: [REST, REST, REST, REST],
  // 主題の頭「根音・5 度・根音・3 度」を、王道進行の 4 つの和音で
  bell: [
    "G5 . D5 G5 B5 - - -",
    "A5 . E5 A5 C#6 - - -",
    "F#5 . C#5 F#5 A5 - - -",
    "B5 . F#5 B5 D6 - - -",
  ],
};

const A = {
  name: "A メロ", prog: "I–V⁶–vi7–IV△7–ii7–iii7–IV–V7sus4", key: D, feel: "normal",
  chords: ["D", "A/C#", "Bm7", "Gmaj7", "Em7", "F#m7", "G", "A7sus4"],
  lead: [
    "D5 . A4 D5 F#5 . E5 D5",
    "E5 . C#5 A4 E5 - . .",
    "F#5 . D5 B4 F#5 G5 F#5 E5",
    "D5 - B4 - D5 . E5 F#5",
    "G5 . E5 B4 G5 . F#5 E5",
    "A5 . F#5 C#5 A5 - F#5 E5",
    "D5 . B4 G4 G5 F#5 E5 D5",
    "E5 - - - D5 - E5 F#5",            // 吊った 4 度（D）を残したまま、サビの頭の 9 度へ上がる
  ],
};

const CHORUS = {
  name: "サビ", prog: "IV△7–V–iii7–vi7（王道進行）→ ii7–V7–I–I7", key: D, feel: "big",
  chords: ["Gmaj7", "A", "F#m7", "Bm7", "Em7", "A7", "D", "D7"],
  lead: [
    "A5 - - - F#5 - D5 F#5",           // 9 度から落ちる
    "G5 - - - E5 - C#5 E5",            // 7 度から落ちる（1 段下）
    "F#5 - - - E5 - C#5 E5",
    "E5 - - - D5 - B4 D5",             // 11 度（Bm11 の響き）
    "E5 . G5 B5 - - A5 G5",            // ここから上へ
    "G5 . A5 C#6 - - B5 A5",
    "A5 - - - - - F#5 D5",             // 主和音に着く
    "A5 - - - . F#5 A5 C6",            // C は D7 の 7 度。ソロの頭の B5 へ半音で下りる
  ],
  // サビの前半だけ、旋律の上で 1 小節ずつ下りる長い音
  bell: ["D6 - - - - - - -", "B5 - - - - - - -", "A5 - - - - - - -", "B5 - - - - - - -", REST, REST, REST, REST],   // V の上は 9 度（導音を重ねない）
};

const SOLO = {
  name: "ソロ", prog: "IV△7–V–iii7–vi7 ×2 → V7sus4", key: D, feel: "big", solo: true,
  chords: ["Gmaj7", "A", "F#m7", "Bm7", "Gmaj7", "A", "Bm7", "A7sus4"],
  lead: [
    "B5 - A5 B5 D6 - B5 A5 F#5 - A5 F#5 D5 - E5 F#5",
    "E5 - C#5 E5 A5 - G5 E5 C#5 - E5 G5 A5 - - -",
    "C#6 - A5 F#5 E5 - F#5 A5 C#6 - E6 C#6 A5 - F#5 -",
    "D6 - - - C#6 B5 A5 F#5 B5 - - - - - . .",
    "G5 A5 B5 D6 E6 - - - D6 B5 A5 F#5 G5 - F#5 E5",
    "A5 - E5 A5 C#6 - E6 - C#6 D6 B5 A5 G5 - D5 -",
    "F#5 - A5 - B5 - D6 - C#6 - B5 - A5 - F#5 -",
    "E6 - - - - - - - D6 - - - . . . .",
  ],
};

const DROP = {
  name: "落ちサビ", prog: "王道進行 → ii7–V7 → vi7（偽終止）→ VI7sus4（ホ長調の V7sus4。転調へ）", key: D, feel: "drop", comp: "auto",
  chords: ["Gmaj7", "A", "F#m7", "Bm7", "Em7", "A7", "Bm7", "B7sus4"],
  lead: [
    ...CHORUS.lead.slice(0, 6),
    "F#5 - - - - - E5 F#5",            // 主和音を期待させて vi7 へ（着かない）
    "E5 - - - F#5 - G#5 A5",           // G♯ が次の調（ホ長調）を先に知らせる
  ],
  bell: CHORUS.bell,
};

const LAST = {
  name: "ラスサビ（ホ長調）", prog: "王道進行 → ii7–V7 → vi7（偽終止）–vi7/V–IV△7–V7sus4 → I(add9)", key: E, feel: "big",
  crash: [0, 4, 10], noFill: true,
  chords: ["Amaj7", "B", "G#m7", "C#m7", "F#m7", "B7", "C#m7", "C#m7/B", "Amaj7", "B7sus4", "Eadd9"],
  lead: [
    ...CHORUS.lead.slice(0, 6).map(l => shift(l, 2)),
    "G#5 - - - B5 - C#6 E6",           // V7 → vi7 の偽終止。上がっていく
    "D#6 - - - C#6 - B5 G#5",          // 9 度から落ちる
    "A5 - - - G#5 - E5 F#5",
    "B5 - - - C#6 - E6 -",             // 吊った 4 度 E から、最高音へ全音で上がる
    "F#6 - E6 - - - - -",              // 曲でいちばん高い F#6（add9 の 9 度）から主音へ
  ],
  bell: [...CHORUS.bell.slice(0, 4).map(l => shift(l, 2)), REST, REST, REST, REST, REST, REST, REST],
};

const LINK = {
  name: "つなぎ", prog: "♭VII△7–V7sus4（ニ長調へ戻る）", key: D, feel: "drop", comp: "auto",
  chords: ["Cmaj7", "A7sus4"],
  lead: ["B5 - - - G5 - E5 -", "D5 - - - - - E5 -"],
};

export const SECTIONS = [INTRO, A, CHORUS, SOLO, DROP, LAST, LINK];

export default superSong({
  title: "ウルトラハスタワー",
  description: "熱くて泣ける版。ニ長調 → ホ長調・152 BPM。王道進行のサビ、16 分のソロ、落ちサビ、全音上のラスサビ（偽終止で引っ張ってから最高音で着く）。",
  bpm: 152,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
