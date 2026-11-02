// 音色の合成。どの音色もエンベロープ（ADSR）とフィルタを持つ。サンプル音源は使わない。
import { midiToHz } from "../core/theory.js";

// osc: [波形, デチューン（セント）, 音量, オクターブ] / adsr は秒（s は持続の割合）
const PRESETS = {
  pad: {
    oscs: [["sawtooth", -7, 0.5], ["sawtooth", 7, 0.5], ["triangle", 0, 0.5]],
    adsr: { a: 0.09, d: 0.3, s: 0.75, r: 0.3 },
    filter: { type: "lowpass", freq: 1100, q: 0.6, env: 500 },
    gain: 0.12,
  },
  piano: {
    oscs: [["triangle", 0, 0.8], ["sine", 0, 0.5, 1], ["square", 3, 0.06]],
    adsr: { a: 0.004, d: 1.3, s: 0.0, r: 0.15 },
    filter: { type: "lowpass", freq: 2200, q: 0.5, env: 2200 },
    gain: 0.22,
  },
  square: {
    oscs: [["square", 0, 1]],
    adsr: { a: 0.006, d: 0.1, s: 0.7, r: 0.08 },
    filter: { type: "lowpass", freq: 3600, q: 0.7, env: 800 },
    gain: 0.16,
  },
  triangle: {
    oscs: [["triangle", 0, 1]],
    adsr: { a: 0.008, d: 0.12, s: 0.8, r: 0.1 },
    filter: { type: "lowpass", freq: 5000, q: 0.5, env: 0 },
    gain: 0.34,
  },
  sawtooth: {
    oscs: [["sawtooth", -4, 0.6], ["sawtooth", 4, 0.6]],
    adsr: { a: 0.008, d: 0.15, s: 0.65, r: 0.1 },
    filter: { type: "lowpass", freq: 2600, q: 1, env: 1400 },
    gain: 0.15,
  },
  sine: {
    oscs: [["sine", 0, 1]],
    adsr: { a: 0.01, d: 0.1, s: 0.85, r: 0.12 },
    filter: { type: "lowpass", freq: 8000, q: 0.3, env: 0 },
    gain: 0.36,
  },
  round: {
    oscs: [["triangle", 0, 1], ["sine", 0, 0.7]],
    adsr: { a: 0.005, d: 0.2, s: 0.7, r: 0.07 },
    filter: { type: "lowpass", freq: 650, q: 0.8, env: 350 },
    gain: 0.5,
  },
  buzz: {
    oscs: [["sawtooth", 0, 0.7], ["square", 0, 0.3]],
    adsr: { a: 0.004, d: 0.14, s: 0.55, r: 0.06 },
    filter: { type: "lowpass", freq: 480, q: 2.5, env: 950 },
    gain: 0.34,
  },
};

const PEAK_FLOOR = 0.0001;

/** gain の値に ADSR を予約する（t に発音、t + dur で離す） */
function applyAdsr(param, t, dur, { a, d, s, r }, peak) {
  const sustain = Math.max(PEAK_FLOOR, peak * s);
  const end = t + Math.max(dur, 0.01);
  param.setValueAtTime(PEAK_FLOOR, t);
  if (end <= t + a) {
    // アタックの途中で離す短い音
    const reached = peak * ((end - t) / a);
    param.linearRampToValueAtTime(Math.max(PEAK_FLOOR, reached), end);
    param.exponentialRampToValueAtTime(PEAK_FLOOR, end + r);
    return end + r;
  }
  param.linearRampToValueAtTime(peak, t + a);
  if (end <= t + a + d) {
    // ディケイの途中で離す（目標へ向かう途中の値を計算して、そこから離す）
    const k = (end - t - a) / d;
    const now = peak * (sustain / peak) ** k;
    param.exponentialRampToValueAtTime(Math.max(PEAK_FLOOR, now), end);
  } else {
    param.exponentialRampToValueAtTime(sustain, t + a + d);
    param.setValueAtTime(sustain, end);
  }
  param.exponentialRampToValueAtTime(PEAK_FLOOR, end + r);
  return end + r;
}

