// 光と影の合奏の編曲（「光と影の合奏」と「本番合奏」で使う）。ハ長調（光）とハ短調（影）は主音が同じ。
// 光の声部 5 つ（リード・ベース・8bit ドラム・アルペジオ・ハモリ）と、影の声部 4 つ（旋律・低い弦・コーラス・鼓動）。
//
// lightShadowSong({ title, description, bpm, mood, counter, sections })
//   sections: [{ name, side, feel, chords: [小節ごと], lead: [小節ごと] }]
//   side: "light"（光だけ）/ "shadow"（影だけ）
//         / "both"（合奏: 光がリードを歌い、影が下で対旋律を伸ばす）
//         / "both-shadow"（合奏: 影がリードを歌い、光が下で対旋律を伸ばす）
//   feel: "normal"（書かなければこれ）/ "soft"（光のドラムなし・アルペジオは 8 分・ハモリなし）/ "big"（4 小節ごとにシンバル）
//   bpm（セクションごと、任意）: そのセクションのテンポ。変わる前の 1 小節で、なめらかに速く（遅く）する
//   key（セクションごと、任意）: { tonic: 主音（0 = C）, mode: "major" / "minor" }。tools/analyze.mjs が度数を読むときに使う
//   counter: 対旋律の選び方
//     "third"（書かなければこれ）: いつも和音の 3 度
//     "voiced": 和音の 3 度を優先しつつ、旋律と同じ音・連続 8 度・連続 5 度・声部の交差を避け、前の音にいちばん近い音を選ぶ
import { parseChord, parseLine, chordMidis, harmonyBelow } from "./theory.js";
import { layeredSong, noteAt } from "./layers.js";

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const C_MINOR = [0, 2, 3, 5, 7, 8, 10, 11];   // 自然短音階 + 和声的短音階のシ

const light = b => b.side !== "shadow";
const shadow = b => b.side !== "light";
const mod12 = n => ((n % 12) + 12) % 12;

/** 16 分音符 pos の時点で鳴っている旋律の音（伸ばしているものも含む）。休符なら null */
function soundingAt(line, pos) {
  for (let i = pos >> 1; i >= 0; i--) {
    const n = line[i];
    if (n) return i + n.len > pos >> 1 ? n.midi : null;
  }
  return null;
}

/**
 * 対旋律（2 分音符で、1 小節に 2 つ）を、声部進行の決まりに沿って選ぶ。
 * low〜high の和音の音から、点数がいちばん低いものを選ぶ:
 *   前の音からの距離 + 和音の 3 度なら −2（影の色の音を優先）
 *   + 旋律と同じ音なら +20 + 連続 8 度・連続 5 度なら +30 + 旋律と上下が入れ替わるなら +30
 */
function voicedCounter(bars, { low, high, above }) {
  let prev = Math.round((low + high) / 2);
  let prevMel = null;
  for (const b of bars) {
    const pcs = b.chord.tones.map(x => mod12(b.chord.root + x));
    const third = pcs[1];
    const cands = [];
    for (let m = low; m <= high; m++) if (pcs.includes(mod12(m))) cands.push(m);
    b.counter = [0, 8].map(pos => {
      const mel = soundingAt(b.lead, pos);
      // この 2 分音符のあいだに旋律がいちばん下（上）に来る音。対旋律がそれを越えると、声部が入れ替わる
      const span = Array.from({ length: 8 }, (_, k) => soundingAt(b.lead, pos + k)).filter(m => m != null);
      const edge = span.length ? (above ? Math.max(...span) : Math.min(...span)) : null;
      const cost = c => {
        let s = Math.abs(c - prev) + (mod12(c) === third ? -2 : 0);
        if (edge != null && (above ? c <= edge : c >= edge)) s += 30;
        if (mel != null) {
          if (mod12(c) === mod12(mel)) s += 20;
          if (prevMel != null && c !== prev && mel !== prevMel) {
            const i1 = mod12(prevMel - prev), i2 = mod12(mel - c);
            if (i1 === i2 && (i2 === 0 || i2 === 7) && Math.sign(mel - prevMel) === Math.sign(c - prev)) s += 30;
          }
        }
        return s;
      };
      prev = cands.reduce((a, c) => (cost(c) < cost(a) ? c : a));
      // 次の点検用に、この 2 分音符の終わりで鳴っている旋律の音を覚えておく
      prevMel = soundingAt(b.lead, pos + 7) ?? mel ?? prevMel;
      return prev;
    });
  }
}

