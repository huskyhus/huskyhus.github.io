import { test, assert } from "./harness.js";
import { chordFromRoman, realize } from "../js/core/theory.js";
import { analyzeSection, detectCadence, evaluateFlow } from "../js/core/guide.js";
import {
  PROGRESSIONS, findProgression, insertProgression, progressionChords, suggestNext, completedProgressions, sequenceEndingAt,
} from "../js/core/progressions.js";
import { createSong, setBarChord, sectionChords } from "../js/core/song.js";

const C = { tonic: 0, mode: "major" };
const Am = { tonic: 9, mode: "minor" };
const maj = t => chordFromRoman(t, "major");
const min = t => chordFromRoman(t, "minor");
const place = (section, chords) => chords.forEach((c, i) => setBarChord(section, i, c));
const cadenceOf = (a, b, key = C) => detectCadence(a, b, key);

test("G7 → C は完全終止（完成条件）", () => {
  const c = cadenceOf(maj("V7"), maj("I"));
  assert.equal(c.label, "完全終止");
  assert.equal(c.from.name, "G7");
  assert.equal(c.to.name, "C");
  assert.equal(cadenceOf(maj("V"), maj("IM7")).label, "完全終止");
});

test("G → Am は偽終止（完成条件）", () => {
  const c = cadenceOf(maj("V"), maj("vi"));
  assert.equal(c.label, "偽終止");
  assert.equal(c.from.name, "G");
  assert.equal(c.to.name, "Am");
});

test("そのほかの終止", () => {
  assert.equal(cadenceOf(maj("IV"), maj("I")).label, "変格終止");
  assert.equal(cadenceOf(maj("ii"), maj("V")).label, "半終止");
  assert.equal(cadenceOf(maj("I"), maj("V7")).label, "半終止");
  assert.equal(cadenceOf(maj("vii°"), maj("I")).type, "leading");
  assert.equal(cadenceOf(maj("♭VII"), maj("I")).type, "modal");
  assert.equal(cadenceOf(maj("iv"), maj("I")).label, "変格終止");
  assert.equal(cadenceOf(maj("I"), maj("vi")).type, "open");
});

test("短調の終止", () => {
  assert.equal(cadenceOf(min("V7"), min("i"), Am).label, "完全終止");
  assert.equal(cadenceOf(min("v"), min("i"), Am).type, "weak");
  assert.equal(cadenceOf(min("iv"), min("i"), Am).label, "変格終止");
  assert.equal(cadenceOf(min("V"), min("♭VI"), Am).label, "偽終止");
  assert.equal(cadenceOf(min("♭VI"), min("V"), Am).label, "半終止");
});

test("セカンダリードミナントの根音は V ではないので半終止にしない", () => {
  assert.equal(cadenceOf(maj("I"), maj("II7")).type, "open");
  assert.equal(cadenceOf(maj("I7"), maj("IV")).type, "open");
});

test("機能の流れ: D → S は「解決されずに戻る」と説明し、間違いとは言わない", () => {
  const f = evaluateFlow(maj("V"), maj("IV"), C);
  assert.equal(f.kind, "tension");
  assert.ok(f.text.includes("緊張が解決されずに戻る響きになります"));
  assert.ok(!f.text.includes("間違"));
});

test("機能の流れ: 自然な T → S → D → T", () => {
  assert.equal(evaluateFlow(maj("I"), maj("IV"), C).kind, "natural");
  assert.equal(evaluateFlow(maj("IV"), maj("V"), C).kind, "natural");
  assert.equal(evaluateFlow(maj("V"), maj("I"), C).kind, "resolve");
});

test("全部の機能の組み合わせに説明がある", () => {
  const byFunc = { T: maj("I"), S: maj("IV"), D: maj("V") };
  const other = { T: maj("iii"), S: maj("ii"), D: maj("vii°") };
  for (const a of "TSD") {
    for (const b of "TSD") {
      const f = evaluateFlow(byFunc[a], other[b], C);
      assert.ok(f.text && f.text.length > 5, `${a}→${b}`);
      assert.ok(f.kind);
    }
  }
});

