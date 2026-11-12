// 「影狩り改」: ハ短調 → ニ短調・152 BPM・136 小節。町を救うために暗躍する 4 人の影。互いの姿は見えないが、4 本の線は初めから 1 つの総譜の上で噛み合っている。
// 4 声の役: 影（鋸歯状波。休符で余裕を見せる旋律）/ 刃（マリンバ。拍の頭を避けて 16 分で走る）/ 月（ヴァイオリン。伸ばす歌）/ 鉄（トロンボーン。8 分で歩く低い線）。下でベースとドラムが支える。
// A と B に 4 声の総譜を 1 つずつ書き、普段はそこから 2 人か 3 人だけを鳴らす。4 人が揃うのは集合と大サビだけ。
// 前奏 → A（影・鉄）→ B（影・月）→ A'（影・刃・鉄）→ B'（影・刃・月）→ 狩り（刃・鉄のインベンション）→ 追跡（3 声のカノン）→ 影のソロ（＋月）→ ベースのソロ（＋月）→ 掛け合い → 落ち（月・鉄）→ A''（影・刃・月）→ 集合 → 大サビ（4 声。ニ短調）→ 結び → A へ。
//
// コード進行:
//   A: i7–IV7（ドリアン）× 2 / VI△7–iiø–V7–i7（短調のツーファイブワン）/ B: IV△7–III7–vi7–I7（丸サ進行。変ホ長調の度数）
//   狩り: iv7–VII7–III△7–VI△7–iiø–V7–i（短調の 5 度圏。枯葉）/ 追跡: i–VII–VI–V7（アンダルシア進行）/ 掛け合い: VI–VII–i（エオリアン終止）→ 枯葉 → ツーファイブ
import { epicSong, at, rests, REST } from "../lib/epicband.js";

const CM = { tonic: 0, mode: "minor" };
const DM = { tonic: 2, mode: "minor" };

// ---------------------------------------------------------------- A の総譜

const A_CHORDS = ["Cm7", "F7", "Cm7", "F7", "Abmaj7", "Dm7b5", "G7", "Cm7"];
const A_PROG = "i7–IV7（ドリアン）× 2 / VI△7–iiø–V7–i7（短調のツーファイブワン）";

/** 影: 休符で余裕を見せる旋律 */
const A_SHADOW = [
  "C5 . . Eb5 . . F5 . G5 . . Bb5 . G5 F5 .",
  "A5 - . . . . F5 G5 A5 . . C6 . A5 . .",
  "C5 . . Eb5 . . F5 . G5 . . Bb5 . C6 Bb5 G5",
  "Eb5 - . F5 A5 . C6 . Eb6 - - . . C6 Bb5 A5",
  "C6 - - . Ab5 . Eb5 . G5 - - . Eb5 . C5 .",
  "D5 . F5 . Ab5 . C6 . Bb5 - Ab5 . F5 . D5 .",
  "B4 . D5 . F5 . G5 . B5 - - . Ab5 G5 F5 D5",
  "Eb5 - - - . . . . . . G4 Bb4 C5 Eb5 F5 G5",
];

/** 刃: 拍の頭を空けて（ベースと影に譲って）16 分で走る。同じ形を和音ごとに写す */
const A_BLADE = [
  ". . G4 Bb4 C5 Eb5 C5 Bb4 . . Eb5 D5 C5 Eb5 C5 Bb4",
  ". . F4 A4 C5 Eb5 C5 A4 . . F5 Eb5 C5 Eb5 C5 A4",
  ". . G4 Bb4 C5 Eb5 C5 Bb4 . . Eb5 D5 C5 Eb5 C5 Bb4",
  ". . F4 A4 C5 Eb5 F5 Eb5 . . F5 Eb5 C5 Eb5 C5 A4",
  ". . C5 Eb5 C5 Ab4 C5 Eb5 . . Eb5 C5 Ab4 C5 Ab4 F4",
  ". . D4 F4 Ab4 C5 Ab4 F4 . . C5 Bb4 Ab4 C5 Ab4 F4",
  ". . G4 B4 D5 F5 D5 B4 . . F5 D5 F5 D5 B4 G4",
  ". . G4 C5 Eb5 C5 Bb4 G4 Eb5 C5 Bb4 G4 . . . .",
];

