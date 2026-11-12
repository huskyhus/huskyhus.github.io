// 「遠ざかる町」: ニ長調 → ホ長調・150 BPM・128 小節。高速鉄道で故郷を離れ、遠い異国の地へ。小さくなっていく町への郷愁と、新しい生活への期待と不安。
// 全体を貫くのは線路の刻み（タタ・タタ）。前奏は発車: テンポを上げながら走り出す（最初の 1 回だけ）。
// 前奏 → A（故郷）→ B → A' → B' → トンネル（不安。3 声のカノン）→ 平原（期待。変ロ長調）→ ヴァイオリンのソロ → ピアノのソロ → 掛け合い（故郷と異国）→ 思い出（A をオルゴールで）→ つなぎ → 大サビ（全音上）→ A（全音上）→ 結び → A へ。
//
// コード進行:
//   A: I–V–vi–iii–IV–I–IV–V（カノン進行）/ B: IV–V–iii–vi（王道進行）+ ii7–V7–I△7（ツーファイブワン）
//   トンネル: i–i△7–i7–viø（マイナークリシェ）× 3 → VI△7–V7–i → ♭VI7（変ロ長調の V7 へ）
//   平原: 変ロ長調のカノン進行（分数コードの下降ベース）/ ピアノのソロ: ii7–V7–I△7–IV△7–viiø–III7–vi（5 度圏）
//   掛け合い: vi–IV–V–I（小室進行）× 2 → 王道進行 → ii7–V7–I–V7 / 結び: ♭VI–♭VII–I（マリオ終止）→ IV7 ではなく A7 でニ長調へ
import { epicSong, at, rests, REST } from "../lib/epicband.js";

const D_MAJOR = { tonic: 2, mode: "major" };
const BM = { tonic: 11, mode: "minor" };
const BB_MAJOR = { tonic: 10, mode: "major" };
const E_MAJOR = { tonic: 4, mode: "major" };

// ---------------------------------------------------------------- 主題

const CANON = ["D", "A", "Bm", "F#m", "G", "D", "G", "A"];
const CANON_PROG = "I–V–vi–iii–IV–I–IV–V（カノン進行）";

/** 故郷の主題: ゆっくり上がって、伸ばしてから下りる。伸ばす音が、遠ざかる町を見ている */
const HOME = [
  "A4 - D5 - F#5 - - E5",
  "E5 - - - C#5 - E5 -",
  "B4 - D5 - F#5 - - A5",
  "A5 - - - F#5 - A5 -",
  "D5 - G5 - B5 - - A5",
  "A5 - - - F#5 - D5 -",
  "E5 - G5 - B5 - A5 G5",
  "A5 - - - E5 - C#5 A4",
];

/** チェロの対旋律: 主題が伸ばす所で動く（主題とはおもに 3 度と 6 度） */
const HOME_CELLO = [
  "F#4 - - - A4 - - -",
  "A4 - G4 - E4 - C#4 -",
  "D4 - F#4 - B4 - - D5",
  "C#5 - - - A4 - F#4 -",
  "G4 - - - D4 - G4 -",
  "F#4 - A4 - D5 - A4 -",
  "B4 - - - G4 - D5 -",
  "C#5 - - - A4 - E4 -",
];

const ROYAL = ["G", "A", "F#m", "Bm", "Em7", "A7", "Dmaj7", "A7"];
const ROYAL_PROG = "IV–V–iii–vi（王道進行）/ ii7–V7–I△7（ツーファイブワン）–V7";

const B_LEAD = [
  "D6 - - - B5 - A5 G5",
  "C#6 - - - A5 - G5 E5",
  "F#5 - A5 - C#6 - B5 A5",
  "B5 - - - F#5 - D5 F#5",
  "G5 - B5 - D6 - - B5",
  "C#6 - - - E6 - - C#6",
  "D6 - - - A5 - F#5 A5",
  "A5 - C#6 - E6 - C#6 A5",
];

