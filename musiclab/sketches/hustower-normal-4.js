// 通常曲 4「夜」: ニ長調・96 BPM。静かで、しっとり。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 4「夜」",
  description: "ニ長調・96 BPM。A はメジャークリシェ（D → D△7 → D7 と内声が半音ずつ下がる）、サビは王道進行、C メロはマリオ終止（♭VI–♭VII–I）で明るく抜ける。",
  bpm: 96,
  mood: "normal",
  inst: { 0: "pulse12", 3: "vibraphone", 7: "piano" },
  sections: [
    {
      name: "A", prog: "メジャークリシェ",
      chords: ["D", "Dmaj7", "D7", "G", "Gm", "D", "A", "A"],
      lead: [
        "F#4 - A4 - D5 - - .",
        "C#5 - - - A4 - F#4 -",
        "C5 - - - A4 - F#4 A4",
        "B4 - - - D5 - G5 -",
        "Bb4 - - - D5 - G5 F5",
        "F#5 - - - D5 - A4 -",
        "E5 - C#5 - A4 - B4 C#5",
        "E5 - - - . . . .",
      ],
    },
    {
      name: "サビ", prog: "王道進行 IV–V–iii–vi",
      chords: ["G", "A", "F#m", "Bm", "G", "A", "D", "D"],
      lead: [
        "D5 . B4 . G4 . B4 D5",
        "E5 . C#5 . A4 . C#5 E5",
        "F#5 - - - C#5 - A4 -",
        "B4 - D5 - F#5 - - .",
        "G5 . F#5 . D5 . B4 D5",
        "E5 . A5 . C#6 - B5 A5",
        "F#5 - - - A5 - - .",
        "D5 - - - . . . .",
      ],
    },
    {
      name: "C メロ", prog: "小室進行 → マリオ終止 ♭VI–♭VII–I",
      chords: ["Bm", "G", "A", "D", "Bb", "C", "D", "D"],
      lead: [
        "D5 - - - F#5 - B5 -",
        "B5 - - - G5 - D5 -",
        "C#5 - E5 - A5 - G5 -",
        "F#5 - - - D5 - - .",
        "D5 - F5 - Bb5 - - -",
        "C6 - - - G5 - E5 -",
        "F#5 - A5 - D6 - - -",
        "D6 - - - - - . .",
      ],
    },
  ],
});
