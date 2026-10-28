// データ（コード・メロディ・曲の性格）から、13 声部の編曲を作る。
//
// makeSong({ title, description, bpm, mood, inst, sections })
//   mood: "normal"（通常曲）/ "battle"（戦闘曲）/ "boss"（ボス戦曲）。伴奏・ドラムの型が変わる
//   inst: { 声部の番号（0 から）: 楽器名 } で、最初に選ばれている楽器を変える
//   sections: [{ name, prog（使っているコード進行の名前）, chords: [小節ごと], lead: [小節ごと] }]
//     1 つ目は普通、2 つ目（サビ）は厚く、3 つ目（C メロ）は控えめな伴奏になる
//     lead の 1 小節は、8 分音符 8 個でも、16 分音符 16 個でも書ける
//   セクションごとに書けること（書かなければ上のとおり）:
//     feel: "normal" / "big"（厚く）/ "soft"（控えめ）/ "free"（無調: 決まった型をやめ、不規則な位置で鳴らす）
//     mood: そのセクションだけ伴奏の型を変える（通常曲の中で戦闘の型にする、など）
//     solo: "lead" / "bass" / "drums" / "arp" / "counter"。その声部が lead の旋律を弾き（ドラムはソロの型）、ほかは伴奏だけ残す
//     harmony: 3 度下のハモリを入れるか
//     counters: 5 番の対旋律（反行）のほかに鳴らす対旋律。"descant" / "answer" / "tenor" の配列（書き方は下の「対旋律」）
//     mode: 画面に出す調の説明（「ハ短調」「無調」など）
// 声部の並びはどの曲も同じ（曲の切り替えのつなぎが、行き先の 2 番 = ベース・3 番 = ドラム・4 番 = アルペジオの楽器を使う）。
// 11〜13 番は後から足した対旋律（高音のオブリガート・合いの手・低音の対旋律）。
import { parseChord, parseLine, chordMidis, harmonyBelow } from "./theory.js";
import { layeredSong, noteAt } from "./layers.js";

// ---------------------------------------------------------------- 拍と長さ
// 1 小節 = 16 分音符 16 個。pos はその中の位置（0〜15）。長さも 16 分音符いくつ分かで書き、鳴らすときに s16 を掛ける

const SIXTEENTH = 1;
const EIGHTH = 2;
const QUARTER = 4;
const HALF = 8;
const WHOLE = 16;
const DOTTED_SIXTEENTH = 1.5;

/** n 拍目の頭の pos */
const BEAT = { 1: 0, 2: 4, 3: 8, 4: 12 };

const onEighth = pos => pos % EIGHTH === 0;        // 8 分の表
const offSixteenth = pos => pos % EIGHTH === 1;    // 16 分の裏
const onBeat = pos => pos % QUARTER === 0;         // 拍の頭
const offBeat = pos => pos % QUARTER === 2;        // 拍の裏（8 分の裏）

/** 音符の長さのうち、実際に鳴らす割合（短いほど歯切れよく、1 を超えると次の音に重なって響く） */
const GATE = { staccato: 0.7, drive: 0.75, short: 0.8, tenuto: 0.9, melody: 0.92, legato: 0.95, full: 0.98, ring: 1.2 };

const OCTAVE = 12;
const FIFTH = 7;
const TRITONE = 6;

// ---------------------------------------------------------------- 音域（MIDI 番号。chordMidis の base は「根音をここから上に置く」）

const REG = {
  counterLow: 55, counterHigh: 69, counterStart: 64,   // 対旋律（反行）: G3〜A4、最初は E4 の近くから
  descantLow: 72, descantHigh: 88, descantStart: 79,   // 高音のオブリガート: C5〜E6
  answerLow: 64, answerHigh: 81,                       // 合いの手: E4〜A5
  tenorLow: 48, tenorHigh: 62, tenorStart: 55,         // 低音の対旋律: C3〜D4
  comp: 55,         // コードの刻み: 根音を G3〜C#4 に
  power: 48,        // パワーコード: 根音を C3〜B3 に
  battleBass: 40,   // 戦闘曲のベース: E2〜D#3
  bossBass: 36,     // ボス戦曲のベース: C2〜B2
};

// ---------------------------------------------------------------- リズムの型

