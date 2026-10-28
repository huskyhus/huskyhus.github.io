// 調律の刻「本番合奏」の諸民版（前の版）: ハ調・112 BPM・64 小節。
// 光（ハ長調）と影（ハ短調）が、旋律・音階・和音の 3 つの方法で共存し、諸民（琉球・和・ガムラン・砂漠）も加わる。
// 最初から最後まで、光と影は必ず同時に鳴っている（長短混在が全体に続く）。
//
//   序奏     C と Cm が振り子のように交互に。光のミと影のミ♭が一音ずつ。時計の刻む音
//   1 番     光が主題（ハスタワーの旋律）を歌い、影が下で対旋律を伸ばす
//            4・7 小節目は影の和音 Fm にして、主題もその小節だけ影の色（ラ♭・ミ♭）に
//   2 番     影が主題を同主短調で歌い、光が上で対旋律を伸ばす
//            4・7 小節目は光の和音 F（短調の中のドリアンの IV）にして、主題もその小節だけ光の色（ラ・ミ）に
//   諸民の歌 主題が 2 小節ずつ、琉球 → 和（都節）→ ガムラン（スレンドロ）→ 砂漠（ヒジャーズ）の民へ受け渡される
//            その下で、琉球では光のミ、和では影のラ♭、砂漠では両方を同時に伸ばす
//            ヒジャーズは長調のミと短調のラ♭・シ♭を両方持つ音階で、次の 3 番への橋渡し
//   3 番     光と影の旋律を同時に（対位法）。和音はハーモニック・メジャー（長調 + ラ♭）から
//            光がラ♭（影の音）を、影がミ・シ（光の音）を歌い、色の音を受け渡す。ミとミ♭のような音は同じ瞬間に鳴らさない
//   合奏     光と影がオクターブのユニゾンで 1 つの旋律に。諸民も和音の上で、それぞれのリズムで
//   終止     ♭VI → ♭VII（影の和音）で上りつめ、C7(♯9) で光のミと影のミ♭を同時に鳴らしてから C へ
//   後奏     光と影が交互に答え合い、静かに C で終わる
import { parseChord, parseLine, chordMidis } from "../lib/theory.js";
import { layeredSong, noteAt } from "../lib/layers.js";
import { REST, toParallelMinor, toHarmonicMinor, transposeLine } from "../lib/compose.js";
import { ETHNIC_SCALES, mapNote } from "../lib/ethnic.js";

const C = 0;

// 光の主題（ハスタワーの A メロ）
const THEME = [
  "C5 . G4 C5 E5 . D5 C5",
  "D5 . B4 G4 D5 - . .",
  "E5 . C5 A4 E5 F5 E5 D5",
  "C5 - A4 - C5 . D5 .",
  "C5 . G4 C5 E5 . G5 E5",
  "F5 . D5 B4 G5 - F5 E5",
  "D5 . C5 A4 F5 E5 D5 C5",
  "D5 . . B4 G4 . . .",
];
// 1 番・2 番で、相手の色に染める小節（4・7 小節目）
const MINOR_BARS = [3, 6];

const ensemble = [
  "C6 - A5 - F5 - A5 C6",
  "D6 - B5 - G5 - B5 D6",
  "E6 - D6 - B5 - G5 B5",
  "C6 - - - A5 - E5 -",
  "F5 . Ab5 . C6 - Eb6 C6",
  "Bb5 . D6 . F6 - D6 Bb5",
  "E6 - - - C6 - G5 -",
  "C6 - - - - - . .",
];
const cadence = [
  "C6 - - - Eb6 - - -",
  "D6 - - - F6 - - -",
  "Eb6 - C6 - Ab5 - C6 -",
  "F6 - D6 - Bb5 - D6 -",
  "Ab5 - - - C6 - F6 -",
  "G5 - B5 - D6 - F6 -",
  "E6 - - - - - - -",
  "C6 - - - - - - -",
];
const coda = [
  "G5 - - - E5 - - -",
  "Ab5 - - - F5 - - -",
  "E5 - - - C5 - - -",
  "Eb5 - - - C5 - - -",
  "E5 - G5 - C6 - - -",
  "D6 - - - Bb5 - - -",
  "C6 - - - - - - -",
  "C5 - - - - - . .",
];

