import { test, assert } from "./harness.js";
import { chordFromRoman, realize, scalePcs, mod12, isDiatonic } from "../js/core/theory.js";
import { generatePart, STYLES } from "../js/core/generate.js";
import { draw, drawAll, moveHistory, isStale } from "../js/core/gacha.js";
import { createRng, mixSeed } from "../js/core/rng.js";
import { createSong, setBarChord, chordAtStep, changeKey, DEFAULT_PARAMS, serializeSong, parseSong } from "../js/core/song.js";

const C = { tonic: 0, mode: "major" };
const Am = { tonic: 9, mode: "minor" };
const SEEDS = Array.from({ length: 80 }, (_, i) => i * 37 + 1);

function sectionOf(romans, mode = "major") {
  const s = createSong().sections[0];
  romans.forEach((r, i) => r && setBarChord(s, i, chordFromRoman(r, mode)));
  return s;
}
const CANON = ["I", "V", "vi", "iii", "IV", "I", "IV", "V"];
const COLORFUL = ["I", "VI7", "ii", "V7", "♭VI", "♭VII", "III7", "vi"];   // 調の外のコード入り
const MINOR = ["i", "♭VI", "♭VII", "V7", "iv", "i", "iiø7", "V7"];

const params = (name, over = {}) => ({ ...DEFAULT_PARAMS[name], ...over });
const melodyOf = (section, key, seed, over) => generatePart("melody", { section, key, seed, params: params("melody", over) });
const pcsAt = (section, key, t) => realize(chordAtStep(section, t), key).tones.map(x => x.pc);

function strongSteps(n) {
  const bar = Math.floor(n.t / 16);
  return [bar * 16, bar * 16 + 8].filter(s => n.t <= s && s < n.t + n.d);
}

const FIXTURES = [
  [CANON, C, "major"],
  [COLORFUL, C, "major"],
  [MINOR, Am, "minor"],
  [CANON, { tonic: 6, mode: "major" }, "major"],
];

function forEachMelody(fn) {
  for (const [romans, key, mode] of FIXTURES) {
    const section = sectionOf(romans, mode);
    for (const [style] of STYLES.melody) {
      for (const density of [0.1, 0.5, 0.95]) {
        for (const seed of SEEDS.slice(0, 20)) {
          fn(section, key, melodyOf(section, key, seed, { style, density }), `${style} ${density} seed=${seed}`);
        }
      }
    }
  }
}

test("乱数: 同じシードなら同じ列、違うシードなら違う列", () => {
  const a = createRng(42);
  const b = createRng(42);
  const c = createRng(43);
  const xs = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()));
  assert.ok(xs.some(x => x !== c.next()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  assert.ok(mixSeed(1, "melody") !== mixSeed(1, "bass"));
});

test("同じシードとパラメータなら同じ結果になる（完成条件）", () => {
  const section = sectionOf(CANON);
  for (const name of ["melody", "bass", "drums"]) {
    const gen = () => generatePart(name, { section, key: C, seed: 12345, params: params(name) });
    assert.deepEqual(gen(), gen(), name);
    assert.ok(gen().length > 0, name);
  }
  const melody = melodyOf(section, C, 7);
  for (const name of ["counter", "harmony"]) {
    const gen = () => generatePart(name, { section, key: C, seed: 99, params: params(name), melody });
    assert.deepEqual(gen(), gen(), name);
    assert.ok(gen().length > 0, name);
  }
});

test("シードが違えば、たいてい違う結果になる", () => {
  const section = sectionOf(CANON);
  const all = new Set(SEEDS.map(seed => JSON.stringify(melodyOf(section, C, seed))));
  assert.ok(all.size > SEEDS.length * 0.9, `種類 ${all.size}`);
});

test("メロディ: 音階の音だけ（臨時記号のコードの小節は構成音も可）", () => {
  forEachMelody((section, key, notes, label) => {
    const scale = scalePcs(key);
    for (const n of notes) {
      const pc = mod12(n.midi);
      const ok = scale.includes(pc) || pcsAt(section, key, n.t).includes(pc);
      assert.ok(ok, `${label} t=${n.t} midi=${n.midi}`);
    }
  });
});

test("メロディ: 臨時記号のコードの小節では構成音だけを使う", () => {
  forEachMelody((section, key, notes, label) => {
    for (const n of notes) {
      const chord = chordAtStep(section, n.t);
      if (!isDiatonic(chord, key)) assert.ok(pcsAt(section, key, n.t).includes(mod12(n.midi)), `${label} t=${n.t}`);
    }
  });
});

