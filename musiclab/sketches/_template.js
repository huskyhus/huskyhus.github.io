// 新しいスケッチのひな形。このファイルをコピーして名前を変え、sketches/index.js に足す。
import { parseChord, parseLine, chordMidis, freq } from "../lib/theory.js";

const CHORDS = ["C", "Am", "F", "G"].map(parseChord);
const MELODY = [
  "E5 - D5 C5 D5 - G4 -",
  "C5 - - - . . . .",
  "A4 - C5 - F5 - E5 D5",
  "D5 - - - B4 - - -",
].map(parseLine);

export default {
  title: "ひな形",
  description: "メロディ・ベース・ドラムの最小構成。",
  bpm: 120,
  bars: 4,                 // ループの長さ（小節）。0 にすると終わりなく step が増え続ける
  params: {
    // min/max があればスライダー、options があればプルダウン、true/false ならチェックボックス
    key: { label: "キー（半音）", min: -6, max: 6, step: 1, value: 0 },
  },

  // 再生開始時に 1 回だけ。返した値は step() の ctx.state に入る（エコーなどを作っておく）
  setup({ synth }) {
    return {};
  },

  // 16 分音符ごとに呼ばれる。t は鳴らす時刻、bar は何小節目か、pos は小節内の位置（0〜15）
  step({ t, bar, pos }, { synth, params: p, sixteenth }) {
    const note = pos % 2 === 0 && MELODY[bar][pos / 2];
    if (note) synth.osc(t, note.len * 2 * sixteenth * 0.9, freq(note.midi + p.key), { wave: "pulse25", vol: 0.1 });

    const root = chordMidis(CHORDS[bar], p.key, 36, 7)[0];
    if (pos % 4 === 0) synth.osc(t, sixteenth * 3, freq(root), { wave: "triangle", vol: 0.3 });

    if (pos === 0 || pos === 8) synth.kick(t);
    if (pos === 4 || pos === 12) synth.snare(t);
  },
};
