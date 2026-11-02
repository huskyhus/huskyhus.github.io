// 戦闘曲 1 改: 戦闘曲 1（hustower-battle.js）の旋律を踏襲し、和声を見直して 140 小節に広げた版。イ短調 → 変ロ短調・160 BPM。
// かつての親友との闘い。A・B の旋律は原曲のまま、和音と編成を変えて何度も戻ってくる。
// 前奏 → A → B → A' → B' → シンコペーション → 裏拍 → A'' → B'' → C → ソロ → 掛け合い → A''' → B''' → カデンツ → つなぎ → 大サビ（半音上）→ A へ戻る。前奏は最初の 1 回だけ。
//
// コード進行は名前の付いた進行だけを使う（A メロの和音だけは例外。気に入っているのでそのまま）:
//   前奏: エオリアン終止（VI–VII–i）+ V7 / B: 短調のカノン進行の後半（iv–i–iv–V）+ エオリアン終止 + V
//   A': ロック進行（i–VII–VI–VII）+ 短調の循環 / B': 丸サ進行 / シンコペーション: エピック進行 + 短調の循環
//   裏拍: 小室進行 × 2 / C: アンダルシア進行 × 2 / ソロ: エピック進行 + 短調の循環 / 掛け合い: 王道進行 + ツーファイブワン
//   カデンツ: T–SD–D–T（i–iv–V7–i）× 2 / つなぎ: マイナークリシェ → V7 / 大サビ: B と同じ進行を半音上で
//   転調: F7 から半音上の変ロ短調へ。B♭7（E7 の裏コード）でイ短調へ半音下りて戻る
//
// 変奏の作り方: A・B で旋律を提示し、A'・B' では旋律はそのままに、対旋律を前に出す（ハモリとベルは休む）。対旋律は A''・B''・B'''・大サビで戻ってくる。
// C メロは原曲の旋律のまま、原曲にあったハモリ（和音の音）を戻し、和音を伸ばして支える。
//
// 濁りを避ける決めごと（tools/voices.mjs で点検する）:
//   - 分数コードの小節のパワーコードは、根音ではなく低音のオクターブを鳴らす
//   - エレピは和音の中で半音の塊を作らない（COMP）
//   - エコーは浅く（前の和音の音が次の和音の上に残って濁るため）。アルペジオと C メロは特に浅く
//
// 声部はスーパーハスタワーの編成（lib/superband.js）に、原曲の性格を作る 16 分のベース・ドラムの型・パワーコード・オクターブ下のリードを足す
import { makeLayers, superSong, shift, REST } from "../lib/superband.js";
import { chordMidis, harmonyBelow } from "../lib/theory.js";
import { noteAt } from "../lib/layers.js";

const AM = { tonic: 9, mode: "minor" };
const BBM = { tonic: 10, mode: "minor" };
const C_MAJOR = { tonic: 0, mode: "major" };

// ---------------------------------------------------------------- セクション（書き方は lib/superband.js）

/** 前奏: 同じ形の動機を 1 小節ごとに上げ、V7 から駆け下りて A メロの A4 へ着く */
const RIFF = {
  name: "前奏", prog: "VI△7–VII–i（エオリアン終止）–V7", key: AM, feel: "normal",
  chords: ["Fmaj7", "G", "Am", "E7"],
  lead: [
    "C5 . A4 C5 F5 . A5 G5",
    "D5 . B4 D5 G5 . F5 D5",
    "E5 . C5 E5 A5 . G5 E5",
    "D6 B5 G#5 E5 D5 B4 G#4 B4",
  ],
  comp: "auto",
};

const A = {
  name: "A メロ", prog: "i–v7⁶–iv7–VII / i–i7⁴₂–iv6⁶–V（後半の低音 A–G–F–E）", key: AM, feel: "normal",
  chords: ["Am", "Em7/G", "Dm7", "G", "Am", "Am7/G", "Dm6/F", "E"],
  lead: [
    "A4 . A4 C5 E5 . D5 C5",
    "B4 C5 D5 . E5 - . .",
    "F5 . E5 D5 C5 . D5 E5",
    "D5 - B4 - G4 . B4 D5",
    "A4 . A4 C5 E5 . A5 G5",
    "E5 . C5 . A4 . C5 E5",
    "F5 E5 D5 C5 D5 C5 B4 A4",
    "G#4 - B4 - E5 - . .",
  ],
  comp: "auto",
};