/** 月: 3 度と 7 度をつなぐ伸ばす歌。最後は 4–3 の掛留 */
const A_MOON = [
  "G4 - - - - - - - Bb4 - - - - - - -",
  "Eb5 - - - - - - - - - - - - - - -",
  "Bb4 - - - - - - - - - - - - - - -",
  "A4 - - - - - - - - - - - - - - -",
  "Ab4 - - - - - - - C5 - - - - - - -",
  "Ab4 - - - - - - - F4 - - - - - - -",
  "F4 - - - - - - - - - - - - - - -",
  "F4 - - - Eb4 - - - - - D4 - Eb4 - - -",
];

/** 鉄: 影と反対へ歩く線 */
const A_IRON = [
  "Eb4 - - - D4 - - - C4 - Bb3 - G3 - Bb3 -",
  "C4 - - - Eb4 - - - C4 - A3 - F3 - Bb3 -",
  "Eb4 - - - D4 - - - C4 - Bb3 - G3 - Bb3 -",
  "C4 - - - Eb4 - - - C4 - A3 - F3 - G3 -",
  "Ab3 - - - C4 - - - Eb4 - D4 - C4 - Bb3 -",
  "Ab3 - - - C4 - - - D4 - C4 - Ab3 - F3 -",
  "G3 - - - B3 - - - D4 - - - B3 - G3 -",
  "C4 - - - Bb3 - - - Ab3 - - - G3 - - -",
];

/** ベースの動機。全体の背骨（どのセクションでも同じリズム） */
const A_BASS = [
  "C2 . C2 . . Eb2 . F2 . . . G2 . Bb2 . C3",
  "F2 . F2 . . A2 . C3 . . . A2 . C3 . Eb3",
  "C2 . C2 . . Eb2 . F2 . . . G2 . Bb2 . C3",
  "F2 . F2 . . A2 . C3 . . . A2 . F2 . C3",
  "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . G2",
  "D2 . D2 . . F2 . Ab2 . . . F2 . D2 . Ab2",
  "G2 . G2 . . D2 . G2 . . . B2 . D3 . B2",
  "C2 . C2 . . G2 . Bb2 . . . F2 . D2 . B1",
];

// ---------------------------------------------------------------- B の総譜

const MARUSA = ["Abmaj7", "G7", "Cm7", "Eb7", "Abmaj7", "G7", "Cm7", "G7"];
const B_PROG = "IV△7–III7–vi7–I7（丸サ進行。変ホ長調の度数）× 2（最後は V7）";

const B_SHADOW = [
  "C6 - - . Bb5 . C6 . Eb6 - - . C6 . Ab5 .",
  "B5 - - . G5 . F5 . D5 - - . B4 . D5 .",
  "Eb5 - - . G5 . Bb5 . C6 - - . Bb5 . G5 .",
  "G5 . Bb5 . Db6 - - . Eb6 - Db6 . Bb5 . G5 .",
  "Eb6 - - . C6 . Ab5 . G5 - - . Ab5 . C6 .",
  "D6 - - . B5 . G5 . F5 - - . G5 . B5 .",
  "C6 - - . G5 . Eb5 . Bb5 - - . G5 . Eb5 .",
  "D5 . F5 . Ab5 . B5 . D6 - - - . . . .",
];

const B_BLADE = [
  ". . C5 Eb5 G5 Eb5 C5 Eb5 . . G5 Eb5 C5 G4 Eb5 C5",
  ". . G4 B4 D5 F5 D5 B4 . . D5 B4 G4 B4 D5 F5",
  ". . Bb4 C5 Eb5 G5 Eb5 C5 . . G5 Eb5 G5 Eb5 Bb4 G4",
  ". . Eb5 Db5 Bb4 Db5 Eb5 G5 . . G5 Eb5 Db5 Bb4 Db5 Eb5",
  ". . C5 Eb5 Ab5 G5 Eb5 C5 . . Ab4 C5 Eb5 Ab5 G5 Eb5",
  ". . B4 D5 G5 D5 B4 D5 . . G4 B4 D5 F5 D5 B4",
  ". . G4 C5 Eb5 C5 G4 C5 . . Eb5 C5 Eb5 C5 G4 Bb4",
  ". . G4 B4 F5 D5 G5 F5 D5 B4 G4 . . . . .",
];

