// 「望月の決闘」: ニ短調 → ホ短調・156 BPM・136 小節。満月の運命の日、主人公と魔王がついに対峙する。全力を出せることが、2 人ともどこか楽しい。
// 主題は 2 つ。勇者の主題（リード）と魔王の主題（トロンボーン）は同じ和音の上に書いてあり、別々に提示したあと、同時に鳴らす（二重対位）。
// 前奏 → A（勇者）→ B → 魔王の主題 → A'（2 人同時）→ B' → 輪舞（4 声のカノン）→ C（月光）→ 勇者のソロ → 魔王のソロ → 掛け合い → A'' → 落ち → 大サビ（全音上）→ 結び → A へ。
//
// コード進行:
//   前奏: i–VI–iv–V（短調の循環）/ A・魔王: i–VI–III–VII（エピック進行）+ 短調の循環 / B: IV–V–iii–vi（王道進行）+ ツーファイブワン + V7/vi
//   輪舞: i–v–VI–III（カノン進行の前半）× 4 → iv–i–iv–V（後半）/ C: 平行長調のカノン進行
//   魔王のソロ: 短調の 5 度圏 / 掛け合い: 小室進行 × 2 → 5 度圏 / 落ち: マイナークリシェ → V7 / 結び: C–B♭–A7 と下りてニ短調の V7 へ
import { epicSong, at, rests, shift, REST } from "../lib/epicband.js";

const DM = { tonic: 2, mode: "minor" };
const F_MAJOR = { tonic: 5, mode: "major" };
const EM = { tonic: 4, mode: "minor" };
const G_MAJOR = { tonic: 7, mode: "major" };

// ---------------------------------------------------------------- 2 つの主題（同じ和音の上で、どちらが上でも鳴る）

const EPIC = ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm7", "A7"];
const EPIC_PROG = "i–VI–III–VII（エピック進行）/ i–VI–iv7–V7（短調の循環）";

/** 勇者の主題: 4 度上がって駆け上がる。2 回目はオクターブ上から */
const HERO = [
  "A4 . D5 . F5 - E5 F5",
  "Bb5 - A5 F5 D5 . F5 G5",
  "A5 - G5 F5 C5 . F5 A5",
  "G5 - - E5 C5 . D5 E5",
  "F5 . A5 . D6 - C6 F5",
  "Bb5 - F5 Bb5 D6 - C6 Bb5",
  "D6 - Bb5 G5 F5 . G5 Bb5",
  "A5 - - - C#6 - E6 -",
];

/** 魔王の主題: 半音下から主音に戻る重い動機。勇者が動く所で伸ばし、勇者が伸ばす所で動く */
const DEMON = [
  "D4 - - C#4 D4 - A3 -",
  "Bb3 - - A3 Bb3 - D4 F4",
  "F4 - - E4 F4 - C4 -",
  "E4 - - D4 C4 - G3 -",
  "D4 - - C#4 D4 - F4 A4",
  "Bb4 - A4 G4 F4 - D4 F4",
  "G4 - F4 - G4 - D4 -",
  "C#4 - E4 - A4 - G4 E4",
];

/** A'' で 2 つの主題の間に入る第 3 の線 */
const THIRD = [
  "A5 - - - - - G5 A5",
  "D5 - C5 - Bb5 - A5 Bb5",
  "C6 - - - A5 - C6 -",
  "E6 - - - G5 - A5 G5",
  "D5 - F5 - A5 - - -",
  "D5 - - - F5 - - G5",
  "Bb5 - F5 - D5 - Bb4 D5",
  "C#5 - E5 - G5 - A5 -",
];

// ---------------------------------------------------------------- B（王道進行。2 人とも楽しい）

const ROYAL = ["Bb", "C", "Am", "Dm", "Gm7", "C7", "Fmaj7", "A7"];
const ROYAL_PROG = "IV–V–iii–vi（王道進行）/ ii7–V7–I△7（ツーファイブワン）–V7/vi";

const B_LEAD = [
  "F5 - Bb5 - D6 - C6 Bb5",
  "G5 - C6 - E6 - C6 D6",
  "A5 - C6 - E6 - - C6",
  "D6 - - - A5 - F5 A5",
  "Bb5 - D6 - - C6 Bb5 A5",
  "C6 - E6 - - D6 C6 Bb5",
  "A5 - C6 - E6 - - F6",
  "E6 - C#6 - A5 - G5 E5",
];

