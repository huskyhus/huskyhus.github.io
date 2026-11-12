// 「影狩り」: ハ短調 → ニ短調・152 BPM・124 小節。町を救うために日々暗躍する能力者。影の実力者だが誰も気づいていない。だがそれでいい。悪を狩るのが好きなのだから。
// 主役はベースの動機とシンコペーション。旋律は休符で余裕を見せ、裏では 2 声のインベンションとカノンが正確に動いている（見えない実力）。
// 前奏 → A → B → A' → B' → 狩り（2 声のインベンション）→ 追跡（4 小節のカノン）→ オルガンのソロ → ベースのソロ → 掛け合い → 落ち（誰も気づかない）→ A'' → 大サビ（全音上）→ 結び → A へ。
//
// コード進行:
//   A: i7–IV7（ドリアン）× 2 / VI△7–iiø–V7–i7（短調のツーファイブワン）/ B: IV△7–III7–vi7–I7（丸サ進行。変ホ長調の度数）
//   狩り: iv7–VII7–III△7–VI△7–iiø–V7–i（短調の 5 度圏。枯葉）/ 追跡: i–VII–VI–V7（アンダルシア進行）/ 掛け合い: VI–VII–i（エオリアン終止）→ 枯葉 → ツーファイブ
import { epicSong, at, rests, REST } from "../lib/epicband.js";

const CM = { tonic: 0, mode: "minor" };
const DM = { tonic: 2, mode: "minor" };

// ---------------------------------------------------------------- 主題

const A_CHORDS = ["Cm7", "F7", "Cm7", "F7", "Abmaj7", "Dm7b5", "G7", "Cm7"];
const A_PROG = "i7–IV7（ドリアン）× 2 / VI△7–iiø–V7–i7（短調のツーファイブワン）";

/** ベースの動機。全体の背骨 */
const RIFF = [
  "C2 . C2 . . Eb2 . F2 . . . F#2 G2 . Bb2 .",
  "F2 . F2 . . . . Ab2 A2 . Bb2 . B2 . C3 .",
  "C2 . C2 . . Eb2 . F2 . . . F#2 G2 . Bb2 .",
  "F2 . F2 . . . . Ab2 A2 . C3 . Eb3 . C3 .",
  "Ab2 . Ab2 . . C3 . Eb3 . . C3 . Ab2 . G2 .",
  "D2 . D2 . . F2 . Ab2 . . F2 . D2 . F2 .",
  "G2 . G2 . . B2 . D3 . . B2 . G2 . B2 .",
  "C3 . . Bb2 . G2 . . F2 . Eb2 . D2 . . B1",
];

const A_LEAD = [
  "C5 . . Eb5 . . F5 . G5 . . Bb5 . G5 F5 .",
  "A5 - . . . . F5 G5 A5 . . C6 . A5 . .",
  "C5 . . Eb5 . . F5 . G5 . . Bb5 . C6 Bb5 G5",
  "Eb5 - . F5 A5 . C6 . Eb6 - - . . C6 Bb5 A5",
  "C6 - - . Ab5 . Eb5 . G5 - - . Eb5 . C5 .",
  "D5 . F5 . Ab5 . C6 . Bb5 - Ab5 . F5 . D5 .",
  "B4 . D5 . F5 . G5 . B5 - - . Ab5 G5 F5 D5",
  "Eb5 - - - . . . . . . G4 Bb4 C5 Eb5 F5 G5",
];

/** 旋律が休む所に入る、ブラスの短い合いの手 */
const A_ANSWER = [
  ". . Bb4 . . C5 . . . . Eb5 . . . . .",
  ". . . Eb5 . C5 . . . A4 . . Bb4 . C5 .",
  ". . Bb4 . . C5 . . . . Eb5 . . . . .",
  ". . . . . . . . . A4 Bb4 C5 Eb5 . . .",
  ". . . Eb5 . C5 . . . . . Bb4 . Ab4 . .",
  ". C5 . . . Ab4 . . . F4 . . Ab4 . . .",
  ". . . . . . . D5 . . F5 . . . . .",
  ". . . G4 Eb4 . C4 . . . . . . . . .",
];

const MARUSA = ["Abmaj7", "G7", "Cm7", "Eb7", "Abmaj7", "G7", "Cm7", "G7"];
const B_PROG = "IV△7–III7–vi7–I7（丸サ進行。変ホ長調の度数）× 2（最後は V7）";

