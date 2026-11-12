// 「鬼神」: ホ短調 → ヘ短調・168 BPM（最後は 182 BPM）・124 小節。武術の達人が道を究めた結果、ついに鬼神となった。
// 前半は端正な型（カタ）。和太鼓の上で旋律を揃え、声部が同じ型を追いかける。後半に行くほど和音が崩れ、テンポが上がり、半音上で人の域を超える。
// 前奏 → A（型）→ B（道）→ A' → B' → 型（3 声のカノン）→ 尺八のソロ → 和太鼓のソロ → 三味線のソロ → 組手（掛け合い）→ 覚醒 → A''（半音上）→ B''（半音上・加速）→ 結び（♭II → i でホ短調へ）→ A へ。
//
// コード進行:
//   A: i–♭II（フリジアン）× 2 / VI–VII–i（エオリアン終止）–V7 / B: IV–V–iii–vi（王道進行）/ ii7–V7–I–V7/vi（ト長調の度数）
//   型: i–♭II の 2 小節の上のカノン / ソロ: i–VII–VI–V7（アンダルシア進行）/ 組手: vi–IV–V–I（小室進行）× 2 → アンダルシア進行 → i–♭II
//   覚醒: i–♭v（三全音）→ 減七を半音ずつ上げる → V7/ヘ短調
import { epicSong, at, rests, REST } from "../lib/epicband.js";

const EM = { tonic: 4, mode: "minor" };
const G_MAJOR = { tonic: 7, mode: "major" };
const FM = { tonic: 5, mode: "minor" };
const AB_MAJOR = { tonic: 8, mode: "major" };

// ---------------------------------------------------------------- 主題

const A_CHORDS = ["Em", "F", "Em", "F", "C", "D", "Em", "B7"];
const A_PROG = "i–♭II（フリジアン）× 2 / VI–VII–i（エオリアン終止）–V7";

/** 型の主題: 陰音階（ミ・ファ・ラ・シ・ド）で、突きと引きのように上下する */
const KATA = [
  "E5 - B4 - E5 F5 E5 B4",
  "F5 - C5 - A4 - C5 A4",
  "E5 - B4 - G4 - B4 G4",
  "F5 - E5 C5 A4 - - -",
  "E5 - G5 - C6 - B5 E5",
  "A5 - F#5 - D5 - F#5 A5",
  "G5 - E5 - B4 - E5 G5",
  "B5 - A5 F#5 D#5 - B4 -",
];

/** 主題に 1 拍遅れて追う、低い声部（和音が同じ間だけ模倣する） */
const KATA_LOW = [
  "E4 - - - B3 - G4 -",
  "A4 - - - C4 - A3 -",
  "G4 - - - E4 - - B3",
  "C4 - A3 - E4 - C4 A3",
  "C4 - E4 - G4 - E4 -",
  "D4 - A3 - F#4 - D4 -",
  "E4 - G4 - E4 - B3 -",
  "D#4 - F#4 - B4 - F#4 -",
];

const B_CHORDS = ["C", "D", "Bm", "Em", "Am7", "D7", "G", "B7"];
const B_PROG = "IV–V–iii–vi（王道進行）/ ii7–V7–I–V7/vi（ト長調の度数）";

/** 道の主題: 高潔に、長く */
const WAY = [
  "G5 - C6 - E6 - - D6",
  "D6 - - - A5 - F#5 A5",
  "B5 - - - F#5 - D5 F#5",
  "G5 - B5 - E6 - - D6",
  "C6 - - - A5 - E5 G5",
  "D6 - C6 A5 F#5 - A5 C6",
  "B5 - - - G5 - D5 G5",
  "F#5 - A5 - B5 - D#6 -",
];

/** 三味線の刻み: 旋律が伸ばす所で 16 分を弾く。和音の音と経過音だけ */
const WAY_COUNTER = [
  "E5 - G5 - G5 - B5 -",
  "F#5 - E5 - D5 - - -",
  "D5 - - - B4 - - D5",
  "E5 - - - G5 - - B5",
  "A5 - G5 - E5 - C5 E5",
  "F#5 - A4 - D5 - F#5 A5",
  "G5 - D5 - B4 - G4 B4",
  "D#5 - F#5 - F#5 - B5 -",
];

