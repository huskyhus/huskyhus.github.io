// 戦闘曲 1 改（hustower-battle-kai.js）の作りに、オーケストラの声部と、自由に足せる対位の声部を加えた編成。
// 100〜150 小節の、A・B を繰り返しながらソロ・掛け合い・カノンを混ぜていく曲に使う（hustower-duel / train / shadow / kishin）。
//
// epicSong({ title, description, bpm, sections, loopFrom, parts, inst, vol, kit, percKit, off, grooves, bassStyles, bassStyle, tempo })
//   parts:  足す声部 [{ key, name, inst, pan, vol, reverb, role, echo, attack, legato }]。楽譜はセクションの parts[key] に書く
//   off:    使わない声部の key（"power" や "double" など）
//   grooves: { 名前: (x, kit) => … } セクションの groove で選ぶドラムの型 / bassStyles: { 名前: (x, voice) => … } ベースの型
//   bassStyle: 曲全体のベースの型（"16th" / "gallop" / "band"（feel どおり）/ bassStyles の名前）
//   drumVol: ドラムとパーカッションの音量（画面の音量つまみの初期値）
//   tempo:  { 小節: { 16 分音符の位置: 倍率 } }。書いた所で、もとのテンポの何倍にするかが変わる
//
// セクションは lib/superband.js の書き方に、次を足せる
//   parts:  { key: 小節ごとの楽譜 }（null の小節は休み）
//   pad:    弦の和音 "hold"（伸ばす）/ "pulse"（8 分で刻む）/ "trem"（16 分のトレモロ）/ "hits"（3+3+2 のシンコペーション）
//   brass:  金管の和音 "hits" / "half" / "long" / "stab"（小節の頭だけ）/ "off"（裏拍）
//   timp:   ティンパニ "beats" / "drive" / "rollEnd"（最後の小節で連打）/ "roll"
//   choir:  true で合唱を伸ばす / vln: 旋律を弦で重ねる（旋律からの半音。12 や -12、0 も）
//   groove: ドラムの型 / bassStyle: このセクションのベースの型 / calm: true で目立たせない（クラッシュなし）
//   mute:   このセクションで休む声部の key / mix: { key: 音量の倍率 } / keepComp: 弦の和音があってもエレピを残す
//
// 弦・金管・合唱の和音は、小節ごとに前の和音からいちばん近い押さえ方を探して、声部がなめらかに動くようにする（voiceLed）
import { barsOf, makeLayers, shift, REST } from "./superband.js";
import { parseLine, chordMidis, harmonyBelow } from "./theory.js";
import { layeredSong, noteAt } from "./layers.js";

export { shift, REST };

// ---------------------------------------------------------------- 楽譜の道具

/** 楽譜の行の並びを n 半音ずらす */
export const at = (lines, n) => lines.map(l => (l == null ? l : shift(l, n)));
/** 休みの小節を n 個 */
export const rests = n => Array(n).fill(REST);

const mod12 = n => ((n % 12) + 12) % 12;

/** 楽譜 1 行の、pos に始まる音 → { midi, steps（16 分音符いくつ分） } */
function noteIn(line, pos) {
  if (!line) return null;
  if (line.length === 16) return line[pos] && { midi: line[pos].midi, steps: line[pos].len };
  const n = noteAt(line, pos);
  return n && { midi: n.midi, steps: n.len * 2 };
}

/** 楽譜 1 行に出てくるいちばん低い音（休みだけなら null） */
const lowest = line => {
  const ms = (line ?? []).filter(Boolean).map(n => n.midi);
  return ms.length ? Math.min(...ms) : null;
};

// ---------------------------------------------------------------- 和音の押さえ方

/** 和音の音名（4 つまで。5 音の和音は 5 度を省く） */
const chordPcs = chord => {
  let pcs = [...new Set(chord.tones.map(t => mod12(chord.root + t)))];
  if (pcs.length > 4) pcs.splice(2, 1);
  // 分数コードで低音の半音上にある音（DmM7/C# の D）は省く。低音と短 9 度でぶつかる
  if (chord.bass != null) pcs = pcs.filter(pc => pc !== mod12(chord.bass + 1));
  return pcs;
};