const RHYTHM = {
  backbeat: [BEAT[2], BEAT[4]],                      // スネア・クラップ: 2・4 拍目
  popKick: [BEAT[1], BEAT[3], BEAT[3] + EIGHTH],     // 1・3 拍目 + 3 拍目の裏
  softKick: [BEAT[1], BEAT[3]],
  syncoKick: [0, 3, 8, 10, 11],                      // 16 分の裏を混ぜて前のめりに
  fourOnFloor: [0, 4, 8, 12, 14],                    // 4 つ打ち + 4 拍目の裏
  halfTimeKick: [BEAT[1], BEAT[3] + EIGHTH],         // ハーフタイム（スネアは 3 拍目だけ）
  powerStab: [0, 3, 6, 10, 12],                      // 3 + 3 + 4 + 2 + 4 の刻み
  bossStab: { 0: 3, 6: 2, 12: 3 },                   // 位置: 長さ（ジャーン・ジャ・ジャーン）
  andOf4: BEAT[4] + EIGHTH,                         // 4 拍目の裏（次の小節への合いの手を入れる所）
  gallopRest: 1,                                     // ギャロップ（タッ・タタ）: 拍の 2 つ目の 16 分は休む
  gallopUp: BEAT[2] + EIGHTH,                        // 2・4 拍目の裏（半小節ごとの 6 番目）はオクターブ上
};

/** 16 分で刻むベースの、拍の中での高さ（オクターブ上に跳ねる） */
const DRIVE = [0, 0, OCTAVE, 0];

/** アルペジオで、和音の何番目の音を弾くか */
const ARP = { upDown: [0, 1, 2, 1], wave: [0, 1, 2, 1, 0, 2, 1, 2] };

/** フィル: 4 拍目から（戦闘・ボスは 3 拍目から）、スネアが 1 打ごとに強くなる */
const FILL = { from: BEAT[4], longFrom: BEAT[3], vel: 0.12, step: 0.04 };
const rollSnare = (kit, t, pos) => kit.snare(t, FILL.vel + (pos - FILL.from) * FILL.step);

/** タムの高さ（Hz） */
const TOM = { high: 200, mid: 160, low: 140, floor: 120 };
const TOM_RUN = [240, 210, 185, 160, 140, 120, 105, 90];   // ボス戦のフィル: 8 つ駆け下りる

/** ドラムの強さ（キットの vol）。ここにないものはキットの標準 */
const VEL = {
  softKick: 0.5, softSnare: 0.14,              // 通常曲の C メロ
  halfKick: 0.6, halfSnare: 0.18,              // 戦闘曲のハーフタイム
  bossKick: 0.6, bossSnare: 0.27,              // ボス戦のツーバスと重いスネア
  bossSoftKick: 0.7, bossSoftSnare: 0.24,      // ボス戦の C メロ
};

/** セクションの順番 → 伴奏の厚さ（普通・サビは厚く・C メロは控えめ） */
const SECTION_FEELS = ["normal", "big", "soft"];

/** ハモリは何番目のセクションから入れるか（サビから） */
const HARMONY_FROM = 1;

// ---------------------------------------------------------------- 道具

/** ベースの低い根音（base 〜 base + 11 の 1 オクターブに置く） */
const lowRoot = (b, base) => chordMidis(b.chord, 0, base, OCTAVE - 1)[0];

// ---------------------------------------------------------------- 対旋律
// どれも和音の音だけを使い、前の音から近い音を選ぶ。旋律・ベースとの連続 8 度・連続 5 度、旋律と同じ音・半音のぶつかり・交差は避ける。
//   contrary（反行）: 旋律が上がれば下がり、下がれば上がる。4 分音符（控えめなセクションは 2 分音符）。いつも 5 番の声部で鳴る
//   descant（高音のオブリガート）: 旋律より上を、2 分音符で伸ばす。同じ音が続けばつなげる。上に入る音が無ければ休む
//   answer（合いの手）: 旋律が付点 4 分以上伸ばす・休む所にだけ、8 分音符で和音をなぞって答える
//   tenor（低音の対旋律）: 和音の 3 度・7 度を選んで、低い所を 2 分音符でつなぐ
// 小節ごとに b.lines[名前] = 16 分音符 16 個の楽譜（{ midi, len } か null）を作る

/** セクションの厚さ → 反行のほかに鳴らす対旋律 */
const FEEL_COUNTERS = { normal: ["answer"], big: ["descant"], soft: ["tenor"], free: [] };

/** 合いの手を入れる、旋律の隙間の長さ（これ以上あいていたら） */
const ANSWER_GAP = HALF - EIGHTH;

const mod12 = n => ((n % 12) + 12) % 12;
const sign = Math.sign;

