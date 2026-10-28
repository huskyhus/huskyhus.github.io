// hustower の BGM の A メロ 8 小節を、このラボの道具で組み直したもの。
// 音色・エコー・対旋律・ハモリを切り替えて、それぞれが曲の印象にどう効いているかを聴き比べる。
import { parseChord, parseLine, chordMidis, harmonyBelow, freq } from "../lib/theory.js";
import { WAVES, INSTRUMENT_LABELS } from "../lib/synth.js";

const CHORDS = ["C", "G", "Am", "F", "C", "G", "F", "G"].map(parseChord);
const LEAD = [
  "C5 . G4 C5 E5 . D5 C5",
  "D5 . B4 G4 D5 - . .",
  "E5 . C5 A4 E5 F5 E5 D5",
  "C5 - A4 - C5 . D5 .",
  "C5 . G4 C5 E5 . G5 E5",
  "F5 . D5 B4 G5 - F5 E5",
  "D5 . C5 A4 F5 E5 D5 C5",
  "D5 . . B4 G4 . . .",
].map(parseLine);
const COUNTER = [
  "E4 - - - G4 - - -",
  "D4 - - - . B4 C5 D5",
  "A4 - - - C5 - B4 A4",
  "F4 - - - A4 - G4 -",
  "G4 - - - C5 - - -",
  "B4 - - - D5 - - -",
  "A4 - - - C5 - A4 -",
  "B4 - - - . D5 E5 F5",
].map(parseLine);

export default {
  title: "hustower A メロ",
  description: "ハスタワーの BGM の A メロ。音色やエコー、対旋律・ハモリの有無を切り替えて聴き比べる。",
  bpm: 120,
  bars: 8,
  params: {
    key: { label: "キー（半音）", min: -6, max: 6, step: 1, value: 0 },
    wave: { label: "リードの音色", options: WAVES, labels: INSTRUMENT_LABELS, value: "pulse25" },
    echo: { label: "エコー", value: true },
    counter: { label: "対旋律", value: false },
    harmony: { label: "3 度下のハモリ", value: false },
    drums: { label: "ドラム", value: true },
  },

  setup({ synth, bpm }) {
    return { echo: synth.echo({ time: (60 / bpm) * 0.75 }) };   // 付点 8 分
  },

  onTempo({ state, bpm }) {
    state.echo.setTime((60 / bpm) * 0.75);
  },

  step({ t, bar, pos }, { synth, params: p, state, sixteenth }) {
    const chord = CHORDS[bar];
    const key = p.key;
    state.echo.setWet(p.echo ? 0.3 : 0);

    // リード（8 分音符単位）
    const note = pos % 2 === 0 && LEAD[bar][pos / 2];
    if (note) {
      const dur = note.len * 2 * sixteenth * 0.92;
      const m = note.midi + key;
      synth.osc(t, dur, freq(m), { wave: p.wave, vol: 0.11, to: state.echo.input });
      if (p.harmony) synth.osc(t, dur, freq(harmonyBelow(m, chord, key)), { wave: "pulse12", vol: 0.05, to: state.echo.input });
    }

    const c = p.counter && pos % 2 === 0 && COUNTER[bar][pos / 2];
    if (c) synth.osc(t, c.len * 2 * sixteenth * 0.95, freq(c.midi + key), { wave: "square", vol: 0.035 });

    // ベース: 8 分でオクターブを行き来
    const root = chordMidis(chord, key, 36, 7)[0];
    if (pos % 2 === 0) synth.osc(t, 2 * sixteenth * 0.8, freq(pos % 4 === 0 ? root : root + 12), { wave: "triangle", vol: 0.32 });

    // アルペジオ: 16 分で和音を上下
    const tones = chordMidis(chord, key, 60, 6);
    synth.osc(t, sixteenth * 0.7, freq(tones[[0, 1, 2, 1][pos % 4]]), { wave: "pulse12", vol: 0.03 });

    if (!p.drums) return;
    if (bar === 7 && pos >= 12) { synth.snare(t, 0.12 + (pos - 12) * 0.04); return; }   // フィル
    if (pos === 0 || pos === 8 || pos === 10) synth.kick(t);
    if (pos === 4 || pos === 12) synth.snare(t);
    if (pos % 2 === 0) synth.hat(t, pos % 4 === 2);
  },
};
