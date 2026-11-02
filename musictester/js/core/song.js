// 曲データのモデル。作成・編集の操作と、JSON への保存・読み込みを持つ。DOM には触らない。
import { transposeMidi, transposeInChord, QUALITIES } from "./theory.js";

export const FORMAT = "musictester-song";
export const SCHEMA_VERSION = 1;
export const BARS_PER_SECTION = 8;
export const STEPS_PER_BAR = 16;
export const SECTION_STEPS = BARS_PER_SECTION * STEPS_PER_BAR;
export const BPM_MIN = 40;
export const BPM_MAX = 240;
export const HISTORY_LIMIT = 30;

export const PART_NAMES = ["melody", "bass", "drums", "counter", "harmony"];
export const MIX_NAMES = ["chords", ...PART_NAMES];
export const PART_LABEL = { chords: "コード", melody: "メロディ", bass: "ベース", drums: "ドラム", counter: "対旋律", harmony: "ハモリ" };

export const DEFAULT_PARAMS = {
  melody: { density: 0.5, low: 62, high: 81, style: "lyrical" },
  bass: { density: 0.5, low: 31, high: 52, style: "auto" },
  drums: { density: 0.5, style: "8beat" },
  counter: { density: 0.5, low: 53, high: 72, style: "sustain" },
  harmony: { density: 1, low: 48, high: 81, style: "third" },
};

export const TIMBRES = {
  chords: [["pad", "パッド"], ["piano", "ピアノ風"]],
  melody: [["square", "矩形波"], ["triangle", "三角波"], ["sawtooth", "ノコギリ波"], ["sine", "サイン波"]],
  bass: [["round", "丸いベース"], ["buzz", "硬いベース"]],
  counter: [["triangle", "三角波"], ["sine", "サイン波"], ["square", "矩形波"]],
  harmony: [["triangle", "三角波"], ["square", "矩形波"], ["sine", "サイン波"]],
  drums: [["standard", "標準"]],
};

const DEFAULT_MIX = {
  chords: { volume: 0.6, timbre: "pad" },
  melody: { volume: 0.75, timbre: "square" },
  bass: { volume: 0.8, timbre: "round" },
  drums: { volume: 0.7, timbre: "standard" },
  counter: { volume: 0.5, timbre: "triangle" },
  harmony: { volume: 0.45, timbre: "triangle" },
};

const clone = x => JSON.parse(JSON.stringify(x));

export function emptyPart(name) {
  return { locked: false, seed: 1, params: clone(DEFAULT_PARAMS[name]), notes: [], basis: "", history: [], historyIndex: -1 };
}

export function emptyBars() {
  return Array.from({ length: BARS_PER_SECTION }, () => ({ chords: [] }));
}

export function createSection(id, name) {
  const parts = {};
  for (const p of PART_NAMES) parts[p] = emptyPart(p);
  return { id, name, bars: emptyBars(), parts };
}

export function createSong() {
  const mixParts = {};
  for (const m of MIX_NAMES) mixParts[m] = { ...DEFAULT_MIX[m], mute: false, solo: false };
  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    title: "無題",
    settings: { key: { tonic: 0, mode: "major" }, bpm: 120 },
    sections: [createSection("s1", "A")],
    arrangement: ["s1"],
    mix: { master: 0.8, parts: mixParts },
  };
}

export const findSection = (song, id) => song.sections.find(s => s.id === id) || null;

function nextSectionId(song) {
  const max = song.sections.reduce((m, s) => Math.max(m, Number(s.id.slice(1)) || 0), 0);
  return `s${max + 1}`;
}

/** A, B, … Z, AA, AB … のうち、まだ使っていない最初の名前 */
export function nextSectionName(song) {
  const used = new Set(song.sections.map(s => s.name));
  for (let i = 0; ; i++) {
    let n = i;
    let name = "";
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    if (!used.has(name)) return name;
  }
}

export function addSection(song) {
  const s = createSection(nextSectionId(song), nextSectionName(song));
  song.sections.push(s);
  song.arrangement.push(s.id);
  return s;
}

export function duplicateSection(song, id) {
  const src = findSection(song, id);
  if (!src) return null;
  const copy = clone(src);
  copy.id = nextSectionId(song);
  copy.name = nextSectionName(song);
  song.sections.splice(song.sections.indexOf(src) + 1, 0, copy);
  song.arrangement.push(copy.id);
  return copy;
}

/** セクションを消す（構成からも取り除く）。最後の 1 つは消せない */
export function deleteSection(song, id) {
  if (song.sections.length <= 1) return false;
  song.sections = song.sections.filter(s => s.id !== id);
  song.arrangement = song.arrangement.filter(x => x !== id);
  return true;
}