const B_MOON = [
  "Eb5 - - - - - Ab4 - G4 - - - - - C5 -",
  "D5 - - - - - B4 - F4 - - - - - G4 -",
  "G4 - - - - - Eb5 - - - - - - - D5 -",
  "Bb4 - - - - - - - Db5 - - - - - - -",
  "C5 - - - - - Eb5 - - - - - - - - -",
  "F5 - - - - - D5 - B4 - - - - - D5 -",
  "Eb5 - - - - - C5 - G4 - - - - - Bb4 -",
  "B4 - - - D5 - - - F5 - - - - - - -",
];

/** 鉄: B では拍の頭を空けて裏から入る。下りる影に上りで応える */
const B_IRON = [
  ". . Eb4 - C4 - Ab3 - . . Ab3 - C4 - Eb4 -",
  ". . D4 - B3 - G3 - . . B3 - D4 - B3 -",
  ". . Bb3 - G3 - C4 - . . Eb4 - C4 - Bb3 -",
  ". . G3 - Bb3 - Db4 - . . Bb3 - G3 - Bb3 -",
  ". . Ab3 - Eb4 - C4 - . . Eb4 - C4 - Ab3 -",
  ". . G3 - B3 - D4 - . . D4 - B3 - G3 -",
  ". . G3 - C4 - Eb4 - . . C4 - Bb3 - G3 -",
  ". . D4 - B3 - Ab3 - . . G3 - F3 - G3 -",
];

const B_BASS = [
  "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
  "G2 . G2 . . D2 . G2 . . . B2 . D3 . B2",
  "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
  "Eb2 . Eb2 . . Bb2 . Eb3 . . . Db3 . Bb2 . G2",
  "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
  "G2 . G2 . . D2 . G2 . . . B2 . D3 . B2",
  "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
  "G2 . G2 . . D2 . G2 . . . F2 . D2 . B1",
];

// ---------------------------------------------------------------- セクション

const COMMON = { key: CM, feel: "funk", groove: "prowl", comp: null };
/** 2 人だけの所は、エレピで和音を薄く補う */
const THIN = { comp: "auto", mix: { comp: 0.5 } };

const A_BASE = { ...COMMON, prog: A_PROG, chords: A_CHORDS, bass: A_BASS };
const B_BASE = { ...COMMON, prog: B_PROG, chords: MARUSA, bass: B_BASS, groove: "prowlBig" };

const INTRO = {
  ...A_BASE, name: "前奏（誰かが動いている）", lead: rests(8), noFill: true, calm: true,
  parts: { blade: [...rests(4), ...A_BLADE.slice(4)] },
};

const A = { ...A_BASE, ...THIN, name: "A メロ（影・鉄）", lead: A_SHADOW, parts: { iron: A_IRON } };
const B = { ...B_BASE, ...THIN, name: "B メロ（影・月）", lead: B_SHADOW, parts: { moon: B_MOON } };
const A2 = { ...A_BASE, name: "A' メロ（影・刃・鉄）", lead: A_SHADOW, parts: { blade: A_BLADE, iron: A_IRON } };
const B2 = { ...B_BASE, name: "B' メロ（影・刃・月）", lead: B_SHADOW, parts: { blade: B_BLADE, moon: B_MOON } };

// ---- 狩り: 短調の 5 度圏（枯葉）の上の 2 声のインベンション。1 小節の動機を和音ごとに写していく

