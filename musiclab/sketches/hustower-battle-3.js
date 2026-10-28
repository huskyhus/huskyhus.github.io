// 戦闘曲 3「迷宮」: ニ短調・172 BPM。緊張感があって、少し大人っぽい。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 3「迷宮」",
  description: "ニ短調・172 BPM。A はマイナークリシェ（Dm → DmM7 → Dm7 → Dm6 と内声が半音ずつ下がる）、サビは短調のツーファイブ（iiø7–V7–i）、C メロはカノン進行で平行長調へ。",
  bpm: 172,
  mood: "battle",
  inst: { 0: "pulse18", 7: "sawtooth" },
  sections: [
    {
      name: "A", prog: "マイナークリシェ",
      chords: ["Dm", "DmM7", "Dm7", "Dm6", "Bb", "Gm", "A", "A"],
      lead: [
        "D5 . F5 . A5 . F5 D5",
        "C#5 . E5 . A5 . E5 C#5",
        "C5 . F5 . A5 . F5 C5",
        "B4 . D5 . F5 . A5 B5",
        "Bb5 . F5 . D5 . F5 Bb5",
        "G5 . D5 . Bb4 . D5 G5",
        "A5 - E5 - C#5 - E5 G5",
        "A5 - - - C#6 - E6 -",
      ],
    },
    {
      name: "サビ", prog: "短調のツーファイブ iiø7–V7–i",
      chords: ["Em7b5", "A7", "Dm", "Dm", "Em7b5", "A7", "Dm", "C7"],
      lead: [
        "G5 - E5 - Bb4 - D5 -",
        "C#5 - E5 - G5 - - .",
        "F5 - - - D5 - A4 -",
        "D5 - E5 - F5 - A5 -",
        "Bb5 - G5 - E5 - D5 -",
        "C#5 - E5 - A5 - G5 -",
        "F5 - - - A5 - D6 -",
        "E5 - - - G5 - Bb5 -",
      ],
    },
    {
      name: "C メロ", prog: "カノン進行（平行長調）",
      chords: ["F", "C", "Dm", "Am", "Bb", "F", "Bb", "C"],
      lead: [
        "A5 - - - C6 - A5 -",
        "G5 - - - E5 - C5 -",
        "F5 - - - A5 - D6 -",
        "C6 - - - A5 - E5 -",
        "D6 - - - Bb5 - F5 -",
        "C6 - - - A5 - F5 -",
        "F5 - G5 - Bb5 - D6 -",
        "E6 - - - C6 - G5 -",
      ],
    },
  ],
});
