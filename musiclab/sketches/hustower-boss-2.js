// ボス戦曲 2「最終決戦」: 嬰ヘ短調・190 BPM。最後の戦い。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "ボス戦曲 2「最終決戦」",
  description: "嬰ヘ短調・190 BPM。A は三全音（悪魔の音程）離れた F#m と C を行き来し、サビはエピック進行、C メロは ♭VI–♭VII から主和音を長三和音にして（ピカルディ終止）希望を見せる。",
  bpm: 190,
  mood: "boss",
  inst: { 0: "square", 6: "strings", 7: "fm-brass" },
  sections: [
    {
      name: "A", prog: "三全音 i–♭V",
      chords: ["F#m", "C", "F#m", "C", "D", "E", "C#7", "C#7"],
      lead: [
        "F#5 . F#5 . A5 . C#6 .",
        "C6 . G5 . E5 . C5 .",
        "A5 . C#6 . F#6 - E6 C#6",
        "E6 - - - C6 - G5 -",
        "F#5 . A5 . D6 . A5 F#5",
        "G#5 . B5 . E6 . B5 G#5",
        "C#6 - - - G#5 - F5 -",
        "G#5 - - - B5 - C#6 -",
      ],
    },
    {
      name: "サビ", prog: "エピック進行 i–VI–III–VII",
      chords: ["F#m", "D", "A", "E", "F#m", "D", "A", "E"],
      lead: [
        "C#6 - - - A5 - F#5 -",
        "F#5 - A5 - D6 - - .",
        "E6 - C#6 - A5 - - .",
        "B5 - G#5 - E5 - G#5 B5",
        "C#6 - F#6 - E6 - C#6 -",
        "D6 - A5 - F#5 - A5 D6",
        "C#6 - E6 - A6 - - .",
        "G#6 - - - E6 - B5 -",
      ],
    },
    {
      name: "C メロ", prog: "♭VI–♭VII–I（ピカルディ終止）",
      chords: ["D", "E", "F#m", "F#m", "D", "E", "F#", "F#"],
      lead: [
        "A5 - - - D6 - F#6 -",
        "E6 - - - B5 - G#5 -",
        "A5 - - - C#6 - - -",
        "F#6 - E6 - C#6 - A5 -",
        "F#5 - A5 - D6 - - -",
        "E6 - G#5 - B5 - - -",
        "A#5 - - - C#6 - - -",
        "F#6 - - - - - . .",
      ],
    },
  ],
});
