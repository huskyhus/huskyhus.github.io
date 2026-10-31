// 通常曲 1 の決定版「スーパーハスタワー」。
// イントロ → A → B（サビ）→ A'（2 番の変奏）→ C（丸サ進行）→ 大サビ（半音上の変ニ長調）→ A へ戻る。イントロは最初の 1 回だけ。
//
// 原曲（hustower-massive.js）からの作り直し:
//   - 声部ごとに受け持つ音域を分け、セクションごとに鳴らす声部を変える（A は薄く、サビで厚く、C は別の楽器で）
//   - 低音は分数コード（G/B、C/E、C7/G）で線にする。小節の終わりには次の低音へ半音・全音で寄る
//   - ハモリは音階どおりの 3 度下（harmonyDiatonic）。サビの上にはベルのオブリガートを手で書く
//   - C メロは和音（エレピ）を手で書き、4 声がほぼ半音・全音・同じ音で次へ移るようにする
//   - 終わり方を 4 種類に分ける: イントロ ♭VII → I / サビ V7 → I / A' I7 → IV / 大サビ V7 → I（変ニ長調）→ 裏コード → ハ長調の A
import { makeLayers, superSong, barsOf, shift } from "../lib/superband.js";

const C_MAJOR = { tonic: 0, mode: "major" };
const DB_MAJOR = { tonic: 1, mode: "major" };

// ---------------------------------------------------------------- セクション（書き方は lib/superband.js）

const INTRO = {
  name: "イントロ", prog: "I–vi7–♭VI△7–♭VII", key: C_MAJOR, feel: "intro",
  chords: ["C", "Am7", "Abmaj7", "Bb"],
  lead: [". . . . . . . .", ". . . . . . . .", ". . . . . . . .", ". . . . . . . ."],
  // 主題の頭「根音・5 度・根音・3 度」を、4 つの和音の上で鳴らして予告する（♭VI と ♭VII は同主短調から借りた和音）
  bell: [
    "C6 . G5 C6 E6 - - -",
    "A5 . E5 A5 C6 - - -",
    "Ab5 . Eb5 Ab5 C6 - - -",
    "Bb5 . F5 Bb5 D6 - - -",
  ],
};

const A = {
  name: "A メロ", prog: "I–V⁶–vi7–IV△7–I⁶–V–ii7–V", key: C_MAJOR, feel: "soft",
  chords: ["C", "G/B", "Am7", "Fmaj7", "C/E", "G", "Dm7", "G"],
  lead: [
    "C5 . G4 C5 E5 . D5 C5",
    "D5 . B4 G4 D5 - . .",
    "E5 . C5 A4 E5 F5 E5 D5",
    "C5 - A4 - C5 . D5 .",
    "C5 . G4 C5 E5 . G5 E5",
    "F5 . D5 B4 G5 - F5 E5",
    "D5 . C5 A4 F5 E5 D5 C5",
    "D5 . . B4 G4 . E5 G5",          // 最後の 2 音でサビの A5 へ順次に上がる
  ],
  // 旋律の下（C4〜C5）で、旋律と逆に動く長い音。旋律が休む所（2 小節目）だけ動く。
  // 4 小節目は原曲（通常曲 1）の対旋律と同じ F → A → G（ベースの F と長 7 度でむき出しにぶつけない）
  counter: [
    "E4 - - - G4 - - -",
    "D4 - - - . G4 A4 B4",
    "C5 B4 A4 G4 E4 - - -",
    "F4 - - - A4 - G4 -",
    "E4 - - - G4 - - -",
    "G4 - - - D4 - - -",
    "F4 - - - A4 - - G4",             // 最後の 8 分で G を通って次の D へ（ベースとも旋律とも連続 5 度にしない）
    "D4 - - - - - - -",               // 導音 B は旋律に任せる
  ],
};

const B = {
  name: "B メロ（サビ）", prog: "vi–IV△7–I–V⁶ / vi7–IV△7–ii7–V7", key: C_MAJOR, feel: "big",
  chords: ["Am", "Fmaj7", "C", "G/B", "Am7", "Fmaj7", "Dm7", "G7"],
  lead: [
    "A5 . E5 . C5 . E5 A5",
    "G5 . F5 . C5 . F5 G5",
    "E5 . G5 . C6 - G5 E5",
    "D5 - B4 - G4 . B4 D5",
    "A5 . G5 A5 . E5 C5 E5",
    "F5 . E5 F5 . C5 A4 C5",
    "D5 E5 F5 G5 A5 G5 F5 E5",
    "D5 - . . G4 . B4 D5",
  ],
  // 旋律より上で、2 分音符ずつ下りてくるオブリガート（旋律が上がるサビに、上から逆向きの線を重ねる）
  bell: [
    "C6 - - - E6 - - -",
    "A5 - - - - - - -",
    "C6 - - - E6 - - -",
    "G5 - - - D6 - - -",
    "C6 - - - E6 - - -",
    "C6 - - - A5 - - -",
    "D6 - - - C6 - - -",
    "D6 - - - - - - -",
  ],
};