const WAY_HORN = [
  "C4 - E4 - G4 - - -",
  "D4 - F#4 - A4 - - -",
  "D4 - F#4 - B4 - - -",
  "E4 - G4 - B4 - - -",
  "A3 - C4 - E4 - - -",
  "F#4 - D4 - C4 - - -",
  "D4 - G4 - B3 - - -",
  "D#4 - F#4 - A4 - - -",
];

// ---------------------------------------------------------------- セクション

const INTRO = {
  name: "前奏（静座）", prog: "i–♭II", key: EM, feel: "quiet", groove: "taikoSparse", chords: ["Em", "Em", "F", "Em", "Em", "F", "F", "B7"], pad: "hold", choir: true, comp: null, mix: { strings: 0.6, choir: 0.8 },
  lead: rests(8),
  parts: {
    shaku: [
      "E5 - - - - - - -",
      "B4 - - - E5 - - -",
      "F5 - - - - - - -",
      "E5 - - - B4 - - -",
      "G5 - - - - - E5 -",
      "F5 - - - - - - -",
      "A5 - - - F5 - - -",
      "B5 - A5 F#5 D#5 - B4 -",
    ],
  },
  timp: "rollEnd",
};

const A = { name: "A メロ（型）", prog: A_PROG, key: EM, feel: "normal", groove: "taiko", comp: "auto", chords: A_CHORDS, lead: KATA, bassStyle: "gallop", mute: ["arp"], pad: "hits", mix: { strings: 0.8 } };

const B = { name: "B メロ（道）", prog: B_PROG, key: G_MAJOR, feel: "big", groove: "taikoBig", comp: "auto", chords: B_CHORDS, lead: WAY, pad: "hold", brass: "half", vln: 0, mute: ["arp"] };

const A2 = { ...A, name: "A' メロ（追う）", parts: { horn: KATA_LOW } };

const B2 = { ...B, name: "B' メロ", counter: WAY_COUNTER, timp: "beats", vln: undefined, parts: { horn: WAY_HORN } };

// ---- 型: i–♭II の 2 小節の上で、3 つの線を 2 小節ずつ遅れて重ねていく（1 つの型を全員が追う）

const K1 = ["E4 - - - B3 - - -", "F4 - - - C4 - - -"];
const K2 = ["E5 . E5 F5 E5 . B4 .", "F5 . F5 E5 C5 . A4 ."];
const K3 = [
  "E5 B4 G4 B4 E5 F5 E5 B4 G5 E5 B4 E5 G5 F5 E5 B4",
  "F5 C5 A4 C5 F5 E5 C5 A4 A5 F5 C5 F5 A5 G5 F5 C5",
];
const K4 = [
  "B5 . . B5 . . G5 . E5 . . E5 . . B4 .",
  "C6 . . C6 . . A5 . F5 . . F5 . . C5 .",
];