const LEAVES = ["Fm7", "Bb7", "Ebmaj7", "Abmaj7", "Dm7b5", "G7", "Cm7", "G7"];
const INVENTION = [
  "F5 G5 Ab5 C6 Eb6 C6 Ab5 G5 Eb5 - F5 - Ab5 - C6 -",
  "Bb5 C6 D6 F6 Ab6 F6 D6 C6 Ab5 - Bb5 - D6 - F6 -",
  "Eb6 F6 G6 Bb6 D7 Bb6 G6 F6 D6 - Eb6 - G6 - Bb6 -",
  "Ab5 Bb5 C6 Eb6 G6 Eb6 C6 Bb5 G5 - Ab5 - C6 - Eb6 -",
  "D6 Eb6 F6 Ab6 C7 Ab6 F6 Eb6 C6 - D6 - F6 - Ab6 -",
  "G5 Ab5 B5 D6 F6 D6 B5 Ab5 F5 - G5 - B5 - D6 -",
  "C6 D6 Eb6 G6 Bb6 G6 Eb6 D6 Bb5 - C6 - Eb6 - G6 -",
  "F6 D6 B5 G5 F5 D5 B4 G4 . . . . . . . .",
];
/** 下の声部: 刃が 16 分で走る所では 3 度・7 度を伸ばし（Ab–Ab–G–G–F–F–Eb と半音で下りるガイドトーン）、刃が伸ばす所で動く */
const INVENTION_2 = [
  "Ab4 - - - - - - - F4 Eb4 C4 Bb3 Ab3 - . .",
  "Ab4 - - - - - - - F4 D4 C4 Bb3 Ab3 - . .",
  "G4 - - - - - - - Bb3 Ab3 G3 F3 G3 - . .",
  "Eb4 - - - - - - - - - C4 Bb3 Ab3 - . .",
  "F4 - - - - - - - D4 C4 Ab3 F3 Ab3 - . .",
  "F4 - - - - - - - D4 B3 Ab3 F3 G3 - . .",
  "Eb4 - - - - - - - C4 Bb3 G3 Eb3 G3 - . .",
  "D4 - - - B3 - - - G3 - - - . . . .",
];
const WALK = [
  "F2 - C3 - Eb3 - Ab2 -",
  "Bb2 - F2 - Ab2 - D2 -",
  "Eb2 - Bb2 - D3 - G2 -",
  "Ab2 - Eb3 - G2 - C3 -",
  "D2 - Ab2 - C3 - F2 -",
  "G2 - D2 - F2 - B1 -",
  "C2 - G2 - Bb2 - Eb2 -",
  "G2 - D2 - F2 - B1 -",
];

const HUNT = {
  name: "狩り（刃・鉄のインベンション）", prog: "iv7–VII7–III△7–VI△7–iiø–V7–i7–V7（短調の 5 度圏。枯葉）", key: CM, feel: "jazz", groove: "swing", chords: LEAVES, comp: "auto", mix: { comp: 0.45, bass: 0.7 },
  lead: rests(8), bass: WALK,
  parts: { blade: INVENTION, iron: INVENTION_2 },
};

// ---- 追跡: アンダルシア進行の 4 小節の上で、3 つの線を入れ替えていく（4 人目は入らない）

const ANDA = ["Cm", "Bb", "Ab", "G7"];
const C1 = ["C4 - - G3 C4 - Eb4 -", "D4 - - Bb3 F4 - D4 -", "C4 - - Ab3 Eb4 - C4 -", "B3 - - G3 D4 - F4 -"];
const C2 = ["G4 - Eb4 - C4 D4 Eb4 F4", "F4 - D4 - Bb3 C4 D4 F4", "Eb4 - C4 - Ab3 Bb3 C4 Eb4", "D4 - B3 - G3 Ab3 B3 D4"];
const C3 = [
  "C5 Eb5 G5 Eb5 C5 Bb4 C5 Eb5 G5 F5 Eb5 D5 C5 Eb5 C5 G4",
  "Bb4 D5 F5 D5 Bb4 Ab4 Bb4 D5 F5 Eb5 D5 C5 Bb4 D5 Bb4 F4",
  "Ab4 C5 Eb5 C5 Ab4 G4 Ab4 C5 Eb5 D5 C5 Bb4 Ab4 C5 Ab4 Eb4",
  "G4 B4 D5 B4 G4 F4 G4 B4 D5 C5 B4 Ab4 G4 B4 G4 D4",
];
const ANDA_BASS = ["C2 . C2 . . G2 . C3 . . . Bb2 . Eb2 . G2", "Bb1 . Bb1 . . F2 . Bb2 . . . Ab2 . D2 . F2", "Ab1 . Ab1 . . Eb2 . Ab2 . . . G2 . C2 . Eb2", "G1 . G1 . . D2 . G2 . . . F2 . D2 . B1"];

const CHASE = {
  ...COMMON, name: "追跡（3 声のカノン）", prog: "i–VII–VI–V7（アンダルシア進行）× 4", timp: "drive",
  chords: [...ANDA, ...ANDA, ...ANDA, ...ANDA],
  bass: [...ANDA_BASS, ...ANDA_BASS, ...ANDA_BASS, ...ANDA_BASS],
  lead: [...rests(12), ...at(C1, 24)],
  parts: {
    iron: [...C1, ...C2, ...C1, ...rests(4)],
    moon: [...rests(4), ...at(C1, 12), ...at(C2, 12), ...at(C2, 12)],
    blade: [...rests(8), ...C3, ...C3],
  },
};

