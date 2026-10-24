// 8bit 風 BGM。Web Audio で合成し、先読みスケジューラで 16 分音符ごとに鳴らす。
// 楽器: リード / ソロ（25% パルス + エコー）/ ベース（三角波）/ アルペジオ（12.5% パルス）/ ドラム（ノイズ）
//
// 1 周（50 小節 ≒ 100 秒）の構成:
//   A（後半に対旋律）→ B（最後にキメ）→ 転調 +2 → A（対旋律）→ B（ハモリ）→ C メロ（対旋律）
//   → 哀愁ソロ 8 小節（引き）→ 溜め 2 小節 → 次の周はさらに +1 転調して全開で戻る
import { getAudio } from "./audio.js";

const MUSIC_KEY = "hustower.music";
const BASE_BPM = 120;
const LOOKAHEAD = 0.12;      // 何秒先まで予約するか
const TICK_MS = 25;
const VOLUME = 0.55;

// ---------------------------------------------------------------- 楽譜
// 1 小節 = 8 分音符 8 個。"-" は直前の音を伸ばす、"." は休符。キーは C で書き、転調は buildLap() で足す。
const A_CHORDS = ["C", "G", "Am", "F", "C", "G", "F", "G"];
const A_LEAD = [
  "C5 . G4 C5 E5 . D5 C5",
  "D5 . B4 G4 D5 - . .",
  "E5 . C5 A4 E5 F5 E5 D5",
  "C5 - A4 - C5 . D5 .",
  "C5 . G4 C5 E5 . G5 E5",
  "F5 . D5 B4 G5 - F5 E5",
  "D5 . C5 A4 F5 E5 D5 C5",
  "D5 . . B4 G4 . . .",
];
const B_CHORDS = ["Am", "F", "C", "G", "Am", "F", "Dm", "G"];
const B_LEAD = [
  "A5 . E5 . C5 . E5 A5",
  "G5 . F5 . C5 . F5 G5",
  "E5 . G5 . C6 - G5 E5",
  "D5 - B4 - G4 . B4 D5",
  "A5 . G5 A5 . E5 C5 E5",
  "F5 . E5 F5 . C5 A4 C5",
  "D5 E5 F5 G5 A5 G5 F5 E5",
  "D5 - . . G4 . B4 D5",
];
// C メロ: 丸サ進行（IV△7 – III7 – vi7 – I7）でノスタルジックに。最後は G でソロへ
const C_CHORDS = ["Fmaj7", "E7", "Am7", "C7", "Fmaj7", "E7", "Am7", "G"];
const C_LEAD = [
  "E5 - - - C5 - A4 C5",
  "B4 - - - G#4 - B4 D5",
  "C5 - - - A4 - G4 A4",
  "G4 - - - . E4 G4 A#4",
  "A4 - C5 - E5 - G5 -",
  "G#5 - - - F5 - E5 D5",
  "E5 - - - C5 - B4 C5",
  "D5 - - - . . . .",
];
// A の対旋律（1 回目）: 後半 4 小節だけ、低い長い音でそっと入り、最後は B へのピックアップ
const A_COUNTER_SOFT = [
  null, null, null, null,
  "E4 - - - - - - -",
  "D4 - - - - - - -",
  "C4 - - - A3 - - -",
  "B3 - - - . G4 A4 B4",
];
// A の対旋律（転調後）: メロディと反対に動き、メロディが休む所で合いの手
const A_COUNTER = [
  "E4 - - - G4 - - -",
  "D4 - - - . B4 C5 D5",
  "A4 - - - C5 - B4 A4",
  "F4 - - - A4 - G4 -",
  "G4 - - - C5 - - -",
  "B4 - - - D5 - - -",
  "A4 - - - C5 - A4 -",
  "B4 - - - . D5 E5 F5",
];
// ソロの対旋律: 後半 4 小節だけ、低い音で下から支える
const SOLO_COUNTER = [
  null, null, null, null,
  "A3 - - - C4 - - -",
  "B3 - - - D4 - - -",
  "G#3 - - - B3 - - -",
  "G#3 - - - - - - -",
];
// C メロの対旋律: 和音の 3 度と 7 度をゆっくりなぞる
const C_COUNTER = [
  "A4 - - - E4 - - -",
  "G#4 - - - D4 - - -",
  "C4 - - - G4 - - -",
  "E4 - - - A#4 - - -",
  "C5 - - - A4 - - -",
  "B4 - - - G#4 - - -",
  "A4 - - - G4 - - -",
  "B4 - - - - - - -",
];
// ソロは王道進行（IV–V–iii–vi）を 2 回、最後は E で半終止
const SOLO_CHORDS = ["F", "G", "Em", "Am", "F", "G", "E", "E"];

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const parseNote = s => {
  const sharp = s[1] === "#";
  return 12 * (Number(s.slice(sharp ? 2 : 1)) + 1) + PITCH[s[0]] + (sharp ? 1 : 0);
};
const QUALITY = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };
const parseChord = name => ({ root: PITCH[name[0]], tones: QUALITY[name.slice(1)] });
const freq = m => 440 * 2 ** ((m - 69) / 12);

