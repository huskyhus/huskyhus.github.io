// 通常曲 6「遺跡」: 変ホ長調・100 BPM。古くて、少し不思議。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 6「遺跡」",
  description: "変ホ長調・100 BPM。A はミクソリディアの I–♭VII–IV（長調なのに ♭VII）、サビはリディアの I–II（II が長三和音で、まぶしく浮く）、C メロは偽終止（V7 → vi）で着地をはぐらかす。",
  bpm: 100,
  mood: "normal",
  inst: { 3: "marimba", 6: "choir-ooh", 10: "panflute", 12: "bassoon" },
  sections: [
    {
      name: "A", prog: "ミクソリディア I–♭VII–IV",
      chords: ["Eb", "Db", "Ab", "Eb", "Eb", "Db", "Ab", "Bb"],
      lead: [
        "G4 - Bb4 - Eb5 - - .",
        "F5 - - - Db5 - Ab4 -",
        "C5 - Eb5 - Ab5 - G5 F5",
        "G5 - - - . . . .",
        "Bb4 - Eb5 - G5 - Bb5 -",
        "F5 - Ab5 - Db6 - - .",
        "Eb5 - C5 - Ab4 - C5 -",
        "D5 - - - F5 - - -",
      ],
    },
    {
      name: "サビ", prog: "リディア I–II",
      chords: ["Eb", "F", "Ab", "Eb", "Eb", "F", "Ab", "Bb"],
      lead: [
        "G5 - - - Bb5 - G5 -",
        "C6 - - - A5 - F5 -",
        "Eb5 - Ab5 - C6 - Bb5 Ab5",
        "G5 - - - Eb5 - . .",
        "Eb6 - - - Bb5 - G5 -",
        "A5 - - - C6 - A5 -",
        "Ab5 - - - Eb5 - C5 -",
        "D5 - F5 - Bb5 - - -",
      ],
    },
    {
      name: "C メロ", prog: "偽終止 V7 → vi",
      chords: ["Ab", "Bb7", "Cm", "Gm", "Ab", "Bb7", "Cm", "Bb7"],
      lead: [
        "C5 - - - Eb5 - - -",
        "D5 - - - Ab5 - - -",
        "G5 - - - Eb5 - - -",
        "D5 - - - Bb4 - - -",
        "C5 - Eb5 - Ab5 - - -",
        "D6 - - - Ab5 - - -",
        "G5 - - - C6 - - -",
        "D6 - - - Ab5 - F5 -",
      ],
    },
  ],
});
