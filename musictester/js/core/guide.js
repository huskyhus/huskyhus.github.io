// 理論ガイド。進行を「間違い」とは言わず、どう聞こえるかを説明する。
import { realize, mod12 } from "./theory.js";
import { sectionChords, BARS_PER_SECTION } from "./song.js";

// kind: natural = 自然な流れ / resolve = 解決 / gentle = 穏やか / tension = 緊張が残る
const FLOW = {
  "T>T": { kind: "gentle", text: "安定したまま色だけが変わります。" },
  "T>S": { kind: "natural", text: "家を出て、景色が広がっていくような自然な動きです。" },
  "T>D": { kind: "natural", text: "安定からいきなり緊張へ進み、次の解決を期待させます。" },
  "S>T": { kind: "gentle", text: "緊張を通らずに帰る、穏やかで柔らかい落ち着き方です。" },
  "S>S": { kind: "gentle", text: "広がりを保ったまま、響きの色合いが変わります。" },
  "S>D": { kind: "natural", text: "広がりから緊張へ。解決に向けて盛り上がっていく、王道の流れです。" },
  "D>T": { kind: "resolve", text: "たまった緊張がほどけて、帰ってきた安心感が生まれます。" },
  "D>S": { kind: "tension", text: "緊張が解決されずに戻る響きになります。古典的には避けられますが、ポップスでは浮遊感や切なさとして使われます。" },
  "D>D": { kind: "tension", text: "緊張が解決しないまま続き、次への期待がさらに高まります。" },
};

const isStrong = (a, b) => mod12(b.rootPc - a.rootPc) === 5;

const describe = (chord, key) => {
  const c = realize(chord, key);
  return { chord, name: c.name, roman: c.roman, func: c.func, rootPc: c.rootPc, semi: c.semi, family: c.family };
};

const isPlainDominant = (c, r) => c.kind !== "sec" && r.semi === 7 && r.family === "maj";

/** 隣り合う 2 つのコードの評価 */
export function evaluateFlow(chordA, chordB, key) {
  const a = describe(chordA, key);
  const b = describe(chordB, key);
  const strong = isStrong(a, b);
  const base = { from: a, to: b, strong };
  if (a.name === b.name) {
    return { ...base, kind: "gentle", text: "同じコードが続き、動かないことで落ち着きや溜めが生まれます。" };
  }
  if (chordA.kind === "sec") {
    if (strong) {
      return { ...base, kind: "resolve", text: `${a.roman} が行き先の ${b.name} へ解決します。一瞬だけ ${b.name} が主和音のように聞こえて、進行に勢いが出ます。` };
    }
    return { ...base, kind: "tension", text: `${a.roman} が本来の行き先とは別のコードへ進みます。予想を裏切る、意外な響きになります。` };
  }
  if (isPlainDominant(chordA, a) && isDeceptiveTarget(chordB, b, key)) {
    return { ...base, kind: "tension", text: "主和音へ帰ると見せかけて別の場所に着く、肩すかしの響きです（偽終止の形）。" };
  }
  return { ...base, ...FLOW[`${a.func}>${b.func}`] };
}

const isDeceptiveTarget = (chord, r, key) => {
  if (chord.kind === "sec") return false;
  return key.mode === "major" ? r.semi === 9 && r.family === "min" : r.semi === 8 && r.family === "maj";
};

const CADENCES = {
  perfect: { label: "完全終止", text: "V → I。緊張が主和音へ解決する、もっとも強い「終わった」感じです。文でいえば句点（。）です。" },
  plagal: { label: "変格終止", text: "IV → I。ドミナントを通らない、穏やかで柔らかい終わり方です。賛美歌の「アーメン」の響きとして知られます。" },
  half: { label: "半終止", text: "V で止まる形。緊張を残したまま区切るので、文でいえば読点（、）です。次のセクションへ続く力があります。" },
  deceptive: { label: "偽終止", text: "V → vi。主和音に帰ると見せかけて別の和音に着く、裏切りの終わり方です。曲を終わらせずに先へ進められます。" },
  weak: { label: "弱い終止", text: "v → i。導音がないので引っ張る力は弱く、素朴で古風に落ち着きます。V にすると完全終止になります。" },
  leading: { label: "導和音からの解決", text: "vii° → I。導音が主音へ半音で動いて解決します。完全終止より控えめな終わり方です。" },
  modal: { label: "♭VII からの解決", text: "♭VII → I。導音を使わずに主和音へ着く、ロックやゲーム音楽らしいおおらかな終わり方です。" },
};

