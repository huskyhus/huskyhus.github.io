// 通常曲 5「市場町」: 変ロ長調・132 BPM。にぎやかで、はずむ。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 5「市場町」",
  description: "変ロ長調・132 BPM。A はカデンツ（T–SD–D–T）、サビは 50 年代進行（I–vi–IV–V）、C メロはダイアトニックの下降（IV–iii–ii–I）を 2 回。A は小節の終わりをあけて、合いの手が答える。",
  bpm: 132,
  mood: "normal",
  inst: { 0: "pulse33", 1: "upright-bass", 7: "ukulele", 11: "marimba" },
  sections: [
    {
      name: "A", prog: "カデンツ T–SD–D–T",
      chords: ["Bb", "Eb", "F", "Bb", "Gm", "Eb", "F7", "Bb"],
      lead: [
        "D5 . F5 . Bb5 - . .",
        "G5 . Eb5 . Bb4 - C5 D5",
        "C5 - A4 - F5 - . .",
        "D5 . C5 Bb4 F4 - . .",
        "G4 . Bb4 . D5 - G5 -",
        "G5 . F5 Eb5 Bb4 - . .",
        "A4 . C5 . Eb5 - D5 C5",
        "Bb4 - - - . . . .",
      ],
    },
    {
      name: "サビ", prog: "50 年代進行 I–vi–IV–V",
      chords: ["Bb", "Gm", "Eb", "F", "Bb", "Gm", "Eb", "F"],
      lead: [
        "F5 - Bb5 - D6 - C6 Bb5",
        "Bb5 - G5 - D5 - . .",
        "Eb5 - G5 - Bb5 - C6 Bb5",
        "A5 - - - F5 - - -",
        "F5 - Bb5 - D6 - F6 -",
        "D6 - Bb5 - G5 - Bb5 -",
        "Bb5 - G5 - Eb5 - G5 -",
        "A5 - - - C6 - A5 -",
      ],
    },
    {
      name: "C メロ", prog: "ダイアトニックの下降 IV–iii–ii–I",
      chords: ["Eb", "Dm", "Cm", "Bb", "Eb", "Dm", "Cm", "F7"],
      lead: [
        "Bb5 - - - G5 - - -",
        "A5 - - - F5 - - -",
        "G5 - - - Eb5 - - -",
        "F5 - - - D5 - - -",
        "Eb5 - G5 - Bb5 - - -",
        "D5 - F5 - A5 - - -",
        "C5 - Eb5 - G5 - Bb5 -",
        "A5 - - - Eb5 - C5 -",
      ],
    },
  ],
});