// 諸民の歌で、主題を受け渡す順番（2 小節ずつ）
const PEOPLES = ["ryukyu", "wa", "gamelan", "desert"];
const PEOPLE_SCALE = { ryukyu: "ryukyu", wa: "in", gamelan: "slendro", desert: "hijaz" };
const PEOPLE_NAME = { ryukyu: "琉球の民", wa: "和の民", gamelan: "ガムランの民", desert: "砂漠の民" };

/**
 * セクション。light / shadow は光・影の旋律（null なら休み）
 * play: どの声部群が鳴るか（light: 光の伴奏 / shadow: 影の伴奏 / peoples: "melody"（主題）・"chords"（和音の上で）/ drums の強さ / tick: 時計の音）
 */
const SECTIONS = [
  {
    name: "序奏「刻の訪れ」", mode: "ハ長調 ⇄ ハ短調",
    chords: ["C", "C", "Cm", "Cm", "C", "C", "Cm", "G"],
    // C の小節では光がミを、影が下で共通の音（ド・ソ）を。Cm の小節では影がミ♭を、光が上で共通の音を
    light: ["E5 - - - - - - -", "G5 - - - - - - -", "G5 - - - - - - -", "C6 - - - - - - -", "E5 - - - G5 - - -", "C6 - - - - - - -", "G5 - - - - - - -", "D5 - - - B4 - - -"],
    shadow: ["C4 - - - - - - -", "G3 - - - - - - -", "Eb4 - - - - - - -", "C4 - - - - - - -", "C4 - - - - - - -", "G3 - - - - - - -", "Eb4 - - - G4 - - -", "D4 - - - G3 - - -"],
    play: { drone: true, tick: true },
  },
  {
    name: "1 番「光が歌い、影が支える」", mode: "ハ長調 + 影の和音",
    chords: ["C", "G", "Am", "Fm", "C", "G", "Fm", "G"],
    light: THEME.map((l, i) => (MINOR_BARS.includes(i) ? toParallelMinor(l, C) : l)),
    shadow: [
      "G3 - - - C4 - - -",
      "G3 - - - D4 - - -",
      "C4 - - - A3 - - -",
      "Ab3 - - - F3 - C4 -",
      "E4 - - - G3 - - -",
      "D4 - - - B3 - - -",
      "F3 - - - Ab3 - C4 -",
      "G3 - - - B3 - D4 -",
    ],
    play: { light: true, shadow: true, drums: "normal" },
  },
  {
    name: "2 番「影が歌い、光が支える」", mode: "ハ短調 + 光の和音",
    chords: ["Cm", "G", "Ab", "F", "Cm", "G", "F", "G"],
    light: [
      "G5 - - - C6 - - -",
      "B5 - - - D6 - - -",
      "C6 - - - Ab5 - - -",
      "A5 - - - C6 - - -",
      "G5 - - - C6 - - -",
      "B5 - - - D6 - - .",
      "C6 - - - A5 - - -",
      "B5 - - - G5 - - -",
    ],
    // 和声的短音階で（G の和音の上ではシのまま。光の対旋律のシともぶつからない）
    shadow: THEME.map((l, i) => (MINOR_BARS.includes(i) ? l : toHarmonicMinor(l, C))),
    play: { light: "soft", shadow: true, heart: "half" },
  },
  {
    name: "諸民の歌", mode: "琉球 → 和 → ガムラン → 砂漠",
    // 琉球では光のミ（影は共通のソ）、和では影のラ♭（光は共通のド）、ガムランでは両方がド
    // （スレンドロと 12 音で、ぴったり同じ高さなのはドだけ）、砂漠では両方の色（ラ♭・ド・ミ = A♭aug）を伸ばす
    chords: ["C", "C", "Fm", "Fm", "C", "C", "Abaug", "Abaug"],
    light: ["E4 - - - - - - -", "E4 - - - - - - -", "C5 - - - - - - -", "C5 - - - - - - -", "C5 - - - - - - -", "C5 - - - - - - -", "E4 - - - - - - -", "E4 - - - - - - -"],
    shadow: ["G3 - - - - - - -", "G3 - - - - - - -", "Ab3 - - - - - - -", "Ab3 - - - - - - -", "C4 - - - - - - -", "C4 - - - - - - -", "Ab3 - - - - - - -", "Ab3 - - - - - - -"],
    play: { peoples: "melody", drone: true },
  },
  {
    name: "3 番「二つの主題」", mode: "ハーモニック・メジャー（長調 + ラ♭）",
    chords: ["C", "Fm", "Em", "Abaug", "Dm7b5", "G7", "C", "Bdim7"],
    light: [
      "E5 - G5 - C6 - B5 G5",
      "Ab5 - - - F5 - C5 -",
      "B5 - G5 - E5 - - .",
      "C6 - - - E5 - Ab5 -",
      "F5 - - - D5 - Ab5 -",
      "G5 - B5 - D6 - - .",
      "C6 - - - G5 - E5 -",
      "D6 - - - B5 - Ab5 -",
    ],
    shadow: [
      ". . C4 - G4 - - .",
      "F4 - Ab4 - C5 - - .",
      ". . B3 - E4 - G4 -",
      "Ab4 - - - C4 - - .",
      "D4 - F4 - Ab4 - - .",
      "F4 - - - B3 - D4 -",
      "G4 - - - E4 - C4 -",
      "F4 - - - Ab4 - B3 -",
    ],
    play: { light: "soft", shadow: true, drums: "soft", heart: "soft" },
  },
  {
    name: "合奏", mode: "長短混在",
    chords: ["F", "G", "Em", "Am", "Fm", "Bb", "C", "C"],
    light: ensemble, shadow: ensemble.map(l => transposeLine(l, -12)),
    play: { light: true, shadow: true, peoples: "chords", drums: "big", heart: "soft" },
  },
  {
    name: "調律の終止", mode: "♭VI–♭VII → C7(♯9) → C",
    chords: ["Ab", "Bb", "Ab", "Bb", "Fm", "G7", "C7#9", "C"],
    light: cadence,
    // C7(♯9) の小節で、影は光のミの下でミ♭を伸ばす（長 3 度と短 3 度が同時に鳴る）
    shadow: [...cadence.slice(0, 6).map(l => transposeLine(l, -12)), "Eb5 - - - - - - -", "C5 - - - - - - -"],
    play: { light: true, shadow: true, peoples: "chords", drums: "big", heart: "soft" },
  },
  {
    name: "後奏", mode: "ハ長調（影の和音を含む）",
    chords: ["C", "Fm", "C", "Ab", "C", "Bb", "C", "C"],
    light: coda,
    // 影の和音（Fm・A♭・B♭）の小節は同じ旋律で答え、C の小節では下で共通の音を伸ばす。最後は 2 人でドに着く
    shadow: [
      "C4 - - - G3 - - -", transposeLine(coda[1], -12),
      "G3 - - - C4 - - -", transposeLine(coda[3], -12),
      "C4 - - - G3 - - -", transposeLine(coda[5], -12),
      transposeLine(coda[6], -12), "C4 - - - - - . .",
    ],
    play: { drone: true, peoples: "soft" },
  },
];