/** pos で鳴っている旋律の音（伸ばしている音も。休みなら null） */
function leadAt(line, pos) {
  const unit = line.length === WHOLE ? SIXTEENTH : EIGHTH;
  for (let i = Math.floor(pos / unit); i >= 0; i--) {
    const n = line[i];
    if (n) return (i + n.len) * unit > pos ? n.midi : null;
  }
  return null;
}

/** 旋律の音の出だしの pos */
const leadOnsets = line => line.flatMap((n, i) => (n ? [i * (line.length === WHOLE ? SIXTEENTH : EIGHTH)] : []));

/** 和音の音のうち lo〜hi にあるもの */
function chordTones(chord, lo, hi) {
  const pcs = chord.tones.map(i => mod12(chord.root + i));
  const out = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(mod12(m))) out.push(m);
  return out;
}

/** a → b と c → d が、同じ向きに動いて同じ完全音程（8 度・5 度）を保つか */
const parallel = (a, b, c, d) => a !== b && c !== d && sign(b - a) === sign(d - c) &&
  mod12(Math.abs(c - a)) === mod12(Math.abs(d - b)) && [0, 7].includes(mod12(Math.abs(d - b)));

/** 交差・同じ音・半音のぶつかり・連続 8 度 / 5 度の点数（これ以上なら使わない） */
const BAD = 100;

/**
 * 候補 cands から、いちばんよい音を選ぶ（点数が小さいほどよい）。
 * prev: この声部の前の音（休んでいたら null）/ m0 → m1: 直前の旋律 → 今の旋律 / span: この音を伸ばすあいだに鳴る旋律の音
 * r0 → r1: ベースの根音 / side: 旋律より上（1）か下（-1）か、どちらでもよい（0）/ extra(c): 声部ごとの好み
 */
function pick(cands, { prev, from = prev, m0, m1, span = [m1], r0, r1, side, extra = () => 0 }) {
  let best = null, bestCost = Infinity;
  for (const c of cands) {
    let cost = Math.abs(c - from);
    if (Math.abs(c - from) > FIFTH) cost += 4;                                            // 大きな跳躍
    for (const m of span) {
      if (m == null) continue;
      if (side && sign(c - m) !== side) cost += BAD;                                      // 交差
      if (c === m) cost += BAD;                                                           // 旋律と同じ音
      if ([1, 11].includes(mod12(c - m))) cost += m === m1 ? BAD : 15;                    // 半音でぶつかる（旋律が和音の外の音のとき）
    }
    if (prev != null && m0 != null && m1 != null && parallel(prev, c, m0, m1)) cost += BAD;
    if (prev != null && r0 != null && parallel(prev, c, r0, r1)) cost += BAD;
    cost += extra(c);
    if (cost < bestCost) { best = c; bestCost = cost; }
  }
  return { c: best, ok: bestCost < BAD };
}

const emptyLine = () => Array(WHOLE).fill(null);

/** 旋律の from〜to（16 分音符の位置）で鳴る音（重ならないように） */
function leadSpan(line, from, to) {
  const out = new Set();
  for (let p = from; p < to; p++) out.add(leadAt(line, p));
  out.delete(null);
  return [...out];
}

/**
 * 決まった位置（slots(b) の pos）で 1 音ずつ選んでいく声部を作る。
 * opts: lo / hi / start（最初の音）/ side / extra(c, ctx) / tie: 同じ音が続いたらつなげる
 * どの音を選んでも交差・連続 8 度などになってしまう所は休む
 */
function slotLine(bars, key, { lo, hi, start, side, extra = () => 0, slots, tie = false }) {
  let prev = null, from = start, mDir = null, lastBar = null, r0 = null;
  for (const b of bars) {
    const line = emptyLine();
    const ps = slots(b);
    const r1 = mod12(b.chord.root);
    const cands = chordTones(b.chord, lo, hi);
    ps.forEach((pos, i) => {
      const end = ps[i + 1] ?? WHOLE;
      const m0 = pos > 0 ? leadAt(b.lead, pos - 1) : lastBar && leadAt(lastBar.lead, WHOLE - 1);
      const m1 = leadAt(b.lead, pos);
      const ctx = { b, pos, from, m0: mDir, m1: m1 ?? mDir };
      const { c, ok } = pick(cands, { prev, from, m0, m1, span: leadSpan(b.lead, pos, end), r0, r1, side, extra: c => extra(c, ctx) });
      if (ok) {
        const before = ps[i - 1];
        if (tie && before != null && line[before]?.midi === c) line[before].len += end - pos;
        else line[pos] = { midi: c, len: end - pos };
        from = c;
      }
      prev = ok ? c : null;
      mDir = m1 ?? mDir;
      r0 = r1;
    });
    lastBar = b;
    b.lines[key] = line;
  }
}