test("セカンダリードミナントの解決", () => {
  const ok = evaluateFlow(maj("VI7"), maj("ii"), C);
  assert.equal(ok.kind, "resolve");
  assert.ok(ok.strong);
  assert.equal(evaluateFlow(maj("VI7"), maj("IV"), C).kind, "tension");
});

test("強進行: 根音の完全 5 度下行だけを検出する", () => {
  assert.ok(evaluateFlow(maj("V"), maj("I"), C).strong);
  assert.ok(evaluateFlow(maj("ii"), maj("V"), C).strong);
  assert.ok(evaluateFlow(maj("vi"), maj("ii"), C).strong);
  assert.ok(!evaluateFlow(maj("I"), maj("V"), C).strong, "5 度上行は違う");
  assert.ok(!evaluateFlow(maj("IV"), maj("vii°"), C).strong, "減 5 度は違う");
  assert.ok(evaluateFlow(min("V"), min("i"), Am).strong);
});

test("セクション全体の分析", () => {
  const s = createSong().sections[0];
  assert.equal(analyzeSection(s, C).cadence, null);
  place(s, [maj("ii7"), maj("V7"), maj("IM7")]);
  const a = analyzeSection(s, C);
  assert.equal(a.transitions.length, 2);
  assert.equal(a.strong.length, 2);
  assert.equal(a.cadence.label, "完全終止");
  assert.equal(a.cadence.lastBar, 2);
  assert.ok(!a.cadence.reachedEnd);
  assert.equal(a.seam.from.name, "CM7");
  assert.equal(a.seam.to.name, "Dm7");
});

test("空き小節を飛ばして並びを評価する", () => {
  const s = createSong().sections[0];
  setBarChord(s, 0, maj("V7"));
  setBarChord(s, 7, maj("I"));
  const a = analyzeSection(s, C);
  assert.equal(a.cadence.label, "完全終止");
  assert.ok(a.cadence.reachedEnd);
  assert.ok(!a.transitions[0].adjacent);
});

test("ループの継ぎ目: 最後 → 最初", () => {
  const s = createSong().sections[0];
  place(s, [maj("I"), maj("IV"), maj("V7")]);
  const a = analyzeSection(s, C);
  assert.equal(a.seam.from.name, "G7");
  assert.equal(a.seam.to.name, "C");
  assert.ok(a.seam.text.includes("解決"));
});

test("辞書: 必須の進行がすべてあり、どの調でも読める", () => {
  for (const id of ["canon", "oudou", "komuro", "axis", "twofive", "marusa", "victory", "aeolian"]) assert.ok(findProgression(id), id);
  const keys = [C, Am, { tonic: 6, mode: "major" }, { tonic: 3, mode: "minor" }];
  for (const p of PROGRESSIONS) {
    assert.ok(p.impression && p.scene, p.id);
    for (const key of keys) {
      for (const c of progressionChords(p, key.mode)) assert.ok(realize(c, key).name, p.id);
    }
  }
});

test("辞書の進行が C で正しいコードになる", () => {
  const names = id => progressionChords(findProgression(id), "major").map(c => realize(c, C).name);
  assert.deepEqual(names("canon"), ["C", "G", "Am", "Em", "F", "C", "F", "G"]);
  assert.deepEqual(names("oudou"), ["F", "G", "Em", "Am"]);
  assert.deepEqual(names("komuro"), ["Am", "F", "G", "C"]);
  assert.deepEqual(names("twofive"), ["Dm7", "G7", "CM7"]);
  assert.deepEqual(names("marusa"), ["FM7", "E7", "Am7", "C7"]);
  assert.deepEqual(names("victory"), ["A♭", "B♭", "C"]);
  assert.deepEqual(names("aeolian"), ["Cm", "A♭", "B♭", "Cm"], "短調の進行を長調で使うときは同じ響きのまま");
  const amNames = id => progressionChords(findProgression(id), "minor").map(c => realize(c, Am).name);
  assert.deepEqual(amNames("aeolian"), ["Am", "F", "G", "Am"]);
  assert.deepEqual(amNames("minorcliche"), ["Am", "AmM7", "Am7", "Am6"]);
  assert.deepEqual(amNames("oudou"), ["Dm", "E", "C", "F"], "長調の進行を短調で使うときは度数を保つ");
});