const B_COUNTER = [
  "B4 - D5 - G5 - E5 -",
  "A4 - C#5 - E5 - C#5 -",
  "A4 - C#5 - F#5 - - E5",
  "D5 - - - B4 - F#4 B4",
  "E5 - D5 - B4 - - D5",
  "E5 - G5 - A5 - G5 E5",
  "F#5 - E5 - D5 - - F#5",
  "C#5 - E5 - G5 - E5 C#5",
];

const B_CELLO = [
  "G3 - B3 - D4 - - -",
  "A3 - C#4 - E4 - - -",
  "F#3 - A3 - C#4 - - -",
  "B3 - D4 - F#4 - - -",
  "G3 - B3 - E4 - - -",
  "G3 - A3 - C#4 - - -",
  "F#3 - A3 - D4 - - -",
  "G3 - A3 - C#4 - - -",
];

// ---------------------------------------------------------------- セクション

const INTRO = {
  name: "前奏（発車）", prog: CANON_PROG, key: D_MAJOR, feel: "soft", chords: CANON, comp: "auto", groove: "rail", bassStyle: "rail",
  lead: rests(8), mute: ["perc"],
  // 発車のベルのように、主題の頭だけ
  bell: ["A5 - D6 - F#6 - - E6", "E6 - - - . . . .", REST, REST, "D6 - G6 - B6 - - A6", "A6 - - - . . . .", REST, REST],
  pad: "hold", mix: { strings: 0.6, bell: 2.2 },
};

const A = { name: "A メロ（故郷）", prog: CANON_PROG, key: D_MAJOR, feel: "normal", chords: CANON, comp: "auto", calm: true, lead: HOME, groove: "rail", bassStyle: "rail", mute: ["double", "power"] };

const B = { name: "B メロ", prog: ROYAL_PROG, key: D_MAJOR, feel: "big", chords: ROYAL, comp: "auto", lead: B_LEAD, pad: "hold", vln: -12, bassStyle: "rail", groove: "railBig", mute: ["power"] };

const A2 = { ...A, name: "A' メロ（チェロと）", pad: "hold", mix: { strings: 0.7 }, parts: { cello: HOME_CELLO } };

/** B'。最後の和音を F#7 にして、平行短調のトンネルへ落ちる */
const B2 = {
  ...B, name: "B' メロ", brass: "half", timp: "beats", vln: undefined,
  chords: [...ROYAL.slice(0, 7), "F#7"],
  lead: [...B_LEAD.slice(0, 7), "A#5 - C#6 - F#6 - E6 C#6"],
  parts: { cello: [...B_CELLO.slice(0, 7), "F#3 - A#3 - C#4 - - -"] },
  prog: "IV–V–iii–vi（王道進行）/ ii7–V7–I△7 –III7（平行短調の V7）",
  counter: [...B_COUNTER.slice(0, 7), "C#5 - E5 - A#5 - - -"],
};

// ---- トンネル: マイナークリシェの 4 小節の上で、3 つの線を 4 小節ずつ遅れて重ねる（不安が膨らむ）

const CLICHE = ["Bm", "BmM7/A#", "Bm7/A", "G#m7b5"];
const T1 = ["F#4 - B4 - D5 - - C#5", "D5 - - - A#4 - F#4 -", "A4 - D5 - F#5 - - E5", "D5 - - - B4 - G#4 -"];
const T2 = ["B3 D4 F#4 B4 D5 B4 F#4 D4", "A#3 D4 F#4 A#4 D5 A#4 F#4 D4", "A3 D4 F#4 A4 D5 A4 F#4 D4", "G#3 B3 D4 F#4 B4 F#4 D4 B3"];
const T3 = [
  "F#5 E5 D5 C#5 D5 B4 F#4 B4 D5 C#5 D5 F#5 B5 F#5 D5 B4",
  "F#5 D5 A#4 D5 F#5 A#5 F#5 D5 A#4 D5 F#5 A#5 B5 A#5 F#5 D5",
  "E5 D5 A4 D5 F#5 A5 F#5 D5 A4 D5 F#5 A5 B5 A5 F#5 D5",
  "D5 B4 G#4 B4 D5 F#5 D5 B4 G#4 B4 D5 F#5 G#5 F#5 D5 B4",
];

