// 光と影の合奏: 長調と短調が混在する曲の例（ハ長調 / ハ短調、104 BPM、32 小節）。
// A は光（ハ長調）だけ、B は影（ハ短調）だけで、同じ旋律を鳴らす。主音（ド）は同じで、ミ・ラ・シが ♭ になるだけ。
// C は長調の旋律に、ハ短調から借りた和音（iv・♭VI・♭VII・iiø7）を混ぜる。
// D は影の和音を通って、最後は ♭VI → ♭VII から光の主和音（C）へ（ループして A の C に着地する）。
import { lightShadowSong } from "../lib/lightshadow.js";

const SECTIONS = [
  {
    name: "A 光（ハ長調）", side: "light",
    chords: ["C", "G", "Am", "F", "C", "G", "F", "G"],
    lead: [
      "C5 . G4 C5 E5 . D5 C5",
      "D5 . B4 G4 D5 - . .",
      "E5 . C5 A4 E5 F5 E5 D5",
      "C5 - A4 - C5 . D5 .",
      "C5 . G4 C5 E5 . G5 E5",
      "F5 . D5 B4 G5 - F5 E5",
      "D5 . C5 A4 F5 E5 D5 C5",
      "D5 . . B4 G4 . . .",
    ],
  },
  {
    // A と同じ旋律を、ハ短調で（ミ → ミ♭、ラ → ラ♭。G の和音の上だけは、主音へ戻る力が強いシのまま = 和声的短音階）
    name: "B 影（ハ短調）", side: "shadow",
    chords: ["Cm", "G", "Ab", "Fm", "Cm", "G", "Fm", "G"],
    lead: [
      "C5 . G4 C5 Eb5 . D5 C5",
      "D5 . B4 G4 D5 - . .",
      "Eb5 . C5 Ab4 Eb5 F5 Eb5 D5",
      "C5 - Ab4 - C5 . D5 .",
      "C5 . G4 C5 Eb5 . G5 Eb5",
      "F5 . D5 B4 G5 - F5 Eb5",
      "D5 . C5 Ab4 F5 Eb5 D5 C5",
      "D5 . . B4 G4 . . .",
    ],
  },
  {
    // 長調の和音と、ハ短調から借りた和音が交互に出てくる。F → Fm でラがラ♭に沈むのが聴きどころ
    name: "C 合奏（借用和音）", side: "both",
    chords: ["F", "Fm", "C", "Ab", "Bb", "C", "Dm7b5", "G7"],
    lead: [
      "A5 - - - F5 - C5 F5",
      "Ab5 - - - F5 - C5 -",
      "G5 - E5 - C5 - - .",
      "Eb5 - - - C5 - Ab4 -",
      "D5 - F5 - Bb5 - - .",
      "C6 - G5 - E5 - G5 -",
      "Ab5 - F5 - D5 - C5 -",
      "B4 - D5 - F5 - G5 -",
    ],
  },
  {
    // 影の和音（Ab・Bb・Cm・Fm）を通って、最後は ♭VI → ♭VII → I。短調の流れから、長調の主和音で終わる
    name: "D フィナーレ（♭VI–♭VII–I）", side: "both",
    chords: ["Ab", "Bb", "Cm", "Fm", "Ab", "Bb", "C", "C"],
    lead: [
      "C6 - - - Ab5 - Eb5 -",
      "D6 - - - Bb5 - F5 -",
      "Eb6 - - - C6 - G5 -",
      "F5 - Ab5 - C6 - F6 -",
      "Eb6 - - - C6 - Ab5 -",
      "D6 - - - F6 - D6 -",
      "E6 - - - C6 - G5 -",
      "C6 - - - - - . .",
    ],
  },
];

export default lightShadowSong({
  title: "光と影の合奏（長調と短調の混在）",
  description: "ハ長調（光）とハ短調（影）は主音が同じ。A は光だけ、B は同じ旋律を影だけで、C は長調の旋律にハ短調から借りた和音を混ぜ、D は影の和音を通って光の主和音へ。",
  bpm: 104,
  sections: SECTIONS,
});
