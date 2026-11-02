// 音楽理論の純粋関数。DOM にも Web Audio にも触らない。
//
// 調:   { tonic: 0〜11（C=0）, mode: "major" | "minor" }
// コード（曲データに保存する形。調に依存しない）:
//   { kind: "scale", deg: 1〜7, size: 3|4, harmonic: boolean }
//       その調の音階の deg 度の上の和音。種類は調から決まる。
//       harmonic は短調のときだけ効き、V と vii° を和声短音階の形にする。
//   { kind: "sec", target: 1〜7, size: 3|4 }   セカンダリードミナント（target 度の V）
//   { kind: "abs", semi: 0〜11, letter: 0〜6, quality }
//       主音から semi 半音上の、種類が固定の和音（借用和音など）。letter は音名がいくつ進むか。
// どの形にも任意で inversion: 1〜3 を付けられる（転回形。構成音の何番目を低音にするか。G/B なら 1）。
//
// ディグリーの表記は長短どちらも同主長調を基準に数える（短調は i, ii°, ♭III, iv, v, ♭VI, ♭VII）。

export const A4_MIDI = 69;
export const A4_HZ = 440;
export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const MAJOR = SCALES.major;
const LETTERS = "CDEFGAB";
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

// 12 種類の主音の綴り（少ない臨時記号で書ける方）
const TONIC_LETTER = {
  major: [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]],
  minor: [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]],
};

// [根音からの半音, 音名がいくつ進むか]
export const QUALITIES = {
  maj: { tones: [[0, 0], [4, 2], [7, 4]], name: "", family: "maj" },
  min: { tones: [[0, 0], [3, 2], [7, 4]], name: "m", family: "min" },
  dim: { tones: [[0, 0], [3, 2], [6, 4]], name: "dim", family: "dim" },
  aug: { tones: [[0, 0], [4, 2], [8, 4]], name: "aug", family: "maj" },
  sus4: { tones: [[0, 0], [5, 3], [7, 4]], name: "sus4", family: "maj" },
  6: { tones: [[0, 0], [4, 2], [7, 4], [9, 5]], name: "6", family: "maj" },
  m6: { tones: [[0, 0], [3, 2], [7, 4], [9, 5]], name: "m6", family: "min" },
  7: { tones: [[0, 0], [4, 2], [7, 4], [10, 6]], name: "7", family: "maj" },
  maj7: { tones: [[0, 0], [4, 2], [7, 4], [11, 6]], name: "M7", family: "maj" },
  m7: { tones: [[0, 0], [3, 2], [7, 4], [10, 6]], name: "m7", family: "min" },
  add9: { tones: [[0, 0], [4, 2], [7, 4], [14, 1]], name: "add9", family: "maj" },
  "7b9": { tones: [[0, 0], [4, 2], [7, 4], [10, 6], [13, 1]], name: "7(♭9)", family: "maj" },
  mM7: { tones: [[0, 0], [3, 2], [7, 4], [11, 6]], name: "mM7", family: "min" },
  m7b5: { tones: [[0, 0], [3, 2], [6, 4], [10, 6]], name: "m7(♭5)", family: "dim" },
  dim7: { tones: [[0, 0], [3, 2], [6, 4], [9, 6]], name: "dim7", family: "dim" },
};

// ディグリー表記の種類の部分
const UPPER_SUFFIX = { maj: "", 7: "7", maj7: "M7", 6: "6", sus4: "sus4", aug: "+", add9: "add9", "7b9": "7(♭9)" };
const LOWER_SUFFIX = { min: "", m7: "7", mM7: "M7", m6: "6", dim: "°", dim7: "°7", m7b5: "ø7" };
const INVERSION_FIGURE = { 1: "⁶", 2: "⁶₄", 3: "⁴₂" };

export const mod12 = n => ((n % 12) + 12) % 12;

export function midiToHz(midi) {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / 12);
}