/** 音名の組み合わせごとに、lo〜hi に置いた押さえ方を全部（低い順に並べて）返す */
function voicingsOf(pcs, lo, hi) {
  let out = [[]];
  for (const pc of pcs) {
    const options = [];
    for (let m = lo; m <= hi; m++) if (mod12(m) === pc) options.push(m);
    out = out.flatMap(v => options.map(m => [...v, m]));
  }
  return out.map(v => v.sort((a, c) => a - c));
}

/** 半音の塊（どの高さでも濁る）と、低い所の 2 度を避けた押さえ方ほど点数が低い */
function roughness(v) {
  let r = 0;
  for (let i = 0; i + 1 < v.length; i++) {
    const d = v[i + 1] - v[i];
    if (d === 1) r += 12;
    if (d === 2 && v[i] < 60) r += 4;
  }
  return r;
}

/** 小節ごとの押さえ方。前の小節から声部の動きがいちばん小さいものを選ぶ。underLead なら旋律より下に収める */
function voiceLed(bars, lo, hi, underLead) {
  let prev = null;
  return bars.map(b => {
    const pcs = chordPcs(b.chord);
    const low = underLead ? [lowest(b.lead), lowest(b.counter)].filter(m => m != null) : [];
    const top = low.length ? Math.min(hi, Math.min(...low) - 1) : hi;
    let options = voicingsOf(pcs, lo, top);
    if (!options.length) options = voicingsOf(pcs, lo, hi);
    let best = null, bestScore = Infinity;
    for (const v of options) {
      const moved = prev ? v.reduce((sum, m, i) => sum + Math.abs(m - (prev[i] ?? prev[prev.length - 1])), 0) : v[v.length - 1] - v[0];
      const score = moved + roughness(v);
      if (score < bestScore) { best = v; bestScore = score; }
    }
    prev = best;
    return best;
  });
}

// ---------------------------------------------------------------- 声部

/**
 * 1 本の線を歌う。基本はスラー気味に次の音の頭までつなぎ、同じ音が続く所だけ少し空けて弾き直す。
 * 8 分より長い音はやわらかく消し、付点 4 分以上はビブラート
 */
function sungLine({ t, pos, b, s16 }, line, nextLine, voice, { mul = 1, attack, legato = 1 } = {}) {
  const n = noteIn(line, pos);
  if (!n) return;
  const unit = line.length === 16 ? 1 : 2, end = pos + n.steps;
  const after = end < 16 ? line[end / unit] : nextLine?.[0];
  const full = n.steps * s16;
  const dur = !after ? full * 0.92 : after.midi === n.midi ? full - 0.03 : full * legato + 0.02;
  const opts = { release: after ? 0.02 : Math.min(0.1, dur * 0.12) };
  if (attack != null) opts.attack = attack;
  if (n.steps >= 6) opts.vib = 0.012;
  voice(t, dur, n.midi, mul, opts);
}

/** エレピの和音の半音の塊をほどく（hustower-battle-kai.js と同じ） */
const unclustered = (notes, root) => {
  const out = [...notes].sort((a, c) => a - c);
  for (let i = 0; i + 1 < out.length; i++) {
    if (out[i + 1] - out[i] !== 1) continue;
    if (out[i + 1] % 12 === root) out.splice(i + 1, 1);
    else if (out[i] % 12 === root) out.splice(i, 1);
    else out.push(out.splice(i, 1)[0] + 12);
    i = -1;
  }
  return out;
};

const driving = b => b.feel === "normal" || b.feel === "big";

/** 組み込みのベースの型 */
const BASS_STYLES = {
  // 原曲の性格: 16 分で刻み、3 つ目だけオクターブ上
  "16th": ({ t, pos, s16, bass }, voice) => voice(t, s16 * 0.75, bass + [0, 0, 12, 0][pos % 4], pos % 4 === 0 ? 1 : 0.8),
  // タタタ・タタタ（8 分 + 16 分 2 つ）。馬が駆けるように
  gallop: ({ t, pos, s16, bass }, voice) => { if (pos % 4 !== 1) voice(t, s16 * (pos % 4 === 0 ? 1.6 : 0.8), bass + (pos % 8 === 6 ? 12 : 0), pos % 4 === 0 ? 1 : 0.75); },
};