/** 音域の真ん中から離れるほど点数を足す（端に張り付かないように） */
const centerPull = (c, lo, hi, w) => Math.abs(c - (lo + hi) / 2) * w;

/** 反行: 旋律と同じ向きに動くのと、旋律が動くのに止まっているのを嫌う（逆向きに 3 度動くほうが安くなる） */
function contraryExtra(c, { from: prev, m0, m1 }) {
  const md = m0 != null && m1 != null ? sign(m1 - m0) : 0;
  const cd = sign(c - prev);
  return (md && cd === md ? 8 : 0) + (!cd ? (md ? 6 : 3) : 0) + centerPull(c, REG.counterLow, REG.counterHigh, 0.3);
}

/** 和音の中での役割の好み: 3 度・7 度を好み、根音を嫌う */
function guideToneExtra(c, { b }) {
  const role = mod12(c - b.chord.root);
  return role === 0 ? 5 : role === FIFTH ? 2 : 0;
}

/** 合いの手: 旋律が ANSWER_GAP 以上あく所に 8 分音符で、小節の終わりの 4 分の隙間には 16 分音符 2 つで、和音をなぞる（旋律の最後の動きと逆向きに） */
function answerLine(bars) {
  let prev = REG.answerLow, last = null, beforeLast = null;   // 旋律の最後の 2 音
  for (const b of bars) {
    const line = emptyLine();
    const cands = chordTones(b.chord, REG.answerLow, REG.answerHigh);
    const on = leadOnsets(b.lead);
    // 隙間: [旋律の出だし, 次の出だし)。小節の頭が休みなら、頭からも
    const gaps = on.map((p, i) => [p, on[i + 1] ?? WHOLE, false]);
    if (!on.length || on[0] > 0) gaps.unshift([0, on[0] ?? WHOLE, true]);
    for (const [g0, g1, fromRest] of gaps) {
      if (!fromRest) { beforeLast = last; last = leadAt(b.lead, g0); }
      const step = g1 - g0 >= ANSWER_GAP ? EIGHTH : g1 === WHOLE && g1 - g0 >= QUARTER ? SIXTEENTH : 0;
      if (!step) continue;
      let dir = last != null && beforeLast != null && last !== beforeLast ? -sign(last - beforeLast) : -1;
      if (last != null) prev = last - FIFTH + (dir < 0 ? 4 : 0);   // 旋律の少し下から
      for (let p = fromRest ? g0 : g0 + EIGHTH; p + step <= g1; p += step) {
        if (!cands.some(c => sign(c - prev) === dir)) dir = -dir;   // 音域の端まで来たら折り返す
        const { c, ok } = pick(cands, { prev: null, from: prev, m1: leadAt(b.lead, p), side: 0, extra: c => (sign(c - prev) !== dir ? 6 : 0) + (c === prev ? 10 : 0) });
        if (!ok) continue;
        line[p] = { midi: c, len: step };
        if (sign(c - prev) === -dir) dir = -dir;   // 旋律に阻まれて逆へ動いたら、そのまま逆向きに続ける
        prev = c;
      }
    }
    b.lines.answer = line;
  }
}

/** 小節ごとの対旋律を作る（b.lines）。鳴らさない対旋律は消す */
function buildCounters(bars) {
  bars.forEach(b => (b.lines = {}));
  slotLine(bars, "contrary", {
    lo: REG.counterLow, hi: REG.counterHigh, start: REG.counterStart, side: -1, extra: contraryExtra,
    slots: b => (b.feel === "soft" ? [BEAT[1], BEAT[3]] : [BEAT[1], BEAT[2], BEAT[3], BEAT[4]]),
  });
  slotLine(bars, "descant", {
    lo: REG.descantLow, hi: REG.descantHigh, start: REG.descantStart, side: 1, tie: true,
    extra: (c, x) => guideToneExtra(c, x) * 0.5 + centerPull(c, REG.descantLow, REG.descantHigh, 0.5) + (c === x.from ? 2 : 0),
    slots: () => [BEAT[1], BEAT[3]],
  });
  slotLine(bars, "tenor", {
    lo: REG.tenorLow, hi: REG.tenorHigh, start: REG.tenorStart, side: -1, tie: true,
    extra: (c, x) => guideToneExtra(c, x) + centerPull(c, REG.tenorLow, REG.tenorHigh, 0.3) + (c === x.from ? 2 : 0) +
      (c === leadAt(x.b.lines.contrary, x.pos) ? 20 : 0),
    slots: () => [BEAT[1], BEAT[3]],
  });
  answerLine(bars);
  for (const b of bars) {
    for (const k of Object.keys(b.lines)) if (k !== "contrary" && !b.counters.includes(k)) delete b.lines[k];
  }
}

