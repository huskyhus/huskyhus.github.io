// コード進行ラボの画面。進行を選び、キー・4 和音・押さえ方を変えて、聴いて・見て・比べる。
import { Engine } from "./lib/engine.js";
import { createSynth, INSTRUMENTS, INSTRUMENT_LABELS } from "./lib/synth.js";
import { createBus } from "./lib/mix.js";
import { freq } from "./lib/theory.js";
import { parseTonic, realize, voiceProgression, rootVoicing, bassNote, movement } from "./lib/roman.js";
import { GROUPS, PROGRESSIONS } from "./lib/progressions.js";

const $ = id => document.getElementById(id);
const TONICS = {
  major: ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"],
  minor: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"],
};
const DIATONIC = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "III", "iv", "v", "VI", "VII", "V"],   // 最後の V は和声的短音階
};

// ---------------------------------------------------------------- 設定（ブラウザに覚えておく）

const SAVE_KEY = "musiclab.chords";
const opts = {
  prog: "cadence", tonic: { major: "C", minor: "A" }, seventh: false, voicing: "lead",
  pattern: "block", inst: "piano", bass: true, rhythm: "none", bpm: {},
  ...(() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })(),
};
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(opts)); } catch { /* 保存できなくてもよい */ } };
if (location.hash.slice(1) && PROGRESSIONS.some(p => p.id === location.hash.slice(1))) opts.prog = location.hash.slice(1);
if (!PROGRESSIONS.some(p => p.id === opts.prog)) opts.prog = PROGRESSIONS[0].id;
if (!INSTRUMENTS[opts.inst]) opts.inst = "piano";

// ---------------------------------------------------------------- 今の進行を、実際のコードにする

let view = null;   // { prog, chords, voicings, basses, moves }

function compute() {
  const prog = PROGRESSIONS.find(p => p.id === opts.prog);
  const tonic = parseTonic(opts.tonic[prog.mode]);
  const chords = prog.roman.map((r, i) => {
    const c = realize(r, tonic, prog.mode, { seventh: opts.seventh });
    if (prog.funcs) c.func = { kind: prog.funcs[i], label: prog.funcs[i] };
    return c;
  });
  const voicings = voiceProgression(chords, opts.voicing);
  const moves = voicings.map((v, i) => movement(voicings[(i - 1 + voicings.length) % voicings.length], v));
  view = { prog, tonic, chords, voicings, basses: chords.map(bassNote), moves };
}

const bpmOf = prog => opts.bpm[prog.id] ?? prog.bpm ?? 84;

// ---------------------------------------------------------------- 音

const engine = new Engine();
let shown = null;        // 止まっているときに鍵盤に出す { chord, voicing, bass }
let previewSynth = null;

const sketch = {
  bars: () => view.chords.length,
  setup({ ac, out, noiseBuf }) {
    const { bus } = createBus(ac, out);
    return { synth: createSynth(ac, bus, noiseBuf) };
  },
  step({ t, bar, pos }, { state, sixteenth: s16 }) {
    const synth = state.synth;
    const v = view.voicings[bar];
    const inst = opts.inst;
    const vol = 0.1;
    if (opts.pattern === "block") {
      if (pos === 0) v.forEach(m => synth.play(inst, t, 16 * s16 * 0.97, freq(m), { vol }));
    } else if (opts.pattern === "quarter") {
      if (pos % 4 === 0) v.forEach(m => synth.play(inst, t, 3.6 * s16, freq(m), { vol: vol * (pos === 0 ? 1 : 0.8) }));
    } else if (opts.pattern === "arp") {
      const seq = [...v, ...v.slice(1, -1).reverse()];
      if (pos % 2 === 0) synth.play(inst, t, 3 * s16, freq(seq[(pos / 2) % seq.length]), { vol: vol * 1.2 });
    } else {
      // ストローク: 低い音から少しずつずらして鳴らす
      const len = { 0: 3, 3: 3, 6: 4, 10: 2, 12: 4 }[pos];
      if (len) v.forEach((m, i) => synth.play(inst, t + i * 0.015, len * s16 * 0.95, freq(m), { vol: vol * 0.9 }));
    }
    if (opts.bass && (pos === 0 || pos === 8)) synth.play(inst, t, 8 * s16 * 0.95, freq(view.basses[bar]), { vol: 0.13 });

    if (opts.rhythm === "click" && pos % 4 === 0) {
      synth.osc(t, 0.03, pos === 0 ? 1760 : 1320, { wave: "sine", vol: 0.12 });
    } else if (opts.rhythm === "drums") {
      const kit = synth.kit("acoustic");
      if (pos === 0 || pos === 8 || pos === 10) kit.kick(t, 0.6);
      if (pos === 4 || pos === 12) kit.snare(t, 0.16);
      if (pos % 2 === 0) kit.hat(t, false);
    }
  },
};