/** B''・B'''・大サビの、旋律の上で和音の音を長く伸ばすベル（B は旋律の提示なので鳴らさない） */
const B_BELL = [
  "A5 - - - - - . .",
  "C6 - - - - - - -",
  "D6 - - - - - . .",
  "E6 - - - - - - -",
  ". . . . C6 - . .",
  "D6 - - - - - - -",
  "C6 - - - E6 - - -",
  "E6 - - - - - - -",
];

/** 旋律の下で、旋律が伸ばしている間に動く対旋律（B' の線を、B の和音に合わせた形）。B''・B'''・大サビで戻ってくる */
const B_COUNTER = [
  "A4 - - - F4 - - -",
  "E4 - - - A4 - - -",
  "A4 - - - D5 - F5 -",
  "E5 - - - B4 - G#4 -",
  "A4 - - - C5 - - -",
  "B4 - - - D5 - B4 -",
  "C5 - - - E5 - - -",
  "B4 - - - - - . .",                 // 最後は早めに切る（エコーが次の和音の頭に残らないように）
];

const B = {
  name: "B メロ", prog: "iv–i–iv–V（短調のカノン進行の後半）/ VI–VII–i（エオリアン終止）–V", key: AM, feel: "big",
  chords: ["Dm", "Am", "Dm", "E", "F", "G", "Am", "E"],
  // 旋律は原曲のまま。この旋律に素直に乗る和音はこの 8 つ（原曲の和音と同じ）
  lead: [
    "D5 - - - F5 - A5 -",
    "G5 - E5 - - - C5 E5",
    "F5 - - - A5 - D6 -",
    "B5 - - - G#5 - E5 -",
    "C6 - - - A5 - F5 A5",
    "B5 - - - G5 - D5 G5",
    "A5 - E5 - C6 - B5 A5",
    "G#5 - - - B5 - - -",
  ],
  comp: "auto",
};

/** 旋律の上で、旋律と逆向きに動く対旋律。A' で前に出し、A'' で戻ってくる（A の和音にも乗る） */
const A_COUNTER = [
  "A5 - - - - - B5 C6",               // 次の小節の D6 へ、音階を上がってスラーでつなぐ
  "D6 - - - B5 - G5 -",
  "A5 - - - - - C6 -",
  "B5 - - - D6 - - C6",
  "C6 - - - - - E6 -",
  "C6 - - - A5 - - -",
  "A5 - - - - - D6 -",
  "B5 - - - - - . .",
];

/** A': 旋律は A と同じ（原曲のまま）。和音はロック進行 + 短調の循環。旋律の上で、旋律と逆向きに動く対旋律を前に出す */
const A2 = {
  name: "A' メロ", prog: "i–VII–VI–VII（ロック進行）/ i–VI–iv–V（短調の循環）", key: AM, feel: "normal",
  chords: ["Am", "G", "Fmaj7", "G", "Am", "Fmaj7", "Dm", "E"],
  lead: A.lead,
  counter: A_COUNTER,
  comp: "auto",
};

/** B': 丸サ進行。B と同じリズムで、E7 の小節など和音に合わない音だけを読み替える。旋律の下で、旋律が伸ばしている間に動く対旋律を前に出す */
const B2 = {
  name: "B' メロ（丸サ進行）", prog: "IV△7–III7–vi7–I7 / IV△7–III7–vi7–III7（ハ長調の度数）", key: AM, feel: "big",
  chords: ["Fmaj7", "E7", "Am7", "C7", "Fmaj7", "E7", "Am7", "E7"],
  lead: [
    "D5 - - - F5 - A5 -",
    "G#5 - E5 - - - B4 E5",
    "E5 - - - A5 - C6 -",
    "Bb5 - - - G5 - E5 -",
    "C6 - - - A5 - F5 A5",
    "B5 - - - G#5 - D5 G#5",
    "A5 - E5 - C6 - B5 A5",
    "G#5 - - - B5 - - -",
  ],
  counter: [
    "C5 - - - A4 - F4 -",
    "E4 - G#4 - - - - -",
    "A4 - - - C5 - E5 -",
    "E5 - - - Bb4 - G4 -",
    "A4 - - - C5 - A4 -",
    "G#4 - - - B4 - - -",
    "C5 - - - E5 - - -",
    "D5 - - - E5 - - -",
  ],
  comp: "auto",
};

