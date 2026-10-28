// 曲の和声と旋律を、音楽理論の基本的な決まりで点検する。
// 使い方（musiclab フォルダで）: node tools/analyze.mjs <スケッチ名> [主音: 0 = C]
//   例: node tools/analyze.mjs hustower-finale
//
// 点検すること
//   和声:     小節ごとの度数（ローマ数字）と機能。長調を基準に、同主短調からの借用（SDm）とセカンダリードミナントも見る
//   区切り:   セクションの終わりの終止の種類と、次のセクションへのつながり
//   属七:     V7（とセカンダリードミナント）が、向かう先の和音へ進んでいるか
//   旋律:     強拍（1・3 拍目）が和音の音か、導音（シ）がドへ・属七の 7 度が順次下行で解決しているか、歌いにくい跳躍
//   声部進行: 旋律とベース（根音）、旋律と対旋律（makeSong の曲は 4 種類の対旋律、ほかは影の対旋律か和音の 3 度）の
//             あいだの連続 8 度・連続 5 度・声部の交差
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [name, tonicArg = "0"] = process.argv.slice(2);
if (!name) { console.log("使い方: node tools/analyze.mjs <スケッチ名> [主音]"); process.exit(1); }
const root = resolve(import.meta.dirname, "..");
const { chordMidis } = await import(pathToFileURL(`${root}/lib/theory.js`));
const sketch = (await import(pathToFileURL(`${root}/sketches/${name}.js`))).default;
const TONIC = Number(tonicArg);

const mod12 = n => ((n % 12) + 12) % 12;
const NOTE = ["ド", "ド♯", "レ", "ミ♭", "ミ", "ファ", "ファ♯", "ソ", "ラ♭", "ラ", "シ♭", "シ"];
const NUMERAL = {
  major: { 0: "I", 1: "♭II", 2: "II", 3: "♭III", 4: "III", 5: "IV", 6: "♯IV", 7: "V", 8: "♭VI", 9: "VI", 10: "♭VII", 11: "VII" },
  // 短調は自然短音階で数える（イ短調の C は III、G は VII）
  minor: { 0: "I", 1: "♭II", 2: "II", 3: "III", 4: "♯III", 5: "IV", 6: "♯IV", 7: "V", 8: "VI", 9: "♯VI", 10: "VII", 11: "♯VII" },
};
/** その小節の調（セクションに key があればそれ、なければ引数の主音の長調） */
const keyOf = b => b.key ?? { tonic: TONIC, mode: "major" };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** コード名の種類の部分（"Dm7b5" → "m7b5"） */
/** コード名の種類の部分（分数コードの分母は除く） */
const qualityOf = c => c.name.split("/")[0].slice(c.name[1] === "#" || c.name[1] === "b" ? 2 : 1);
const DOMINANT_QUALITIES = ["7", "7#9", "7b9"];

/** 転回形の数字（低音が 3 度 → ⁶、5 度 → ⁶₄、7 度 → ⁴₂）。分数コードでなければ空 */
function inversion(c) {
  if (c.bass == null) return "";
  const i = c.tones.map(t => t % 12).indexOf(mod12(c.bass - c.root));
  return ["", "⁶", "⁶₄", "⁴₂"][i] ?? `/${NOTE[c.bass]}`;
}
const family = q => (/^(m7b5|dim|dim7)$/.test(q) ? "dim" : /^m/.test(q) && !/^maj/.test(q) ? "min" : q === "aug" ? "aug" : "maj");

function roman(b) {
  const c = b.chord, k = keyOf(b);
  const off = mod12(c.root - k.tonic);
  const q = qualityOf(c);
  const f = family(q);
  let r = NUMERAL[k.mode][off];
  if (f !== "maj" && f !== "aug") r = r.toLowerCase();
  const suffix = { "": "", "7": "7", maj7: "△7", m: "", m7: "7", m6: "6", mM7: "△7", m7b5: "ø7", dim: "°", dim7: "°7", aug: "+", "7#9": "7(♯9)", "7b9": "7(♭9)", add9: "(add9)", sus4: "sus4", "6": "6", quartal: "(4度)" }[q] ?? q;
  return r + suffix + inversion(c);
}

