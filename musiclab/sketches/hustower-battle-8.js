// 戦闘曲 8「調律の塔」: 変ロ短調・184 BPM。頂上へ駆け上がる。
import { makeSong } from "../lib/song.js";

export default makeSong({
  title: "戦闘曲 8「調律の塔」",
  description: "変ロ短調・184 BPM。A は i–III–VII–IV（IV が長三和音のドリアン）、サビは VI–III–VII–i、C メロは経過の減七（iv–♯iv°7–V7）で半音ずつせり上がる。",
  bpm: 184,
  mood: "battle",
  inst: { 0: "square", 1: "synth-bass", 6: "choir", 7: "fm-brass" },
  sections: [
    {
      name: "A", prog: "ドリアン i–III–VII–IV",
      chords: ["Bbm", "Db", "Ab", "Eb", "Bbm", "Db", "Ab", "F"],
      lead: [
        "Bb4 Bb4 Db5 F5 Bb5 . F5 Db5",
        "Ab5 . F5 Db5 Ab4 . Db5 F5",
        "Eb5 . C5 Ab4 Eb5 . Ab5 C6",
        "Bb5 - G5 - Eb5 - . .",
        "F5 . Bb5 . Db6 - Bb5 Db6",
        "Ab5 - - - F5 - Db5 -",
        "C6 - Eb6 - Ab5 - - .",
        "A5 - - - C6 - Eb6 -",
      ],
    },
    {
      name: "サビ", prog: "VI–III–VII–i",
      chords: ["Gb", "Db", "Ab", "Bbm", "Gb", "Db", "Ab", "F"],
      lead: [
        "Db6 - - - Bb5 - Gb5 -",
        "F5 - Ab5 - Db6 - - -",
        "C6 - - - Eb6 - C6 -",
        "Db6 - - - Bb5 - F5 -",
        "Gb5 - Bb5 - Db6 - Bb5 -",
        "Ab5 - - - F5 - Ab5 -",
        "Eb6 - - - C6 - Ab5 -",
        "C6 - - - A5 - - -",
      ],
    },
    {
      name: "C メロ", prog: "経過の減七 iv–♯iv°7–V7",
      chords: ["Ebm", "Edim7", "F7", "Bbm", "Gb", "Edim7", "F", "F7"],
      lead: [
        "Bb5 - - - Gb5 - Eb5 -",
        "Db6 - - - Bb5 - G5 -",
        "C6 - - - A5 - - -",
        "Bb5 - - - F5 - Db5 -",
        "Db6 - - - Bb5 - Gb5 -",
        "G5 - Bb5 - Db6 - - -",
        "C6 - - - A5 - F5 -",
        "A5 - - - Eb5 - C5 -",
      ],
    },
  ],
});
