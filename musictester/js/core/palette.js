// 調ごとのコードパレットの中身。どれも保存形のコードで返す。

const scaleChord = (deg, size, harmonic) => ({ kind: "scale", deg, size, harmonic });

/** ダイアトニックコード。短調は自然短音階の 7 つに、和声短音階由来の V と vii° を足す */
export function diatonicChords(mode, size) {
  if (mode === "major") {
    return [1, 2, 3, 4, 5, 6, 7].map(deg => scaleChord(deg, size, deg === 5 || deg === 7));
  }
  return [
    scaleChord(1, size, false),
    scaleChord(2, size, false),
    scaleChord(3, size, false),
    scaleChord(4, size, false),
    scaleChord(5, size, false),
    scaleChord(5, size, true),
    scaleChord(6, size, false),
    scaleChord(7, size, false),
    scaleChord(7, size, true),
  ];
}

/** セカンダリードミナント。行き先は長短それぞれの、長三和音か短三和音になる度数 */
export function secondaryChords(mode, size) {
  const targets = mode === "major" ? [2, 3, 4, 5, 6] : [3, 4, 5, 6, 7];
  return targets.map(target => ({ kind: "sec", target, size }));
}

// 同主調からの借用: [主音からの半音, 音名の進み, 三和音, 四和音]
const BORROWED = {
  major: [
    [5, 3, "min", "m7"],      // iv
    [3, 2, "maj", "maj7"],    // ♭III
    [8, 5, "maj", "maj7"],    // ♭VI
    [10, 6, "maj", "7"],      // ♭VII
    [2, 1, "dim", "m7b5"],    // ii°
    [0, 0, "min", "m7"],      // i
    [7, 4, "min", "m7"],      // v
    [1, 1, "maj", "maj7"],    // ♭II（ナポリ）
  ],
  minor: [
    [0, 0, "maj", "maj7"],    // I（ピカルディ）
    [5, 3, "maj", "7"],       // IV（ドリア）
    [2, 1, "min", "m7"],      // ii
    [9, 5, "min", "m7"],      // vi
    [4, 2, "min", "m7"],      // iii
    [1, 1, "maj", "maj7"],    // ♭II（ナポリ）
  ],
};

export function borrowedChords(mode, size) {
  return BORROWED[mode].map(([semi, letter, triad, seventh]) =>
    ({ kind: "abs", semi, letter, quality: size === 4 ? seventh : triad }));
}