test("メロディ: 強拍（1・3 拍目）で鳴っている音はコードの構成音", () => {
  forEachMelody((section, key, notes, label) => {
    for (const n of notes) {
      for (const s of strongSteps(n)) {
        assert.ok(pcsAt(section, key, s).includes(mod12(n.midi)), `${label} t=${n.t} d=${n.d} midi=${n.midi}`);
      }
    }
  });
});

test("メロディ: 弱拍の和音外の音は順次進行で入る（経過音・刺繍音）", () => {
  forEachMelody((section, key, notes, label) => {
    notes.forEach((n, i) => {
      if (i === 0 || pcsAt(section, key, n.t).includes(mod12(n.midi))) return;
      assert.ok(Math.abs(n.midi - notes[i - 1].midi) <= 2, `${label} t=${n.t}`);
    });
  });
});

test("メロディ: 跳躍は大きすぎず、大きく跳んだら反対方向へ戻る", () => {
  forEachMelody((section, key, notes, label) => {
    for (let i = 1; i < notes.length; i++) {
      const move = notes[i].midi - notes[i - 1].midi;
      assert.ok(Math.abs(move) <= 9, `${label} 跳躍 ${move} t=${notes[i].t}`);
      if (i >= 2) {
        const before = notes[i - 1].midi - notes[i - 2].midi;
        if (Math.abs(before) >= 7) assert.ok(Math.sign(move) === -Math.sign(before), `${label} ${before} のあと ${move}`);
      }
    }
  });
});

test("メロディ: 最後の音はコードの構成音", () => {
  forEachMelody((section, key, notes, label) => {
    const last = notes[notes.length - 1];
    assert.ok(pcsAt(section, key, last.t).includes(mod12(last.midi)), label);
    assert.ok(Math.floor(last.t / 16) === 7, `${label}: 最後の小節に音がある`);
  });
});

test("メロディ: 音域を守り、小節をはみ出さず、重ならない", () => {
  const section = sectionOf(CANON);
  for (const seed of SEEDS) {
    const notes = melodyOf(section, C, seed, { low: 65, high: 79 });
    notes.forEach((n, i) => {
      assert.ok(n.midi >= 65 && n.midi <= 79);
      assert.ok(n.d > 0 && Math.floor(n.t / 16) === Math.floor((n.t + n.d - 1) / 16));
      if (i > 0) assert.ok(notes[i - 1].t + notes[i - 1].d <= n.t, "重なり");
    });
  }
});

test("メロディ: 最初の 2 小節のリズムがモチーフとして繰り返される", () => {
  const section = sectionOf(CANON);
  let similar = 0;
  for (const seed of SEEDS) {
    const notes = melodyOf(section, C, seed);
    const rhythm = (a, b) => notes.filter(n => n.t >= a * 16 && n.t < b * 16).map(n => [n.t - a * 16, n.d]);
    if (JSON.stringify(rhythm(0, 2)) === JSON.stringify(rhythm(2, 4)) && JSON.stringify(rhythm(0, 2)) === JSON.stringify(rhythm(4, 6))) similar++;
  }
  assert.equal(similar, SEEDS.length);
});

test("メロディ: 密度を上げると音が増える", () => {
  const section = sectionOf(CANON);
  const avg = density => SEEDS.reduce((s, seed) => s + melodyOf(section, C, seed, { density }).length, 0) / SEEDS.length;
  assert.ok(avg(0.05) < avg(0.5));
  assert.ok(avg(0.5) < avg(0.95));
});

test("メロディ: 空き小節では鳴らさず、コードがなければ空", () => {
  const empty = createSong().sections[0];
  assert.deepEqual(melodyOf(empty, C, 1), []);
  const s = sectionOf(["I", null, "V", null]);
  const notes = melodyOf(s, C, 3);
  assert.ok(notes.every(n => chordAtStep(s, n.t)));
  assert.ok(notes.every(n => n.t < 3 * 16), "最後のコードより後ろには置かない");
});

test("1 小節に 2 コードあっても、強拍の規則を守る", () => {
  const s = createSong().sections[0];
  const c = chordFromRoman("I", "major");
  const g = chordFromRoman("V", "major");
  for (let i = 0; i < 8; i++) s.bars[i].chords = [{ startBeat: 0, beats: 2, chord: c }, { startBeat: 2, beats: 2, chord: g }];
  for (const seed of SEEDS) {
    for (const n of melodyOf(s, C, seed, { density: 0 })) {
      for (const step of strongSteps(n)) assert.ok(pcsAt(s, C, step).includes(mod12(n.midi)), `seed=${seed} t=${n.t} d=${n.d}`);
    }
  }
});

