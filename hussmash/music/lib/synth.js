// 楽器。createSynth(ac, out, noiseBuf) で、その出力先（out）に鳴らす楽器一式を作る。
// 8bit 系（パルス波など）は hustower/js/music.js の音作りから。ほかに FM 音源、実在の楽器に寄せた音源、ドラムキットがある。
// どの楽器も play(楽器名, t, 長さ, 周波数, { vol }) で鳴らせる（楽器名は INSTRUMENTS のキー）。

// ---------------------------------------------------------------- 波形

/** デューティ比 duty のパルス波（ファミコンの矩形波チャンネル風） */
function pulseWave(ac, duty) {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ac.createPeriodicWave(real, imag);
}

/** 1 周期分のサンプルから波形を作る（フーリエ係数を計算する） */
function sampledWave(ac, samples, n = 64) {
  const N = samples.length;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    for (let j = 0; j < N; j++) {
      real[k] += (2 / N) * samples[j] * Math.cos((2 * Math.PI * k * j) / N);
      imag[k] += (2 / N) * samples[j] * Math.sin((2 * Math.PI * k * j) / N);
    }
  }
  return ac.createPeriodicWave(real, imag);
}

const DUTIES = { pulse06: 0.0625, pulse12: 0.125, pulse18: 0.1875, pulse25: 0.25, pulse33: 1 / 3, pulse40: 0.4 };

/** ファミコンの三角波: 16 段の階段になっている */
const NES_TRI = Array.from({ length: 32 }, (_, i) => ((i < 16 ? 15 - i : i - 16) - 7.5) / 7.5);

/** 選べる音色の名前（osc の wave に渡す） */
export const WAVES = [...Object.keys(DUTIES), "square", "nestri", "triangle", "sawtooth", "sine"];

// AudioContext ごとに 1 回だけ作る（楽器一式をたくさん作っても重くならないように）
const waveCache = new WeakMap();
function getWaves(ac) {
  if (!waveCache.has(ac)) {
    const w = Object.fromEntries(Object.entries(DUTIES).map(([k, d]) => [k, pulseWave(ac, d)]));
    w.nestri = sampledWave(ac, NES_TRI);
    waveCache.set(ac, w);
  }
  return waveCache.get(ac);
}

// ---------------------------------------------------------------- 音色の一覧

/**
 * FM 音源の音色。サイン波（キャリア）の周波数を、別のサイン波（モジュレータ）で揺らして倍音を作る。
 * 音量: attack / decay 秒で sustain（0〜1）まで下がり、離したら release 秒で消える
 * mods: モジュレータ（並列）。ratio = 周波数の比（整数だと楽音、半端だと金属的）、
 *       index = 揺らす深さ（大きいほど明るくギラギラ）。attack 秒で index、decay 秒で sustain（これも index の値）へ
 */
export const FM_PRESETS = {
  epiano: {
    label: "エレピ", attack: 0.003, decay: 1.4, sustain: 0, release: 0.3,
    mods: [{ ratio: 1, index: 1.6, sustain: 0.2, decay: 0.8 }, { ratio: 14, index: 0.4, sustain: 0, decay: 0.08 }],
  },
  bell: {
    label: "ベル", attack: 0.002, decay: 3, sustain: 0, release: 1.5,
    mods: [{ ratio: 3.5, index: 4, sustain: 0.3, decay: 2.5 }],
  },
  bass: {
    label: "FM ベース", attack: 0.003, decay: 0.4, sustain: 0.6, release: 0.05,
    mods: [{ ratio: 1, index: 3.5, sustain: 0.8, decay: 0.25 }],
  },
  brass: {
    label: "ブラス", attack: 0.05, decay: 0.3, sustain: 0.8, release: 0.1,
    mods: [{ ratio: 1, index: 3.5, sustain: 2.5, attack: 0.08, decay: 0.3 }],
  },
  marimba: {
    label: "マリンバ", attack: 0.002, decay: 0.5, sustain: 0, release: 0.1,
    mods: [{ ratio: 4, index: 2.5, sustain: 0, decay: 0.06 }],
  },
  organ: {
    label: "オルガン", attack: 0.01, decay: 0.1, sustain: 1, release: 0.05,
    mods: [{ ratio: 2, index: 0.8, sustain: 0.8, decay: 0.1 }, { ratio: 3, index: 0.3, sustain: 0.3, decay: 0.1 }],
  },
};

const WAVE_LABEL = {
  pulse06: "パルス 6.25%（いちばん細い）", pulse12: "パルス 12.5%", pulse18: "パルス 18.75%", pulse25: "パルス 25%",
  pulse33: "パルス 33%", pulse40: "パルス 40%", square: "矩形波（パルス 50%）", nestri: "ファミコン三角波（4bit）",
  triangle: "三角波", sawtooth: "ノコギリ波", sine: "サイン波",
};

/**
 * play() で選べる楽器。kind が鳴らし方、gain は楽器を差し替えても音量がそろうようにする補正。
 * modal の partials は [周波数の比, 音量, 消えるまでの秒数]（叩く楽器の振動の成分）
 */
