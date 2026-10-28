// 交響曲「黎明」: ハ長調 ⇄ ハ短調、120 BPM、128 小節（8 小節 × 16 セクション）。通常曲の性格。
//
// 流れ: イントロ → A（長調）→ A'（借用和音）→ B サビ（長調）
//   → 相転移①: 同じ A・B を同主短調で（B から戦闘の型に変わる）→ リードソロ → ベースソロ
//   → C メロ（長短混在）→ 対旋律ソロ → 無調（12 音の音列）→ ドラムソロ → 鍵盤ソロ（調が戻る）
//   → 相転移②: A を長 3 度上のホ長調で → 最終サビ（借用和音）→ アウトロ（♭VI–♭VII–I で頭の C へ）
import { makeSong } from "../lib/song.js";
import {
  REST, SCALE, toParallelMinor, transposeLine, transposeChord,
  soloLines, arpLines, walkingLines, rowLines, rowChords,
} from "../lib/compose.js";

const C = 0;

const A_CHORDS = ["C", "G", "Am", "Em", "F", "C", "Dm", "G"];
const A_LEAD = [
  "E5 . G5 . C6 - B5 G5",
  "D5 - - . B4 . D5 G5",
  "C6 . A5 . E5 - G5 A5",
  "B5 - - - G5 - E5 -",
  "A5 . C6 . F5 - G5 A5",
  "G5 - E5 - C5 - D5 E5",
  "F5 . A5 . D6 - C6 A5",
  "B5 - - - D6 - - .",
];
const B_CHORDS = ["F", "G", "Em", "Am", "F", "G", "C", "C"];
const B_LEAD = [
  "C6 - A5 - F5 - A5 C6",
  "D6 - B5 - G5 - B5 D6",
  "E6 - D6 - B5 - G5 B5",
  "C6 - - - A5 - E5 -",
  "F5 . A5 . C6 - D6 C6",
  "B5 . D6 . G6 - F6 D6",
  "E6 - - - C6 - G5 -",
  "C6 - - - - - . .",
];

// 12 音の音列（12 の音を 1 回ずつ）。調の中心を作らない並び
const ROW = [0, 11, 3, 4, 8, 7, 9, 5, 6, 1, 2, 10];

const SOLO_CHORDS = ["Cm", "Ab", "Bb", "Cm", "Cm", "Ab", "Bb", "G"];
const BASS_SOLO_CHORDS = ["Cm", "Fm", "Cm", "G", "Cm", "Fm", "Ab", "G"];
const COUNTER_SOLO_CHORDS = ["F", "G", "Em", "Am", "Dm", "G", "C", "C"];
const KEYS_SOLO_CHORDS = ["Ab", "Bb", "C", "Am", "Fm", "G", "C", "G"];

