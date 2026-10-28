// スーパーハスタワーの編成（11 声部）で、どの曲の楽譜でも鳴らすための組み立て。
// hustower-super.js と、その仲間の曲（ウルトラ・大海原・図書館・牧場・学園都市）が使う。
//
// superSong({ title, description, bpm, sections, loopFrom, swing })
//   sections: [{ name, prog, key: { tonic, mode }, feel, chords, lead, ... }]（書き方は下の「セクション」）
//   loopFrom: 2 周目から戻るセクションの番号（0 から。イントロを 1 回だけ鳴らすなら 1）
//   swing:    拍の裏を後ろへずらす量（16 分音符の何個分か。0.67 で 3 連符の跳ね、12/8 拍子のように聞こえる）。
//             リードのエコーも、付点 8 分ではなく、ずらした裏拍までの長さ（2 + swing）で返る
//   paramsFrom: [スケッチ名, スケッチ] を書くと、画面の設定（鳴らす・楽器・音量）をそのスケッチと共通にする
//
// セクション
//   chords:  小節ごとのコード名（"G/B" のような分数コードも）
//   lead:    旋律。1 小節 8 分音符 8 個か 16 分音符 16 個（"-" は伸ばす、"." は休符）
//   counter: 対旋律（矩形波）/ bell: ベル（動機・オブリガート）/ bass: 低音を手で書く小節（null の小節は型どおり）
//   comp:    エレピの和音。"auto"（和音の音を G3〜F#4 に置く）、または小節ごとの音の並び（小節ごとに "auto" も書ける）
//   feel:    伴奏の型
//     intro  前奏。ハットだけから始め、最後の小節でスネアを重ねていく
//     soft   薄く。キックとスネアを弱く、ベースは付点 4 分
//     normal 中くらい。16 分のアルペジオ、FM ベース、キックは 1・2 拍目の裏・3 拍目
//     big    サビ。ハモリ（音階の 3 度下）、8 分で跳ねるベース、クラップ、頭にクラッシュ
//     jazz   ハーフタイム。エレピを 1 拍目・2 拍目の裏・3 拍目の裏で
//     ballad ハーフタイムのバラード。8 分のアルペジオ、2 分音符のベース、和音は全音符で伸ばす
//     quiet  静寂。ドラムなし、ベースは全音符、和音を伸ばすだけ
//     drop   落ちサビ。ドラム・ベース・アルペジオを抜き、旋律と和音とベルだけ。最後の小節でスネアが入って次へ
//     funk   16 分のシンコペーション。ベースは裏を食い、スネアに小さなゴースト、エレピは 16 分の裏で短く刻む（アルペジオは休む）
//   solo:    true ならリードのソロ（ハモリとベルは休む）
//   trade:   true なら対旋律とベルもソロを弾く（リードと掛け合う。2 人とも前に出す）
//   echo:    リードのエコーの深さ（書かなければ feel ごとの値）/ gate: リードの音を鳴らす割合（短いほど歯切れよく）
//   crash:   クラッシュを鳴らす小節（セクションの中の番号）。書かなければ big の頭だけ
//   noFill:  true なら、最後の小節のフィルを入れない（次が静かなセクションのとき）
//   climax:  大サビの終わり（最後の 2 小節を「止める・下りる」にする。hustower-super.js の大サビの形）
import { parseChord, parseLine, parseNote, chordMidis, bassOf, harmonyDiatonic, freq } from "./theory.js";
import { layeredSong, noteAt } from "./layers.js";

// ---------------------------------------------------------------- 楽譜の道具

const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const noteName = m => FLAT[m % 12] + (Math.floor(m / 12) - 1);
/** 楽譜 1 行を n 半音ずらす（音名は ♭ で書く） */
export const shift = (line, n) => line.split(/\s+/).map(t => (t === "." || t === "-" ? t : noteName(parseNote(t) + n))).join(" ");

/** 休みだけの小節 */
export const REST = ". . . . . . . .";