const SOLO_SHADOW = {
  ...A_BASE, ...THIN, name: "ソロ（影。月が歌う）",
  lead: [
    "C5 Eb5 G5 Bb5 C6 . Bb5 G5 F5 G5 Bb5 C6 Eb6 . C6 Bb5",
    "A5 C6 Eb6 . C6 A5 F5 Eb5 F5 A5 C6 Eb6 F6 . Eb6 C6",
    "G5 Bb5 C6 Eb6 G6 . Eb6 C6 Bb5 C6 Eb6 G6 Bb6 . G6 Eb6",
    "F6 Eb6 C6 A5 F5 Eb5 C5 A4 C5 Eb5 F5 A5 C6 Eb6 F6 Eb6",
    "G6 . Eb6 C6 Ab5 . Eb6 C6 G6 - - . Ab6 G6 C6 Eb6",
    "Ab5 F5 D5 F5 Ab5 C6 F6 . D6 C6 Ab5 F5 D5 F5 Ab5 C6",
    "B5 G5 F5 D5 B4 D5 F5 G5 B5 D6 F6 Ab6 G6 F6 D6 B5",
    "C6 - - . G5 Eb5 C5 . . . . . . . . .",
  ],
  parts: { moon: A_MOON },
};

const SOLO_BASS = {
  ...B_BASE, name: "ソロ（ベース。月が歌う）", groove: "swing", lead: rests(8),
  bass: [
    "Ab2 . Ab2 C3 . Eb3 G3 . Ab3 G3 Eb3 C3 Ab2 . Eb2 .",
    "G2 . G2 B2 . D3 F3 . G3 F3 D3 B2 G2 . D2 .",
    "C2 . C3 C2 . Eb3 G3 Bb3 C4 Bb3 G3 Eb3 C3 . G2 .",
    "Eb2 . Eb3 Eb2 . G2 Bb2 Db3 Eb3 Db3 Bb2 G2 Eb2 . Bb1 .",
    "Ab1 Ab2 C3 Eb3 G3 Eb3 C3 Ab2 . Ab2 . G2 . Eb2 C2 .",
    "G1 G2 B2 D3 F3 D3 B2 G2 . G2 . F2 . D2 B1 .",
    "C2 C3 Eb3 G3 Bb3 G3 Eb3 C3 . C3 . Bb2 . G2 Eb2 .",
    "G1 . G2 . B2 . D3 . F3 . G3 . B3 . D4 .",
  ],
  parts: { moon: B_MOON },
  mix: { bass: 1.2 },
};