const TUNNEL = {
  name: "トンネル（3 声のカノン）", prog: "i–i△7–i7–viø（マイナークリシェ）× 3 / VI△7–V7–i–♭VI7", key: BM, feel: "normal", calm: true,
  chords: [...CLICHE, ...CLICHE, ...CLICHE, "Gmaj7", "F#7", "Bm", "F7"],
  groove: "rail", bassStyle: "rail", timp: "drive", pad: "trem", mix: { strings: 0.55 }, mute: ["arp", "double", "power", "perc"],
  lead: [
    ...rests(8), ...at(T1, 12),
    "B5 - - - G5 - D5 G5", "A#5 - - - F#5 - C#5 F#5", "B5 - F#5 - D5 - F#5 B5", "A5 - F5 - C5 - Eb5 F5",
  ],
  parts: {
    cello: [...at(T1, -12), ...at(T2, 0), ...at(T2, 0),
      "G3 - B3 - D4 - - -", "F#3 - A#3 - C#4 - - -", "F#3 - B3 - D4 - - -", "A3 - C4 - Eb4 - - -"],
    viola: [...rests(4), ...T1, ...T3,
      "D5 - - - B4 - G4 -", "C#5 - - - A#4 - F#4 -", "D5 - - - B4 - F#4 -", "C5 - - - A4 - F4 -"],
  },
};

// ---- 平原: トンネルを抜けて半音下の変ロ長調へ。カノン進行を、分数コードの下降ベースで

const PLAIN_CHORDS = ["Bb", "F/A", "Gm", "Dm/F", "Eb", "Bb/D", "Cm7", "F7"];
const PLAIN = {
  name: "平原（期待）", prog: "I–V⁶–vi–iii⁶–IV–I⁶–ii7–V7（カノン進行）", key: BB_MAJOR, feel: "big", chords: PLAIN_CHORDS, comp: "auto", pad: "hold", brass: "half", timp: "beats", bassStyle: "rail", groove: "railBig", vln: 0, mute: ["power", "arp"],
  lead: [
    "D5 F5 Bb5 - - A5 Bb5 C6",
    "C6 - - - A5 - F5 -",
    "Bb5 - G5 - D5 - G5 Bb5",
    "A5 - - - F5 - D5 -",
    "G5 - Bb5 - Eb6 - D6 C6",
    "D6 - - - Bb5 - F5 -",
    "Eb6 - C6 - G5 - Bb5 -",
    "A5 - C6 - Eb6 - D6 C6",
  ],
  parts: {
    cello: [
      "Bb3 - D4 - F4 - - -",
      "A3 - C4 - F4 - - -",
      "G3 - Bb3 - D4 - - -",
      "F3 - A3 - D4 - - -",
      "Eb4 - - - G4 - - -",
      "F4 - - - D4 - - -",
      "G4 - - - Eb4 - - -",
      "F4 - - - A3 - - -",
    ],
  },
};