const mod12 = n => ((n % 12) + 12) % 12;

/** 8 分音符 8 個の行 → 16 分音符 16 個の行（点検ツールの b.lines の形） */
const to16 = line => {
  if (line.length === 16) return line;
  const out = Array(16).fill(null);
  line.forEach((n, i) => { if (n) out[i * 2] = { midi: n.midi, len: n.len * 2 }; });
  return out;
};

/** 和音の音を G3〜F#4 の 1 オクターブに置く（どの和音でもこの窓に収めるので、次の和音へ近い音で移る） */
export const autoVoicing = chord => chord.tones.map(t => 55 + mod12(chord.root + t - 55)).sort((a, b) => a - b);

const lowBass = chord => chordMidis({ root: bassOf(chord), tones: [0] }, 0, 36, 7)[0];

/** ハモリを数える音階の主音（短調は平行長調の主音から数えると、自然短音階になる） */
const scaleTonic = key => (key.mode === "minor" ? key.tonic + 3 : key.tonic) % 12;

/** セクションの並び → 小節ごとのデータ。loopFrom（セクションの番号）は、最後の小節の次に戻る所 */
export function barsOf(sections, loopFrom = 0) {
  const startOf = sections.slice(0, loopFrom).reduce((n, s) => n + s.chords.length, 0);
  // 楽譜の行は 8 個か 16 個（数え間違いは、黙ってずれた音になるので、ここで止める）
  for (const sec of sections) for (const k of ["lead", "counter", "bell", "bass"]) (sec[k] ?? []).forEach((line, i) => {
    const n = line?.trim().split(/\s+/).length;
    if (line && n !== 8 && n !== 16) throw new Error(`${sec.name} の ${k} の ${i + 1} 小節目が ${n} 個です（8 個か 16 個で書く）`);
  });
  return sections.flatMap(sec => sec.chords.map((c, i) => {
    const chord = parseChord(c);
    const counter = sec.counter?.[i] ? parseLine(sec.counter[i]) : null;
    const bell = sec.bell?.[i] ? parseLine(sec.bell[i]) : null;
    const lines = {};
    if (counter) lines.contrary = to16(counter);
    if (bell) lines.descant = to16(bell);
    const ci = sec.comp === "auto" ? "auto" : sec.comp?.[i];
    const comp = ci === "auto" ? autoVoicing(chord) : ci ? ci.map(parseNote) : null;
    return {
      section: sec.name, prog: sec.prog, key: sec.key, feel: sec.feel, climax: sec.climax,
      solo: sec.solo || sec.trade, trade: sec.trade, echo: sec.echo, gate: sec.gate, crash: sec.crash, noFill: sec.noFill,
      chord,
      lead: parseLine(sec.lead[i]),
      counter, bell, lines, comp,
      bassLine: sec.bass?.[i] ? parseLine(sec.bass[i]) : null,
      index: i, first: i === 0, last: i === sec.chords.length - 1, count: sec.chords.length,
    };
  })).map((b, i, all) => {
    const next = all[i + 1 === all.length ? startOf : i + 1];
    // next は次の小節（ベースが寄る音を選ぶとき、次の小節の頭の上の声部を見る）
    return Object.assign(b, { nextBass: lowBass(next.chord), get next() { return next; } });
  });
}

// ---------------------------------------------------------------- 声部の道具

/** 楽譜 1 行の、pos に始まる音 → { midi, steps（16 分音符いくつ分） } */
function noteIn(line, pos) {
  if (!line) return null;
  if (line.length === 16) return line[pos] && { midi: line[pos].midi, steps: line[pos].len };
  const n = noteAt(line, pos);
  return n && { midi: n.midi, steps: n.len * 2 };
}

/** 楽譜 1 行で、pos に鳴っている音（伸ばしている音も。休みなら null） */
function heldAt(line, pos) {
  if (!line) return null;
  const unit = line.length === 16 ? 1 : 2;
  for (let i = Math.floor(pos / unit); i >= 0; i--) {
    const n = line[i];
    if (n) return (i + n.len) * unit > pos ? n.midi : null;
  }
  return null;
}