/** 掛け合い: 影と月（2 小節）→ 刃と鉄（1 小節）→ 影と月（半小節 → 同時）。その間、もう 1 人が下で支える */
const TRADE = {
  ...COMMON, name: "掛け合い", prog: "VI–VII–i × 2（エオリアン終止）/ 枯葉 / ii–V", groove: "prowlBig", solo: true,
  chords: ["Ab", "Bb", "Cm7", "Cm7", "Ab", "Bb", "Cm7", "Cm7", "Fm7", "Bb7", "Ebmaj7", "Abmaj7", "Dm7b5", "G7", "Cm7", "G7"],
  bass: [
    "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
    "Bb2 . Bb2 . . F2 . Bb2 . . . D3 . F3 . D3",
    "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
    "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Bb1",
    "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
    "Bb2 . Bb2 . . F2 . Bb2 . . . D3 . F3 . D3",
    "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
    "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
    "F2 . F2 . . C3 . F2 . . . Ab2 . C3 . Eb3",
    "Bb2 . Bb2 . . F2 . Bb2 . . . D3 . F3 . D3",
    "Eb2 . Eb2 . . Bb2 . Eb3 . . . D3 . Bb2 . G2",
    "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
    "D2 . D2 . . F2 . Ab2 . . . F2 . D2 . F2",
    "G2 . G2 . . D2 . G2 . . . B2 . D3 . B2",
    "C2 . C2 . . G2 . C3 . . . Bb2 . G2 . Eb2",
    "G2 . G2 . . D2 . G2 . . . F2 . D2 . B1",
  ],
  lead: [
    "C6 . Ab5 C6 Eb6 . C6 Ab5 Eb5 . Ab5 C6 Eb6 - . .",
    "D6 . Bb5 D6 F6 . D6 Bb5 F5 . Bb5 D6 F6 - . .",
    REST,
    REST,
    "Eb6 C6 Ab5 Eb5 C5 Eb5 Ab5 C6 Eb6 . C6 . Ab5 . . .",
    "F6 D6 Bb5 F5 D5 F5 Bb5 D6 F6 . D6 . Bb5 . . .",
    REST,
    REST,
    REST,
    REST,
    REST,
    REST,
    "D6 C6 Ab5 F5 D5 F5 Ab5 C6 . . . . . . . .",
    ". . . . . . . . B5 G5 F5 D5 B4 D5 F5 G5",
    "C6 - G5 Eb5 C5 Eb5 G5 Bb5 C6 . . Bb5 C6 . . .",
    "B5 . G5 . F5 . D5 . B4 . D5 . F5 . G5 .",
  ],
  parts: {
    moon: [
      REST,
      REST,
      "C5 . G4 C5 Eb5 . C5 G4 Eb4 . G4 C5 Eb5 - . .",
      "G4 Bb4 C5 Eb5 . G5 Eb5 C5 Bb4 G4 Eb4 G4 C5 - . .",
      REST,
      REST,
      "Eb5 C5 G4 Eb4 C4 Eb4 G4 C5 Eb5 . C5 . G4 . . .",
      "Bb4 G4 Eb4 C4 Bb3 C4 Eb4 G4 Bb4 . C5 . Eb5 . . .",
      "Ab4 - - - - - - - - - - - - - - -",
      "Ab4 - - - - - - - - - - - - - - -",
      "G4 - - - - - - - - - - - - - - -",
      "G4 - - - - - - - - - - - - - - -",
      ". . . . . . . . F4 Ab4 C5 D5 F5 - . .",
      "G4 B4 D5 F5 D5 B4 G4 F4 . . . . . . . .",
      "Eb5 - C5 G4 Eb4 G4 C5 D5 Eb5 . . D5 Eb5 . . .",
      "D5 . B4 . Ab4 . F4 . D4 . F4 . Ab4 . B4 .",
    ],
    iron: [
      "Eb4 - - - C4 - - - Eb4 - - - C4 - - -",
      "F4 - - - D4 - - - F4 - - - D4 - - -",
      "Eb4 - - - - - - - G3 - - - - - - -",
      "Bb3 - - - - - - - C4 - - - - - - -",
      "C4 - - - Eb4 - - - C4 - - - Eb4 - - -",
      "D4 - - - F4 - - - D4 - - - F4 - - -",
      "Eb4 - - - - - - - G3 - - - - - - -",
      "Bb3 - - - - - - - C4 - - - - - - -",
      REST,
      "F3 Ab3 Bb3 D4 . Bb3 Ab3 F3 D3 - F3 - Ab3 - . .",
      REST,
      "Ab3 C4 Eb4 G4 . Eb4 C4 Ab3 F3 - Ab3 - C4 - . .",
      "Ab3 - - - - - - - F3 - - - - - - -",
      "F3 - - - - - - - G3 - - - - - - -",
      "G3 - - - - - - - C4 - - - - - - -",
      "F3 - - - - - - - B3 - - - - - - -",
    ],
    blade: [
      ...rests(8),
      ". . Ab4 C5 Eb5 F5 . Eb5 C5 Ab4 F4 - Ab4 - C5 -",
      REST,
      ". . G4 Bb4 D5 Eb5 . D5 Bb4 G4 Eb4 - G4 - Bb4 -",
      REST,
      ...rests(4),
    ],
  },
};

/** 落ち: 誰も気づいていない。月と鉄だけが、大サビの下の線を静かに見せておく */
const DROP = {
  ...COMMON, name: "落ち（誰も気づかない）", prog: B_PROG, feel: "ballad", groove: "swing", calm: true, echo: 0.2, chords: MARUSA, lead: rests(8), comp: "auto", mix: { comp: 0.4, bass: 0.7 },
  parts: { moon: B_MOON, iron: B_IRON },
};

const A3 = { ...A_BASE, name: "A'' メロ（影・刃・月）", groove: "prowlBig", lead: A_SHADOW, parts: { blade: A_BLADE, moon: A_MOON } };

// ---- 集合: 鉄 → 月 → 刃 → 影の順に、ニ短調の属和音の上へ入ってくる

