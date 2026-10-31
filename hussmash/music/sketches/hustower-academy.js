// 学園都市のハスタワー: 放課後の帰り道の切なさ。変ロ長調 → ハ長調・138 BPM。
// イントロ → A → サビ → 掛け合い（ソロ）→ ラスサビ（全音上）→ つなぎ → A へ。楽器はスーパーハスタワーと同じ。
//
//   - A は原曲（通常曲 1）の A メロの旋律そのままを、全音下で、シティポップの和音で付け直す
//     （I△7–iii7–vi7–IV△7–vi7–V–ii7–V7）。同じ旋律なのに、昔の思い出を今から見ているような響きになる
//   - A の最後の V7 は、主和音ではなく vi7 へ（偽終止）。そこから小室進行（vi–IV–V–I の形）のサビへ走り出す
//   - サビは 2 拍目の裏から食って入る（言いたいことが先に出てしまうような前のめり）。7 小節目の E♭m6
//     （同主短調から借りた iv）で一度だけ影が差し、F7sus4 で吊ったまま掛け合いへ
//   - 掛け合いはリードと対旋律がソロを 2 小節・1 小節ずつ交代する。最後の E7 は変ロ長調から遠い和音で、
//     ハ長調の vi（Am7）へのセカンダリードミナントとして、一気に全音上のラスサビへ連れていく
//   - つなぎは A♭△7（ハ長調の ♭VI）→ F7sus4（変ロ長調の V7sus4）。明るいラスサビのあと、少し遠回りして A へ戻る
import { superSong, shift, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const BB = { tonic: 10, mode: "major" };
const C = { tonic: 0, mode: "major" };

const INTRO = {
  name: "イントロ", prog: "IV△7–iii7–ii7–V7sus4", key: BB, feel: "intro",
  chords: ["Ebmaj7", "Dm7", "Cm7", "F7sus4"],
  lead: [REST, REST, REST, REST],
  bell: [
    "Bb5 . F5 Bb5 D6 - - -",
    "A5 . F5 A5 C6 - - -",
    "G5 . Eb5 G5 Bb5 - - -",
    "F5 - - - - - - -",
  ],
};

/** 原曲の A メロ（ハ長調）を全音下げる */
const ORIGINAL_A = [
  "C5 . G4 C5 E5 . D5 C5",
  "D5 . B4 G4 D5 - . .",
  "E5 . C5 A4 E5 F5 E5 D5",
  "C5 - A4 - C5 . D5 .",
  "C5 . G4 C5 E5 . G5 E5",
  "F5 . D5 B4 G5 - F5 E5",
  "D5 . C5 A4 F5 E5 D5 C5",
  "D5 . . B4 G4 . E5 G5",
];

const A = {
  name: "A メロ", prog: "I△7–iii7–vi7–IV△7–vi7–V–ii7–V7 → 偽終止", key: BB, feel: "normal",
  chords: ["Bbmaj7", "Dm7", "Gm7", "Ebmaj7", "Gm7", "F", "Cm7", "F7"],
  lead: ORIGINAL_A.map(l => shift(l, -2)),
};

const CHORUS = {
  name: "サビ", prog: "vi7–IV△7–V–iii7 ×2 → iv6（借用）–V7sus4（小室進行の形）", key: BB, feel: "big",
  chords: ["Gm7", "Ebmaj7", "F", "Dm7", "Gm7", "Ebmaj7", "Ebm6", "F7sus4"],
  lead: [
    ". D6 - Bb5 - A5 G5 F5",           // 拍の裏から食って入る
    "G5 - - D5 - F5 G5 Bb5",
    "A5 - - F5 - C6 - Bb5",
    "F5 - - - . D5 F5 A5",
    ". D6 - Bb5 - A5 G5 F5",
    "G5 - - Bb5 - D6 - Eb6",
    "Gb5 - - - - - F5 -",              // G が G♭ に下がる、一度だけの影
    "F5 - - - . . . .",
  ],
};

const TRADE = {
  name: "掛け合い（ソロ）", prog: "IV△7–iii7–ii7–V7–I△7–iii7–vi7 → V7/vi（ハ長調へ）", key: BB, feel: "big", trade: true,
  chords: ["Ebmaj7", "Dm7", "Cm7", "F7", "Bbmaj7", "Dm7", "Gm7", "E7"],
  // リード: 1・2・5・7・8 小節目
  lead: [
    "G5 - Bb5 - D6 - Eb6 D6 Bb5 - G5 - F5 - G5 -",
    "A5 - - - F5 - A5 C6 D6 - C6 A5 F5 - - -",
    REST, REST,
    "Bb5 A5 G5 F5 Eb5 - G5 - Bb5 - D6 - - - . .",
    REST,
    "D6 - C6 Bb5 A5 - G5 - F5 - G5 - Bb5 - D6 -",
    "G#5 - - - - - - - B5 - - - D6 - - -",
  ],
  // 対旋律: 3・4・6 小節目に答える。最後は E7 の 7 度と根音を下で
  counter: [
    REST, REST,
    "Eb5 - G5 - Bb5 - G5 Eb5 C5 - D5 - Eb5 - G5 -",
    "A5 - - - F5 - Eb5 - C5 - A4 - F4 - - -",
    REST,
    "F5 E5 D5 C5 A4 - C5 - D5 - F5 - A5 - - -",
    REST,
    "D5 - - - - - - - E5 - - - - - - -",
  ],
};

const LAST = {
  name: "ラスサビ（ハ長調）", prog: "vi7–IV△7–V–iii7 ×2 → iv6–V7sus4（全音上）", key: C, feel: "big", crash: [0, 4],
  chords: ["Am7", "Fmaj7", "G", "Em7", "Am7", "Fmaj7", "Fm6", "G7sus4"],
  lead: CHORUS.lead.map(l => shift(l, 2)),
};

const LINK = {
  name: "つなぎ", prog: "♭VI△7（ハ長調）→ V7sus4（変ロ長調へ戻る）", key: BB, feel: "drop", comp: "auto",
  chords: ["Abmaj7", "F7sus4"],
  lead: ["C6 - - - G5 - Eb5 -", "F5 - - - Eb5 - C5 -"],
};

export const SECTIONS = [INTRO, A, CHORUS, TRADE, LAST, LINK];

export default superSong({
  title: "学園都市のハスタワー",
  description: "放課後の帰り道の切なさ。変ロ長調 → ハ長調・138 BPM。原曲の A メロをシティポップの和音で、食って入る小室進行のサビ、リードと対旋律の掛け合い、E7 で全音上のラスサビへ。",
  bpm: 138,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
