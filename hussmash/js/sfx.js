// 効果音（Web Audio で合成）。BGM と同じ AudioContext を使う。

import { audioContext } from "./bgm.js";

const MUTE_KEY = "hussmash.sfxMuted";
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } })();
let out = null, noise = null;

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* 無視 */ }
}

function ctx() {
  const ac = audioContext();
  if (!ac || muted) return null;
  if (!out) {
    out = ac.createGain();
    out.gain.value = 0.5;
    out.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ac;
}

function tone(ac, { type = "square", f0, f1 = f0, dur, vol = 0.2, at = 0 }) {
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function hiss(ac, { dur, vol = 0.3, freq = 2000, q = 0.8, at = 0 }) {
  const t = ac.currentTime + at;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise;
  f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t); s.stop(t + dur + 0.02);
}

export function sfx(name, p = 0) {
  const ac = ctx();
  if (!ac) return;
  switch (name) {
    case "hit": {
      const k = Math.min(1, p / 30);
      hiss(ac, { dur: 0.08 + 0.15 * k, vol: 0.25 + 0.3 * k, freq: 1800 - 1000 * k });
      tone(ac, { type: "sine", f0: 220 - 100 * k, f1: 50, dur: 0.12 + 0.2 * k, vol: 0.4 + 0.3 * k });
      break;
    }
    case "ko":
      hiss(ac, { dur: 0.9, vol: 0.5, freq: 600, q: 0.5 });
      tone(ac, { type: "sawtooth", f0: 300, f1: 40, dur: 0.8, vol: 0.3 });
      break;
    case "guard": tone(ac, { type: "triangle", f0: 1400, f1: 1100, dur: 0.12, vol: 0.2 }); break;
    case "counter":
      tone(ac, { type: "square", f0: 880, dur: 0.08, vol: 0.12 });
      tone(ac, { type: "square", f0: 1320, dur: 0.2, vol: 0.12, at: 0.07 });
      break;
    case "break": tone(ac, { type: "sawtooth", f0: 700, f1: 120, dur: 0.5, vol: 0.2 }); hiss(ac, { dur: 0.4, vol: 0.3, freq: 3000 }); break;
    case "heal": tone(ac, { type: "sine", f0: 1046, f1: 1568, dur: 0.15, vol: 0.06 }); break;
    case "reflect": tone(ac, { type: "triangle", f0: 600, f1: 1800, dur: 0.15, vol: 0.2 }); break;
    case "swap": tone(ac, { type: "sine", f0: 300, f1: 1200, dur: 0.25, vol: 0.2 }); tone(ac, { type: "sine", f0: 1200, f1: 300, dur: 0.25, vol: 0.15 }); break;
    case "jump": tone(ac, { type: "square", f0: 300, f1: 600, dur: 0.08, vol: 0.06 }); break;
    case "start": hiss(ac, { dur: 0.1, vol: 0.1, freq: 3500, q: 1.5 }); break;
    case "count": tone(ac, { type: "square", f0: 660, dur: 0.15, vol: 0.12 }); break;
    case "go": tone(ac, { type: "square", f0: 990, dur: 0.4, vol: 0.14 }); break;
    case "game": tone(ac, { type: "sawtooth", f0: 520, f1: 260, dur: 0.6, vol: 0.15 }); break;
    case "ui": tone(ac, { type: "triangle", f0: 880, dur: 0.06, vol: 0.08 }); break;
  }
}