const GATHER = {
  ...COMMON, name: "集合（鉄・月・刃・影）", prog: "iv7–V7（ニ短調）", groove: "prowlBig", calm: true, noFill: true, timp: "rollEnd", chords: ["Gm7", "Gm7", "A7", "A7"],
  bass: [
    "G1 . G1 . . D2 . G2 . . . F2 . D2 . Bb1",
    "G1 . G1 . . D2 . G2 . . . F2 . D2 . Bb1",
    "A1 . A1 . . E2 . A2 . . . G2 . E2 . C#2",
    "A1 . A1 . . E2 . A2 . . . A2 . A2 . A2",
  ],
  lead: [REST, REST, REST, "E5 . . G5 . . A5 . C#6 - - . E6 - G6 -"],
  parts: {
    iron: ["G3 . . Bb3 . . C4 . D4 . . F4 . D4 C4 .", "Bb3 - - - - - - - D4 - - - - - - -", "C#4 - - - - - - - E4 - - - - - - -", "E4 - - - C#4 - - - A3 - - - G3 - - -"],
    moon: [REST, "G4 . . Bb4 . . C5 . D5 . . F5 . D5 C5 .", "G4 - - - - - - - - - - - - - - -", "G4 - - - A4 - - - E4 - - - C#5 - - -"],
    blade: [REST, REST, ". . A4 C#5 E5 G5 E5 C#5 . . G5 E5 C#5 E5 C#5 A4", ". . A4 C#5 E5 G5 E5 C#5 . . E5 G5 A5 C#6 A5 G5"],
  },
};

// ---- 大サビ: 初めて 4 人が揃う。同じ総譜の全音上

const TOP_BASE = { ...COMMON, key: DM, groove: "prowlBig", pad: "hold", brass: "stab", timp: "drive", mix: { strings: 0.35, brass: 0.6 } };

const TOP_B = {
  ...TOP_BASE, name: "大サビ（4 声。丸サ進行）", prog: "IV△7–III7–vi7–I7（丸サ進行。全音上）× 2", crash: [0, 4],
  chords: ["Bbmaj7", "A7", "Dm7", "F7", "Bbmaj7", "A7", "Dm7", "A7"],
  bass: at(B_BASS, 2), lead: at(B_SHADOW, 2),
  parts: { blade: at(B_BLADE, 2), moon: at(B_MOON, 2), iron: at(B_IRON, 2) },
};

const TOP_A = {
  ...TOP_BASE, name: "大サビ（4 声。ドリアン）", prog: "i7–IV7（ドリアン）× 2 / VI△7–iiø–V7–i7（全音上）", crash: [0, 4],
  chords: ["Dm7", "G7", "Dm7", "G7", "Bbmaj7", "Em7b5", "A7", "Dm7"],
  bass: at(A_BASS, 2), lead: at(A_SHADOW, 2),
  parts: { blade: at(A_BLADE, 2), moon: at(A_MOON, 2), iron: at(A_IRON, 2) },
};

const END = {
  ...TOP_BASE, name: "結び", prog: "VI△7–V7（ハ短調へ）", calm: true, timp: "rollEnd", brass: "hits", mix: { strings: 0.35, brass: 0.5 },
  chords: ["Bbmaj7", "Abmaj7", "G7", "G7"],
  bass: [
    "Bb2 . Bb2 . . F2 . Bb2 . . . D3 . F3 . D3",
    "Ab2 . Ab2 . . Eb2 . Ab2 . . . C3 . Eb3 . C3",
    "G2 . G2 . . D2 . G2 . . . B2 . D3 . B2",
    "G2 . G2 . . D2 . G2 . . . F2 . D2 . B1",
  ],
  lead: [
    "D6 - - . Bb5 . F5 . A5 - - . F5 . D5 .",
    "C6 - - . Ab5 . Eb5 . G5 - - . Eb5 . C5 .",
    "B5 . D6 . F6 . G6 . F6 . D6 . B5 . G5 .",
    "F5 . D5 . B4 . G4 . . . . . G4 Ab4 B4 .",
  ],
  parts: {
    blade: [
      ". . D5 F5 Bb4 D5 F5 D5 . . C5 A4 F4 A4 C5 A4",
      ". . C5 Eb5 Ab4 C5 Eb5 C5 . . Bb4 G4 Eb4 G4 Bb4 G4",
      ". . G4 B4 D5 F5 D5 B4 . . F5 D5 B4 G4 B4 D5",
      ". . F5 D5 B4 G4 F4 D4 . . . . . . . .",
    ],
    moon: ["F4 - - - - - - - - - - - - - - -", "Eb4 - - - - - - - G4 - - - - - - -", "F4 - - - - - - - - - - - - - - -", "F4 - - - D4 - - - . . . . . . . ."],
    iron: ["Bb3 - - - D4 - - - Bb3 - - - C4 - - -", "Ab3 - - - C4 - - - Bb3 - - - Ab3 - - -", "G3 - - - B3 - - - D4 - - - - - - -", "G3 - - - . . . . . . . . . . . ."],
  },
};