/** フック。拍の裏から入り、高い音で余裕を見せる */
const B_LEAD = [
  "C6 - - . Bb5 . C6 . Eb6 - - . C6 . Ab5 .",
  "B5 - - . G5 . F5 . D5 - - . B4 . D5 .",
  "Eb5 - - . G5 . Bb5 . C6 - - . Bb5 . G5 .",
  "G5 . Bb5 . Db6 - - . Eb6 - Db6 . Bb5 . G5 .",
  "Eb6 - - . C6 . Ab5 . G5 - - . Ab5 . C6 .",
  "D6 - - . B5 . G5 . F5 - - . G5 . B5 .",
  "C6 - - . G5 . Eb5 . Bb5 - - . G5 . Eb5 .",
  "D5 . F5 . Ab5 . B5 . D6 - - - . . . .",
];

/** B の下を動く線。旋律の休みごとに 3 度・6 度で追いかける */
const B_COUNTER = [
  "Eb5 - - - - - Ab4 . G4 - - - - - C5 .",
  "D5 - - - - - B4 . F4 - - - - - G4 .",
  "G4 - - - - - Eb5 . Eb5 - - - - - D5 .",
  "Eb5 . G5 . Bb4 - - . Db5 - Bb4 . G4 . Eb5 .",
  "C5 - - - - - Eb5 . Eb5 - - - - - Ab4 .",
  "F5 - - - - - D5 . B4 - - - - - D5 .",
  "Eb5 - - - - - C5 . G4 - - - - - Bb4 .",
  "B4 . D5 . F5 . G5 . B5 - - - . . . .",
];

const A_BONE = [
  "C4 - - - - - - - Bb3 - - - - - - -",
  "A3 - - - - - - - C4 - - - - - - -",
  "Eb4 - - - - - - - Bb3 - - - - - - -",
  "A3 - - - - - - - Eb4 - - - - - - -",
  "Ab3 - - - - - - - G3 - - - - - - -",
  "F3 - - - - - - - Ab3 - - - - - - -",
  "B3 - - - - - - - G3 - - - - - - -",
  "C4 - - - - - - - . . . . . . . .",
];

// ---------------------------------------------------------------- セクション

const COMMON = { key: CM, feel: "funk", groove: "prowl", comp: "auto" };

const INTRO = {
  ...COMMON, name: "前奏", prog: A_PROG, chords: A_CHORDS, lead: rests(8), bass: RIFF, comp: null, mute: ["sub"], noFill: true,
  bell: [REST, REST, REST, REST, REST, REST, "D5 - F5 - G5 - B5 -", "C6 - G5 - Eb5 - C5 -"],
  brass: "stab", mix: { brass: 0.7 },
};

const A = { ...COMMON, name: "A メロ", prog: A_PROG, chords: A_CHORDS, lead: A_LEAD, bass: RIFF, mute: ["sub"], brass: "off", mix: { brass: 0.45 } };

const B = {
  ...COMMON, name: "B メロ（丸サ進行）", prog: B_PROG, feel: "funk", groove: "prowlBig", chords: MARUSA, lead: B_LEAD, pad: "hold", mix: { strings: 0.7 }, keepComp: true, brass: "hits",
};

const A2 = { ...A, name: "A' メロ（合いの手）", mix: { brass: 0.45 }, parts: { sax: A_ANSWER } };

const B2 = { ...B, name: "B' メロ", counter: B_COUNTER, timp: "drive" };

// ---- 狩り: 短調の 5 度圏（枯葉）の上の 2 声のインベンション。1 小節の動機を和音ごとに写していく

