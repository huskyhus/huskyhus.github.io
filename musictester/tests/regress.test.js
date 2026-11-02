// 検証で見つかった不具合の再発防止テスト
import { test, assert } from "./harness.js";
import { chordFromRoman, realize, mod12 } from "../js/core/theory.js";
import { borrowedChords } from "../js/core/palette.js";
import { explainChord } from "../js/core/explain.js";
import { generatePart } from "../js/core/generate.js";
import { draw, isStale } from "../js/core/gacha.js";
import { sequenceEndingAt } from "../js/core/progressions.js";
import { createSong, setBarChord, changeKey, chordAtStep, serializeSong, parseSong, DEFAULT_PARAMS } from "../js/core/song.js";

const C = { tonic: 0, mode: "major" };
const Am = { tonic: 9, mode: "minor" };

function songOf(romans) {
  const song = createSong();
  romans.forEach((r, i) => setBarChord(song.sections[0], i, chordFromRoman(r, "major")));
  return song;
}

const coversStrong = n => {
  const bar = Math.floor(n.t / 16);
  return [bar * 16, bar * 16 + 8].filter(s => n.t <= s && s < n.t + n.d);
};

test("長調 → 短調: 生成済みの音符の強拍は、移調後もコードの構成音のまま", () => {
  for (const romans of [["I", "V", "vi", "iii", "IV", "I", "IV", "V"], ["I", "VI7", "ii", "V7", "♭VI", "♭VII", "III7", "vi"]]) {
    for (let seed = 1; seed <= 30; seed++) {
      const song = songOf(romans);
      const s = song.sections[0];
      draw(s, "melody", C, seed);
      changeKey(song, Am);
      for (const n of s.parts.melody.notes) {
        for (const step of coversStrong(n)) {
          const pcs = realize(chordAtStep(s, step), Am).tones.map(t => t.pc);
          assert.ok(pcs.includes(mod12(n.midi)), `seed=${seed} t=${n.t} midi=${n.midi} ${pcs}`);
        }
      }
    }
  }
});

test("長調 → 短調 → 長調: 音符が元に戻る", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const song = songOf(["I", "V", "vi", "iii", "IV", "I", "IV", "V"]);
    const s = song.sections[0];
    draw(s, "melody", C, seed);
    const before = s.parts.melody.notes.map(n => n.midi);
    changeKey(song, Am);
    changeKey(song, C);
    assert.deepEqual(s.parts.melody.notes.map(n => n.midi), before, `seed=${seed}`);
  }
});

test("短調の導音（和声短音階）は長調へ移しても導音のまま", () => {
  const song = createSong();
  song.settings.key = Am;
  const s = song.sections[0];
  setBarChord(s, 0, chordFromRoman("V", "minor"));
  s.parts.melody.notes = [{ t: 0, d: 4, midi: 68, v: 0.8 }];   // E の上の G♯
  changeKey(song, C);
  assert.equal(mod12(s.parts.melody.notes[0].midi), 11, "G の上の B");
});

test("ベース: 減三和音の「5 度」は減 5 度（調の外の音を鳴らさない）", () => {
  const song = songOf(["vii°", "vii°", "vii°", "vii°", "vii°", "vii°", "vii°", "vii°"]);
  const notes = generatePart("bass", { section: song.sections[0], key: C, seed: 1, params: { ...DEFAULT_PARAMS.bass, style: "root5" } });
  assert.deepEqual([...new Set(notes.map(n => mod12(n.midi)))].sort((a, b) => a - b), [5, 11], "B と F");
});

test("ベース: 1 拍のコードでも長さ 0 の音を作らない", () => {
  const s = createSong().sections[0];
  const g = chordFromRoman("V", "major");
  s.bars[0].chords = [0, 1, 2, 3].map(startBeat => ({ startBeat, beats: 1, chord: g }));
  for (let seed = 1; seed < 40; seed++) {
    const notes = generatePart("bass", { section: s, key: C, seed, params: { ...DEFAULT_PARAMS.bass, style: "approach" } });
    assert.ok(notes.every(n => n.d > 0), `seed=${seed}`);
  }
});

test("解説: 借用和音も、今の調で調の中なら「借用」と説明しない", () => {
  for (const chord of borrowedChords("major", 3).slice(0, 4)) {
    const text = explainChord(chord, Am).lines.join("");
    assert.ok(!text.includes("借り"), `${realize(chord, Am).name}: ${text}`);
    assert.ok(!text.includes("長調の中"), `${realize(chord, Am).name}: ${text}`);
  }
  const iv = borrowedChords("minor", 3)[1];
  assert.ok(!explainChord(iv, C).lines.join("").includes("短調の中"), "長調の IV");
});

test("メロディのパラメータを動かしただけでは、ハモリは「要引き直し」にならない", () => {
  const { sections: [s] } = songOf(["I", "V", "vi", "IV"]);
  draw(s, "melody", C, 1);
  draw(s, "harmony", C, 2);
  assert.ok(!isStale(s, "harmony"));
  s.parts.melody.params.density = 0.9;
  assert.ok(!isStale(s, "harmony"));
  draw(s, "melody", C, 3);
  s.parts.harmony.locked = true;
  draw(s, "melody", C, 4);
  assert.ok(isStale(s, "harmony"), "メロディが変わったら要引き直し");
});

test("1 小節に複数のコードがあるとき、候補の基準の並びに全部入る", () => {
  const s = createSong().sections[0];
  const a = chordFromRoman("ii", "major");
  const b = chordFromRoman("V", "major");
  s.bars[0].chords = [{ startBeat: 0, beats: 2, chord: a }, { startBeat: 2, beats: 2, chord: b }];
  assert.deepEqual(sequenceEndingAt(s, 0), [a, b]);
});

test("読み込み: 再生で例外になる値を弾く", () => {
  const tryWith = (mutate, pattern) => {
    const d = JSON.parse(serializeSong(createSong()));
    mutate(d);
    assert.throws(() => parseSong(JSON.stringify(d)), pattern);
  };
  const note = over => d => { d.sections[0].parts.melody.notes = [{ t: 0, d: 4, midi: 60, v: 0.8, ...over }]; };
  tryWith(note({ midi: 1e6 }), /音符/);
  tryWith(note({ midi: -1 }), /音符/);
  tryWith(note({ v: 0 }), /音符/);
  tryWith(note({ d: 0 }), /音符/);
  tryWith(note({ t: -1 }), /音符/);
  tryWith(d => { d.schemaVersion = 0; }, /バージョン/);
});