const FORM = {
  name: "型（カノン）", prog: "i–♭II（フリジアン）× 6 / VI–VII–i–V7", key: EM, feel: "normal", calm: true, groove: "taiko", comp: null, mute: ["arp", "double", "power"], bassStyle: "gallop", timp: "drive", pad: "trem", mix: { strings: 0.45 },
  chords: [...["Em", "F"], ...["Em", "F"], ...["Em", "F"], ...["Em", "F"], ...["Em", "F"], ...["Em", "F"], "C", "D", "Em", "B7"],
  lead: [
    ...rests(8), ...K4, ...K2, // ここまでで 12 小節
    "E5 - G5 - C6 - B5 G5", "A5 - F#5 - D5 - F#5 A5", "G5 - E5 - B4 - E5 G5", "B5 - A5 F#5 D#5 - B4 -",
  ],
  parts: {
    horn: [...K1, ...K1, ...at(K2, -12), ...at(K3, -12), ...at(K3, -12), ...K1,
      "C4 - E4 - G4 - E4 -", "D4 - F#4 - A4 - F#4 -", "E4 - G4 - E4 - B3 -", "D#4 - F#4 - B4 - F#4 -"],
    shaku: [...rests(2), ...at(K1, 12), ...K2, ...K1, ...at(K1, 12), ...at(K2, -12),
      "G5 - C6 - E6 - - -", "F#5 - A5 - D6 - - -", "E5 - G5 - B5 - - -", "D#5 - F#5 - A5 - - -"],
    shami: [...rests(4), ...at(K4, -12), ...K3, ...K3, ...K3,
      "C5 E5 G5 C6 G5 E5 C5 E5 G5 C6 E6 C6 G5 E5 C5 G4",
      "D5 F#5 A5 D6 A5 F#5 D5 F#5 A5 D6 F#6 D6 A5 F#5 D5 A4",
      "E5 G5 B5 E6 B5 G5 E5 G5 B5 E6 G6 E6 B5 G5 E5 B4",
      "D#5 F#5 B5 D#6 B5 F#5 D#5 F#5 B5 D#6 F#6 D#6 B5 F#5 D#5 B4"],
  },
};

const ANDA = ["Em", "D", "C", "B7", "Em", "D", "C", "B7"];
const ANDA_PROG = "i–VII–VI–V7（アンダルシア進行）× 2";

const SOLO_SHAKU = {
  name: "ソロ（尺八）", prog: ANDA_PROG, key: EM, feel: "normal", calm: true, groove: "taiko", comp: "auto", chords: ANDA, lead: rests(8), bassStyle: "gallop", mute: ["arp", "double", "power"], pad: "hold", mix: { strings: 0.55 },
  parts: {
    shaku: [
      "E6 - - - B5 - G5 B5",
      "A5 - - - F#5 - D5 F#5",
      "G5 - - - E5 - C5 E5",
      "F#5 - D#5 - B4 - - -",
      "B5 - - G5 E5 - B4 E5",
      "D6 - - A5 F#5 - D5 F#5",
      "G5 - E5 - C6 - B5 G5",
      "F#5 - D#5 - B5 - A5 F#5",
    ],
  },
};

/** 和太鼓のソロ: 音程のある声部は持続だけ */
const TAIKO = {
  name: "ソロ（和太鼓）", prog: "i のドローン → V7", key: EM, feel: "quiet", groove: "taikoSolo", comp: null, chords: ["Em", "Em", "Em", "Em", "Em", "Em", "Em", "B7"], lead: rests(8), pad: "hold", choir: true, mix: { strings: 0.5, choir: 0.7 }, timp: "rollEnd",
};

const SOLO_SHAMI = {
  name: "ソロ（三味線）", prog: ANDA_PROG, key: EM, feel: "normal", calm: true, groove: "taiko", comp: "auto", chords: ANDA, lead: rests(8), bassStyle: "gallop", mute: ["arp", "double", "power"], pad: "hits", mix: { strings: 0.55 },
  parts: {
    shami: [
      "E5 . E5 G5 B5 . E6 B5 G5 E5 B4 E5 G5 B5 E6 G6",
      "F#6 D6 A5 F#5 D5 F#5 A5 D6 F#6 . D6 A5 F#5 D5 A4 D5",
      "E5 G5 C6 E6 G6 E6 C6 G5 E5 C5 G4 C5 E5 G5 C6 E6",
      "D#6 B5 F#5 D#5 B4 D#5 F#5 B5 D#6 . . . B5 . . .",
      "G5 B5 E6 G6 . E6 B5 G5 E6 B5 G5 E5 G5 B5 E6 G6",
      "F#6 A6 F#6 D6 A5 D6 F#6 D6 A5 F#5 D5 F#5 A5 D6 F#6 A6",
      "G6 E6 C6 G5 E6 C6 G5 E5 C6 G5 E5 C5 E5 G5 C6 E6",
      "D#6 F#6 B6 . F#6 D#6 B5 F#5 D#5 B4 F#4 . . . . .",
    ],
  },
};

