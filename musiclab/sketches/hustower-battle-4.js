// 戦闘曲 4「激突」: ト短調・176 BPM。荒々しくて、どこかブルージー。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 4「激突」",
  description: "ト短調・176 BPM。A はドリアンの i–IV（短調なのに IV が長三和音）、サビは短調の循環（i–VI–iv–V）、C メロはマイナーブルース。",
  bpm: 176,
  mood: "battle",
  inst: { 0: "pulse33", 1: "synth-bass" },
  sections: [
    {
      name: "A", prog: "ドリアン i–IV",
      chords: ["Gm", "C", "Gm", "C", "Gm", "C", "F", "D"],
      lead: [
        "G4 . Bb4 . D5 . G5 F5",
        "E5 . C5 . G4 . C5 E5",
        "D5 . G5 . Bb5 . A5 G5",
        "G5 . E5 . C5 - . .",
        "Bb4 . D5 G5 Bb5 . A5 G5",
        "E5 . G5 C6 E6 . D6 C6",
        "C6 . A5 F5 C5 . F5 A5",
        "F#5 - - - A5 - D6 -",
      ],
    },
    {
      name: "サビ", prog: "短調の循環 i–VI–iv–V",
      chords: ["Gm", "Eb", "Cm", "D", "Gm", "Eb", "Cm", "D"],
      lead: [
        "D6 - Bb5 - G5 - - .",
        "G5 - Bb5 - Eb6 - - .",
        "C6 - G5 - Eb5 - G5 C6",
        "A5 - F#5 - D5 - - .",
        "G5 . A5 Bb5 D6 - C6 Bb5",
        "Bb5 . G5 . Eb5 - G5 Bb5",
        "C6 - Bb5 - G5 - Eb5 -",
        "F#5 - - - D5 - A4 -",
      ],
    },
    {
      name: "C メロ", prog: "マイナーブルース",
      chords: ["Gm7", "Cm7", "Gm7", "Gm7", "Cm7", "Cm7", "D7", "D7"],
      lead: [
        "Bb4 - D5 - F5 - D5 Bb4",
        "Eb5 - - - C5 - G4 -",
        "G4 . Bb4 . Db5 . D5 .",
        "F5 - D5 - Bb4 - - .",
        "G5 - Eb5 - C5 - Bb4 C5",
        "Eb5 - - - G5 - Bb5 -",
        "A5 - F#5 - D5 - C5 -",
        "F#5 - - - A5 - C6 -",
      ],
    },
  ],
});