// 機能（主音からの半音 + 三和音の種類）
//   長調: 同主短調からの借用は SDm、短調の主和音は Tm
//   短調: 同主長調からの借用は「（長）」付き。IV（長三和音）はドリアンの IV で SD
const FUNC = {
  major: {
    "0maj": "T", "2min": "SD", "4min": "T", "5maj": "SD", "7maj": "D", "9min": "T", "11dim": "D",
    "5min": "SDm", "8maj": "SDm", "10maj": "SDm", "3maj": "SDm", "2dim": "SDm", "8aug": "SDm", "0min": "Tm", "7min": "Dm",
  },
  minor: {
    "0min": "T", "3maj": "T", "8maj": "SD", "5min": "SD", "2dim": "SD", "10maj": "SD", "7maj": "D", "7min": "D", "11dim": "D", "1maj": "SD",
    "0maj": "T（長）", "2min": "SD（長）", "5maj": "SD（長）", "9min": "T（長）", "4min": "T（長）",
  },
};
function functionOf(b) {
  const c = b.chord, k = keyOf(b);
  const off = mod12(c.root - k.tonic);
  const q = qualityOf(c);
  // 短調の IV7 は、ドリアン（ブルース）の IV7 で、属七の働きではない
  if (DOMINANT_QUALITIES.includes(q) && off !== 7 && !(k.mode === "minor" && off === 5)) return `V7/${NUMERAL[k.mode][mod12(off + 5)]}`;
  return FUNC[k.mode][`${off}${family(q)}`] ?? "?";
}

/** 属七（とセカンダリードミナント）か。向かう先の根音。短調の IV7（ドリアン）は除く */
const dominantTarget = b => {
  const k = keyOf(b);
  if (k.mode === "minor" && mod12(b.chord.root - k.tonic) === 5) return null;
  return DOMINANT_QUALITIES.includes(qualityOf(b.chord)) ? mod12(b.chord.root + 5) : null;
};

function cadence(ba, bb) {
  const a = ba.chord, b = bb.chord, k = keyOf(bb);
  const oa = mod12(a.root - k.tonic), ob = mod12(b.root - k.tonic);
  const fa = family(qualityOf(a));
  if (ob === 0 && oa === 7) return "完全終止（V → I）";
  if (ob === 0 && oa === 5) return fa === "min" ? "変格終止（iv → I、サブドミナントマイナー）" : "変格終止（IV → I）";
  if (ob === 0 && oa === 10) return "♭VII → I（マリオ終止の形）";
  if (ob === 0 && oa === 1 && DOMINANT_QUALITIES.includes(qualityOf(a))) return "裏コードの終止（♭II7 → I）";
  if (ob === 0 && oa === 0) return "主和音の延長";
  if (ob === 7) return "半終止（→ V）";
  if (oa === 7 && (ob === 9 || ob === 8)) return "偽終止（V → vi / ♭VI）";
  return "終止なし";
}

// ---------------------------------------------------------------- 旋律を 16 分音符ごとの高さにする

const bars = sketch.data;
/** 次の小節の番号。最後の小節の次は、ループの戻り先（loopFrom。イントロを 1 回だけ鳴らす曲） */
const nextIndex = bi => (bi + 1 < bars.length ? bi + 1 : sketch.loopFrom || 0);
const at = (line, pos) => {
  if (line.length === 16) { for (let i = pos; i >= 0; i--) { const n = line[i]; if (n) return i + n.len > pos ? n.midi : null; } return null; }
  for (let i = pos >> 1; i >= 0; i--) { const n = line[i]; if (n) return i + n.len > pos >> 1 ? n.midi : null; }
  return null;
};
const notes = [];   // 旋律の音の並び { bar, pos, midi }
bars.forEach((b, bi) => {
  const unit = b.lead.length === 16 ? 1 : 2;
  b.lead.forEach((n, i) => n && notes.push({ bar: bi, pos: i * unit, midi: n.midi }));
});