/** 組み込みのドラムの型 */
const GROOVES = {
  // 前へ走る型（hustower-battle-kai.js と同じ）
  drive({ t, pos, b }, kit) {
    if (b.first && pos === 0 && !b.sec.calm) kit.crash(t);
    if (b.last && pos >= 8 && !b.noFill) {
      if (pos === 8) kit.tom(t, 200);
      if (pos === 10) kit.tom(t, 140);
      if (pos >= 12) kit.snare(t, 0.12 + (pos - 12) * 0.04);
      if (pos % 4 === 0) kit.kick(t);
      return;
    }
    const kicks = b.feel === "normal" ? [0, 3, 8, 10, 11] : [0, 4, 8, 12, 14];
    if (kicks.includes(pos)) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    kit.hat(t, pos % 4 === 2, pos % 4 === 2 ? 0.06 : 0.03);
  },
  // 行進: スネアの刻みを前に出す（カノンや主題の提示の下で）
  march({ t, pos, b }, kit) {
    if (b.last && pos >= 12 && !b.noFill) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }
    if (pos === 0 || pos === 8) kit.kick(t, 0.6);
    if (pos % 2 === 0) kit.snare(t, pos % 8 === 4 ? 0.16 : 0.05);
    else if (pos % 4 === 3) kit.snare(t, 0.035);
    if (pos % 4 === 0) kit.hat(t, false, 0.03);
  },
};

const BRASS_HITS = {
  hits: { 0: [2, 1], 3: [2, 0.85], 6: [2, 0.9], 10: [2, 0.85], 12: [3, 1] },
  half: { 0: [7, 1], 8: [7, 0.9] },
  long: { 0: [15, 0.85] },
  stab: { 0: [3, 1] },
  off: { 2: [1.5, 0.8], 6: [1.5, 0.7], 10: [1.5, 0.8], 14: [1.5, 0.7] },
};

const TIMP_HITS = {
  beats: { 0: 1, 8: 0.8 },
  drive: { 0: 1, 6: 0.55, 8: 0.8, 14: 0.55 },
};

// ---------------------------------------------------------------- 曲