// ---------------------------------------------------------------- 曲の性格ごとの伴奏
// soft: C メロでコードの刻みを弱める割合

const STYLES = {
  normal: {
    inst: ["pulse25", "triangle", "8bit", "pulse12", "square", "pulse12", "strings", "fm-epiano", "triangle", "8bit", "ocarina", "marimba", "cello"],
    soft: 0.6,
    bass({ t, pos, root, s16, b }, voice) {
      if (b.feel === "soft") {
        // 2 分音符で伸ばし、4 拍目の裏に 5 度で次へつなぐ
        if (pos === BEAT[1] || pos === BEAT[3]) voice(t, HALF * GATE.staccato * s16, root);
        if (pos === RHYTHM.andOf4) voice(t, EIGHTH * GATE.tenuto * s16, root + FIFTH);
        return;
      }
      // 8 分でオクターブを行き来
      if (onEighth(pos)) voice(t, EIGHTH * s16 * GATE.short, onBeat(pos) ? root : root + OCTAVE);
    },
    drums({ t, pos, b }, kit) {
      if (b.first && pos === 0 && b.feel !== "soft") kit.crash(t);
      if (b.last && pos >= FILL.from) { rollSnare(kit, t, pos); return; }
      if (b.feel === "soft") {
        if (RHYTHM.softKick.includes(pos)) kit.kick(t, VEL.softKick);
        if (RHYTHM.backbeat.includes(pos)) kit.snare(t, VEL.softSnare);
        if (offBeat(pos)) kit.hat(t, true);
        return;
      }
      if (RHYTHM.popKick.includes(pos)) kit.kick(t);
      if (RHYTHM.backbeat.includes(pos)) kit.snare(t);
      if (onEighth(pos)) kit.hat(t, offBeat(pos));
    },
    arp({ t, pos, mid, s16, b }, voice) {
      if (b.feel === "soft") {
        if (onEighth(pos)) voice(t, s16 * EIGHTH * GATE.tenuto, mid[ARP.wave[pos / EIGHTH]]);
        return;
      }
      voice(t, s16 * SIXTEENTH * GATE.staccato, mid[ARP.upDown[pos % ARP.upDown.length]]);
    },
    comp({ t, pos, b, s16 }, voice) {
      // 裏拍で和音を刻む
      if (offBeat(pos)) chordMidis(b.chord, 0, REG.comp).forEach(m => voice(t, s16 * DOTTED_SIXTEENTH, m, b.feel === "soft" ? this.soft : 1));
    },
    perc({ t, pos, b }, kit) {
      if (b.feel === "soft") return;
      if (offSixteenth(pos)) kit.shaker(t);
      if (b.feel === "big" && RHYTHM.backbeat.includes(pos)) kit.clap(t);
    },
  },

  battle: {
    inst: ["pulse25", "triangle", "8bit", "pulse12", "square", "pulse12", "fm-brass", "square", "triangle", "8bit", "violin", "xylophone", "horn"],
    soft: 0.6,
    bass({ t, pos, s16, b }, voice) {
      const r = lowRoot(b, REG.battleBass);
      if (b.feel === "soft") { if (onEighth(pos)) voice(t, EIGHTH * s16 * GATE.short, r); return; }
      voice(t, s16 * GATE.drive, r + DRIVE[pos % DRIVE.length]);   // 16 分で刻む
    },
    drums({ t, pos, b }, kit) {
      if (b.first && pos === 0 && b.feel !== "soft") kit.crash(t);
      if (b.last && pos >= FILL.longFrom) {
        // フィル: タムを 2 つ下りて、スネアの 16 分連打
        if (pos === BEAT[3]) kit.tom(t, TOM.high);
        if (pos === BEAT[3] + EIGHTH) kit.tom(t, TOM.low);
        if (pos >= FILL.from) rollSnare(kit, t, pos);
        if (onBeat(pos)) kit.kick(t);
        return;
      }
      if (b.feel === "soft") {
        if (RHYTHM.halfTimeKick.includes(pos)) kit.kick(t, VEL.halfKick);
        if (pos === BEAT[3]) kit.snare(t, VEL.halfSnare);
        if (onEighth(pos)) kit.hat(t, false);
        return;
      }
      const kicks = b.feel === "big" ? RHYTHM.fourOnFloor : RHYTHM.syncoKick;
      if (kicks.includes(pos)) kit.kick(t);
      if (RHYTHM.backbeat.includes(pos)) kit.snare(t);
      kit.hat(t, offBeat(pos));
    },
    arp({ t, pos, mid, s16, b }, voice) {
      const up = [...mid, mid[0] + OCTAVE];
      if (b.feel === "soft") { if (onEighth(pos)) voice(t, s16 * EIGHTH * GATE.short, up[(pos / EIGHTH) % up.length]); return; }
      voice(t, s16 * SIXTEENTH * GATE.staccato, up[pos % up.length]);
    },
    comp({ t, pos, b, s16 }, voice) {
      // パワーコード（根音 + 5 度 + オクターブ）
      const r = lowRoot(b, REG.power);
      const chord = [r, r + FIFTH, r + OCTAVE];
      if (b.feel === "soft") { if (pos === 0) chord.forEach(m => voice(t, (WHOLE - SIXTEENTH) * s16, m, this.soft)); return; }
      if (b.feel === "big") { if (pos === BEAT[1] || pos === BEAT[3]) chord.forEach(m => voice(t, (HALF - SIXTEENTH) * s16, m)); return; }
      if (RHYTHM.powerStab.includes(pos)) chord.forEach(m => voice(t, s16 * SIXTEENTH * GATE.ring, m));
    },
    perc({ t, pos, b }, kit) {
      if (offSixteenth(pos)) kit.shaker(t);
      if (b.feel !== "soft" && RHYTHM.backbeat.includes(pos)) kit.clap(t);
    },
  },

  boss: {
    inst: ["pulse25", "synth-bass", "8bit", "pulse12", "square", "pulse12", "fm-organ", "brass", "triangle", "8bit", "choir", "pizzicato", "trombone"],
    soft: 0.7,
    bass({ t, pos, s16, b }, voice) {
      const r = lowRoot(b, REG.bossBass);
      // C メロ: 2 分音符を、次の音の 32 分手前まで伸ばす
      if (b.feel === "soft") { if (pos === BEAT[1] || pos === BEAT[3]) voice(t, (HALF - SIXTEENTH / 2) * s16, r); return; }
      // ギャロップ（タッ・タタ）で突き進む
      if (pos % QUARTER !== RHYTHM.gallopRest) voice(t, s16 * GATE.short, r + (pos % HALF === RHYTHM.gallopUp ? OCTAVE : 0));
    },
    drums({ t, pos, b, bar }, kit) {
      if (b.feel !== "soft" && pos === 0 && (b.first || bar % 2 === 0)) kit.crash(t);   // 2 小節ごとにシンバル
      if (b.last && pos >= FILL.longFrom) {
        kit.tom(t, TOM_RUN[pos - FILL.longFrom]);
        if (onEighth(pos)) kit.kick(t);
        return;
      }
      if (b.feel === "soft") {
        if (pos === BEAT[1]) kit.kick(t, VEL.bossSoftKick);
        if (pos === BEAT[3]) kit.snare(t, VEL.bossSoftSnare);
        if (pos === RHYTHM.andOf4) kit.tom(t, TOM.floor);
        if (onEighth(pos)) kit.hat(t, false);
        return;
      }
      // ツーバス（8 分で踏み続け、小節の最後の 16 分も踏む）+ 重いスネア + 裏のオープンハット
      if (onEighth(pos) || pos === WHOLE - 1) kit.kick(t, VEL.bossKick);
      if (RHYTHM.backbeat.includes(pos)) kit.snare(t, VEL.bossSnare);
      if (offBeat(pos)) kit.hat(t, true);
    },
    arp({ t, pos, mid, high, s16, b }, voice) {
      if (b.feel === "soft") { if (onEighth(pos)) voice(t, s16 * EIGHTH * GATE.tenuto, mid[(pos / EIGHTH) % mid.length]); return; }
      // 2 オクターブを 16 分で上下
      const run = [...mid, ...high.slice(0, 2)];
      const seq = [...run, ...run.slice(1, -1).reverse()];
      voice(t, s16 * SIXTEENTH * GATE.staccato, seq[pos % seq.length]);
    },
    comp({ t, pos, b, s16 }, voice) {
      const chord = chordMidis(b.chord, 0, REG.comp);
      if (b.feel === "soft") { if (pos === 0) chord.forEach(m => voice(t, (WHOLE - SIXTEENTH) * s16, m, this.soft)); return; }
      const len = RHYTHM.bossStab[pos];
      if (len) chord.forEach(m => voice(t, len * s16, m));
    },
    perc({ t, pos, b, bar }, kit) {
      if (b.feel === "soft") return;
      // 2 小節目ごとの最後の 2 つの 16 分に、タムの合いの手
      if (bar % 2 === 1 && pos >= RHYTHM.andOf4) kit.tom(t, pos === RHYTHM.andOf4 ? TOM.mid : TOM.floor);
      if (b.feel === "big" && pos === BEAT[4]) kit.clap(t);
    },
  },
};