const SOLO_VLN = {
  name: "ソロ（ヴァイオリン）", prog: "カノン進行（変ロ長調）", key: BB_MAJOR, feel: "normal", calm: true, solo: true, chords: PLAIN_CHORDS, comp: "auto", groove: "rail", bassStyle: "rail", mute: ["double", "power"],
  lead: rests(8),
  parts: {
    violin: [
      "D5 F5 Bb5 D6 F6 - D6 Bb5 C6 D6 C6 Bb5 A5 Bb5 C6 D6",
      "C6 A5 F5 A5 C6 F6 C6 A5 F5 - A5 C6 F6 - . .",
      "Bb5 D6 G6 - D6 Bb5 G5 Bb5 D6 C6 Bb5 A5 G5 A5 Bb5 D6",
      "A5 F5 D5 F5 A5 D6 A5 F5 D5 - F5 A5 D6 - . .",
      "G5 Bb5 Eb6 G6 - Eb6 Bb5 G5 Bb5 C6 D6 Eb6 G6 F6 Eb6 D6",
      "D6 - F6 - Bb6 - F6 D6 Bb5 - D6 F6 Bb6 - . .",
      "G6 Eb6 C6 G5 Eb5 G5 C6 Eb6 G6 F6 Eb6 D6 C6 Bb5 G5 Bb5",
      "A5 C6 Eb6 F6 A6 F6 Eb6 C6 A5 F5 A5 C6 Eb6 F6 . .",
    ],
  },
};

const SOLO_PIANO = {
  name: "ソロ（ピアノ）", prog: "ii7–V7–I△7–IV△7–viiø–III7–vi–vi（5 度圏。ニ長調へ戻る）", key: D_MAJOR, feel: "normal", calm: true, solo: true, comp: "auto", groove: "rail", bassStyle: "rail", mute: ["double", "power", "arp"], pad: "hold", mix: { strings: 0.6 },
  chords: ["Em7", "A7", "Dmaj7", "Gmaj7", "C#m7b5", "F#7", "Bm", "Bm"],
  lead: rests(8),
  parts: {
    piano: [
      "E5 G5 B5 D6 E6 D6 B5 G5 E5 G5 B5 D6 G6 E6 D6 B5",
      "C#6 A5 G5 E5 C#5 E5 G5 A5 C#6 E6 C#6 A5 G5 E5 C#5 E5",
      "F#5 A5 C#6 F#6 E6 C#6 A5 F#5 D5 F#5 A5 C#6 D6 C#6 A5 F#5",
      "G5 B5 D6 F#6 D6 B5 G5 F#5 G5 B5 D6 G6 F#6 D6 B5 G5",
      "E5 G5 C#6 E6 G6 E6 C#6 B5 G5 E5 C#5 E5 G5 B5 C#6 E6",
      "F#6 E6 C#6 A#5 F#5 A#5 C#6 E6 F#6 - E6 C#6 A#5 F#5 E5 C#5",
      "D5 F#5 B5 D6 F#6 D6 B5 F#5 D5 F#5 B5 D6 F#6 - D6 B5",
      "F#6 D6 B5 F#5 D5 B4 F#4 B4 D5 F#5 B5 D6 . . . .",
    ],
  },
};

/** 掛け合い: オーボエ（故郷）とヴァイオリン（異国）。最後は 3 度で一緒に */
const TRADE = {
  name: "掛け合い（故郷と異国）", prog: "vi–IV–V–I × 2（小室進行）/ IV–V–iii–vi（王道進行）/ ii7–V7–I–V7", key: D_MAJOR, feel: "big", solo: true, comp: "auto", pad: "hold", mix: { strings: 0.7 }, bassStyle: "rail", groove: "railBig", mute: ["power"],
  chords: ["Bm", "G", "A", "D", "Bm", "G", "A", "D", "G", "A", "F#m", "Bm", "Em7", "A7", "D", "A7"],
  lead: [
    "F#5 - - D5 B4 - D5 F#5",
    "B5 - - G5 D5 - G5 B5",
    REST,
    REST,
    "D6 - B5 F#5 D5 - F#5 B5",
    "D6 - B5 G5 D5 - G5 B5",
    REST,
    REST,
    "D6 - - B5 G5 - B5 D6",
    REST,
    "C#6 - - A5 F#5 - A5 C#6",
    REST,
    "G5 - B5 - E6 - . .",
    ". . . . E6 - G5 -",
    "F#5 - A5 - D6 - - -",
    "E5 - G5 - C#6 - E6 -",
  ],
  parts: {
    violin: [
      REST,
      REST,
      "E5 A5 C#6 E6 - C#6 A5 E5 C#5 E5 A5 C#6 E6 - . .",
      "F#5 A5 D6 F#6 - D6 A5 F#5 D5 F#5 A5 D6 F#6 - . .",
      REST,
      REST,
      "C#6 E6 A6 C#6 - A5 E5 C#5 A4 C#5 E5 A5 C#6 - . .",
      "D6 F#6 A6 D6 - A5 F#5 D5 A4 D5 F#5 A5 D6 - . .",
      REST,
      "A5 C#6 E6 A6 E6 C#6 A5 E5 C#6 - E6 - A6 - . .",
      REST,
      "B5 D6 F#6 B6 F#6 D6 B5 F#5 D6 - F#6 - B6 - . .",
      ". . . . . . . . G5 B5 D6 E6 G6 - . .",
      "C#6 A5 G5 E5 C#5 E5 G5 A5 . . . . . . . .",
      "A5 - D6 - F#6 - - -",
      "G5 - C#6 - E6 - G6 -",
    ],
  },
};

