// 協奏曲「影」: イ短調 ⇄ イ長調、150 BPM、128 小節（8 小節 × 16 セクション）。戦闘曲の性格。
//
// 流れ: 無調のイントロ（12 音の音列）→ A（短調）→ A'（ドリアンの IV）→ B サビ（5 度圏）
//   → 相転移①: 同じ A を同主長調で（通常曲の型に変わる）→ B 長調サビ（王道進行）
//   → リードソロ（ボスの型）→ 対旋律ソロ → C メロ（長調に ♭VI・♭VII・iv を混ぜる）
//   → 無調 → ドラムソロ → ベースソロ → 鍵盤ソロ（アンダルシア進行）
//   → 相転移②: A を短 3 度上のハ短調で（ボスの型）→ 最終サビ（ピカルディ終止）→ アウトロ（無調のイントロへ戻る）
import { makeSong } from "../lib/song.js";
import {
  REST, SCALE, toParallelMajor, transposeLine, transposeChord,
  soloLines, arpLines, walkingLines, rowLines, rowChords,
} from "../lib/compose.js";

const A = 9;

const A_CHORDS = ["Am", "F", "G", "Em", "Am", "F", "E", "E"];
const A_LEAD = [
  "E5 . A5 . C6 - B5 A5",
  "A5 - F5 - C5 . F5 A5",
  "B5 - G5 - D5 . G5 B5",
  "B5 - - - G5 - E5 -",
  "A5 . C6 . E6 - D6 C6",
  "C6 . A5 . F5 - G5 A5",
  "G#5 - B5 - E6 - D6 B5",
  "G#5 - - - E5 - - .",
];

// 12 音の音列（ラから始まる）
const ROW = [9, 10, 2, 1, 5, 4, 0, 11, 7, 6, 3, 8];

const LEAD_SOLO_CHORDS = ["Am", "F", "G", "Em", "Am", "F", "E", "E"];
const COUNTER_SOLO_CHORDS = ["F", "G", "Am", "Am", "F", "G", "E", "E"];
const BASS_SOLO_CHORDS = ["Am", "Am", "Dm", "E", "Am", "Am", "F", "E"];
const KEYS_SOLO_CHORDS = ["Am", "G", "F", "E", "Am", "G", "F", "E"];

