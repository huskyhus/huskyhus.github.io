// エスニックなハスタワー。ハスタワーの旋律（ハ長調）の形はそのままに、音を各地の音階に置き換え、
// 西洋の和音の伴奏の代わりに、ドローン（伸ばし続ける低い音）・ヘテロフォニー（同じ旋律を別の楽器で少し崩して重ねる）・
// 装飾音・各地の打楽器のリズムで編曲する。
//
// 音階は「ハ長調の何番目の音（ド = 0 … シ = 6）を、主音から何半音にするか」の表で書く。
// 半端な数（3.5 など）は 4 分音など、12 音にない高さ（アラブのマカーム、ガムランの音律）。
import { parseChord, parseLine } from "./theory.js";
import { layeredSong, noteAt } from "./layers.js";

// ---------------------------------------------------------------- 音階

export const ETHNIC_SCALES = {
  ryukyu: { name: "琉球音階（ド・ミ・ファ・ソ・シ）", map: [0, 4, 4, 5, 7, 11, 11] },
  in: { name: "陰音階・都節（ド・レ♭・ファ・ソ・ラ♭）", map: [0, 1, 5, 5, 7, 8, 12] },
  yo: { name: "陽音階（ド・レ・ファ・ソ・ラ）", map: [0, 2, 5, 5, 7, 9, 12] },
  hijaz: { name: "マカーム・ヒジャーズ（ド・レ♭・ミ・ファ・ソ・ラ♭・シ♭）", map: [0, 1, 4, 5, 7, 8, 10] },
  rast: { name: "マカーム・ラスト（ミとシが 4 分音低い）", map: [0, 2, 3.5, 5, 7, 9, 10.5] },
  slendro: { name: "スレンドロ（オクターブをほぼ 5 等分）", map: [0, 2.4, 4.8, 4.8, 7.2, 9.6, 9.6] },
  pelog: { name: "ペロッグ（不等間隔の 7 音）", map: [0, 1.2, 2.7, 5.4, 6.7, 7.85, 9.5] },
};

/** ハ長調の音の高さ（ド・レ・ミ… 以外は来ない）→ ハ長調の何番目の音か */
const DEGREE = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

/** ハ長調の音 m を、音階 scale に置き換えた高さ（半端な MIDI 番号もありうる） */
export const mapNote = (m, scale) => Math.floor(m / 12) * 12 + scale.map[DEGREE[((m % 12) + 12) % 12]];

/** ハ長調で 1 つ上の音（ミ → ファ、シ → ド は半音、ほかは全音） */
const stepUp = m => m + ([4, 11].includes(((m % 12) + 12) % 12) ? 1 : 2);

/** pos の時点で鳴っている（伸ばしているものも含む）旋律の音。休符なら null */
function soundingAt(line, pos) {
  for (let i = Math.floor(pos / 2); i >= 0; i--) {
    const n = line[i];
    if (n) return i + n.len > Math.floor(pos / 2) ? n : null;
  }
  return null;
}

// ---------------------------------------------------------------- ハスタワーの旋律（ハ長調）

const A_LEAD = [
  "C5 . G4 C5 E5 . D5 C5",
  "D5 . B4 G4 D5 - . .",
  "E5 . C5 A4 E5 F5 E5 D5",
  "C5 - A4 - C5 . D5 .",
  "C5 . G4 C5 E5 . G5 E5",
  "F5 . D5 B4 G5 - F5 E5",
  "D5 . C5 A4 F5 E5 D5 C5",
  "D5 . . B4 G4 . . .",
];
const B_LEAD = [
  "A5 . E5 . C5 . E5 A5",
  "G5 . F5 . C5 . F5 G5",
  "E5 . G5 . C6 - G5 E5",
  "D5 - B4 - G4 . B4 D5",
  "A5 . G5 A5 . E5 C5 E5",
  "F5 . E5 F5 . C5 A4 C5",
  "D5 E5 F5 G5 A5 G5 F5 E5",
  "D5 - . . G4 . B4 D5",
];