/** 旋律が上がるときに下がる線（反行）。旋律とはおもに 3 度と 6 度 */
const B_COUNTER = [
  "D5 - C5 - Bb4 - A4 Bb4",
  "E5 - D5 - C5 - B4 C5",
  "E5 - - D5 C5 - B4 A4",
  "A4 - F4 - A4 - D5 C5",
  "D5 - - - F5 - D5 Bb4",
  "E5 - - - G5 - E5 G5",
  "C5 - - - G5 - A5 -",
  "A4 - E5 - C#5 - - -",
];

/** ホルンの内声: 和音をゆっくり上がる */
const B_HORN = [
  "Bb3 - D4 - F4 - - -",
  "C4 - E4 - G4 - - -",
  "A3 - C4 - E4 - - -",
  "F4 - - - D4 - A3 -",
  "G3 - Bb3 - D4 - F4 -",
  "G3 - Bb3 - C4 - - -",
  "A4 - - - F4 - E4 -",
  "C#4 - E4 - G4 - - -",
];

// ---------------------------------------------------------------- セクション

const INTRO = {
  name: "前奏（月の出）", prog: "i–VI–iv7–V7（短調の循環）", key: DM, feel: "intro", pad: "hold", choir: true, timp: "rollEnd", mute: ["arp"],
  chords: ["Dm", "Dm", "Bb", "Bb", "Gm7", "Gm7", "A7", "A7"],
  lead: [...rests(7), "A5 G5 E5 C#5 A4 C#5 E5 G5"],
  parts: {
    horn: ["A3 - D4 - F4 - - -", REST, REST, REST, "G4 - Bb4 - D5 - - -", REST, "A4 - C#5 - E5 - G5 -", REST],
    dem: [REST, REST, "D4 - Bb3 - F3 - - -", REST, REST, "Bb3 - G3 - D3 - - -", "C#4 - E4 - G4 - A4 -", REST],
  },
};

const A = { name: "A メロ（勇者）", prog: EPIC_PROG, key: DM, feel: "normal", comp: "auto", chords: EPIC, lead: HERO, timp: "beats" };

const B = { name: "B メロ", prog: ROYAL_PROG, key: F_MAJOR, feel: "big", comp: "auto", chords: ROYAL, lead: B_LEAD, pad: "hold", brass: "half", vln: 0, mute: ["arp"] };

const DEMON_THEME = {
  name: "魔王の主題", prog: EPIC_PROG, key: DM, feel: "normal", comp: "auto", chords: EPIC, lead: rests(8),
  groove: "march", pad: "trem", timp: "drive", choir: true, bassStyle: "gallop",
  mute: ["arp", "double"], mix: { strings: 0.8 },
  parts: { dem: DEMON },
  // 主題が伸ばす所で、高い弦が走って笑う
  bell: [REST, "D6 - - - . . . .", REST, "G5 - - - C6 - - -", REST, "F6 - - - . . . .", REST, "A5 - C#6 - E6 - - -"],
};

const A2 = {
  name: "A' メロ（2 人同時）", prog: EPIC_PROG, key: DM, feel: "normal", comp: "auto", chords: EPIC, lead: HERO,
  pad: "pulse", timp: "beats", brass: "stab", mute: ["double", "arp"],
  parts: { dem: DEMON },
};

const B2 = {
  name: "B' メロ", prog: ROYAL_PROG, key: F_MAJOR, feel: "big", comp: "auto", chords: ROYAL, lead: B_LEAD,
  counter: B_COUNTER, pad: "hold", brass: "off", timp: "beats", mute: ["arp"],
  parts: { horn: B_HORN },
};

// ---- 輪舞: 同じ 4 小節の和音の上で、同じ線の並びを 4 小節ずつ遅れて追いかける（パッヘルベルのカノンと同じ作り）

const L1 = ["D4 - - - F4 - A4 -", "E4 - - - C4 - E4 -", "F4 - - - D4 - Bb3 -", "C4 - - - A3 - C4 -"];
const L2 = ["A4 - F4 - D4 E4 F4 G4", "A4 - E4 - C4 D4 E4 C4", "D5 - Bb4 - F4 G4 A4 Bb4", "C5 - A4 - F4 G4 A4 C5"];
const L3 = ["D5 C5 D5 A4 F4 A4 D5 F5", "E5 D5 E5 C5 A4 C5 E5 A5", "F5 E5 F5 D5 Bb4 D5 F5 Bb5", "A5 G5 A5 F5 C5 F5 A5 C6"];
const L4 = [
  "D6 C6 A5 F5 D5 F5 A5 C6 D6 C6 A5 F5 D5 E5 F5 A5",
  "E6 D6 C6 A5 E5 A5 C6 D6 E6 D6 C6 A5 E5 F5 G5 A5",
  "D6 C6 Bb5 F5 D5 F5 Bb5 C6 D6 C6 Bb5 F5 D5 E5 F5 G5",
  "A5 G5 F5 C5 A4 C5 F5 G5 A5 C6 A5 F5 C5 D5 E5 F5",
];
const GROUND = ["Dm", "Am", "Bb", "F"];
const ROUND_CHORDS = [...GROUND, ...GROUND, ...GROUND, ...GROUND, "Gm", "Dm", "Gm", "A7"];