export const barChord = bar => (bar.chords.length ? bar.chords[0].chord : null);

/** 小節にコードを置く（1 小節 1 コードの全音符として） */
export function setBarChord(section, barIndex, chord) {
  section.bars[barIndex].chords = chord ? [{ startBeat: 0, beats: 4, chord: clone(chord) }] : [];
}

/** 2 つの小節の中身を入れ替える（片方が空なら移動になる） */
export function swapBars(section, a, b) {
  if (a === b) return;
  const tmp = section.bars[a].chords;
  section.bars[a].chords = section.bars[b].chords;
  section.bars[b].chords = tmp;
}

/** 構成の並びを動かす */
export function moveInArrangement(song, from, to) {
  const list = song.arrangement;
  if (from < 0 || from >= list.length || to < 0 || to > list.length) return;
  const [id] = list.splice(from, 1);
  list.splice(from < to ? to - 1 : to, 0, id);
}

/** コードの並び（小節の順。空の小節は飛ばす）→ [{ bar, chord, startBeat, beats }] */
export function sectionChords(section) {
  const out = [];
  section.bars.forEach((bar, i) => {
    for (const c of bar.chords) out.push({ bar: i, chord: c.chord, startBeat: c.startBeat, beats: c.beats });
  });
  return out;
}

/** 16 分音符の位置 step で鳴っているコード（なければ null） */
export function chordAtStep(section, step) {
  const bar = section.bars[Math.floor(step / STEPS_PER_BAR)];
  if (!bar) return null;
  const inBar = (step % STEPS_PER_BAR) / 4;
  for (const c of bar.chords) {
    if (inBar >= c.startBeat && inBar < c.startBeat + c.beats) return c.chord;
  }
  return null;
}

/** 生成の元になったコード進行の印（調に依存しない）。変わったら「要引き直し」にする */
export function progressionSignature(section) {
  return section.bars.map(b => b.chords.map(c => JSON.stringify(c.chord)).join("+")).join("|");
}

/** 調を変える。コードはディグリーのままなので書き換えない。生成済みの音符だけ度数を保って移す */
export function changeKey(song, key) {
  const from = song.settings.key;
  if (from.tonic === key.tonic && from.mode === key.mode) return;
  const seen = new Set();
  const moveOnce = (notes, section) => {
    if (seen.has(notes)) return;
    seen.add(notes);
    for (const n of notes) {
      if (typeof n.midi !== "number") continue;
      const chord = chordAtStep(section, n.t);
      n.midi = chord ? transposeInChord(n.midi, chord, from, key) : transposeMidi(n.midi, from, key);
    }
  };
  for (const s of song.sections) {
    for (const p of PART_NAMES) {
      const part = s.parts[p];
      moveOnce(part.notes, s);
      for (const h of part.history) moveOnce(h.notes, s);
    }
  }
  song.settings.key = { tonic: key.tonic, mode: key.mode };
}

export const clampBpm = bpm => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(Number(bpm) || 120)));

// ---------------------------------------------------------------- 保存と読み込み

export function serializeSong(song) {
  return JSON.stringify(song);
}

const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);

function checkChord(c, where) {
  if (!isObj(c)) throw new Error(`${where}: コードの形が正しくありません`);
  const okDeg = n => Number.isInteger(n) && n >= 1 && n <= 7;
  if (c.kind === "scale" && !okDeg(c.deg)) throw new Error(`${where}: deg が正しくありません`);
  if (c.kind === "sec" && !okDeg(c.target)) throw new Error(`${where}: target が正しくありません`);
  if (!["scale", "sec", "abs"].includes(c.kind)) throw new Error(`${where}: 知らないコードの種類 ${c.kind}`);
  if (c.kind !== "abs" && c.size !== 3 && c.size !== 4) throw new Error(`${where}: size が正しくありません`);
  if (c.inversion !== undefined && ![1, 2, 3].includes(c.inversion)) throw new Error(`${where}: inversion が正しくありません`);
  if (c.kind === "abs") {
    const ok = Number.isInteger(c.semi) && c.semi >= 0 && c.semi < 12 && Number.isInteger(c.letter) && c.letter >= 0 && c.letter < 7;
    if (!ok || !Object.hasOwn(QUALITIES, c.quality)) throw new Error(`${where}: コードを読めません`);
  }
}