export const INSTRUMENTS = {
  ...Object.fromEntries(WAVES.map(w => [w, { group: "8bit・電子音", label: WAVE_LABEL[w], kind: "osc", gain: { sine: 1.3, triangle: 1.2, nestri: 1.2 }[w] }])),
  "synth-bass": { group: "8bit・電子音", label: "シンセベース（フィルター）", kind: "synthBass" },
  ...Object.fromEntries(Object.entries(FM_PRESETS).map(([k, v]) => [`fm-${k}`, { group: "FM", label: v.label, kind: "fm", preset: k }])),
  piano: { group: "リアル", label: "ピアノ", kind: "piano", gain: 1.2 },
  guitar: { group: "リアル", label: "アコースティックギター", kind: "pluck", decay: 0.996, bright: 0.55, gain: 1.6 },
  harp: { group: "リアル", label: "ハープ", kind: "pluck", decay: 0.998, bright: 0.85, gain: 1.4 },
  "upright-bass": { group: "リアル", label: "ウッドベース", kind: "pluck", decay: 0.994, bright: 0.25, gain: 1 },
  marimba: { group: "リアル", label: "マリンバ", kind: "modal", click: true, partials: [[1, 1, 0.5], [3.93, 0.35, 0.12], [10.7, 0.12, 0.04]] },
  vibraphone: { group: "リアル", label: "ビブラフォン", kind: "modal", tremolo: 5.5, partials: [[1, 1, 2.5], [3.99, 0.3, 0.7], [10.1, 0.08, 0.15]] },
  glocken: { group: "リアル", label: "グロッケン", kind: "modal", gain: 0.7, partials: [[1, 1, 1.6], [2.76, 0.4, 0.6], [5.4, 0.2, 0.3], [8.93, 0.1, 0.15]] },
  strings: { group: "リアル", label: "ストリングス", kind: "strings" },
  flute: { group: "リアル", label: "フルート", kind: "flute", gain: 1.3 },
  brass: { group: "リアル", label: "ブラス（トランペット風）", kind: "brass" },
  organ: { group: "リアル", label: "オルガン（ドローバー）", kind: "organ", gain: 0.6 },
  // 打楽器（木・皮）
  xylophone: { group: "打楽器", label: "シロフォン（木琴）", kind: "modal", click: true, gain: 1.6, partials: [[1, 1, 0.22], [3, 0.4, 0.06], [6.1, 0.12, 0.02]] },
  woodblock: { group: "打楽器", label: "ウッドブロック", kind: "modal", click: true, gain: 2, partials: [[1, 1, 0.07], [2.4, 0.5, 0.03], [4.1, 0.2, 0.015]] },
  timpani: { group: "打楽器", label: "ティンパニ", kind: "drum", bend: 1.04, life: 2.2, overtones: [[1.5, 0.5], [1.98, 0.3], [2.44, 0.12]], hit: { hz: 600, filter: "lowpass", vol: 0.5, dur: 0.06 }, gain: 1 },
  conga: { group: "打楽器", label: "コンガ", kind: "drum", bend: 1.15, life: 0.4, overtones: [[1.58, 0.25]], hit: { hz: 2200, vol: 0.35, dur: 0.02 }, gain: 1.3 },
  bongo: { group: "打楽器", label: "ボンゴ", kind: "drum", bend: 1.2, life: 0.18, overtones: [[1.6, 0.3]], hit: { hz: 3500, vol: 0.4, dur: 0.015 }, gain: 1.6 },
  // 撥弦・擦弦
  ukulele: { group: "弦", label: "ウクレレ", kind: "pluck", decay: 0.992, bright: 0.7, gain: 1.5 },
  mandolin: { group: "弦", label: "マンドリン（長い音はトレモロ）", kind: "pluck", decay: 0.995, bright: 0.9, tremolo: 12, gain: 1.6 },
  banjo: { group: "弦", label: "バンジョー", kind: "pluck", decay: 0.988, bright: 1, gain: 1.4 },
  pizzicato: { group: "弦", label: "ピチカート", kind: "pluck", decay: 0.982, bright: 0.4, gain: 1.5 },
  violin: { group: "弦", label: "バイオリン（独奏）", kind: "strings", detunes: [0], attack: 0.06, cutoff: 7, vibDepth: 18, vibDelay: 0.15, body: [[500, 4], [3000, 5]], gain: 1.3 },
  cello: { group: "弦", label: "チェロ（独奏）", kind: "strings", detunes: [0], attack: 0.09, cutoff: 6, vibDepth: 16, vibDelay: 0.2, body: [[250, 5], [1200, 3]], gain: 1.5 },
  // 木管・リード・金管（ベル系の鳴り物は入れない）
  accordion: { group: "管・リード", label: "アコーディオン", kind: "reed", wave: "pulse40", detunes: [0, 14], cutoff: 6, formants: [[1200, 1.5, 4]], attack: 0.03, gain: 1.7 },
  harmonica: { group: "管・リード", label: "ハーモニカ", kind: "reed", wave: "pulse33", detunes: [0, 6], cutoff: 5, formants: [[1600, 2, 5]], attack: 0.025, scoop: 0.97, vibDepth: 0.006, gain: 2 },
  oboe: { group: "管・リード", label: "オーボエ", kind: "reed", wave: "sawtooth", cutoff: 9, formants: [[1100, 3, 9], [2900, 3, 4]], highpass: 2, attack: 0.04, vibDepth: 0.007, gain: 0.9 },
  clarinet: { group: "管・リード", label: "クラリネット", kind: "reed", wave: "square", cutoff: 4, formants: [[1500, 2, 3]], attack: 0.04, vibDepth: 0.002, gain: 1 },
  bassoon: { group: "管・リード", label: "ファゴット", kind: "reed", wave: "pulse25", cutoff: 6, formants: [[500, 3, 7], [1150, 3, 4]], attack: 0.05, vibDepth: 0.004, gain: 1.4 },
  bagpipe: { group: "管・リード", label: "バグパイプ（チャンター）", kind: "reed", wave: "pulse25", detunes: [0, 4], cutoff: 12, formants: [[1300, 3, 7]], attack: 0.01, gain: 2 },
  recorder: { group: "管・リード", label: "リコーダー", kind: "flute", cutoff: 3.5, breath: 0.08, attack: 0.03, vibDepth: 0.003 },
  ocarina: { group: "管・リード", label: "オカリナ", kind: "flute", wave: "sine", cutoff: 4, breath: 0.05, attack: 0.04, vibDepth: 0.005, gain: 1 },
  panflute: { group: "管・リード", label: "パンフルート", kind: "flute", wave: "sine", cutoff: 3, breath: 0.35, attack: 0.05, vibDepth: 0.004, chiff: true, gain: 1 },
  horn: { group: "管・リード", label: "ホルン", kind: "brass", peak: 3, open: 2, attack: 0.06, gain: 1.4 },
  trombone: { group: "管・リード", label: "トロンボーン", kind: "brass", peak: 5, open: 3, attack: 0.04, scoop: 0.94, gain: 1.2 },
  tuba: { group: "管・リード", label: "チューバ", kind: "brass", peak: 4, open: 2.5, attack: 0.04, gain: 1.6 },
  // 声
  whistle: { group: "声", label: "口笛", kind: "flute", wave: "sine", cutoff: 8, breath: 0.04, attack: 0.02, vibDepth: 0.012, vibRate: 6, scoop: 0.96, gain: 0.95 },
  hum: { group: "声", label: "ハミング", kind: "voice", vowel: "m", vibDepth: 0.008, attack: 0.08, gain: 2.2 },
  "voice-aah": { group: "声", label: "歌声（アー）", kind: "voice", vowel: "a", vibDepth: 0.012, attack: 0.07, gain: 4.4 },
  choir: { group: "声", label: "合唱（アー）", kind: "voice", vowel: "a", detunes: [-10, 0, 9], vibDepth: 0.006, attack: 0.25, gain: 4.5 },
  "choir-ooh": { group: "声", label: "合唱（ウー）", kind: "voice", vowel: "u", detunes: [-10, 0, 9], vibDepth: 0.006, attack: 0.25, gain: 2.4 },
};