export class Synth {
  constructor(ac) {
    this.ac = ac;
    this.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** 音程のある音を 1 つ予約する */
  tone(dest, preset, midi, t, dur, velocity = 0.8) {
    const p = PRESETS[preset] || PRESETS.triangle;
    const { ac } = this;
    const hz = midiToHz(midi);
    const filter = ac.createBiquadFilter();
    filter.type = p.filter.type;
    filter.Q.value = p.filter.q;
    const baseCut = Math.min(p.filter.freq, ac.sampleRate * 0.45);
    filter.frequency.setValueAtTime(Math.min(baseCut + p.filter.env, ac.sampleRate * 0.45), t);
    filter.frequency.exponentialRampToValueAtTime(baseCut, t + p.adsr.a + p.adsr.d + 0.001);
    const amp = ac.createGain();
    const end = applyAdsr(amp.gain, t, dur, p.adsr, p.gain * velocity);
    filter.connect(amp).connect(dest);
    for (const [type, cents, level, octave = 0] of p.oscs) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.value = hz * 2 ** octave;
      osc.detune.value = cents;
      const g = ac.createGain();
      g.gain.value = level;
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(end + 0.02);
    }
  }

  noiseBurst(dest, t, { type, freq, q = 0.7, adsr, peak }) {
    const { ac } = this;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = ac.createGain();
    const end = applyAdsr(amp.gain, t, adsr.a + adsr.d, adsr, peak);
    src.connect(filter).connect(amp).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(end + 0.02);
  }

  /** 周波数が急降下するサイン波（キックとタム） */
  sweep(dest, t, { from, to, time, adsr, peak, type = "sine" }) {
    const { ac } = this;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + time);
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    const amp = ac.createGain();
    const end = applyAdsr(amp.gain, t, adsr.a + adsr.d, adsr, peak);
    osc.connect(filter).connect(amp).connect(dest);
    osc.start(t);
    osc.stop(end + 0.02);
  }

  drum(dest, name, t, velocity = 0.8) {
    const v = velocity;
    switch (name) {
      case "kick":
        this.sweep(dest, t, { from: 170, to: 42, time: 0.09, adsr: { a: 0.002, d: 0.22, s: 0.001, r: 0.03 }, peak: 0.95 * v });
        break;
      case "snare":
        this.noiseBurst(dest, t, { type: "highpass", freq: 1500, adsr: { a: 0.001, d: 0.15, s: 0.001, r: 0.04 }, peak: 0.42 * v });
        this.sweep(dest, t, { from: 260, to: 175, time: 0.05, type: "triangle", adsr: { a: 0.001, d: 0.09, s: 0.001, r: 0.02 }, peak: 0.42 * v });
        break;
      case "hat":
        this.noiseBurst(dest, t, { type: "highpass", freq: 7500, adsr: { a: 0.001, d: 0.04, s: 0.001, r: 0.015 }, peak: 0.22 * v });
        break;
      case "openhat":
        this.noiseBurst(dest, t, { type: "highpass", freq: 6500, adsr: { a: 0.001, d: 0.24, s: 0.001, r: 0.04 }, peak: 0.2 * v });
        break;
      case "tomHigh":
        this.sweep(dest, t, { from: 300, to: 160, time: 0.1, adsr: { a: 0.002, d: 0.2, s: 0.001, r: 0.03 }, peak: 0.6 * v });
        break;
      case "tomLow":
        this.sweep(dest, t, { from: 200, to: 95, time: 0.12, adsr: { a: 0.002, d: 0.26, s: 0.001, r: 0.03 }, peak: 0.65 * v });
        break;
      case "crash":
        this.noiseBurst(dest, t, { type: "highpass", freq: 4500, adsr: { a: 0.002, d: 1.1, s: 0.001, r: 0.1 }, peak: 0.26 * v });
        break;
      default:
        break;
    }
  }
}