/** ハモリの音: 和音の構成音のうち、3 度下 → 6 度下 → それ以外で近いもの の順に選ぶ */
function harmonyBelow(m, bar) {
  const pcs = bar.chord.tones.map(i => (bar.chord.root + bar.key + i) % 12);
  const inChord = n => pcs.includes(((n % 12) + 12) % 12);
  for (const d of [3, 4, 8, 9]) if (inChord(m - d)) return m - d;
  for (let d = 5; d <= 12; d++) if (inChord(m - d)) return m - d;
  return m - 12;
}

// ---------------------------------------------------------------- ソロ（32 分音符 × 32 = 1 小節）
// イベント: [音, 長さ(32分), { vib: ビブラート, from: 何半音下からしゃくり上げるか }]。音が null なら休符。
// 長い音で泣かせて、ため息のように下がる。G# で和声的短音階の哀愁を出す。

const SOLO = [
  // F: 下からしゃくって入り、ため息のように下がる
  [["E5", 16, { from: 2, vib: true }], ["F5", 8], ["E5", 4], ["D5", 4]],
  // G
  [["D5", 12, { vib: true }], ["C5", 4], ["B4", 8], ["C5", 4], ["D5", 4]],
  // Em: 高いところへ手を伸ばす
  [["E5", 6], ["G5", 2], ["B5", 16, { from: 2, vib: true }], ["A5", 4], ["G5", 4]],
  // Am
  [["A5", 12, { vib: true }], ["G5", 4], ["E5", 8], ["D5", 4], ["C5", 4]],
  // F: 2 周目は低めから
  [["C5", 8], ["A4", 4], ["C5", 4], ["F5", 16, { from: 1, vib: true }]],
  // G: 盛り上がって
  [["E5", 4], ["F5", 4], ["G5", 8], ["B5", 8], ["C6", 8, { from: 1 }]],
  // E: 頂点から G# へ
  [["B5", 16, { from: 2, vib: true }], ["A5", 4], ["G#5", 12, { vib: true }]],
  // E: 静かに着地
  [["E5", 24, { from: 1, vib: true }], [null, 8]],
];

// ---------------------------------------------------------------- 構成

/** 半音 k をおおむね -4〜+8 に収める（上がり続けると音域を外れるので、たまにオクターブ下に折り返す） */
const foldKey = k => { k = ((k % 12) + 12) % 12; return k > 8 ? k - 12 : k; };

/** 対旋律の楽譜（null の小節は無し）を section() の opts 形式にする */
const counterOpts = lines => Object.fromEntries(lines.map((c, i) => [i, c ? { counter: c.split(" ") } : {}]));

/** 小節ごとの opts を重ねる（同じ小節は後ろが優先で混ぜる） */
function mergeOpts(...list) {
  const out = {};
  for (const o of list) for (const [k, v] of Object.entries(o)) out[k] = { ...(out[k] || {}), ...v };
  return out;
}

