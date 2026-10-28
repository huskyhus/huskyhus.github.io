// 通常曲 1: hustower の A → B → C メロを、10 声部で重ねる。
// 声部ごとに、鳴らす / 楽器 / 音量を画面で選べる。
import { parseChord, parseLine, chordMidis, harmonyBelow } from "../lib/theory.js";
import { layeredSong, noteAt } from "../lib/layers.js";

export const SECTIONS = [
  {
    name: "A", prog: "I–V–vi–IV 系",
    chords: ["C", "G", "Am", "F", "C", "G", "F", "G"],
    lead: [
      "C5 . G4 C5 E5 . D5 C5",
      "D5 . B4 G4 D5 - . .",
      "E5 . C5 A4 E5 F5 E5 D5",
      "C5 - A4 - C5 . D5 .",
      "C5 . G4 C5 E5 . G5 E5",
      "F5 . D5 B4 G5 - F5 E5",
      "D5 . C5 A4 F5 E5 D5 C5",
      "D5 . . B4 G4 . . .",
    ],
    counter: [
      "E4 - - - G4 - - -",
      "D4 - - - . B4 C5 D5",
      "A4 - - - C5 - B4 A4",
      "F4 - - - A4 - G4 -",
      "G4 - - - C5 - - -",
      "B4 - - - D5 - - -",
      "A4 - - - C5 - A4 -",
      "B4 - - - . D5 E5 F5",
    ],
  },
  {
    name: "B", prog: "vi–IV–I–V",
    chords: ["Am", "F", "C", "G", "Am", "F", "Dm", "G"],
    lead: [
      "A5 . E5 . C5 . E5 A5",
      "G5 . F5 . C5 . F5 G5",
      "E5 . G5 . C6 - G5 E5",
      "D5 - B4 - G4 . B4 D5",
      "A5 . G5 A5 . E5 C5 E5",
      "F5 . E5 F5 . C5 A4 C5",
      "D5 E5 F5 G5 A5 G5 F5 E5",
      "D5 - . . G4 . B4 D5",
    ],
    counter: null,   // 対旋律が無い所は、和音の 3 度と 7 度（無ければ 5 度）を伸ばす
  },
  {
    name: "C メロ", prog: "丸サ進行 IV△7–III7–vi7–I7",
    chords: ["Fmaj7", "E7", "Am7", "C7", "Fmaj7", "E7", "Am7", "G"],
    lead: [
      "E5 - - - C5 - A4 C5",
      "B4 - - - G#4 - B4 D5",
      "C5 - - - A4 - G4 A4",
      "G4 - - - . E4 G4 A#4",
      "A4 - C5 - E5 - G5 -",
      "G#5 - - - F5 - E5 D5",
      "E5 - - - C5 - B4 C5",
      "D5 - - - . . . .",
    ],
    counter: [
      "A4 - - - E4 - - -",
      "G#4 - - - D4 - - -",
      "C4 - - - G4 - - -",
      "E4 - - - A#4 - - -",
      "C5 - - - A4 - - -",
      "B4 - - - G#4 - - -",
      "A4 - - - G4 - - -",
      "B4 - - - - - - -",
    ],
  },
];

/** 通常曲 1 の旋律（A・B・C メロ）。本番合奏が、旋律を変えずに使う */
export const THEME = Object.fromEntries(SECTIONS.map(s => [s.name, s.lead]));

/**
 * セクションの並び → 小節ごとのデータ。拡張版（hustower-massive-*.js）も、この形で曲を組む
 * lead / counter の 1 小節は、8 分音符 8 個でも 16 分音符 16 個でも書ける
 * セクションごとに書けること（どれも書かなければ原曲どおり）:
 *   solo: リードのソロ。ハモリとオクターブ下は休む
 *   trade: 対旋律がソロを弾く小節（掛け合い）。対旋律を前に出す
 *   soft: ドラムを軽く、パーカッションを休む / big: 頭にクラッシュ
 *   drop: 落ちサビ。ドラム・ベース・パーカッションを休む（最後の小節のフィルだけ鳴らして、次のサビへ入る）
 *   key: 点検（tools/analyze.mjs）で読む調。転調したところに書く
 */