/** シンコペーション: エピック進行 + 短調の循環。旋律は拍の裏から入って次の拍へまたぐだけ。後半は小節の終わりだけ少し動かす。伴奏はふだんの形で、目立たせない */
const SYNC = {
  name: "シンコペーション（エピック進行）", prog: "i–VI–III–VII（エピック進行）/ i–VI–iv7–V7（短調の循環）", key: AM, feel: "normal", comp: "auto",
  chords: ["Am", "F", "C", "G", "Am", "F", "Dm7", "E7"],
  lead: [
    ". A4 C5 E5 - D5 C5 -",
    ". A4 C5 F5 - C5 A4 -",
    ". G4 C5 E5 - D5 C5 -",
    ". B4 D5 G5 - D5 B4 -",
    ". C5 E5 A5 - G5 E5 -",
    ". C5 F5 A5 - C6 A5 -",
    ". D5 F5 A5 - C6 A5 F5",
    ". B4 E5 G#5 - B5 G#5 -",
  ],
};

/** 裏拍: 小室進行。旋律も伴奏（ベース・パワーコード・エレピ・ハット）も 8 分の裏。旋律は短く切って前に出さず、後半は音の高さだけ少し動かす */
const URA = {
  name: "裏拍（小室進行）", prog: "vi–IV–V–I × 2（ハ長調の度数）", key: AM, feel: "normal", comp: "auto", gate: 0.7,
  chords: ["Am", "F", "G", "C", "Am", "F", "G", "C"],
  lead: [
    ". A5 . E5 . C5 . E5",
    ". F5 . C5 . A4 . C5",
    ". D5 . B4 . G4 . B4",
    ". E5 . C5 . G4 . E5",
    ". E5 . C5 . A4 . C5",
    ". A5 . F5 . C6 . A5",
    ". G5 . D5 . B4 . D5",
    ". E5 . G5 . C6 . G5",
  ],
};

/** A'': 旋律と和音は A のまま、A' の対旋律とハモリを重ねて厚くする */
const A3 = { ...A, name: "A'' メロ", feel: "big", counter: A_COUNTER };

const B3 = { ...B, name: "B'' メロ", counter: B_COUNTER };

const C = {
  name: "C メロ（アンダルシア進行）", prog: "i–VII–VI–V7 × 2", key: AM, feel: "ballad", echo: 0.08,
  chords: ["Am", "G", "F", "E7", "Am", "G", "F", "E7"],
  // 旋律は原曲のまま
  lead: [
    "A5 - - - E5 - C5 E5",
    "D5 - - - B4 - G4 B4",
    "C5 - A4 - F4 - A4 C5",
    "B4 - G#4 - E4 - - .",
    "C5 . E5 . A5 - G5 A5",
    "B5 . G5 . D5 - B4 D5",
    "C6 - A5 - F5 - A5 C6",
    "B5 - - - G#5 - E5 -",
  ],
  // 和音の音だけを弾く（経過音は、伸びているサブベースやパワーコードと半音でぶつかる）。
  // 小節の終わりの音は、旋律と 5 度・8 度のまま次へ動かないように選ぶ
  bass: [
    "A2 - - - A1 - C3 -",
    "G2 - - - G1 - G2 -",
    "F2 - - - F1 - - A2",
    "E2 - - - B1 - E2 -",
    "A2 - - - A1 - A2 -",
    "G2 - - - G1 - G2 -",
    "F2 - - - F1 - - A2",
    "E2 - - - B1 - G#2 -",
  ],
  // エレピの和音（F3〜D4）を全音符で伸ばす。声部はどれも半音・全音で次へ移る。旋律が下りてくる 3・4 小節目も旋律より下
  comp: [
    ["A3", "C4", "E4"],
    ["G3", "B3", "D4"],
    ["F3", "A3", "C4"],
    ["G#3", "B3", "D4"],
    ["A3", "C4", "E4"],
    ["G3", "B3", "D4"],
    ["F3", "A3", "C4"],
    ["G#3", "B3", "D4"],
  ],
};