const harmonyOn = b => b.feel === "big" && !b.solo;
const harmonyOf = (b, m) => harmonyDiatonic(m, b.chord, scaleTonic(b.key));

/** 楽譜 1 行で、pos に始まる音のすぐ前の音（休みをはさまずに続いていれば { midi }。同じ小節の中だけ見る） */
function slurredFrom(line, pos) {
  if (!line) return null;
  const unit = line.length === 16 ? 1 : 2;
  for (let i = pos / unit - 1; i >= 0; i--) {
    const n = line[i];
    if (n) return (i + n.len) * unit === pos ? n : null;
  }
  return null;
}

/** 楽譜 1 行で、pos に始まる音のすぐあとに次の音が続くか（休みをはさまない） */
function followed(line, pos, steps) {
  const unit = line.length === 16 ? 1 : 2, end = pos + steps;
  return end < 16 ? !!line[end / unit] : false;
}

/** pos に旋律・対旋律・ハモリ・ベルが鳴らしている音（この順。鳴っていなければ null） */
function upperNotes(b, pos) {
  const lead = heldAt(b.lead, pos);
  return [lead, heldAt(b.counter, pos), lead != null && harmonyOn(b) ? harmonyOf(b, lead) : null, b.solo ? null : heldAt(b.bell, pos)];
}

/** 調の音階の音名（短調は自然短音階） */
const scalePcs = key => [0, 2, 4, 5, 7, 9, 11].map(i => (i + scaleTonic(key)) % 12);

/**
 * 次の小節の低音へ寄る音。半音下 → 半音上 → 全音下 → 全音上の順に、次の 3 つを満たすものを選ぶ
 *   - 調の音階の音（音階の外の音は、和音の薄い所で「間違えた音」に聞こえる）
 *   - 上の声部と同じ音名でない（次の小節の頭で一緒に動いて連続 8 度になる）
 *   - 上の声部と短 9 度（上が半音上）・三全音にならない。和音の音（アルペジオ・エレピが鳴らす）とも短 9 度にならない
 *   - 上の声部と 5 度のまま同じ向きに動かない（連続 5 度）。寄る音へ動く所と、寄る音から次の小節の頭へ動く所の両方
 * どれもだめ・近すぎるならオクターブ上で弾む
 */
function approach(from, to, uppers, nextUppers, prevUppers, scale, chordPcs) {
  if (Math.abs(to - from) > 2) {
    for (const d of [-1, 1, -2, 2]) {
      const m = to + d;
      if (m === from || !scale.includes(mod12(m))) continue;
      if (uppers.some(u => u != null && [0, 1, 6].includes(mod12(u - m)))) continue;
      if (chordPcs.includes(mod12(m + 1))) continue;
      const parallel = (u, v, x, y) => u != null && v != null && u !== v && mod12(u - x) === 7 && mod12(v - y) === 7 && Math.sign(v - u) === Math.sign(y - x);
      const fifths = uppers.some((u, i) => parallel(u, nextUppers[i], m, to) || parallel(prevUppers[i], u, from, m));
      if (!fifths) return m;
    }
  }
  return from + 12;
}

/** エコーの深さ（伴奏の型ごと）。静かな型ほど深く、空間を広げる */
const ECHO_WET = { intro: 0, soft: 0.1, normal: 0.12, big: 0.14, jazz: 0.3, ballad: 0.26, quiet: 0.2, drop: 0.34, funk: 0.12 };
/** リードの音を鳴らす割合（型ごと）。歌う型はつなげる */
const GATE = { jazz: 0.97, ballad: 0.97, quiet: 0.97, drop: 0.98 };
/** 残響の深さ（型ごと）。静かな型ほど深く、大きな型は輪郭を残す */
const SPACE = { intro: 0.9, soft: 0.8, normal: 0.75, big: 0.7, jazz: 1, ballad: 1.1, quiet: 1.2, drop: 1.3, funk: 0.7 };