const LAYERS = [
  // ---------------------------------------------------------------- 光の声部
  { name: "光のリード", pan: "C", inst: "pulse25", vol: 0.12, play({ t, pos, b, s16 }, voice) {
    if (b.side === "both-shadow") {
      // 影が歌うあいだは、下で対旋律を伸ばす
      if (pos % 8 === 0) voice(t, 8 * s16 * 0.95, b.counter ? b.counter[pos / 8] : chordMidis(b.chord, 0, 55, 6)[1]);
      return;
    }
    const n = light(b) && noteAt(b.lead, pos);
    if (n) voice(t, n.len * 2 * s16 * 0.92, n.midi);
  } },
  { name: "光のベース", pan: "C", inst: "triangle", vol: 0.28, play({ t, pos, root, s16, b }, voice) {
    if (!light(b) || pos % 2 !== 0) return;
    if (b.feel === "soft") { if (pos % 8 === 0) voice(t, 7 * s16, root); return; }   // 静かなところは 2 分音符で
    voice(t, 2 * s16 * 0.8, pos % 4 === 0 ? root : root + 12);
  } },
  { name: "光のドラム", pan: "C", kit: "8bit", play({ t, pos, b }, kit) {
    if (!light(b) || b.feel === "soft") return;
    if (pos === 0 && b.side === "both" && (b.first || (b.feel === "big" && b.index % 4 === 0))) kit.crash(t);
    if (b.last && pos >= 12) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }
    if (pos === 0 || pos === 8 || pos === 10) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    if (pos % 2 === 0) kit.hat(t, pos % 4 === 2);
  } },
  { name: "光のアルペジオ", pan: "L", inst: "pulse12", vol: 0.028, play({ t, pos, mid, s16, b }, voice) {
    if (!light(b)) return;
    if (b.feel === "soft") { if (pos % 2 === 0) voice(t, s16 * 1.8, mid[[0, 1, 2, 1, 0, 2, 1, 2][pos / 2] % mid.length]); return; }
    voice(t, s16 * 0.7, mid[[0, 1, 2, 1][pos % 4]]);
  } },
  { name: "光のハモリ（合奏から）", pan: "L", inst: "pulse12", vol: 0.05, play({ t, pos, b, s16 }, voice) {
    const n = (b.side === "both" || b.side === "both-shadow") && b.feel !== "soft" && noteAt(b.lead, pos);
    if (n) voice(t, n.len * 2 * s16 * 0.92, harmonyBelow(n.midi, b.chord, 0));
  } },

  // ---------------------------------------------------------------- 影の声部
  { name: "影の旋律", pan: "R", inst: "strings", vol: 0.14, play({ t, pos, b, s16 }, voice) {
    if (b.side === "shadow" || b.side === "both-shadow") {
      const n = noteAt(b.lead, pos);
      if (n) voice(t, n.len * 2 * s16 * 0.92, n.midi);
    } else if (b.side === "both" && pos % 8 === 0) {
      // 合奏では、下で伸ばす対旋律になる（"third" なら和音の 3 度。借用和音のときは、それがミ♭・ラ♭などの影の音になる）
      voice(t, 8 * s16 * 0.95, b.counter ? b.counter[pos / 8] : chordMidis(b.chord, 0, 60, 6)[1]);
    }
  } },
  { name: "影の低い弦", pan: "LL", inst: "strings", vol: 0.06, play({ t, pos, b, s16 }, voice) {
    if (!shadow(b) || pos !== 0) return;
    const r = chordMidis(b.chord, 0, 36, 11)[0];
    [r, r + 7].forEach(m => voice(t, 16 * s16 * 0.98, m));
  } },
  { name: "影のコーラス", pan: "RR", inst: "fm-organ", vol: 0.022, play({ t, pos, mid, s16, b }, voice) {
    if (shadow(b) && pos === 0) mid.forEach(m => voice(t, 16 * s16 * 0.98, m + 12));
  } },
  { name: "影の鼓動", pan: "C", kit: "acoustic", play({ t, pos, b }, kit) {
    if (!shadow(b)) return;
    if (b.side === "shadow") {
      // 影だけのときは、ゆっくりしたハーフタイム
      if (pos === 0) kit.kick(t, 0.7);
      if (pos === 8) kit.snare(t, 0.2);
      if (pos === 14) kit.tom(t, 120);
    } else if (pos === 0 || pos === 3) {
      kit.kick(t, 0.45);   // 合奏では、光のドラムの下で心臓のように「ドッ・ドッ」
    }
  } },
];

export function lightShadowSong({ sections, counter = "third", ...rest }) {
  const bars = sections.flatMap(sec => sec.chords.map((c, i) => {
    const chord = parseChord(c);
    return {
      section: sec.name,
      side: sec.side,
      feel: sec.feel ?? "normal",
      name: c.replace("b", "♭").replace("m7♭5", "m7(♭5)"),
      chord,
      lead: parseLine(sec.lead[i]),
      // ハ長調の音階にない音を含み、すべての音がハ短調の音階にある和音 = ハ短調から借りてきた和音
      // （E7 のように、どちらにもない音を含むものは借用和音ではない）
      borrowed: chord.tones.some(x => !C_MAJOR.includes((chord.root + x) % 12))
        && chord.tones.every(x => C_MINOR.includes((chord.root + x) % 12)),
      index: i,
      first: i === 0,
      last: i === sec.chords.length - 1,
      bpm: sec.bpm ?? rest.bpm,
      key: sec.key,
    };
  }));
  if (counter === "voiced") {
    // 影が支える小節と、光が支える小節で、それぞれ続けて選ぶ（声部が違うので別々に）。
    // 光が支えるときは、影の旋律（戦闘曲のテーマなど、高く上がるもの）の下に入る
    voicedCounter(bars.filter(b => b.side === "both"), { low: 55, high: 69, above: false });
    voicedCounter(bars.filter(b => b.side === "both-shadow"), { low: 52, high: 66, above: false });
  }
  const song = layeredSong({
    ...rest,
    bars,
    layers: LAYERS,
    info: b => `${b.section} ・ ${b.name}${b.side === "shadow" ? "（ハ短調）" : b.borrowed ? "（ハ短調から借りた和音）" : ""}`,
  });
  if (sections.some(s => s.bpm)) {
    // テンポが変わる前の 1 小節で、16 分音符ごとに少しずつ次のテンポへ近づける
    const step = song.step;
    song.step = (at, ctx) => {
      const now = bars[at.bar].bpm;
      const next = bars[(at.bar + 1) % bars.length].bpm;
      ctx.setBpm?.(now + (next - now) * ((at.pos + 1) / 16));
      step(at, ctx);
    };
  }
  return song;
}