const SOLO = {
  name: "ソロ（リード）", prog: "i7–VI△7⁶–III–VII（エピック進行）/ i7–VI△7⁶–iv7–V7（短調の循環）", key: AM, feel: "normal", solo: true, comp: "auto",
  chords: ["Am7", "Fmaj7/A", "C", "G", "Am7", "Fmaj7/A", "Dm7", "E7"],
  lead: [
    "A4 C5 E5 G5 A5 - G5 E5 C5 - D5 E5 . G5 A5 .",
    "A5 - C6 E6 - C6 A5 - F5 A5 C6 - E6 - . .",
    "C6 - G5 E5 C5 - E5 G5 C6 - G5 E5 . D5 E5 .",
    "D6 - B5 G5 . B5 D6 - B5 G5 D5 G5 B5 D6 . .",
    "E6 - - . C6 - - . A5 - - . E5 - G5 -",        // 付点 8 分の区切り（拍とずれる）
    "C6 - A5 F5 C5 - F5 A5 C6 - D6 - A5 F5 C5 A4",
    "F5 - A5 C6 - . A5 - F5 - D5 E5 F5 - A5 -",
    "B4 D5 E5 G#5 B5 D6 E6 - D6 B5 G#5 - E5 - . .",
  ],
};

/** 平行長調の王道進行。E7 からの偽終止で入り、ここだけ明るくなる。リード → ベル → リードと対旋律の 3 度 → 3 人で和音 */
const TRADE = {
  name: "掛け合い（王道進行）", prog: "IV△7⁶–V–iii7–vi7（王道進行）/ ii7–V7–I△7（ツーファイブワン）–III7（イ短調の V7 へ）", key: C_MAJOR, feel: "big", trade: true, comp: "auto",
  chords: ["Fmaj7/A", "G", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "E7"],
  lead: [
    "A5 - C6 A5 G5 A5 C6 - E6 - C6 A5 G5 - A5 -",
    "B5 - G5 D5 E5 G5 B5 - D6 - B5 G5 . . . .",
    REST,
    REST,
    "A5 - F5 A5 C6 - A5 F5 D5 - F5 A5 C6 - D6 -",
    "B5 - G5 B5 D6 - B5 G5 F5 - G5 B5 D6 - C6 B5",
    "C6 - - . G5 - - . E5 - - . C5 - - .",
    "G#5 - . G#5 - . . . B5 - D6 - . . . .",
  ],
  counter: [
    REST,
    REST,
    REST,
    REST,
    "F5 - D5 F5 A5 - F5 D5 A4 - D5 F5 A5 - A5 -",
    "G5 - D5 G5 B5 - G5 D5 D5 - D5 G5 B5 - A5 D5",
    "E5 - - . C5 - - . G4 - - . E4 - - .",
    "B4 - . B4 - . . . E5 - G#5 - . . . .",
  ],
  bell: [
    REST,
    REST,
    "G5 - E5 B4 D5 E5 G5 - B5 - G5 E5 D5 - E5 -",     // リードの 1・2 小節目と同じ形で答える
    "C6 - A5 E5 G5 A5 C6 - E6 - C6 A5 . . . .",
    REST,
    REST,
    "G5 - - . E5 - - . C5 - - . G4 - - .",
    "E5 - . E5 - . . . G#5 - B5 - . . . .",
  ],
};

/** 掛け合いの続き（同じ王道進行）: 対旋律 → ベル → 1 小節ずつリード・対旋律・ベル → 3 人で */
const TRADE2 = {
  name: "掛け合い 2（王道進行）", prog: TRADE.prog, key: C_MAJOR, feel: "big", trade: true, comp: "auto",
  chords: TRADE.chords,
  lead: [
    REST,
    REST,
    REST,
    REST,
    "F5 A5 C6 D6 - . C6 A5 - . A5 F5 D5 - F5 -",
    REST,
    REST,
    "G#5 - . G#5 - . . . B5 - D6 - E6 - . .",
  ],
  counter: [
    "F4 - A4 C5 - F5 E5 C5 A4 - C5 F5 A5 - F5 -",
    "G4 - B4 D5 - G5 F5 D5 B4 - D5 G5 B5 - G5 -",
    REST,
    REST,
    REST,
    "D5 F5 G5 B5 - . G5 F5 - . F5 D5 B4 - D5 -",     // リードと同じリズムで答える
    REST,
    "B4 - . B4 - . . . E5 - G#5 - B5 - . .",
  ],
  bell: [
    REST,
    REST,
    "B5 - G5 E5 G5 B5 D6 - E6 - D6 B5 G5 - E5 -",
    "C6 - A5 E5 A5 C6 E6 - C6 - A5 G5 E5 - C5 -",
    REST,
    REST,
    "E5 G5 B5 C6 - . B5 G5 - . G5 E5 C5 - E5 -",     // リードと同じリズムで答える
    "E5 - . E5 - . . . G#5 - B5 - D6 - . .",
  ],
};

