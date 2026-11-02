// パートの自動生成（ガチャ）。シードとパラメータが同じなら必ず同じ結果になる純粋関数。
// 音符: { t: 開始（16 分音符。セクション頭から）, d: 長さ（16 分音符）, midi | drum, v: 強さ 0〜1 }
import { createRng, mixSeed } from "./rng.js";
import { realize, scalePcs, mod12, pcAtOrAbove } from "./theory.js";
import { chordAtStep, sectionChords, BARS_PER_SECTION, STEPS_PER_BAR } from "./song.js";

export const STYLES = {
  melody: [["lyrical", "なめらか"], ["rhythmic", "リズミカル"], ["syncopated", "シンコペーション"], ["arpeggio", "分散和音"]],
  bass: [["auto", "おまかせ"], ["whole", "根音の全音符"], ["eighth", "根音の 8 分刻み"], ["root5", "根音 – 5 度"], ["approach", "経過音つき"]],
  drums: [["8beat", "8 ビート"], ["16beat", "16 ビート"], ["four", "4 つ打ち"], ["half", "ハーフタイム"], ["bossa", "ボサノバ風"], ["drive", "疾走"]],
  counter: [["sustain", "白玉（長い音）"], ["flow", "ゆるやかに動く"], ["answer", "合いの手"]],
  harmony: [["third", "3 度下"], ["sixth", "6 度下"], ["mix", "3 度と 6 度を混ぜる"]],
};

const MAX_LEAP = 9;      // 跳躍の上限（半音）
const BIG_LEAP = 7;      // これ以上跳んだら、次は反対方向へ戻る

const clampRange = ({ low, high }) => {
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  return hi - lo >= 12 ? { low: lo, high: hi } : { low: lo, high: lo + 12 };
};

function midisOf(pcs, low, high) {
  const out = [];
  for (let n = low; n <= high; n++) if (pcs.includes(mod12(n))) out.push(n);
  return out;
}

const pcsOf = (chord, key) => realize(chord, key).tones.map(t => t.pc);

/** step 位置のコードの情報。音階にない音を含むコードは outside = true */
function chordInfo(section, step, key, scale) {
  const chord = chordAtStep(section, step);
  if (!chord) return null;
  const r = realize(chord, key);
  const pcs = r.tones.map(t => t.pc);
  return { chord, pcs, rootPc: r.rootPc, thirdPc: r.tones[1].pc, outside: pcs.some(p => !scale.includes(p)), tones: r.tones };
}

const lastChordBar = section => {
  const all = sectionChords(section);
  return all.length ? all[all.length - 1].bar : -1;
};

/** 音が鳴っている間に通る強拍（1・3 拍目）の位置 */
function strongStepsIn(t, d) {
  const out = [];
  const bar = Math.floor(t / STEPS_PER_BAR);
  for (const offset of [0, 8]) {
    const s = bar * STEPS_PER_BAR + offset;
    if (t <= s && s < t + d) out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- メロディ

// 1 小節のリズム [開始, 長さ]。密度の段階（低・中・高）ごと
const CELLS = {
  lyrical: [
    [[[0, 16]], [[0, 12], [12, 4]], [[0, 8], [8, 8]]],
    [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 8]], [[0, 8], [8, 4], [12, 4]], [[0, 6], [6, 2], [8, 4], [12, 4]]],
    [[[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 4], [4, 4], [8, 4], [12, 2], [14, 2]], [[0, 2], [2, 2], [4, 4], [8, 4], [12, 4]]],
  ],
  rhythmic: [
    [[[0, 4], [6, 2], [8, 4], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 8]]],
    [[[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 2], [4, 2], [6, 2], [8, 2], [12, 2], [14, 2]]],
    [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]], [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 1], [9, 1], [10, 2], [12, 2], [14, 2]]],
  ],
  syncopated: [
    [[[0, 6], [6, 10]], [[2, 6], [8, 8]]],
    [[[0, 3], [3, 5], [8, 3], [11, 5]], [[0, 4], [6, 4], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 6], [12, 4]]],
    [[[0, 2], [3, 3], [6, 2], [8, 2], [11, 3], [14, 2]], [[0, 3], [3, 2], [6, 2], [8, 3], [11, 2], [14, 2]]],
  ],
  arpeggio: [
    [[[0, 4], [4, 4], [8, 4], [12, 4]], [[0, 8], [8, 4], [12, 4]]],
    [[[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]]],
    [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]]],
  ],
};