// ---------------------------------------------------------------- 点検

const issues = {
  "強拍でぶつかる音": [], "対斜（同じ音名の半音のぶつかり）": [], "属七が解決しない": [], "導音が解決しない": [], "7 度が解決しない": [],
  "歌いにくい跳躍": [], "連続 8 度": [], "連続 5 度": [],
};
const notices = {
  "強拍のテンション（9・11・13 度。ぶつからないので問題なし）": [],
  "倚音（強拍でぶつけ、次の音で隣の和音の音へ解決する。泣きの表現）": [],
};
const where = (bi, pos = 0) => `${bi + 1} 小節${pos ? `（${pos / 4 + 1} 拍目）` : ""}`;

/**
 * 同じ音名の半音（ミとミ♭、ラとラ♭、シとシ♭、ドとド♯、ファとファ♯、ソとソ♯）か。
 * 主音からの半音で見る。ソ♯とラ♭は同じ高さなので、E の和音（ソ♯を 3 度に持つ）のときだけソ♯として扱う
 */
function chromaticPair(a, b, chord, key) {
  // 長調は主音から、短調は平行長調の主音から数える（イ短調はハ長調と同じ読み方）
  const ref = key.mode === "major" ? key.tonic : key.tonic + 3;
  const x = mod12(a - ref), y = mod12(b - ref);
  // ソ♯として読むのは、III の和音（ハ長調なら E）のときと、短調（導音がソ♯）のとき
  const gSharp = mod12(chord.root - ref) === 4 || key.mode === "minor";
  const pairs = [[3, 4], [10, 11], [0, 1], [5, 6], gSharp ? [7, 8] : [8, 9]];
  return pairs.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
}

bars.forEach((b, bi) => {
  const pcs = b.chord.tones.map(x => mod12(b.chord.root + x));
  for (const pos of [0, 8]) {
    const m = at(b.lead, pos);
    if (m == null || pcs.includes(mod12(m))) continue;
    const clash = pcs.some(p => Math.abs(mod12(m - p + 6) - 6) === 1);
    // 倚音: ぶつかった音のすぐ次の音が、2 半音以内の和音の音（同じ小節の中で）
    const i = notes.findIndex(n => n.bar === bi && n.pos <= pos && (notes.find(x => x.bar === bi && x.pos > n.pos)?.pos ?? 99) > pos);
    const nx = notes[i + 1];
    const resolves = nx && nx.bar === bi && Math.abs(nx.midi - m) <= 2 && pcs.includes(mod12(nx.midi));
    const list = !clash ? "強拍のテンション（9・11・13 度。ぶつからないので問題なし）" : resolves ? "倚音（強拍でぶつけ、次の音で隣の和音の音へ解決する。泣きの表現）" : null;
    (list ? notices[list] : issues["強拍でぶつかる音"]).push(`${where(bi, pos)} ${NOTE[mod12(m)]}（${b.chord.name}）`);
  }
  // 旋律のすべての音（短い音も）と和音の音のあいだの対斜
  const seen = new Set();
  b.lead.forEach(n => {
    if (!n || pcs.includes(mod12(n.midi))) return;
    for (const p of pcs) {
      if (!chromaticPair(n.midi, p, b.chord, keyOf(b))) continue;
      const k = `${NOTE[mod12(n.midi)]}/${NOTE[p]}`;
      if (!seen.has(k)) { seen.add(k); issues["対斜（同じ音名の半音のぶつかり）"].push(`${where(bi)} 旋律の${NOTE[mod12(n.midi)]} と 和音の${NOTE[p]}（${b.chord.name}）`); }
    }
  });
  const target = dominantTarget(b);
  const next = bars[nextIndex(bi)];
  if (target != null && mod12(next.chord.root) !== target) {
    // 偽終止（V7 → vi / ♭VI）。転調する所では、行き先の調で数える
    const deceptive = [keyOf(b), keyOf(next)].some(k =>
      mod12(b.chord.root - k.tonic) === 7 && [8, 9].includes(mod12(next.chord.root - k.tonic)));
    // 裏コード（三全音代理）: 根音が半音下へ進む属七は、5 度下の属七の代わり
    const tritoneSub = mod12(next.chord.root - b.chord.root) === 11;
    if (!deceptive && !tritoneSub) issues["属七が解決しない"].push(`${where(bi)} ${b.chord.name} → ${next.chord.name}`);
  }
});