const BARS = SECTIONS.flatMap(sec => sec.chords.map((c, i) => ({
  section: sec.name,
  mode: sec.mode,
  name: c.replace("b5", "(♭5)").replace("#9", "(♯9)").replace(/^([A-G])b/, "$1♭"),
  chord: parseChord(c),
  light: sec.light ? parseLine(sec.light[i]) : null,
  shadow: sec.shadow ? parseLine(sec.shadow[i]) : null,
  // 諸民の歌: 主題を 2 小節ずつ、各地の音階に置き換えて
  people: sec.play.peoples === "melody" ? PEOPLES[Math.floor(i / 2)] : null,
  theme: parseLine(THEME[i]),
  play: sec.play,
  index: i,
  first: i === 0,
  last: i === sec.chords.length - 1,
})));

/** 旋律 1 行を鳴らす */
const sing = (line, shift = 0) => ({ t, pos, s16 }, voice) => {
  const n = line && noteAt(line, pos);
  if (n) voice(t, n.len * 2 * s16 * 0.92, n.midi + shift);
};

/** 諸民の声部: 諸民の歌では自分の 2 小節だけ主題を、合奏・終止・後奏では和音の上で自分のリズムを */
const people = (who, chordsPart) => (x, voice) => {
  const { b } = x;
  if (b.people === who) {
    const n = noteAt(b.theme, x.pos);
    if (n) voice(x.t, n.len * 2 * x.s16 * 0.92, mapNote(n.midi, ETHNIC_SCALES[PEOPLE_SCALE[who]]));
  } else if (b.play.peoples === "chords" || (b.play.peoples === "soft" && x.pos % 8 === 0)) {
    chordsPart(x, voice);
  }
};