/** opts[i] は i 小節目だけの上書き、opts.all は全小節への上書き */
function section(chords, lead, key, opts = {}) {
  return chords.map((c, i) => ({
    chord: parseChord(c), key, lead: lead ? lead[i].split(" ") : null,
    drums: i === chords.length - 1 ? "fill" : "normal", bass: "octave", arp: "normal",
    ...(opts.all || {}),
    ...(opts[i] || {}),
  }));
}

function buildLap(lap) {
  const k1 = foldKey(lap * 3);
  const k2 = foldKey(lap * 3 + 2);
  const nextKey = foldKey((lap + 1) * 3);
  const soloKey = k2 > 5 ? k2 - 12 : k2;   // キーが上がったらソロは 1 オクターブ下で弾く
  const bars = [];
  // 声部は周の中で少しずつ増やす: A 後半に対旋律 → 転調後 A は全編 → B にハモリ → C メロ
  bars.push(...section(A_CHORDS, A_LEAD, k1, mergeOpts(counterOpts(A_COUNTER_SOFT), lap > 0 ? { 0: { crash: true } } : {})));
  // キメ → 転調
  bars.push(...section(B_CHORDS, B_LEAD, k1, { 7: { drums: "kime", bass: "kime", arp: "kime" } }));
  bars.push(...section(A_CHORDS, A_LEAD, k2, mergeOpts(counterOpts(A_COUNTER), { 0: { crash: true } })));
  // 転調後の B は 3 度下のハモリを足して厚く
  bars.push(...section(B_CHORDS, B_LEAD, k2, { all: { harmony: true } }));
  // C メロ: 軽いドラム、4 和音のアルペジオ、対旋律
  bars.push(...section(C_CHORDS, C_LEAD, k2, {
    all: { drums: "light", arp: "four", tone: "nostalgic" },
    ...mergeOpts(counterOpts(C_COUNTER), { 7: { drums: "fill" } }),
  }));
  // 哀愁ソロ（引き）: ハーフタイムのドラム、伸ばすベース、8 分のアルペジオ
  SOLO_CHORDS.forEach((c, i) => {
    const byStart = new Map();
    let pos = 0;
    for (const ev of SOLO[i]) { byStart.set(pos, ev); pos += ev[1]; }
    bars.push({
      chord: parseChord(c), key: soloKey, lead: null, solo: byStart, crash: i === 0,
      drums: "ballad", bass: "long", arp: "slow",
      counter: SOLO_COUNTER[i] ? SOLO_COUNTER[i].split(" ") : undefined,
    });
  });
  // 溜め: 次の周のキーのドミナント（G）で 2 小節 → 全開で戻る
  bars.push({ chord: parseChord("G"), key: nextKey, lead: null, drums: "build1", bass: "pedal", arp: "build", riser: true });
  bars.push({ chord: parseChord("G"), key: nextKey, lead: null, drums: "build2", bass: "pedal", arp: "build" });
  return bars;
}

const LAP_BARS = buildLap(0).length;
const lapCache = new Map();
function barAt(index) {
  const lap = Math.floor(index / LAP_BARS);
  if (!lapCache.has(lap)) { lapCache.clear(); lapCache.set(lap, buildLap(lap)); }
  return lapCache.get(lap)[index % LAP_BARS];
}

// ---------------------------------------------------------------- 状態

let enabled = (() => { try { return localStorage.getItem(MUSIC_KEY) !== "0"; } catch { return true; } })();
let ctx = null;              // { ac, master, noiseBuf }
let bus = null;              // BGM 全体の音量
let leadIn = null;           // リード（エコーへの入り口）
let delayNode = null;
let waves = null;
let timer = null;
let step = 0;                // 16 分音符の通し番号
let nextTime = 0;
let bpm = BASE_BPM;

function setup() {
  if (bus) return true;
  ctx = getAudio();
  if (!ctx) return false;
  const { ac, master } = ctx;
  bus = ac.createGain();
  bus.gain.value = 0;
  bus.connect(master);

  // リードに付点 8 分のエコー
  leadIn = ac.createGain();
  leadIn.connect(bus);
  delayNode = ac.createDelay(1);
  const fb = ac.createGain();
  const wet = ac.createGain();
  fb.gain.value = 0.3;
  wet.gain.value = 0.3;
  leadIn.connect(delayNode);
  delayNode.connect(fb).connect(delayNode);
  delayNode.connect(wet).connect(bus);

  waves = { pulse25: pulseWave(ac, 0.25), pulse12: pulseWave(ac, 0.125) };
  return true;
}

