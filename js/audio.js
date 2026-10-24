// 効果音。音声ファイルは使わず Web Audio で合成する。
// ブラウザの自動再生制限があるので、最初のユーザー操作で unlock() を呼ぶ。
// 音の経路: 効果音 → sfxBus ┐
//           BGM（music.js）─┴→ master → スピーカー

const MUTE_KEY = "hustower.muted";
let ac = null;
let master = null;
let sfxBus = null;
let noiseBuf = null;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } })();

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = muted ? 0 : 1;
    sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // タブが裏に回ったら音を止める
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ac.suspend();
      else ac.resume();
    });
  }
  if (ac.state === "suspended" && !document.hidden) ac.resume();
}

/** BGM など他のモジュールから使う。unlock() 前は null。 */
export function getAudio() {
  return ac ? { ac, master, noiseBuf } : null;
}

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = m;
  if (sfxBus) sfxBus.gain.value = m ? 0 : 1;
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* 保存できなくてもよい */ }
}

function ready() { return ac && !muted && ac.state === "running"; }

function tone({ freq, to = freq, dur = 0.15, type = "sine", vol = 0.3, at = 0 }) {
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, freq = 800, to = freq, q = 1, at = 0 }) {
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const NOTE = n => 440 * 2 ** ((n - 69) / 12);

export const sfx = {
  drop() {
    if (!ready()) return;
    noise({ dur: 0.25, vol: 0.12, freq: 2400, to: 500, q: 0.8 });
  },
  /** strength: 0〜1 */
  land(strength) {
    if (!ready()) return;
    const s = Math.min(1, strength);
    tone({ freq: 150 + Math.random() * 30, to: 55, dur: 0.18, vol: 0.25 + 0.4 * s });
    noise({ dur: 0.12, vol: 0.08 + 0.15 * s, freq: 700, to: 200, q: 0.7 });
  },
  rotate() {
    if (!ready()) return;
    tone({ freq: 1500, to: 1300, dur: 0.035, type: "triangle", vol: 0.08 });
  },
  nice() {
    if (!ready()) return;
    tone({ freq: NOTE(84), dur: 0.25, type: "triangle", vol: 0.15 });
  },
  perfect(combo = 1) {
    if (!ready()) return;
    const base = 84 + Math.min(combo - 1, 6) * 2;
    [0, 4, 7].forEach((n, i) => tone({ freq: NOTE(base + n), dur: 0.35, type: "triangle", vol: 0.14, at: i * 0.06 }));
  },
  milestone() {
    if (!ready()) return;
    [72, 76, 79, 84].forEach((n, i) => tone({ freq: NOTE(n), dur: 0.3, type: "square", vol: 0.07, at: i * 0.09 }));
    tone({ freq: NOTE(88), dur: 0.6, type: "triangle", vol: 0.14, at: 0.36 });
  },
  gameOver() {
    if (!ready()) return;
    // 曲は止めないので、短く柔らかい「あっ」くらいの音にする
    [72, 67].forEach((n, i) => tone({ freq: NOTE(n), to: NOTE(n) * 0.94, dur: 0.22, type: "triangle", vol: 0.18, at: i * 0.12 }));
    noise({ dur: 0.35, vol: 0.12, freq: 500, to: 120, q: 0.5 });
  },
  hold() {
    if (!ready()) return;
    tone({ freq: 700, to: 1100, dur: 0.07, type: "square", vol: 0.06 });
    tone({ freq: 1100, to: 1600, dur: 0.08, type: "square", vol: 0.05, at: 0.06 });
  },
  click() {
    if (!ready()) return;
    tone({ freq: 900, to: 1200, dur: 0.06, type: "triangle", vol: 0.12 });
  },
};
