// 有名なコード進行の辞書（ディグリー表記なので調に依存しない）と、次の候補を探す処理。
import { chordFromRoman, chordShape } from "./theory.js";
import { setBarChord, BARS_PER_SECTION, barChord } from "./song.js";

export const PROGRESSIONS = [
  {
    id: "canon", name: "カノン進行", mode: "major",
    degrees: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
    impression: "ゆったりと階段を降りていくような、優しく感動的な響き。",
    scene: "卒業ソング、ウェディング、エンディングなど、しみじみとした場面に。",
  },
  {
    id: "oudou", name: "王道進行", mode: "major",
    degrees: ["IV", "V", "iii", "vi"],
    impression: "IV から盛り上がり、主和音に帰らず vi に落ちる、切なさと高揚感が同居した響き。",
    scene: "J-POP やアニメソングのサビの定番。",
  },
  {
    id: "komuro", name: "小室進行", mode: "major",
    degrees: ["vi", "IV", "V", "I"],
    impression: "短調の陰りから始まって長調へ抜ける、疾走感のある切なさ。",
    scene: "90 年代 J-POP、ダンスミュージック、ゲームのオープニングに。",
  },
  {
    id: "axis", name: "I–V–vi–IV", mode: "major",
    degrees: ["I", "V", "vi", "IV"],
    impression: "明るく開放的で、どこまでもループできる万能の進行。",
    scene: "世界中のポップスやロックのヒット曲に。",
  },
  {
    id: "twofive", name: "ツーファイブワン", mode: "major",
    degrees: ["ii7", "V7", "IM7"],
    impression: "強進行が 2 回続く、スムーズで洗練された解決。",
    scene: "ジャズの基本形。おしゃれに区切りたい場面に。",
  },
  {
    id: "marusa", name: "丸サ進行", mode: "major",
    degrees: ["IVM7", "III7", "vim7", "I7"],
    impression: "セカンダリードミナントが連なる、都会的で気だるいグルーヴ。",
    scene: "シティポップやネオソウル風の楽曲に。",
  },
  {
    id: "victory", name: "♭VI–♭VII–I", mode: "major",
    degrees: ["♭VI", "♭VII", "I"],
    impression: "借用和音で階段を駆け上がり、主和音で視界が開ける、勝利と壮大さの響き。",
    scene: "ゲーム音楽のファンファーレやクライマックスに。",
  },
  {
    id: "aeolian", name: "i–♭VI–♭VII–i", mode: "minor",
    degrees: ["i", "♭VI", "♭VII", "i"],
    impression: "短調のまま力強く突き進む、ヒロイックで緊迫した響き。",
    scene: "バトル曲、ロック、映画の予告編に。",
  },
  {
    id: "cadence", name: "カデンツ（I–IV–V–I）", mode: "major",
    degrees: ["I", "IV", "V", "I"],
    impression: "T → S → D → T の機能和声のお手本。素直で安定した響き。",
    scene: "童謡や賛美歌など、わかりやすく終わりたい場面に。",
  },
  {
    id: "circle", name: "循環進行（I–vi–ii–V）", mode: "major",
    degrees: ["I", "vi", "ii", "V"],
    impression: "最後の V が先頭へ戻りたくなり、ずっと回り続けられる、懐かしい響き。",
    scene: "オールディーズやジャズのスタンダードに。",
  },
  {
    id: "reverse", name: "逆循環（iii–vi–ii–V）", mode: "major",
    degrees: ["iii", "vi", "ii", "V"],
    impression: "主和音を避けて強進行で降りていく、流れるような推進力。",
    scene: "サビ前やジャズのターンアラウンドに。",
  },
  {
    id: "minorsub", name: "サブドミナントマイナー（IV–iv–I）", mode: "major",
    degrees: ["IV", "iv", "I"],
    impression: "IV が iv に翳る瞬間の、胸がきゅっとなる切なさ。",
    scene: "バラードの終わりや、感情を込めたい場面に。",
  },
  {
    id: "rock", name: "ロック進行（I–♭VII–IV）", mode: "major",
    degrees: ["I", "♭VII", "IV"],
    impression: "導音を使わない、乾いたおおらかさ。",
    scene: "ロック、カントリー、冒険の始まりに。",
  },
  {
    id: "pachelbelminor", name: "短調のカノン", mode: "minor",
    degrees: ["i", "v", "♭VI", "♭III", "iv", "i", "iv", "V"],
    impression: "カノン進行の短調版。憂いを帯びた、バロック風の下降。",
    scene: "悲しい場面や、哀愁のあるイントロに。",
  },
  {
    id: "andalusian", name: "アンダルシア進行", mode: "minor",
    degrees: ["i", "♭VII", "♭VI", "V"],
    impression: "ベースが階段を降りて V に着く、情熱的でエキゾチックな響き。",
    scene: "フラメンコ風、ラテン、劇的なサビに。",
  },
  {
    id: "minortwofive", name: "短調のツーファイブ", mode: "minor",
    degrees: ["iiø7", "V7", "i"],
    impression: "不安定な ii° から強く解決する、ほの暗く洒落た響き。",
    scene: "マイナーキーのジャズや、大人っぽい切なさに。",
  },
  {
    id: "epic", name: "エピック進行", mode: "minor",
    degrees: ["i", "♭VI", "♭III", "♭VII"],
    impression: "悲壮感と希望が交互に現れる、映画音楽のような広がり。",
    scene: "壮大な映像音楽、バトルの導入に。",
  },
  {
    id: "minorcliche", name: "マイナークリシェ", mode: "minor",
    degrees: ["i", "iM7", "i7", "i6"],
    impression: "コードの中の 1 音だけが半音ずつ降りていく、しっとりした大人の響き。",
    scene: "ジャズやボサノバ、物憂げなイントロに。",
  },
];

