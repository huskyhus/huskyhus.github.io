// 楽器の試聴。INSTRUMENTS の楽器を 1 つ選んで、旋律・和音・ベース・単音で鳴らし、音色を聴き比べる。
import { parseChord, parseLine, chordMidis, freq } from "../lib/theory.js";
import { INSTRUMENTS, INSTRUMENT_LABELS } from "../lib/synth.js";

const CHORDS = ["C", "Am", "F", "G"].map(parseChord);
const MELODY = [
  "E5 - D5 C5 D5 - G4 -",
  "C5 - - - A4 B4 C5 E5",
  "F5 - E5 D5 C5 - A4 -",
  "B4 - - - D5 - - -",
].map(parseLine);
const BASS = [
  "C3 - . C3 G2 - . G2",
  "A2 - . A2 E2 - . E2",
  "F2 - . F2 C3 - . C3",
  "G2 - . G2 D3 - B2 -",
].map(parseLine);

export default {
  title: "楽器の試聴",
  description: "楽器を 1 つ選んで、旋律・和音・ベース・単音で鳴らす。新しく足した木・皮の打楽器、弦、管・リード、声もここで聴ける。",
  bpm: 100,
  bars: 4,
  params: {
    inst: { label: "楽器", options: Object.keys(INSTRUMENTS), labels: INSTRUMENT_LABELS, value: "accordion" },
    pattern: { label: "鳴らし方", options: ["旋律", "和音（伸ばす）", "和音（刻む）", "ベース", "単音（1 小節に 1 音）"], value: "旋律" },
    octave: { label: "オクターブ", min: -2, max: 2, step: 1, value: 0 },
    vol: { label: "音量", min: 0.02, max: 0.3, step: 0.01, value: 0.12 },
    echo: { label: "エコー", value: true },
  },

  setup({ synth }) {
    return { echo: synth.echo({ time: 0.3, feedback: 0.2, wet: 0.15 }) };
  },

  step({ t, bar, pos }, { synth, params: p, state, sixteenth, say }) {
    if (bar === 0 && pos === 0) say(INSTRUMENT_LABELS[p.inst]);
    const shift = 12 * p.octave;
    const to = p.echo ? state.echo.input : undefined;
    const play = (m, len, vol = p.vol) => synth.play(p.inst, t, len * sixteenth * 0.95, freq(m + shift), { vol, to });
    const line = { 旋律: MELODY, ベース: BASS }[p.pattern];

    if (line) {
      const note = pos % 2 === 0 && line[bar][pos / 2];
      if (note) play(note.midi, note.len * 2);
    } else if (p.pattern === "和音（伸ばす）") {
      if (pos === 0) chordMidis(CHORDS[bar], 0, 57, 6).forEach(m => play(m, 16, p.vol * 0.5));
    } else if (p.pattern === "和音（刻む）") {
      if (pos % 4 === 0 || pos % 4 === 3) chordMidis(CHORDS[bar], 0, 57, 6).forEach(m => play(m, 1, p.vol * 0.5));
    } else if (pos === 0) {
      play(chordMidis(CHORDS[bar], 0, 60, 6)[0], 12);
    }
  },
};
