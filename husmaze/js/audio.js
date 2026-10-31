// 効果音。音声ファイルは使わず Web Audio で合成する。
// ブラウザの自動再生制限があるので、最初のユーザー操作で unlock() を呼ぶ。

const MUTE_KEY = "husmaze.muted";
let ac = null;
let out = null;
let lastBump = 0;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } })();

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createGain();
    out.gain.value = muted ? 0 : 0.5;
    out.connect(ac.destination);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ac.suspend();
      else ac.resume();
    });
  }
  if (ac.state === "suspended" && !document.hidden) ac.resume();
}

export const isMuted = () => muted;

export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* 保存できなくても動く */ }
  if (out) out.gain.value = v ? 0 : 0.5;
}

/** 1 音鳴らす。freq は [開始, 終了] で指定するとスライドする */
function tone(freq, { at = 0, dur = 0.12, type = "square", vol = 0.2 } = {}) {
  if (!ac || muted) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** 壁にぶつかった音。power は 0〜1 */
  bump(power) {
    if (!ac || ac.currentTime - lastBump < 0.06) return;
    lastBump = ac.currentTime;
    tone([180, 90], { dur: 0.07, type: "triangle", vol: 0.15 + 0.35 * power });
  },
  good() {
    [660, 880, 1320].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.12, vol: 0.12 }));
  },
  bad() {
    tone([300, 110], { dur: 0.35, type: "sawtooth", vol: 0.12 });
    tone([310, 115], { dur: 0.35, type: "sawtooth", vol: 0.08 });
  },
  /** 大当たり: 駆け上がるアルペジオ + 高いきらめき */
  jackpot() {
    [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.05, dur: 0.14, vol: 0.13 }));
    [2093, 2637, 3136].forEach((f, i) => tone(f, { at: 0.4 + i * 0.08, dur: 0.3, type: "triangle", vol: 0.08 }));
  },
  guard() {
    tone([1200, 1800], { dur: 0.15, type: "triangle", vol: 0.15 });
  },
  warp() {
    tone([200, 1600], { dur: 0.3, type: "sine", vol: 0.2 });
  },
  count(final) {
    tone(final ? 1046 : 523, { dur: final ? 0.35 : 0.12, vol: 0.15 });
  },
  goal() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
      tone(f, { at: i * 0.1, dur: i === 5 ? 0.5 : 0.12, vol: 0.14 }));
  },
};
