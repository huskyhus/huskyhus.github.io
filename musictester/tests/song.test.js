import { test, assert } from "./harness.js";
import { realize, chordFromRoman } from "../js/core/theory.js";
import {
  createSong, addSection, duplicateSection, deleteSection, findSection, setBarChord, swapBars, barChord,
  moveInArrangement, changeKey, sectionChords, chordAtStep, serializeSong, parseSong, nextSectionName, clampBpm,
  progressionSignature, PART_NAMES,
} from "../js/core/song.js";
import { renderEvents, chordEvents, playlist } from "../js/core/playback.js";
import { saveWork, loadWork, withoutHistory } from "../js/core/storage.js";

const place = (section, romans, mode = "major") => romans.forEach((r, i) => setBarChord(section, i, chordFromRoman(r, mode)));

test("新しい曲: 8 小節のセクションが 1 つ", () => {
  const s = createSong();
  assert.equal(s.schemaVersion, 1);
  assert.equal(s.sections.length, 1);
  assert.equal(s.sections[0].bars.length, 8);
  assert.deepEqual(s.arrangement, ["s1"]);
  for (const p of PART_NAMES) assert.ok(s.sections[0].parts[p].params);
});

test("セクションの追加・複製・削除と名前", () => {
  const s = createSong();
  const b = addSection(s);
  assert.equal(b.name, "B");
  const a = s.sections[0];
  place(a, ["I", "V"]);
  const c = duplicateSection(s, a.id);
  assert.equal(c.name, "C");
  assert.ok(c.id !== a.id);
  assert.equal(realize(barChord(c.bars[1]), s.settings.key).name, "G");
  setBarChord(c, 1, null);
  assert.ok(barChord(a.bars[1]), "複製は独立している");
  assert.deepEqual(s.arrangement, ["s1", "s2", "s3"]);
  assert.ok(deleteSection(s, "s2"));
  assert.deepEqual(s.arrangement, ["s1", "s3"]);
  assert.equal(findSection(s, "s2"), null);
  deleteSection(s, "s1");
  assert.ok(!deleteSection(s, "s3"), "最後の 1 つは消せない");
  assert.equal(nextSectionName({ sections: [{ name: "A" }, { name: "C" }] }), "B");
});

test("小節の入れ替え・移動", () => {
  const s = createSong().sections[0];
  place(s, ["I", "V"]);
  swapBars(s, 0, 1);
  const key = { tonic: 0, mode: "major" };
  assert.equal(realize(barChord(s.bars[0]), key).name, "G");
  assert.equal(realize(barChord(s.bars[1]), key).name, "C");
  swapBars(s, 1, 5);
  assert.equal(barChord(s.bars[1]), null);
  assert.equal(realize(barChord(s.bars[5]), key).name, "C");
});

test("1 小節に複数のコードを持てる", () => {
  const s = createSong().sections[0];
  const c = chordFromRoman("I", "major");
  const g = chordFromRoman("V", "major");
  s.bars[0].chords = [{ startBeat: 0, beats: 2, chord: c }, { startBeat: 2, beats: 2, chord: g }];
  assert.equal(sectionChords(s).length, 2);
  assert.deepEqual(chordAtStep(s, 0), c);
  assert.deepEqual(chordAtStep(s, 7), c);
  assert.deepEqual(chordAtStep(s, 8), g);
  assert.equal(chordAtStep(s, 16), null);
  assert.deepEqual(chordEvents(s, { tonic: 0, mode: "major" }).map(e => [e.step, e.dur]), [[0, 8], [8, 8]]);
});

test("構成の並び替え", () => {
  const s = createSong();
  s.arrangement = ["a", "b", "c", "d"];
  moveInArrangement(s, 0, 2);
  assert.deepEqual(s.arrangement, ["b", "a", "c", "d"]);
  moveInArrangement(s, 3, 0);
  assert.deepEqual(s.arrangement, ["d", "b", "a", "c"]);
  moveInArrangement(s, 0, 4);
  assert.deepEqual(s.arrangement, ["b", "a", "c", "d"]);
});

