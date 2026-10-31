// 戦闘曲 1: hustower を通常曲としたときの戦闘曲。イ短調・160 BPM・24 小節。
// A は刻むリフとパワーコード、B は伸びやかなメロディにハモリとブラス、C メロはハーフタイムで引く。
// B と C メロの終わりは E（和声的短音階の G#）で緊張させて、次の Am に戻る。
import { parseChord, parseLine, chordMidis, harmonyBelow } from "../lib/theory.js";
import { layeredSong, noteAt } from "../lib/layers.js";

const SECTIONS = [
  {
    name: "A", prog: "i–VI–VII",
    chords: ["Am", "Am", "F", "G", "Am", "Am", "F", "E"],
    lead: [
      "A4 . A4 C5 E5 . D5 C5",
      "B4 C5 D5 . E5 - . .",
      "F5 . E5 D5 C5 . D5 E5",
      "D5 - B4 - G4 . B4 D5",
      "A4 . A4 C5 E5 . A5 G5",
      "E5 . C5 . A4 . C5 E5",
      "F5 E5 D5 C5 D5 C5 B4 A4",
      "G#4 - B4 - E5 - . .",
    ],
  },
  {
    name: "B", prog: "iv–i–iv–V",
    chords: ["Dm", "Am", "Dm", "E", "F", "G", "Am", "E"],
    lead: [
      "D5 - - - F5 - A5 -",
      "G5 - E5 - - - C5 E5",
      "F5 - - - A5 - D6 -",
      "B5 - - - G#5 - E5 -",
      "C6 - - - A5 - F5 A5",
      "B5 - - - G5 - D5 G5",
      "A5 - E5 - C6 - B5 A5",
      "G#5 - - - B5 - - -",
    ],
  },
  {
    name: "C メロ", prog: "アンダルシア進行 i–VII–VI–V",
    chords: ["Am", "G", "F", "E", "Am", "G", "F", "E"],
    lead: [
      "A5 - - - E5 - C5 E5",
      "D5 - - - B4 - G4 B4",
      "C5 - A4 - F4 - A4 C5",
      "B4 - G#4 - E4 - - .",
      "C5 . E5 . A5 - G5 A5",
      "B5 . G5 . D5 - B4 D5",
      "C6 - A5 - F5 - A5 C6",
      "B5 - - - G#5 - E5 -",
    ],
  },
];

/** 戦闘曲 1 の旋律（A・B・C メロ）。本番合奏が、旋律を変えずに使う */
export const THEME = Object.fromEntries(SECTIONS.map(s => [s.name, s.lead]));

const BARS = SECTIONS.flatMap(sec => sec.chords.map((c, i) => ({
  section: sec.name,
  prog: sec.prog,
  chord: parseChord(c),
  lead: parseLine(sec.lead[i]),
  first: i === 0,
  last: i === sec.chords.length - 1,
})));

const isA = b => b.section === "A";
const isC = b => b.section === "C メロ";

const LAYERS = [
  { name: "リード", pan: "C", inst: "pulse25", vol: 0.12, play({ t, pos, b, s16 }, voice) {
    const n = noteAt(b.lead, pos);
    if (n) voice(t, n.len * 2 * s16 * 0.92, n.midi);
  } },
  { name: "16 分のベース", pan: "C", inst: "triangle", vol: 0.26, play({ t, pos, b, s16 }, voice) {
    const root = chordMidis(b.chord, 0, 40, 11)[0];   // E2〜D#3
    if (isC(b)) { if (pos % 2 === 0) voice(t, 2 * s16 * 0.8, root); return; }   // C メロは 8 分で引く
    voice(t, s16 * 0.75, root + [0, 0, 12, 0][pos % 4]);
  } },
  { name: "ドラム", pan: "C", kit: "8bit", play({ t, pos, b }, kit) {
    if (b.first && pos === 0 && !isC(b)) kit.crash(t);
    if (b.last && pos >= 8) {
      // フィル: タムを 2 つ下りて、スネアの 16 分連打
      if (pos === 8) kit.tom(t, 200);
      if (pos === 10) kit.tom(t, 140);
      if (pos >= 12) kit.snare(t, 0.12 + (pos - 12) * 0.04);
      if (pos % 4 === 0) kit.kick(t);
      return;
    }
    if (isC(b)) {
      // ハーフタイム
      if (pos === 0 || pos === 10) kit.kick(t, 0.6);
      if (pos === 8) kit.snare(t, 0.18);
      if (pos % 2 === 0) kit.hat(t, false);
      return;
    }
    const kicks = isA(b) ? [0, 3, 8, 10, 11] : [0, 4, 8, 12, 14];
    if (kicks.includes(pos)) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    kit.hat(t, pos % 4 === 2);
  } },
  { name: "アルペジオ", pan: "L", inst: "pulse12", vol: 0.028, play({ t, pos, b, mid, s16 }, voice) {
    const up = [...mid, mid[0] + 12];
    if (isC(b)) { if (pos % 2 === 0) voice(t, s16 * 1.6, up[(pos / 2) % up.length]); return; }
    voice(t, s16 * 0.7, up[pos % up.length]);
  } },
  { name: "パワーコード", pan: "R", inst: "square", vol: 0.025, play({ t, pos, b, s16 }, voice) {
    const r = chordMidis(b.chord, 0, 48, 11)[0];
    const chord = [r, r + 7, r + 12];          // 根音 + 5 度 + オクターブ
    if (isC(b)) {
      if (pos === 0) chord.forEach(m => voice(t, 15 * s16, m, 0.6));
    } else if (!isA(b)) {
      if (pos === 0 || pos === 8) chord.forEach(m => voice(t, 7 * s16, m));
    } else if ([0, 3, 6, 10, 12].includes(pos)) {
      chord.forEach(m => voice(t, s16 * 1.2, m));
    }
  } },
  { name: "ハモリ（B・C メロ）", pan: "L", inst: "pulse12", vol: 0.05, play({ t, pos, b, s16 }, voice) {
    const n = !isA(b) && noteAt(b.lead, pos);
    if (n) voice(t, n.len * 2 * s16 * 0.92, harmonyBelow(n.midi, b.chord, 0));
  } },
  { name: "対旋律（B・C メロ）", pan: "RR", inst: "square", vol: 0.03, play({ t, pos, b, s16 }, voice) {
    if (!isA(b) && pos === 0) voice(t, 16 * s16 * 0.95, chordMidis(b.chord, 0, 60, 6)[1]);
  } },
  { name: "リード（オクターブ下）", pan: "L", inst: "triangle", vol: 0.07, play({ t, pos, b, s16 }, voice) {
    const n = noteAt(b.lead, pos);
    if (n) voice(t, n.len * 2 * s16 * 0.92, n.midi - 12);
  } },
  { name: "ブラス（B・C メロ）", pan: "C", inst: "fm-brass", vol: 0.028, play({ t, pos, b, s16 }, voice) {
    if (!isA(b) && (pos === 0 || pos === 8)) chordMidis(b.chord, 0, 55, 6).forEach(m => voice(t, 7 * s16, m));
  } },
  { name: "パーカッション追加", pan: "R", kit: "8bit", play({ t, pos, b }, kit) {
    if (pos % 2 === 1) kit.shaker(t);
    if (!isC(b) && (pos === 4 || pos === 12)) kit.clap(t);
  } },
];

export default layeredSong({
  title: "戦闘曲 1「ハスタワー」",
  description: "ハスタワーを通常曲としたときの戦闘曲。イ短調・160 BPM・24 小節。C メロはアンダルシア進行をハーフタイムで。",
  mood: "battle",
  bpm: 160,
  bars: BARS,
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
