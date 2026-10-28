// 調律の刻「本番合奏」（ステージ 12 の曲）: ハ調・80 小節（8 小節 × 10 セクション）。
// 「光と影の合奏」の C・D セクション（長調の旋律に、ハ短調から借りた和音を 1 小節ごとに混ぜる）の作りを曲全体に広げ、
// あいだに通常曲 1・戦闘曲 1 のテーマを、旋律を 1 音も変えずに、もとのテンポ（120 / 160）ではさむ。
// どのセクションも光と影が一緒に奏でる。
//
// テーマのところの長短混在は、和音だけで行う。旋律の音とぶつからない借用和音だけを選んだ:
//   通常曲 1（ハ長調）: 旋律がミ・ラ・シを使わない（または一瞬だけの）小節に、ハ短調の和音（ラ♭・ミ♭・シ♭を含む）
//   戦闘曲 1（イ短調）: 旋律がファ・ド・ソを使わない小節に、イ長調の和音（ファ♯・ド♯を含む）
//   旋律の音と同じ音名の半音（ラとラ♭など）がぶつかる和音は、短い音でも使わない
//
//   序                     104  C Fm C A♭ F Fm C C7（最後の C7 が次の F へ引っぱる）
//   合奏 1                 104  F Fm C A♭ B♭ C Dm7(♭5) G7（「光と影の合奏」の C セクション）
//   テーマ「光」           120  通常曲 1 の A メロ: C G7(♭9) Am F C F△7 Dm7 G7(♭9)
//   高まり                 104  A♭ B♭ Cm Fm A♭ B♭ C C（「光と影の合奏」の D セクション）
//   影の歌                 104  Cm A♭ Fm G Cm A♭ Dm7(♭5) G7
//   テーマ「影」           160  戦闘曲 1 の A メロ（影が歌う）: Am D F G Am D7 F E
//   テーマ「影」2          160  戦闘曲 1 の B メロ（影が歌う）: Dm A7(♯9) Dm E F G D7 E
//   テーマ「光と影」       120  通常曲 1 の B メロ: Am A♭△7 C G7(♭9) Am Gm7 Dm7 G7(♭9)
//   頂点                   104  C Fm Em Am Dm7 Dm7(♭5) G G7
//   終止                   104  A♭ B♭ C Am A♭ B♭ C C（♭VI–♭VII–I で、頭の C へ戻る）
//
// 影が歌う 2 つのテーマでは、光は影の旋律の下で対旋律を伸ばす（戦闘曲のテーマは高く上がるため）。
// 対旋律は "voiced"（旋律と同じ音・連続 8 度・連続 5 度・声部の交差を避けて選ぶ）。点検は tools/analyze.mjs で。
import { lightShadowSong } from "../lib/lightshadow.js";
import { THEME as NORMAL } from "./hustower-massive.js";
import { THEME as BATTLE } from "./hustower-battle.js";