test("調を変えるとコード名が変わり、ディグリーは保たれる（完成条件）", () => {
  const s = createSong();
  place(s.sections[0], ["I", "V", "vi", "iii", "IV", "I", "IV", "V"]);
  const sig = progressionSignature(s.sections[0]);
  changeKey(s, { tonic: 9, mode: "minor" });
  const key = s.settings.key;
  assert.deepEqual(sectionChords(s.sections[0]).map(c => realize(c.chord, key).name), ["Am", "E", "F", "C", "Dm", "Am", "Dm", "E"]);
  assert.equal(progressionSignature(s.sections[0]), sig, "保存しているのはディグリーだけ");
  changeKey(s, { tonic: 0, mode: "major" });
  assert.deepEqual(sectionChords(s.sections[0]).map(c => realize(c.chord, s.settings.key).name), ["C", "G", "Am", "Em", "F", "C", "F", "G"]);
});

test("調を変えると生成済みの音符も移る（現在と履歴を 1 回ずつ）", () => {
  const s = createSong();
  const part = s.sections[0].parts.melody;
  const notes = [{ t: 0, d: 4, midi: 60, v: 0.8 }];
  part.notes = notes;
  part.history = [{ seed: 1, params: part.params, notes, basis: "" }, { seed: 2, params: part.params, notes: [{ t: 0, d: 4, midi: 64, v: 1 }], basis: "" }];
  changeKey(s, { tonic: 2, mode: "major" });
  assert.equal(part.notes[0].midi, 62, "同じ配列を 2 回動かさない");
  assert.equal(part.history[1].notes[0].midi, 66);
  const drum = s.sections[0].parts.drums;
  drum.notes = [{ t: 0, d: 1, drum: "kick", v: 1 }];
  changeKey(s, { tonic: 0, mode: "major" });
  assert.equal(drum.notes[0].drum, "kick");
  assert.equal(drum.notes[0].midi, undefined);
});

test("カノン進行の再生: 正しい和音が正しい時刻に鳴る（完成条件）", () => {
  const s = createSong();
  s.settings.bpm = 120;
  place(s.sections[0], ["I", "V", "vi", "iii", "IV", "I", "IV", "V"]);
  const ev = renderEvents(s).filter(e => e.part === "chords");
  assert.equal(ev.length, 8);
  const expected = [[0, 4, 7], [7, 11, 2], [9, 0, 4], [4, 7, 11], [5, 9, 0], [0, 4, 7], [5, 9, 0], [7, 11, 2]];
  ev.forEach((e, i) => {
    assert.equal(e.time, i * 2, "120 BPM の 4/4 は 1 小節 2 秒");
    assert.equal(e.duration, 2);
    assert.equal(e.notes[0] % 12, expected[i][0], "最低音は根音");
    assert.deepEqual([...new Set(e.notes.map(n => n % 12))].sort((a, b) => a - b), [...expected[i]].sort((a, b) => a - b));
  });
});

test("再生の順: 曲全体とセクションのみ", () => {
  const s = createSong();
  const b = addSection(s);
  s.arrangement = ["s1", b.id, "s1"];
  place(s.sections[0], ["I"]);
  place(b, ["V"]);
  assert.deepEqual(playlist(s, "song"), ["s1", "s2", "s1"]);
  assert.deepEqual(playlist(s, "section", "s2"), ["s2"]);
  const ev = renderEvents(s).filter(e => e.part === "chords");
  assert.deepEqual(ev.map(e => e.time), [0, 16, 32]);
  assert.deepEqual(ev.map(e => e.arrangementIndex), [0, 1, 2]);
});

test("転回形とセクションの説明は省略できて、保存しても残る", () => {
  const s = createSong();
  s.sections[0].note = "説明";
  setBarChord(s.sections[0], 0, { ...chordFromRoman("V", "major"), inversion: 1 });
  assert.deepEqual(parseSong(serializeSong(s)), s);
  s.sections[0].bars[0].chords[0].chord.inversion = 9;
  assert.throws(() => parseSong(serializeSong(s)), /inversion/);
});

