// 通常曲 7「歌の広場」: イ長調・116 BPM。のびのびと、お祭りの前の高揚。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "通常曲 7「歌の広場」",
  description: "イ長調・116 BPM。A は I–IV の行き来（プラガル）、サビは IV–V–vi と上って主和音へ。最後の F7 を足がかりに、C メロは半音上の変ロ長調へ転調し、E7 でイ長調に戻る。",
  bpm: 116,
  mood: "normal",
  inst: { 7: "guitar", 10: "whistle" },
  sections: [
    {
      name: "A", prog: "プラガル I–IV",
      chords: ["A", "D", "A", "D", "F#m", "D", "E", "E"],
      lead: [
        "C#5 - E5 - A5 - E5 C#5",
        "F#5 - - - D5 - . .",
        "C#5 - E5 - A5 - F#5 E5",
        "F#5 - - - . . . .",
        "A4 - C#5 - F#5 - E5 C#5",
        "D5 - F#5 - A5 - - .",
        "G#5 - - - E5 - B4 -",
        "B4 - - - . . . .",
      ],
    },
    {
      name: "サビ", prog: "上行 IV–V–vi–I",
      chords: ["D", "E", "F#m", "A", "D", "E", "F#m", "F"],
      lead: [
        "A5 - - - F#5 - D5 -",
        "B5 - - - G#5 - E5 -",
        "C#6 - - - A5 - F#5 -",
        "E6 - - - C#6 - . .",
        "D6 - - - A5 - F#5 -",
        "B5 - - - E6 - D6 B5",
        "A5 - - - C#6 - A5 -",
        "C6 - - - A5 - F5 -",
      ],
    },
    {
      name: "C メロ", prog: "半音上への転調", mode: "変ロ長調",
      chords: ["Eb", "F", "Bb", "Gm", "Eb", "F", "Bb", "E7"],
      lead: [
        "Bb5 - - - G5 - - -",
        "A5 - - - C6 - - -",
        "D6 - - - Bb5 - F5 -",
        "G5 - - - Bb5 - D6 -",
        "Eb6 - - - Bb5 - G5 -",
        "F5 - A5 - C6 - A5 -",
        "Bb5 - - - F5 - D5 -",
        "G#5 - - - B5 - - -",
      ],
    },
  ],
});
