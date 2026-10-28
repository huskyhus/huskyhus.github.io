// 同じ形のフレーズを、いろいろな音階に当てはめて鳴らす。音階ごとの「色」を聴き比べる。
import { SCALES, scaleNote, freq } from "../lib/theory.js";

// 音階の何番目の音か（0 が根音、null は休符）。8 分音符 × 8 = 1 小節、4 小節で 1 周
const MOTIF = [
  [0, 1, 2, 3, 4, 3, 2, 1],
  [2, 4, 5, 4, 2, null, 1, 0],
  [4, 5, 6, 7, 6, 5, 4, 2],
  [3, 2, 1, 2, 0, null, null, null],
];
const NAMES = Object.keys(SCALES);

export default {
  title: "音階くらべ",
  description: "同じ動きのフレーズを、長音階・教会旋法・和風の音階などに当てはめる。「自動で巡回」で 4 小節ごとに音階が変わる。",
  bpm: 110,
  bars: 4,
  params: {
    scale: { label: "音階", options: NAMES, value: NAMES[0] },
    auto: { label: "自動で巡回", value: false },
    root: { label: "根音（MIDI）", min: 55, max: 67, step: 1, value: 62 },
    wave: { label: "音色", options: ["pulse25", "triangle", "square", "sine"], value: "pulse25" },
  },

  setup({ synth }) {
    return { echo: synth.echo({ time: 0.3, feedback: 0.25, wet: 0.25 }) };
  },

  step({ t, bar, pos }, { synth, params: p, state, sixteenth, say }) {
    if (bar === 0 && pos === 0) {
      if (p.auto && state.started) p.scale = NAMES[(NAMES.indexOf(p.scale) + 1) % NAMES.length];
      state.started = true;
      say(`${p.scale}: ${SCALES[p.scale].join(" ")}`);
    }
    const scale = SCALES[p.scale];

    const d = pos % 2 === 0 ? MOTIF[bar][pos / 2] : null;
    if (d !== null) synth.osc(t, sixteenth * 1.8, freq(scaleNote(scale, d, p.root + 12)), { wave: p.wave, vol: 0.1, to: state.echo.input });

    // ドローン: 根音と 5 度（5 度が音階に無いときは根音だけ）
    if (pos === 0) {
      synth.osc(t, sixteenth * 16, freq(p.root - 12), { wave: "triangle", vol: 0.22, attack: 0.05, release: 0.1 });
      if (scale.includes(7)) synth.osc(t, sixteenth * 16, freq(p.root - 5), { wave: "triangle", vol: 0.12, attack: 0.05, release: 0.1 });
    }
    if (pos % 4 === 2) synth.hat(t, false);
  },
};