/** 声の母音: [フォルマントの周波数, 帯域幅, 強さ]（大人の声のおおよその値） */
const VOWELS = {
  a: [[800, 80, 1], [1150, 90, 0.5], [2900, 120, 0.25], [3900, 130, 0.1]],
  u: [[325, 50, 1], [700, 60, 0.2], [2700, 170, 0.05]],
  m: [[250, 60, 1], [1000, 150, 0.05]],   // 口を閉じたハミング: ほぼ低い共鳴だけ
};

/** プルダウンに出す名前（「グループ: 名前」） */
export const INSTRUMENT_LABELS = Object.fromEntries(Object.entries(INSTRUMENTS).map(([k, v]) => [k, `${v.group}: ${v.label}`]));

/** kit() で選べるドラムキット */
export const KITS = { "8bit": "8bit", acoustic: "アコースティック", electro: "エレクトロ（808 風）" };

// 808 のハイハットは、半端な比の矩形波 6 本を重ねて金属っぽくしている
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];

// Karplus-Strong の撥弦の音は、同じ音なら作り直さない（AudioContext ごと）
const pluckCache = new WeakMap();

// ---------------------------------------------------------------- 楽器一式

export function createSynth(ac, out, noiseBuf) {
  const waves = getWaves(ac);

  /**
   * 1 音鳴らす。f は周波数（Hz）。
   * wave: WAVES のどれか / slideFrom: この周波数からしゃくり上げる / vib: 遅れてかかるビブラート（true か、揺れ幅の割合。true は 0.025）
   * detune: 音程をずらす量（セント。少しずらした 2 本を重ねると、揺らぎのある厚い音になる）
   */
  function osc(t, dur, f, { wave = "square", vol = 0.1, to = out, slideFrom, slideTime = 0.03, vib, attack = 0.004, release = 0.02, detune = 0 } = {}) {
    const o = ac.createOscillator();
    if (waves[wave]) o.setPeriodicWave(waves[wave]); else o.type = wave;
    if (detune) o.detune.setValueAtTime(detune, t);
    if (slideFrom) {
      o.frequency.setValueAtTime(slideFrom, t);
      o.frequency.exponentialRampToValueAtTime(f, t + slideTime);
    } else {
      o.frequency.setValueAtTime(f, t);
    }
    if (vib) vibrato(o.frequency, t, dur, f * (vib === true ? 0.025 : vib));
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack + 0.001, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(to);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  /** param（周波数や detune）を depth の幅で揺らす。音の途中から深くなる */
  function vibrato(param, t, dur, depth, { rate = 6.5, delay = dur * 0.5 } = {}) {
    const lfo = ac.createOscillator();
    const d = ac.createGain();
    lfo.frequency.value = rate;
    d.gain.setValueAtTime(0, t);
    d.gain.linearRampToValueAtTime(depth, t + Math.max(0.01, delay));
    lfo.connect(d).connect(param);
    lfo.start(t);
    lfo.stop(t + dur + 0.6);
  }

  /** 押している間 vol、離したら release の時定数で消える音量の入れ物 */
  function envGain(t, dur, vol, { attack = 0.005, release = 0.05, to = out } = {}) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur), release / 3);
    g.connect(to);
    return g;
  }

  /**
   * FM 音源で 1 音鳴らす。dur は鍵盤を押している長さ（このあと release 秒で消える）。
   * preset で FM_PRESETS の音色を選び、attack / mods などを渡すとその部分だけ上書きする
   */
  function fm(t, dur, f, { preset = "epiano", vol = 0.1, to = out, ...over } = {}) {
    const { attack, decay, sustain, release, mods } = { ...FM_PRESETS[preset], ...over };
    const end = t + dur + release * 1.5;
    const car = ac.createOscillator();
    car.frequency.setValueAtTime(f, t);
    for (const m of mods) {
      const mf = f * m.ratio;
      const mo = ac.createOscillator();
      mo.frequency.setValueAtTime(mf, t);
      const depth = ac.createGain();   // 揺らす幅（Hz）= index × モジュレータの周波数
      const a = m.attack || 0;
      depth.gain.setValueAtTime(a ? 0 : m.index * mf, t);
      if (a) depth.gain.linearRampToValueAtTime(m.index * mf, t + a);
      depth.gain.setTargetAtTime((m.sustain ?? 0) * mf, t + a, m.decay / 3);
      mo.connect(depth).connect(car.frequency);
      mo.start(t);
      mo.stop(end);
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(vol * sustain, t + attack, decay / 3);
    g.gain.setTargetAtTime(0, t + dur, release / 3);
    car.connect(g).connect(to);
    car.start(t);
    car.stop(end);
  }

  // ---------------------------------------------------------------- リアル寄りの音源

  /** 撥弦（Karplus-Strong）: ノイズを 1 周期分の長さで繰り返しながら丸めていくと、弦をはじいた音になる */
  function pluck(t, dur, f, { vol = 0.1, to = out, decay = 0.996, bright = 0.5, tremolo } = {}) {
    // tremolo: 長い音を、1 秒に tremolo 回はじき直して伸ばす（マンドリン）
    if (tremolo && dur > 2 / tremolo) {
      for (let i = 0; i / tremolo < dur; i++) pluck(t + i / tremolo, Math.min(1.5 / tremolo, dur - i / tremolo), f, { vol: vol * (i % 2 ? 0.6 : 0.8), to, decay, bright });
      return;
    }
    if (!pluckCache.has(ac)) pluckCache.set(ac, new Map());
    const cache = pluckCache.get(ac);
    const sr = ac.sampleRate;
    const N = Math.max(2, Math.round(sr / f));
    const key = `${N}:${decay}:${bright}`;
    if (!cache.has(key)) {
      const len = Math.floor(sr * 3);
      const buf = ac.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let lp = 0, peak = 0;
      // 最初の 1 周期: 低い成分寄りのノイズ（bright が小さいほど柔らかい音）
      for (let i = 0; i < N; i++) { lp += bright * (Math.random() * 2 - 1 - lp); d[i] = lp; peak = Math.max(peak, Math.abs(lp)); }
      for (let i = 0; i < N; i++) d[i] /= peak || 1;
      for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
      cache.set(key, buf);
    }
    const s = ac.createBufferSource();
    s.buffer = cache.get(key);
    s.playbackRate.value = f / (sr / N);   // 周期を整数にした分のずれを直す
    s.connect(envGain(t, dur, vol, { attack: 0.001, release: 0.12, to }));
    s.start(t);
    s.stop(t + Math.min(dur + 0.4, 3));
  }

  /** 叩く楽器（モーダル合成）: 振動の成分ごとにサイン波を鳴らし、それぞれの速さで消していく */
  /**
   * 叩く楽器。partials の正弦波を重ね、それぞれの速さで消す。
   * 追加の設定（書かなければ今までどおり）:
   *   detune: 音程をずらす量（セント。ずらした 2 本を重ねると、ゆっくりうねる）
   *   swell:  トレモロが深くなるまでの秒数（叩いた瞬間は揺れず、余韻で揺れ始める）
   *   spin:   左右へゆっくり回る速さ（Hz。モーターで回る羽根の、うなるような動き）
   *   mallet: やわらかいマレットの打音を足す
   */
  function modal(t, dur, f, { vol = 0.1, to = out, partials, tremolo, click, detune = 0, swell = 0, spin = 0, mallet } = {}) {
    let dest = to;
    if (spin) {
      const pan = ac.createStereoPanner();
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = spin;
      depth.gain.value = 0.6;
      lfo.connect(depth).connect(pan.pan);
      pan.connect(dest);
      lfo.start(t);
      lfo.stop(t + dur + 0.6);
      dest = pan;
    }
    if (tremolo) {
      const trem = ac.createGain();
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = tremolo;
      depth.gain.setValueAtTime(swell ? 0 : 0.3, t);
      if (swell) depth.gain.linearRampToValueAtTime(0.3, t + swell);
      lfo.connect(depth).connect(trem.gain);
      trem.connect(dest);
      lfo.start(t);
      lfo.stop(t + dur + 0.6);
      dest = trem;
    }
    const total = partials.reduce((s, p) => s + p[1], 0);
    for (const [ratio, amp, life] of partials) {
      if (f * ratio > 18000) continue;
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f * ratio;
      if (detune) o.detune.value = detune;
      const g = ac.createGain();
      const v = (vol * amp) / total;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.002);
      g.gain.setTargetAtTime(0, t + 0.002, life / 4);
      g.gain.setTargetAtTime(0, t + dur, 0.1);     // 離したら止める
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + Math.min(dur + 0.5, life * 1.5 + 0.05));
    }
    if (click) noise(t, 0.012, { vol: vol * 0.4, filter: "bandpass", hz: Math.min(f * 3, 6000), q: 1, to });
    if (mallet) noise(t, 0.025, { vol: vol * 0.18, filter: "lowpass", hz: Math.min(f * 4, 5000), to: dest });
  }

  /** ピアノ: 少しずつ高めにずれた倍音（弦の硬さ）+ 2 本の弦のうなり + ハンマーの音 */
  function piano(t, dur, f, { vol = 0.1, to = out } = {}) {
    const B = 0.0004;
    const life = Math.min(8, Math.max(0.6, 4 * Math.sqrt(262 / f)));   // 低い音ほど長く響く
    const g = envGain(t, dur, 1, { attack: 0.001, release: 0.2, to });
    for (let n = 1; n <= 8; n++) {
      const fn = n * f * Math.sqrt(1 + B * n * n);
      if (fn > 16000) break;
      const amp = (vol * 0.5) / n ** 1.1;
      const strings = n <= 2 ? [0, 1.5] : [0];      // 低い倍音は 2 本の弦を少しずらして、うなりを出す
      for (const cents of strings) {
        const o = ac.createOscillator();
        o.frequency.value = fn;
        o.detune.value = cents;
        const pg = ac.createGain();
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(amp / strings.length, t + 0.002);
        pg.gain.setTargetAtTime(0, t + 0.002, life / n ** 0.6 / 4);
        o.connect(pg).connect(g);
        o.start(t);
        o.stop(t + dur + 0.8);
      }
    }
    noise(t, 0.03, { vol: vol * 0.25, filter: "bandpass", hz: Math.min(f * 6, 8000), q: 1, to });
  }

  /**
   * ストリングス: 少しずつずらした 3 本のノコギリ波を、こもらせてゆっくり立ち上げる。
   * detunes を 1 本にすると独奏。cutoff: 周波数の何倍まで通すか / body: 胴の共鳴 [周波数, 強さ（dB）]
   */
  function strings(t, dur, f, { vol = 0.1, to = out, detunes = [-8, 0, 8], attack = 0.15, cutoff = 5, vibDepth = 12, vibDelay = 0.3, body = [] } = {}) {
    let dest = envGain(t, dur, vol * 0.45, { attack, release: 0.35, to });
    for (const [hz, db] of body) dest = resonance(hz, db, 1.5, dest);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(f * cutoff, 8000);
    lp.Q.value = 0.7;
    lp.connect(dest);
    for (const cents of detunes) {
      const o = ac.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = cents;
      vibrato(o.detune, t, dur, vibDepth, { rate: 5.5, delay: vibDelay });
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.5);
    }
  }

  /**
   * フルート: 柔らかい音 + 息の音 + ビブラート。
   * breath: 息の音の量 / cutoff: 周波数の何倍まで通すか / scoop: この比の高さからしゃくり上げる / chiff: 吹き始めの「プッ」
   */
  function flute(t, dur, f, { vol = 0.1, to = out, wave = "triangle", attack = 0.07, breath = 0.12, cutoff = 2.5, vibDepth = 0.008, vibRate = 5, scoop, chiff } = {}) {
    const g = envGain(t, dur, vol, { attack, release: 0.1, to });
    const o = ac.createOscillator();
    o.type = wave;
    if (scoop) {
      o.frequency.setValueAtTime(f * scoop, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    } else {
      o.frequency.value = f;
    }
    vibrato(o.frequency, t, dur, f * vibDepth, { rate: vibRate, delay: 0.25 });
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(f * cutoff, 16000);
    o.connect(lp).connect(g);
    o.start(t);
    o.stop(t + dur + 0.2);
    // 息: ノイズを音の高さあたりだけ通す
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(f * 2, 9000);
    bp.Q.value = 1.5;
    const ng = ac.createGain();
    ng.gain.value = breath;
    s.connect(bp).connect(ng).connect(g);
    s.start(t, Math.random());
    s.stop(t + dur + 0.2);
    if (chiff) noise(t, 0.04, { vol: vol * 0.5, filter: "bandpass", hz: Math.min(f * 4, 9000), q: 2, to });
  }

  /**
   * ブラス: ノコギリ波を、吹いた瞬間だけ明るく開くフィルターに通す。
   * peak: 吹いた瞬間の明るさ / open: 吹き続けているときの明るさ（どちらも周波数の何倍まで通すか）/ scoop: しゃくり始めの高さの比
   */
  function brass(t, dur, f, { vol = 0.1, to = out, peak = 7, open = 4, attack = 0.03, scoop = 0.97 } = {}) {
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(f, t);
    lp.frequency.linearRampToValueAtTime(Math.min(f * peak, 12000), t + 0.05);
    lp.frequency.setTargetAtTime(Math.min(f * open, 9000), t + 0.05, 0.08);
    lp.connect(envGain(t, dur, vol * 0.7, { attack, release: 0.08, to }));
    const o = ac.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * scoop, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);   // 少ししゃくって入る
    if (dur > 0.4) vibrato(o.frequency, t, dur, f * 0.01, { rate: 5.5, delay: 0.35 });
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  /** オルガン: ドローバー（足す倍音の量を決めるつまみ）の組み合わせ + 鍵盤のカチッという音 */
  function organ(t, dur, f, { vol = 0.1, to = out } = {}) {
    const g = envGain(t, dur, vol, { attack: 0.008, release: 0.05, to });
    const bars = [[0.5, 0.6], [1, 1], [2, 0.7], [3, 0.5], [4, 0.4], [6, 0.25], [8, 0.2]];
    for (const [ratio, amp] of bars) {
      if (f * ratio > 16000) continue;
      const o = ac.createOscillator();
      o.frequency.value = f * ratio;
      const pg = ac.createGain();
      pg.gain.value = amp / 3.65;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    noise(t, 0.006, { vol: vol * 0.3, hz: 2000, to });
  }

  /** シンセベース: ノコギリ波 + 矩形波を、共振の強いフィルターで「ビュン」と閉じる */
  function synthBass(t, dur, f, { vol = 0.1, to = out } = {}) {
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 8;
    lp.frequency.setValueAtTime(Math.min(f * 12, 8000), t);
    lp.frequency.setTargetAtTime(f * 2, t, 0.05);
    lp.connect(envGain(t, dur, vol * 0.8, { attack: 0.003, release: 0.04, to }));
    for (const type of ["sawtooth", "square"]) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  /** hz のあたりだけ db 持ち上げるフィルター（胴や管の共鳴）。dest につないで、入口を返す */
  function resonance(hz, db, q, dest) {
    const pk = ac.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = hz;
    pk.gain.value = db;
    pk.Q.value = q;
    pk.connect(dest);
    return pk;
  }

  /**
   * リード楽器: パルス波などをこもらせて、管の共鳴（formants: [周波数, Q, 強さ（dB）]）を足す。
   * detunes: 少しずらして重ねる（アコーディオンのうなり）/ highpass: 周波数の何倍より下を削るか（オーボエの細さ）
   */
  function reed(t, dur, f, { vol = 0.1, to = out, wave = "square", detunes = [0], cutoff = 6, formants = [], highpass, attack = 0.03, scoop, vibDepth = 0 } = {}) {
    let dest = envGain(t, dur, vol * 0.5, { attack, release: 0.06, to });
    for (const [hz, q, db] of formants) dest = resonance(hz, db, q, dest);
    if (highpass) {
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = f * highpass * 0.5;
      hp.connect(dest);
      dest = hp;
    }
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(f * cutoff, 12000);
    lp.Q.value = 0.8;
    lp.connect(dest);
    for (const cents of detunes) {
      const o = ac.createOscillator();
      if (waves[wave]) o.setPeriodicWave(waves[wave]); else o.type = wave;
      o.detune.value = cents;
      if (scoop) {
        o.frequency.setValueAtTime(f * scoop, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      } else {
        o.frequency.value = f;
      }
      if (vibDepth) vibrato(o.frequency, t, dur, f * vibDepth, { rate: 5.2, delay: 0.3 });
      const g = ac.createGain();
      g.gain.value = 1 / detunes.length;
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.2);
    }
  }

  /**
   * 皮の太鼓: 叩いた瞬間に少し高く（bend 倍）、すぐ本来の音程に落ちるサイン波 + 倍音 + 皮を打つ音。
   * 叩いたら止めずに life 秒かけて消える（dur は使わない）。overtones: [周波数の比, 強さ]
   */
  function drum(t, dur, f, { vol = 0.1, to = out, bend = 1.2, life = 0.4, overtones = [], hit } = {}) {
    for (const [ratio, amp] of [[1, 1], ...overtones]) {
      const l = life / (1 + (ratio - 1) * 1.5);   // 高い倍音ほど早く消える
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(f * ratio * bend, t);
      o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.04);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + l);
      o.connect(g).connect(to);
      o.start(t);
      o.stop(t + l + 0.01);
    }
    if (hit) noise(t, hit.dur, { vol: vol * hit.vol, filter: hit.filter ?? "bandpass", hz: hit.hz, q: 1, to });
  }

  /**
   * 声: ノコギリ波（声帯）を、母音ごとの共鳴（フォルマント）だけ通すフィルターに通す。
   * vowel は VOWELS のキー。detunes を何本かにすると合唱
   */
  function voice(t, dur, f, { vol = 0.1, to = out, vowel = "a", detunes = [0], attack = 0.08, vibDepth = 0.01 } = {}) {
    const g = envGain(t, dur, vol, { attack, release: 0.15, to });
    const src = ac.createGain();
    src.gain.value = 1 / Math.sqrt(detunes.length);
    for (const [hz, bw, amp] of VOWELS[vowel]) {
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz;
      bp.Q.value = hz / bw;
      const fg = ac.createGain();
      fg.gain.value = amp;
      src.connect(bp).connect(fg).connect(g);
    }
    detunes.forEach((cents, i) => {
      const o = ac.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = cents;
      vibrato(o.frequency, t, dur, f * vibDepth, { rate: 5.3 + i * 0.4, delay: 0.2 });   // 1 人ずつ揺れ方を変える
      o.connect(src);
      o.start(t);
      o.stop(t + dur + 0.3);
    });
  }

  const KINDS = { osc, fm, pluck, modal, piano, strings, flute, brass, organ, synthBass, reed, drum, voice };

  /** INSTRUMENTS の楽器 name で 1 音鳴らす。INSTRUMENTS に書いた設定（group・label・kind・gain 以外）は、そのまま音源に渡る */
  function play(name, t, dur, f, opts = {}) {
    const inst = INSTRUMENTS[name];
    if (!inst) throw new Error(`知らない楽器: ${name}`);
    const { group, label, kind, gain = 1, ...params } = inst;
    if (kind === "osc") params.wave = name;
    return KINDS[kind](t, dur, f, { ...params, ...opts, vol: (opts.vol ?? 0.1) * gain });
  }

  // ---------------------------------------------------------------- ノイズとドラム

  /** ノイズ。filter は "highpass" / "bandpass" / "lowpass" */
  function noise(t, dur, { vol = 0.1, filter = "highpass", hz = 1000, q = 1, to = out } = {}) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = filter;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(to);
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur + 0.01);
  }

  /** 金属っぽい音（ハイハット・シンバル用） */
  function metal(t, dur, vol, hp = 7000) {
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g).connect(out);
    for (const r of METAL_RATIOS) {
      const o = ac.createOscillator();
      o.type = "square";
      o.frequency.value = 40 * r;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.01);
    }
  }

  /** 音程が下がっていく太鼓（キック・タム） */
  function drumTone(t, from, to, sweep, life, vol, type = "sine") {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + sweep);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + life);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + life + 0.01);
  }

  // 8bit のドラム（hustower と同じ音）
  const kick = (t, vol = 0.7) => drumTone(t, 180, 40, 0.12, 0.16, vol, "triangle");
  function snare(t, vol = 0.22) {
    noise(t, 0.12, { vol, hz: 1200 });
    osc(t, 0.05, 220, { wave: "triangle", vol: vol * 0.8, slideFrom: 330 });
  }
  const hat = (t, open, vol = open ? 0.07 : 0.04) => noise(t, open ? 0.06 : 0.03, { vol, hz: 7000 });
  const crash = t => noise(t, 1.1, { vol: 0.2, hz: 3500 });
  const clapBursts = (t, vol, hz, q) => { for (const d of [0, 0.01, 0.022]) noise(t + d, 0.09, { vol, filter: "bandpass", hz, q }); };

  /**
   * ドラムキット。どのキットも同じ形: kick(t, vol) / snare(t, vol) / hat(t, open, vol) / crash(t)
   * / clap(t, vol) / shaker(t, vol) / tom(t, 周波数, vol)
   */
  const kits = {
    "8bit": {
      kick, snare, hat, crash,
      clap: (t, vol = 0.09) => clapBursts(t, vol, 1500, 1.5),
      shaker: (t, vol = 0.05) => noise(t, 0.05, { vol, filter: "bandpass", hz: 6000, q: 2 }),
      tom: (t, f, vol = 0.25) => osc(t, 0.15, f, { wave: "triangle", vol, slideFrom: f * 1.5, slideTime: 0.1 }),
    },
    acoustic: {
      kick(t, vol = 0.7) {
        drumTone(t, 110, 48, 0.09, 0.35, vol * 1.1);
        noise(t, 0.012, { vol: vol * 0.25, hz: 2500 });   // ビーターが当たる音
      },
      snare(t, vol = 0.22) {
        drumTone(t, 190, 175, 0.05, 0.08, vol * 0.7, "triangle");
        drumTone(t, 330, 320, 0.05, 0.05, vol * 0.4, "triangle");
        noise(t, 0.22, { vol: vol * 1.1, filter: "bandpass", hz: 3500, q: 0.6 });   // スナッピー（響き線）
      },
      hat(t, open, vol = open ? 0.06 : 0.035) {
        metal(t, open ? 0.3 : 0.05, vol * 0.5, 7000);
        noise(t, open ? 0.25 : 0.04, { vol: vol * 0.6, hz: 8000 });
      },
      crash(t) {
        noise(t, 2, { vol: 0.16, hz: 4000 });
        metal(t, 1.5, 0.06, 5000);
      },
      clap: (t, vol = 0.09) => { clapBursts(t, vol, 1200, 1); noise(t + 0.03, 0.15, { vol: vol * 0.6, filter: "bandpass", hz: 1200 }); },
      shaker: (t, vol = 0.05) => noise(t, 0.06, { vol: vol * 0.8, filter: "bandpass", hz: 7000, q: 1.2 }),
      tom(t, f, vol = 0.3) {
        drumTone(t, f * 1.4, f, 0.1, 0.35, vol);
        noise(t, 0.03, { vol: vol * 0.2, filter: "bandpass", hz: 2000 });
      },
    },
    electro: {
      kick: (t, vol = 0.7) => drumTone(t, 160, 45, 0.05, 0.6, vol * 1.1),   // 長く伸びる「ドゥーン」
      snare(t, vol = 0.22) {
        drumTone(t, 220, 180, 0.03, 0.1, vol * 0.8, "triangle");
        noise(t, 0.18, { vol, hz: 1500 });
      },
      hat: (t, open, vol = open ? 0.06 : 0.04) => metal(t, open ? 0.25 : 0.04, vol, 7000),
      crash: t => { metal(t, 1.2, 0.08, 4000); noise(t, 1.2, { vol: 0.1, hz: 5000 }); },
      clap: (t, vol = 0.09) => { clapBursts(t, vol, 1000, 2); noise(t + 0.03, 0.25, { vol: vol * 0.5, filter: "bandpass", hz: 1000, q: 2 }); },
      shaker: (t, vol = 0.05) => noise(t, 0.03, { vol, hz: 8000 }),
      tom: (t, f, vol = 0.3) => drumTone(t, f * 2, f, 0.08, 0.3, vol),
    },
  };

  /** KITS のキット name を返す */
  const kit = name => kits[name] || kits["8bit"];

  /** 上昇ノイズ（dur 秒かけて高く・大きく） */
  function riser(t, dur) {
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
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.01);
  }

  /**
   * エコー（ディレイ）。返り値の input に音をつなぐと、原音 + やまびこが out に出る。
   * time は秒。テンポに合わせるなら setTime() で変える。
   */
  function echo({ time = 0.375, feedback = 0.3, wet = 0.3 } = {}) {
    const input = ac.createGain();
    const delay = ac.createDelay(2);
    const fb = ac.createGain();
    const wetGain = ac.createGain();
    delay.delayTime.value = time;
    fb.gain.value = feedback;
    wetGain.gain.value = wet;
    input.connect(out);
    input.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wetGain).connect(out);
    return {
      input,
      setTime: s => delay.delayTime.setTargetAtTime(s, ac.currentTime, 0.05),
      setWet: v => wetGain.gain.setTargetAtTime(v, ac.currentTime, 0.05),
    };
  }

  /**
   * 残響（リバーブ）。返り値の input に音を送ると、output から響きだけが出る。
   * 響きは、左右で別々のノイズが seconds 秒かけて消えていく形を作って畳み込む（録音した響きは使わない）。
   * 時間がたつほど高い音を削って、遠くの壁から返ってくるような暗い響きにする
   */
  function reverb({ seconds = 2.4, preDelay = 0.025, damping = 0.35 } = {}) {
    const rate = ac.sampleRate, len = Math.floor(rate * seconds);
    const ir = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const a = 1 - damping * x;                    // だんだん高い音を削る（1 次のローパスの係数）
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.pow(1 - x, 3);
      }
    }
    const input = ac.createDelay(1);
    input.delayTime.value = preDelay;                   // 直接音のあと、少し遅れて響き始める
    const conv = ac.createConvolver();
    conv.buffer = ir;
    const output = ac.createGain();
    input.connect(conv).connect(output);
    return { input, output };
  }

  return { ac, out, play, osc, fm, noise, kit, kick, snare, hat, crash, riser, echo, reverb };
}