export const barsOf = sections => sections.flatMap(sec => sec.chords.map((c, i) => ({
  section: sec.name,
  prog: sec.prog,
  key: sec.key,
  chord: parseChord(c),
  lead: parseLine(sec.lead[i]),
  counter: sec.counter?.[i] ? parseLine(sec.counter[i]) : null,   // 小節ごとに null も書ける
  solo: sec.solo,
  trade: sec.trade?.[i],
  soft: sec.soft,
  big: sec.big,
  drop: sec.drop,
  first: i === 0,
  last: i === sec.chords.length - 1,
})));

/** 楽譜 1 行の、pos に始まる音 → { midi, steps（16 分音符いくつ分） } */
function noteIn(line, pos) {
  if (line.length === 16) return line[pos] && { midi: line[pos].midi, steps: line[pos].len };
  const n = noteAt(line, pos);
  return n && { midi: n.midi, steps: n.len * 2 };
}

export const LAYERS = [
  { name: "リード", pan: "C", inst: "pulse25", vol: 0.12, play({ t, pos, b, s16 }, voice) {
    const n = noteIn(b.lead, pos);
    if (n) voice(t, n.steps * s16 * 0.92, n.midi);
  } },
  { name: "ベース", pan: "C", inst: "triangle", vol: 0.3, play({ t, pos, b, root, s16 }, voice) {
    if (pos % 2 === 0 && !b.drop) voice(t, 2 * s16 * 0.8, pos % 4 === 0 ? root : root + 12);
  } },
  { name: "ドラム", pan: "C", kit: "8bit", play({ t, pos, b }, kit) {
    if (b.last && pos >= 12) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }   // フィル
    if (b.drop) return;
    if (b.big && b.first && pos === 0) kit.crash(t);
    if (pos === 0 || pos === 8 || (pos === 10 && !b.soft)) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    if (pos % 2 === 0) kit.hat(t, pos % 4 === 2);
  } },
  { name: "アルペジオ", pan: "L", inst: "pulse12", vol: 0.03, play({ t, pos, mid, s16 }, voice) {
    voice(t, s16 * 0.7, mid[[0, 1, 2, 1][pos % 4]]);
  } },
  { name: "対旋律", pan: "R", inst: "square", vol: 0.035, play({ t, pos, b, s16 }, voice) {
    if (b.counter) {
      const n = noteIn(b.counter, pos);
      if (n) voice(t, n.steps * s16 * 0.95, n.midi, b.trade ? 2.5 : 1);   // 掛け合いでは、ソロとして前に出す
    } else if (pos % 8 === 0) {
      const tones = chordMidis(b.chord, 0, 60, 6);
      voice(t, 8 * s16 * 0.95, pos === 0 ? tones[1] : tones[tones.length > 3 ? 3 : 2]);
    }
  } },
  { name: "3 度下のハモリ", pan: "L", inst: "pulse12", vol: 0.05, play({ t, pos, b, s16 }, voice) {
    const n = !b.solo && noteIn(b.lead, pos);
    if (n) voice(t, n.steps * s16 * 0.92, harmonyBelow(n.midi, b.chord, 0));
  } },
  { name: "サブベース", pan: "C", inst: "sine", vol: 0.2, play({ t, pos, root, s16 }, voice) {
    if (pos === 0) voice(t, 16 * s16 * 0.98, root);
  } },
  { name: "FM ベースのシンコペーション", pan: "R", inst: "fm-bass", vol: 0.05, play({ t, pos, b, root, s16 }, voice) {
    if ([0, 3, 6, 8, 11, 14].includes(pos) && !b.drop) voice(t, s16 * 1.5, root + 12);
  } },
  { name: "リード（オクターブ下）", pan: "L", inst: "triangle", vol: 0.08, play({ t, pos, b, s16 }, voice) {
    const n = !b.solo && noteIn(b.lead, pos);
    if (n) voice(t, n.steps * s16 * 0.92, n.midi - 12);
  } },
  { name: "パーカッション追加", pan: "R", kit: "8bit", play({ t, pos, b }, kit) {
    if (b.soft || b.drop) return;
    kit.hat(t, false, 0.03);                // 16 分のハット
    if (pos % 2 === 1) kit.shaker(t);
    if (pos === 4 || pos === 12) kit.clap(t);
  } },
];

export default layeredSong({
  title: "通常曲 1「ハスタワー」",
  description: "ハスタワー本体の BGM の A → B → C メロ（ハ長調・120 BPM）を 10 声部で重ねる。C メロは丸サ進行。",
  mood: "normal",
  bpm: 120,
  bars: barsOf(SECTIONS),
  layers: LAYERS,
  info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
});