// ---------------------------------------------------------------- 無調のところ
// 拍子感をぼかすため、決まった型ではなく、小節と位置から決まる不規則な位置で鳴らす

/** (bar × a + pos × b) を m で割った余りが below 未満の所で鳴らす（同じ小節なら毎回同じ位置になる） */
const scatter = (bar, pos, a, b, m, below) => (bar * a + pos * b) % m < below;

const FREE = {
  soft: 0.6,
  bass({ t, pos, s16, b }, voice) {
    const r = lowRoot(b, REG.bossBass);
    if (pos === 0) voice(t, (WHOLE - SIXTEENTH) * s16, r);
    if (pos === BEAT[3] + EIGHTH) voice(t, s16 * DOTTED_SIXTEENTH, r + TRITONE);   // 3 拍目の裏に、根音から三全音
  },
  drums({ t, pos, bar }, kit) {
    if (pos === 0) kit.kick(t, VEL.softKick);
    else if (scatter(bar, pos, 3, 5, 11, 2)) kit.tom(t, TOM_RUN[(bar + pos) % TOM_RUN.length]);
  },
  arp({ t, pos, mid, high, s16, bar }, voice) {
    if (!scatter(bar, pos, 1, 7, 5, 1)) return;
    const pool = [...mid, ...high];
    voice(t, s16 * EIGHTH, pool[(bar * 3 + pos) % pool.length]);
  },
  comp({ t, pos, b, s16 }, voice) {
    if (pos === 0) chordMidis(b.chord, 0, REG.comp).forEach(m => voice(t, (WHOLE - SIXTEENTH) * s16, m, this.soft));
  },
  perc({ t, pos, bar }, kit) {
    if (scatter(bar, pos, 7, 1, 9, 1)) kit.shaker(t);
  },
};

