// 通常曲 3「街」: ヘ長調・128 BPM。にぎやかで、ちょっとおしゃれ。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 3「街」",
  description: "ヘ長調・128 BPM。A は Axis 進行（I–V–vi–IV）、サビはツーファイブ（ii7–V7–I△7）でジャズっぽく、C メロはブルース進行。",
  bpm: 128,
  mood: "normal",
  inst: { 0: "pulse40", 1: "upright-bass", 6: "fm-organ" },
  sections: [
    {
      name: "A", prog: "Axis 進行 I–V–vi–IV",
      chords: ["F", "C", "Dm", "Bb", "F", "C", "Dm", "Bb"],
      lead: [
        "C5 . F5 . A5 . G5 F5",
        "E5 . G5 . C5 - . .",
        "D5 . F5 . A5 . G5 F5",
        "D5 - Bb4 - F5 . . .",
        "C5 . F5 . A5 . C6 A5",
        "G5 . E5 . C5 . E5 G5",
        "F5 . D5 . A4 . D5 F5",
        "F5 - D5 - Bb4 . C5 .",
      ],
    },
    {
      name: "サビ", prog: "ツーファイブ ii7–V7–I△7",
      chords: ["Gm7", "C7", "Fmaj7", "Dm7", "Gm7", "C7", "Am7", "C7"],
      lead: [
        "Bb4 . D5 . F5 . D5 Bb4",
        "Bb4 - G4 - E5 . C5 .",
        "A4 - C5 - E5 - - .",
        "F5 . E5 D5 C5 . A4 .",
        "G4 . Bb4 . D5 . F5 E5",
        "E5 - Bb4 - G5 - . .",
        "G5 . E5 . C5 . A4 .",
        "E5 - - - G5 - Bb5 -",
      ],
    },
    {
      name: "C メロ", prog: "ブルース進行（8 小節）",
      chords: ["F7", "Bb7", "F7", "F7", "Bb7", "Bb7", "F7", "C7"],
      lead: [
        "A4 - C5 - Eb5 - C5 A4",
        "Ab4 - F4 - D5 - - .",
        "C5 . F5 . A5 . Ab5 F5",
        "Eb5 - C5 - - . . .",
        "D5 - F5 - Ab5 - F5 D5",
        "Bb4 - - - . D5 F5 Ab5",
        "A5 - F5 - C5 - A4 C5",
        "E5 - - - G5 - Bb5 -",
      ],
    },
  ],
});