export const SECTIONS = [INTRO, A, B, A2, B2, HUNT, CHASE, SOLO_SHADOW, SOLO_BASS, TRADE, DROP, A3, GATHER, TOP_B, TOP_A, END];

export default epicSong({
  title: "影狩り改",
  description: "町を救うために暗躍する 4 人の影。互いの姿は見えないが、4 本の線は初めから 1 つの総譜の上で噛み合っている。ハ短調 → ニ短調・152 BPM。休符で余裕を見せる影、16 分で走る刃、伸ばして歌う月、8 分で歩く鉄。普段は 2 人か 3 人の対位法をベースとドラムが支え、集合を経て大サビで初めて 4 声が揃う。ドリアン・丸サ進行・短調のツーファイブ・枯葉（5 度圏）・アンダルシア進行・エオリアン終止。",
  bpm: 152,
  sections: SECTIONS,
  loopFrom: 1,
  kit: "electro",
  drumVol: 0.4,
  inst: { lead: "sawtooth", bass: "synth-bass", brass: "fm-brass", comp: "fm-epiano" },
  vol: { lead: 1.9, bass: 0.5, brass: 0.5, timp: 0.5 },
  off: ["harmony", "counter", "arp", "sub", "fm", "double", "power", "vln"],
  bassStyle: "band",
  grooves: {
    // 16 分のシンコペーション。キックは裏を食い、スネアに小さなゴースト
    prowl({ t, pos, b }, kit) {
      if (b.last && pos >= 12 && !b.noFill) { kit.snare(t, 0.1 + (pos - 12) * 0.04); return; }
      if ([0, 7, 10].includes(pos)) kit.kick(t, 0.7);
      if (pos === 4 || pos === 12) kit.snare(t, b.sec.calm ? 0.12 : 0.18);
      if ([9, 15].includes(pos)) kit.snare(t, 0.04);
      kit.hat(t, pos === 14, [0.04, 0.018, 0.03, 0.022][pos % 4]);
    },
    prowlBig({ t, pos, b }, kit) {
      if (pos === 0 && (b.first || b.sec.crash?.includes(b.index))) kit.crash(t);
      if (b.last && pos >= 12 && !b.noFill) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }
      if ([0, 3, 7, 10].includes(pos)) kit.kick(t, 0.8);
      if (pos === 4 || pos === 12) { kit.snare(t); kit.clap(t, 0.07); }
      if ([9, 15].includes(pos)) kit.snare(t, 0.05);
      kit.hat(t, pos % 4 === 2, pos % 4 === 2 ? 0.05 : 0.03);
    },
    // ハーフタイムのスウィング感（ライドの刻みをハットで）
    swing({ t, pos, b }, kit) {
      if (b.last && pos >= 12) { kit.snare(t, 0.1 + (pos - 12) * 0.04); return; }
      if (pos === 0 || pos === 10) kit.kick(t, 0.55);
      if (pos === 4 || pos === 12) kit.snare(t, 0.1);
      if ([0, 4, 6, 8, 12, 14].includes(pos)) kit.hat(t, false, 0.045);
    },
  },
  parts: [
    { key: "blade", name: "刃（第 2 声。16 分で走る線）", inst: "marimba", pan: "R", vol: 0.17, reverb: 0.2, role: "counter" },
    { key: "moon", name: "月（第 3 声。伸ばす歌）", inst: "violin", pan: "L", vol: 0.13, reverb: 0.35, attack: 0.03, role: "counter" },
    { key: "iron", name: "鉄（第 4 声。8 分で歩く線）", inst: "trombone", pan: "C", vol: 0.14, reverb: 0.25, attack: 0.02, role: "counter" },
  ],
});