/** 思い出: 線路の音だけが残り、故郷の主題をオルゴールで */
const MEMORY = {
  name: "思い出", prog: CANON_PROG, key: D_MAJOR, feel: "drop", chords: CANON, comp: "auto", echo: 0.2, pad: "hold", mix: { strings: 0.5 }, choir: true, groove: "railSoft", mute: ["comp"],
  lead: rests(8),
  bell: at(HOME, 12),
  parts: { cello: HOME_CELLO },
};

const TURN = {
  name: "つなぎ", prog: "♭VI–♭VII–V7/ホ長調（上がっていく）", key: E_MAJOR, feel: "normal", calm: true, comp: "auto", chords: ["Bb", "C", "D", "B7"], pad: "trem", timp: "rollEnd", groove: "rail", bassStyle: "rail", mute: ["double", "arp", "power"],
  lead: [
    "F5 - Bb5 - D6 - - C6",
    "G5 - C6 - E6 - - D6",
    "A5 - D6 - F#6 - - E6",
    "D#6 - - - F#6 - B6 -",
  ],
};

const TOP_B = {
  name: "大サビ（ホ長調）", prog: "IV–V–iii–vi（王道進行）/ ii7–V7–I△7–V7", key: E_MAJOR, feel: "big", comp: "auto", pad: "hold", brass: "half", timp: "drive", choir: true, bassStyle: "rail", groove: "railBig", mute: ["power", "arp"], vln: 0,
  chords: ["A", "B", "G#m", "C#m", "F#m7", "B7", "Emaj7", "B7"],
  lead: at(B_LEAD, 2),
  counter: at(B_COUNTER, 2),
  parts: { cello: at(B_CELLO, 2) },
  crash: [0, 4],
};

const TOP_A = {
  name: "A''（異国に着く）", prog: "カノン進行（ホ長調）", key: E_MAJOR, feel: "big", comp: "auto", pad: "hold", brass: "off", timp: "beats", bassStyle: "rail", groove: "railBig", mute: ["power", "arp"], vln: 0,
  chords: ["E", "B", "C#m", "G#m", "A", "E", "A", "B"],
  lead: at(HOME, 14),
  parts: { cello: at(HOME_CELLO, 2) },
};

const END = {
  name: "結び", prog: "♭VI–♭VII–I（マリオ終止）/ V7（ニ長調へ）", key: E_MAJOR, feel: "big", comp: "auto", pad: "hold", brass: "hits", timp: "rollEnd", bassStyle: "rail", groove: "railBig", mute: ["power", "arp"], 
  chords: ["C", "D", "E", "A7"],
  lead: [
    "E6 - G6 - C6 - E6 G6",
    "F#6 - A6 - D6 - F#6 A6",
    "G#6 - - - - - - -",
    "G6 - E6 - C#6 - A5 -",
  ],
};

export const SECTIONS = [INTRO, A, B, A2, B2, TUNNEL, PLAIN, SOLO_VLN, SOLO_PIANO, TRADE, MEMORY, TURN, TOP_B, TOP_A, END];