const LEAVES = ["Fm7", "Bb7", "Ebmaj7", "Abmaj7", "Dm7b5", "G7", "Cm7", "G7"];
const INVENTION = [
  "F5 G5 Ab5 C6 Bb5 Ab5 G5 F5 Eb5 - F5 - Ab5 - C6 -",
  "Bb5 C6 D6 F6 Eb6 D6 C6 Bb5 Ab5 - Bb5 - D6 - F6 -",
  "Eb6 F6 G6 Bb6 Ab6 G6 F6 Eb6 D6 - Eb6 - G6 - Bb6 -",
  "Ab5 Bb5 C6 Eb6 D6 C6 Bb5 Ab5 G5 - Ab5 - C6 - Eb6 -",
  "D6 Eb6 F6 Ab6 G6 F6 Eb6 D6 C6 - D6 - F6 - Ab6 -",
  "G5 Ab5 B5 D6 C6 B5 Ab5 G5 F5 - G5 - B5 - D6 -",
  "C6 D6 Eb6 G6 F6 Eb6 D6 C6 Bb5 - C6 - Eb6 - G6 -",
  "F6 D6 B5 G5 F5 D5 B4 G4 . . . . . . . .",
];
/** 下の声部: 旋律が 16 分で走る所では 3 度・7 度を伸ばし（Ab–Ab–G–G–F–F–Eb と半音で下りるガイドトーン）、旋律が伸ばす所で動く */
const INVENTION_2 = [
  "Ab4 - - - - - - - Ab3 C4 Eb4 F4 Ab4 - . .",
  "Ab4 - - - - - - - Bb3 D4 F4 G4 Ab4 - . .",
  "G4 - - - - - - - G3 Bb3 D4 Eb4 G4 - . .",
  "G4 - - - - - - - Ab3 C4 Eb4 F4 G4 - . .",
  "F4 - - - - - - - D4 F4 Ab4 Bb4 C5 - . .",
  "F4 - - - - - - - G3 B3 D4 F4 G4 - . .",
  "Eb4 - - - - - - - C4 Eb4 G4 Ab4 Bb4 - . .",
  "D4 - - - B3 - - - G3 - - - . . . .",
];
const WALK = [
  "F2 - Ab2 - C3 - Eb3 -",
  "Bb2 - F2 - D2 - F2 -",
  "Eb2 - G2 - Bb2 - D3 -",
  "Ab2 - Eb2 - C2 - Eb2 -",
  "D2 - F2 - Ab2 - C3 -",
  "G2 - D2 - B1 - D2 -",
  "C2 - Eb2 - G2 - Bb2 -",
  "G2 - F2 - D2 - B1 -",
];

const HUNT = {
  name: "狩り（2 声のインベンション）", prog: "iv7–VII7–III△7–VI△7–iiø–V7–i7–V7（短調の 5 度圏。枯葉）", key: CM, feel: "jazz", groove: "swing", chords: LEAVES, comp: null,
  lead: INVENTION, bass: WALK, pad: "hold", mix: { strings: 0.5 }, mute: ["arp", "sub"],
  parts: { sax: INVENTION_2 },
};

// ---- 追跡: アンダルシア進行の 4 小節の上で、3 つの線を 4 小節ずつ重ねる

const ANDA = ["Cm", "Bb", "Ab", "G7"];
const C1 = ["C4 - - G3 C4 - Eb4 -", "D4 - - Bb3 F4 - D4 -", "C4 - - Ab3 Eb4 - C4 -", "B3 - - G3 D4 - F4 -"];
const C2 = ["G4 - Eb4 - C4 D4 Eb4 F4", "F4 - D4 - Bb3 C4 D4 F4", "Eb4 - C4 - Ab3 Bb3 C4 Eb4", "D4 - B3 - G3 Ab3 B3 D4"];
const C3 = [
  "C5 Eb5 G5 Eb5 C5 Bb4 C5 Eb5 G5 F5 Eb5 D5 Eb5 G5 C6 G5",
  "Bb4 D5 F5 D5 Bb4 Ab4 Bb4 D5 F5 Eb5 D5 C5 D5 F5 Bb5 F5",
  "Ab4 C5 Eb5 C5 Ab4 G4 Ab4 C5 Eb5 D5 C5 Bb4 C5 Eb5 Ab5 Eb5",
  "G4 B4 D5 B4 G4 F4 G4 B4 D5 C5 B4 Ab4 B4 D5 G5 D5",
];

const CHASE = {
  ...COMMON, name: "追跡（カノン）", prog: "i–VII–VI–V7（アンダルシア進行）× 4", groove: "prowl", calm: true, comp: null,
  chords: [...ANDA, ...ANDA, ...ANDA, ...ANDA],
  pad: "hits", mix: { strings: 0.55 }, timp: "drive",
  lead: [...rests(12), ...at(C3, 12)],
  parts: {
    bone: [...C1, ...at(C2, -12), ...at(C3, -24), ...at(C3, -24)],
    sax: [...rests(4), ...at(C1, 12), ...C2, ...at(C2, 12)],
  },
};