export default makeSong({
  title: "交響曲「黎明」",
  description: "ハ長調 ⇄ ハ短調・120 BPM・128 小節。長短の混在、同主短調への相転移、無調、ホ長調への転調、5 種類のソロ（リード・ベース・対旋律・ドラム・鍵盤）が入った大曲。",
  bpm: 120,
  mood: "normal",
  inst: { 3: "harp", 6: "strings", 7: "fm-epiano" },
  sections: [
    {
      name: "イントロ", prog: "I–vi–IV–V → iv", mode: "ハ長調", feel: "soft", harmony: false,
      chords: ["C", "Am", "F", "G", "C", "Am", "Fm", "G"],
      lead: [
        "G5 - - - - - - -",
        ". . . . E5 - C5 -",
        "A5 - - - - - - -",
        ". . . . G5 - D5 -",
        "E5 - - - - - - -",
        ". . . . C5 - A4 -",
        "Ab4 - - - - - - -",
        "B4 - - - D5 - - -",
      ],
    },
    { name: "A", prog: "カノン進行の変形", mode: "ハ長調", feel: "normal", harmony: false, chords: A_CHORDS, lead: A_LEAD },
    {
      name: "A'", prog: "借用和音 iv・♭VI・iiø7", mode: "長短混在", feel: "normal", harmony: true,
      chords: ["C", "G", "Am", "Em", "Fm", "Ab", "Dm7b5", "G"],
      lead: [
        ...A_LEAD.slice(0, 4),
        "Ab5 . C6 . F5 - G5 Ab5",
        "Eb5 - C5 - Ab4 - Bb4 C5",
        "F5 . Ab5 . D6 - C6 Ab5",
        "B5 - - - D6 - - .",
      ],
    },
    { name: "B サビ", prog: "王道進行", mode: "ハ長調", feel: "big", harmony: true, chords: B_CHORDS, lead: B_LEAD },

    // 相転移①: 同じ旋律を同主短調で。ミ・ラ・シが ♭ になる
    {
      name: "A（相転移: 短調）", prog: "同主短調", mode: "ハ短調", feel: "normal", harmony: true,
      chords: ["Cm", "Gm", "Ab", "Eb", "Fm", "Cm", "Dm7b5", "Gm"],
      lead: A_LEAD.map(l => toParallelMinor(l, C)),
    },
    {
      name: "B サビ（相転移: 短調・戦闘の型）", prog: "王道進行を同主短調で", mode: "ハ短調", feel: "big", mood: "battle", harmony: true,
      chords: ["Fm", "Gm", "Eb", "Ab", "Fm", "Gm", "Cm", "Cm"],
      lead: B_LEAD.map(l => toParallelMinor(l, C)),
    },
    {
      name: "リードソロ", prog: "i–♭VI–♭VII", mode: "ハ短調", feel: "big", mood: "battle", solo: "lead",
      chords: SOLO_CHORDS,
      lead: soloLines(SOLO_CHORDS, { tonic: C, scale: SCALE.minor, lo: 67, hi: 91 }),
    },
    {
      name: "ベースソロ", prog: "i–iv–i–V", mode: "ハ短調", feel: "normal", solo: "bass",
      chords: BASS_SOLO_CHORDS,
      lead: walkingLines(BASS_SOLO_CHORDS, { lo: 36 }),
    },
    {
      name: "C メロ", prog: "IV△7–iv–iii7–vi7–ii7–♭VI△7–♭VII–V7", mode: "長短混在", feel: "soft", harmony: true,
      chords: ["Fmaj7", "Fm", "Em7", "Am7", "Dm7", "Abmaj7", "Bb", "G7"],
      lead: [
        "E5 - - - A5 - C6 -",
        "Ab5 - - - C6 - F5 -",
        "G5 - - - B5 - D6 -",
        "C6 - - - A5 - E5 G5",
        "F5 - - - A5 - C6 -",
        "G5 - - - Eb5 - C5 -",
        "F5 - - - D5 - Bb4 -",
        "B4 - D5 - F5 - G5 -",
      ],
    },
    {
      name: "対旋律ソロ", prog: "王道進行", mode: "ハ長調", feel: "soft", solo: "counter",
      chords: COUNTER_SOLO_CHORDS,
      lead: soloLines(COUNTER_SOLO_CHORDS, { tonic: C, scale: SCALE.major, lo: 55, hi: 76, rhythms: ["hold", "phrase"] }),
    },
    {
      name: "無調", prog: "12 音の音列", mode: "無調", feel: "free", harmony: false,
      chords: rowChords(ROW, 8),
      lead: rowLines(ROW, 8, { lo: 62 }),
    },
    { name: "ドラムソロ", prog: "—", mode: "無調", feel: "free", solo: "drums", chords: rowChords(ROW, 8, { offset: 6 }), lead: Array(8).fill(REST) },
    {
      name: "鍵盤ソロ（調が戻る）", prog: "♭VI–♭VII–I", mode: "長短混在", feel: "normal", solo: "arp",
      chords: KEYS_SOLO_CHORDS,
      lead: arpLines(KEYS_SOLO_CHORDS, { lo: 60 }),
    },

    // 相転移②: 長 3 度上のホ長調へ
    {
      name: "A（相転移: ホ長調へ転調）", prog: "カノン進行の変形", mode: "ホ長調", feel: "big", harmony: true,
      chords: A_CHORDS.map(c => transposeChord(c, 4)),
      lead: A_LEAD.map(l => transposeLine(l, 4)),
    },
    {
      name: "最終サビ", prog: "王道進行 + iv–♭VII", mode: "長短混在", feel: "big", harmony: true,
      chords: ["F", "G", "Em", "Am", "Fm", "Bb", "C", "C"],
      lead: [
        ...B_LEAD.slice(0, 4),
        "F5 . Ab5 . C6 - Eb6 C6",
        "Bb5 . D6 . F6 - D6 Bb5",
        "E6 - - - C6 - G5 -",
        "C6 - - - - - . .",
      ],
    },
    {
      name: "アウトロ", prog: "♭VI–♭VII–I（マリオ終止）", mode: "長短混在", feel: "soft", harmony: false,
      chords: ["Ab", "Bb", "C", "Am", "Fm", "Fm", "C", "C"],
      lead: [
        "C6 - - - Eb6 - - -",
        "D6 - - - F6 - D6 -",
        "E6 - - - G5 - C6 -",
        "C6 - - - A5 - E5 -",
        "Ab5 - - - F5 - C5 -",
        "Ab5 - - - - - G5 -",
        "G5 - - - E5 - - -",
        "C5 - - - - - . .",
      ],
    },
  ],
});