const ENDINGS = [
  [[[0, 16]], [[0, 12]]],
  [[[0, 8], [8, 8]], [[0, 4], [4, 4], [8, 8]]],
  [[[0, 4], [4, 4], [8, 8]], [[0, 2], [2, 2], [4, 4], [8, 8]]],
];

const tierOf = (density, rng) => {
  const x = density * 2 + rng.range(-0.45, 0.45);
  return Math.max(0, Math.min(2, Math.round(x)));
};

/** リズムの列に、音階の上の動き（度数の差）を付ける */
function makeContour(count, style, rng) {
  const out = [0];
  let leapBack = 0;
  for (let i = 1; i < count; i++) {
    let step;
    if (leapBack) {
      step = leapBack;
      leapBack = 0;
    } else if (style === "arpeggio") {
      step = rng.pick([2, 2, 2, -2, 3, -2]);
    } else {
      const r = rng.next();
      if (r < 0.38) step = 1;
      else if (r < 0.76) step = -1;
      else if (r < 0.86) step = 0;
      else if (r < 0.95) step = rng.pick([2, -2]);
      else {
        step = rng.pick([3, -3, 4, -4]);
        leapBack = step > 0 ? -1 : 1;
      }
    }
    out.push(out[i - 1] + step);
  }
  return out;
}

/** 度数の位置（小数なし）を MIDI 番号へ。scaleList は音階の音を低い順に並べたもの */
function scaleIndexNear(scaleList, midi) {
  let best = 0;
  scaleList.forEach((n, i) => {
    if (Math.abs(n - midi) < Math.abs(scaleList[best] - midi)) best = i;
  });
  return best;
}