const SOLO_ORGAN = {
  ...COMMON, name: "ソロ（オルガン）", prog: A_PROG, chords: A_CHORDS, lead: rests(8), comp: null, bass: RIFF, mute: ["sub"], brass: "off", mix: { brass: 0.5 },
  parts: {
    organ: [
      "C5 Eb5 G5 Bb5 C6 . Bb5 G5 F5 G5 Bb5 C6 Eb6 . C6 Bb5",
      "A5 C6 Eb6 . C6 A5 F5 Eb5 F5 A5 C6 Eb6 F6 . Eb6 C6",
      "G5 Bb5 C6 Eb6 G6 . Eb6 C6 Bb5 C6 Eb6 G6 Bb6 . G6 Eb6",
      "F6 Eb6 C6 A5 F5 Eb5 C5 A4 Bb4 C5 Eb5 F5 A5 C6 Eb6 F6",
      "G6 . Eb6 C6 Ab5 . C6 Eb6 G6 - - . Ab6 G6 Eb6 C6",
      "Ab5 F5 D5 F5 Ab5 C6 F6 . D6 C6 Ab5 F5 D5 F5 Ab5 C6",
      "B5 G5 F5 D5 B4 D5 F5 G5 B5 D6 F6 Ab6 G6 F6 D6 B5",
      "C6 - - . G5 Eb5 C5 . . . . . . . . .",
    ],
  },
};

const SOLO_BASS = {
  ...COMMON, name: "ソロ（ベース）", prog: B_PROG, chords: MARUSA, lead: rests(8), pad: "hold", groove: "swing", mute: ["sub", "fm"], comp: "auto",
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
  // 上で刻むブラスだけが支える
  brass: "off", mix: { strings: 0.5, brass: 0.55, bass: 1.5 },
};

/** 掛け合い: リードとサックス。2 小節 → 1 小節 → 半小節 → 同時 */
const TRADE = {
  ...COMMON, name: "掛け合い", prog: "VI–VII–i × 2（エオリアン終止）/ 枯葉 / ii–V", groove: "prowlBig", solo: true,
  chords: ["Ab", "Bb", "Cm7", "Cm7", "Ab", "Bb", "Cm7", "Cm7", "Fm7", "Bb7", "Ebmaj7", "Abmaj7", "Dm7b5", "G7", "Cm7", "G7"],
  brass: "hits", mix: { brass: 0.6 },
  lead: [
    "C6 . Ab5 C6 Eb6 . C6 Ab5 Eb5 . Ab5 C6 Eb6 - . .",
    "D6 . Bb5 D6 F6 . D6 Bb5 F5 . Bb5 D6 F6 - . .",
    REST,
    REST,
    "Eb6 C6 Ab5 Eb5 C5 Eb5 Ab5 C6 Eb6 . C6 . Ab5 . . .",
    "F6 D6 Bb5 F5 D5 F5 Bb5 D6 F6 . D6 . Bb5 . . .",
    REST,
    REST,
    "Ab5 C6 Eb6 F6 . Eb6 C6 Ab5 F5 - Ab5 - C6 - . .",
    REST,
    "G5 Bb5 D6 Eb6 . D6 Bb5 G5 Eb5 - G5 - Bb5 - . .",
    REST,
    "D6 C6 Ab5 F5 D5 F5 Ab5 C6 . . . . . . . .",
    ". . . . . . . . B5 G5 F5 D5 B4 D5 F5 G5",
    "C6 - G5 Eb5 C5 Eb5 G5 Bb5 C6 . . Bb5 C6 . . .",
    "B5 . G5 . F5 . D5 . B4 . D5 . F5 . G5 .",
  ],
  parts: {
    sax: [
      REST,
      REST,
      "C5 . G4 C5 Eb5 . C5 G4 Eb4 . G4 C5 Eb5 - . .",
      "G4 Bb4 C5 Eb5 . G5 Eb5 C5 Bb4 G4 Eb4 G4 C5 - . .",
      REST,
      REST,
      "Eb5 C5 G4 Eb4 C4 Eb4 G4 C5 Eb5 . C5 . G4 . . .",
      "Bb4 G4 Eb4 C4 Bb3 C4 Eb4 G4 Bb4 . C5 . Eb5 . . .",
      REST,
      "F4 Ab4 Bb4 D5 . Bb4 Ab4 F4 D4 - F4 - Ab4 - . .",
      REST,
      "Ab4 C5 Eb5 G5 . Eb5 C5 Ab4 F4 - Ab4 - C5 - . .",
      ". . . . . . . . F4 Ab4 C5 D5 F5 - . .",
      "G4 B4 D5 F5 D5 B4 G4 F4 . . . . . . . .",
      "Eb5 - C5 G4 Eb4 G4 C5 D5 Eb5 . . D5 Eb5 . . .",
      "D5 . B4 . Ab4 . F4 . D4 . F4 . Ab4 . B4 .",
    ],
  },
};