const ROUND = {
  name: "輪舞（4 声のカノン）", prog: "i–v–VI–III × 4（カノン進行の前半）/ iv–i–iv–V（後半）", key: DM, feel: "normal", calm: true,
  chords: ROUND_CHORDS, bassStyle: "gallop", groove: "march", timp: "beats", pad: "hold", mix: { strings: 0.7 }, mute: ["arp", "double", "power"],
  lead: [
    ...rests(12), ...L4,
    "D6 - Bb5 G5 D5 G5 Bb5 D6", "F6 - D6 A5 F5 A5 D6 F6", "G6 - D6 Bb5 G5 Bb5 D6 G6", "E6 - C#6 - A5 - G5 -",
  ],
  parts: {
    dem: [...at(L1, -12), ...at(L2, -12), ...at(L3, -12), ...at(L2, -12),
      "G3 - - - D4 - G4 -", "F4 - - - A3 - D4 -", "Bb3 - - - G3 - Bb3 -", "A3 - - - E4 - G4 -"],
    horn: [...rests(4), ...L1, ...L2, ...at(L3, -12),
      "Bb4 - - - G4 - D4 -", "A4 - - - F4 - A4 -", "D4 - - - D5 - G4 -", "A4 - - - C#5 - E5 -"],
    canon: [...rests(8), ...at(L1, 12), ...at(L2, 12),
      "D5 - G5 - Bb5 - - -", "D5 - F5 - A5 - - -", "D5 - G5 - Bb5 - - -", "E5 - G5 - A5 - - -"],
  },
};

const C = {
  name: "C メロ（月光）", prog: "I–V–vi–iii–IV–I–IV–V（カノン進行）", key: F_MAJOR, feel: "ballad", echo: 0.1, pad: "hold", choir: true, mix: { choir: 0.7 }, mute: ["comp", "power"],
  chords: ["F", "C", "Dm", "Am", "Bb", "F", "Bb", "C"],
  lead: [
    "A5 - - - - - G5 A5",
    "G5 - - - E5 - - -",
    "F5 - - - - - E5 F5",
    "E5 - - - C5 - - -",
    "D5 - - - F5 - Bb5 -",
    "A5 - - - - - C6 -",
    "D6 - - - Bb5 - A5 G5",
    "G5 - - - - - . .",
  ],
  parts: {
    cello: [
      "F3 - - - C4 - A3 -",
      "G3 - - - C4 - E4 -",
      "A3 - - - F4 - D4 -",
      "C4 - - - E4 - A3 -",
      "Bb3 - - - D4 - F4 -",
      "C4 - - - A3 - F3 -",
      "Bb3 - - - D4 - F4 -",
      "E4 - - - C4 - G3 -",
    ],
  },
  bell: [REST, REST, REST, REST, REST, "F6 - - - - - . .", REST, "C6 - E6 - G6 - - -"],
};

const SOLO_HERO = {
  name: "ソロ（勇者）", prog: EPIC_PROG, key: DM, feel: "normal", solo: true, comp: "auto", chords: EPIC, timp: "beats", mute: ["arp"], pad: "hits", mix: { strings: 0.7 },
  lead: [
    "A4 D5 F5 A5 D6 - A5 F5 D6 C6 A5 F5 E5 F5 A5 C6",
    "D6 - Bb5 F5 D5 F5 Bb5 D6 F6 - D6 Bb5 F5 G5 A5 Bb5",
    "C6 - A5 F5 C5 F5 A5 C6 F6 - C6 A5 G5 A5 Bb5 C6",
    "E6 D6 C6 G5 E5 G5 C6 D6 E6 - C6 - G5 - . .",
    "F5 - . F5 A5 - . A5 D6 - . D6 F6 - D6 -",
    "D6 C6 Bb5 A5 Bb5 F5 D5 F5 Bb5 A5 G5 F5 G5 A5 Bb5 C6",
    "D6 Bb5 G5 Bb5 D6 F6 D6 Bb5 G5 F5 D5 F5 G5 Bb5 D6 F6",
    "E6 C#6 A5 G5 E5 C#5 A4 C#5 E5 G5 A5 C#6 E6 - . .",
  ],
};

