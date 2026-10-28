// ディグリー（ローマ数字）で書いたコードを、キーに合わせた実際のコードにする。
// 音名の綴り（A♭ か G♯ か）も、音階どおりに出す。
//
// 書き方: [♭ / ♯] + ローマ数字 + 種類
//   大文字は長三和音（I, IV, V…）、小文字は短三和音（ii, vi…）
//   大文字の後ろ: 7（属七）、△7（長七）、6、sus4、+（増）
//   小文字の後ろ: 7（短七）、△7（短三和音 + 長七 = mM7）、6、°（減）、°7（減七）、ø7（ハーフディミニッシュ = m7♭5）
// 短調は自然短音階を基準に数える（イ短調の III は C、VII は G。大文字の V は和声的短音階の E）。

export const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const LETTERS = "CDEFGAB";
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

// 構成音: [根音からの半音, 音名が根音からいくつ進むか（3 度なら 2）]
const QUAL = {
  "": [[0, 0], [4, 2], [7, 4]],
  m: [[0, 0], [3, 2], [7, 4]],
  dim: [[0, 0], [3, 2], [6, 4]],
  aug: [[0, 0], [4, 2], [8, 4]],
  sus4: [[0, 0], [5, 3], [7, 4]],
  "6": [[0, 0], [4, 2], [7, 4], [9, 5]],
  m6: [[0, 0], [3, 2], [7, 4], [9, 5]],
  "7": [[0, 0], [4, 2], [7, 4], [10, 6]],
  maj7: [[0, 0], [4, 2], [7, 4], [11, 6]],
  m7: [[0, 0], [3, 2], [7, 4], [10, 6]],
  mM7: [[0, 0], [3, 2], [7, 4], [11, 6]],
  m7b5: [[0, 0], [3, 2], [6, 4], [10, 6]],
  dim7: [[0, 0], [3, 2], [6, 4], [9, 6]],
};
const QUAL_NAME = { "": "", m: "m", dim: "dim", aug: "aug", sus4: "sus4", "6": "6", m6: "m6", "7": "7", maj7: "M7", m7: "m7", mM7: "mM7", m7b5: "m7(♭5)", dim7: "dim7" };
const UPPER = { "": "", "7": "7", "△7": "maj7", "6": "6", sus4: "sus4", "+": "aug" };
const LOWER = { "": "m", "7": "m7", "△7": "mM7", "6": "m6", "°": "dim", "°7": "dim7", "ø7": "m7b5" };
const invert = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const UPPER_TEXT = invert(UPPER);
const LOWER_TEXT = invert(LOWER);
const FAMILY = { "": "maj", "7": "maj", maj7: "maj", "6": "maj", sus4: "maj", aug: "maj", m: "min", m7: "min", mM7: "min", m6: "min", dim: "dim", dim7: "dim", m7b5: "dim" };

