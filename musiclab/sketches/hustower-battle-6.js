// 戦闘曲 6「草原の追走」: 嬰ハ短調・176 BPM。風を切って追いかける。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 6「草原の追走」",
  description: "嬰ハ短調・176 BPM。A はロックの i–VII–VI–VII、サビは短調のカノン風の下降（i–v–VI–III–iv–i–iv–V7）、C メロは iv–v–VI–VII と 1 段ずつ上る。",
  bpm: 176,
  mood: "battle",
  inst: { 0: "pulse40", 11: "banjo" },
  sections: [
    {
      name: "A", prog: "ロック i–VII–VI–VII",
      chords: ["C#m", "B", "A", "B", "C#m", "B", "A", "G#7"],
      lead: [
        "C#5 C#5 . E5 G#5 . E5 C#5",
        "D#5 D#5 . F#5 B5 . F#5 D#5",
        "C#5 C#5 . E5 A5 . E5 C#5",
        "B4 - D#5 - F#5 - - .",
        "E5 E5 . G#5 C#6 . B5 G#5",
        "D#6 - B5 - F#5 - . .",
        "E5 . A5 . C#6 - B5 C#6",
        "G#5 - C6 - D#6 - - .",
      ],
    },
    {
      name: "サビ", prog: "短調のカノン風の下降",
      chords: ["C#m", "G#m", "A", "E", "F#m", "C#m", "F#m", "G#"],
      lead: [
        "E6 - - - C#6 - G#5 -",
        "D#6 - - - B5 - G#5 -",
        "C#6 - - - E6 - C#6 -",
        "B5 - - - G#5 - E5 -",
        "A5 - - - C#6 - A5 -",
        "G#5 - - - E5 - G#5 -",
        "F#5 - A5 - C#6 - - -",
        "C6 - - - D#6 - G#5 -",
      ],
    },
    {
      name: "C メロ", prog: "上行 iv–v–VI–VII",
      chords: ["F#m", "G#m", "A", "B", "F#m", "G#m", "A", "G#7"],
      lead: [
        "A5 - - - F#5 - - -",
        "B5 - - - G#5 - - -",
        "C#6 - - - A5 - - -",
        "D#6 - - - B5 - - -",
        "C#6 - A5 - F#5 - A5 -",
        "D#6 - B5 - G#5 - B5 -",
        "E6 - C#6 - A5 - C#6 -",
        "C6 - - - G#5 - - -",
      ],
    },
  ],
});
