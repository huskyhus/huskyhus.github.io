// FM 音源の実験。プリセットを聴き比べたり、「手動で作る」で比と深さをいじって音色の変化を聴く。
import { parseChord, parseLine, chordMidis, freq } from "../lib/theory.js";
import { FM_PRESETS } from "../lib/synth.js";

const CHORDS = ["Fmaj7", "E7", "Am7", "C7"].map(parseChord);
const MELODY = [
  "E5 - - - C5 - A4 C5",
  "B4 - - - G#4 - B4 D5",
  "C5 - - - A4 - G4 A4",
  "G4 - - - . E4 G4 A#4",
].map(parseLine);
const PRESETS = Object.keys(FM_PRESETS);

export default {
  title: "FM 音源",
  description: "サイン波をサイン波で揺らして音色を作る。比（ratio）が整数だと楽器らしく、半端だと金属的に。深さ（index）を上げるほど明るくなる。",
  bpm: 96,
  bars: 4,
  params: {
    preset: { label: "音色", options: PRESETS, value: "epiano" },
    pattern: { label: "鳴らし方", options: ["メロディ", "和音", "単音（1 小節に 1 音）"], value: "メロディ" },
    octave: { label: "オクターブ", min: -2, max: 1, step: 1, value: 0 },
    manual: { label: "手動で作る（下のつまみを使う）", value: false },
    ratio: { label: "比 ratio", min: 0.5, max: 14, step: 0.5, value: 2 },
    index: { label: "深さ index", min: 0, max: 10, step: 0.1, value: 3 },
    bright: { label: "明るさの減衰（秒）", min: 0.02, max: 3, step: 0.01, value: 0.5 },
    decay: { label: "音量の減衰（秒）", min: 0.05, max: 4, step: 0.05, value: 1.2 },
  },

  setup({ synth }) {
    return { echo: synth.echo({ time: 0.3, feedback: 0.2, wet: 0.15 }) };
  },

  step({ t, bar, pos }, { synth, params: p, state, sixteenth, say }) {
    const voice = p.manual
      ? { attack: 0.003, decay: p.decay, sustain: 0, release: 0.3, mods: [{ ratio: p.ratio, index: p.index, sustain: p.index * 0.1, decay: p.bright }] }
      : { preset: p.preset };
    if (bar === 0 && pos === 0) say(p.manual ? `手動: ratio ${p.ratio} / index ${p.index}` : `${p.preset}（${FM_PRESETS[p.preset].label}）`);
    const shift = 12 * p.octave;
    const play = (m, dur, vol) => synth.fm(t, dur, freq(m + shift), { ...voice, vol, to: state.echo.input });

    if (p.pattern === "メロディ") {
      const note = pos % 2 === 0 && MELODY[bar][pos / 2];
      if (note) play(note.midi, note.len * 2 * sixteenth * 0.9, 0.12);
      if (pos === 0) play(chordMidis(CHORDS[bar], 0, 48, 7)[0], sixteenth * 14, 0.1);
    } else if (p.pattern === "和音") {
      if (pos === 0 || pos === 6 || pos === 12) chordMidis(CHORDS[bar], 0, 57, 6).forEach(m => play(m, sixteenth * 5, 0.05));
    } else if (pos === 0) {
      play(chordMidis(CHORDS[bar], 0, 60, 6)[0], sixteenth * 12, 0.12);
    }
  },
};