notes.forEach((n, i) => {
  const nx = notes[(i + 1) % notes.length];
  const b = bars[n.bar];
  const t0 = keyOf(b).tonic;
  const pc = mod12(n.midi - t0);
  const isDom = ["7", "7b9"].includes(qualityOf(b.chord)) && mod12(b.chord.root - t0) === 7;
  // 導音（シ）は、V の和音の上ではドへ（または和音の音のあいだを動くだけ）
  if (pc === 11 && mod12(b.chord.root - t0) === 7 && nx.bar !== n.bar && mod12(nx.midi - t0) !== 0 && Math.abs(nx.midi - n.midi) > 2) {
    issues["導音が解決しない"].push(`${where(n.bar, n.pos)} ${NOTE[mod12(n.midi)]} → ${NOTE[mod12(nx.midi)]}`);
  }
  // 属七の 7 度（ファ）は、次の和音へ移るとき順次下行（ミ）か、同じ音にとどまる
  if (isDom && pc === 5 && nx.bar !== n.bar && !(nx.midi - n.midi <= 0 && nx.midi - n.midi >= -2)) {
    issues["7 度が解決しない"].push(`${where(n.bar, n.pos)} ${NOTE[mod12(n.midi)]} → ${NOTE[mod12(nx.midi)]}`);
  }
  const leap = nx.midi - n.midi;
  // 増 2 度（ラ♭ ↔ シ）。E の和音の上のソ♯ → シ（短 3 度）は数えない
  const aug2 = Math.abs(leap) === 3 && [8, 11].includes(pc) && [8, 11].includes(mod12(nx.midi - t0)) && mod12(b.chord.root - t0) !== 4;
  if (Math.abs(leap) > 12 || aug2) {
    issues["歌いにくい跳躍"].push(`${where(n.bar, n.pos)} ${NOTE[mod12(n.midi)]} → ${NOTE[mod12(nx.midi)]}（${leap > 0 ? "+" : ""}${leap} 半音）`);
  }
});