const LAYERS = [
  // ---------------------------------------------------------------- 光
  { name: "光の旋律", pan: "C", inst: "pulse25", vol: 0.12, play: (x, v) => sing(x.b.light)(x, v) },
  { name: "光のベース", pan: "C", inst: "triangle", vol: 0.26, play({ t, pos, root, s16, b }, voice) {
    if (!b.play.light || pos % 2) return;
    if (b.play.light === "soft") { if (pos % 8 === 0) voice(t, 7 * s16, root); return; }
    voice(t, 2 * s16 * 0.8, pos % 4 === 0 ? root : root + 12);
  } },
  { name: "光のドラム", pan: "C", kit: "8bit", play({ t, pos, b }, kit) {
    const d = b.play.drums;
    if (!d) return;
    if (d === "big" && b.first && pos === 0) kit.crash(t);
    if (b.last && pos >= 12) { kit.snare(t, 0.12 + (pos - 12) * 0.04); return; }
    if (d === "soft") {
      if (pos === 0 || pos === 8) kit.kick(t, 0.5);
      if (pos === 4 || pos === 12) kit.snare(t, 0.14);
      if (pos % 4 === 2) kit.hat(t, true);
      return;
    }
    if (pos === 0 || pos === 8 || pos === 10) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    if (pos % 2 === 0) kit.hat(t, pos % 4 === 2);
  } },
  { name: "光のアルペジオ", pan: "L", inst: "pulse12", vol: 0.026, play({ t, pos, mid, s16, b }, voice) {
    if (b.play.light) voice(t, s16 * 0.7, mid[[0, 1, 2, 1][pos % 4]]);
  } },

  // ---------------------------------------------------------------- 影
  { name: "影の旋律", pan: "R", inst: "strings", vol: 0.13, play: (x, v) => sing(x.b.shadow)(x, v) },
  { name: "影の低い弦", pan: "LL", inst: "strings", vol: 0.06, play({ t, pos, b, s16 }, voice) {
    if (pos !== 0 || !(b.play.shadow || b.play.drone)) return;
    // 序奏・諸民の歌・後奏では、みんなの足もとになるドの持続音
    const r = b.play.shadow ? chordMidis(b.chord, 0, 36, 11)[0] : 36;
    [r, r + 7].forEach(m => voice(t, 16 * s16 * 0.98, m));
  } },
  { name: "影のコーラス", pan: "RR", inst: "fm-organ", vol: 0.02, play({ t, pos, mid, s16, b }, voice) {
    if (b.play.shadow && pos === 0) mid.forEach(m => voice(t, 16 * s16 * 0.98, m + 12));
  } },
  { name: "影の鼓動", pan: "C", kit: "acoustic", play({ t, pos, b }, kit) {
    const h = b.play.heart;
    if (h === "half") {
      if (pos === 0) kit.kick(t, 0.7);
      if (pos === 8) kit.snare(t, 0.2);
      if (pos === 14) kit.tom(t, 120);
    } else if (h === "soft" && (pos === 0 || pos === 3)) {
      kit.kick(t, 0.45);   // 光のドラムの下で、心臓のように「ドッ・ドッ」
    }
  } },

  // ---------------------------------------------------------------- 諸民
  { name: PEOPLE_NAME.ryukyu, pan: "L", inst: "guitar", vol: 0.06, play: people("ryukyu", ({ t, pos, mid, s16 }, voice) => {
    if (pos % 4 === 2) voice(t + s16 * 0.67, s16 * 1.2, mid[(pos >> 2) % mid.length] + 12);   // 三線: 跳ねる裏拍
  }) },
  { name: PEOPLE_NAME.wa, pan: "LL", inst: "harp", vol: 0.06, play: people("wa", ({ t, pos, mid, s16 }, voice) => {
    const k = { 0: 0, 2: 1, 4: 2 }[pos % 8];                                                // 箏: テン・トン・シャン
    if (k !== undefined) voice(t, s16 * 3, mid[k % mid.length]);
  }) },
  { name: PEOPLE_NAME.gamelan, pan: "RR", inst: "glocken", vol: 0.03, play: people("gamelan", ({ t, pos, high, s16 }, voice) => {
    // コテカン: 表と裏で 2 人が交互に
    const k = pos % 2 === 0 ? [0, 1][(pos >> 1) % 2] : [2, 1][(pos >> 1) % 2];
    voice(t, s16 * 0.9, high[k % high.length]);
  }) },
  { name: PEOPLE_NAME.desert, pan: "R", inst: "flute", vol: 0.07, play: people("desert", ({ t, pos, high, s16, b }, voice) => {
    // ネイ（笛）が、小節の後半に和音の音を駆け下りる
    if (b.index % 2 === 1 && pos >= 12) voice(t, s16 * 0.9, [...high].reverse()[(pos - 12) % high.length]);
  }) },
  { name: "諸民の打楽器", pan: "R", kit: "acoustic", play({ t, pos, b }, kit) {
    const who = b.people;
    if (who === "ryukyu") { if (pos === 4 || pos === 12) kit.tom(t, 260); if (pos % 4 === 2) kit.hat(t, false, 0.05); }
    if (who === "wa") { if (pos === 0) kit.tom(t, 90, 0.45); if (pos === 4 || pos === 12) kit.hat(t, false, 0.06); }
    if (who === "gamelan") { if (pos === 0 || pos === 8) kit.tom(t, 110, 0.35); if ([3, 6, 11, 14].includes(pos)) kit.tom(t, 210, 0.25); }
    if (who === "desert" || b.play.peoples === "chords") {
      // マクスーム: ドゥム・テク・・テク・ドゥム・・テク・
      if (pos === 0 || pos === 8) kit.tom(t, 95, 0.35);
      if (pos === 2 || pos === 6 || pos === 12) kit.snare(t, 0.08);
    }
  } },
  { name: "刻の音（時計）", pan: "C", kit: "8bit", play({ t, pos, b }, kit) {
    if (b.play.tick && pos % 4 === 0) kit.hat(t, false, pos === 0 ? 0.08 : 0.05);
  } },
];

export default layeredSong({
  title: "調律の刻「本番合奏」（諸民版）",
  description: "ステージ 12 の曲。ハ調・112 BPM・64 小節。光（ハ長調）と影（ハ短調）が、旋律（対位法）・音階（ハーモニック・メジャー、ヒジャーズ）・和音（C7(♯9)）の 3 つの方法で共存し、琉球・和・ガムラン・砂漠の民も加わる。",
  mood: "boss",
  bpm: 112,
  bars: BARS,
  layers: LAYERS,
  info: b => `${b.section} ・ ${b.people ? `${PEOPLE_NAME[b.people]}（${ETHNIC_SCALES[PEOPLE_SCALE[b.people]].name}）` : `${b.name}（${b.mode}）`}`,
});
