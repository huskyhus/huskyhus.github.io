// 作曲の道具。楽譜 1 行（"C5 . G4 -"）を作る・移調する・長調と短調を入れ替える。
// ソロと無調の旋律は、はっきりした規則で自動で作る:
//   ソロ: 拍の頭は和音の音、そのあいだは音階を 1 歩ずつ。音域の端で折り返す
//   ウォーキングベース: 1 拍目は根音、4 拍目は次の根音の半音となり（引き寄せる音）
//   無調: 12 音の音列（12 の音を 1 回ずつ使う並び）を順に使い、オクターブを大きく飛ばす
import { parseChord, parseNote } from "./theory.js";

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOT = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const mod12 = n => ((n % 12) + 12) % 12;

export const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

/** 8 分休符だけの 1 小節 */
export const REST = ". . . . . . . .";

/** MIDI 番号 → "C#4" */
export const noteName = m => `${SHARP[mod12(m)]}${Math.floor(m / 12) - 1}`;

/** [MIDI 番号 / "-" / "."] → 楽譜 1 行 */
export const toLine = tokens => tokens.map(x => (typeof x === "number" ? noteName(x) : x)).join(" ");

/** 楽譜 1 行の音を、それぞれ f(MIDI 番号) で置き換える */
export const mapLine = (line, f) =>
  line.trim().split(/\s+/).map(tok => (tok === "." || tok === "-" ? tok : noteName(f(parseNote(tok))))).join(" ");

export const transposeLine = (line, semis) => mapLine(line, m => m + semis);

/** 長調の旋律を同主短調に: 主音から長 3 度・長 6 度・長 7 度の音を半音下げる */
export const toParallelMinor = (line, tonic) => mapLine(line, m => ([4, 9, 11].includes(mod12(m - tonic)) ? m - 1 : m));

/** 長調の旋律を同主の和声的短音階に: 3 度と 6 度だけ下げ、7 度（主音へ戻る導音）は残す。V の和音の上でも濁らない */
export const toHarmonicMinor = (line, tonic) => mapLine(line, m => ([4, 9].includes(mod12(m - tonic)) ? m - 1 : m));

/** 短調の旋律を同主長調に: 主音から短 3 度・短 6 度・短 7 度の音を半音上げる */
export const toParallelMajor = (line, tonic) => mapLine(line, m => ([3, 8, 10].includes(mod12(m - tonic)) ? m + 1 : m));

/** コード名を移調する（"F#m7" を 2 上げると "Abm7"） */
export function transposeChord(name, semis) {
  const c = parseChord(name);
  const acc = name[1] === "#" || name[1] === "b";
  return ROOT[mod12(c.root + semis)] + name.slice(acc ? 2 : 1);
}

const chordPcs = name => {
  const c = parseChord(name);
  return c.tones.map(i => mod12(c.root + i));
};

/** 和音に合う音階: 音階の音のうち、和音の「音階にない音」と半音でぶつかるものを外し、その和音の音を入れる */
function scaleFor(name, tonic, scale) {
  const pcs = chordPcs(name);
  const base = scale.map(s => mod12(tonic + s));
  const outside = pcs.filter(p => !base.includes(p));
  return [...base.filter(p => !outside.some(o => Math.abs(mod12(p - o + 6) - 6) === 1)), ...outside];
}

// ソロのリズム（16 分音符 16 個。n = 新しい音、- = 伸ばす）
const SOLO_RHYTHMS = {
  phrase: "n-n-nnnnn---n-nn",
  run: "nnnnnnnnnnnnnnnn",
  gallop: "n-nnn-nnn-nnn-nn",
  hold: "n-------n-nnn---",
  climb: "n-n-n-n-nnnnnnnn",
};

/**
 * ソロの旋律（1 小節 = 16 分音符 16 個）。chords は小節ごとのコード名
 * tonic: 主音（0 = C）、scale: SCALE のどれか、lo〜hi: 音域、rhythms: SOLO_RHYTHMS の名前を小節ごとに順に使う
 */