/** 調 mode で使うときの保存形のコード。短調の進行を長調で使うときは借用和音として同じ響きを保つ */
export function progressionChords(prog, mode) {
  const parseMode = prog.mode === "minor" && mode === "minor" ? "minor" : "major";
  return prog.degrees.map(d => chordFromRoman(d, parseMode));
}

export const findProgression = id => PROGRESSIONS.find(p => p.id === id) || null;

/**
 * 直前のコードの並び sequence が辞書のどこかと一致していれば、次のコードの候補を返す。
 * 2 つ以上の一致なら進行の途中のどこでも。1 つだけなら、曲の最初のコードが進行の先頭と同じときだけ。
 * 返り値: [{ progression, next, matched, position }]（長く一致した順）
 */
export function suggestNext(sequence, mode) {
  if (sequence.length === 0) return [];
  const tail = sequence.map(c => chordShape(c, mode));
  const out = [];
  PROGRESSIONS.forEach((progression, order) => {
    const chords = progressionChords(progression, mode);
    const shapes = chords.map(c => chordShape(c, mode));
    let best = null;
    for (let end = 0; end < shapes.length - 1; end++) {
      let len = 0;
      while (len <= end && len < tail.length && shapes[end - len] === tail[tail.length - 1 - len]) len++;
      if (len === 0) continue;
      if (len === 1 && !(end === 0 && tail.length === 1)) continue;
      if (!best || len > best.matched) best = { matched: len, position: end + 1 };
    }
    if (best) {
      out.push({ progression, next: chords[best.position], matched: best.matched, position: best.position, order });
    }
  });
  out.sort((a, b) => b.matched - a.matched || a.order - b.order);
  return out;
}

/** 並びの終わりで完成している進行 */
export function completedProgressions(sequence, mode) {
  const tail = sequence.map(c => chordShape(c, mode));
  return PROGRESSIONS.filter(p => {
    const shapes = progressionChords(p, mode).map(c => chordShape(c, mode));
    if (shapes.length > tail.length) return false;
    const offset = tail.length - shapes.length;
    return shapes.every((s, i) => s === tail[offset + i]);
  });
}

/** 小節 bar で終わる、空き小節をはさまないコードの並び */
export function sequenceEndingAt(section, bar) {
  const out = [];
  for (let i = bar; i >= 0 && barChord(section.bars[i]); i--) {
    out.unshift(...section.bars[i].chords.map(c => c.chord));
  }
  return out;
}

/** 進行をセクションに入れる。入りきらない分は切る。repeat なら最後の小節まで繰り返す。入れた最後の小節を返す */
export function insertProgression(section, prog, mode, startBar = 0, repeat = false) {
  const chords = progressionChords(prog, mode);
  const room = BARS_PER_SECTION - startBar;
  const count = repeat ? room : Math.min(room, chords.length);
  for (let i = 0; i < count; i++) {
    setBarChord(section, startBar + i, chords[i % chords.length]);
  }
  return startBar + count - 1;
}