/** 組手: 旋律と三味線が、2 小節 → 1 小節 → 半小節で打ち合い、最後は同時に */
const BOUT = {
  name: "組手（掛け合い）", prog: "vi–IV–V–I（小室進行）× 2 / アンダルシア進行 / i–♭II", key: EM, feel: "big", solo: true, groove: "taikoBig", comp: "auto", pad: "hits", timp: "drive", mix: { strings: 0.6 },
  chords: ["Em", "C", "D", "G", "Em", "C", "D", "G", "Em", "D", "C", "B7", "Em", "F", "Em", "F"],
  lead: [
    "B5 - G5 B5 E6 - B5 G5 E5 - G5 B5 E6 - . .",
    "C6 - G5 C6 E6 - C6 G5 E5 - G5 C6 E6 - . .",
    REST,
    REST,
    "G5 B5 E6 G6 - E6 B5 G5 E5 G5 B5 D6 E6 - . .",
    "G5 C6 E6 G6 - E6 C6 G5 E5 G5 C6 D6 E6 - . .",
    REST,
    REST,
    "E6 B5 G5 E5 G5 B5 E6 G6 E6 - B5 - G5 - . .",
    REST,
    "E6 C6 G5 E5 G5 C6 E6 G6 E6 - C6 - G5 - . .",
    REST,
    "E6 B5 G5 E5 B4 E5 G5 B5 . . . . . . . .",
    ". . . . . . . . F6 C6 A5 F5 C5 F5 A5 C6",
    "E6 - . E6 - . B5 - G5 - . G5 - . E5 -",
    "F5 - . F5 - . A5 - C6 - . C6 - . F6 -",
  ],
  parts: {
    shami: [
      REST,
      REST,
      "A4 - F#4 A4 D5 - A4 F#4 D4 - F#4 A4 D5 - . .",
      "B4 - G4 B4 D5 - B4 G4 D4 - G4 B4 D5 - . .",
      REST,
      REST,
      "F#4 A4 D5 F#5 - D5 A4 F#4 D4 F#4 A4 C#5 D5 - . .",
      "G4 B4 D5 G5 - D5 B4 G4 D4 G4 B4 C5 D5 - . .",
      REST,
      "D5 A4 F#4 D4 F#4 A4 D5 F#5 D5 - A4 - F#4 - . .",
      REST,
      "D#5 B4 F#4 D#4 F#4 B4 D#5 F#5 D#5 - B4 - F#4 - . .",
      ". . . . . . . . E5 B4 G4 E4 G4 B4 E5 G5",
      "A5 F5 C5 A4 F4 A4 C5 F5 . . . . . . . .",
      "G4 - . G4 - . E4 - B3 - . B3 - . G3 -",
      "A3 - . A3 - . C4 - F4 - . F4 - . A4 -",
    ],
  },
};

/** 覚醒: 根音を半音ずつ上げ、減七でせり上がる。人の域を超える */
const AWAKE = {
  name: "覚醒", prog: "i–♭v（三全音）× 2 / 減七を半音ずつ / V7（ヘ短調）", key: EM, feel: "normal", calm: true, groove: "taikoRise", comp: null, pad: "trem", timp: "drive", choir: true, mute: ["arp", "double", "power"], brass: "hits", mix: { strings: 0.7, brass: 0.7 },
  chords: ["Em", "Bb", "Em", "Bb", "C#dim7", "Ddim7", "D#dim7", "C7"],
  lead: [
    "E5 - - - G5 - B5 -",
    "Bb5 - - - F5 - D5 -",
    "E6 - - - B5 - G5 -",
    "F6 - - - D6 - Bb5 -",
    "C#6 E6 G6 Bb6 G6 E6 C#6 E6",
    "D6 F6 Ab6 B6 Ab6 F6 D6 F6",
    "D#6 F#6 A6 C7 A6 F#6 D#6 F#6",
    "E6 G6 Bb6 C7 Bb6 G6 E6 C6",
  ],
  parts: {
    horn: [
      "E3 - - - B3 - G3 -",
      "Bb3 - - - D4 - F4 -",
      "G3 - - - B3 - E4 -",
      "F4 - - - D4 - Bb3 -",
      "C#4 - E4 - G4 - Bb4 -",
      "D4 - F4 - Ab4 - B4 -",
      "D#4 - F#4 - A4 - C5 -",
      "E4 - G4 - Bb4 - C5 -",
    ],
  },
};

