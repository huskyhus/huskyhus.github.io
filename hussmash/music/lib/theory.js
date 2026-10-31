// 音楽理論まわりの小さな道具。音の高さは MIDI 番号（C4 = 60、A4 = 69）で扱う。

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const accidental = c => (c === "#" ? 1 : c === "b" ? -1 : 0);

/** "C5" "G#4" "Bb3" → MIDI 番号 */
export function parseNote(s) {
  const acc = accidental(s[1]);
  return 12 * (Number(s.slice(acc ? 2 : 1)) + 1) + PITCH[s[0]] + acc;
}

export const freq = m => 440 * 2 ** ((m - 69) / 12);

/** コードの種類 → 根音からの半音 */
export const QUALITY = {
  "": [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], "6": [0, 4, 7, 9], m6: [0, 3, 7, 9],
  "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], mM7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  add9: [0, 4, 7, 14], "9": [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14],
  quartal: [0, 5, 10, 15],   // 4 度堆積（完全 4 度を積む。長調・短調のどちらにも寄らない響き）
  "7sus4": [0, 5, 7, 10],     // 属七の 3 度を 4 度に吊る（解決を先へ延ばす）
  "7#9": [0, 4, 7, 10, 15],  // 長 3 度と短 3 度（♯9 として）を同時に含む（いわゆるジミヘン・コード）
  "7b9": [0, 4, 7, 10, 13],  // 属七 + ♭9（短調の和声的短音階から来る属和音。長調で使うと影の色が入る）
};

/**
 * "Am7" "F#dim" "Bbmaj7" → { name, root: 0〜11, tones: [半音...] }
 * 分数コード "G/B" "C7/G" は bass（低音の音名 0〜11）も持つ。tones は分母を除いた和音のまま
 */
export function parseChord(name) {
  const [main, over] = name.split("/");
  const acc = accidental(main[1]);
  const q = main.slice(acc ? 2 : 1);
  if (!(q in QUALITY)) throw new Error(`知らないコード: ${name}`);
  const chord = { name, root: (PITCH[main[0]] + acc + 12) % 12, tones: QUALITY[q] };
  if (over) chord.bass = (PITCH[over[0]] + accidental(over[1]) + 12) % 12;
  return chord;
}

/** 低音の音名（分数コードなら分母、そうでなければ根音） */
export const bassOf = chord => chord.bass ?? chord.root;

/** 和音の構成音を MIDI 番号で返す。根音は base 〜 base + maxAbove に置き、入らなければ 1 オクターブ下（key は転調の半音） */
export function chordMidis(chord, key, base, maxAbove = 6) {
  let root = base + (((chord.root + key - base) % 12) + 12) % 12;
  if (root - base > maxAbove) root -= 12;
  return chord.tones.map(i => root + i);
}

/** ハモリの音: 和音の構成音のうち、3 度下 → 6 度下 → それ以外で近いもの の順に選ぶ */
export function harmonyBelow(m, chord, key) {
  const pcs = chord.tones.map(i => (chord.root + key + i) % 12);
  const inChord = n => pcs.includes(((n % 12) + 12) % 12);
  for (const d of [3, 4, 8, 9]) if (inChord(m - d)) return m - d;
  for (let d = 5; d <= 12; d++) if (inChord(m - d)) return m - d;
  return m - 12;
}

/**
 * 音階どおりの 3 度下のハモリ（tonic の長音階で数える）。旋律が経過音でも幅が 3 度のままそろう。
 * 3 度下の音が和音の音と半音でぶつかるときと、旋律が音階の外の音のときだけ、和音の音に頼る。
 * 分数コード（G/B など）では、低音の音（転回形の 3 度）を重ねないように、ほかの和音の音を選ぶ
 */
export function harmonyDiatonic(m, chord, tonic = 0) {
  const mod12 = n => ((n % 12) + 12) % 12;
  const scale = [0, 2, 4, 5, 7, 9, 11].map(i => (i + tonic) % 12);
  const pcs = chord.tones.map(t => (chord.root + t) % 12);
  const avoid = chord.bass != null && chord.bass !== chord.root ? chord.bass : null;
  const chordToneBelow = () => {
    for (const d of [3, 4, 8, 9, 5, 6, 7, 10, 11, 12]) if (pcs.includes(mod12(m - d)) && mod12(m - d) !== avoid) return m - d;
    return m - 12;
  };
  const i = scale.indexOf(mod12(m));
  if (i < 0) return chordToneBelow();
  const below = scale[(i + 5) % 7];
  const rubs = !pcs.includes(below) && pcs.some(p => [1, 11].includes(mod12(below - p)));
  return rubs || below === avoid ? chordToneBelow() : m - mod12(m - below);
}

/**
 * 楽譜の 1 行（hustower と同じ書き方）を読む。"-" は直前の音を伸ばす、"." は休符。
 * "C5 . G4 - E5" → [{ midi: 72, len: 1 }, null, { midi: 67, len: 2 }, null, { midi: 76, len: 1 }]
 */
export function parseLine(line) {
  const toks = line.trim().split(/\s+/);
  return toks.map((tok, i) => {
    if (tok === "." || tok === "-") return null;
    let len = 1;
    while (toks[i + len] === "-") len++;
    return { midi: parseNote(tok), len };
  });
}

/** 音階（根音からの半音） */
export const SCALES = {
  "長音階（アイオニアン）": [0, 2, 4, 5, 7, 9, 11],
  "ドリアン": [0, 2, 3, 5, 7, 9, 10],
  "フリジアン": [0, 1, 3, 5, 7, 8, 10],
  "リディアン": [0, 2, 4, 6, 7, 9, 11],
  "ミクソリディアン": [0, 2, 4, 5, 7, 9, 10],
  "自然短音階（エオリアン）": [0, 2, 3, 5, 7, 8, 10],
  "和声的短音階": [0, 2, 3, 5, 7, 8, 11],
  "ヨナ抜き長音階": [0, 2, 4, 7, 9],
  "ヨナ抜き短音階": [0, 2, 3, 7, 8],
  "琉球音階": [0, 4, 5, 7, 11],
  "都節音階": [0, 1, 5, 7, 8],
  "ブルース": [0, 3, 5, 6, 7, 10],
};

/** 音階の degree 番目の音（0 が根音。音階の長さを超えたらオクターブ上に回る） */
export function scaleNote(scale, degree, root) {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  return root + 12 * oct + scale[((degree % n) + n) % n];
}
