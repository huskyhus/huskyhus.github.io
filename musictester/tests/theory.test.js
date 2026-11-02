import { test, assert } from "./harness.js";
import {
  midiToHz, spell, keyName, scaleNames, diatonicQuality, realize, resolveChord, parseRoman, chordFromRoman,
  normalizeChord, chordShape, voiceChord, transposeMidi, functionOf, isDiatonic, mod12,
} from "../js/core/theory.js";
import { diatonicChords, secondaryChords, borrowedChords } from "../js/core/palette.js";
import { explainChord } from "../js/core/explain.js";

const C = { tonic: 0, mode: "major" };
const Am = { tonic: 9, mode: "minor" };
const names = (chords, key) => chords.map(c => realize(c, key).name);
const romans = (chords, key) => chords.map(c => realize(c, key).roman);

test("A4 = 440 Hz、12 平均律", () => {
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.6256) < 0.001);
  assert.ok(Math.abs(midiToHz(81) - 880) < 1e-9);
});

test("音名の綴り", () => {
  assert.equal(spell(0, 0), "C");
  assert.equal(spell(6, 10), "B♭");
  assert.equal(spell(4, 8), "G♯");
  assert.equal(spell(5, 8), "A♭");
  assert.equal(spell(3, 7 + 0), "F♯♯");
});

test("音階の綴り（12 の主音 × 長短で、音名が 7 種類重ならない）", () => {
  assert.deepEqual(scaleNames(C), ["C", "D", "E", "F", "G", "A", "B"]);
  assert.deepEqual(scaleNames(Am), ["A", "B", "C", "D", "E", "F", "G"]);
  assert.deepEqual(scaleNames({ tonic: 3, mode: "major" }), ["E♭", "F", "G", "A♭", "B♭", "C", "D"]);
  assert.deepEqual(scaleNames({ tonic: 6, mode: "major" }), ["F♯", "G♯", "A♯", "B", "C♯", "D♯", "E♯"]);
  for (const mode of ["major", "minor"]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const letters = scaleNames({ tonic, mode }).map(n => n[0]);
      assert.equal(new Set(letters).size, 7, keyName({ tonic, mode }));
    }
  }
});

test("ダイアトニックの種類", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(d => diatonicQuality("major", d, 3)), ["maj", "min", "min", "maj", "maj", "min", "dim"]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(d => diatonicQuality("major", d, 4)), ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(d => diatonicQuality("minor", d, 3)), ["min", "dim", "maj", "min", "min", "maj", "maj"]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(d => diatonicQuality("minor", d, 4)), ["m7", "m7b5", "maj7", "m7", "m7", "maj7", "7"]);
});