/** 音名 letter（0=C … 6=B。7 以上は回る）で、高さ pc の音を綴る */
export function spell(letter, pc) {
  const l = ((letter % 7) + 7) % 7;
  let acc = mod12(pc - MAJOR[l]);
  if (acc > 6) acc -= 12;
  const mark = acc > 0 ? "♯".repeat(acc) : "♭".repeat(-acc);
  return LETTERS[l] + mark;
}

const tonicLetter = key => TONIC_LETTER[key.mode][key.tonic][0];

export const tonicName = key => spell(tonicLetter(key), key.tonic);

export function keyName(key) {
  return `${tonicName(key)} ${key.mode === "major" ? "メジャー" : "マイナー"}`;
}

/** 調の音階の音（pc の配列。主音から順に） */
export const scalePcs = key => SCALES[key.mode].map(s => mod12(key.tonic + s));

/** 音階の音名（主音から順に） */
export function scaleNames(key) {
  const l = tonicLetter(key);
  return SCALES[key.mode].map((s, i) => spell(l + i, key.tonic + s));
}

export const isInScale = (midi, key) => scalePcs(key).includes(mod12(midi));

/** 音階の deg 度（1〜7）の上に 3 度ずつ積んだ和音の種類 */
export function diatonicQuality(mode, deg, size = 3) {
  const s = SCALES[mode];
  const at = i => {
    const n = deg - 1 + i;
    return s[n % 7] + 12 * Math.floor(n / 7);
  };
  const third = at(2) - at(0);
  const fifth = at(4) - at(0);
  const triad = third === 4 ? (fifth === 7 ? "maj" : "aug") : fifth === 7 ? "min" : "dim";
  if (size === 3) return triad;
  const seventh = at(6) - at(0);
  if (triad === "maj") return seventh === 11 ? "maj7" : "7";
  if (triad === "min") return seventh === 11 ? "mM7" : "m7";
  if (triad === "dim") return seventh === 10 ? "m7b5" : "dim7";
  return "aug";
}

/** 保存形のコードを { semi, letter, quality } にする（主音からの相対位置） */
export function resolveChord(chord, mode) {
  if (chord.kind === "abs") return { semi: mod12(chord.semi), letter: chord.letter, quality: chord.quality };
  if (chord.kind === "sec") {
    const s = SCALES[mode][chord.target - 1];
    return { semi: mod12(s + 7), letter: (chord.target - 1 + 4) % 7, quality: chord.size === 4 ? "7" : "maj" };
  }
  const size = chord.size === 4 ? 4 : 3;
  const i = chord.deg - 1;
  if (mode === "minor" && chord.harmonic) {
    if (chord.deg === 5) return { semi: 7, letter: 4, quality: size === 4 ? "7" : "maj" };
    if (chord.deg === 7) return { semi: 11, letter: 6, quality: size === 4 ? "dim7" : "dim" };
  }
  return { semi: SCALES[mode][i], letter: i, quality: diatonicQuality(mode, chord.deg, size) };
}

/** 主音からの位置と種類 → ディグリー表記（例: IM7, ii7, vii°, ♭VI, iiø7） */
export function romanOf(semi, letter, quality) {
  const q = QUALITIES[quality];
  let acc = mod12(semi - MAJOR[letter]);
  if (acc > 6) acc -= 12;
  const mark = acc > 0 ? "♯".repeat(acc) : "♭".repeat(-acc);
  const upper = q.family === "maj";
  const numeral = upper ? NUMERALS[letter] : NUMERALS[letter].toLowerCase();
  return mark + numeral + (upper ? UPPER_SUFFIX : LOWER_SUFFIX)[quality];
}

/** セカンダリードミナントの行き先の表記（ii, iv, ♭VI など。V は長短どちらも V と書く） */
function targetRoman(target, mode) {
  if (target === 5) return "V";
  return romanOf(SCALES[mode][target - 1], target - 1, diatonicQuality(mode, target, 3));
}