// ---------------------------------------------------------------- 線路の刻み

/** タタ・タタ（16 分の 2 つずつ）を、ベースとドラムに通す */
const RAIL = [0, 3, 4, 7, 8, 11, 12, 15];
const rail = ({ t, pos, b }, kit, level = 1) => {
  if (RAIL.includes(pos)) kit.hat(t, false, (pos % 4 === 0 ? 0.05 : 0.03) * level);
  if (pos % 2 === 1 && !RAIL.includes(pos)) kit.shaker(t, 0.02 * level);
};

export default epicSong({
  title: "遠ざかる町",
  description: "高速鉄道で故郷を離れ、遠い異国の地へ。小さくなっていく町への郷愁と、新しい生活への期待と不安。ニ長調 → ホ長調・150 BPM。発車で加速する前奏、線路の刻みの上に歌う故郷の主題、マイナークリシェの上の 3 声のカノン（トンネル）、半音下の変ロ長調（平原）、ヴァイオリンとピアノのソロ、故郷と異国の掛け合い、オルゴールの思い出を経て、全音上で異国に着く。カノン進行・王道進行・小室進行・5 度圏・マイナークリシェ・マリオ終止。",
  bpm: 150,
  sections: SECTIONS,
  loopFrom: 1,
  kit: "acoustic",
  drumVol: 0.75,
  inst: { lead: "oboe", arp: "harp", vln: "strings" },
  vol: { arp: 1.6, lead: 1.7 },
  off: ["double"],
  bassStyle: "rail",
  bassStyles: {
    rail: ({ t, pos, s16, bass }, voice) => { if (RAIL.includes(pos)) voice(t, s16 * 0.8, pos % 8 === 4 ? bass + 12 : bass, pos % 4 === 0 ? 1 : 0.7); },
  },
  grooves: {
    rail(x, kit) {
      const { t, pos, b } = x;
      rail(x, kit);
      if (b.last && pos >= 12 && !b.noFill) { kit.snare(t, 0.08 + (pos - 12) * 0.03); return; }
      if (pos === 0 || pos === 8) kit.kick(t, 0.6);
      if (pos === 4 || pos === 12) kit.snare(t, 0.14);
    },
    railBig(x, kit) {
      const { t, pos, b } = x;
      rail(x, kit, 1.2);
      if (b.first && pos === 0) kit.crash(t);
      if (b.sec.crash?.includes(b.index) && pos === 0 && !b.first) kit.crash(t);
      if (b.last && pos >= 12 && !b.noFill) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }
      if ([0, 6, 8, 11].includes(pos)) kit.kick(t);
      if (pos === 4 || pos === 12) kit.snare(t);
    },
    railSoft(x, kit) {
      const { t, pos, b } = x;
      rail(x, kit, 0.6);
      if (b.last && pos >= 8) kit.snare(t, 0.06 + (pos - 8) * 0.02);
    },
  },
  parts: [
    { key: "cello", name: "チェロ", inst: "cello", pan: "L", vol: 0.1, reverb: 0.4, attack: 0.03 },
    { key: "viola", name: "ヴィオラ（カノン）", inst: "violin", pan: "R", vol: 0.055, reverb: 0.4, attack: 0.03 },
    { key: "violin", name: "ヴァイオリン（ソロ）", inst: "violin", pan: "R", vol: 0.14, reverb: 0.45, attack: 0.02, role: "descant" },
    { key: "piano", name: "ピアノ（ソロ）", inst: "piano", pan: "C", vol: 0.14, reverb: 0.35, role: "descant" },
  ],
  // 発車: 前奏の 8 小節で、0.62 倍から 1 倍まで上げる
  tempo: Object.fromEntries(Array.from({ length: 8 }, (_, bar) => [bar, { 0: 0.62 + bar * 0.05, 8: 0.645 + bar * 0.05 }]).concat([[8, { 0: 1 }]])),
});