const FM_A = ["Fm", "Gb", "Fm", "Gb", "Db", "Eb", "Fm", "C7"];

const A3 = {
  name: "A'' メロ（鬼神。半音上）", prog: A_PROG, key: FM, feel: "big", groove: "taikoBig", comp: "auto", chords: FM_A, lead: at(KATA, 1), bassStyle: "gallop", brass: "hits", pad: "trem", choir: true, timp: "drive", mute: ["arp"], vln: 0, mix: { strings: 0.6 }, crash: [0, 4],
  parts: { horn: at(KATA_LOW, 1), shami: at(K3, 1).concat(at(K3, 1), [null, null, null, null]) },
};

const B3 = {
  name: "B'' メロ（半音上）", prog: B_PROG, key: AB_MAJOR, feel: "big", groove: "taikoBig", comp: "auto", chords: ["Db", "Eb", "Cm", "Fm", "Bbm7", "Eb7", "Ab", "C7"], lead: at(WAY, 1), counter: at(WAY_COUNTER, 1), pad: "hold", brass: "half", choir: true, timp: "drive", mute: ["arp"], crash: [0, 4],
  parts: { horn: at(WAY_HORN, 1) },
};

const END = {
  name: "結び", prog: "i–♭II → ホ短調の i へ（♭II–i）", key: FM, feel: "big", groove: "taikoBig", comp: "auto", brass: "hits", pad: "hold", timp: "rollEnd", choir: true, mute: ["arp"],
  chords: ["Fm", "Gb", "F", "B7"],
  lead: [
    "F6 - C6 Ab5 F5 - Ab5 C6",
    "Gb6 - Db6 Bb5 Gb5 - Bb5 Db6",
    "F6 - - - - - C6 A5",
    "A5 - F#5 - D#5 - B4 -",
  ],
};

export const SECTIONS = [INTRO, A, B, A2, B2, FORM, SOLO_SHAKU, TAIKO, SOLO_SHAMI, BOUT, AWAKE, A3, B3, END];

// ---------------------------------------------------------------- 和太鼓

/** 大太鼓（ドン）と締太鼓（カッ） */
const don = (kit, t, vol = 0.5) => { kit.kick(t, 0.85); kit.tom(t, 62, vol); };
const ka = (kit, t, vol = 0.12) => { kit.tom(t, 240, vol); kit.hat(t, false, 0.02); };

/** セクションの頭の小節番号（テンポの変わり目のため） */
const startOf = sec => SECTIONS.slice(0, SECTIONS.indexOf(sec)).reduce((n, s) => n + s.chords.length, 0);