test("ベース: 小節の頭は根音で、音域を守る", () => {
  for (const [romans, key, mode] of FIXTURES) {
    const section = sectionOf(romans, mode);
    for (const [style] of STYLES.bass) {
      for (const density of [0.1, 0.5, 0.95]) {
        for (const seed of SEEDS.slice(0, 10)) {
          const notes = generatePart("bass", { section, key, seed, params: params("bass", { style, density }) });
          for (let bar = 0; bar < 8; bar++) {
            const first = notes.find(n => n.t === bar * 16);
            assert.ok(first, `${style} ${bar} 小節目`);
            assert.equal(mod12(first.midi), realize(chordAtStep(section, bar * 16), key).rootPc, `${style} bar=${bar}`);
          }
          assert.ok(notes.every(n => n.midi >= 31 && n.midi <= 52), style);
        }
      }
    }
  }
});

test("ベース: パターンの形", () => {
  const section = sectionOf(CANON);
  const gen = (style, density, seed = 1) => generatePart("bass", { section, key: C, seed, params: params("bass", { style, density }) });
  const whole = gen("whole", 0.5);
  assert.equal(whole.length, 8);
  assert.ok(whole.every(n => n.d === 16));
  assert.equal(gen("eighth", 0.5).filter(n => n.t < 16).length, 8, "8 分は 1 小節に 8 個");
  assert.ok(gen("eighth", 0.5).filter(n => n.t < 16).every(n => mod12(n.midi) === 0));
  const r5 = gen("root5", 0.5).filter(n => n.t < 16);
  assert.equal(r5.length, 2);
  assert.equal(mod12(r5[1].midi), 7, "C の 5 度は G");
});

test("ベース: 経過音は次の根音へ半音か全音で近づく", () => {
  const section = sectionOf(CANON);
  for (const seed of SEEDS) {
    const notes = generatePart("bass", { section, key: C, seed, params: params("bass", { style: "approach" }) });
    for (let bar = 0; bar < 7; bar++) {
      const inBar = notes.filter(n => Math.floor(n.t / 16) === bar);
      const last = inBar[inBar.length - 1];
      const next = notes.find(n => n.t === (bar + 1) * 16);
      const dist = Math.abs(mod12(last.midi - next.midi + 6) - 6);
      assert.ok(dist === 1 || dist === 2, `seed=${seed} bar=${bar} ${last.midi}→${next.midi}`);
    }
  }
});

test("ドラム: どのスタイルもキック・スネアがあり、最後の小節だけフィルが入ることがある", () => {
  const section = sectionOf(CANON);
  for (const [style] of STYLES.drums) {
    let filled = 0;
    let plain = 0;
    for (const seed of SEEDS) {
      const notes = generatePart("drums", { section, key: C, seed, params: params("drums", { style }) });
      assert.ok(notes.some(n => n.drum === "kick"), style);
      assert.ok(notes.some(n => n.drum === "snare"), style);
      assert.ok(notes.every(n => n.t >= 0 && n.t < 128 && n.d >= 1));
      const toms = notes.filter(n => n.drum.startsWith("tom"));
      assert.ok(toms.every(n => n.t >= 7 * 16), "タムは最後の小節だけ");
      const lastHalfHats = notes.filter(n => n.drum === "hat" && n.t >= 7 * 16 + 12).length;
      if (lastHalfHats === 0) filled++;
      else plain++;
    }
    assert.ok(filled > 0 && plain > 0, `${style}: フィルあり ${filled} / なし ${plain}`);
  }
});

test("ドラム: 密度が低いとハイハットが減る", () => {
  const section = sectionOf(CANON);
  const hats = density => generatePart("drums", { section, key: C, seed: 5, params: params("drums", { density }) }).filter(n => n.drum === "hat").length;
  assert.ok(hats(0.1) < hats(0.9));
});