// 機能（主音からの半音 + 三和音の種類 → T / SD / D / SDm）
const FUNCTIONS = {
  major: {
    "0maj": "T", "2min": "SD", "4min": "T", "5maj": "SD", "7maj": "D", "9min": "T", "11dim": "D",
    "5min": "SDm", "8maj": "SDm", "10maj": "SDm", "3maj": "SDm", "2dim": "SDm",
  },
  minor: {
    "0min": "T", "3maj": "T", "8maj": "SD", "5min": "SD", "2dim": "SD", "5maj": "SD", "1maj": "SD", "10maj": "SD",
    "7maj": "D", "7min": "D", "0maj": "T",
  },
};
// セカンダリードミナントの行き先の表記
const DIATONIC_ROMAN = {
  major: { 0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°" },
  minor: { 0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "V", 8: "VI", 10: "VII" },
};

const ACC_TEXT = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

/** 音名 letter（0 = C … 6 = B、7 以上は回る）で、高さ pc の音を書く */
export function spell(letter, pc) {
  const l = letter % 7;
  let d = (((pc - NATURAL[l]) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return LETTERS[l] + (ACC_TEXT[d] ?? "?");
}

/** "E♭" "F♯" "C" → { letter, pc } */
export function parseTonic(name) {
  const letter = LETTERS.indexOf(name[0]);
  const acc = name.includes("♯") ? 1 : name.includes("♭") ? -1 : 0;
  return { letter, pc: (NATURAL[letter] + acc + 12) % 12 };
}

/** "♭VI" "iiø7" "IV△7" → { acc, idx, upper, quality } */
export function parseRoman(text) {
  const m = /^([♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(text);
  if (!m) throw new Error(`読めないディグリー: ${text}`);
  const upper = m[2] === m[2].toUpperCase();
  const quality = (upper ? UPPER : LOWER)[m[3]];
  if (quality === undefined) throw new Error(`知らない種類: ${text}`);
  return { acc: m[1] === "♭" ? -1 : m[1] === "♯" ? 1 : 0, idx: NUMERALS.indexOf(m[2].toUpperCase()), upper, quality };
}

const mod12 = n => ((n % 12) + 12) % 12;

/** 三和音が、その調の音階の音だけでできているか（短調は導音 = 和声的短音階も入れる） */
function isDiatonic(offset, quality, mode) {
  const scale = mode === "minor" ? [...MODES.minor, 11] : MODES.major;
  return QUAL[quality].every(([s]) => scale.includes(mod12(offset + s)));
}

/** 三和音に、音階の 7 度を足した 4 和音の種類 */
function withSeventh(quality, idx, acc, mode) {
  const scale = MODES[mode];
  const iv = mod12(scale[(idx + 6) % 7] - scale[idx] - acc);
  const table = { "": { 10: "7", 11: "maj7" }, m: { 10: "m7", 11: "mM7" }, dim: { 10: "m7b5", 9: "dim7" } }[quality];
  return table?.[iv] ?? quality;
}

/** 主音からの半音 offset・種類 quality のコードの機能 → { kind, label } */
function functionOf(offset, quality, mode) {
  if (quality === "7" && offset !== 7) {
    return { kind: "sec", label: `V7/${DIATONIC_ROMAN[mode][mod12(offset + 5)] ?? "?"}` };
  }
  const f = FUNCTIONS[mode][`${offset}${FAMILY[quality]}`];
  return f ? { kind: f, label: f } : { kind: "other", label: "—" };
}

/**
 * ディグリー text を、主音 tonic（parseTonic の値）・調 mode の実際のコードにする。
 * seventh: 三和音なら音階の 7 度を足して 4 和音にする（音階にない和音はそのまま）
 * 返り値: { roman, name, pc, offset, quality, tones: [{ semi, pc, name }], func: { kind, label } }
 */
export function realize(text, tonic, mode, { seventh = false } = {}) {
  const rn = parseRoman(text);
  const offset = mod12(MODES[mode][rn.idx] + rn.acc);
  let quality = rn.quality;
  if (seventh && ["", "m", "dim"].includes(quality) && isDiatonic(offset, quality, mode)) {
    quality = withSeventh(quality, rn.idx, rn.acc, mode);
  }
  const pc = mod12(tonic.pc + offset);
  const letter = tonic.letter + rn.idx;
  const numeral = rn.upper ? NUMERALS[rn.idx] : NUMERALS[rn.idx].toLowerCase();
  return {
    roman: ACC_TEXT[rn.acc] + numeral + (rn.upper ? UPPER_TEXT : LOWER_TEXT)[quality],
    name: spell(letter, pc) + QUAL_NAME[quality],
    pc, offset, quality,
    tones: QUAL[quality].map(([s, l]) => ({ semi: s, pc: mod12(pc + s), name: spell(letter + l, pc + s) })),
    // 自動で足した 7 度は響きの色付けなので、機能は書かれたとおりの和音で決める（VII → VII7 をセカンダリードミナントにしない）
    func: functionOf(offset, rn.quality, mode),
  };
}

// ---------------------------------------------------------------- 押さえ方（ボイシング）

/** 基本形: 根音をいちばん下に、F3〜E4 から積む */
export const rootVoicing = c => {
  const root = 53 + mod12(c.pc - 53);
  return c.tones.map(x => root + x.semi);
};

/** ベース: 根音を C2〜B2 に */
export const bassNote = c => 36 + mod12(c.pc - 36);

/** 2 つの押さえ方のあいだで、声部が合わせて何半音動いたか */
export function movement(a, b) {
  if (a.length === b.length) {
    const x = [...a].sort((p, q) => p - q);
    const y = [...b].sort((p, q) => p - q);
    return x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0);
  }
  return b.reduce((s, n) => s + Math.min(...a.map(p => Math.abs(n - p))), 0);
}

/** ボイスリーディング: 転回形（どの音をいちばん下にするか）のうち、前の押さえ方 prev からいちばん動かないもの */
export function nearestVoicing(prev, c) {
  let best = null;
  let bestCost = Infinity;
  for (const bottom of c.tones) {
    const rel = c.tones.map(x => mod12(x.pc - bottom.pc)).sort((p, q) => p - q);
    const low = 52 + mod12(bottom.pc - 52);   // いちばん下の音を E3〜D#4 に
    const v = rel.map(x => low + x);
    if (v[v.length - 1] > 79) continue;
    const center = v.reduce((s, n) => s + n, 0) / v.length;
    const cost = movement(prev, v) + Math.abs(center - 64) * 0.01;   // 同じくらいなら真ん中に近い方
    if (cost < bestCost) { bestCost = cost; best = v; }
  }
  return best;
}

/** 進行全体の押さえ方。ループしても 1 つ目に自然に戻るよう、2 周目の結果を使う */
export function voiceProgression(chords, mode) {
  if (mode === "root") return chords.map(rootVoicing);
  let prev = rootVoicing(chords[0]);
  let out = [];
  for (let pass = 0; pass < 2; pass++) {
    out = chords.map(c => (prev = nearestVoicing(prev, c)));
  }
  return out;
}