/** 和音の機能（T / S / D）。主音からの半音と三和音の種類で決まる */
export function functionOf(chord, mode) {
  if (chord.kind === "sec") return "D";
  const { semi, quality } = resolveChord(chord, mode);
  const family = QUALITIES[quality].family;
  const key = `${semi}${family}`;
  const shared = {
    "0maj": "T", "0min": "T", "3maj": "T", "4min": "T", "9min": "T",
    "2min": "S", "2dim": "S", "5maj": "S", "5min": "S", "8maj": "S", "1maj": "S",
    "7maj": "D", "7min": "D", "11dim": "D",
  };
  if (key === "10maj") return mode === "minor" ? "D" : "S";
  if (shared[key]) return shared[key];
  return family === "dim" || quality === "7" || quality === "7b9" ? "D" : "S";
}

/** そのコードの構成音が全部、調の音階に入っているか */
export function isDiatonic(chord, key) {
  const scale = scalePcs(key);
  return realize(chord, key).tones.every(t => scale.includes(t.pc));
}

/**
 * 保存形のコードを、調 key の実際のコードにする。
 * 返り値: { name, roman, func, semi, rootPc, bassPc, quality, family, tones: [{ name, pc, semi }] }
 */
export function realize(chord, key) {
  const { semi, letter, quality } = resolveChord(chord, key.mode);
  const q = QUALITIES[quality];
  const rootPc = mod12(key.tonic + semi);
  const l = tonicLetter(key) + letter;
  const rootRoman = romanOf(semi, letter, quality);
  const roman = chord.kind === "sec"
    ? `${chord.size === 4 ? "V7" : "V"}/${targetRoman(chord.target, key.mode)}`
    : rootRoman;
  const tones = q.tones.map(([s, step]) => ({ name: spell(l + step, rootPc + s), pc: mod12(rootPc + s), semi: s }));
  const bass = tones[chord.inversion];
  return {
    name: spell(l, rootPc) + q.name + (bass ? `/${bass.name}` : ""),
    roman: roman + (bass ? INVERSION_FIGURE[chord.inversion] : ""),
    func: functionOf(chord, key.mode),
    semi,
    rootPc,
    bassPc: bass ? bass.pc : rootPc,
    quality,
    family: q.family,
    tones,
  };
}

/** 主音からの位置と種類から、保存形のコードを決める（できるだけ調に沿った形にする） */
export function normalizeChord(semi, letter, quality, mode) {
  const s = mod12(semi);
  const scale = SCALES[mode];
  const deg = letter + 1;
  if (scale[letter] === s) {
    if (quality === diatonicQuality(mode, deg, 3)) return { kind: "scale", deg, size: 3, harmonic: (deg === 5 || deg === 7) && mode === "major" };
    if (quality === diatonicQuality(mode, deg, 4)) return { kind: "scale", deg, size: 4, harmonic: (deg === 5 || deg === 7) && mode === "major" };
  }
  if (mode === "minor") {
    if (s === 7 && letter === 4 && (quality === "maj" || quality === "7")) return { kind: "scale", deg: 5, size: quality === "7" ? 4 : 3, harmonic: true };
    if (s === 11 && letter === 6 && (quality === "dim" || quality === "dim7")) return { kind: "scale", deg: 7, size: quality === "dim7" ? 4 : 3, harmonic: true };
  }
  if (quality === "7" || (quality === "maj" && !(mode === "minor" && (s === 0 || s === 5)))) {
    const targetLetter = (letter + 3) % 7;   // 根音の完全 5 度下の音名
    if (targetLetter !== 0 && scale[targetLetter] === mod12(s - 7)) {
      return { kind: "sec", target: targetLetter + 1, size: quality === "7" ? 4 : 3 };
    }
  }
  return { kind: "abs", semi: s, letter, quality };
}