export function epicSong({ title, description, bpm, sections, loopFrom = 0, parts = [], inst = {}, vol = {}, kit = "8bit", percKit, off = [], grooves = {}, bassStyles = {}, bassStyle = "16th", tempo = {}, drumVol = 1 }) {
  const bars = barsOf(sections, loopFrom);
  let i = 0;
  const roster = new Set(parts.map(p => p.key));
  for (const sec of sections) {
    for (const [key, lines] of Object.entries(sec.parts ?? {})) {
      if (!roster.has(key)) throw new Error(`${sec.name} の ${key} は parts にありません`);
      if (lines.length !== sec.chords.length) throw new Error(`${sec.name} の ${key} が ${lines.length} 小節です（${sec.chords.length} 小節で書く）`);
      lines.forEach((line, n) => {
        const len = line?.trim().split(/\s+/).length;
        if (line && len !== 8 && len !== 16) throw new Error(`${sec.name} の ${key} の ${n + 1} 小節目が ${len} 個です（8 個か 16 個で書く）`);
      });
    }
    sec.chords.forEach((_, n) => {
      const b = bars[i++];
      b.sec = sec;
      b.parts = Object.fromEntries(Object.entries(sec.parts ?? {}).filter(([, lines]) => lines[n]).map(([key, lines]) => [key, parseLine(lines[n])]));
    });
  }
  const padOf = voiceLed(bars, 52, 71, true);
  const brassOf = voiceLed(bars, 47, 65, true);
  const choirOf = voiceLed(bars, 57, 76, true);
  bars.forEach((b, n) => Object.assign(b, { padChord: padOf[n], brassChord: brassOf[n], choirChord: choirOf[n] }));

  const band = makeLayers({ inst, vol, kit, percKit: percKit ?? kit, echo: 0.8 });
  const base = key => band.find(l => l.key === key);
  const volOf = (key, v) => v * (vol[key] ?? 1);

  const HARMONY = {
    ...base("harmony"),
    play(x, voice, fx) {
      const { b, pos } = x;
      if (b.counter) return;
      const n = noteIn(b.lead, pos);
      // 伸ばす音は和音の音でハモる（音階どおりだと和音と三全音で引っかかる所がある）
      const long = n && n.steps >= 4;
      base("harmony").play(x, (t, dur, m, mul, opts) => voice(t, dur, long ? harmonyBelow(n.midi, b.chord, 0) : m, mul, opts), fx);
    },
  };

  const COUNTER = {
    ...base("counter"),
    role: "descant",
    play(x, voice) {
      const { b } = x;
      if (b.counter) sungLine(x, b.counter, b.next?.counter, voice, { mul: b.trade ? 2.2 : 1.6, attack: 0.006 });
    },
  };

  const ARP = { ...base("arp"), echo: { ...base("arp").echo, wet: 0.09 } };

  const COMP = {
    ...base("comp"),
    play(x, voice) {
      const { b } = x;
      if (!b.comp || (b.sec.pad && !b.sec.keepComp)) return;
      const comp = unclustered(b.comp, b.chord.root).filter(m => ![1, 2].includes(m - (x.bass + 12)));
      base("comp").play({ ...x, b: { ...b, comp } }, voice);
    },
  };

  const styles = { ...BASS_STYLES, ...bassStyles };
  const BASS = {
    ...base("bass"),
    name: "ベース",
    play(x, voice, fx) {
      const { b } = x;
      const style = styles[b.sec.bassStyle ?? bassStyle];
      if (!style || !driving(b) || b.bassLine) { base("bass").play(x, voice, fx); return; }
      style(x, voice);
    },
  };

  const SUB = {
    ...base("sub"),
    play(x, voice, fx) {
      base("sub").play(x, (t, dur, m, mul = 1, opts) => voice(t, dur, m, x.b.feel === "ballad" ? mul * 0.5 : mul, opts), fx);
    },
  };

  const beats = { ...GROOVES, ...grooves };
  const DRUMS = {
    ...base("drums"),
    play(x, kitNow) {
      const { b } = x;
      const groove = b.sec.groove ?? (driving(b) && !b.climax ? "drive" : null);
      if (groove && beats[groove]) beats[groove](x, kitNow);
      else base("drums").play(x, kitNow);
    },
  };

  const POWER = {
    key: "power", name: "パワーコード", pan: "R", inst: inst.power ?? "fm-marimba", vol: volOf("power", 0.025), reverb: 0.18, on: true,
    play({ t, pos, b, s16, bass }, voice) {
      if (["intro", "drop", "soft", "quiet"].includes(b.feel) || (b.climax && b.index >= b.count - 2)) return;
      const r = chordMidis(b.chord, 0, 40, 11)[0];
      const chord = (b.chord.bass != null ? [bass + 12, bass + 24] : [r, r + b.chord.tones[2], r + 12]).filter(m => m < 60);
      if (b.feel === "ballad") {
        if (pos === 0) chord.forEach(m => voice(t, 15 * s16, m, 0.6, { release: 0.1 }));
      } else if (b.feel === "big") {
        if (pos === 0 || pos === 8) chord.forEach(m => voice(t, 7 * s16, m, 1, { release: 0.1 }));
      } else if ([0, 3, 6, 10, 12].includes(pos)) {
        chord.forEach(m => voice(t, s16 * 1.2, m, b.sec.calm ? 0.6 : 1));
      }
    },
  };

  const DOUBLE = {
    key: "double", name: "リード（オクターブ下）", pan: "L", inst: inst.double ?? "triangle", vol: volOf("double", 0.07), reverb: 0.15, on: true,
    echo: { steps: 3, feedback: 0.2, wet: 0.08 },
    play(x, voice) {
      const { b } = x;
      if (b.feel !== "normal" || b.solo || b.sec.calm) return;
      sungLine(x, b.lead, b.next?.lead, (t, dur, m, mul, opts) => voice(t, dur, m - 12, mul, opts));
    },
  };

  // ---- オーケストラ

  const STRINGS = {
    key: "strings", name: "弦楽（和音）", pan: "L", inst: inst.strings ?? "strings", vol: volOf("strings", 0.05), reverb: 0.4, role: "chord", on: true,
    play({ t, pos, b, s16 }, voice) {
      const hit = (dur, mul, attack, detunes = [0]) => b.padChord.forEach(m => voice(t, dur, m, mul, { attack, detunes }));
      switch (b.sec.pad) {
        case "hold": if (pos === 0) hit(16 * s16, 1, 0.1, [-8, 0, 8]); break;
        case "pulse": if (pos % 2 === 0) hit(s16 * 1.4, pos % 4 === 0 ? 1 : 0.7, 0.012); break;
        case "trem": hit(s16 * 0.95, pos % 4 === 0 ? 0.6 : 0.45, 0.01); break;
        case "hits": if ([0, 3, 6, 8, 11, 14].includes(pos)) hit(s16 * 2, pos % 8 === 0 ? 1 : 0.8, 0.012); break;
      }
    },
  };

  const BRASS = {
    key: "brass", name: "金管（和音）", pan: "R", inst: inst.brass ?? "trombone", vol: volOf("brass", 0.05), reverb: 0.3, role: "chord", on: true,
    play({ t, pos, b, s16 }, voice) {
      const hit = BRASS_HITS[b.sec.brass]?.[pos];
      if (hit) b.brassChord.forEach(m => voice(t, hit[0] * s16, m, hit[1]));
    },
  };

  const TIMP = {
    key: "timp", name: "ティンパニ", pan: "C", inst: "timpani", vol: volOf("timp", 0.22), reverb: 0.2, role: "chord", on: true,
    play({ t, pos, b, s16, bass }, voice) {
      const m = bass < 41 ? bass + 12 : bass, style = b.sec.timp;
      if (style === "roll" || (style === "rollEnd" && b.last && pos >= 8)) {
        voice(t, s16, m, style === "roll" ? 0.3 + 0.05 * pos : 0.35 + 0.08 * (pos - 8));
      } else {
        const mul = (style === "rollEnd" ? TIMP_HITS.beats : TIMP_HITS[style])?.[pos];
        if (mul) voice(t, s16 * 2, m, mul);
      }
    },
  };

  const CHOIR = {
    key: "choir", name: "合唱", pan: "C", inst: inst.choir ?? "choir", vol: volOf("choir", 0.012), reverb: 0.5, role: "chord", on: true,
    play({ t, pos, b, s16 }, voice) {
      if (b.sec.choir && pos === 0) b.choirChord.forEach(m => voice(t, 16 * s16, m, 1));
    },
  };

  const VIOLINS = {
    key: "vln", name: "ヴァイオリン群（旋律を重ねる）", pan: "R", inst: inst.vln ?? "strings", vol: volOf("vln", 0.07), reverb: 0.35, role: "double", on: true,
    play(x, voice) {
      const { b } = x;
      if (b.sec.vln == null) return;
      sungLine(x, b.lead, b.next?.lead, (t, dur, m, mul, opts) => voice(t, dur, m + b.sec.vln, mul, opts), { attack: 0.025 });
    },
  };

  const PARTS = parts.map(p => ({
    pan: "C", reverb: 0.3, role: "counter", on: true, ...p,
    play(x, voice) {
      const { b } = x;
      const line = b.parts[p.key];
      if (line) sungLine(x, line, b.next?.parts?.[p.key], voice, { attack: p.attack, legato: p.legato ?? 1 });
    },
  }));

  const swap = { harmony: HARMONY, counter: COUNTER, arp: ARP, comp: COMP, bass: BASS, sub: SUB, drums: DRUMS };
  const all = [...band.map(l => swap[l.key] ?? l), POWER, DOUBLE, STRINGS, BRASS, TIMP, CHOIR, VIOLINS, ...PARTS].filter(l => !off.includes(l.key));

  // セクションごとの mute と mix（リードはエコーと残響の深さを決める役もあるので、止めずに楽譜を休みにする）
  const layers = all.map(l => ({
    ...l,
    play(x, voice, fx) {
      const { sec } = x.b;
      if (sec.mute?.includes(l.key)) return;
      const mix = sec.mix?.[l.key];
      if (mix == null || l.kit) { l.play(x, voice, fx); return; }
      l.play(x, (t, dur, m, mul = 1, opts) => voice(t, dur, m, mul * mix, opts), fx);
    },
  }));

  const song = layeredSong({
    title, description, bpm, mood: "battle",
    loopFrom: sections.slice(0, loopFrom).reduce((n, s) => n + s.chords.length, 0),
    bars, layers,
    info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
  });

  layers.forEach((l, n) => { if (l.kit) song.params[`vol${n}`].value = drumVol; });

  return {
    ...song,
    step(at, ctx) {
      ctx.state.baseBpm ??= ctx.bpm;
      const ratio = tempo[at.bar]?.[at.pos];
      if (ratio != null) ctx.setBpm(ctx.state.baseBpm * ratio);
      song.step(at, ctx);
    },
  };
}
