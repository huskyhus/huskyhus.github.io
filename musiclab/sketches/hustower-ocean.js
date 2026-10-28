// 大海原のハスタワー: 水平線を見ているときの郷愁。ヘ長調 → ト長調・80 BPM、拍の裏を 3 連符の位置へずらして 12/8 拍子のように揺らす。
// イントロ → A → B → 間奏（ベルのソロ）→ A' → B'（全音上）→ 結び → A へ。楽器はスーパーハスタワーと同じ。
//
//   - A は低音を F に置いたまま（保続音）、上の和音だけを F → B♭ → E♭ と動かす。E♭ はミクソリディアの ♭VII で、
//     長調なのに少しだけ遠い、懐かしい色になる。旋律は主題の頭「ド・ソ・ド・ミ」を 2 倍の長さで、ゆっくり呼びかける
//   - B は大きく歌う。6 小節目の B♭m6（同主短調から借りた iv）で、旋律が F から D♭ へ短 6 度跳ぶ（いちばん胸が詰まる所）
//   - 間奏は旋律が休み、ベルが主題を F → E♭ → D♭ → E♭ の上で鳴らす（♭VI まで下りる、海の深さ）。
//     低音は F を踏んだまま、上の和音の音を 8 分で上り下りする（寄せては返す波。跳ねるリズムで 3 連の揺れになる）
//   - B' は A' の終わりの C7sus4 から、同じ根音の C△7 で全音上のト長調へ（響きの色だけが変わって景色が開く）
//   - 結びは G(add9) → E♭△7 → C7sus4。主和音に着いたのに、♭VI の E♭△7 でまた遠くへ流れ、ヘ長調の A へ戻る
import { superSong, shift, REST } from "../lib/superband.js";
import SUPER from "./hustower-super.js";

const F = { tonic: 5, mode: "major" };
const G = { tonic: 7, mode: "major" };

const INTRO = {
  name: "イントロ", prog: "I–♭VII/I–♭VI/I–♭VII/I（低音は F のまま）", key: F, feel: "quiet", comp: "auto",
  chords: ["F", "Eb/F", "Db/F", "Eb/F"],
  lead: [REST, REST, REST, REST],
  bell: [
    "F5 . C5 F5 A5 - - -",
    "Eb5 . Bb4 Eb5 G5 - - -",
    "Db5 . Ab4 Db5 F5 - - -",
    "Eb5 . Bb4 Eb5 G5 - F5 -",
  ],
};

const A = {
  name: "A メロ", prog: "I–IV/I–♭VII/I–I（保続音）→ vi7–IV△7–ii7–V7sus4", key: F, feel: "ballad", comp: "auto",
  chords: ["F", "Bb/F", "Eb/F", "F", "Dm7", "Bbmaj7", "Gm7", "C7sus4"],
  lead: [
    "F5 - C5 - F5 - A5 -",             // 主題の頭を 2 倍の長さで
    "Bb5 - - - F5 - G5 A5",
    "G5 - - - Eb5 - - -",              // ミクソリディアの E♭
    "F5 - - - - - C5 D5",
    "F5 - - - E5 - D5 C5",
    "D5 - - - - - F5 A5",
    "Bb5 - - - A5 - G5 F5",
    "F5 - - - - - G5 -",               // 吊った 4 度 F のまま、解決せずに B へ
  ],
};

const B = {
  name: "B メロ", prog: "IV△7–V–iii7–vi7–ii7–iv6（借用）–I⁶₄–V7", key: F, feel: "big",
  chords: ["Bbmaj7", "C", "Am7", "Dm7", "Gm7", "Bbm6", "F/C", "C7"],
  lead: [
    "D6 - - - - - C6 A5",
    "G5 - - - - - E5 G5",
    "C6 - - - - - A5 G5",
    "A5 - - - - - . .",
    "Bb5 - - - A5 - G5 F5",
    "F5 - - - Db6 - - -",              // 短 6 度の跳躍。D♭ は同主短調の音
    "C6 - - - A5 - F5 G5",
    "Bb5 - - - G5 - E5 -",
  ],
  // 旋律とハモリの下で、F と G のあいだをほとんど動かない内声（和音が大きく動いても、足元は変わらない）
  counter: ["F4 - - - - - - -", "G4 - - - - - - -", "G4 - - - - - - -", "F4 - - - - - - -", "F4 - - - - - - -", "F4 - - - - - - -", "F4 - - - - - - -", "G4 - - - - - - -"],   // 最後は導音 E を旋律に任せる
};