// ---------------------------------------------------------------- 地域ごとの編曲

/**
 * sections: [A の音階, B の音階]。A → B → A'（全員で厚く）→ B' の 32 小節
 * inst: 声部ごとの最初の楽器、hetero: ヘテロフォニーを何半音ずらすか、drone: ドローンの音（主音からの半音）
 * swing: 8 分の裏を何 16 分音符ぶん遅らせるか、grace: 長い音に上からの装飾音を付けるか
 * pluck / drums / extra: 伴奏の刻み・打楽器・地域ならではの声部（下の STYLES の中で書く）
 */
const STYLES = {
  ryukyu: {
    title: "ハスタワー 琉球版",
    description: "琉球音階（ド・ミ・ファ・ソ・シ）で。三線風の撥弦、パーランクー（小さな太鼓）と三板（カスタネット）、跳ねるリズム（カチャーシー風）、指笛。",
    bpm: 132,
    sections: ["ryukyu", "ryukyu"],
    inst: { melody: "guitar", hetero: "flute", drone: "triangle", pluck: "guitar", extra: "flute" },
    hetero: -12, drone: [0, 7], swing: 0.67, grace: true,
    pluck({ t, pos, s16 }, voice) {
      // 三線の合いの手: 拍の頭に 5 度、裏に主音のオクターブ（チン・トン）
      if (pos % 4 === 0) voice(t, s16 * 1.5, 55);
      if (pos % 4 === 2) voice(t + s16 * this.swing, s16 * 1.2, 60);
    },
    drums({ t, pos, s16, big }, kit) {
      if (pos === 0 || pos === 8) kit.kick(t, 0.5);
      if (pos === 4 || pos === 12) kit.tom(t, 260);
      if (big && (pos === 6 || pos === 14)) kit.tom(t + s16 * this.swing, 200);
      if (pos % 4 === 2) kit.hat(t + s16 * this.swing, false, 0.05);   // 三板
    },
    extra({ t, pos, b }, voice) {
      // 指笛: セクションの最後の小節で「ピーッ」
      if (b.last && pos === 8) { voice(t, 0.12, 91, 0.8); voice(t + 0.12, 0.35, 96, 0.8); }
    },
  },

  wa: {
    title: "ハスタワー 和版",
    description: "A は陰音階（都節: ド・レ♭・ファ・ソ・ラ♭）、B は陽音階（ド・レ・ファ・ソ・ラ）。尺八風の旋律、箏の合いの手、笙のように和音を伸ばすドローン、和太鼓。",
    bpm: 84,
    sections: ["in", "yo"],
    inst: { melody: "flute", hetero: "harp", drone: "fm-organ", pluck: "harp", extra: "glocken" },
    hetero: -12, drone: [0, 5, 7, 12], swing: 0, grace: true,
    pluck({ t, pos, s16 }, voice) {
      // 箏: テン・トン・シャン
      const PATTERN = { 0: 48, 2: 55, 4: 60, 8: 53, 10: 55 };
      if (PATTERN[pos] !== undefined) voice(t, s16 * 3, PATTERN[pos]);
    },
    drums({ t, pos, b, big }, kit) {
      if (pos === 0) kit.tom(t, 90, 0.45);           // 大太鼓: ドン
      if (pos === 6) kit.tom(t, 110, 0.3);
      if (pos === 4 || pos === 12) kit.hat(t, false, 0.06);   // ふちを打つ: カッ
      if (big && pos === 10) kit.tom(t, 180, 0.25);
      if (b.last && pos >= 12) kit.tom(t, 200 - (pos - 12) * 25, 0.3);
    },
    extra({ t, pos, b }, voice) {
      // 鈴: 小節の頭でシャン
      if (pos === 0 && b.index % 2 === 0) voice(t, 0.6, 96, 0.5);
    },
  },

  arabian: {
    title: "ハスタワー アラビアン版",
    description: "A はマカーム・ヒジャーズ（ド・レ♭・ミ・ファ・ソ・ラ♭・シ♭）、B はマカーム・ラスト（ミとシが 4 分音低い）。ネイ（笛）風の旋律、ウード風の低いリフ、ダラブッカのマクスーム（ドゥム・テク・・テク・ドゥム・・テク・）。",
    bpm: 112,
    sections: ["hijaz", "rast"],
    inst: { melody: "flute", hetero: "guitar", drone: "strings", pluck: "guitar", extra: "harp" },
    hetero: -12, drone: [0, 7], swing: 0, grace: true,
    pluck({ t, pos, s16, scale }, voice) {
      // ウードのリフ: 音階の 1・2・3・1・5・4 番目の音を、マクスームに合わせて
      const RIFF = { 0: 0, 3: 1, 6: 2, 8: 0, 11: 4, 14: 3 };
      if (RIFF[pos] !== undefined) voice(t, s16 * 1.6, 48 + scale.map[RIFF[pos]]);
    },
    drums({ t, pos, bar, big }, kit) {
      // マクスーム: ドゥム（低い）・テク（高い）
      if (pos === 0 || pos === 8) kit.tom(t, 95, 0.4);
      if (pos === 2 || pos === 6 || pos === 12) kit.snare(t, 0.09);
      if (big && bar % 2 === 1 && pos >= 14) kit.snare(t, 0.06);
      if (pos % 2 === 1) kit.shaker(t, 0.03);   // リク（小さなタンバリン）
    },
    extra({ t, pos, b, s16, scale }, voice) {
      // カーヌーン（撥弦の琴）が、セクションの最後に音階を駆け下りる
      if (!b.last || pos < 8) return;
      const deg = 6 - (pos - 8);
      voice(t, s16 * 1.5, 72 + scale.map[(deg + 7) % 7] - (deg < 0 ? 12 : 0), 0.8);
    },
  },

  gamelan: {
    title: "ハスタワー ガムラン版",
    description: "A はスレンドロ（オクターブをほぼ 5 等分）、B はペロッグ（不等間隔の 7 音）。鍵盤打楽器のサロン・ジェンデル、2 人で 1 つの旋律を分け合うコテカン、ゴング、太鼓のクンダン。",
    bpm: 100,
    sections: ["slendro", "pelog"],
    inst: { melody: "glocken", hetero: "vibraphone", drone: "fm-bell", pluck: "marimba", extra: "glocken" },
    hetero: -12, drone: [], swing: 0, grace: false,
    pluck({ t, pos, s16, b, scale }, voice) {
      // ボナン: 鳴っている旋律の音を、1 オクターブ上で 8 分ごとに打ち続ける
      const n = pos % 2 === 0 && soundingAt(b.lead, pos);
      if (n) voice(t, s16 * 1.5, mapNote(n.midi, scale) + 12);
    },
    drums({ t, pos }, kit) {
      // クンダン（太鼓）
      if (pos === 0 || pos === 8) kit.tom(t, 110, 0.35);
      if (pos === 3 || pos === 6 || pos === 11 || pos === 14) kit.tom(t, 210, 0.25);
    },
    extra({ t, pos, s16, b, scale }, voice) {
      // コテカン: 2 つの声部が交互に 16 分を埋め、1 本の速い旋律に聞こえる（表 = ポロス、裏 = サンシ）
      const n = soundingAt(b.lead, pos);
      if (!n) return;
      const base = DEGREE[n.midi % 12];
      const deg = pos % 2 === 0 ? base + (pos % 4 === 0 ? 0 : 1) : base + (pos % 4 === 1 ? 2 : 1);
      voice(t, s16 * 0.9, 84 + scale.map[deg % 7] + (deg >= 7 ? 12 : 0), 0.6);
    },
    // ゴング: 2 小節に 1 回、大きなゴングで区切る。間にクンプル（中くらいのゴング）
    gong({ t, pos, bar, s16 }, voice) {
      if (pos === 0 && bar % 2 === 0) voice(t, s16 * 30, 36, 1.4);
      if (pos === 8 && bar % 2 === 1) voice(t, s16 * 8, 43, 0.9);
    },
  },
};