/** A''': 掛け合いのあと、薄い伴奏で主題に戻る */
const A4 = { ...A, name: "A''' メロ", feel: "soft" };

const B4 = { ...B, name: "B''' メロ", bell: B_BELL, counter: B_COUNTER };

/** カデンツ: 和声のいちばん基本の形 T（主和音）→ SD（下属和音）→ D（属和音）→ T を、そのまま 2 回。B の旋律の断片で歌い、E7 から Am へはっきり着く */
const CADENCE = {
  name: "カデンツ（T–SD–D–T）", prog: "i–iv7–V7–i × 2", key: AM, feel: "big", comp: "auto", noFill: true,
  chords: ["Am", "Dm7", "E7", "Am", "Am", "Dm7", "E7", "Am"],
  lead: [
    "A5 - E5 - C6 - B5 A5",
    "F5 - - - A5 - D6 -",
    "B5 - - - G#5 - E5 -",
    "A5 - - - E5 - C5 -",
    "C6 - - - A5 - E5 C6",
    "D6 - - - A5 - F5 -",
    "B5 - G#5 - E5 - G#5 B5",
    "A5 - - - - - - -",
  ],
};

/** つなぎ: 一度すべて引いて、C メロの頭を静かに歌う。マイナークリシェで下りて、F7（変ロ短調の V7）から半音上の調へ */
const BRIDGE = {
  name: "つなぎ（落ち）", prog: "i–i△7–i7（マイナークリシェ）–VI7（変ロ短調の V7）", key: AM, feel: "drop", comp: "auto", echo: 0.1,
  chords: ["Am", "AmM7/G#", "Am7/G", "F7"],
  lead: [
    "A5 - - - E5 - C5 E5",
    "G#5 - - - E5 - C5 E5",
    "G5 - - - E5 - C5 E5",
    "A5 - - - F5 - C5 Eb5",            // E♭ がそのまま大サビの頭の E♭ につながる
  ],
  bell: [
    "C6 - - - - - - -",
    "C6 - - - - - - -",
    "C6 - - - - - - -",
    "C6 - - - - - - -",
  ],
  bass: [
    "A2 - - - - - - -",
    "G#2 - - - - - - -",
    "G2 - - - - - - -",
    "F2 - - - - - - -",
  ],
};

/** 大サビ: B を半音上で。F7 → G♭ の偽終止で引き延ばし、最高音の F6 に着いてから、B♭7（E7 の裏コード）でイ短調の A へ半音下りる */
const B_TOP = {
  name: "大サビ（変ロ短調）", prog: "iv–i–iv–V / VI–VII–i（エオリアン終止）–V7 → VI–VII–i–I7（裏コード）", key: BBM, feel: "big", climax: true, comp: "auto",
  chords: ["Ebm", "Bbm", "Ebm", "F", "Gb", "Ab", "Bbm", "F7", "Gb", "Ab", "Bbm", "Bb7"],
  lead: [
    ...B.lead.slice(0, 5).map(l => shift(l, 1)),
    "C6 - - - Ab5 - Eb5 C6",
    shift(B.lead[6], 1),
    "A5 - - - C6 - A5 -",
    "Db6 - Bb5 - Gb5 - Bb5 Db6",
    "Eb6 - C6 - Ab5 - Bb5 C6",
    "F6 - - - - - Db6 Bb5",            // 曲でいちばん高い F6 は、ここで 1 回だけ
    "Bb5 - Ab5 F5 D5 - Bb4 -",         // B♭7 の上を駆け下り、B♭4 が A の頭の A4 へ半音で下りる
  ],
  bell: [...B_BELL.map(l => shift(l, 1)), REST, REST, REST, REST],
  counter: B_COUNTER.map(l => shift(l, 1)),
  bass: [null, null, null, null, null, null, null, null, null, null, "Bb1 - - - - - - -", "Bb1 - - - F2 - Bb1 -"],
};

export const SECTIONS = [RIFF, A, B, A2, B2, SYNC, URA, A3, B3, C, SOLO, TRADE, TRADE2, A4, B4, CADENCE, BRIDGE, B_TOP];

// ---------------------------------------------------------------- 声部（スーパーハスタワーの編成 + 原曲の性格）