test("対旋律: 音価がメロディより長く、コードの構成音で、反対方向の動きが多い", () => {
  for (const [romans, key, mode] of FIXTURES) {
    const section = sectionOf(romans, mode);
    let opposite = 0;
    let parallel = 0;
    let longer = 0;
    for (const seed of SEEDS) {
      const melody = melodyOf(section, key, seed, { style: "rhythmic", density: 0.7 });
      const notes = generatePart("counter", { section, key, seed, params: params("counter"), melody });
      const avg = list => list.reduce((s, n) => s + n.d, 0) / list.length;
      if (avg(notes) > avg(melody)) longer++;
      for (const n of notes) assert.ok(pcsAt(section, key, n.t).includes(mod12(n.midi)), "構成音");
      const at = t => {
        const m = melody.filter(x => x.t <= t);
        return m.length ? m[m.length - 1].midi : null;
      };
      for (let i = 1; i < notes.length; i++) {
        const a = Math.sign(notes[i].midi - notes[i - 1].midi);
        const b = Math.sign(at(notes[i].t) - at(notes[i - 1].t));
        if (a !== 0 && b !== 0) {
          if (a === b) parallel++;
          else opposite++;
        }
      }
    }
    assert.equal(longer, SEEDS.length);
    assert.ok(opposite > parallel * 2, `反対 ${opposite} / 同じ ${parallel}`);
  }
});

test("対旋律: スタイルごとに形が変わる", () => {
  const section = sectionOf(CANON);
  const melody = melodyOf(section, C, 3);
  const gen = style => generatePart("counter", { section, key: C, seed: 3, params: params("counter", { style }), melody });
  assert.ok(gen("sustain").every(n => n.d >= 8));
  assert.ok(JSON.stringify(gen("sustain")) !== JSON.stringify(gen("answer")));
});

test("ハモリ: 調の音階上で 3 度下 / 6 度下", () => {
  const section = sectionOf(CANON);
  const scaleList = [];
  for (let n = 0; n < 128; n++) if (scalePcs(C).includes(mod12(n))) scaleList.push(n);
  for (const seed of SEEDS) {
    const melody = melodyOf(section, C, seed);
    for (const [style, steps] of [["third", 2], ["sixth", 5]]) {
      const notes = generatePart("harmony", { section, key: C, seed, params: params("harmony", { style, low: 0, high: 127 }), melody });
      assert.equal(notes.length, melody.length);
      notes.forEach((n, i) => {
        assert.equal(n.t, melody[i].t);
        assert.equal(n.d, melody[i].d);
        assert.equal(scaleList.indexOf(n.midi), scaleList.indexOf(melody[i].midi) - steps, style);
      });
    }
  }
});

test("ハモリ: 臨時記号のコードの上でも破綻しない", () => {
  for (const [romans, key, mode] of FIXTURES) {
    const section = sectionOf(romans, mode);
    for (const seed of SEEDS) {
      const melody = melodyOf(section, key, seed);
      const notes = generatePart("harmony", { section, key, seed, params: params("harmony"), melody });
      const scale = scalePcs(key);
      for (const n of notes) {
        const chord = chordAtStep(section, n.t);
        if (!isDiatonic(chord, key)) assert.ok(pcsAt(section, key, n.t).includes(mod12(n.midi)), "構成音");
        else assert.ok(scale.includes(mod12(n.midi)), "音階");
      }
      assert.ok(notes.every(n => n.midi < melody.find(m => m.t === n.t).midi), "メロディの下");
    }
  }
});

test("ハモリ: メロディがなければ空。密度で音が減る", () => {
  const section = sectionOf(CANON);
  assert.deepEqual(generatePart("harmony", { section, key: C, seed: 1, params: params("harmony") }), []);
  const melody = melodyOf(section, C, 2, { density: 0.9 });
  const n = density => generatePart("harmony", { section, key: C, seed: 1, params: params("harmony", { density }), melody }).length;
  assert.ok(n(0.2) < n(1));
});

// ---------------------------------------------------------------- ガチャの操作

function songWithChords() {
  const song = createSong();
  CANON.forEach((r, i) => setBarChord(song.sections[0], i, chordFromRoman(r, "major")));
  return song;
}

test("引くたびに履歴が増え、前の結果に戻せる", () => {
  const { sections: [s] } = songWithChords();
  draw(s, "melody", C, 1);
  const first = JSON.stringify(s.parts.melody.notes);
  draw(s, "melody", C, 2);
  const second = JSON.stringify(s.parts.melody.notes);
  assert.ok(first !== second);
  assert.equal(s.parts.melody.history.length, 2);
  assert.ok(moveHistory(s, "melody", -1, C));
  assert.equal(JSON.stringify(s.parts.melody.notes), first);
  assert.equal(s.parts.melody.seed, 1);
  assert.ok(!moveHistory(s, "melody", -1, C), "これより前はない");
  assert.ok(moveHistory(s, "melody", 1, C));
  assert.equal(JSON.stringify(s.parts.melody.notes), second);
  assert.equal(s.parts.melody.seed, 2);
});

