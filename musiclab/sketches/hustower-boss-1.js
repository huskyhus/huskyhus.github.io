// ボス戦曲 1「魔王」: ハ短調・150 BPM。重く、禍々しい。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "ボス戦曲 1「魔王」",
  description: "ハ短調・150 BPM。A はフリジアンの i–♭II（半音上の和音で不気味に）、サビは減七の和音で緊張を引っぱり、C メロは平行長調の王道進行で悲壮に。",
  bpm: 150,
  mood: "boss",
  sections: [
    {
      name: "A", prog: "フリジアン i–♭II",
      chords: ["Cm", "Db", "Cm", "Db", "Ab", "Db", "G", "G"],
      lead: [
        "C5 . C5 . Eb5 . G5 .",
        "Ab5 - F5 - Db5 . C5 .",
        "C5 . Eb5 . G5 . C6 .",
        "Db6 - Ab5 - F5 - Db5 -",
        "C6 . Ab5 . Eb5 . C5 .",
        "Db5 . F5 . Ab5 . Db6 .",
        "B5 - - - D6 - - .",
        "G5 - F5 - D5 - B4 -",
      ],
    },
    {
      name: "サビ", prog: "減七の和音",
      chords: ["Cm", "Bdim7", "Cm", "Bdim7", "Ab", "Fm", "Ddim", "G7"],
      lead: [
        "G5 - - - Eb5 - C5 -",
        "Ab5 - - - F5 - D5 -",
        "G5 - C6 - Eb6 - - .",
        "D6 - B5 - Ab5 - F5 -",
        "Eb5 - Ab5 - C6 - - .",
        "C6 - Ab5 - F5 - Ab5 C6",
        "F5 - D5 - Ab5 - - .",
        "B5 - - - D6 - F6 -",
      ],
    },
    {
      name: "C メロ", prog: "王道進行（平行長調）",
      chords: ["Ab", "Bb", "Gm", "Cm", "Ab", "Bb", "G", "G"],
      lead: [
        "C6 - - - Eb6 - - -",
        "D6 - - - F6 - D6 -",
        "D6 - - - Bb5 - G5 -",
        "Eb6 - - - C6 - - .",
        "Ab5 - C6 - Eb6 - C6 -",
        "Bb5 - D6 - F6 - D6 -",
        "D6 - - - B5 - G5 -",
        "B5 - - - - - . .",
      ],
    },
  ],
});