/**
 * 長い音を、平らな電子音のままにしないで鳴らす
 *   - 出だしと消え際をなめらかに（パッと始まりブツッと切れない）。消え際は音の長さの 12% まで
 *     （短い音まで長く消していくと、はじいたような音になる）
 *   - 付点 4 分以上はビブラート（vib は揺れ幅。リードより浅く）
 *   - 4 分音符以上は、音程を ±cents だけずらした 2 本を重ねる（コーラス。ゆっくりうねって、奥行きが出る）
 *   - slurFrom（前の音の MIDI 番号）を渡すと、前の音から滑り込む（スラー。出だしの立ち上がりも付けない）
 */
function sing(voice, t, dur, m, mul, steps, { vib = 0.012, cents = 7, slurFrom } = {}) {
  const opts = { attack: slurFrom != null ? 0.004 : 0.015, release: Math.min(0.1, dur * 0.12) };
  if (slurFrom != null) Object.assign(opts, { slideFrom: freq(slurFrom), slideTime: 0.04 });
  if (vib && steps >= 6) opts.vib = vib;
  if (cents && steps >= 4) {
    voice(t, dur, m, mul * 0.62, { ...opts, detune: -cents });
    voice(t, dur, m, mul * 0.62, { ...opts, detune: cents });
  } else {
    voice(t, dur, m, mul, opts);
  }
}

/** 型ごとの、ほかの声部の出番 */
const ARP_EVERY = { intro: 2, normal: 1, big: 1, ballad: 2 };
const SUB_OFF = ["intro", "soft", "quiet", "drop"];
const FM_ON = ["normal", "big"];

// ---------------------------------------------------------------- 声部

/**
 * 11 の声部を作る
 *   inst: { 声部の key: 楽器名 } / vol: { key: 音量の倍率 } / on: { key: false }（最初は鳴らさない声部）
 *   kit・percKit: ドラムとパーカッションのキット / echo: リードのエコーの深さの倍率 / echoSteps: エコーの間隔（16 分音符いくつ分）
 * key: lead / harmony / counter / bell / arp / comp / bass / sub / fm / drums / perc
 */