/** デューティ比 duty のパルス波（ファミコンの矩形波チャンネル風） */
function pulseWave(ac, duty) {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ac.createPeriodicWave(real, imag);
}

// ---------------------------------------------------------------- 発音

function osc(t, dur, f, { wave, type = "square", vol, out = bus, slideFrom, slideTime = 0.03, vib }) {
  const { ac } = ctx;
  const o = ac.createOscillator();
  if (wave) o.setPeriodicWave(wave); else o.type = type;
  if (slideFrom) {
    o.frequency.setValueAtTime(slideFrom, t);
    o.frequency.exponentialRampToValueAtTime(f, t + slideTime);
  } else {
    o.frequency.setValueAtTime(f, t);
  }
  if (vib) {
    // 少し遅れてかかるビブラート
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 6.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.025, t + dur * 0.5);
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.01);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.setValueAtTime(vol, t + Math.max(0.005, dur - 0.02));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.01);
}

function noiseHit(t, dur, { vol, hp = 1000 }) {
  const { ac, noiseBuf } = ctx;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.3);
  s.stop(t + dur + 0.01);
}

/** 溜めの上昇ノイズ（dur 秒かけて高く・大きく） */
function riser(t, dur) {
  const { ac, noiseBuf } = ctx;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 3;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(9000, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.95);
  g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t);
  s.stop(t + dur + 0.01);
}

function kick(t, vol = 0.7) {
  const { ac } = ctx;
  const o = ac.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.17);
}

function snare(t, vol = 0.22) {
  noiseHit(t, 0.12, { vol, hp: 1200 });
  osc(t, 0.05, 220, { type: "triangle", vol: vol * 0.8, slideFrom: 330 });
}

const crash = t => noiseHit(t, 1.1, { vol: 0.2, hp: 3500 });
const hat = (t, open) => noiseHit(t, open ? 0.06 : 0.03, { vol: open ? 0.07 : 0.04, hp: 7000 });

/** 和音の構成音を、根音が base 付近に来るオクターブで返す */
function chordMidis(bar, base, maxAbove) {
  let root = base + ((bar.chord.root + bar.key) % 12 + 12) % 12;
  if (root - base > maxAbove) root -= 12;
  return bar.chord.tones.map(i => root + i);
}