const OPEN_ENDINGS = {
  T: "トニックで落ち着いています。典型的な終止の形ではありませんが、安定した区切りに聞こえます。",
  S: "サブドミナントで止まっているので、宙に浮いたまま次を待つような区切りです。",
  D: "緊張を残した区切りです。次のセクションの頭で解決すると気持ちよくつながります。",
};

/** 終わりの 2 つのコードから終止を判定する → { type, label, text, from, to } か null（2 つ未満） */
export function detectCadence(chordA, chordB, key) {
  const a = describe(chordA, key);
  const b = describe(chordB, key);
  const base = { from: a, to: b };
  const bPlain = chordB.kind !== "sec";
  const aPlain = chordA.kind !== "sec";
  const toTonic = bPlain && b.semi === 0;
  let type = null;
  if (toTonic && aPlain && a.semi === 7) type = a.family === "maj" ? "perfect" : "weak";
  else if (toTonic && aPlain && a.semi === 5) type = "plagal";
  else if (toTonic && aPlain && a.semi === 11 && a.family === "dim") type = "leading";
  else if (toTonic && aPlain && a.semi === 10) type = "modal";
  else if (isPlainDominant(chordA, a) && isDeceptiveTarget(chordB, b, key)) type = "deceptive";
  else if (isPlainDominant(chordB, b) && a.name !== b.name) type = "half";
  if (type) return { ...base, type, ...CADENCES[type] };
  return { ...base, type: "open", label: "終止の形ではありません", text: OPEN_ENDINGS[b.func] };
}

function seamText(flow) {
  const { from, to } = flow;
  if (from.name === to.name) return "同じコードで始まりと終わりがつながるので、切れ目なく回り続ける感じになります。";
  if (flow.kind === "resolve") return "最後の緊張が先頭で解決するので、ループするたびに気持ちよく頭へ戻れます。";
  if (from.func === "T" && to.func === "T") return "安定したまま頭へ戻ります。継ぎ目は目立たず、穏やかなループになります。";
  if (from.func === "D") return "最後の緊張が先頭できちんと解決しません。ループのたびに少し引っかかる、浮遊した感じになります。";
  if (to.func === "D") return "先頭がいきなり緊張から始まるので、ループするたびに新しい勢いが生まれます。";
  if (from.func === "T") return "最後に落ち着いたあと、先頭で次の動きへ移ります。素直なループです。";
  return "最後の広がりから、そのまま先頭へ流れます。「解決せずに回り続ける」ループになります。";
}

/** セクション全体の分析 */
export function analyzeSection(section, key) {
  const chords = sectionChords(section);
  const transitions = [];
  for (let i = 0; i + 1 < chords.length; i++) {
    transitions.push({
      ...evaluateFlow(chords[i].chord, chords[i + 1].chord, key),
      fromBar: chords[i].bar,
      toBar: chords[i + 1].bar,
      adjacent: chords[i + 1].bar - chords[i].bar <= 1,
    });
  }
  let cadence = null;
  let seam = null;
  if (chords.length >= 2) {
    const last = chords[chords.length - 1];
    const prev = chords[chords.length - 2];
    cadence = { ...detectCadence(prev.chord, last.chord, key), lastBar: last.bar, reachedEnd: last.bar === BARS_PER_SECTION - 1 };
    const flow = evaluateFlow(last.chord, chords[0].chord, key);
    seam = { ...flow, text: seamText(flow), flowText: flow.text };
  }
  return {
    count: chords.length,
    transitions,
    cadence,
    seam,
    strong: transitions.filter(t => t.strong && t.from.name !== t.to.name),
  };
}