function checkBarChord(entry, where) {
  if (!isObj(entry) || typeof entry.startBeat !== "number" || typeof entry.beats !== "number" || entry.beats <= 0) {
    throw new Error(`${where}: コードの拍の指定が正しくありません`);
  }
  checkChord(entry.chord, where);
}

function checkMix(mix) {
  const ok = isObj(mix) && isObj(mix.parts) && typeof mix.master === "number" && MIX_NAMES.every(m => {
    const p = mix.parts[m];
    return isObj(p) && Number.isFinite(p.volume) && typeof p.mute === "boolean" && typeof p.solo === "boolean" && typeof p.timbre === "string";
  });
  if (!ok) throw new Error("ミックスの設定が正しくありません");
}

function checkNotes(notes, where) {
  if (!Array.isArray(notes)) throw new Error(`${where}: notes は配列です`);
  for (const n of notes) {
    const okTime = isObj(n) && Number.isFinite(n.t) && n.t >= 0 && Number.isFinite(n.d) && n.d > 0;
    if (!okTime || !(n.v > 0 && n.v <= 1)) throw new Error(`${where}: 音符の形が正しくありません`);
    const okMidi = typeof n.midi === "number" && n.midi >= 0 && n.midi <= 127;
    if (!okMidi && typeof n.drum !== "string") throw new Error(`${where}: 音符に音の高さがありません`);
  }
}

function checkSong(song) {
  if (!isObj(song) || song.format !== FORMAT) throw new Error("musictester の曲データではありません");
  if (!Number.isInteger(song.schemaVersion) || song.schemaVersion < 1) throw new Error("スキーマのバージョン番号がありません");
  if (song.schemaVersion > SCHEMA_VERSION) throw new Error(`新しいバージョン（${song.schemaVersion}）のデータは読めません`);
  const key = song.settings?.key;
  if (!isObj(key) || !Number.isInteger(key.tonic) || key.tonic < 0 || key.tonic > 11 || !["major", "minor"].includes(key.mode)) {
    throw new Error("調の設定が正しくありません");
  }
  if (typeof song.settings.bpm !== "number" || song.settings.bpm < BPM_MIN || song.settings.bpm > BPM_MAX) {
    throw new Error("BPM の設定が正しくありません");
  }
  if (!Array.isArray(song.sections) || song.sections.length === 0) throw new Error("セクションがありません");
  const ids = new Set();
  for (const s of song.sections) {
    if (!isObj(s) || typeof s.id !== "string" || typeof s.name !== "string") throw new Error("セクションの形が正しくありません");
    if (s.note !== undefined && typeof s.note !== "string") throw new Error(`セクション ${s.name}: note は文字列です`);
    if (ids.has(s.id)) throw new Error(`セクションの id が重複しています: ${s.id}`);
    ids.add(s.id);
    if (!Array.isArray(s.bars) || s.bars.length !== BARS_PER_SECTION) throw new Error(`セクション ${s.name}: 小節の数が正しくありません`);
    s.bars.forEach((b, i) => {
      if (!isObj(b) || !Array.isArray(b.chords)) throw new Error(`セクション ${s.name} の ${i + 1} 小節目の形が正しくありません`);
      b.chords.forEach(c => checkBarChord(c, `セクション ${s.name} の ${i + 1} 小節目`));
    });
    if (!isObj(s.parts)) throw new Error(`セクション ${s.name}: パートがありません`);
    for (const p of PART_NAMES) {
      const part = s.parts[p];
      if (!isObj(part) || !isObj(part.params)) throw new Error(`セクション ${s.name}: パート ${p} がありません`);
      checkNotes(part.notes, `${s.name}/${p}`);
      if (!Array.isArray(part.history) || !Number.isInteger(part.historyIndex)) throw new Error(`${s.name}/${p}: 履歴の形が正しくありません`);
      for (const h of part.history) {
        checkNotes(h?.notes, `${s.name}/${p} の履歴`);
        if (!isObj(h.params)) throw new Error(`${s.name}/${p}: 履歴の形が正しくありません`);
      }
    }
  }
  if (!Array.isArray(song.arrangement) || song.arrangement.some(id => !ids.has(id))) {
    throw new Error("曲の構成が、ないセクションを指しています");
  }
  checkMix(song.mix);
  if (typeof song.title !== "string") throw new Error("曲名が正しくありません");
}

/** 古いスキーマのデータを今の形にする。v1 が最初の版なので、今は何もしない */
function migrate(song) {
  return song;
}

/** JSON の文字列から曲を読む。形が正しくなければ、日本語のメッセージで例外を投げる */
export function parseSong(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON として読めません");
  }
  checkSong(data);
  return migrate(data);
}
