// 声部をまとめる卓。左右の位置ごとの楽器一式と、音割れを防ぐコンプレッサーを作る。
// 音の経路: 楽器 → パン → bus → コンプレッサー → level → out
import { createSynth } from "./synth.js";

// 左右の位置（-1 = 左、1 = 右）
export const PANS = { C: 0, L: -0.45, R: 0.45, LL: -0.85, RR: 0.85 };

/** 音をまとめる入り口（bus）と、卓全体の音量（level）を作る */
export function createBus(ac, out) {
  const bus = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  const level = ac.createGain();
  level.gain.value = 1.3;
  bus.connect(comp).connect(level).connect(out);
  return { bus, level };
}

/** パンの位置ごとの楽器一式。返り値の S[パン] がその位置の楽器 */
export function createMix({ ac, out, noiseBuf }) {
  const { bus, level } = createBus(ac, out);
  const S = {};
  for (const [k, v] of Object.entries(PANS)) {
    const pan = ac.createStereoPanner();
    pan.pan.value = v;
    pan.connect(bus);
    S[k] = createSynth(ac, pan, noiseBuf);
  }
  return { S, level };
}
