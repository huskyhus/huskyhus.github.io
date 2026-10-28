// 通常曲 2「草原」: ト長調・112 BPM。のどかで、少し懐かしい。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 2「草原」",
  description: "ト長調・112 BPM。A はカノン進行、サビは循環進行（I–vi–ii–V）、C メロはサブドミナントマイナー（IV → iv）で切なく。",
  bpm: 112,
  mood: "normal",
  inst: { 3: "fm-marimba", 7: "guitar" },
  sections: [
    {
      name: "A", prog: "カノン進行",
      chords: ["G", "D", "Em", "Bm", "C", "G", "C", "D"],
      lead: [
        "B4 . D5 . G5 - F#5 E5",
        "F#5 - A4 - D5 . E5 F#5",
        "G5 . E5 . B4 - C5 D5",
        "D5 - F#4 - B4 . A4 B4",
        "C5 . E5 . G5 - A5 G5",
        "G5 . D5 . B4 - A4 G4",
        "E5 . G5 . C6 - B5 A5",
        "A5 - F#5 - D5 . . .",
      ],
    },
    {
      name: "サビ", prog: "循環進行 I–vi–ii–V",
      chords: ["G", "Em", "Am", "D", "G", "Em", "Am", "D"],
      lead: [
        "D5 . G5 . B5 - A5 G5",
        "E5 . G5 . B5 - - .",
        "C6 . B5 A5 E5 - A5 -",
        "F#5 - E5 - D5 . A4 C5",
        "B4 . D5 G5 B5 - A5 G5",
        "G5 . E5 . B4 . E5 G5",
        "A5 - G5 - E5 - C5 -",
        "D5 - - - F#5 - A5 -",
      ],
    },
    {
      name: "C メロ", prog: "サブドミナントマイナー IV–iv–I",
      chords: ["C", "Cm", "G", "Em", "Am", "Cm", "G", "D"],
      lead: [
        "E5 - - - G5 - C6 -",
        "Eb5 - - - G5 - C6 -",
        "D6 - B5 - G5 - - .",
        "B5 - G5 - E5 - D5 E5",
        "C6 - - - A5 - E5 -",
        "G5 - - - Eb5 - C5 -",
        "D5 - - - B4 - D5 G5",
        "F#5 - - - A5 - - -",
      ],
    },
  ],
});