/** 原曲のように前へ走るセクション（jazz・drop・intro は編成の型のまま） */
const driving = b => b.feel === "normal" || b.feel === "big";
const isUra = b => b.section === URA.name;
/** 対旋律が主役の変奏 */
const isCounterFeature = b => b.section === A2.name || b.section === B2.name;
/** 目立たせないセクション（クラッシュなし、パワーコードは控えめ、オクターブ下のリードなし） */
const isCalm = b => b.section === SYNC.name || isUra(b);
const band = makeLayers({ echo: 0.8 });   // リードのエコーは少し浅く（前の和音の音が次の和音に残らないように）
const layerOf = key => band.find(l => l.key === key);

/** 長い音をのっぺりさせない（superband の声部と同じ作り）: 付点 4 分以上はビブラート、4 分音符以上はずらした 2 本を重ねる */
const sung = (voice, t, dur, m, mul, steps, { vib = 0.012, cents = 7 } = {}) => {
  const opts = { attack: 0.015, release: Math.min(0.1, dur * 0.12) };
  if (vib && steps >= 6) opts.vib = vib;
  if (cents && steps >= 4) {
    voice(t, dur, m, mul * 0.62, { ...opts, detune: -cents });
    voice(t, dur, m, mul * 0.62, { ...opts, detune: cents });
  } else {
    voice(t, dur, m, mul, opts);
  }
};

/** 楽譜 1 行の、pos に始まる音（8 分音符の行も 16 分音符の行も）→ { midi, steps } */
const leadAt = (line, pos) => {
  if (line.length === 16) return line[pos] && { midi: line[pos].midi, steps: line[pos].len };
  const n = noteAt(line, pos);
  return n && { midi: n.midi, steps: n.len * 2 };
};

const BASS = {
  ...layerOf("bass"),
  name: "ベース（16 分）",
  play(x, voice) {
    const { t, pos, b, s16, bass } = x;
    if (!driving(b) || b.bassLine) { layerOf("bass").play(x, voice); return; }
    if (isUra(b)) {
      // 頭に短く低音を置き、8 分の裏をオクターブ上で刻む
      if (pos % 8 === 0) voice(t, s16 * 1.5, bass);
      if (pos % 4 === 2) voice(t, s16 * 1.5, bass + 12, 0.9);
      return;
    }
    voice(t, s16 * 0.75, bass + [0, 0, 12, 0][pos % 4], pos % 4 === 0 ? 1 : 0.8);
  },
};

const DRUMS = {
  ...layerOf("drums"),
  play(x, kit) {
    const { t, pos, b } = x;
    if (!driving(b) || b.climax) { layerOf("drums").play(x, kit); return; }
    if (b.first && pos === 0 && !isCalm(b)) kit.crash(t);
    if (b.last && pos >= 8 && !b.noFill) {
      // フィル: タムを 2 つ下りて、スネアの 16 分連打
      if (pos === 8) kit.tom(t, 200);
      if (pos === 10) kit.tom(t, 140);
      if (pos >= 12) kit.snare(t, 0.12 + (pos - 12) * 0.04);
      if (pos % 4 === 0) kit.kick(t);
      return;
    }
    const kicks = isUra(b) ? [0, 8] : b.feel === "normal" ? [0, 3, 8, 10, 11] : [0, 4, 8, 12, 14];
    if (kicks.includes(pos)) kit.kick(t);
    if (pos === 4 || pos === 12) kit.snare(t);
    if (isUra(b)) { if (pos % 4 === 2) kit.hat(t, true, 0.07); return; }   // ハットも裏だけ
    kit.hat(t, pos % 4 === 2, pos % 4 === 2 ? 0.06 : 0.03);
  },
};

/** エレピの和音の半音の塊をほどく: 根音との半音なら根音を省き（低音やほかの声部が持っている）、それ以外は下の音を 1 オクターブ上へ（E7(♯9) の G を G♯ の上に） */
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

const COMP = {
  ...layerOf("comp"),
  play(x, voice) {
    const { b } = x;
    if (!b.comp) return;
    const comp = unclustered(b.comp, b.chord.root).filter(m => ![1, 2].includes(m - (x.bass + 12)));   // ベースのオクターブ上の音と 2 度にしない
    layerOf("comp").play({ ...x, b: { ...b, comp } }, voice);
  },
};

const SUB = {
  ...layerOf("sub"),
  play(x, voice) {
    layerOf("sub").play(x, (t, dur, m, mul = 1, opts) => voice(t, dur, m, x.b.feel === "ballad" ? mul * 0.5 : mul, opts));
  },
};

/**
 * 対旋律のフレーズの区切り: { セクションの中の小節: [その音のあとで切る、行の中の番号] }。
 * A' は「ラーシドレー（切る）シソラードーシー（切る）レードドー（切る）ミードーララー（切る）レーシー」
 */
