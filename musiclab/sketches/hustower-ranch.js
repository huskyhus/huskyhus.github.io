// 牧場のハスタワー: 夕暮れの牧場の郷愁。ト長調・100 BPM、拍の裏を少しだけ後ろへずらして跳ねる。
// イントロ → A → B → ソロ → B' → A へ。楽器はスーパーハスタワーと同じ。
//
//   - 旋律はヨナ抜き音階（ソ・ラ・シ・レ・ミ。ドとファ♯を使わない）。わらべ歌や唱歌のような、どこか懐かしい形
//   - B の 2 小節目で C → Cm6（同主短調から借りた iv）。旋律の E が E♭ へ半音下がる所が、この曲の郷愁の芯
//   - 対旋律は B の間ずっと G の音にとどまる（C・Cm6・G/B・Em7 のどれにも G がある）。
//     和音が移っても変わらない 1 音が、帰る場所のように聞こえる
//   - ソロは 16 分音符で、E7（vi へのセカンダリードミナント）や Cm6 の上をペンタトニックで駆ける
//   - B' は B7（Em へのセカンダリードミナント）で一度切なくして、最後は Cm6 → G（短調の iv から主和音へ。
//     教会の「アーメン」の終わり方の、少し寂しい版）で A へ戻る
import { superSong, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const G = { tonic: 7, mode: "major" };

const INTRO = {
  name: "イントロ", prog: "I–vi7–IV–V7sus4", key: G, feel: "intro",
  chords: ["G", "Em7", "C", "D7sus4"],
  lead: [REST, REST, REST, REST],
  bell: [
    "G5 . D5 G5 B5 - - -",
    "E5 . B4 E5 G5 - - -",
    "C5 . G4 C5 E5 - - -",
    "A5 - - - G5 - - -",
  ],
};

const A = {
  name: "A メロ", prog: "I–I⁶–IV–I–vi7–IV–ii7–V7sus4", key: G, feel: "soft",
  chords: ["G", "G/B", "C", "G", "Em7", "C", "Am7", "D7sus4"],
  lead: [
    "G4 . A4 B4 D5 - B4 D5",
    "E5 - D5 - B4 - - -",
    "E5 . G5 E5 D5 - B4 A4",
    "G4 - - - - - . .",
    "B4 . D5 E5 G5 - E5 D5",
    "E5 - - - D5 - B4 A4",
    "A4 . B4 D5 E5 - D5 B4",
    "A4 - - - . . . .",
  ],
  // 旋律の下（B3〜E4）で、和音の 3 度・5 度を長く
  counter: [
    "D4 - - - B3 - - -",
    "D4 - - - - - - -",
    "C4 - - - E4 - - -",
    "D4 - - - B3 - - -",
    "D4 - - - B3 - - -",
    "E4 - - - C4 - - -",
    "C4 - - - E4 - - -",
    "C4 - - - - - - -",
  ],
};

const B = {
  name: "B メロ", prog: "IV–iv6（借用）–I⁶–vi7–ii7–V7–I–I7", key: G, feel: "big",
  chords: ["C", "Cm6", "G/B", "Em7", "Am7", "D7", "G", "G7"],
  lead: [
    "E5 - - - G5 - E5 D5",
    "Eb5 - - - - - D5 C5",             // E → E♭（郷愁の芯）
    "D5 - - - B4 - - -",
    "B4 . D5 E5 G5 - - -",
    "A5 - - - G5 - E5 D5",
    "F#5 - - - A5 - C6 -",
    "B5 - - - - - A5 G5",
    "G5 - - - F5 - D5 B4",
  ],
  // 前半はずっと G にとどまる内声。後半は旋律と逆へ動いて主和音へ
  counter: ["G4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "C5 - - - - - - -", "A4 - - - - - - -", "D5 - - - - - - -", "G4 - - - - - - -"],
};

const SOLO = {
  name: "ソロ", prog: "IV–iv6–I⁶–V7/vi–vi7–V7–I–V7sus4", key: G, feel: "normal", solo: true,
  chords: ["C", "Cm6", "G/B", "E7", "Am7", "D7", "G", "D7sus4"],
  lead: [
    "E5 G5 A5 G5 E5 - D5 E5 G5 - A5 - C6 - A5 -",
    "G5 - Eb5 - D5 - C5 - Eb5 - G5 - A5 - - -",
    "B5 - A5 G5 E5 - G5 - D5 - B4 - D5 - E5 -",
    "G#5 - - - B5 - G#5 - E5 - D5 - B4 - G#4 -",
    "A4 C5 E5 G5 A5 - G5 E5 C5 - E5 - G5 - A5 -",
    "F#5 - A5 - C6 - B5 A5 F#5 - D5 - F#5 - A5 -",
    "B5 - - - A5 G5 E5 D5 B4 - D5 - E5 - G5 -",
    "A5 - - - - - G5 - - - - - . . . .",
  ],
};

const B2 = {
  name: "B' メロ", prog: "IV–iv6–I⁶–V7/vi–vi7–V7/V–V7sus4–V7–I–iv6（短調の iv から頭の I へ）", key: G, feel: "big",
  chords: ["C", "Cm6", "G/B", "B7", "Em7", "A7", "D7sus4", "D7", "G", "Cm6"],
  lead: [
    ...B.lead.slice(0, 3),
    "D#5 - - - F#5 - A5 -",            // B7: Em へ向かう、切ない導音 D♯
    "G5 - - - - - F#5 E5",
    "E5 - - - C#5 - E5 G5",
    "A5 - - - - - G5 E5",
    "F#5 - - - E5 - D5 C5",
    "B4 - - - - - - -",
    "Eb5 - - - - - D5 -",              // 最後にもう一度 E♭。A の頭の G へ
  ],
  counter: ["G4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "F#4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "A4 - - - - - - -", "B3 - - - - - - -", "G4 - - - - - - -"],
};

export const SECTIONS = [INTRO, A, B, SOLO, B2];

export default superSong({
  title: "牧場のハスタワー",
  description: "夕暮れの牧場の郷愁。ト長調・100 BPM で軽く跳ねる。ヨナ抜きの旋律、借用の Cm6（E が E♭ に下がる）、ずっと G にとどまる内声、ペンタトニックのソロ、Cm6 → G の寂しい終わり方。",
  bpm: 100,
  swing: 0.33,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