/** 止まっているときに、和音を 1 回だけ鳴らす */
function preview(voicing, bass) {
  engine.unlock();
  if (!previewSynth) {
    const { bus } = createBus(engine.ac, engine.master);
    previewSynth = createSynth(engine.ac, bus, engine.noiseBuf);
  }
  const t = engine.ac.currentTime + 0.02;
  voicing.forEach(m => previewSynth.play(opts.inst, t, 1.4, freq(m), { vol: 0.1 }));
  if (opts.bass) previewSynth.play(opts.inst, t, 1.4, freq(bass), { vol: 0.13 });
}

function togglePlay() {
  if (engine.playing) engine.stop();
  else { engine.setBpm(bpmOf(view.prog)); engine.play(sketch); }
  $("play").textContent = engine.playing ? "■ 停止" : "▶ 再生";
}

// ---------------------------------------------------------------- 表示

function renderList() {
  const list = $("list");
  list.replaceChildren(...GROUPS.flatMap(g => {
    const h = document.createElement("h2");
    h.textContent = g;
    const items = PROGRESSIONS.filter(p => p.group === g).map(p => {
      const b = document.createElement("button");
      b.textContent = p.name;
      const small = document.createElement("small");
      small.textContent = p.roman.length > 8 ? `${p.roman.slice(0, 4).join(" – ")} …` : p.roman.join(" – ");
      b.append(small);
      b.setAttribute("aria-current", String(p.id === opts.prog));
      b.onclick = () => selectProg(p.id);
      return b;
    });
    return [h, ...items];
  }));
}

function selectProg(id) {
  opts.prog = id;
  save();
  history.replaceState(null, "", `#${id}`);
  renderAll();
  if (engine.playing) { engine.setBpm(bpmOf(view.prog)); engine.play(sketch); }
}

function renderAll() {
  compute();
  const { prog } = view;
  renderList();
  $("title").textContent = prog.name;
  $("romanLine").textContent = view.chords.map(c => c.roman).join(" – ");
  $("desc").textContent = prog.desc;
  $("points").replaceChildren(...prog.points.map(s => { const li = document.createElement("li"); li.textContent = s; return li; }));

  // キー（長調 / 短調で選べる主音の書き方が違う）
  const sel = $("tonic");
  sel.replaceChildren(...TONICS[prog.mode].map(n => new Option(`${n} ${prog.mode === "major" ? "メジャー" : "マイナー"}`, n)));
  sel.value = opts.tonic[prog.mode];
  $("bpm").value = bpmOf(prog);
  $("bpmOut").textContent = bpmOf(prog);

  renderChords();
  renderDiatonic();
  shown = { chord: view.chords[0], voicing: view.voicings[0], bass: view.basses[0] };
  lastKbd = "";
}

function renderChords() {
  $("chords").replaceChildren(...view.chords.map((c, i) => {
    const b = document.createElement("button");
    b.className = "chord";
    b.dataset.i = i;
    b.innerHTML = `<span class="roman"></span><span class="name"></span><span class="badge fn-${c.func.kind}"></span><span class="move"></span>`;
    b.querySelector(".roman").textContent = c.roman;
    b.querySelector(".name").textContent = c.name;
    b.querySelector(".badge").textContent = c.func.label;
    b.querySelector(".move").textContent = `声部の動き ${view.moves[i]} 半音`;
    b.onclick = () => {
      shown = { chord: c, voicing: view.voicings[i], bass: view.basses[i] };
      if (engine.playing) engine.play(sketch, { bar: i });
      else preview(view.voicings[i], view.basses[i]);
    };
    return b;
  }));
}