export default makeSong({
  title: "協奏曲「影」",
  description: "イ短調 ⇄ イ長調・150 BPM・128 小節。無調のイントロ、同主長調とハ短調への相転移、長短の混在、5 種類のソロ（リード・対旋律・ドラム・ベース・鍵盤）が入った戦闘の大曲。",
  bpm: 150,
  mood: "battle",
  inst: { 1: "synth-bass", 4: "pulse33", 6: "fm-organ", 7: "brass" },
  sections: [
    {
      name: "イントロ", prog: "12 音の音列", mode: "無調", feel: "free", harmony: false,
      chords: rowChords(ROW, 8),
      lead: rowLines(ROW, 8, { lo: 60 }),
    },
    { name: "A", prog: "i–VI–VII–v", mode: "イ短調", feel: "normal", harmony: false, chords: A_CHORDS, lead: A_LEAD },
    {
      name: "A'", prog: "ドリアンの i–IV", mode: "イ短調（ドリアン）", feel: "normal", harmony: true,
      chords: ["Am", "D", "Am", "D", "F", "G", "E", "E"],
      lead: [
        A_LEAD[0],
        "F#5 - A5 - D6 . C6 A5",
        "C6 . A5 . E5 - F#5 G5",
        "A5 - - - F#5 - D5 -",
        "A5 . C6 . F6 - E6 C6",
        "B5 . D6 . G6 - F6 D6",
        "G#5 - B5 - E6 - D6 B5",
        "E6 - - - - - . .",
      ],
    },
    {
      name: "B サビ", prog: "5 度圏 iv–VII–III–VI–iiø–V7–i", mode: "イ短調", feel: "big", harmony: true,
      chords: ["Dm", "G", "C", "F", "Bm7b5", "E7", "Am", "Am"],
      lead: [
        "F5 - A5 - D6 - - .",
        "D6 - B5 - G5 - - .",
        "E5 - G5 - C6 - - .",
        "C6 - A5 - F5 - A5 C6",
        "D6 - - - B5 - A5 -",
        "G#5 - - - B5 - D6 -",
        "C6 - - - A5 - E5 -",
        "A5 - - - - - . .",
      ],
    },

    // 相転移①: 同じ旋律を同主長調で。ド・ファ・ソが ♯ になる。伴奏も通常曲の型に
    {
      name: "A（相転移: 長調）", prog: "同主長調", mode: "イ長調", feel: "big", mood: "normal", harmony: true,
      chords: ["A", "F#m", "E7", "E", "A", "F#m", "E7", "E"],
      lead: A_LEAD.map(l => toParallelMajor(l, A)),
    },
    {
      name: "B サビ（長調）", prog: "王道進行", mode: "イ長調", feel: "big", mood: "normal", harmony: true,
      chords: ["D", "E", "C#m", "F#m", "D", "E", "A", "A"],
      lead: [
        "F#5 - A5 - D6 - - .",
        "G#5 - B5 - E6 - - .",
        "E6 - C#6 - G#5 - - .",
        "F#5 - A5 - C#6 - - .",
        "D6 . C#6 . A5 - F#5 A5",
        "B5 . G#5 . E5 - G#5 B5",
        "C#6 - - - E6 - - .",
        "A5 - - - - - . .",
      ],
    },
    {
      name: "リードソロ", prog: "i–VI–VII–v", mode: "イ短調", feel: "big", mood: "boss", solo: "lead",
      chords: LEAD_SOLO_CHORDS,
      lead: soloLines(LEAD_SOLO_CHORDS, { tonic: A, scale: SCALE.minor, lo: 69, hi: 93, rhythms: ["run", "gallop", "climb", "phrase"] }),
    },
    {
      name: "対旋律ソロ", prog: "VI–VII–i", mode: "イ短調", feel: "soft", solo: "counter",
      chords: COUNTER_SOLO_CHORDS,
      lead: soloLines(COUNTER_SOLO_CHORDS, { tonic: A, scale: SCALE.minor, lo: 57, hi: 76, rhythms: ["hold", "phrase"] }),
    },
    {
      name: "C メロ", prog: "I–IV–iv–I–♭VI–♭VII–I", mode: "長短混在", feel: "soft", mood: "normal", harmony: true,
      chords: ["A", "D", "Dm", "A", "F", "G", "A", "A"],
      lead: [
        "C#6 - - - A5 - E5 -",
        "D6 - - - F#5 - A5 -",
        "F5 - - - A5 - D6 -",
        "C#6 - - - - - . .",
        "C6 - - - A5 - F5 -",
        "B5 - - - D6 - G5 -",
        "A5 - C#6 - E6 - - -",
        "A6 - - - - - . .",
      ],
    },
    {
      name: "無調", prog: "12 音の音列（移置）", mode: "無調", feel: "free", harmony: false,
      chords: rowChords(ROW, 8, { offset: 5 }),
      lead: rowLines(ROW, 8, { lo: 64, offset: 5 }),
    },
    { name: "ドラムソロ", prog: "—", mode: "無調", feel: "free", solo: "drums", chords: rowChords(ROW, 8, { offset: 11 }), lead: Array(8).fill(REST) },
    {
      name: "ベースソロ", prog: "i–iv–V", mode: "イ短調", feel: "normal", solo: "bass",
      chords: BASS_SOLO_CHORDS,
      lead: walkingLines(BASS_SOLO_CHORDS, { lo: 33 }),
    },
    {
      name: "鍵盤ソロ", prog: "アンダルシア進行", mode: "イ短調", feel: "normal", solo: "arp",
      chords: KEYS_SOLO_CHORDS,
      lead: arpLines(KEYS_SOLO_CHORDS, { lo: 57 }),
    },

    // 相転移②: 短 3 度上のハ短調へ。伴奏もボスの型に
    {
      name: "A（相転移: ハ短調へ転調）", prog: "i–VI–VII–v", mode: "ハ短調", feel: "big", mood: "boss", harmony: true,
      chords: A_CHORDS.map(c => transposeChord(c, 3)),
      lead: A_LEAD.map(l => transposeLine(l, 3)),
    },
    {
      name: "最終サビ", prog: "♭VI–♭VII–i → ピカルディ終止", mode: "長短混在", feel: "big", harmony: true,
      chords: ["F", "G", "Am", "Am", "F", "G", "A", "A"],
      lead: [
        "A5 - C6 - F6 - - .",
        "B5 - D6 - G6 - - .",
        "C6 - - - E6 - A5 -",
        "A5 - C6 - E6 - - .",
        "F6 - E6 - C6 - A5 -",
        "G6 - F6 - D6 - B5 -",
        "C#6 - - - E6 - - -",
        "A6 - - - - - . .",
      ],
    },
    {
      name: "アウトロ", prog: "iv–i–VI–V", mode: "イ短調", feel: "soft", harmony: false,
      chords: ["Dm", "Am", "F", "E", "Dm", "Am", "E", "E"],
      lead: [
        "D6 - - - A5 - F5 -",
        "E5 - - - C5 - A4 -",
        "A4 - C5 - F5 - - .",
        "G#4 - - - B4 - E5 -",
        "F5 - - - D5 - A4 -",
        "C5 - - - A4 - E4 -",
        "G#4 - - - - - - -",
        "E4 - - - - - . .",
      ],
    },
  ],
});