const INTERLUDE = {
  name: "間奏（ベルのソロ）", prog: "I–♭VII/I–♭VI/I–♭VII/I ×2 → V7sus4", key: F, feel: "ballad", comp: "auto",
  chords: ["F", "Eb/F", "Db/F", "Eb/F", "F", "Eb/F", "Db", "C7sus4"],
  lead: [REST, REST, REST, REST, REST, REST, REST, REST],
  bell: [
    "F5 . C5 F5 A5 - - -",
    "G5 . Eb5 G5 Bb5 - - -",
    "Ab5 . F5 Ab5 Db6 - - -",
    "Bb5 - - - G5 - - -",
    "C6 . A5 C6 F6 - - -",
    "Eb6 - - - Bb5 - - -",
    "Db6 - - - Ab5 - F5 -",
    "G5 - - - - - - -",
  ],
  // 低音: 小節の頭は F（保続音）。そこから上の和音の音へ上がって戻る
  bass: [
    "F2 C3 F3 C3 A2 C3 F3 C3",
    "F2 Bb2 Eb3 Bb2 G2 Bb2 Eb3 Bb2",
    "F2 Ab2 Db3 Ab2 F2 Ab2 Db3 Ab2",
    "F2 Bb2 Eb3 Bb2 Eb3 Bb2 G2 Bb2",   // 3 拍目はベル（B♭ → G）と逆へ上がる
    "F2 C3 F3 C3 A2 C3 F3 C3",
    "F2 Bb2 Eb3 Bb2 G2 Bb2 Eb3 Bb2",
    "Db2 Ab2 Db3 Ab2 F2 Ab2 Db3 Ab2",
    "C2 G2 Bb2 G2 C2 G2 Bb2 G2",
  ],
};

const A2 = {
  ...A, name: "A' メロ",
  // 賛美歌の内声のように、旋律と逆へゆっくり動く
  counter: ["A4 - - - - - - -", "F4 - - - - - - -", "G4 - - - - - - -", "A4 - - - - - - -", "F4 - - - - - - -", "F4 - - - - - - -", "Bb4 - - - - - - -", "Bb4 - - - - - - -"],
};

const B2 = {
  name: "B' メロ（ト長調）", prog: "IV△7–V–iii7–vi7–ii7–iv6–I⁶₄–V7（全音上）", key: G, feel: "big",
  chords: ["Cmaj7", "D", "Bm7", "Em7", "Am7", "Cm6", "G/D", "D7"],
  lead: B.lead.map(l => shift(l, 2)),
  counter: B.counter.map(l => shift(l, 2)),
};

const CODA = {
  name: "結び", prog: "I(add9)–♭VI△7 → ヘ長調の V7sus4", key: G, feel: "quiet", comp: "auto",
  chords: ["Gadd9", "Ebmaj7", "C7sus4"],
  lead: [
    "G5 - - - A5 - - -",               // 主音から 9 度へ。着いたのに開いたまま
    "G5 - - - - - - -",                // G は E♭△7 の 3 度（同じ音のまま、景色だけ変わる）
    "G5 - - - - - - -",
  ],
};

export const SECTIONS = [INTRO, A, B, INTERLUDE, A2, B2, CODA];

export default superSong({
  title: "大海原のハスタワー",
  description: "水平線を見ているときの郷愁。ヘ長調 → ト長調・80 BPM の 12/8 風。保続音とミクソリディアの ♭VII、借用の iv6 で胸が詰まる B、ベルのソロ、全音上の B'、♭VI へ流れる結び。",
  bpm: 80,
  swing: 0.67,
  sections: SECTIONS,
  loopFrom: 1,
  paramsFrom: ["hustower-super", SUPER],   // 画面の設定（鳴らす・楽器・音量）はスーパーハスタワーと共通
});