/** step 番目（16 分音符単位）の音を時刻 t に予約する */
function schedule(s, t) {
  const sixteenth = 60 / bpm / 4;
  const bar = barAt(Math.floor(s / 16));
  const pos = s % 16;
  const afterKime = bar.drums === "kime" && pos > 8;

  if (pos === 0 && bar.crash) crash(t);
  if (pos === 0 && bar.riser) riser(t, sixteenth * 32 - sixteenth * 4);

  // リード（8 分音符単位、"-" の分だけ伸ばす）
  if (bar.lead && pos % 2 === 0 && !afterKime) {
    const i = pos / 2;
    const tok = bar.lead[i];
    if (tok !== "." && tok !== "-") {
      let len = 1;
      while (bar.lead[i + len] === "-") len++;
      const dur = len * 2 * sixteenth * 0.92;
      const m = parseNote(tok) + bar.key;
      const prev = bar.lead[i - 1];
      // 前の音から 3 度以内なら少しだけしゃくり上げる（8bit っぽい装飾）
      const slide = prev && prev.length > 1 && Math.abs(parseNote(prev) + bar.key - m) <= 4 ? freq(parseNote(prev) + bar.key) : undefined;
      // C メロは長い音にビブラートをかけてノスタルジックに
      const vib = bar.tone === "nostalgic" && len >= 3;
      osc(t, dur, freq(m), { wave: waves.pulse25, vol: 0.11, out: leadIn, slideFrom: slide, vib });
      // ハモリ: 和音の構成音から 3 度 / 6 度下を細い音で
      if (bar.harmony) osc(t, dur, freq(harmonyBelow(m, bar)), { wave: waves.pulse12, vol: 0.05, out: leadIn });
    }
  }

  // 対旋律（A・C メロ・ソロの一部）: 柔らかい矩形波
  if (bar.counter && pos % 2 === 0) {
    const i = pos / 2;
    const tok = bar.counter[i];
    if (tok !== "." && tok !== "-") {
      let len = 1;
      while (bar.counter[i + len] === "-") len++;
      osc(t, len * 2 * sixteenth * 0.95, freq(parseNote(tok) + bar.key), { type: "square", vol: 0.035 });
    }
  }

  // ソロ（32 分音符単位で発音位置を持つ）
  if (bar.solo) {
    for (const k of [0, 1]) {
      const ev = bar.solo.get(pos * 2 + k);
      if (!ev || !ev[0]) continue;
      const [name, len, o = {}] = ev;
      const m = parseNote(name) + bar.key;
      osc(t + k * sixteenth / 2, len * sixteenth / 2 * 0.95, freq(m), {
        wave: waves.pulse25, vol: 0.11, out: leadIn, vib: o.vib,
        slideFrom: o.from ? freq(m - o.from) : undefined, slideTime: 0.09,
      });
    }
  }

  // ベース
  const root = chordMidis(bar, 36, 7)[0];
  if (bar.bass === "octave" && pos % 2 === 0) {
    osc(t, 2 * sixteenth * 0.8, freq(pos % 4 === 0 ? root : root + 12), { type: "triangle", vol: 0.32 });
  } else if (bar.bass === "kime" && (pos < 8 ? pos % 2 === 0 : pos === 8)) {
    osc(t, (pos === 8 ? 3 : 2) * sixteenth * 0.8, freq(pos % 4 === 0 ? root : root + 12), { type: "triangle", vol: 0.34 });
  } else if (bar.bass === "pedal" && pos % 2 === 0 && !(bar.drums === "build2" && pos >= 12)) {
    osc(t, sixteenth * 1.6, freq(root), { type: "triangle", vol: 0.3 + pos * 0.006 });
  } else if (bar.bass === "long" && (pos === 0 || pos === 8 || pos === 14)) {
    // バラード: 2 分音符で伸ばし、4 拍目裏に 5 度で次へつなぐ
    const m = pos === 14 ? root + 7 : root;
    osc(t, sixteenth * (pos === 14 ? 1.8 : 5.6), freq(m), { type: "triangle", vol: 0.3 });
  }

  // アルペジオ: 16 分で和音を上下
  if (bar.arp !== "off" && !afterKime && !(bar.drums === "build2" && pos >= 12)) {
    const tones = chordMidis(bar, 60, 6);
    const n = bar.arp === "build"
      ? tones[pos % 3] + 12 * Math.floor(pos / 8)     // 溜め: 後半で 1 オクターブ上がる
      : tones[[0, 1, 2, 1][pos % 4]];
    if (bar.arp === "four") {
      // C メロ: 4 和音を 16 分で上るだけ（キラキラした懐かしさ）
      osc(t, sixteenth * 0.9, freq(tones[pos % tones.length] + 12), { wave: waves.pulse12, vol: 0.022 });
    } else if (bar.arp === "slow") {
      // バラード: 8 分でゆったり、少し長めに残す
      if (pos % 2 === 0) osc(t, sixteenth * 1.8, freq(tones[[0, 1, 2, 1, 0, 2, 1, 2][pos / 2]]), { wave: waves.pulse12, vol: 0.026 });
    } else {
      osc(t, sixteenth * 0.7, freq(n), { wave: waves.pulse12, vol: bar.arp === "build" ? 0.04 : 0.03 });
    }
  }

  // ドラム
  switch (bar.drums) {
    case "normal":
    case "solo":
      if (pos === 0 || pos === 8 || (bar.drums === "solo" && pos % 4 === 0) || pos === 10) kick(t);
      if (pos === 4 || pos === 12) snare(t);
      if (bar.drums === "solo" || pos % 2 === 0) hat(t, pos % 4 === 2);
      break;
    case "fill":
      if (pos >= 12) snare(t, 0.12 + (pos - 12) * 0.04);
      else {
        if (pos === 0 || pos === 8 || pos === 10) kick(t);
        if (pos === 4) snare(t);
        if (pos % 2 === 0) hat(t, pos % 4 === 2);
      }
      break;
    case "kime":
      // 3 拍目で全員そろえて一発 → 4 拍目にピックアップ
      if (pos < 8) {
        if (pos === 0) kick(t);
        if (pos === 4) snare(t);
        if (pos % 2 === 0) hat(t, pos % 4 === 2);
      } else if (pos === 8) { kick(t, 0.8); snare(t, 0.26); crash(t); }
      else if (pos >= 13) snare(t, 0.1 + (pos - 13) * 0.05);
      break;
    case "build1":
      // 4 つ打ち + 8 分スネア
      if (pos % 4 === 0) kick(t);
      if (pos % 2 === 0) snare(t, 0.08 + pos * 0.005);
      break;
    case "build2":
      // 16 分スネアロールで盛り上げ、最後の 1 拍は無音（溜め）
      if (pos < 12) {
        if (pos % 4 === 0) kick(t);
        snare(t, 0.12 + pos * 0.012);
      }
      break;
    case "light":
      // C メロ: キックとスネアは控えめ、ハットは 4 分裏だけ
      if (pos === 0 || pos === 8) kick(t, 0.5);
      if (pos === 4 || pos === 12) snare(t, 0.14);
      if (pos % 4 === 2) hat(t, true);
      break;
    case "ballad":
      // ハーフタイム: キックは 1 拍目、スネアは 3 拍目だけ。ハットは控えめ
      if (pos === 0 || pos === 14) kick(t, pos === 0 ? 0.6 : 0.35);
      if (pos === 8) snare(t, 0.16);
      if (pos % 4 === 2) hat(t, false);
      break;
  }
}