export default lightShadowSong({
  title: "調律の刻「本番合奏」",
  description: "ステージ 12 の曲。ハ調・80 小節。長調の旋律にハ短調から借りた和音を 1 小節ごとに混ぜる作りを曲全体に広げ、通常曲 1・戦闘曲 1 のテーマを、旋律を変えずにもとのテンポではさむ（長短混在は和音だけで）。",
  mood: "boss",
  bpm: 104,
  counter: "voiced",
  sections: [
    {
      name: "序", side: "both", feel: "soft",
      chords: ["C", "Fm", "C", "Ab", "F", "Fm", "C", "C7"],
      lead: [
        "E5 - - - G5 - - -",
        "Ab5 - - - F5 - - -",
        "G5 - - - E5 - C5 -",
        "Eb5 - - - C5 - - -",
        "A5 - - - C6 - A5 -",
        "Ab5 - - - C6 - F5 -",
        "G5 - - - E5 - - -",
        "E5 - - - G5 - Bb5 -",   // C7: シ♭が、次の小節のラへ半音で下りる
      ],
    },
    {
      name: "合奏 1", side: "both",
      chords: ["F", "Fm", "C", "Ab", "Bb", "C", "Dm7b5", "G7"],
      lead: [
        "A5 - - - F5 - C5 F5",
        "Ab5 - - - F5 - C5 -",
        "G5 - E5 - C5 - - .",
        "Eb5 - - - C5 - Ab4 -",
        "D5 - F5 - Bb5 - - .",
        "C6 - G5 - E5 - G5 -",
        "Ab5 - F5 - D5 - C5 -",
        "B4 - D5 - F5 - D5 -",
      ],
    },
    {
      // 旋律はミ・ラ・シを多く使うので、借用できるのは V の和音にラ♭（♭9）を足した G7(♭9) だけ
      name: "テーマ「光」（通常曲 1 の A メロ）", side: "both", bpm: 120,
      // 7 小節目は Dm7（ii7）。もとの F のままだと、旋律のド → レ がベースのファ → ソと連続 5 度になるため。G7(♭9) へ ii–V で進む
      // 6 小節目は F△7（旋律のファ・ソ・ミがそのまま根音・9 度・7 度になる）で、F△7 → Dm7 → G7(♭9) の IV → ii → V
      chords: ["C", "G7b9", "Am", "F", "C", "Fmaj7", "Dm7", "G7b9"],
      lead: NORMAL.A,
    },
    {
      name: "高まり", side: "both", feel: "big",
      chords: ["Ab", "Bb", "Cm", "Fm", "Ab", "Bb", "C", "C"],
      lead: [
        "Ab4 - C5 - Eb5 - Ab5 -",   // テーマの最後のソから、ラ♭へ半音で上がって入る
        "D6 - - - Bb5 - F5 -",
        "Eb6 - - - C6 - G5 -",
        "F5 - Ab5 - C6 - F6 -",
        "Eb6 - - - C6 - Ab5 -",
        "D6 - - - F6 - D6 -",
        "E6 - - - C6 - G5 -",
        "C6 - - - - - . .",
      ],
    },
    {
      name: "影の歌", side: "both", feel: "soft",
      chords: ["Cm", "Ab", "Fm", "G", "Cm", "Ab", "Dm7b5", "G7"],
      lead: [
        "Eb5 - - - G5 - C6 -",
        "C6 - - - Ab5 - Eb5 -",
        "F5 - - - Ab5 - C6 -",
        "B5 - - - D6 - - .",
        "C6 - - - G5 - Eb5 -",
        "Eb5 - - - C5 - Ab4 -",
        "F5 - - - Ab5 - D6 -",
        "D5 - - - G4 - B4 -",
      ],
    },
    {
      // 2・6 小節目はイ長調の側の IV（D・D7）。ファ♯が光の色。旋律にファがない小節なのでぶつからない
      name: "テーマ「影」（戦闘曲 1 の A メロ）", side: "both-shadow", bpm: 160, key: { tonic: 9, mode: "minor" },
      chords: ["Am", "D", "F", "G", "Am", "D7", "F", "E"],
      lead: BATTLE.A,
    },
    {
      // 2 小節目の A7(♯9) は、光のド♯と影のド（旋律の音）を同時に含む。7 小節目の D7 はファ♯で光の色
      name: "テーマ「影」2（戦闘曲 1 の B メロ）", side: "both-shadow", bpm: 160, key: { tonic: 9, mode: "minor" },
      chords: ["Dm", "A7#9", "Dm", "E", "F", "G", "D7", "E"],
      lead: BATTLE.B,
    },
    {
      // 2 小節目は A♭△7（♭VI△7）、4・8 小節目は G7(♭9)、6 小節目は Gm7（短調の v7）
      name: "テーマ「光と影」（通常曲 1 の B メロ）", side: "both", bpm: 120,
      chords: ["Am", "Abmaj7", "C", "G7b9", "Am", "Gm7", "Dm7", "G7b9"],
      lead: NORMAL.B,
    },
    {
      name: "頂点", side: "both", feel: "big",
      chords: ["C", "Fm", "Em", "Am", "Dm7", "Dm7b5", "G", "G7"],
      lead: [
        "E5 - G5 - C6 - - .",       // テーマの最後のレから、ミへ順次で
        "Ab5 - C6 - F6 - - .",
        "G5 - B5 - E6 - - .",
        "A5 - C6 - E6 - - .",
        "F5 - A5 - D6 - C6 -",
        "F5 - Ab5 - D6 - C6 -",
        "B5 - D6 - G6 - - .",
        "F6 - D6 - B5 - G5 -",
      ],
    },
    {
      name: "終止", side: "both", feel: "big",
      chords: ["Ab", "Bb", "C", "Am", "Ab", "Bb", "C", "C"],
      lead: [
        "C6 - - - Eb6 - - -",
        "D6 - - - F6 - - -",
        "E6 - - - G6 - E6 -",
        "E6 - - - C6 - A5 -",
        "Eb6 - - - C6 - Ab5 -",
        "F6 - - - D6 - Bb5 -",
        "E6 - - - - - - -",
        "C6 - - - - - . .",
      ],
    },
  ],
});
