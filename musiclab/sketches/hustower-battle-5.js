// 戦闘曲 5「影の城」: ロ短調・164 BPM。重々しく、でも前へ進む。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 5「影の城」",
  description: "ロ短調・164 BPM。A は短調の 5 度圏進行（i–iv–VII–III–VI–ii°–V7–i）、サビはエオリアン終止（VI–VII–i）、C メロは同主長調のロ長調へ開ける（影の城の中で、光の和音が鳴る）。",
  bpm: 164,
  mood: "battle",
  inst: { 6: "choir" },
  sections: [
    {
      name: "A", prog: "短調の 5 度圏進行",
      chords: ["Bm", "Em", "A", "D", "G", "C#dim", "F#7", "Bm"],
      lead: [
        "F#5 . F#5 D5 B4 . D5 F#5",
        "G5 . G5 E5 B4 . E5 G5",
        "A5 . A5 E5 C#5 . E5 A5",
        "F#5 - - - D5 - A4 -",
        "B4 . B4 D5 G5 . F#5 G5",
        "E5 . G5 . C#6 - - .",
        "C#6 - - - A#5 - F#5 E5",
        "B5 - - - . . . .",
      ],
    },
    {
      name: "サビ", prog: "エオリアン終止 VI–VII–i",
      chords: ["G", "A", "Bm", "Bm", "G", "A", "F#", "F#7"],
      lead: [
        "D6 - - - B5 - G5 -",
        "C#6 - - - E6 - A5 -",
        "F#5 - B5 - D6 - - -",
        "D6 - B5 - F#5 - D5 -",
        "G5 - B5 - D6 - - -",
        "E6 - - - C#6 - A5 -",
        "C#6 - - - A#5 - - -",
        "E6 - - - C#6 - A#5 -",
      ],
    },
    {
      name: "C メロ", prog: "同主長調へ i → I", mode: "ロ長調",
      chords: ["B", "G#m", "E", "F#", "B", "G#m", "E", "F#7"],
      lead: [
        "B5 - - - D#6 - - -",
        "D#6 - - - B5 - G#5 -",
        "G#5 - - - B5 - E6 -",
        "C#6 - - - A#5 - - -",
        "F#5 - B5 - D#6 - - -",
        "D#6 - - - G#5 - B5 -",
        "E6 - - - B5 - G#5 -",
        "C#6 - - - A#5 - - -",
      ],
    },
  ],
});