function choosePitch({ desired, prev, prevMove, chordRequired, info, scaleNotes, low, high, rng, preferred }) {
  const chordNotes = midisOf(info.pcs, low, high);
  let candidates = chordRequired || info.outside ? chordNotes : scaleNotes;
  if (candidates.length === 0) candidates = chordNotes.length ? chordNotes : scaleNotes;
  let best = candidates[0];
  let bestScore = Infinity;
  for (const n of candidates) {
    let score = Math.abs(n - desired) + rng.next() * 0.4;
    if (prev !== null) {
      const move = n - prev;
      const size = Math.abs(move);
      if (size > 5) score += (size - 5) * 1.5;
      if (size > MAX_LEAP) score += 100;
      if (size === 0) score += 1.2;
      if (Math.abs(prevMove) >= BIG_LEAP && Math.sign(move) !== -Math.sign(prevMove)) score += 200;
      else if (Math.abs(prevMove) >= 5 && Math.sign(move) === Math.sign(prevMove)) score += 4;
      // 弱拍の和音外の音は、順次進行（経過音・刺繍音）でだけ使う
      if (!info.pcs.includes(mod12(n)) && size > 2) score += 50;
    }
    if (preferred && preferred.includes(mod12(n))) score -= 3;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

function generateMelody({ section, key, params, rng }) {
  const { low, high } = clampRange(params);
  const style = CELLS[params.style] ? params.style : "lyrical";
  const scale = scalePcs(key);
  const scaleNotes = midisOf(scale, low, high);
  const endBar = lastChordBar(section);
  if (endBar < 0 || scaleNotes.length === 0) return [];

  // 最初の 2 小節でモチーフを作る
  const motifCells = [0, 1].map(() => rng.pick(CELLS[style][tierOf(params.density, rng)]));
  const motifContour = motifCells.map(cell => makeContour(cell.length, style, rng));
  const secondShift = motifContour[0][motifContour[0].length - 1] + rng.pick([-1, 0, 1]);
  const center = (low + high) / 2 + rng.range(-3, 3);
  const anchor = scaleIndexNear(scaleNotes, center);
  const endingTier = tierOf(params.density, rng);

  // 2 小節ごとの扱い: モチーフ → 変形 → 反復（またはさらに変形） → 終わりへ
  const seqShift = rng.pick([-2, -1, 1, 2]);
  const unitPlans = [
    { shift: 0, invert: false },
    { shift: seqShift, invert: rng.chance(0.25) },
    { shift: rng.chance(0.6) ? 0 : -seqShift, invert: false },
    { shift: rng.pick([0, 1, -1]), invert: false },
  ];

  const notes = [];
  let prev = null;
  let prevMove = 0;
  for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
    if (bar > endBar) break;
    const isEnd = bar === endBar;
    const unit = unitPlans[Math.floor(bar / 2) % unitPlans.length];
    const half = bar % 2;
    const cell = isEnd ? rng.pick(ENDINGS[endingTier]) : motifCells[half];
    const contour = isEnd ? null : motifContour[half];
    cell.forEach(([start, dur], i) => {
      let t = bar * STEPS_PER_BAR + start;
      let d = dur;
      if (!chordAtStep(section, t)) return;
      const strongs = strongStepsIn(t, d);
      let info = chordInfo(section, t, key, scale);
      // 強拍を通るコードが複数なら、共通の音にする。なければ次の強拍の手前で切る
      if (strongs.length > 0) {
        const infos = strongs.map(s => chordInfo(section, s, key, scale));
        const first = infos[0] || info;
        let pcs = first.pcs;
        for (const x of infos.slice(1)) {
          if (!x) continue;
          const common = pcs.filter(p => x.pcs.includes(p));
          if (common.length) pcs = common;
          else d = Math.max(1, strongs[1] - t);
        }
        info = { ...first, pcs };
      }
      const isLast = isEnd && i === cell.length - 1;
      const chordRequired = strongs.length > 0 || isEnd;
      const contourShift = contour
        ? (unit.invert ? -contour[i] : contour[i]) + (half ? secondShift : 0)
        : 0;
      const idx = Math.max(0, Math.min(scaleNotes.length - 1, anchor + unit.shift + contourShift));
      const desired = isEnd && prev !== null ? prev : scaleNotes[idx];
      const preferred = isLast ? [info.rootPc, info.thirdPc] : null;
      const midi = choosePitch({ desired, prev, prevMove, chordRequired, info, scaleNotes, low, high, rng, preferred });
      if (prev !== null) prevMove = midi - prev;
      prev = midi;
      const v = strongs.length > 0 ? 0.85 : 0.68;
      notes.push({ t, d, midi, v });
    });
  }
  return notes;
}

// ---------------------------------------------------------------- ベース

const BASS_STYLES = ["whole", "eighth", "root5", "approach"];

function nearestInRange(pc, near, low, high) {
  let best = pcAtOrAbove(pc, low);
  for (let n = best; n <= high; n += 12) {
    if (Math.abs(n - near) < Math.abs(best - near)) best = n;
  }
  return best;
}

function generateBass({ section, key, params, rng }) {
  const { low, high } = clampRange(params);
  const chords = sectionChords(section);
  if (chords.length === 0) return [];
  const density = params.density;
  const baseStyle = params.style === "auto" || !BASS_STYLES.includes(params.style) ? rng.pick(BASS_STYLES) : params.style;
  const lastStyle = params.style === "auto" && rng.chance(0.5) ? "approach" : baseStyle;
  const notes = [];
  let root = low + 7;
  const octaveUp = rng.chance(0.3);
  chords.forEach((c, i) => {
    const r = realize(c.chord, key);
    root = nearestInRange(r.bassPc, root, low, high);
    // 「5 度」はコードの第 5 音（減三和音なら減 5 度）。転回形で第 5 音が低音なら根音にする
    const otherPc = r.tones[2].pc === r.bassPc ? r.rootPc : r.tones[2].pc;
    const above = pcAtOrAbove(otherPc, root + 1);
    const fifth = above <= high ? above : above - 12 >= low ? above - 12 : root;
    const t0 = c.bar * STEPS_PER_BAR + c.startBeat * 4;
    const len = c.beats * 4;
    const style = i === chords.length - 1 || c.bar >= BARS_PER_SECTION - 2 ? lastStyle : baseStyle;
    const add = (offset, d, midi, v = 0.8) => notes.push({ t: t0 + offset, d, midi, v });
    if (style === "whole") {
      if (density > 0.66 && len >= 16) {
        add(0, 12, root, 0.88);
        add(12, 4, rng.chance(0.5) ? fifth : root);
      } else {
        add(0, len, root, 0.88);
      }
    } else if (style === "eighth") {
      const step = density < 0.34 ? 4 : 2;
      for (let s = 0; s < len; s += step) {
        const up = octaveUp && density > 0.66 && (s / step) % 2 === 1 && root + 12 <= high;
        add(s, step, up ? root + 12 : root, s % 8 === 0 ? 0.9 : 0.72);
      }
    } else if (style === "root5") {
      const step = density > 0.66 ? 4 : len / 2;
      for (let s = 0, n = 0; s < len; s += step, n++) add(s, step, n % 2 ? fifth : root, n % 2 ? 0.74 : 0.88);
    } else if (len <= 4) {
      add(0, len, root, 0.88);   // 短いコードには経過音を入れる余地がない
    } else {
      // 次の根音へ半音 / 全音で近づく
      const next = chords[i + 1] || chords[0];
      const nextPc = realize(next.chord, key).bassPc;
      const nextRoot = nearestInRange(nextPc, root, low, high);
      const approachLen = density > 0.66 ? 2 : 4;
      const body = len - approachLen;
      if (density > 0.33 && body >= 8) {
        add(0, body / 2, root, 0.88);
        add(body / 2, body / 2, rng.chance(0.5) ? fifth : root, 0.74);
      } else {
        add(0, body, root, 0.88);
      }
      const delta = rng.pick([1, 2]) * rng.pick([-1, 1]);
      let approach = nextRoot + delta;
      if (approach < low || approach > high) approach = nextRoot - delta;
      add(body, approachLen, approach, 0.7);
    }
  });
  return notes;
}

// ---------------------------------------------------------------- ドラム

const DRUM_PATTERNS = {
  "8beat": [
    { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
    { kick: "x.....x.x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
    { kick: "x.......x..x....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
  ],
  "16beat": [
    { kick: "x..x....x.x.....", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx" },
    { kick: "x.....x...x..x..", snare: "....x.......x...", hat: "xxxxxxxxxxxxxxxx" },
  ],
  four: [
    { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x." },
    { kick: "x...x...x...x...", snare: "....x.......x..x", hat: "..x...x...x...x." },
  ],
  half: [
    { kick: "x.........x.....", snare: "........x.......", hat: "x.x.x.x.x.x.x.x." },
    { kick: "x.....x...x.....", snare: "........x.......", hat: "x.x.x.x.x.x.x.x." },
  ],
  bossa: [
    { kick: "x..x..x.x..x..x.", snare: "x..x..x...x..x..", hat: "x.x.x.x.x.x.x.x." },
  ],
  drive: [
    { kick: "x.x.x.x.x.x.x.x.", snare: "....x..x....x..x", hat: "x.x.x.x.x.x.x.x." },
    { kick: "x...x.x.x...x.x.", snare: "....x.......x.x.", hat: "x.x.x.x.x.x.x.x." },
  ],
};

const FILLS = [
  [[8, "snare"], [10, "snare"], [12, "tomHigh"], [13, "tomHigh"], [14, "tomLow"], [15, "tomLow"]],
  [[12, "snare"], [13, "snare"], [14, "snare"], [15, "snare"]],
  [[8, "tomHigh"], [10, "tomHigh"], [12, "tomLow"], [14, "kick"], [15, "snare"]],
  [[10, "snare"], [12, "snare"], [13, "tomHigh"], [14, "tomLow"], [15, "tomLow"]],
];
const FILL_CHANCE = 0.6;

function generateDrums({ params, rng }) {
  const patterns = DRUM_PATTERNS[params.style] || DRUM_PATTERNS["8beat"];
  const main = rng.pick(patterns);
  const alt = rng.pick(patterns);
  const density = params.density;
  const useFill = rng.chance(FILL_CHANCE);
  const fill = rng.pick(FILLS);
  const notes = [];
  const add = (t, drum, v) => notes.push({ t, d: 1, drum, v });
  for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
    const p = bar % 4 === 3 ? alt : main;
    const isFillBar = useFill && bar === BARS_PER_SECTION - 1;
    const fillStart = isFillBar ? fill[0][0] : STEPS_PER_BAR;
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      if (s >= fillStart) break;
      const t = bar * STEPS_PER_BAR + s;
      if (p.kick[s] === "x") add(t, "kick", s % 8 === 0 ? 0.95 : 0.8);
      if (p.snare[s] === "x") add(t, "snare", params.style === "bossa" ? 0.32 : 0.85);
      if (p.hat[s] === "x") {
        // 密度が低いときはハイハットを間引く
        const keep = density >= 0.34 || s % 4 === 0;
        if (keep) add(t, "hat", s % 4 === 0 ? 0.7 : 0.45);
      }
      // 密度が高いときは、弱いスネア（ゴーストノート）を足す
      if (density > 0.7 && p.snare[s] !== "x" && p.kick[s] !== "x" && s % 2 === 1 && rng.chance(0.18)) add(t, "snare", 0.22);
    }
    if (isFillBar) for (const [s, drum] of fill) add(bar * STEPS_PER_BAR + s, drum, 0.82);
  }
  if (density >= 0.5 && rng.chance(0.5)) add(0, "crash", 0.7);
  notes.sort((a, b) => a.t - b.t);
  return notes;
}

// ---------------------------------------------------------------- 対旋律

function melodyAt(melody, t) {
  let found = null;
  for (const n of melody) {
    if (n.t <= t && t < n.t + n.d) return n.midi;
    if (n.t <= t) found = n.midi;
  }
  return found;
}

/** 1 小節の中の [開始, 長さ] の列。メロディより長い音価を選ぶ */
function counterSegments(bar, style, density, melody, rng) {
  if (style === "flow") {
    if (density > 0.66) return rng.pick([[[0, 8], [8, 4], [12, 4]], [[0, 4], [4, 4], [8, 8]]]);
    return density > 0.33 ? [[0, 8], [8, 8]] : rng.pick([[[0, 16]], [[0, 8], [8, 8]]]);
  }
  if (style === "answer") {
    // メロディが長く伸びている所・休んでいる所に音を入れる
    const start = bar * STEPS_PER_BAR;
    const onsets = melody.filter(n => n.t >= start && n.t < start + STEPS_PER_BAR).map(n => n.t - start);
    const edges = [...onsets, STEPS_PER_BAR];
    let bestStart = 0;
    let bestLen = 0;
    let cursor = 0;
    for (const e of edges) {
      if (e - cursor > bestLen) {
        bestLen = e - cursor;
        bestStart = cursor;
      }
      cursor = e;
    }
    if (bestLen >= 8 && onsets.includes(bestStart)) return [[bestStart + 4, bestLen - 4]];
    if (bestLen >= 4) return [[bestStart, bestLen]];
    return [[0, 16]];
  }
  return density > 0.6 ? [[0, 8], [8, 8]] : [[0, 16]];
}

function generateCounter({ section, key, params, melody, rng }) {
  const { low, high } = clampRange(params);
  const scale = scalePcs(key);
  const notes = [];
  let prev = null;
  let prevMelody = null;
  for (let bar = 0; bar < BARS_PER_SECTION; bar++) {
    for (const [start, dur] of counterSegments(bar, params.style, params.density, melody, rng)) {
      const t = bar * STEPS_PER_BAR + start;
      const info = chordInfo(section, t, key, scale);
      if (!info) continue;
      const chordNotes = midisOf(info.pcs, low, high);
      if (chordNotes.length === 0) continue;
      const m = melodyAt(melody, t);
      const melodyDir = m !== null && prevMelody !== null ? Math.sign(m - prevMelody) : 0;
      const prevCenter = prev ?? (low + high) / 2;
      let best = chordNotes[0];
      let bestScore = Infinity;
      for (const n of chordNotes) {
        const move = n - prevCenter;
        let score = Math.abs(move) * 0.6 + rng.next() * 0.5;
        if (melodyDir !== 0) {
          if (Math.sign(move) === melodyDir) score += 6;
          else if (move === 0) score += 2;
        }
        if (m !== null) {
          if (mod12(n - m) === 0) score += 4;   // メロディと同じ音を避ける
          if (n >= m) score += 4;               // メロディより下にいる
        }
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      notes.push({ t, d: dur, midi: best, v: 0.7 });
      prev = best;
      if (m !== null) prevMelody = m;
    }
  }
  return notes;
}

// ---------------------------------------------------------------- ハモリ

function harmonyPitch(midi, stepsDown, scaleList, info) {
  const idx = scaleList.indexOf(midi);
  let out;
  if (idx >= 0 && idx >= stepsDown) {
    out = scaleList[idx - stepsDown];
  } else {
    // 音階の外の音（臨時記号のコードの構成音）は、コードの構成音の中から下の音を探す
    const min = stepsDown === 2 ? 3 : 8;
    out = null;
    for (let n = midi - min; n >= midi - min - 6; n--) {
      if (info?.pcs.includes(mod12(n))) {
        out = n;
        break;
      }
    }
    if (out === null) out = midi - (stepsDown === 2 ? 4 : 9);
  }
  return out;
}

function generateHarmony({ section, key, params, melody, rng }) {
  const { low, high } = clampRange(params);
  const scale = scalePcs(key);
  const scaleList = midisOf(scale, 0, 127);
  const notes = [];
  for (const n of melody) {
    const strong = strongStepsIn(n.t, n.d).length > 0;
    if (params.density < 1 && !strong && !rng.chance(params.density)) continue;
    const info = chordInfo(section, n.t, key, scale);
    let steps = params.style === "sixth" ? 5 : 2;
    let midi = harmonyPitch(n.midi, steps, scaleList, info);
    if (params.style === "mix" && info && strong && !info.pcs.includes(mod12(midi))) {
      steps = 5;
      midi = harmonyPitch(n.midi, steps, scaleList, info);
    }
    // 臨時記号のコードの上では、音階の音が和音とぶつかるならコードの構成音にずらす
    if (info?.outside && !info.pcs.includes(mod12(midi))) {
      for (let delta = 1; delta <= 2; delta++) {
        if (info.pcs.includes(mod12(midi - delta))) {
          midi -= delta;
          break;
        }
        if (info.pcs.includes(mod12(midi + delta))) {
          midi += delta;
          break;
        }
      }
    }
    if (midi < low || midi > high) continue;
    notes.push({ t: n.t, d: n.d, midi, v: Math.max(0.4, n.v - 0.15) });
  }
  return notes;
}

// ---------------------------------------------------------------- 入口

const GENERATORS = {
  melody: generateMelody,
  bass: generateBass,
  drums: generateDrums,
  counter: generateCounter,
  harmony: generateHarmony,
};

/**
 * パートを生成する。melody は対旋律とハモリの参照先（メロディの音符）。
 * シード・パラメータ・コード進行・調（と melody）が同じなら、必ず同じ音符を返す。
 */
export function generatePart(name, { section, key, seed, params, melody = [] }) {
  const rng = createRng(mixSeed(seed, name));
  return GENERATORS[name]({ section, key, params, melody, rng });
}
