// 競演のハスタワー: 3 人の奏者（リード・対旋律・ビブラフォン）が順にソロを取り、掛け合い、ときどき合わさる見せ場の曲。
// ホ短調 → 嬰ヘ短調・128 BPM・80 小節。楽器はスーパーハスタワーと同じ（画面の設定も共通）。
//
// イントロ（3 人ユニゾンのリフ）→ テーマ A → テーマ B → ソロ 1（リード）→ ソロ 2（対旋律）→ ソロ 3（ビブラフォン）
// → 掛け合い 1（2 小節ずつ → 3 人で合わさってブレイク）→ 掛け合い 2（1 小節ずつ。2 人が組んだり離れたり → 3 人ユニゾン）
// → テーマ A' → テーマ B'（全音上）→ 結び → テーマ A へ
//
//   - シンコペーション: 主題の頭「ミ・シ・ミ・ソ」を拍の裏へずらし（16 分の裏から入る）、ベースとドラムも裏を食う（funk の型）。
//     ソロでは 3 + 3 + 3 + 3 + 4 の付点 8 分の区切り（拍とずれていく）を、リードと対旋律が同じ形で受け渡す
//   - 和音: テーマ A は i7–VI△7–iv7–V7（短調の定番）、ソロ 1 はドリアンの i7–IV7（ファンク）、
//     ソロ 2 は短調の 5 度圏（iv7–VII7–III△7–VI△7–ii7♭5–V7–i7）、ソロ 3 は VI△7 から下りるジャズの進行。
//     V7 は B7(♯9)（長 3 度と短 3 度を同時に含む、ざらっとした属和音）を決めの所に使う
//   - 掛け合い: 1 人のときは 1 人だけが前に出る。2 人が組むときは 3 度で重ねるかオクターブで重ねる。
//     3 人そろうときはユニゾン（リード・対旋律は 1 オクターブ下・ビブラフォンは 1 オクターブ上）か、和音の 3 つの音に分かれる
//   - 結びで曲の最高音 G6 に一度だけ着き、B7(♯9) のブレイクからテーマ A へ戻る
import { superSong, shift, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const EM = { tonic: 4, mode: "minor" };
const FSM = { tonic: 6, mode: "minor" };

/** 同じ行を 1 オクターブ下・上に（ユニゾンで重ねる奏者用） */
const down = l => shift(l, -12);
const up = l => shift(l, 12);

/** 3 人ユニゾンのリフ（主題の頭を裏へずらす） */
const RIFF = [
  "E5 - . E5 . . B4 - E5 . G5 - . . . .",
  "E5 - . E5 . . B4 - E5 . G5 - . F#5 . E5",
  "A5 - . A5 . . E5 - A5 . C6 - . . . .",
  "B5 - . B5 . . F#5 - A5 . D6 - . B5 A5 F#5",  // D は B7(♯9) の ♯9
];

const INTRO = {
  name: "イントロ（3 人ユニゾン）", prog: "i9–VI△7–iv7–V7(♯9)", key: EM, feel: "funk", trade: true,
  chords: ["Em9", "Cmaj7", "Am7", "B7#9"],
  lead: RIFF, counter: RIFF.map(down), bell: RIFF.map(up),
};

const A = {
  name: "テーマ A", prog: "i7–VI△7–iv7–V7 ×2 → VII7（III へ）", key: EM, feel: "funk", comp: "auto",
  chords: ["Em7", "Cmaj7", "Am7", "B7", "Em7", "Cmaj7", "Am7", "D7"],
  lead: [
    ". . E5 - . B4 E5 - G5 - - . F#5 E5 D5 -",   // 主題の頭を 16 分の裏から
    "E5 - - - . . . . . . G5 - B5 - G5 -",
    ". . A5 - . E5 A5 - C6 - - . B5 A5 G5 -",
    "F#5 - - - . . D#5 - F#5 - A5 - . G5 - .",   // 7 度 A は G へ下りる
    ". . E5 - . B4 E5 - G5 - - . B5 A5 G5 -",
    "E5 - - - . . G5 - E5 - D5 - . C5 . B4",
    "C5 - . E5 - . A5 - . G5 - . E5 - D5 -",     // 付点 8 分の区切り（拍とずれる）
    "F#5 - - - . . A5 - . C6 - . D6 - . .",
  ],
};

const B = {
  name: "テーマ B", prog: "III–VII⁶–i7–VI△7–iv7–VII7–III△7–V7sus4", key: EM, feel: "big",
  chords: ["G", "D/F#", "Em7", "Cmaj7", "Am7", "D7", "Gmaj7", "B7sus4"],
  lead: [
    "D6 - - - - - B5 - D6 - - . E6 - D6 -",
    "A5 - - - - - F#5 - A5 - - . B5 - A5 -",
    "G5 - - - - - E5 - G5 - - . A5 - G5 -",
    "E5 - - - - - - - . . G5 - B5 - C6 -",
    "E6 - - - - - C6 - - - A5 - . . C6 -",
    "D6 - - - C6 - A5 - - - F#5 - . . A5 -",
    "B5 - - - - - - - F#5 - - - D5 - - -",
    "E5 - - - - - - - . . . . . . . .",
  ],
  // 下で、和音の 3 度・7 度を全音符でつなぐ
  counter: ["B4 - - - - - - -", "D5 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "C5 - - - - - - -", "C5 - - - - - - -", "B4 - - - - - - -", "A4 - - - - - - -"],
};

const SOLO_LEAD = {
  name: "ソロ 1（リード）", prog: "i7–IV7（ドリアン）×2 → VI△7–V7(♯9)–i7–I7（iv へ）", key: EM, feel: "funk", solo: true, comp: "auto",
  chords: ["Em7", "A7", "Em7", "A7", "Cmaj7", "B7#9", "Em7", "E7"],
  lead: [
    "E5 . G5 A5 B5 . D6 . E6 - D6 B5 . A5 G5 .",
    "A5 - . C#6 - . E5 G5 A5 - C#6 - . B5 A5 G5",
    "E5 - - . G5 - - . B5 - - . D6 - - .",       // 付点 8 分の区切り（対旋律があとで同じ形で答える）
    "C#6 - - . A5 - - . E5 - - . G5 - A5 -",
    "B5 C6 B5 G5 E5 - G5 B5 C6 - B5 G5 E5 - D5 E5",
    "D#5 - F#5 A5 D6 - . B5 A5 - F#5 D#5 B4 - . .",
    "E5 - . E5 . . B5 - E6 - - - . . . .",       // 主題の頭に戻る
    "G#5 - - - B5 - D6 - . . . . . . . .",
  ],
};

const SOLO_COUNTER = {
  name: "ソロ 2（対旋律）", prog: "iv7–VII7–III△7–VI△7–ii7♭5–V7–i7（短調の 5 度圏）", key: EM, feel: "funk", trade: true, comp: "auto",
  chords: ["Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em7", "Em7"],
  lead: [REST, REST, REST, REST, REST, REST, REST, REST],
  counter: [
    "A4 - C5 E5 G5 - E5 C5 . A4 . C5 - E5 G5 -",
    "F#5 - - . A5 - C6 - . A5 F#5 - D5 - C5 -",
    "B4 - D5 F#5 - . B5 - A5 - F#5 - D5 - . .",
    "E5 - - - G5 - - - B5 - - - . C6 B5 G5",
    "A5 - . C6 - . A5 - E5 - . C5 - . A4 -",
    "D#5 - F#5 - A5 - B5 - . A5 F#5 - D#5 - B4 -",
    "E5 - - . G5 - - . B5 - - . D6 - - .",       // リードのソロの付点 8 分に、同じ形で答える
    "E6 - - - - - - - . . . . . . . .",
  ],
};

const SOLO_VIBES = {
  name: "ソロ 3（ビブラフォン）", prog: "VI△7–v7–iv7–III△7–ii7♭5–V7–i9–V7(♯9)", key: EM, feel: "jazz", trade: true, comp: "auto",
  chords: ["Cmaj7", "Bm7", "Am7", "Gmaj7", "F#m7b5", "B7", "Em9", "B7#9"],
  lead: [REST, REST, REST, REST, REST, REST, REST, REST],
  bell: [
    "E5 - G5 B5 - - G5 E5",            // 小節の終わりは和音の 3 度（ベースと 5 度のまま下りない）
    "F#5 - D5 A5 - - E5 D5",
    "E5 - C5 G5 - - E5 C5",
    "D5 - B4 F#5 - - - -",
    "A5 - C6 E6 - - C6 A5",
    "F#5 - D#5 A5 - - F#5 D#5",
    "F#5 - G5 B5 - - D6 B5",
    "A5 - - - D6 - - -",
  ],
};

const TRADE_TWO = {
  name: "掛け合い 1（2 小節ずつ → 3 人で）", prog: "i7–IV7 ×2 → VI△7–V7 → i7–I7(♯9)（ブレイク。iv へ）", key: EM, feel: "big", trade: true,
  chords: ["Em7", "A7", "Em7", "A7", "Cmaj7", "B7", "Em7", "E7#9"],
  // リード → 対旋律（同じリズムで、低い所から答える）→ ビブラフォン → 3 人
  lead: [
    "B5 - . B5 . . E6 - D6 - B5 - . A5 G5 .",
    "A5 - . C#6 - . E6 - D6 C#6 B5 A5 - - . .",
    REST, REST, REST, REST,
    "E6 - - . B5 - - . G5 - - . E5 - - .",
    "D6 - . D6 - . . . . . . . . . . .",         // 3 人そろって 2 発、あとはブレイク（D・G♯・G で E7(♯9)）
  ],
  counter: [
    REST, REST,
    "G4 - . G4 . . B4 - E5 - D5 - . B4 A4 .",
    "E4 - . G4 - . A4 - C#5 - E5 - G5 - - .",
    REST, REST,
    "E5 - - . B4 - - . G4 - - . E4 - - .",       // リードの 1 オクターブ下
    "G#4 - . G#4 - . . . . . . . . . . .",
  ],
  bell: [
    REST, REST, REST, REST,
    "G5 - B5 - E6 - - - D6 - B5 - E5 - - -",
    "F#5 - A5 - D#6 - - - B5 - A5 - F#5 - D#5 -",
    "B5 - - . G5 - - . E5 - - . B4 - - .",       // リードの 3 度・4 度下を同じリズムで
    "G5 - . G5 - . . . . . . . . . . .",         // G は E7(♯9) の ♯9
  ],
};

const TRADE_ONE = {
  name: "掛け合い 2（1 小節ずつ・組んだり離れたり）", prog: "iv7–VII7–III△7–VI△7–iv7–V7–i7", key: EM, feel: "funk", trade: true, comp: "auto",
  chords: ["Am7", "D7", "Gmaj7", "Cmaj7", "Am7", "B7", "Em7", "Em7"],
  lead: [
    "A5 - C6 - E6 - . C6 - A5 - . G5 - E5 -",    // リード
    REST,                                          // 対旋律
    REST,                                          // ビブラフォン
    "E5 - G5 - B5 - . A5 - G5 - . E5 - C5 -",    // リード + 対旋律（3 度で）
    REST,                                          // ビブラフォン
    REST,                                          // 対旋律 + ビブラフォン（オクターブで）
    RIFF[0],                                       // 3 人ユニゾン
    "B5 - . B5 . . G5 - E5 . D5 - . . . .",
  ],
  counter: [
    REST,
    "A4 - C5 - D5 - . C5 - A4 - . F#4 - A4 -",
    REST,
    "C5 - E5 - G5 - . F#5 - E5 - . C5 - A4 -",
    REST,
    "D#5 - F#5 - A5 - . F#5 - D#5 - . B4 - . .",
    down(RIFF[0]),
    down("B5 - . B5 . . G5 - E5 . D5 - . . . ."),
  ],
  bell: [
    REST, REST,
    "G5 - B5 - D6 - . B5 - G5 - . F#5 - D5 -",
    REST,
    "C6 - E6 - . C6 A5 - E5 - . G5 - A5 - -",
    "D#6 - F#6 - A6 - . F#6 - D#6 - . B5 - . .",
    up(RIFF[0]),
    up("B5 - . B5 . . G5 - E5 . D5 - . . . ."),
  ],
};

const A2 = {
  ...A, name: "テーマ A'", prog: "i7–VI△7–iv7–V7 ×2 → V7/III（嬰ヘ短調の III へ）",
  chords: [...A.chords.slice(0, 7), "E7"],
  lead: [...A.lead.slice(0, 7), "G#5 - - - . . B5 - . D6 - . E6 - . ."],
  // 対旋律は低い所で、和音の 3 度・7 度をつなぐ
  counter: ["G4 - - - - - - -", "E4 - - - - - - -", "E4 - - - - - - -", "F#4 - - - - - - -", "D4 - - - - - - -", "E4 - - - - - - -", "E4 - - - - - - -", "D4 - - - - - - -"],
};

const B2 = {
  name: "テーマ B'（嬰ヘ短調）", prog: "III–VII⁶–i7–VI△7–iv7–VII7–III△7–V7sus4（全音上）", key: FSM, feel: "big",
  chords: ["A", "E/G#", "F#m7", "Dmaj7", "Bm7", "E7", "Amaj7", "C#7sus4"],
  lead: B.lead.map(l => shift(l, 2)),
  counter: B.counter.map(l => shift(l, 2)),
};

const ENDING = {
  name: "結び", prog: "VI△7–VII–i9（最高音で着く）–V7(♯9)（ブレイク → テーマ A）", key: EM, feel: "big", climax: true,
  chords: ["Cmaj7", "D", "Em9", "B7#9"],
  lead: [
    "B5 - - - - - G5 - E6 - - - D6 - B5 -",
    "A5 - - - - - F#5 - D6 - - - E6 - F#6 -",
    "G6 - - - - - - - F#6 - - - E6 - - -",       // 曲でいちばん高い G6
    "D#6 - - . D6 - - . B5 - - . A5 - - .",
  ],
  bell: [REST, REST, "B5 - - - A5 - G5 -", REST],
};

export const SECTIONS = [INTRO, A, B, SOLO_LEAD, SOLO_COUNTER, SOLO_VIBES, TRADE_TWO, TRADE_ONE, A2, B2, ENDING];

export default superSong({
  title: "競演のハスタワー",
  description: "3 人の奏者（リード・対旋律・ビブラフォン）の見せ場。ホ短調・128 BPM・80 小節。シンコペーションのテーマ、3 人それぞれのソロ、2 小節ずつ → 1 小節ずつの掛け合い（組んだり離れたり、最後は 3 人ユニゾン）、全音上のテーマ B'。",
  bpm: 128,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