export function soloLines(chords, { tonic, scale, lo, hi, rhythms = ["phrase", "run", "gallop", "hold"] }) {
  let prev = Math.round((lo + hi) / 2);
  let dir = 1;
  // from から dir の向きに、ok を満たす次の音。音域を出るなら向きを変える
  const next = (from, ok) => {
    for (let tries = 0; tries < 2; tries++) {
      let m = from + dir;
      while (!ok(m)) m += dir;
      if (m >= lo && m <= hi) return m;
      dir = -dir;
    }
    return from;
  };
  return chords.map((name, bar) => {
    const pcs = chordPcs(name);
    const allowed = scaleFor(name, tonic, scale);
    const rhythm = SOLO_RHYTHMS[rhythms[bar % rhythms.length]];
    if (bar % 2 === 1) dir = -dir;   // 2 小節ごとに向きを変えて、山と谷を作る
    const out = [];
    for (let pos = 0; pos < 16; pos++) {
      if (rhythm[pos] !== "n") { out.push("-"); continue; }
      const onBeat = pos % 4 === 0;
      prev = next(prev, m => (onBeat ? pcs : allowed).includes(mod12(m)));
      out.push(prev);
    }
    return toLine(out);
  });
}

/** 鍵盤ソロ: 和音の音を 2 オクターブ半にわたって 16 分で弾く。小節ごとに上り・下り・往復・3 度飛ばしを替える */
export function arpLines(chords, { lo }) {
  return chords.map((name, bar) => {
    const pcs = chordPcs(name);
    const tones = [];
    for (let m = lo; m <= lo + 30; m++) if (pcs.includes(mod12(m))) tones.push(m);
    const bounce = i => { const p = 2 * (tones.length - 1); const k = i % p; return k < tones.length ? k : p - k; };
    const shapes = [
      i => bounce(i),                                   // 上って下りる
      i => bounce(i + tones.length - 1),                // 上から下りて上る
      i => Math.min(tones.length - 1, (i >> 1) + (i % 2) * 2),   // 3 度飛ばしで上る（0, 2, 1, 3, 2, 4 …）
      i => bounce(i * 2),                               // 1 つ飛ばしで大きく往復
    ];
    const shape = shapes[bar % shapes.length];
    return toLine(Array.from({ length: 16 }, (_, i) => tones[shape(i)]));
  });
}

/** ウォーキングベース（8 分音符 8 個 = 4 分音符 4 つ）。1 拍目は根音、4 拍目は次の小節の根音へ半音で引き寄せる */
export function walkingLines(chords, { lo = 36 }) {
  return chords.map((name, bar) => {
    const c = parseChord(name);
    const root = lo + mod12(c.root - lo);
    const third = root + c.tones[1];
    const fifth = root + c.tones[2];
    const nextName = chords[(bar + 1) % chords.length];
    const nextRoot = lo + mod12(parseChord(nextName).root - lo);
    const approach = nextRoot > root ? nextRoot - 1 : nextRoot + 1;
    // 偶数小節は 4 分で歩き、奇数小節は 3 拍目でオクターブ上へ跳ねる
    return bar % 2 === 0
      ? toLine([root, "-", third, "-", fifth, "-", approach, "-"])
      : toLine([root, "-", fifth, "-", root + 12, fifth, approach, "-"]);
  });
}

// 無調の旋律のリズム（8 分音符 8 個）
const ROW_RHYTHMS = ["n - - - n - n -", "n - n - - - n -", "n - - - - - - -", "n n n - n - - -"];

/** 12 音の音列 row（0〜11）から無調の旋律を作る。音列 → 逆行 → 反行 → 反行の逆行の順に使い、オクターブを飛ばす */
export function rowLines(row, bars, { lo = 60, offset = 0 }) {
  const forms = [row, [...row].reverse(), row.map(p => mod12(-p)), row.map(p => mod12(-p)).reverse()];
  const seq = forms.flat().map(p => mod12(p + offset));
  let k = 0;
  return Array.from({ length: bars }, (_, bar) =>
    ROW_RHYTHMS[bar % ROW_RHYTHMS.length].split(" ").map(tok => {
      if (tok !== "n") return tok;
      const pc = seq[k % seq.length];
      const leap = k % 3 === 1 ? 12 : k % 5 === 4 ? -12 : 0;   // 大きな跳躍で、調の手がかりを消す
      k++;
      return noteName(lo + mod12(pc - lo) + leap);
    }).join(" "));
}

/** 音列の音を根音にした、調の中心がない和音（増三和音・4 度堆積・減七・ハーフディミニッシュ） */
export function rowChords(row, bars, { offset = 0 } = {}) {
  const kinds = ["aug", "quartal", "dim7", "m7b5"];
  return Array.from({ length: bars }, (_, i) => ROOT[mod12(row[i % row.length] + offset)] + kinds[i % kinds.length]);
}