test("BPM は 40〜240 に収まる", () => {
  assert.equal(clampBpm(10), 40);
  assert.equal(clampBpm(999), 240);
  assert.equal(clampBpm("90"), 90);
});

test("保存して読むと同じ曲になる", () => {
  const s = createSong();
  place(s.sections[0], ["I", "♭VI", "III7"]);
  s.sections[0].parts.melody.notes = [{ t: 0, d: 4, midi: 72, v: 0.8 }];
  s.mix.parts.melody.mute = true;
  const text = serializeSong(s);
  const back = parseSong(text);
  assert.deepEqual(back, s);
  assert.equal(serializeSong(back), text);
});

test("壊れたデータは日本語の例外で弾く", () => {
  assert.throws(() => parseSong("{"), /JSON/);
  assert.throws(() => parseSong("{}"), /曲データ/);
  const good = () => JSON.parse(serializeSong(createSong()));
  const tryWith = (mutate, pattern) => {
    const d = good();
    mutate(d);
    assert.throws(() => parseSong(JSON.stringify(d)), pattern);
  };
  tryWith(d => { d.schemaVersion = 99; }, /新しいバージョン/);
  tryWith(d => { delete d.schemaVersion; }, /バージョン/);
  tryWith(d => { d.settings.key.tonic = 12; }, /調/);
  tryWith(d => { d.settings.bpm = 1000; }, /BPM/);
  tryWith(d => { d.sections = []; }, /セクション/);
  tryWith(d => { d.sections[0].bars.pop(); }, /小節/);
  tryWith(d => { d.arrangement = ["nope"]; }, /構成/);
  tryWith(d => { d.sections[0].bars[0].chords = [{ startBeat: 0, beats: 4, chord: { kind: "weird" } }]; }, /種類/);
  tryWith(d => { d.sections[0].parts.melody.notes = [{ t: 0 }]; }, /音符/);
  tryWith(d => { delete d.mix.parts.bass; }, /ミックス/);
  tryWith(d => { d.mix.parts.bass.volume = "大"; }, /ミックス/);
  tryWith(d => { d.sections[0].bars[0].chords = [{ startBeat: 0, beats: 4, chord: { kind: "abs", semi: 0, letter: 0, quality: "toString" } }]; }, /読めません/);
  tryWith(d => { d.sections[0].bars[0].chords = [{ chord: { kind: "scale", deg: 1, size: 3 } }]; }, /拍/);
  tryWith(d => { d.sections[0].parts.melody.history = [{ notes: [] }]; }, /履歴/);
});

test("自動保存: 保存して読めて、失敗しても例外を出さない", () => {
  const memory = () => {
    const data = {};
    return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  };
  const s = createSong();
  place(s.sections[0], ["I", "V"]);
  const m = memory();
  assert.equal(loadWork(m), null);
  assert.equal(saveWork(m, s, "s1"), "full");
  const back = loadWork(m);
  assert.deepEqual(back.song, s);
  assert.equal(back.selectedId, "s1");

  // 壊れたデータ・読めないストレージ
  m.data["musictester.song"] = "{broken";
  assert.equal(loadWork(m), null);
  const thrower = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
  assert.equal(loadWork(thrower), null);
  assert.equal(saveWork(thrower, s, "s1"), "failed");

  // 容量が足りないときは履歴を除いて保存する
  const part = s.sections[0].parts.melody;
  part.notes = [{ t: 0, d: 4, midi: 60, v: 1 }];
  part.history = [{ seed: 1, params: part.params, notes: part.notes, basis: "" }];
  part.historyIndex = 0;
  const tight = memory();
  const limit = serializeSong(withoutHistory(s)).length;
  const set = tight.setItem;
  tight.setItem = (k, v) => {
    if (v.length > limit) throw new Error("quota");
    set(k, v);
  };
  assert.equal(saveWork(tight, s, "s1"), "no-history");
  const small = loadWork(tight).song;
  assert.deepEqual(small.sections[0].parts.melody.notes, part.notes);
  assert.equal(small.sections[0].parts.melody.history.length, 0);
  assert.equal(part.history.length, 1, "元の曲は変えない");
});