const SOLO_DEMON = {
  name: "ソロ（魔王）", prog: "i–iv7–VII7–III△7–VI△7–iiø–V7–i（短調の 5 度圏）", key: DM, feel: "normal", calm: true, comp: "auto", timp: "drive", groove: "march", bassStyle: "gallop", pad: "pulse", mute: ["arp", "double"], mix: { strings: 0.7 },
  chords: ["Dm", "Gm7", "C7", "Fmaj7", "Bbmaj7", "Em7b5", "A7", "Dm"],
  lead: rests(8),
  parts: {
    fiend: [
      "D4 . . D4 F4 . A4 . D5 - C5 A4 F4 E4 D4 C#4",
      "D4 . . D4 G4 . Bb4 . D5 - Bb4 G4 F4 D4 Bb3 A3",
      "G3 . . G3 C4 . E4 . G4 - Bb4 G4 E4 C4 Bb3 G3",
      "A3 - C4 E4 F4 - A4 C5 E5 - C5 A4 F4 E4 C4 A3",
      "Bb3 D4 F4 A4 Bb4 - A4 F4 D4 F4 A4 Bb4 D5 - . .",
      "E5 D5 Bb4 G4 E4 G4 Bb4 D5 E5 - D5 Bb4 G4 E4 Bb3 G3",
      "A3 C#4 E4 G4 A4 C#5 E5 G5 A5 G5 E5 C#5 A4 G4 E4 C#4",
      "D4 - - - A3 - - - D3 - - - . . . .",
    ],
  },
};

/** 掛け合い: 2 小節ずつ → 1 小節ずつ → 半小節ずつ → 2 人で同じ線 */
const TRADE = {
  name: "掛け合い（勇者と魔王）", prog: "vi–IV–V–I × 2（小室進行）/ ii7–V7–I△7–IV△7–viiø–III7–vi–III7（5 度圏）", key: DM, feel: "big", solo: true, comp: "auto", pad: "hits", timp: "drive", mix: { strings: 0.7 },
  chords: ["Dm", "Bb", "C", "F", "Dm", "Bb", "C", "F", "Gm7", "C7", "Fmaj7", "Bbmaj7", "Em7b5", "A7", "Dm", "A7"],
  lead: [
    "A5 - F5 A5 D6 - A5 F5 D5 - F5 A5 D6 - . .",
    "D6 - Bb5 D6 F6 - D6 Bb5 F5 G5 A5 Bb5 D6 - . .",
    REST,
    REST,
    "F5 A5 D6 F6 - D6 A5 F5 E5 F5 A5 C6 D6 - . .",
    "F5 Bb5 D6 F6 - D6 Bb5 F5 D5 F5 Bb5 C6 D6 - . .",
    REST,
    REST,
    "G5 Bb5 D6 F6 D6 Bb5 G5 Bb5 D6 - Bb5 - G5 - . .",
    REST,
    "A5 C6 E6 C6 A5 F5 A5 C6 E6 - C6 - A5 - . .",
    REST,
    "E6 D6 Bb5 G5 E5 G5 Bb5 D6 . . . . . . . .",
    ". . . . . . . . C#6 A5 G5 E5 C#5 E5 A5 G5",
    "D6 - A5 F5 D5 F5 A5 C6 D6 - . . F6 - . .",
    "E6 - C#6 - A5 - G5 - E5 - C#5 - A4 - . .",
  ],
  parts: {
    fiend: [
      REST,
      REST,
      "G3 - E3 G3 C4 - G3 E3 C3 - E3 G3 C4 - . .",
      "C4 - A3 C4 F4 - C4 A3 F3 G3 A3 C4 F4 - . .",
      REST,
      REST,
      "E3 G3 C4 E4 - C4 G3 E3 D3 E3 G3 Bb3 C4 - . .",
      "A3 C4 F4 A4 - F4 C4 A3 G3 A3 C4 E4 F4 - . .",
      REST,
      "G3 Bb3 C4 E4 G4 E4 C4 E4 G4 - E4 - C4 - . .",
      REST,
      "Bb3 D4 F4 A4 Bb4 A4 F4 D4 F4 - D4 - Bb3 - . .",
      ". . . . . . . . E4 G4 Bb4 D5 E5 - . .",
      "C#5 A4 G4 E4 C#4 E4 A4 G4 . . . . . . . .",
      "D4 - A3 F3 D3 F3 A3 C4 D4 - . . F4 - . .",
      "E4 - C#4 - A3 - G3 - E3 - C#3 - A2 - . .",
    ],
  },
};