function renderDiatonic() {
  const { prog, tonic } = view;
  const mode = prog.mode;
  const list = DIATONIC[mode].map(r => realize(r, tonic, mode, { seventh: opts.seventh }));
  $("diaTitle").textContent = `ダイアトニックコード（${opts.tonic[mode]} ${mode === "major" ? "メジャー" : "マイナー"}）`;
  const row = (label, cells) => `<tr><th>${label}</th>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
  const table = $("diatonic");
  table.innerHTML =
    row("ディグリー", list.map(c => c.roman)) +
    row("コード", list.map((c, i) => `<button data-i="${i}"></button>`)) +
    row("機能", list.map(c => `<span class="badge fn-${c.func.kind}">${c.func.label}</span>`));
  table.querySelectorAll("button").forEach(btn => {
    const c = list[btn.dataset.i];
    btn.textContent = c.name;
    btn.onclick = () => {
      const v = rootVoicing(c);
      shown = { chord: c, voicing: v, bass: bassNote(c) };
      preview(v, bassNote(c));
    };
  });
  $("diaNote").textContent = mode === "major"
    ? "長調の音階（ドレミファソラシ）の音だけでできる和音。押すと鳴ります。"
    : "自然短音階（ラシドレミファソ）の音だけでできる和音。最後の V は、ソを半音上げた和声的短音階から（主音へ戻る力が強い）。押すと鳴ります。";
}

// ---------------------------------------------------------------- 鍵盤

const LOW = 36, HIGH = 84;   // C2〜C6
const BLACK = [1, 3, 6, 8, 10];
const keyEls = new Map();
let lastKbd = "";

function buildKeyboard() {
  const kbd = $("kbd");
  const whites = [];
  for (let m = LOW; m <= HIGH; m++) if (!BLACK.includes(m % 12)) whites.push(m);
  const w = 100 / whites.length;
  for (let m = LOW; m <= HIGH; m++) {
    const el = document.createElement("div");
    if (BLACK.includes(m % 12)) {
      el.className = "b";
      const left = whites.indexOf(m - 1) + 1;   // 左の白鍵の右端に重ねる
      el.style.left = `calc(${left * w}% - ${w * 0.3}%)`;
      el.style.width = `${w * 0.6}%`;
    } else {
      el.className = "w";
    }
    kbd.append(el);
    keyEls.set(m, el);
  }
}

function drawKeyboard(d) {
  const key = d ? `${d.chord.name}|${d.voicing}|${d.bass}|${opts.bass}` : "";
  if (key === lastKbd) return;
  lastKbd = key;
  const names = d ? Object.fromEntries(d.chord.tones.map(x => [x.pc, x.name])) : {};
  for (const [m, el] of keyEls) {
    const on = d && d.voicing.includes(m);
    const bass = d && opts.bass && m === d.bass;
    el.classList.toggle("on", !!on);
    el.classList.toggle("bass", !!bass && !on);
    el.classList.remove("c-mark");
    el.textContent = on || bass ? names[m % 12] ?? "" : "";
    if (!on && !bass && m % 12 === 0) { el.textContent = `C${m / 12 - 1}`; el.classList.add("c-mark"); }
  }
  if (d) {
    const order = [...d.voicing].sort((a, b) => a - b).map(m => names[m % 12]);
    $("kbdInfo").innerHTML = `<b></b>　構成音: <span id="kTones"></span>　押さえ方（下から）: <span id="kOrder"></span>`;
    $("kbdInfo").querySelector("b").textContent = d.chord.name;
    $("kTones").textContent = d.chord.tones.map(x => x.name).join(" ・ ");
    $("kOrder").textContent = order.join(" ・ ") + (opts.bass ? `（ベース ${names[d.bass % 12]}）` : "");
  }
}

function frame() {
  const now = engine.now;
  let d = shown;
  if (now) d = { chord: view.chords[now.bar], voicing: view.voicings[now.bar], bass: view.basses[now.bar] };
  document.querySelectorAll(".chord").forEach(el => el.classList.toggle("now", !!now && Number(el.dataset.i) === now.bar));
  drawKeyboard(d);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 操作

$("inst").replaceChildren(...Object.keys(INSTRUMENTS).map(k => new Option(INSTRUMENT_LABELS[k], k)));
for (const id of ["inst", "voicing", "pattern", "rhythm"]) $(id).value = opts[id];
$("seventh").checked = opts.seventh;
$("bass").checked = opts.bass;

$("play").onclick = togglePlay;
$("tonic").onchange = e => { opts.tonic[view.prog.mode] = e.target.value; save(); renderAll(); };
$("seventh").onchange = e => { opts.seventh = e.target.checked; save(); renderAll(); };
$("voicing").onchange = e => { opts.voicing = e.target.value; save(); renderAll(); };
$("bass").onchange = e => { opts.bass = e.target.checked; save(); lastKbd = ""; };
for (const id of ["pattern", "inst", "rhythm"]) $(id).onchange = e => { opts[id] = e.target.value; save(); };
$("bpm").oninput = e => {
  const v = Number(e.target.value);
  opts.bpm[view.prog.id] = v;
  $("bpmOut").textContent = v;
  engine.setBpm(v);
  save();
};
document.addEventListener("keydown", e => {
  if (e.code !== "Space" || e.target.matches("select, button, input:not([type=range])")) return;
  e.preventDefault();
  togglePlay();
});
window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (id !== opts.prog && PROGRESSIONS.some(p => p.id === id)) selectProg(id);
});

buildKeyboard();
renderAll();
requestAnimationFrame(frame);