export default epicSong({
  title: "鬼神",
  description: "武術の達人が道を究めた結果、ついに鬼神となった。ホ短調 → ヘ短調・168 BPM（最後は 182 BPM）。端正な型（i–♭II の上の 3 声のカノン）、尺八と三味線のソロ、和太鼓のソロ、半小節まで詰まる組手のあと、三全音と減七でせり上がって半音上へ。陰音階・フリジアン・エオリアン終止・王道進行・小室進行・アンダルシア進行。",
  bpm: 168,
  sections: SECTIONS,
  loopFrom: 1,
  kit: "acoustic",
  drumVol: 0.65,
  inst: { lead: "pulse33", bell: "harp", brass: "trombone", choir: "choir" },
  off: ["double"],
  vol: { lead: 0.95 },
  bassStyle: "16th",
  grooves: {
    taikoSparse({ t, pos, b }, kit) {
      if (b.index % 2 === 0 && pos === 0) don(kit, t, 0.4);
      if (b.index >= 6 && pos % 4 === 0) don(kit, t, 0.28 + b.index * 0.02);
      if (b.last && pos >= 8) ka(kit, t, 0.05 + (pos - 8) * 0.02);
    },
    taiko({ t, pos, b }, kit) {
      if (b.last && pos >= 8) { ka(kit, t, 0.07 + (pos - 8) * 0.012); if (pos % 4 === 0) don(kit, t); return; }
      if ([0, 3, 8, 11].includes(pos)) don(kit, t, pos % 8 === 0 ? 0.5 : 0.32);
      if ([4, 12].includes(pos)) { kit.snare(t, 0.13); ka(kit, t, 0.12); }
      if (pos % 2 === 0) ka(kit, t, pos % 4 === 0 ? 0.03 : 0.06);
    },
    taikoBig({ t, pos, b }, kit) {
      if (pos === 0 && (b.first || b.sec.crash?.includes(b.index))) kit.crash(t);
      if (b.last && pos >= 12) { kit.snare(t, 0.12 + (pos - 12) * 0.04); don(kit, t, 0.3); return; }
      if ([0, 3, 6, 8, 11, 14].includes(pos)) don(kit, t, pos % 8 === 0 ? 0.55 : 0.36);
      if ([4, 12].includes(pos)) { kit.snare(t); ka(kit, t, 0.15); }
      kit.hat(t, pos % 4 === 2, pos % 4 === 2 ? 0.05 : 0.025);
    },
    // ドン・カッ・カラカラの独奏: 手順を 2 小節ずつ変えて、最後は全部 16 分で
    taikoSolo({ t, pos, b }, kit) {
      const PAT = [
        { 0: "D", 6: "K", 8: "D", 12: "K", 14: "K" },
        { 0: "D", 3: "D", 6: "K", 8: "D", 11: "D", 12: "K", 14: "K" },
        { 0: "D", 2: "K", 3: "K", 4: "D", 6: "K", 7: "K", 8: "D", 10: "K", 11: "K", 12: "D", 14: "K", 15: "K" },
        { 0: "D", 1: "K", 2: "K", 3: "K", 4: "D", 5: "K", 6: "K", 7: "K", 8: "D", 9: "K", 10: "D", 11: "K", 12: "D", 13: "D", 14: "D", 15: "D" },
      ][Math.floor(b.index / 2)];
      const hit = PAT[pos];
      if (hit === "D") don(kit, t, 0.42 + b.index * 0.02);
      if (hit === "K") ka(kit, t, 0.09 + b.index * 0.008);
    },
    // 覚醒: 小節ごとに打数が増える
    taikoRise({ t, pos, b }, kit) {
      const every = b.index < 4 ? 8 : b.index < 6 ? 4 : b.index < 7 ? 2 : 1;
      if (pos % every === 0) { don(kit, t, 0.3 + b.index * 0.03); kit.snare(t, 0.05 + b.index * 0.015); }
      if (pos === 0 && b.first) kit.crash(t);
    },
  },
  parts: [
    { key: "shaku", name: "尺八", inst: "flute", pan: "L", vol: 0.1, reverb: 0.5, attack: 0.04, role: "descant" },
    { key: "shami", name: "三味線", inst: "banjo", pan: "R", vol: 0.32, reverb: 0.2, role: "descant" },
    { key: "horn", name: "ホルン", inst: "horn", pan: "C", vol: 0.1, reverb: 0.35, attack: 0.03 },
  ],
  // 覚醒で少しずつ上げ、A'' から 182 BPM。A へ戻ると元の速さ
  tempo: {
    [startOf(AWAKE) + 4]: { 0: 1.02 },
    [startOf(AWAKE) + 5]: { 0: 1.04 },
    [startOf(AWAKE) + 6]: { 0: 1.06 },
    [startOf(AWAKE) + 7]: { 0: 1.08 },
    [startOf(A3)]: { 0: 1.083 },
    [startOf(A)]: { 0: 1 },
  },
});