const A3 = {
  name: "A'' メロ（3 声）", prog: EPIC_PROG, key: DM, feel: "big", comp: "auto", chords: EPIC, lead: HERO,
  counter: THIRD, pad: "hold", brass: "hits", timp: "drive",
  parts: { dem: DEMON },
};

const DROP = {
  name: "落ち", prog: "i–i△7–i7（マイナークリシェ）–V7/ホ短調", key: DM, feel: "drop", echo: 0.1, pad: "hold", timp: "rollEnd", comp: "auto",
  chords: ["Dm", "DmM7/C#", "Dm7/C", "B7"],
  lead: [
    "A5 - - - F5 - D5 F5",
    "A5 - - - F5 - D5 F5",
    "A5 - - - F5 - D5 F5",
    "B5 - - - F#5 - D#5 F#5",
  ],
  bass: ["D2 - - - - - - -", "C#2 - - - - - - -", "C2 - - - - - - -", "B1 - - - - - - -"],
};

/** 大サビ: B を全音上で。最後に最高音 G6 へ */
const TOP = {
  name: "大サビ（ホ短調）", prog: "IV–V–iii–vi / ii7–V7–I△7–V7/vi → IV–V–vi（ト長調の度数）", key: G_MAJOR, feel: "big", comp: "auto",
  chords: ["C", "D", "Bm", "Em", "Am7", "D7", "Gmaj7", "B7", "C", "D", "Em", "Em"],
  lead: [
    ...at(B_LEAD, 2),
    "E6 - G6 - - F#6 E6 G5",
    "D6 - F#6 - A5 - D6 F#6",
    "G6 - - - - - - -",
    ". . E6 B5 G5 E5 B4 G4",
  ],
  counter: [...at(B_COUNTER, 2), "G5 - E5 - C5 - E5 -", "F#5 - D5 - F#5 - A5 -", "E5 - - - - - - -", REST],
  pad: "hold", brass: "half", timp: "drive", choir: true, vln: 0, mute: ["arp"],
  crash: [0, 4, 10],
  parts: { horn: [...at(B_HORN, 2), "C4 - E4 - G4 - - -", "D4 - F#4 - A4 - - -", "B4 - - - - - - -", REST] },
};

const END = {
  name: "結び", prog: "C–B♭–A7（全音で下りて、ニ短調の V7 へ）", key: EM, feel: "normal", comp: "auto", brass: "hits", timp: "rollEnd", pad: "pulse", calm: true,
  chords: ["C", "Bb", "A7", "A7"],
  lead: [
    "E6 - C6 G5 E5 - G5 C6",
    "D6 - Bb5 F5 D5 - F5 Bb5",
    "C#6 - A5 E5 C#5 - E5 A5",
    "G5 - E5 C#5 A4 - - .",
  ],
};

export const SECTIONS = [INTRO, A, B, DEMON_THEME, A2, B2, ROUND, C, SOLO_HERO, SOLO_DEMON, TRADE, A3, DROP, TOP, END];

export default epicSong({
  title: "望月の決闘",
  description: "満月の運命の日、主人公と魔王が対峙する。全力を出せることが、2 人ともどこか楽しい。ニ短調 → ホ短調・156 BPM。勇者の主題と魔王の主題を別々に提示してから同時に鳴らし（二重対位）、4 声のカノン、それぞれのソロ、2 小節 → 1 小節 → 半小節と詰まる掛け合いを経て、全音上の大サビへ。エピック進行・王道進行・カノン進行・小室進行・短調の 5 度圏・マイナークリシェ。",
  bpm: 156,
  sections: SECTIONS,
  loopFrom: 1,
  kit: "acoustic",
  drumVol: 0.6,
  vol: { lead: 1.2 },
  bassStyle: "16th",
  parts: [
    { key: "dem", name: "魔王（トロンボーン）", inst: "trombone", pan: "C", vol: 0.13, reverb: 0.3, attack: 0.02 },
    { key: "fiend", name: "魔王のソロ（FM ブラス）", inst: "fm-brass", pan: "C", vol: 0.13, reverb: 0.25 },
    { key: "horn", name: "ホルン", inst: "horn", pan: "R", vol: 0.09, reverb: 0.4, attack: 0.03 },
    { key: "canon", name: "ヴァイオリン（カノン）", inst: "violin", pan: "R", vol: 0.05, reverb: 0.4, attack: 0.03, role: "descant" },
    { key: "cello", name: "チェロ", inst: "cello", pan: "L", vol: 0.08, reverb: 0.4 },
  ],
  tempo: { 7: { 8: 0.97, 12: 0.9, 14: 0.8 }, 8: { 0: 1 } },
});