const A_CUTS = { 1: [0], 3: [0], 4: [0], 6: [0] };
const B_CUTS = { 1: [4], 5: [6] };
const COUNTER_CUTS = {
  [A2.name]: A_CUTS, [A3.name]: A_CUTS,
  [B2.name]: { 1: [2], 5: [4] },
  [B3.name]: B_CUTS, [B4.name]: B_CUTS, [B_TOP.name]: B_CUTS,
};

/**
 * 対旋律の歌い方（秒）: 基本はスラー気味に、次の音の頭まで消え際を伸ばして隙間を作らない（跳躍でも）。
 * 区切りの音（COUNTER_CUTS）は CUT_GAP だけ切る。同じ音が続く所は REPEAT_GAP だけ空けて弾き直す。
 * どの音も速く立ち上げ、頭に短いアクセントを足す
 */
const TONGUE_ATTACK = 0.006, TONGUE_RELEASE = 0.02, TONGUE_OVERLAP = TONGUE_RELEASE;
const CUT_GAP = 0.07, REPEAT_GAP = 0.03, CUT_RELEASE = 0.015;
const ACCENT = 0.25, ACCENT_LENGTH = 0.05;

/**
 * 対旋律: 変奏（A'・B'）では前に出し、A''・B''・B'''・大サビでも聞こえるようにする。旋律の上を動く所もあるので、点検ではオブリガートとして扱う。
 * 掛け合い以外は、上の歌い方で弾く（音程は滑らせない）。音はずらさず 1 本で鳴らす
 * （高い音域で 2 本をずらすと、1 秒に 7 回ほどの速いうねりになって途切れて聞こえる。短い音との音量の段差もなくなる）。
 */
const COUNTER = {
  ...layerOf("counter"),
  role: "descant",
  play(x, voice, fx) {
    const { b, pos, s16 } = x;
    const boost = isCounterFeature(b) ? 2.2 : b.trade ? 1 : 1.5;
    const n = !b.trade && b.counter ? leadAt(b.counter, pos) : null;
    if (!n) {
      layerOf("counter").play(x, (t, dur, m, mul = 1, opts) => voice(t, dur, m, mul * boost, opts), fx);
      return;
    }
    const end = pos + n.steps, unit = b.counter.length === 16 ? 1 : 2;
    const after = end < 16 ? b.counter[end / unit] : b.next?.counter?.[0];
    const marked = COUNTER_CUTS[b.section]?.[b.index]?.includes(pos / unit);
    const gap = !after ? 0 : marked ? CUT_GAP : after.midi === n.midi ? REPEAT_GAP : 0;
    layerOf("counter").play(x, (t, dur, m, mul = 1, opts = {}) => {
      // 編成の声部が 2 本で鳴らす音は、1 本目だけを元の音量で鳴らす
      if (opts.detune > 0) return;
      const level = (opts.detune != null ? mul / 0.62 : mul) * boost;
      const o = { ...opts, attack: TONGUE_ATTACK };
      delete o.detune;
      delete o.slideFrom;
      delete o.slideTime;
      if (after) o.release = gap ? CUT_RELEASE : TONGUE_RELEASE;
      const full = n.steps * s16;
      voice(t, !after ? dur : gap ? full - gap : full + TONGUE_OVERLAP, m, level, o);
      voice(t, ACCENT_LENGTH, m, level * ACCENT, { attack: 0.002, release: 0.03 });
    }, fx);
  },
};

/** ハモリ: 対旋律が鳴るセクションでは譲る（同じ音域で重なる）。C メロは原曲と同じ、和音の音だけのハモリ */
const HARMONY = {
  ...layerOf("harmony"),
  play(x, voice, fx) {
    const { t, pos, b, s16 } = x;
    if (b.counter) return;
    const n = leadAt(b.lead, pos);
    if (b.section !== C.name) {
      // 伸ばす音（4 分音符以上）は和音の音でハモる（Dm の上の D に音階どおりの B を当てると、和音の F と三全音になって引っかかる）
      const long = n && n.steps >= 4;
      layerOf("harmony").play(x, (t, dur, m, mul, opts) => voice(t, dur, long ? harmonyBelow(n.midi, b.chord, 0) : m, mul, opts), fx);
      return;
    }
    if (n) sung(voice, t, n.steps * s16 * 0.92, harmonyBelow(n.midi, b.chord, 0), 1.4, n.steps, { vib: 0.008, cents: 0 });
  },
};

