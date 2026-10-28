// 通常曲 8「合同演奏会」: ホ長調・108 BPM。あたたかくて、少しだけ切ない。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 8「合同演奏会」",
  description: "ホ長調・108 BPM。A は VI7 を挟んだ循環（I–VI7–ii–V7。VI7 は ii へのセカンダリードミナント）、サビは逆循環（ii–V–iii–vi）、C メロはバックドア（iv–♭VII–I。同主短調から借りた和音で帰る）。",
  bpm: 108,
  mood: "normal",
  inst: { 6: "choir", 7: "piano", 10: "violin", 12: "horn" },
  sections: [
    {
      name: "A", prog: "I–VI7–ii–V7",
      chords: ["E", "C#7", "F#m", "B7", "E", "C#7", "F#m", "B"],
      lead: [
        "G#4 - B4 - E5 - G#5 -",
        "G#5 - - - F5 - C#5 -",
        "A5 - - - F#5 - C#5 -",
        "B4 - D#5 - F#5 - A5 -",
        "G#5 - - - E5 - . .",
        "F5 - G#5 - B5 - - .",
        "A5 - - - C#6 - A5 F#5",
        "F#5 - - - D#5 - . .",
      ],
    },
    {
      name: "サビ", prog: "逆循環 ii–V–iii–vi",
      chords: ["F#m", "B", "G#m", "C#m", "F#m", "B", "E", "A"],
      lead: [
        "C#5 - F#5 - A5 - - -",
        "B5 - - - F#5 - D#5 -",
        "D#5 - G#5 - B5 - - -",
        "C#6 - - - G#5 - E5 -",
        "F#5 - A5 - C#6 - - -",
        "D#6 - - - B5 - F#5 -",
        "G#5 - - - E6 - - -",
        "E6 - - - C#6 - A5 -",
      ],
    },
    {
      name: "C メロ", prog: "バックドア iv–♭VII–I",
      chords: ["Am", "D", "E", "E", "Am", "D", "B", "B7"],
      lead: [
        "C6 - - - A5 - E5 -",
        "F#5 - - - D6 - A5 -",
        "E6 - - - B5 - G#5 -",
        "B5 - - - . . . .",
        "A5 - C6 - E6 - - -",
        "D6 - - - A5 - F#5 -",
        "B5 - - - D#6 - B5 -",
        "A5 - - - D#5 - F#5 -",
      ],
    },
  ],
});
