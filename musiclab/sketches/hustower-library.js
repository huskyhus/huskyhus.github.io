// 図書館のハスタワー: 静かな哀愁と、言い出せないもどかしさ。ニ短調・76 BPM。ソロはなし。
// イントロ → A → B → C → A' → A へ。楽器はスーパーハスタワーと同じ。
//
//   - A は和音を伸ばすだけの静けさ（ドラムなし）。Dm → DmM7 → Dm7 → Dm6 のライン・クリシェで、
//     和音の中の 1 音だけが D → C♯ → C → B と半音ずつ下りる（時計の音のように、少しずつ時間が過ぎる）
//   - どこへ行っても主和音に着かない: A の最後の A7 は B♭△7 へ（偽終止）、B の A7 もまた B♭△7 へ。
//     旋律は C♯ → D と解決しているのに、和音だけがはぐらかす（言いかけてやめる）
//   - C で 5 度圏を下り（Gm7–C7–F△7–B♭△7–Em7♭5–A7）、7 小節目で初めて Dm に着く。A7 の上の F は
//     和声的短音階の ♭13 を強拍に置いた倚音（E へ下りる。泣きの音）
//   - A' はベルが旋律の伸ばす所に答える。最後は A7sus4 で吊ったまま、解決しないで A へ戻る
import { superSong, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const DM = { tonic: 2, mode: "minor" };

const INTRO = {
  name: "イントロ", prog: "i–i△7–i7–i6（ライン・クリシェ）", key: DM, feel: "quiet", comp: "auto",
  chords: ["Dm", "DmM7", "Dm7", "Dm6"],
  lead: [REST, REST, REST, REST],
  bell: [
    "D5 . A4 D5 F5 - - -",             // 主題の頭を短調で
    ". . . . C#6 - - -",               // 下りていく 1 音をベルでも
    ". . . . C6 - - -",
    ". . . . B5 - - -",
  ],
};

const A = {
  name: "A メロ", prog: "i–i△7–i7–i6–iv7–VII7–III△7–V7 → 偽終止", key: DM, feel: "quiet", comp: "auto",
  chords: ["Dm", "DmM7", "Dm7", "Dm6", "Gm7", "C7", "Fmaj7", "A7"],
  lead: [
    "D5 . A4 D5 F5 - E5 D5",
    "C#5 - - - - - D5 E5",
    "F5 . C5 F5 A5 - G5 F5",
    "E5 - - - - - D5 B4",
    "Bb4 . D5 G5 Bb5 - A5 G5",
    "G5 - - - E5 - C5 Bb4",
    "A4 - - - C5 - E5 F5",
    "E5 - - - C#5 - - -",              // 導音 C♯ は B の頭の D へ。和音は B♭△7 にはぐらかされる
  ],
};

const B = {
  name: "B メロ", prog: "VI△7–iv6–ii7♭5–V7 ×2（2 回とも偽終止）→ V7sus4", key: DM, feel: "ballad", comp: "auto",
  chords: ["Bbmaj7", "Gm6", "Em7b5", "A7", "Bbmaj7", "Gm6", "Em7b5", "A7sus4"],
  lead: [
    "D5 - - - F5 - A5 -",
    "A5 - - - - - G5 E5",              // 9 度から
    "G5 - - - Bb4 - D5 -",
    "C#5 - - - - - E5 G5",
    "F5 - - - - - E5 D5",
    "D5 - - - Bb4 - - -",
    "Bb4 - - - D5 - G5 -",
    "A5 - - - - - G5 -",
  ],
};

const C = {
  name: "C メロ", prog: "iv7–VII7–III△7–VI△7–ii7♭5–V7–i（5 度圏を下りて、初めて着く）", key: DM, feel: "jazz",
  // A7 の小節だけ、倚音 F の解決先の E を和音から抜く（下で E が鳴っていると、F が濁る）
  comp: ["auto", "auto", "auto", "auto", "auto", ["G3", "A3", "C#4"], "auto", "auto"],
  chords: ["Gm7", "C7", "Fmaj7", "Bbmaj7", "Em7b5", "A7", "Dm", "Dm"],
  lead: [
    "Bb5 - - - - - A5 F5",
    "E5 - - - G5 - Bb5 -",
    "A5 - - - - - G5 F5",
    "D5 - - - - - E5 F5",
    "G5 - - - Bb5 - A5 G5",
    "F5 - E5 - C#5 - E5 -",            // ♭13 の F を強拍に置き、E へ下りる（倚音）
    "D5 - - - - - - -",                // ここだけ、主和音に着く
    ". . . . A4 - C5 -",
  ],
};

const A2 = {
  ...A, name: "A' メロ", prog: "i–i△7–i7–i6–iv7–VII7–III△7–V7sus4（解決しないで頭へ）",
  chords: ["Dm", "DmM7", "Dm7", "Dm6", "Gm7", "C7", "Fmaj7", "A7sus4"],
  lead: [...A.lead.slice(0, 7), "E5 - - - D5 - - -"],
  // 旋律が伸ばしている所に、ベルが小さく答える
  bell: [REST, ". . . . E6 - D6 C#6", REST, ". . . . D6 - B5 -", REST, REST, REST, ". . . . A5 - - -"],
};

export const SECTIONS = [INTRO, A, B, C, A2];

export default superSong({
  title: "図書館のハスタワー",
  description: "静かな哀愁と、言い出せないもどかしさ。ニ短調・76 BPM、ソロなし。ライン・クリシェ、2 度の偽終止、5 度圏を下りて一度だけ着く主和音、解決しない A7sus4。",
  bpm: 76,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