test("同じシードで引き直すと同じ結果（完成条件）", () => {
  const { sections: [s] } = songWithChords();
  draw(s, "melody", C, 777);
  const a = JSON.stringify(s.parts.melody.notes);
  draw(s, "melody", C, 778);
  draw(s, "melody", C, 777);
  assert.equal(JSON.stringify(s.parts.melody.notes), a);
});

test("履歴は上限で古いものから消える", () => {
  const { sections: [s] } = songWithChords();
  for (let i = 0; i < 40; i++) draw(s, "drums", C, i);
  assert.equal(s.parts.drums.history.length, 30);
  assert.equal(s.parts.drums.history[0].seed, 10);
  assert.equal(s.parts.drums.historyIndex, 29);
});

test("ロックすると個別でも全体でも変わらない", () => {
  const { sections: [s] } = songWithChords();
  draw(s, "melody", C, 1);
  const before = JSON.stringify(s.parts.melody.notes);
  s.parts.melody.locked = true;
  assert.ok(!draw(s, "melody", C, 2));
  let n = 100;
  const done = drawAll(s, C, () => n++);
  assert.ok(!done.includes("melody"));
  assert.equal(done.length, 4);
  assert.equal(JSON.stringify(s.parts.melody.notes), before);
  assert.ok(s.parts.bass.notes.length > 0);
  assert.ok(s.parts.harmony.notes.length > 0, "今のメロディに対して作られる");
  assert.ok(!moveHistory(s, "melody", -1, C), "ロック中は履歴も動かない");
});

test("全体ガチャでメロディに合ったハモリができる", () => {
  const { sections: [s] } = songWithChords();
  let n = 1;
  drawAll(s, C, () => n++);
  assert.equal(s.parts.harmony.notes.length, s.parts.melody.notes.length);
});

test("メロディを引き直すと、対旋律とハモリもついてくる（ロック中は除く）", () => {
  const { sections: [s] } = songWithChords();
  draw(s, "melody", C, 1);
  draw(s, "harmony", C, 5);
  draw(s, "counter", C, 6);
  const counterBefore = JSON.stringify(s.parts.counter.notes);
  s.parts.counter.locked = true;
  draw(s, "melody", C, 2);
  assert.equal(s.parts.harmony.notes.length, s.parts.melody.notes.length);
  assert.equal(s.parts.harmony.history.length, 1, "履歴は増やさない");
  assert.equal(s.parts.harmony.seed, 5);
  assert.equal(JSON.stringify(s.parts.counter.notes), counterBefore);
  assert.ok(!isStale(s, "harmony"));
  assert.ok(isStale(s, "counter"), "ロックして残った対旋律は要引き直し");
});

test("コードを変えると「要引き直し」になり、調を変えてもならない", () => {
  const song = songWithChords();
  const s = song.sections[0];
  draw(s, "melody", C, 1);
  draw(s, "drums", C, 1);
  assert.ok(!isStale(s, "melody"));
  changeKey(song, { tonic: 2, mode: "major" });
  assert.ok(!isStale(s, "melody"));
  setBarChord(s, 0, chordFromRoman("vi", "major"));
  assert.ok(isStale(s, "melody"));
  assert.ok(!isStale(s, "drums"), "ドラムはコードに依存しない");
});

test("調を変えると音符も移調され、音階に沿ったままになる", () => {
  const song = songWithChords();
  const s = song.sections[0];
  draw(s, "melody", C, 4);
  const before = s.parts.melody.notes.map(n => n.midi);
  changeKey(song, { tonic: 2, mode: "major" });
  assert.deepEqual(s.parts.melody.notes.map(n => n.midi), before.map(n => n + 2));
  changeKey(song, Am);
  const scale = scalePcs(Am);
  assert.ok(s.parts.melody.notes.every(n => scale.includes(mod12(n.midi))));
});

test("生成した曲を保存して読むと、音符も履歴も完全に同じ（完成条件）", () => {
  const song = songWithChords();
  const s = song.sections[0];
  let n = 1;
  drawAll(s, C, () => n++);
  draw(s, "melody", C, 50);
  moveHistory(s, "melody", -1, C);
  s.parts.bass.locked = true;
  song.mix.parts.melody.volume = 0.33;
  const text = serializeSong(song);
  const back = parseSong(text);
  assert.equal(serializeSong(back), text);
  assert.deepEqual(back, song);
  // 読み込んだ曲でも、履歴をたどれて調も変えられる
  assert.ok(moveHistory(back.sections[0], "melody", 1, C));
  changeKey(back, { tonic: 1, mode: "major" });
  assert.equal(back.sections[0].parts.drums.notes[0].drum, song.sections[0].parts.drums.notes[0].drum);
});