const A2 = {
  name: "A' メロ", prog: "I–V⁶–vi7–IV△7–I⁶–V–v7–I7（IV への ii–V）", key: C_MAJOR, feel: "normal",
  chords: ["C", "G/B", "Am7", "Fmaj7", "C/E", "G", "Gm7", "C7"],
  // A の変奏: 伸ばしていた所を刺繍音で埋め、5 小節目は 3 度上から歌い直す。7・8 小節目は F へ向かう ii–V
  lead: [
    "C5 . G4 C5 E5 G5 E5 C5",
    "D5 . B4 G4 D5 C5 B4 C5",
    "E5 . C5 A4 E5 F5 E5 D5",
    "C5 - A4 - C5 . D5 E5",
    "G5 . E5 C5 G5 . A5 G5",
    "F5 . D5 B4 F5 - E5 D5",
    "D5 . Bb4 G4 D5 . F5 E5",
    "C5 - - - D5 C5 Bb4 A4",          // 3 度 E は対旋律に任せ、7 度 B♭ は A へ下りて C メロの Fmaj7 を先取りする
  ],
  counter: [
    "E4 - - - G4 - - -",
    "D4 - - - . G4 A4 G4",
    "C5 B4 A4 G4 E4 - - -",
    "F4 - - - A4 - G4 -",
    "E4 - - - - - D4 -",
    "D4 - - - B3 - - -",
    "F4 - - - - - - -",               // Gm7 の 7 度 F が、C7 の 3 度 E へ半音で下りる
    "E4 - - - - - - -",
  ],
};

const C = {
  name: "C メロ（丸サ進行）", prog: "IV△7–III7(♭9)–vi7–I7⁶₄ → ♭VI7（変ニ長調の V7）", key: C_MAJOR, feel: "jazz",
  chords: ["Fmaj7", "E7b9", "Am7", "C7/G", "Fmaj7", "E7b9", "Am7", "Ab7"],
  lead: [
    "E5 - - - C5 - A4 -",
    "B4 - - - G#4 - B4 D5",
    "C5 - - - A4 - G4 A4",
    "G4 - - - . E4 G4 Bb4",
    "A4 - C5 - E5 - G5 -",
    "G#5 - - - F5 - E5 D5",
    "E5 - - - C5 - B4 C5",
    "C5 - Eb5 - Gb5 - C6 -",         // A♭7 の分散で上がり、C6 から大サビの B♭5 へ下りる（上がるベースと反行）
  ],
  // エレピの和音（E3〜G4）。3 度と 7 度が半音・全音で動く。最後の A♭7 は前の Am7（G・C・E）の外側 2 声をそろって半音下げた形
  comp: [
    ["A3", "C4", "E4", "G4"],
    ["G#3", "B3", "D4", "F4"],
    ["G3", "C4", "E4"],
    ["E3", "Bb3", "C4"],
    ["A3", "C4", "E4", "G4"],
    ["G#3", "B3", "D4", "F4"],
    ["G3", "C4", "E4"],
    ["Gb3", "Bb3", "C4", "Eb4"],
  ],
};

/** 大サビ: サビを半音上（変ニ長調）で。最後の 2 小節で主和音に着き、D♭7（G7 の裏コード）としてハ長調の A へ半音下りる */
const B_TOP = {
  name: "大サビ（変ニ長調）", prog: "vi–IV△7–I–V⁶ / vi7–IV△7–ii7–V7 → I(add9) → ♭II7（裏コード）", key: DB_MAJOR, feel: "big", climax: true,
  chords: ["Bbm", "Gbmaj7", "Db", "Ab/C", "Bbm7", "Gbmaj7", "Ebm7", "Ab7", "Dbadd9", "Db7"],
  lead: [
    ...B.lead.slice(0, 7).map(l => shift(l, 1)),
    "Eb5 - . . Ab4 . C5 Eb5",
    "F5 - Ab5 - Db6 - Eb6 -",         // 曲でいちばん高い E♭6 は、ここで 1 回だけ（add9 の 9 度）
    "Db6 - Ab5 F5 Eb5 Db5 B4 -",      // D♭7 の上を駆け下り、B4（= C♭）が A の頭の C5 への導音になる
  ],
  bell: [
    ...B.bell.map(l => shift(l, 1)),
    ". . . . F6 - - -",               // 旋律が主和音に着く 1 拍目は空けて、旋律と一緒に動かない
    ". . . . . . . .",                // 駆け下りる旋律だけを聞かせる
  ],
  bass: [null, null, null, null, null, null, null, null, "Db2 - - - - - - -", "Db2 - - - F2 - B1 -"],
};

export const SECTIONS = [INTRO, A, B, A2, C, B_TOP];

/** 小節ごとのデータ（イントロのあとへ戻る） */
export const BARS = barsOf(SECTIONS, 1);

export const LAYERS = makeLayers();

export default superSong({
  title: "スーパーハスタワー",
  description: "通常曲 1 の決定版。イントロ → A → サビ → A' → C（丸サ進行）→ 半音上の大サビ → A へ。イントロは最初の 1 回だけ。11 声部を、セクションごとに音域と役割を分けて鳴らす。",
  bpm: 124,
  sections: SECTIONS,
  loopFrom: 1,
  layers: LAYERS,
});