function tick() {
  const { ac } = ctx;
  // タブ復帰などで遅れたら、まとめて鳴らさずに今から再開
  if (nextTime < ac.currentTime - 0.05) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + LOOKAHEAD) {
    schedule(step, nextTime);
    nextTime += 60 / bpm / 4;
    step++;
  }
}

// ---------------------------------------------------------------- 公開 API

export const music = {
  /** at: 何小節目から始めるか（確認用） */
  start(at = 0) {
    if (!setup()) return;
    this.stop(0);
    const { ac } = ctx;
    step = at * 16;
    bpm = BASE_BPM;
    delayNode.delayTime.value = (60 / bpm) * 0.75;
    nextTime = ac.currentTime + 0.1;
    bus.gain.cancelScheduledValues(ac.currentTime);
    bus.gain.setValueAtTime(enabled ? VOLUME : 0, ac.currentTime);
    timer = setInterval(tick, TICK_MS);
    tick();
  },

  /** fade 秒かけて止める */
  stop(fade = 0.5) {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    const { ac } = ctx;
    bus.gain.cancelScheduledValues(ac.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ac.currentTime);
    bus.gain.linearRampToValueAtTime(0, ac.currentTime + Math.max(0.01, fade));
  },

  get playing() { return !!timer; },

  /** 失敗したときなどに、一瞬だけ音量を下げて戻す（曲は止めない） */
  duck(level = 0.35, hold = 1.2, release = 1.5) {
    if (!timer || !enabled) return;
    const t = ctx.ac.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(VOLUME * level, t + 0.08);
    bus.gain.setValueAtTime(VOLUME * level, t + hold);
    bus.gain.linearRampToValueAtTime(VOLUME, t + hold + release);
  },

  /** 高さに応じてテンポを上げる */
  setTempo(newBpm) {
    bpm = newBpm;
    if (delayNode) delayNode.delayTime.setTargetAtTime((60 / bpm) * 0.75, ctx.ac.currentTime, 0.1);
  },

  get enabled() { return enabled; },

  setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch { /* 保存できなくてもよい */ }
    if (bus && timer) {
      const t = ctx.ac.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(on ? VOLUME : 0, t + 0.2);
    }
  },

  /** 構成の確認用 */
  get lapBars() { return LAP_BARS; },
  barAt,
};