// ---------------------------------------------------------------- ソロ

/** ソロを弾く声部の番号と、そのあいだも伴奏で残す声部の番号（ほかは休む） */
const SOLOIST = { lead: 0, bass: 1, drums: 2, arp: 3, counter: 4 };
const ACCOMPANY = {
  lead: [1, 2, 3, 4, 6, 7, 9],   // バンド全員で支える（ハモリとオクターブ下は休んで、ソロを目立たせる）
  bass: [2, 6],                  // ドラムとパッドだけ
  drums: [9],                    // パーカッションだけ
  arp: [1, 2, 6],                // ベース・ドラム・パッド
  counter: [1, 2, 6, 7],         // ベース・ドラム・パッド・コードの刻み
};

/** ドラムソロ: 偶数小節はタムの合いの手、奇数小節はタムが駆け下りる。最後の小節はスネアの連打で次へ */
const DRUM_SOLO = { crashBars: [0, 4], rollVel: 0.08, rollStep: 0.015, ghostHat: 0.025 };
function drumSolo({ t, pos, b }, kit) {
  if (pos === 0 && DRUM_SOLO.crashBars.includes(b.index)) kit.crash(t);
  if (b.last) {
    if (onBeat(pos)) kit.kick(t);
    kit.snare(t, DRUM_SOLO.rollVel + pos * DRUM_SOLO.rollStep);
    return;
  }
  if (onBeat(pos)) kit.kick(t, VEL.bossKick);
  if (b.index % 2 === 0) {
    if (RHYTHM.backbeat.includes(pos)) kit.snare(t);
    if (pos === BEAT[2] + EIGHTH || pos === BEAT[2] + EIGHTH + SIXTEENTH) kit.tom(t, TOM.high);
    if (pos >= RHYTHM.andOf4) kit.tom(t, TOM.floor);
    if (offSixteenth(pos)) kit.hat(t, false, DRUM_SOLO.ghostHat);
  } else if (pos >= BEAT[3]) {
    kit.tom(t, TOM_RUN[pos - BEAT[3]]);
  } else {
    if (pos === BEAT[2]) kit.snare(t);
    if (onEighth(pos)) kit.hat(t, offBeat(pos));
  }
}

