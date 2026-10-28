// よく使われるコード進行を、同じ伴奏パターンで聴き比べる。
import { parseChord, chordMidis, freq } from "../lib/theory.js";

const PROGRESSIONS = {
  "王道進行 IV–V–iii–vi": ["F", "G", "Em", "Am"],
  "丸サ進行 IV△7–III7–vi7–I7": ["Fmaj7", "E7", "Am7", "C7"],
  "小室進行 vi–IV–V–I": ["Am", "F", "G", "C"],
  "カノン進行": ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  "ツーファイブ ii7–V7–I△7": ["Dm7", "G7", "Cmaj7", "Cmaj7"],
  "循環 I–vi–ii–V": ["C", "Am", "Dm", "G"],
  "ブルース（12 小節）": ["C7", "F7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
};
const parsed = Object.fromEntries(Object.entries(PROGRESSIONS).map(([k, v]) => [k, v.map(parseChord)]));

export default {
  title: "コード進行くらべ",
  description: "定番のコード進行を同じ伴奏で鳴らす。進行・伴奏の型・キーを変えて、雰囲気の違いを聴く。",
  bpm: 100,
  bars: p => parsed[p.prog].length,
  params: {
    prog: { label: "進行", options: Object.keys(PROGRESSIONS), value: "王道進行 IV–V–iii–vi" },
    pattern: { label: "伴奏", options: ["アルペジオ上昇", "アルペジオ上下", "ストローク", "白玉（伸ばす）"], value: "アルペジオ上昇" },
    key: { label: "キー（半音）", min: -6, max: 6, step: 1, value: 0 },
    drums: { label: "ドラム", value: true },
  },

  step({ t, bar, pos }, { synth, params: p, sixteenth, say }) {
    const chord = parsed[p.prog][bar];
    if (pos === 0) say(`${bar + 1} 小節目: ${PROGRESSIONS[p.prog][bar]}`);
    const tones = chordMidis(chord, p.key, 60, 6);

    if (p.pattern === "アルペジオ上昇") {
      const up = [...tones, tones[0] + 12];
      synth.osc(t, sixteenth * 0.9, freq(up[pos % up.length]), { wave: "pulse12", vol: 0.04 });
    } else if (p.pattern === "アルペジオ上下") {
      const upDown = [...tones, ...tones.slice(1, -1).reverse()];
      synth.osc(t, sixteenth * 0.9, freq(upDown[pos % upDown.length]), { wave: "pulse12", vol: 0.04 });
    } else if (p.pattern === "ストローク") {
      if ([0, 3, 6, 10, 12].includes(pos)) tones.forEach((m, i) => synth.osc(t + i * 0.012, sixteenth * 1.6, freq(m), { wave: "pulse25", vol: 0.03 }));
    } else if (pos === 0) {
      tones.forEach(m => synth.osc(t, sixteenth * 15.5, freq(m), { wave: "triangle", vol: 0.06, attack: 0.08, release: 0.3 }));
    }

    // ベース: 根音を 4 分で、4 拍目は 5 度
    const root = chordMidis(chord, p.key, 36, 7)[0];
    if (pos % 4 === 0) synth.osc(t, sixteenth * 3.2, freq(pos === 12 ? root + 7 : root), { wave: "triangle", vol: 0.3 });

    if (!p.drums) return;
    if (pos === 0 || pos === 10) synth.kick(t, 0.6);
    if (pos === 4 || pos === 12) synth.snare(t, 0.16);
    if (pos % 2 === 0) synth.hat(t, pos % 4 === 2);
  },
};
