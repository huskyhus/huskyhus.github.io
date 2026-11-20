// 効果音。音の素材は使わず WebAudio で作る（銃声・爆発・拾う音・風・飛行機）。
// 距離で小さく、左右で振り分ける。

let ctx = null, master = null, noiseBuf = null;
let volume = 0.6;
const loops = {};

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function out(gain, pan) {
  const g = ctx.createGain();
  g.gain.value = gain;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    g.connect(p); p.connect(master);
  } else g.connect(master);
  return g;
}

function noise(dest, t0, dur, type, freq, q = 1, a = 0.002) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  return f;
}
function tone(dest, t0, dur, f0, f1, type = "sine", vol = 1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const distGain = d => 1 / (1 + d / 18);

// 武器ごとの銃声: [低音の高さ, 長さ, 明るさ]
const GUN = [[90, 0.08, 900], [200, 0.12, 2600], [170, 0.1, 2200], [130, 0.16, 2400], [110, 0.17, 1900], [80, 0.28, 1500], [100, 0.22, 2600], [70, 0.4, 2800], [120, 0.15, 2100]];

export function shot(wid, dist = 0, pan = 0) {
  if (!ac()) return;
  const t = ctx.currentTime;
  const [lo, dur, bright] = GUN[wid] ?? GUN[3];
  const far = dist > 60;
  const o = out(0.55 * distGain(dist), pan);
  if (wid === 0) { noise(o, t, 0.08, "bandpass", 500, 1); return; }
  noise(o, t, dur * (far ? 1.6 : 1), "lowpass", far ? bright * 0.35 : bright, 0.8);
  tone(o, t, dur * 0.8, lo * 1.6, lo * 0.6, "triangle", 0.7);
}

export function hitMarker(head) {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.25);
  tone(o, t, 0.06, head ? 1800 : 1300, head ? 1700 : 1200, "square", 0.3);
}
export function hurt() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.4);
  noise(o, t, 0.12, "lowpass", 400, 1);
  tone(o, t, 0.15, 160, 90, "sine", 0.6);
}
export function kill() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.35);
  tone(o, t, 0.12, 880, 880, "triangle", 0.6);
  tone(o, t + 0.1, 0.25, 1320, 1320, "triangle", 0.6);
}
export function pickup() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.25);
  tone(o, t, 0.08, 600, 900, "sine", 0.7);
}
export function click() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.3);
  noise(o, t, 0.03, "highpass", 3000, 1);
  noise(o, t + 0.12, 0.04, "highpass", 2200, 1);
}
export function empty() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.25);
  noise(o, t, 0.025, "highpass", 4000, 1);
}
export function explosion(dist = 0, pan = 0) {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(1.2 * distGain(dist * 0.6), pan);
  noise(o, t, 1.2, "lowpass", 700, 0.7, 0.005);
  tone(o, t, 0.6, 90, 30, "sine", 1);
}
export function step(pan = 0, vol = 0.12) {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(vol, pan);
  noise(o, t, 0.06, "bandpass", 300 + Math.random() * 200, 1.5);
}
export function heal() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.25);
  tone(o, t, 0.15, 520, 780, "sine", 0.5);
  tone(o, t + 0.12, 0.2, 780, 1040, "sine", 0.5);
}
export function alarm() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.3);
  for (let i = 0; i < 3; i++) tone(o, t + i * 0.22, 0.16, 740, 700, "square", 0.25);
}
export function heartbeat() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.5);
  tone(o, t, 0.12, 70, 45, "sine", 1);
  tone(o, t + 0.16, 0.14, 60, 40, "sine", 0.8);
}
export function pad() {
  if (!ac()) return;
  const now = ctx.currentTime, o = out(0.35);
  tone(o, now, 0.35, 220, 880, "triangle", 0.6);
}
export function stamp() {
  if (!ac()) return;
  const t = ctx.currentTime, o = out(0.3);
  tone(o, t, 0.08, 1000, 1500, "sine", 0.5);
  tone(o, t + 0.08, 0.12, 1500, 1200, "sine", 0.5);
}

/** 鳴らしっぱなしの音（name: plane / wind）。level 0 で止める */
export function loop(name, level) {
  if (!ac()) return;
  let L = loops[name];
  if (!L && level > 0) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    if (name === "plane") {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = "sawtooth"; o1.frequency.value = 62; o2.type = "sawtooth"; o2.frequency.value = 64.5;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 380;
      o1.connect(f); o2.connect(f); f.connect(g);
      o1.start(); o2.start();
      L = { g, stop: () => { o1.stop(); o2.stop(); } };
    } else {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 600; f.Q.value = 0.6;
      s.connect(f); f.connect(g); s.start();
      L = { g, f, stop: () => s.stop() };
    }
    loops[name] = L;
  }
  if (!L) return;
  L.g.gain.setTargetAtTime(level * 0.35, ctx.currentTime, 0.2);
  if (L.f) L.f.frequency.setTargetAtTime(300 + level * 900, ctx.currentTime, 0.2);
  if (level <= 0) {
    setTimeout(() => { if (loops[name] === L && L.g.gain.value < 0.01) { L.stop(); delete loops[name]; } }, 1500);
  }
}