/** 楽譜 1 行の、pos に始まる音 → { midi, steps（16 分音符いくつ分） }。行は 8 分音符 8 個か 16 分音符 16 個 */
function noteIn(line, pos) {
  if (line.length === WHOLE) {
    const n = line[pos];
    return n && { midi: n.midi, steps: n.len };
  }
  const n = noteAt(line, pos);
  return n && { midi: n.midi, steps: n.len * EIGHTH };
}

// ---------------------------------------------------------------- 曲を組み立てる

export function makeSong({ mood = "normal", inst = {}, sections, ...rest }) {
  const style = STYLES[mood];
  const bars = sections.flatMap((sec, si) => {
    const feel = sec.feel ?? SECTION_FEELS[si] ?? "normal";
    return sec.chords.map((c, i) => ({
      section: sec.name,
      prog: sec.prog,
      mode: sec.mode,
      chord: parseChord(c),
      lead: parseLine(sec.lead[i]),
      feel,
      harmony: sec.harmony ?? si >= HARMONY_FROM,
      counters: sec.counters ?? FEEL_COUNTERS[feel],
      mood: sec.mood ?? mood,
      solo: sec.solo,
      index: i,
      first: i === 0,
      last: i === sec.chords.length - 1,
    }));
  });
  buildCounters(bars);

  const melody = (shift = 0) => ({ t, pos, b, s16 }, voice) => {
    const n = noteIn(b.lead, pos);
    if (n) voice(t, n.steps * s16 * GATE.melody, n.midi + shift);
  };
  // その小節の伴奏の型（無調なら FREE、そうでなければセクションの mood）の key 番の型で鳴らす
  const part = key => (x, out) => {
    const s = x.b.feel === "free" ? FREE : STYLES[x.b.mood];
    return s[key].call(s, x, out);
  };
  // b.lines の対旋律 key を鳴らす（そのセクションで使わない対旋律は b.lines に無い）
  const counter = (key, gate = GATE.legato) => ({ t, pos, b, s16 }, voice) => {
    const n = b.lines[key]?.[pos];
    if (n) voice(t, n.len * s16 * gate, n.midi);
  };
  const layers = [
    { name: "リード", pan: "C", vol: 0.12, play: melody() },
    { name: "ベース", pan: "C", vol: 0.28, play: part("bass") },
    { name: "ドラム", pan: "C", kit: true, play: part("drums") },
    { name: "アルペジオ", pan: "L", vol: 0.028, play: part("arp") },
    { name: "対旋律（反行）", pan: "R", vol: 0.035, play: counter("contrary") },
    { name: "ハモリ", pan: "L", vol: 0.05, play({ t, pos, b, s16 }, voice) {
      const n = b.harmony && noteIn(b.lead, pos);
      if (n) voice(t, n.steps * s16 * GATE.melody, harmonyBelow(n.midi, b.chord, 0));
    } },
    { name: "パッド", pan: "RR", vol: 0.02, play({ t, pos, mid, s16 }, voice) {
      if (pos === 0) mid.forEach(m => voice(t, WHOLE * s16 * GATE.full, m));
    } },
    { name: "コードの刻み", pan: "LL", vol: 0.025, play: part("comp") },
    { name: "リード（オクターブ下）", pan: "L", vol: 0.07, play: melody(-OCTAVE) },
    { name: "パーカッション", pan: "R", kit: true, play: part("perc") },
    { name: "高音のオブリガート", pan: "RR", vol: 0.035, play: counter("descant") },
    { name: "合いの手", pan: "LL", vol: 0.05, play: counter("answer", GATE.short) },
    { name: "低音の対旋律", pan: "L", vol: 0.04, play: counter("tenor") },
  ];
  layers.forEach((l, i) => {
    const name = inst[i] ?? style.inst[i];
    if (l.kit) l.kit = name; else l.inst = name;
    // ソロの小節: ソロを弾く声部は lead の旋律（ドラムはソロの型）、伴奏の声部はいつもどおり、ほかは休む
    const normal = l.play;
    const solo = l.kit ? drumSolo : melody();
    l.play = (x, out) => {
      const who = x.b.solo;
      if (!who) return normal(x, out);
      if (SOLOIST[who] === i) return solo(x, out);
      if (ACCOMPANY[who].includes(i)) return normal(x, out);
    };
  });

  return layeredSong({
    ...rest,
    mood,
    bars,
    layers,
    info: (b, x, n) => `${b.section}（${b.prog}）・ ${b.mode ? `${b.mode} ・ ` : ""}${n} 声部`,
  });
}
