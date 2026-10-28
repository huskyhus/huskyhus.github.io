// 戦闘曲 2「疾走」: ホ短調・168 BPM。まっすぐ突っ走る。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 2「疾走」",
  description: "ホ短調・168 BPM。A はエピック進行（i–VI–III–VII）、サビは小室進行（vi–IV–V–I）で平行長調に開け、C メロは王道進行。",
  bpm: 168,
  mood: "battle",
  inst: { 6: "strings" },
  sections: [
    {
      name: "A", prog: "エピック進行 i–VI–III–VII",
      chords: ["Em", "C", "G", "D", "Em", "C", "G", "D"],
      lead: [
        "E5 . E5 G5 B5 . A5 G5",
        "E5 . C5 . G5 - E5 .",
        "D5 . B4 D5 G5 . F#5 G5",
        "A5 - F#5 - D5 . E5 F#5",
        "G5 . E5 G5 B5 . E6 D6",
        "C6 . G5 . E5 . G5 C6",
        "B5 . G5 . D5 . G5 B5",
        "A5 - - - F#5 - D5 -",
      ],
    },
    {
      name: "サビ", prog: "小室進行 vi–IV–V–I",
      chords: ["Em", "C", "D", "G", "Em", "C", "D", "G"],
      lead: [
        "B5 - - - G5 - E5 -",
        "E5 - G5 - C6 - - .",
        "A5 - F#5 - D5 - F#5 A5",
        "B5 - - - D6 - - .",
        "E6 - D6 - B5 - G5 -",
        "G5 - E5 - C5 - E5 G5",
        "F#5 - A5 - D6 - C6 -",
        "B5 - - - G5 - - .",
      ],
    },
    {
      name: "C メロ", prog: "王道進行 IV–V–iii–vi",
      chords: ["C", "D", "Bm", "Em", "C", "D", "B7", "B7"],
      lead: [
        "E5 - - - G5 - C6 -",
        "D6 - - - A5 - F#5 -",
        "F#5 - - - D5 - B4 -",
        "E5 - G5 - B5 - - .",
        "C6 - - - E6 - - -",
        "D6 - C6 - A5 - F#5 -",
        "D#6 - - - B5 - A5 -",
        "F#5 - - - D#5 - B4 -",
      ],
    },
  ],
});