// ---------------------------------------------------------------- 組み立て

export function ethnicSong(key) {
  const st = STYLES[key];
  const parts = [
    ["A", A_LEAD, st.sections[0], false],
    ["B", B_LEAD, st.sections[1], false],
    ["A'（全員で）", A_LEAD, st.sections[0], true],
    ["B'（全員で）", B_LEAD, st.sections[1], true],
  ];
  const bars = parts.flatMap(([name, lead, scaleKey, big]) => lead.map((line, i) => ({
    section: name,
    scale: ETHNIC_SCALES[scaleKey],
    chord: parseChord("C"),   // 和音は使わない（ドローンだけ）。layers.js が根音を計算するために置いておく
    lead: parseLine(line),
    big,
    index: i,
    first: i === 0,
    last: i === lead.length - 1,
  })));

  // 8 分の裏を遅らせて跳ねさせる
  const swingAt = (pos, s16) => (pos % 4 === 2 ? s16 * st.swing : 0);
  const withX = fn => (x, out) => fn.call(st, { ...x, scale: x.b.scale, big: x.b.big }, out);

  const layers = [
    { name: "旋律", pan: "C", inst: st.inst.melody, vol: 0.13, play: withX(function ({ t, pos, b, s16, scale }, voice) {
      const n = noteAt(b.lead, pos);
      if (!n) return;
      const at = t + swingAt(pos, s16);
      const dur = n.len * 2 * s16 * 0.92 - swingAt(pos, s16);
      const m = mapNote(n.midi, scale);
      if (this.grace && n.len >= 2) {
        // 装飾音: 上の音から、ほんの一瞬ずり下りる
        voice(at, 0.07, mapNote(stepUp(n.midi), scale), 0.6);
        voice(at + 0.06, dur - 0.06, m);
      } else {
        voice(at, dur, m);
      }
    }) },
    { name: "ヘテロフォニー", pan: "L", inst: st.inst.hetero, vol: 0.06, play: withX(function ({ t, pos, b, s16, scale, big }, voice) {
      // 同じ旋律を、拍の頭の音だけ拾って長めに（A' と B' では 8 分ごとに）
      const step = big ? 2 : 4;
      if (pos % step !== 0) return;
      const n = soundingAt(b.lead, pos);
      if (n) voice(t + swingAt(pos, s16), s16 * step * 0.95, mapNote(n.midi, scale) + this.hetero);
    }) },
    { name: "ドローン", pan: "RR", inst: st.inst.drone, vol: 0.03, play: withX(function ({ t, pos, s16 }, voice) {
      if (pos === 0) this.drone.forEach(d => voice(t, s16 * 16 * 0.98, 48 + d));
    }) },
    { name: "伴奏の刻み", pan: "R", inst: st.inst.pluck, vol: 0.05, play: withX(st.pluck) },
    { name: "打楽器", pan: "C", kit: "acoustic", play: withX(st.drums) },
    { name: "地域の声部", pan: "LL", inst: st.inst.extra, vol: 0.04, play: withX(st.extra) },
  ];
  if (st.gong) layers.push({ name: "ゴング", pan: "C", inst: "fm-bell", vol: 0.08, play: withX(st.gong) });

  return layeredSong({
    title: st.title,
    description: st.description,
    mood: "normal",
    bpm: st.bpm,
    bars,
    layers,
    info: b => `${b.section} ・ ${b.scale.name}`,
  });
}