test("サジェスト: 途中まで一致したら次を出す", () => {
  const seq = [maj("I"), maj("V"), maj("vi"), maj("iii")];
  const s = suggestNext(seq, "major");
  assert.equal(s[0].progression.id, "canon");
  assert.equal(realize(s[0].next, C).name, "F");
  assert.equal(s[0].matched, 4);
});

test("サジェスト: 進行の途中とも一致する", () => {
  const s = suggestNext([maj("vi"), maj("iii")], "major");
  const canon = s.find(x => x.progression.id === "canon");
  assert.ok(canon);
  assert.equal(realize(canon.next, C).roman, "IV");
  assert.equal(canon.matched, 2);
});

test("サジェスト: 7th の有無は区別せず、次の形は進行のとおりに置く", () => {
  const s = suggestNext([maj("ii"), maj("V")], "major");
  const two = s.find(x => x.progression.id === "twofive");
  assert.equal(realize(two.next, C).name, "CM7");
});

test("サジェスト: 丸サ進行", () => {
  const s = suggestNext([maj("IVM7"), maj("III7")], "major");
  const m = s.find(x => x.progression.id === "marusa");
  assert.equal(realize(m.next, C).name, "Am7");
  assert.equal(realize(suggestNext([maj("IVM7"), maj("III7"), maj("vim7")], "major")[0].next, C).name, "C7");
});

test("サジェスト: 借用和音の進行", () => {
  const s = suggestNext([maj("♭VI"), maj("♭VII")], "major");
  assert.equal(s[0].progression.id, "victory");
  assert.equal(realize(s[0].next, C).name, "C");
  const m = suggestNext([min("i"), min("♭VI"), min("♭VII")], "minor");
  assert.equal(m[0].progression.id, "aeolian");
  assert.equal(realize(m[0].next, Am).name, "Am");
});

test("サジェスト: 最初の 1 つだけなら進行の先頭から。途中の 1 つ一致では出さない", () => {
  const first = suggestNext([maj("vi")], "major");
  assert.ok(first.some(x => x.progression.id === "komuro"));
  assert.ok(!first.some(x => x.progression.id === "canon"), "カノンは vi で始まらない");
  const later = suggestNext([maj("IV"), maj("iii")], "major");
  assert.ok(later.every(x => x.matched >= 2));
});

test("サジェスト: 進行の最後まで一致したら次は出さない", () => {
  assert.equal(suggestNext([maj("IV"), maj("V"), maj("iii"), maj("vi")], "major").some(x => x.progression.id === "oudou"), false);
  assert.ok(completedProgressions([maj("IV"), maj("V"), maj("iii"), maj("vi")], "major").some(p => p.id === "oudou"));
});

test("空き小節で並びは切れる", () => {
  const s = createSong().sections[0];
  setBarChord(s, 0, maj("I"));
  setBarChord(s, 2, maj("V"));
  setBarChord(s, 3, maj("vi"));
  assert.equal(sequenceEndingAt(s, 3).length, 2);
  assert.equal(sequenceEndingAt(s, 0).length, 1);
});

test("カノン進行を辞書から挿入できる（完成条件）", () => {
  const s = createSong().sections[0];
  const last = insertProgression(s, findProgression("canon"), "major", 0, false);
  assert.equal(last, 7);
  assert.deepEqual(sectionChords(s).map(c => realize(c.chord, C).name), ["C", "G", "Am", "Em", "F", "C", "F", "G"]);
});

test("挿入: 開始位置・はみ出し・繰り返し", () => {
  const s = createSong().sections[0];
  assert.equal(insertProgression(s, findProgression("oudou"), "major", 6, false), 7);
  assert.deepEqual(sectionChords(s).map(c => realize(c.chord, C).name), ["F", "G"]);
  const r = createSong().sections[0];
  assert.equal(insertProgression(r, findProgression("oudou"), "major", 0, true), 7);
  assert.deepEqual(sectionChords(r).map(c => realize(c.chord, C).name), ["F", "G", "Em", "Am", "F", "G", "Em", "Am"]);
});