// 連続 8 度・5 度・声部の交差: 和音や対旋律が変わる所で、その直前と直後の音どうしを比べる
// ほかの声部: ベース（和音の根音）と、対旋律
//   makeSong の曲は b.lines の対旋律（16 分音符の楽譜）を 8 分音符ごとに。合いの手は旋律と交差してよい
//   それ以外は b.counter（選ばれた音、なければ和音の 3 度）を小節の頭と 3 拍目に
const counterAt = (b, pos) => (b.counter ? b.counter[pos < 8 ? 0 : 1] : chordMidis(b.chord, 0, 60, 6)[1]);
const LINE_NAMES = { contrary: "対旋律（反行）", descant: "高音のオブリガート", answer: "合いの手", tenor: "低音の対旋律" };
const bassAt = b => chordMidis({ root: b.chord.bass ?? b.chord.root, tones: [0] }, 0, 36, 7)[0];
const pos16 = (bi, pos) => ({ b: bars[mod(bi, bars.length)], pos });
function mod(n, m) { return ((n % m) + m) % m; }
issues["声部の交差"] = [];
/** その小節で、対旋律の線が旋律とずっと同じ音名か（わざと重ねている） */
function doubled(b, label) {
  const k = Object.entries(LINE_NAMES).find(([, v]) => v === label)?.[0];
  const line = b.lines?.[k];
  if (!line) return false;
  let both = 0;
  for (let pos = 0; pos < 16; pos++) {
    const m = at(b.lead, pos), l = at(line, pos);
    if (m == null || l == null) continue;
    if (mod12(m - l) !== 0) return false;
    both++;
  }
  return both >= 4;
}
bars.forEach((b, bi) => {
  for (let pos = 0; pos < 16; pos += 2) {
    const before = pos === 0 ? pos16(bi - 1, 15) : pos16(bi, pos - 1);
    const after = pos16(bi, pos);
    const m1 = at(before.b.lead, before.pos), m2 = at(after.b.lead, after.pos);
    if (m1 == null || m2 == null) continue;
    const others = [];   // [名前, 前の音, 今の音, 交差を見るか]
    if (b.lines) {
      for (const [k, line] of Object.entries(b.lines)) {
        const prevLine = before.b.lines?.[k];
        others.push([LINE_NAMES[k], prevLine ? at(prevLine, before.pos) : null, at(line, after.pos), k !== "answer"]);
      }
    } else if (pos % 8 === 0) {
      others.push(["対旋律", counterAt(before.b, before.pos), counterAt(after.b, after.pos), true]);
    }
    if (pos === 0) others.push(["ベース", bassAt(before.b), bassAt(after.b), false]);
    for (const [label, l1, l2, cross] of others) {
      if (l1 == null || l2 == null) continue;
      if (doubled(b, label)) continue;   // 旋律をユニゾン・オクターブで重ねている小節
      // 光と影が役を入れ替える所（対旋律が旋律の下から上へ移る）は、交差ではない
      const swap = before.b.side !== after.b.side;
      if (cross && !swap && Math.sign(m2 - l2) !== Math.sign(m1 - l1) && m2 !== l2) issues["声部の交差"].push(`${where(bi, pos)}（旋律と${label}）`);
      if (l1 === l2 || m1 === m2 || Math.sign(m2 - m1) !== Math.sign(l2 - l1)) continue;
      const i1 = mod12(Math.abs(m1 - l1)), i2 = mod12(Math.abs(m2 - l2));
      if (i1 === 0 && i2 === 0) issues["連続 8 度"].push(`${where(bi, pos)}（旋律と${label}）`);
      if (i1 === 7 && i2 === 7) issues["連続 5 度"].push(`${where(bi, pos)}（旋律と${label}）`);
    }
  }
});

// ---------------------------------------------------------------- 出力

console.log(`\n${sketch.title}（${bars.length} 小節）\n`);
let sec = null, row = [], secKey = null;
const KEY_NAME = k => `${["ハ", k.mode === "major" ? "変ニ" : "嬰ハ", "ニ", "変ホ", "ホ", "ヘ", "嬰ヘ", "ト", "変イ", "イ", "変ロ", "ロ"][k.tonic]}${k.mode === "major" ? "長調" : "短調"}`;
const flushRow = last => {
  if (!row.length) return;
  console.log(`  ${sec}（${KEY_NAME(secKey)}で読む）`);
  console.log(`    ${row.join("  ")}`);
  console.log(`    終わり: ${last}`);
};
bars.forEach((b, bi) => {
  if (b.section !== sec) { if (row.length) flushRow(cadence(bars[bi - 2], bars[bi - 1]) + `／ 次へ: ${bars[bi - 1].chord.name} → ${b.chord.name}`); sec = b.section; secKey = keyOf(b); row = []; }
  row.push(`${roman(b)}[${functionOf(b)}]`);
});
const back = bars[nextIndex(bars.length - 1)];
flushRow(cadence(bars[bars.length - 2], bars[bars.length - 1]) + `／ 頭へ: ${bars[bars.length - 1].chord.name} → ${back.chord.name}（${cadence(bars[bars.length - 1], back)}）`);

console.log("\n点検の結果");
for (const [k, v] of Object.entries(issues)) console.log(`  ${k}: ${v.length ? `${v.length} 件 ― ${v.join("、")}` : "なし"}`);
console.log("\n参考");
for (const [k, v] of Object.entries(notices)) console.log(`  ${k}: ${v.length ? `${v.length} 件 ― ${v.join("、")}` : "なし"}`);