/** アルペジオのエコーは特に浅く（細かい音が次の和音の上にたくさん残る） */
const ARP = { ...layerOf("arp"), echo: { ...layerOf("arp").echo, wet: 0.09 } };

const POWER = {
  key: "power", name: "パワーコード", pan: "R", inst: "fm-marimba", vol: 0.025, reverb: 0.18,
  play({ t, pos, b, s16, bass }, voice) {
    if (b.feel === "intro" || b.feel === "drop" || b.feel === "soft") return;
    if (b.climax && b.index >= b.count - 2) return;   // 大サビの終わりは止める
    const r = chordMidis(b.chord, 0, 40, 11)[0];   // E2〜D♯3（エレピの窓より下）
    // 根音 + 5 度 + オクターブ（ø の小節は減 5 度）。分数コードは低音のオクターブだけ（根音を低音の近くで鳴らすと濁る）。中音域には入らない
    const chord = (b.chord.bass != null ? [bass + 12, bass + 24] : [r, r + b.chord.tones[2], r + 12]).filter(m => m < 60);
    if (b.feel === "ballad") {
      if (pos === 0) chord.forEach(m => sung(voice, t, 15 * s16, m, 0.6, 15, { vib: 0.006, cents: 5 }));
    } else if (b.feel === "big") {
      if (pos === 0 || pos === 8) chord.forEach(m => sung(voice, t, 7 * s16, m, 1, 7, { vib: 0.006, cents: 5 }));
    } else if (isUra(b)) {
      if (pos % 4 === 2) chord.forEach(m => voice(t, s16 * 1.5, m, 0.6));
    } else if ([0, 3, 6, 10, 12].includes(pos)) {
      chord.forEach(m => voice(t, s16 * 1.2, m, isCalm(b) ? 0.6 : 1));
    }
  },
};

const DOUBLE = {
  key: "double", name: "リード（オクターブ下）", pan: "L", inst: "triangle", vol: 0.07, reverb: 0.15,
  echo: { steps: 3, feedback: 0.2, wet: 0.08 },
  play({ t, pos, b, s16 }, voice) {
    if (b.feel !== "normal" || b.solo || isCalm(b)) return;
    const n = leadAt(b.lead, pos);
    if (n) sung(voice, t, n.steps * s16 * 0.92, n.midi - 12, 1, n.steps, { vib: 0.01, cents: 5 });
  },
};

export const LAYERS = [...band.map(l => ({ harmony: HARMONY, counter: COUNTER, arp: ARP, bass: BASS, sub: SUB, drums: DRUMS, comp: COMP })[l.key] ?? l), POWER, DOUBLE];

/** タメ: 前奏の最後の小節の後半でテンポを落とし（16 分音符の位置 → 倍率）、A メロの頭で元に戻す */
const TAME_BAR = RIFF.chords.length - 1;
const TAME = { 8: 0.95, 10: 0.88, 12: 0.78, 14: 0.66 };

const SONG = superSong({
  title: "戦闘曲 1 改「ハスタワー」",
  description: "かつての親友との闘い。戦闘曲 1 の旋律を踏襲し、名前の付いた進行だけで 140 小節に広げた版（A メロの和音だけ例外）。イ短調 → 変ロ短調・160 BPM。前奏 → A → B → A'（ロック進行）→ B'（丸サ進行）→ シンコペーション（エピック進行）→ 裏拍（小室進行）→ A'' → B'' → C（アンダルシア進行）→ ソロ → 掛け合い（王道進行）→ A''' → B''' → カデンツ（T–SD–D–T）→ つなぎ → 半音上の大サビ → A へ。前奏は最初の 1 回だけ。",
  bpm: 160,
  sections: SECTIONS,
  loopFrom: 1,
  layers: LAYERS,
});

export default {
  ...SONG,
  mood: "battle",
  step(at, ctx) {
    if (at.bar === TAME_BAR && at.pos === 8) ctx.state.tameFrom = ctx.bpm;
    if (at.bar === TAME_BAR && ctx.state.tameFrom && at.pos in TAME) ctx.setBpm(ctx.state.tameFrom * TAME[at.pos]);
    if (at.bar === TAME_BAR + 1 && at.pos === 0 && ctx.state.tameFrom) {
      ctx.setBpm(ctx.state.tameFrom);
      ctx.state.tameFrom = null;
    }
    SONG.step(at, ctx);
  },
};