const ROMAN_RE = /^([♭♯b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;

/** ディグリー表記の文字列（"IVM7" "vim7" "♭VI" "III7" "iiø7" "vii°"）を読む → { semi, letter, quality } */
export function parseRoman(text) {
  const m = ROMAN_RE.exec(text.trim());
  if (!m) throw new Error(`読めないディグリー: ${text}`);
  const acc = m[1] === "♭" || m[1] === "b" ? -1 : m[1] === "♯" || m[1] === "#" ? 1 : 0;
  const letter = NUMERALS.indexOf(m[2].toUpperCase());
  const upper = m[2] === m[2].toUpperCase();
  const table = upper
    ? { "": "maj", 7: "7", M7: "maj7", 6: "6", sus4: "sus4", "+": "aug" }
    : { "": "min", 7: "m7", m7: "m7", M7: "mM7", mM7: "mM7", 6: "m6", m6: "m6", "°": "dim", "°7": "dim7", "ø7": "m7b5", "ø": "m7b5" };
  const quality = table[m[3]];
  if (quality === undefined) throw new Error(`知らない種類: ${text}`);
  return { semi: mod12(MAJOR[letter] + acc), letter, quality };
}

/** ディグリー表記から、調 mode で使う保存形のコードを作る */
export function chordFromRoman(text, mode) {
  const { semi, letter, quality } = parseRoman(text);
  return normalizeChord(semi, letter, quality, mode);
}

/** 進行の比較用のキー（三和音の骨格だけを見る。V と V7 は同じ扱い） */
export function chordShape(chord, mode) {
  const { semi, quality } = resolveChord(chord, mode);
  return `${semi}:${QUALITIES[quality].family}`;
}

/** MIDI 番号（pc は low 以上で最初の音）。low〜low+11 の範囲に入れる */
export const pcAtOrAbove = (pc, low) => low + mod12(pc - low);

const voicingMovement = (a, b) => a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0);

function upperCandidates(pcs) {
  const sorted = [...pcs];
  const out = [];
  for (let inv = 0; inv < sorted.length; inv++) {
    const order = [...sorted.slice(inv), ...sorted.slice(0, inv)];
    const notes = [];
    let cur = 55;   // G3 以上から積む
    for (const pc of order) {
      const n = pcAtOrAbove(pc, cur);
      notes.push(n);
      cur = n + 1;
    }
    out.push(notes);
  }
  return out;
}

/**
 * コード 1 つの押さえ方。低音（ふつうは根音）を低い位置に置き、上の声部は前の押さえ方 prevUpper の近くの転回形にする。
 * 返り値: { root, upper, notes }（notes は root + upper の MIDI 番号）
 */
export function voiceChord(realized, prevUpper = null) {
  const root = pcAtOrAbove(realized.bassPc, 43);   // G2〜F♯3
  const pcs = realized.tones.map(t => t.pc);
  const candidates = upperCandidates(pcs);
  let upper = candidates[0];
  if (prevUpper && prevUpper.length === upper.length) {
    let best = Infinity;
    for (const c of candidates) {
      const cost = voicingMovement(c, prevUpper);
      if (cost < best) { best = cost; upper = c; }
    }
  } else if (prevUpper) {
    const center = prevUpper.reduce((s, n) => s + n, 0) / prevUpper.length;
    let best = Infinity;
    for (const c of candidates) {
      const cost = Math.abs(c.reduce((s, n) => s + n, 0) / c.length - center);
      if (cost < best) { best = cost; upper = c; }
    }
  }
  return { root, upper, notes: [root, ...upper] };
}

/** 音符 midi を調 from から調 to へ、度数を保って移す */
export function transposeMidi(midi, from, to) {
  const shift = mod12(to.tonic - from.tonic);
  const tonicShift = shift > 6 ? shift - 12 : shift;
  const rel = mod12(midi - from.tonic);
  const fromScale = SCALES[from.mode];
  const toScale = SCALES[to.mode];
  const i = fromScale.indexOf(rel);
  if (i < 0) return midi + tonicShift;   // 音階にない音は、主音からの距離を保つ（短調の導音は長調でも導音）
  return midi + tonicShift + (toScale[i] - rel);
}

/** コードの構成音は移した先のコードの同じ番目の音へ、それ以外は度数を保って移す */
export function transposeInChord(midi, chord, from, to) {
  const moved = transposeMidi(midi, from, to);
  const i = realize(chord, from).tones.findIndex(t => t.pc === mod12(midi));
  if (i < 0) return moved;
  const target = realize(chord, to).tones[i].pc;
  let delta = mod12(target - moved);
  if (delta > 6) delta -= 12;
  return moved + delta;
}