/** 落ち: 誰も気づいていない。だがそれでいい */
const DROP = {
  name: "落ち（誰も気づかない）", prog: B_PROG, key: CM, feel: "ballad", echo: 0.2, chords: MARUSA, comp: "auto", pad: "hold", mix: { strings: 0.5 }, mute: ["power", "arp"],
  lead: [
    "C6 - - - Bb5 - G5 -",
    "F5 - - - D5 - B4 -",
    "C5 - - - Eb5 - G5 -",
    "Bb5 - - - G5 - Eb5 -",
    "C6 - - - Eb6 - - -",
    "D6 - - - B5 - G5 -",
    "G5 - - - Eb5 - C5 -",
    "D5 - - - F5 - B5 -",
  ],
  parts: {
    sax: [
      "Ab3 - Eb4 - G4 - - -",
      "G3 - D4 - F4 - - -",
      "G3 - C4 - Eb4 - - -",
      "G3 - Bb3 - Db4 - - -",
      "Ab3 - Eb4 - C4 - - -",
      "F3 - B3 - D4 - - -",
      "Bb3 - - - G3 - Eb3 -",
      "F3 - - - G3 - D4 -",
    ],
  },
};

const A3 = {
  ...COMMON, name: "A'' メロ（すべてが動く）", prog: A_PROG, feel: "funk", groove: "prowlBig", chords: A_CHORDS, lead: A_LEAD, bass: RIFF, mute: ["sub"], pad: "hits", brass: "off", timp: "drive", mix: { brass: 0.45, strings: 0.65 },
  parts: { sax: A_ANSWER, bone: A_BONE },
};

const TOP = {
  name: "大サビ（ニ短調）", prog: "IV△7–III7–vi7–I7（丸サ進行。全音上）× 2 → ♭III–♭VI–V7（ハ短調の V7 へ戻る）", key: DM, feel: "funk", groove: "prowlBig", comp: "auto", pad: "hold", brass: "hits", timp: "drive", choir: true, mix: { strings: 0.8, choir: 0.7 }, keepComp: true, crash: [0, 4],
  chords: ["Bbmaj7", "A7", "Dm7", "F7", "Bbmaj7", "A7", "Dm7", "A7"],
  lead: at(B_LEAD, 2),
  counter: at(B_COUNTER, 2),
};

const END = {
  ...COMMON, name: "結び", prog: "VI△7–V7（ハ短調へ）", groove: "prowlBig", comp: "auto", calm: true, brass: "hits", timp: "rollEnd",
  chords: ["Bbmaj7", "Abmaj7", "G7", "G7"],
  lead: [
    "D6 - - . Bb5 . F5 . A5 - - . F5 . D5 .",
    "C6 - - . Ab5 . Eb5 . G5 - - . Eb5 . C5 .",
    "B5 . D6 . F6 . G6 . F6 . D6 . B5 . G5 .",
    "F5 . D5 . B4 . G4 . . . . . G4 Bb4 B4 .",
  ],
};

export const SECTIONS = [INTRO, A, B, A2, B2, HUNT, CHASE, SOLO_ORGAN, SOLO_BASS, TRADE, DROP, A3, TOP, END];

export default epicSong({
  title: "影狩り",
  description: "町を救うために日々暗躍する能力者。影の実力者だが誰も気づいていない。だがそれでいい。悪を狩るのが好きなのだから。ハ短調 → ニ短調・152 BPM。ベースの動機とシンコペーションの上で、休符で余裕を見せる旋律。裏では 2 声のインベンションとカノンが正確に動く。オルガンとベースのソロ、サックスとの掛け合い、誰も気づかない静かな落ちを経て、全音上の大サビへ。ドリアン・丸サ進行・短調のツーファイブ・枯葉（5 度圏）・アンダルシア進行・エオリアン終止。",
  bpm: 152,
  sections: SECTIONS,
  loopFrom: 1,
  kit: "electro",
  drumVol: 0.55,
  inst: { lead: "sawtooth", bass: "synth-bass", brass: "fm-brass", comp: "fm-epiano", power: "fm-bass" },
  vol: { lead: 1.4, bass: 0.5, brass: 0.5 },
  off: ["double", "arp", "power"],
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
    { key: "sax", name: "サックス（合いの手・対旋律）", inst: "oboe", pan: "R", vol: 0.15, reverb: 0.3, attack: 0.02 },
    { key: "bone", name: "トロンボーン", inst: "trombone", pan: "L", vol: 0.11, reverb: 0.3, attack: 0.02 },
    { key: "organ", name: "オルガン（ソロ）", inst: "fm-organ", pan: "C", vol: 0.09, reverb: 0.3, role: "descant" },
  ],
});
