// 戦闘曲 7「夜の森の影」: ヘ短調・158 BPM。暗がりから何かが迫る。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 7「夜の森の影」",
  description: "ヘ短調・158 BPM。A は自然短音階の i–iv–v（属和音が短三和音で、引っぱりが弱く暗い）、サビは VI–iv–i–V で劇的に、C メロはナポリの和音（♭II）から V7 へ。",
  bpm: 158,
  mood: "battle",
  inst: { 0: "pulse12", 6: "choir-ooh", 10: "oboe" },
  sections: [
    {
      name: "A", prog: "自然短音階 i–iv–v",
      chords: ["Fm", "Bbm", "Cm", "Fm", "Fm", "Bbm", "Cm", "C"],
      lead: [
        "C5 . F5 Ab5 C6 . Ab5 F5",
        "Db6 . Bb5 F5 Db5 . F5 Ab5",
        "C6 . G5 Eb5 C5 . Eb5 G5",
        "Ab5 - - - F5 - . .",
        "F5 . Ab5 . C6 . Ab5 C6",
        "Db6 - - - Bb5 - F5 -",
        "Eb5 - G5 - C6 - Bb5 G5",
        "E5 - - - G5 - Bb5 -",
      ],
    },
    {
      name: "サビ", prog: "VI–iv–i–V",
      chords: ["Db", "Bbm", "Fm", "C", "Db", "Bbm", "Fm", "C"],
      lead: [
        "Ab5 - - - F5 - Db5 -",
        "F5 - - - Bb5 - Db6 -",
        "C6 - - - Ab5 - F5 -",
        "E5 - - - G5 - - -",
        "F5 - Ab5 - Db6 - - -",
        "Db6 - - - Bb5 - F5 -",
        "Ab5 - - - C6 - Ab5 -",
        "G5 - Bb5 - E5 - G5 -",
      ],
    },
    {
      name: "C メロ", prog: "ナポリの和音 ♭II–V7–i",
      chords: ["Gb", "C7", "Fm", "Fm", "Db", "Gb", "C", "C7"],
      lead: [
        "Bb5 - - - Gb5 - Db5 -",
        "E5 - - - G5 - C6 -",
        "Ab5 - - - F5 - - -",
        "C6 - - - . . . .",
        "Db6 - - - Ab5 - F5 -",
        "Gb5 - Bb5 - Db6 - - -",
        "C6 - - - G5 - E5 -",
        "Bb5 - - - G5 - E5 -",
      ],
    },
  ],
});