test("C メジャーのパレット: コード名とディグリーと機能", () => {
  const tri = diatonicChords("major", 3);
  assert.deepEqual(names(tri, C), ["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);
  assert.deepEqual(romans(tri, C), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  assert.deepEqual(tri.map(c => realize(c, C).func), ["T", "S", "T", "S", "D", "T", "D"]);
  const sev = diatonicChords("major", 4);
  assert.deepEqual(names(sev, C), ["CM7", "Dm7", "Em7", "FM7", "G7", "Am7", "Bm7(♭5)"]);
  assert.deepEqual(romans(sev, C), ["IM7", "ii7", "iii7", "IVM7", "V7", "vi7", "viiø7"]);
});

test("A マイナーのパレット: 自然短音階 + 和声短音階の V", () => {
  const tri = diatonicChords("minor", 3);
  assert.deepEqual(names(tri, Am), ["Am", "Bdim", "C", "Dm", "Em", "E", "F", "G", "G♯dim"]);
  assert.deepEqual(romans(tri, Am), ["i", "ii°", "♭III", "iv", "v", "V", "♭VI", "♭VII", "vii°"]);
  assert.deepEqual(tri.map(c => realize(c, Am).func), ["T", "S", "T", "S", "D", "D", "S", "D", "D"]);
  const sev = diatonicChords("minor", 4);
  assert.deepEqual(names(sev, Am), ["Am7", "Bm7(♭5)", "CM7", "Dm7", "Em7", "E7", "FM7", "G7", "G♯dim7"]);
  assert.equal(realize(sev[5], Am).roman, "V7");
  assert.deepEqual(realize(sev[5], Am).tones.map(t => t.name), ["E", "G♯", "B", "D"]);
});

test("セカンダリードミナント", () => {
  const major = secondaryChords("major", 3);
  assert.deepEqual(romans(major, C), ["V/ii", "V/iii", "V/IV", "V/V", "V/vi"]);
  assert.deepEqual(names(major, C), ["A", "B", "C", "D", "E"]);
  assert.deepEqual(names(secondaryChords("major", 4), C), ["A7", "B7", "C7", "D7", "E7"]);
  assert.deepEqual(romans(secondaryChords("minor", 4), Am), ["V7/♭III", "V7/iv", "V7/V", "V7/♭VI", "V7/♭VII"]);
  assert.deepEqual(names(secondaryChords("minor", 4), Am), ["G7", "A7", "B7", "C7", "D7"]);
  assert.ok(major.every(c => realize(c, C).func === "D"));
});

test("借用和音", () => {
  const b = borrowedChords("major", 3);
  assert.deepEqual(romans(b.slice(0, 4), C), ["iv", "♭III", "♭VI", "♭VII"]);
  assert.deepEqual(names(b.slice(0, 4), C), ["Fm", "E♭", "A♭", "B♭"]);
  assert.equal(realize(b[0], C).func, "S");
  assert.deepEqual(realize(b[2], C).tones.map(t => t.name), ["A♭", "C", "E♭"]);
  assert.deepEqual(names(borrowedChords("major", 4).slice(0, 4), C), ["Fm7", "E♭M7", "A♭M7", "B♭7"]);
  assert.equal(realize(borrowedChords("minor", 3)[0], Am).name, "A");
});

test("全部の調で、コードの構成音の綴りが音程どおり", () => {
  const LETTERS = "CDEFGAB";
  for (const mode of ["major", "minor"]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const key = { tonic, mode };
      const all = [...diatonicChords(mode, 3), ...diatonicChords(mode, 4), ...secondaryChords(mode, 4), ...borrowedChords(mode, 4)];
      for (const c of all) {
        const r = realize(c, key);
        const steps = r.tones.map(t => (LETTERS.indexOf(t.name[0]) - LETTERS.indexOf(r.tones[0].name[0]) + 7) % 7);
        // 音名は根音から 3 度ずつ進む
        assert.deepEqual(steps.slice(0, 3), [0, 2, 4], `${keyName(key)} ${r.name}`);
      }
    }
  }
});

test("ディグリー表記の読み取り", () => {
  assert.deepEqual(parseRoman("IVM7"), { semi: 5, letter: 3, quality: "maj7" });
  assert.deepEqual(parseRoman("vim7"), { semi: 9, letter: 5, quality: "m7" });
  assert.deepEqual(parseRoman("♭VI"), { semi: 8, letter: 5, quality: "maj" });
  assert.deepEqual(parseRoman("iiø7"), { semi: 2, letter: 1, quality: "m7b5" });
  assert.deepEqual(parseRoman("vii°"), { semi: 11, letter: 6, quality: "dim" });
  assert.throws(() => parseRoman("X"), /読めない/);
  assert.throws(() => parseRoman("Ifoo"), /知らない/);
});

test("ディグリー → 保存形（調に沿った形に寄せる）", () => {
  assert.deepEqual(chordFromRoman("V7", "major"), { kind: "scale", deg: 5, size: 4, harmonic: true });
  assert.deepEqual(chordFromRoman("V", "minor"), { kind: "scale", deg: 5, size: 3, harmonic: true });
  assert.deepEqual(chordFromRoman("v", "minor"), { kind: "scale", deg: 5, size: 3, harmonic: false });
  assert.deepEqual(chordFromRoman("♭VI", "minor"), { kind: "scale", deg: 6, size: 3, harmonic: false });
  assert.deepEqual(chordFromRoman("III7", "major"), { kind: "sec", target: 6, size: 4 });
  assert.deepEqual(chordFromRoman("I7", "major"), { kind: "sec", target: 4, size: 4 });
  assert.deepEqual(chordFromRoman("♭VI", "major"), { kind: "abs", semi: 8, letter: 5, quality: "maj" });
  assert.deepEqual(chordFromRoman("I", "minor"), { kind: "abs", semi: 0, letter: 0, quality: "maj" });
  assert.equal(normalizeChord(7, 4, "7", "minor").harmonic, true);
});

test("表記を読んで綴り直すと、同じ表記に戻る", () => {
  for (const text of ["I", "ii", "IVM7", "V7", "vi", "vii°", "♭VI", "♭VII", "iv", "♭III", "III7", "I7", "VI7"]) {
    assert.equal(realize(chordFromRoman(text, "major"), C).roman.replace(/^V7\/.*/, "x").replace(/^V\/.*/, "x"),
      text === "III7" || text === "I7" || text === "VI7" ? "x" : text, text);
  }
  for (const text of ["i", "ii°", "iiø7", "♭III", "iv", "v", "V", "V7", "♭VI", "♭VII", "vii°", "I", "iv7"]) {
    assert.equal(realize(chordFromRoman(text, "minor"), Am).roman, text, text);
  }
});

test("移調してもディグリーが保たれる（完成条件）", () => {
  const canon = ["I", "V", "vi", "iii", "IV", "I", "IV", "V"].map(t => chordFromRoman(t, "major"));
  assert.deepEqual(names(canon, C), ["C", "G", "Am", "Em", "F", "C", "F", "G"]);
  assert.deepEqual(names(canon, { tonic: 2, mode: "major" }), ["D", "A", "Bm", "F♯m", "G", "D", "G", "A"]);
  assert.deepEqual(names(canon, Am), ["Am", "E", "F", "C", "Dm", "Am", "Dm", "E"]);
  assert.deepEqual(romans(canon, Am), ["i", "V", "♭VI", "♭III", "iv", "i", "iv", "V"]);
  assert.deepEqual(names(canon, C), ["C", "G", "Am", "Em", "F", "C", "F", "G"], "往復しても元どおり");
});

test("短調の v は長調を往復しても v のまま", () => {
  const v = chordFromRoman("v", "minor");
  assert.equal(realize(v, Am).name, "Em");
  assert.equal(realize(v, C).name, "G");
  assert.equal(realize(v, Am).name, "Em");
});

test("比較用のキーは三和音の骨格だけを見る", () => {
  assert.equal(chordShape(chordFromRoman("V7", "major"), "major"), chordShape(chordFromRoman("V", "major"), "major"));
  assert.ok(chordShape(chordFromRoman("vi", "major"), "major") !== chordShape(chordFromRoman("VI", "major"), "major"));
});

test("押さえ方: 構成音を全部含み、前の和音の近くへ進む", () => {
  const key = C;
  const g7 = realize(chordFromRoman("V7", "major"), key);
  const a = voiceChord(g7);
  assert.equal(a.root % 12, g7.rootPc);
  assert.deepEqual(a.upper.map(mod12).sort((x, y) => x - y), g7.tones.map(t => t.pc).sort((x, y) => x - y));
  const c = realize(chordFromRoman("I", "major"), key);
  const prev = voiceChord(realize(chordFromRoman("IV", "major"), key));
  const b = voiceChord(c, prev.upper);
  const moved = b.upper.reduce((s, n, i) => s + Math.abs(n - prev.upper[i]), 0);
  assert.ok(moved <= 6, `動きが小さい: ${moved}`);
});

test("転回形: 名前と低音だけが変わり、機能や構成音は同じ", () => {
  const g = realize({ ...chordFromRoman("V", "major"), inversion: 1 }, C);
  assert.equal(g.name, "G/B");
  assert.equal(g.roman, "V⁶");
  assert.equal(g.func, "D");
  assert.equal(g.bassPc, 11);
  assert.equal(g.rootPc, 7);
  assert.equal(voiceChord(g).notes[0] % 12, 11, "最低音が B");
  assert.equal(realize({ ...chordFromRoman("vi7", "major"), inversion: 3 }, C).name, "Am7/G");
  assert.equal(realize({ kind: "abs", semi: 9, letter: 5, quality: "mM7", inversion: 3 }, C).name, "AmM7/G♯");
  assert.equal(realize(chordFromRoman("V", "major"), C).bassPc, 7, "省略すれば根音");
  // 短調へ移しても「第 3 音が低音」のまま
  assert.equal(realize({ ...chordFromRoman("I", "major"), inversion: 1 }, Am).name, "Am/C");
});

test("add9 と 7(♭9) の綴りと機能", () => {
  const e = realize({ kind: "abs", semi: 4, letter: 2, quality: "7b9" }, C);
  assert.equal(e.name, "E7(♭9)");
  assert.deepEqual(e.tones.map(t => t.name), ["E", "G♯", "B", "D", "F"]);
  assert.equal(e.func, "D");
  const d = realize({ kind: "abs", semi: 1, letter: 1, quality: "add9" }, C);
  assert.equal(d.name, "D♭add9");
  assert.deepEqual(d.tones.map(t => t.name), ["D♭", "F", "A♭", "E♭"]);
});

test("音符の移調: 度数を保つ", () => {
  assert.equal(transposeMidi(60, C, { tonic: 2, mode: "major" }), 62);
  assert.equal(transposeMidi(64, C, Am) % 12, 0, "長調の 3 度 → 短調の 3 度（C）");
  assert.equal(transposeMidi(71, C, Am) % 12, 7, "長調の 7 度 → 短調の 7 度（G）");
  const back = n => transposeMidi(transposeMidi(n, C, Am), Am, C);
  for (const n of [60, 62, 64, 65, 67, 69, 71, 72]) assert.equal(back(n), n, `往復 ${n}`);
});

test("機能の判定", () => {
  assert.equal(functionOf(chordFromRoman("♭VII", "major"), "major"), "S");
  assert.equal(functionOf(chordFromRoman("♭VII", "minor"), "minor"), "D");
  assert.equal(functionOf(chordFromRoman("♭III", "major"), "major"), "T");
  assert.equal(functionOf(chordFromRoman("♭II", "major"), "major"), "S");
});

test("調の内外の判定", () => {
  assert.ok(isDiatonic(chordFromRoman("V7", "major"), C));
  assert.ok(!isDiatonic(chordFromRoman("III7", "major"), C));
  assert.ok(!isDiatonic(chordFromRoman("V", "minor"), Am));
  assert.ok(isDiatonic(chordFromRoman("v", "minor"), Am));
});

test("全部の調で resolveChord が範囲内", () => {
  for (const mode of ["major", "minor"]) {
    for (const c of [...diatonicChords(mode, 4), ...secondaryChords(mode, 3), ...borrowedChords(mode, 3)]) {
      const r = resolveChord(c, mode);
      assert.ok(r.semi >= 0 && r.semi < 12);
      assert.ok(r.letter >= 0 && r.letter < 7);
    }
  }
});

test("解説文がどのコードにも用意されている", () => {
  for (const [mode, key] of [["major", C], ["minor", Am]]) {
    for (const size of [3, 4]) {
      for (const c of [...diatonicChords(mode, size), ...secondaryChords(mode, size), ...borrowedChords(mode, size)]) {
        const e = explainChord(c, key);
        assert.ok(e.lines.length > 0 && e.lines.every(l => typeof l === "string" && l.length > 5), e.title);
        assert.ok(e.tones.length >= 3);
        assert.ok(e.functionText.length > 5);
      }
    }
  }
});