export function makeLayers({ inst = {}, vol = {}, on = {}, kit = "8bit", percKit = kit, echo = 1, echoSteps = 3 } = {}) {
  const layers = [
    { key: "lead", name: "リード", pan: "C", inst: "pulse25", vol: 0.12, echo: { steps: echoSteps, feedback: 0.28, wet: 0.1 }, reverb: 0.22,
      play({ t, pos, b, s16 }, voice, fx) {
        if (b.first && pos === 0) {
          fx.echo.setWet(Math.min(0.5, (b.echo ?? ECHO_WET[b.feel]) * echo));
          fx.space.setLevel(SPACE[b.feel]);   // 曲全体の残響の深さ（リードがセクションの頭で決める）
        }
        const n = noteIn(b.lead, pos);
        // 付点 4 分以上はしっかり、4 分音符は浅くビブラート
        if (n) voice(t, n.steps * s16 * (b.gate ?? GATE[b.feel] ?? 0.92), n.midi, 1, n.steps >= 6 ? { vib: true } : n.steps >= 4 ? { vib: 0.012 } : {});
      } },
    { key: "harmony", name: "ハモリ（音階の 3 度下）", pan: "L", inst: "pulse12", vol: 0.05,
      echo: { steps: echoSteps, feedback: 0.22, wet: 0.08 }, reverb: 0.3, play({ t, pos, b, s16 }, voice) {
      if (!harmonyOn(b)) return;
      const n = noteIn(b.lead, pos);
      if (n) sing(voice, t, n.steps * s16 * 0.92, harmonyOf(b, n.midi), 1, n.steps);
    } },
    { key: "counter", name: "対旋律", pan: "R", inst: "square", vol: 0.035,
      echo: { steps: echoSteps, feedback: 0.22, wet: 0.1 }, reverb: 0.35, play({ t, pos, b, s16 }, voice) {
      const n = noteIn(b.counter, pos);
      if (!n) return;
      // レガート: 次の音が続くなら切れ目を作らず、半音・全音で続く音は前の音から滑り込む
      const prev = slurredFrom(b.counter, pos);
      const slurFrom = prev && Math.abs(prev.midi - n.midi) <= 2 ? prev.midi : undefined;
      const gate = followed(b.counter, pos, n.steps) ? 1 : b.trade ? 0.9 : 0.95;
      sing(voice, t, n.steps * s16 * gate, n.midi, b.trade ? 2.5 : 1, n.steps, { ...(b.trade ? { vib: 0.02, cents: 0 } : {}), slurFrom });
    } },
    // 主題を予告するイントロと、サビの上で伸ばすオブリガート。ビブラフォン
    //   ±5 セントずらした 2 本を、違う速さで左右へ回す（うねりながら広がる）。トレモロは余韻で深くなる。
    //   エコーと残響は、この声部がいちばん深い（ほかの楽器を選んだときは、2 本の重ねとエコー・残響だけが効く）
    { key: "bell", name: "ベル（動機・オブリガート）", pan: "R", inst: "vibraphone", vol: 0.05,
      echo: { steps: echoSteps, feedback: 0.3, wet: 0.16 }, reverb: 0.45, play({ t, pos, b, s16 }, voice) {
      if (b.solo && !b.trade) return;
      const n = noteIn(b.bell, pos);
      if (!n) return;
      const dur = n.steps * s16 * 0.95, mul = (b.feel === "intro" ? 1.3 : b.trade ? 1.6 : 1) * 0.62;
      voice(t, dur, n.midi, mul, { detune: -5, spin: 0.7, swell: 0.35, mallet: true });
      voice(t, dur, n.midi, mul, { detune: 5, spin: 1.1, swell: 0.35 });
    } },
    // 分散和音。同じ強さ・同じ長さで刻み続けると機械的に聞こえるので、手で弾くような息づかいを付ける
    //   - 拍の頭は強く長く、裏は弱く短く（拍の中で、強・弱・中・弱）
    //   - 小節ごとに、上がる形と下がる形を交互に
    //   - 裏の 16 分だけ、音程をわずかにずらす（揺らぎ）
    //   - 付点 8 分のエコー（8bit の分散和音の定番。粒が左右の空間に残る）
    { key: "arp", name: "アルペジオ", pan: "L", inst: "pulse12", vol: 0.03,
      echo: { steps: echoSteps, feedback: 0.25, wet: 0.14 }, reverb: 0.3, play({ t, pos, b, s16, bar }, voice) {
      const every = ARP_EVERY[b.feel];
      if (!every || pos % every) return;
      if ((b.feel === "normal" && b.last) || (b.climax && b.index >= b.count - 2)) return;   // 旋律だけで次のセクションへ渡す
      // 旋律の音に近い（旋律の 1 半音下より上の）構成音は、1 オクターブ下げて旋律の下にとどめる
      const lead = heldAt(b.lead, pos);
      const tones = chordMidis(b.chord, 0, 55, 6).map(m => (lead != null && m >= lead - 1 ? m - 12 : m));
      const up = tones.length > 3 ? [0, 1, 2, 3] : [0, 1, 2, 1];
      const order = bar % 2 ? [...up].reverse() : up;
      const inBeat = (pos / every) % (4 / every || 1);
      const ACCENT = every === 1 ? [1.2, 0.7, 0.95, 0.7] : [1.15, 0.85];
      const GATE_IN_BEAT = every === 1 ? [0.95, 0.8, 0.9, 0.8] : [0.95, 0.85];   // 短く切るとはじいた音になるので、長さはほぼ保つ
      voice(t, every * s16 * GATE_IN_BEAT[inBeat], tones[order[(pos / every) % 4]], ACCENT[inBeat], pos % 2 ? { detune: pos % 4 === 1 ? 4 : -4 } : {});
    } },
    { key: "comp", name: "エレピ（和音）", pan: "L", inst: "fm-epiano", vol: 0.055, reverb: 0.35, play({ t, pos, b, s16 }, voice) {
      if (!b.comp) return;
      // jazz: 1 拍目・2 拍目の裏・3 拍目の裏 / normal・big: 裏拍で短く刻む / ほか: 全音符で伸ばす。セクションの最後は伸ばす
      const HITS = {
        jazz: { 0: [6, 1], 6: [2, 0.7], 10: [6, 0.85] },
        normal: { 2: [1.5, 0.6], 6: [1.5, 0.6], 10: [1.5, 0.6], 14: [1.5, 0.6] },
        big: { 2: [1.5, 0.6], 6: [1.5, 0.6], 10: [1.5, 0.6], 14: [1.5, 0.6] },
        funk: { 2: [1, 0.75], 5: [1, 0.6], 10: [1, 0.75], 13: [1, 0.6] },
      };
      const h = (b.last ? null : HITS[b.feel]) ?? { 0: [16, 0.9] };
      const hit = h[pos];
      if (!hit) return;
      // 全部の音を同じ瞬間・同じ強さで鳴らすと塊に聞こえるので、下の音から少しずつずらし（伸ばす和音ほどゆっくり）、
      // いちばん上の音（和音の中で旋律のように聞こえる音）を立て、内側の音は控えめにする
      const roll = hit[0] >= 8 ? 0.035 : 0.012;
      const top = b.comp.length - 1;
      b.comp.forEach((m, i) => voice(t + i * roll, hit[0] * s16 * 0.9 - i * roll, m, hit[1] * (i === top ? 1.15 : i === 0 ? 1 : 0.8)));
    } },
    // 低音は残響を薄く（濁らないように）。長い音だけ、ずらした 2 本を重ねてゆっくりうねらせる
    { key: "bass", name: "ベース", pan: "C", inst: "triangle", vol: 0.3, reverb: 0.06, play({ t, pos, b, s16, bass, root }, plain) {
      const voice = (t, dur, m, mul = 1) => {
        const steps = dur / s16;
        if (steps >= 5) sing(plain, t, dur, m, mul, steps, { vib: 0, cents: 5 });
        else plain(t, dur, m, mul);
      };
      if (b.bassLine) {
        const n = noteIn(b.bassLine, pos);
        if (n) voice(t, n.steps * s16 * 0.9, n.midi);
        return;
      }
      if (b.feel === "drop") return;
      const near = approach(bass, b.nextBass, upperNotes(b, 14), b.next ? upperNotes(b.next, 0) : [], upperNotes(b, 13), scalePcs(b.key),
        b.chord.tones.map(x => mod12(b.chord.root + x)));
      const fifth = bass + mod12(root + 7 - bass);
      const PAT = {
        // 位置: [高さ, 長さ]
        intro: b.index < b.count - 1 ? { 0: [bass, 16] } : Object.fromEntries([0, 2, 4, 6, 8, 10, 12, 14].map(p => [p, [p % 4 ? bass + 12 : bass, 2]])),
        soft: { 0: [bass, 6], 6: [bass + 12, 2], 8: [bass, 6], 14: [near, 2] },
        jazz: { 0: [bass, 6], 6: [bass + 12, 2], 8: [fifth, 4], 12: [bass, 2], 14: [near, 2] },
        ballad: { 0: [bass, 8], 8: [fifth, 6], 14: [near, 2] },
        quiet: { 0: [bass, 16] },
        // 1 拍目・1 拍目の 16 分の裏・2 拍目の裏・3 拍目の裏・その 16 分あと・4 拍目の裏（次へ寄る）
        funk: { 0: [bass, 3], 3: [bass + 12, 1], 6: [bass, 2], 10: [bass, 1], 11: [bass + 12, 1], 14: [near, 2] },
      }[b.feel];
      if (PAT) {
        const n = PAT[pos];
        if (n) voice(t, n[1] * s16 * 0.85, n[0], b.feel === "funk" && n[0] > bass ? 0.75 : 1);
      } else if (pos % 2 === 0) {
        // big・normal: 8 分でオクターブを往復し、小節の最後で次の低音へ寄る。拍の頭（低い根音）を強く、上のオクターブは軽く
        plain(t, 2 * s16 * 0.8, pos === 14 ? near : pos % 4 === 0 ? bass : bass + 12, pos === 0 ? 1.1 : pos % 4 === 0 ? 1 : 0.72);
      }
    } },
    { key: "sub", name: "サブベース", pan: "C", inst: "sine", vol: 0.2, play({ t, pos, b, bass, s16 }, voice) {
      // ベースが小節の最後で次の低音へ寄るので、その前（14 個目の 16 分音符）で切る
      if (pos === 0 && !SUB_OFF.includes(b.feel)) voice(t, (b.bassLine ? 16 : 14) * s16 * 0.98, b.bassLine?.[0] ? b.bassLine[0].midi : bass);
    } },
    { key: "fm", name: "FM ベースのシンコペーション", pan: "R", inst: "fm-bass", vol: 0.05, reverb: 0.05, play({ t, pos, b, bass, s16 }, voice) {
      // 3+3+2 の、まとまりの頭を強く（1 拍目がいちばん強い）
      const ACCENT = { 0: 1.15, 3: 0.75, 6: 0.9, 8: 1, 11: 0.75, 14: 0.9 };
      if (FM_ON.includes(b.feel) && !b.bassLine && pos in ACCENT) voice(t, s16 * 1.5, bass + 12, ACCENT[pos]);
    } },
    { key: "drums", name: "ドラム", pan: "C", kit: "8bit", reverb: 0.12, play({ t, pos, b }, kit) {
      const roll = from => { if (pos >= from) kit.snare(t, 0.1 + (pos - from) * (0.14 / (15 - from))); };
      const toms = () => { if (pos >= 12) kit.tom(t, [200, 170, 140, 115][pos - 12]); };
      if (pos === 0 && b.crash?.includes(b.index)) kit.crash(t);
      switch (b.feel) {
        case "intro":
          if (pos % 2 === 0 && pos < (b.last ? 8 : 16)) kit.hat(t, false, 0.025);
          if (b.index >= b.count - 2 && (pos === 0 || (pos === 8 && !b.last))) kit.kick(t, 0.6);
          if (b.last) roll(8);
          return;
        case "soft":
          if (b.last && pos >= 12) { roll(12); return; }
          if (pos === 0 || pos === 8) kit.kick(t, 0.55);
          if (pos === 4 || pos === 12) kit.snare(t, 0.12);
          if (pos % 2 === 0) kit.hat(t, false, 0.03);
          return;
        case "normal":
          if (b.last && pos >= 12) { toms(); return; }
          if ([0, 6, 8].includes(pos)) kit.kick(t);
          if (pos === 4 || pos === 12) kit.snare(t);
          kit.hat(t, false, pos % 2 ? 0.02 : 0.035);
          return;
        case "jazz":
          if (b.last) { if (pos === 0) kit.kick(t, 0.6); roll(8); return; }
          if (pos === 0 || pos === 10) kit.kick(t, 0.55);
          if (pos === 8) kit.snare(t, 0.16);
          if (pos % 2 === 0) kit.hat(t, pos === 14, 0.03);
          return;
        case "ballad":
          if (b.last && pos >= 12) { roll(12); return; }
          if (pos === 0 || pos === 10) kit.kick(t, 0.5);
          if (pos === 8) kit.snare(t, 0.15);
          if (pos % 2 === 0) kit.hat(t, false, pos % 4 ? 0.014 : 0.026);   // 8 分の裏を弱く（跳ねる曲では 3 連の揺れになる）
          return;
        case "funk":
          if (b.last && pos >= 12 && !b.noFill) { roll(12); return; }
          if ([0, 6, 10].includes(pos)) kit.kick(t, pos ? 0.6 : 0.7);
          if (pos === 4 || pos === 12) kit.snare(t);
          if ([7, 9, 15].includes(pos)) kit.snare(t, 0.045);   // ゴースト
          kit.hat(t, pos === 14, pos === 14 ? 0.06 : [0.04, 0.018, 0.03, 0.022][pos % 4]);
          return;
        case "quiet":
          return;
        case "drop":
          if (b.last) roll(8);   // 最後のサビへ、だんだん強く
          return;
        case "big": {
          if (b.climax && b.index === b.count - 2) { if (pos === 0) { kit.crash(t); kit.kick(t); } return; }   // 主和音で一度止める
          if (b.climax && b.index === b.count - 1) {
            if (pos === 0 || pos === 8) kit.kick(t, 0.6);
            if (pos === 4) kit.snare(t, 0.16);
            toms();
            return;
          }
          if (pos === 0 && !b.crash && (b.first || (b.climax && b.index === 4))) kit.crash(t);
          if (b.last && pos >= 12 && !b.noFill) { roll(12); return; }
          const kicks = b.climax ? [0, 4, 8, 12, 14] : [0, 8, 10];
          if (kicks.includes(pos)) kit.kick(t);
          if (pos === 4 || pos === 12) kit.snare(t);
          if (pos % 2 === 0) kit.hat(t, pos % 4 === 2, pos % 4 === 2 ? 0.07 : pos % 8 === 0 ? 0.045 : 0.035);
          if (pos === 14 && !b.climax) kit.snare(t, 0.05);   // 4 拍目の裏に小さなゴースト
          return;
        }
      }
    } },
    { key: "perc", name: "パーカッション", pan: "R", kit: "8bit", reverb: 0.15, play({ t, pos, b }, kit) {
      if (b.feel === "big" && !(b.climax && b.index >= b.count - 2)) {
        kit.hat(t, false, [0.034, 0.016, 0.026, 0.016][pos % 4]);
        if (pos % 2 === 1) kit.shaker(t, pos % 4 === 3 ? 0.05 : 0.035);
        if (pos === 4 || pos === 12) kit.clap(t);
      } else if (b.feel === "funk" && !b.last) {
        if (pos % 2 === 1) kit.shaker(t, pos % 4 === 3 ? 0.04 : 0.025);
        if (pos === 12) kit.clap(t, 0.06);
      } else if (b.feel === "normal" && pos % 4 === 2) {
        kit.shaker(t);
      } else if ((b.feel === "jazz" || b.feel === "ballad") && !b.last) {
        kit.shaker(t, pos % 2 ? 0.02 : 0.035);
      }
    } },
  ];
  return layers.map(l => ({
    ...l,
    inst: l.kit ? undefined : inst[l.key] ?? l.inst,
    kit: l.kit && (l.key === "perc" ? percKit : kit),
    vol: l.vol && l.vol * (vol[l.key] ?? 1),
    on: on[l.key] ?? true,
  }));
}

/** スーパーハスタワーの編成で、セクションの並びを曲にする（layeredSong に渡す形）。layers を渡さなければ makeLayers(layerOpts) */
export function superSong({ title, description, bpm, sections, loopFrom = 0, swing = 0, paramsFrom, layers, ...layerOpts }) {
  return layeredSong({
    title, description, bpm, swing, paramsFrom,
    mood: "normal",
    loopFrom: sections.slice(0, loopFrom).reduce((n, s) => n + s.chords.length, 0),
    bars: barsOf(sections, loopFrom),
    layers: layers ?? makeLayers({ echoSteps: swing ? 2 + swing : 3, ...layerOpts }),
    info: (b, x, n) => `${b.section}（${b.prog}）・ ${n} 声部`,
  });
}
