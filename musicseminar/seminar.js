// コード理論ゼミのスライドの動き。
//  - スライド送り（← → / PageUp PageDown / Home End）、N で発表者メモ、T で経過時間をリセット、Esc で音を止める
//  - 説明用の音（周波数・音階・和音・進行）は、ここの小さなシンセで鳴らす
//  - 原曲（musiclab のスケッチ）は musiclab の再生エンジンで「セクションの何小節目から何小節」だけ鳴らす
import { Engine, defaultParams } from "../musiclab/lib/engine.js";
import { parseChord, parseNote, freq } from "../musiclab/lib/theory.js";

const SONGS = {
  super: { title: "スーパーハスタワー", path: "../musiclab/sketches/hustower-super.js" },
  ultra: { title: "ウルトラハスタワー", path: "../musiclab/sketches/hustower-ultra.js" },
  kai: { title: "戦闘曲1改", path: "../musiclab/sketches/hustower-battle-kai.js" },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const engine = new Engine();
engine.onError = e => toast(`曲の再生でエラー: ${e.message}`);

function toast(msg) {
  const t = $(".toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.style.display = "none"), 6000);
}

// ================================================================ スライド送り

const slides = $$(".slide");
let index = 0;
let startedAt = null;

function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i !== index) stopAll();
  slides[index].classList.remove("on");
  index = i;
  slides[index].classList.add("on");
  slides[index].scrollTop = 0;
  if (index > 0 && startedAt === null) startedAt = Date.now();
  history.replaceState(null, "", `#${index + 1}`);
  updateBar();
}

function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  $(".stage").style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener("resize", fit);

addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); go(index + 1); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(index - 1); }
  else if (k === "Home") go(0);
  else if (k === "End") go(slides.length - 1);
  else if (k === " ") {
    // スペース: 音が鳴っていれば止める。鳴っていなければ次へ
    e.preventDefault();
    if (engine.playing || demoBusy()) stopAll(); else go(index + 1);
  } else if (k === "Escape") stopAll();
  else if (k === "n" || k === "N") document.body.classList.toggle("shownotes");
  else if (k === "t" || k === "T") { startedAt = Date.now(); updateBar(); }
});

// 経過時間と、いまのパートの目安（slide の data-until = このパートを何分までに終えるか）
function updateBar() {
  const el = elapsedMin();
  const until = [...slides.slice(0, index + 1)].reverse().find(s => s.dataset.until)?.dataset.until;
  const mm = Math.floor(el), ss = Math.floor((el - mm) * 60);
  $(".bar .clock").textContent = startedAt === null ? "経過 --:--" : `経過 ${mm}:${String(ss).padStart(2, "0")}`;
  const goal = $(".bar .goal");
  goal.textContent = until ? `このパートの目安 〜${until}分` : "";
  goal.classList.toggle("late", startedAt !== null && until && el > Number(until));
  $(".bar .page").textContent = `${index + 1} / ${slides.length}`;
  $(".bar .progress i").style.width = `${(index / (slides.length - 1)) * 100}%`;
}
const elapsedMin = () => (startedAt === null ? 0 : (Date.now() - startedAt) / 60000);
setInterval(updateBar, 1000);

// ================================================================ 説明用の小さなシンセ

let voices = [];      // 鳴っている { osc, gain }
let timers = [];      // 表示のための setTimeout
let busyUntil = 0;

const demoBusy = () => engine.ac && engine.ac.currentTime < busyUntil;

function audio() {
  engine.unlock();
  return engine.ac;
}

/** f Hz の音を t 秒から dur 秒 */
function tone(f, t, dur, { vol = 0.16, type = "triangle" } = {}) {
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const lp = ac.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = f;
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(vol * 0.55, t + 0.35);
  gain.gain.setValueAtTime(vol * 0.55, t + Math.max(0.36, dur - 0.05));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
  osc.connect(lp).connect(gain).connect(engine.master);
  osc.start(t);
  osc.stop(t + dur + 0.4);
  const v = { osc, gain };
  voices.push(v);
  osc.onended = () => (voices = voices.filter(x => x !== v));
  busyUntil = Math.max(busyUntil, t + dur + 0.3);
}

const later = (fn, sec) => timers.push(setTimeout(fn, Math.max(0, sec * 1000)));

function stopDemo() {
  const ac = engine.ac;
  if (ac) for (const { osc, gain } of voices) {
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.setTargetAtTime(0, ac.currentTime, 0.04);
    try { osc.stop(ac.currentTime + 0.3); } catch { /* もう止まっている */ }
  }
  voices = [];
  timers.forEach(clearTimeout);
  timers = [];
  busyUntil = 0;
  $$(".play.on").forEach(b => b.classList.remove("on"));
  $$(".prog .chip.lit").forEach(c => c.classList.remove("lit"));
  lightKeys([]);
}

function stopAll() {
  stopDemo();
  stopClip();
}

// ---------------------------------------------------------------- 鍵盤

const NAMES = ["ド", "", "レ", "", "ミ", "ファ", "", "ソ", "", "ラ", "", "シ"];
const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

function buildKeyboard(el) {
  const from = Number(el.dataset.from ?? 60), to = Number(el.dataset.to ?? 83);
  const marks = (el.dataset.mark ?? "").split(/\s+/).filter(Boolean).map(Number);
  const root = el.dataset.root !== undefined ? Number(el.dataset.root) : null;
  const letters = el.dataset.letters !== undefined;
  let whites = 0;
  for (let m = from; m <= to; m++) if (!isBlack(m)) whites++;
  const W = 100 / whites;
  let x = 0;
  for (let m = from; m <= to; m++) {
    const k = document.createElement("div");
    const pc = ((m % 12) + 12) % 12;
    k.className = `k ${isBlack(m) ? "b" : "w"}`;
    k.dataset.midi = m;
    if (marks.includes(pc)) k.classList.add("mark");
    if (root === pc) k.classList.add("root");
    if (isBlack(m)) {
      k.style.left = `calc(${x * W}% - ${W * 0.32}%)`;
      k.style.width = `${W * 0.64}%`;
      k.innerHTML = letters ? `<span>${LETTERS[pc]}</span>` : "";
    } else {
      k.style.left = `${x * W}%`;
      k.style.width = `${W}%`;
      k.innerHTML = `<span>${NAMES[pc]}${letters ? `<br>${LETTERS[pc]}` : ""}${pc === 0 ? `<br><small>${Math.floor(m / 12) - 1}</small>` : ""}</span>`;
      x++;
    }
    k.onclick = () => { stopAll(); tone(freq(m), audio().currentTime + 0.02, 0.6); lightKeys([m]); later(() => lightKeys([]), 0.7); };
    el.appendChild(k);
  }
}

/** いまのスライドの鍵盤で、midis の鍵を光らせる */
function lightKeys(midis) {
  for (const k of $$(".slide.on .kbd .k")) k.classList.toggle("lit", midis.includes(Number(k.dataset.midi)));
}

// ---------------------------------------------------------------- 和音の押さえ方

/** 和音を 52〜76 の間で、前の和音から声部がなるべく動かない形にする（初めは根音を C4 付近に） */
function voice(chord, prev) {
  const pcs = [...new Set(chord.tones.map(i => (chord.root + i) % 12))];
  const cands = [];
  for (let low = 50; low < 62; low++) {
    if (!pcs.includes(low % 12)) continue;
    const v = pcs.map(pc => low + ((pc - low % 12 + 12) % 12)).sort((a, b) => a - b);
    cands.push(v);
  }
  if (!prev) return cands.find(v => v[0] % 12 === chord.root % 12) ?? cands[0];   // 初めは根音がいちばん下の形
  const cost = v => {
    const n = Math.max(v.length, prev.length);
    let c = 0;
    for (let i = 0; i < n; i++) c += Math.abs((v[Math.min(i, v.length - 1)]) - prev[Math.min(i, prev.length - 1)]);
    return c;
  };
  return cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}

/** 根音の形（ド・ミ・ソのように下から順に） */
function rootPosition(chord) {
  const r = 48 + chord.root;
  const base = r < 53 ? r + 12 : r;
  return chord.tones.map(i => base + i);
}

const bassOf = chord => 36 + (((chord.bass ?? chord.root) % 12) + 12) % 12;

// ---------------------------------------------------------------- ボタンの種類

/**
 * <button class="play" data-hz="440 880">         周波数をじゅんに
 * <button class="play" data-seq="C4 D4 E4">         音をじゅんに（data-step 秒、data-together で最後に全部を同時に）
 * <button class="play" data-notes="C4 E4 G4">       同時に（data-arp で一つずつ鳴らしてから同時に）
 * <button class="play" data-chord="Cmaj7">          和音の名前で（根音の形、低音つき）
 */
function playButton(btn) {
  stopAll();
  const ac = audio();
  btn.classList.add("on");
  let t = ac.currentTime + 0.05;
  const step = Number(btn.dataset.step ?? 0.42);
  const d = btn.dataset;
  if (d.hz) {
    for (const f of d.hz.split(/\s+/).map(Number)) { tone(f, t, 1.1, { type: "sine", vol: 0.22 }); t += 1.3; }
  } else if (d.seq) {
    const ms = d.seq.split(/\s+/).map(parseNote);
    ms.forEach((m, i) => { tone(freq(m), t + i * step, step * 0.95); later(() => lightKeys([m]), t + i * step - ac.currentTime); });
    t += ms.length * step;
    if (d.together !== undefined) { ms.forEach(m => tone(freq(m), t, 1.4, { vol: 0.1 })); later(() => lightKeys(ms), t - ac.currentTime); t += 1.4; }
  } else if (d.notes || d.chord) {
    let ms, bass = null;
    if (d.chord) { const c = parseChord(d.chord); ms = rootPosition(c); bass = bassOf(c); }
    else ms = d.notes.split(/\s+/).map(parseNote);
    if (d.arp !== undefined) {
      ms.forEach((m, i) => { tone(freq(m), t + i * 0.3, 0.3); later(() => lightKeys([m]), t + i * 0.3 - ac.currentTime); });
      t += ms.length * 0.3 + 0.1;
    }
    ms.forEach(m => tone(freq(m), t, 1.6, { vol: 0.11 }));
    if (bass !== null) tone(freq(bass), t, 1.6, { vol: 0.14 });
    later(() => lightKeys(ms), t - ac.currentTime);
    t += 1.6;
  }
  later(() => { btn.classList.remove("on"); lightKeys([]); }, t - ac.currentTime + 0.3);
}

/**
 * <div class="prog" data-prog="C|I|T G7|V7|D C|I|T" data-dur="1.5" data-label="鳴らす">
 * 「コード名|ディグリー|機能（T / SD / D / X=外し）」を空白で区切る。押すと 1 つずつ鳴らし、いまの和音を光らせる
 */
function buildProg(el) {
  const items = el.dataset.prog.trim().split(/\s+/).map(s => { const [name, roman = "", fn = ""] = s.split("|"); return { name, roman, fn }; });
  const btn = document.createElement("button");
  btn.className = "play";
  btn.textContent = el.dataset.label ?? "鳴らす";
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const it of items) {
    const c = document.createElement("div");
    c.className = `chip ${it.fn}`;
    c.innerHTML = `<span class="n">${it.name.replace(/b(?=\d|$|m|maj|\/)/g, "♭").replace(/^([A-G])b/, "$1♭").replace(/#/g, "♯")}</span>${it.roman ? `<span class="r">${it.roman}</span>` : ""}`;
    chips.appendChild(c);
  }
  el.append(btn, chips);
  btn.onclick = () => {
    if (btn.classList.contains("on")) { stopAll(); return; }
    stopAll();
    const ac = audio();
    btn.classList.add("on");
    const dur = Number(el.dataset.dur ?? 1.5);
    let t = ac.currentTime + 0.05, prev = null;
    items.forEach((it, i) => {
      const c = parseChord(it.name);
      const v = voice(c, prev);
      prev = v;
      v.forEach(m => tone(freq(m), t, dur * 0.96, { vol: 0.09 }));
      tone(freq(bassOf(c)), t, dur * 0.96, { vol: 0.15 });
      const at = t - ac.currentTime;
      later(() => { chips.children[i - 1]?.classList.remove("lit"); chips.children[i].classList.add("lit"); lightKeys(v); }, at);
      t += dur;
    });
    later(() => { btn.classList.remove("on"); [...chips.children].forEach(c => c.classList.remove("lit")); lightKeys([]); }, t - ac.currentTime + 0.2);
  };
}

// ================================================================ 原曲を鳴らす

const loaded = {};   // key → { sketch, bars: [{ chord, section }], start: { セクション名: 小節 }, loopFrom }

async function loadSongs() {
  await Promise.all(Object.entries(SONGS).map(async ([key, s]) => {
    try {
      const mod = await import(s.path);
      const bars = [], start = {};
      for (const sec of mod.SECTIONS) {
        start[sec.name] = bars.length;
        for (const c of sec.chords) bars.push({ chord: c, section: sec.name });
      }
      loaded[key] = { sketch: mod.default, bars, start, loopFrom: mod.default.loopFrom || 0 };
    } catch (e) {
      console.error(e);
      loaded[key] = { error: e };
    }
  }));
}

/** 曲の通し小節 i（曲の長さを超えたら loopFrom へ戻る）*/
function wrapBar(song, i) {
  const n = song.bars.length;
  return i < n ? i : song.loopFrom + (i - n) % (n - song.loopFrom);
}

let clip = null;   // 鳴っている { el, song, start, bars, last, count }

/**
 * <div class="clip" data-song="ultra" data-section="サビ" data-offset="0" data-bars="4" data-hide>
 * セクションの頭（+ offset 小節）から bars 小節だけ鳴らす。data-hide はクイズ用（和音を隠す）
 */
function buildClip(el) {
  const song = loaded[el.dataset.song];
  const sectionName = el.dataset.section;
  if (!song || song.error || !(sectionName in song.start)) {
    el.innerHTML = `<span class="err">読み込めません: ${SONGS[el.dataset.song]?.title ?? el.dataset.song}「${sectionName}」${song?.error ? `（${song.error.message}）` : ""}</span>`;
    return;
  }
  const start = song.start[sectionName] + Number(el.dataset.offset ?? 0);
  const n = Number(el.dataset.bars ?? 4);
  const btn = document.createElement("button");
  btn.className = "clip-btn";
  const off = Number(el.dataset.offset ?? 0);
  btn.textContent = el.dataset.label ?? `${SONGS[el.dataset.song].title}「${sectionName}」${off ? `${off > 0 ? `${off + 1}小節目から` : `の${-off}小節前から`}` : ""} ${n}小節`;
  const chips = document.createElement("div");
  chips.className = "chips";
  let lastSec = null;
  for (let i = 0; i < n; i++) {
    const b = song.bars[wrapBar(song, start + i)];
    if (b.section !== lastSec && (i > 0 || off !== 0)) {
      const s = document.createElement("span");
      s.className = "sec";
      s.textContent = `${b.section} →`;
      chips.appendChild(s);
    }
    lastSec = b.section;
    const c = document.createElement("div");
    c.className = "chip";
    c.dataset.i = i;
    c.innerHTML = `<span class="n">${b.chord.replace(/^([A-G])b/, "$1♭").replace(/\/([A-G])b/, "/$1♭").replace(/#/g, "♯").replace(/b9/, "♭9")}</span>`;
    chips.appendChild(c);
  }
  el.append(btn, chips);
  btn.onclick = () => {
    if (clip?.el === el) { stopAll(); return; }
    stopAll();
    engine.params = defaultParams(song.sketch);
    engine.setBpm(song.sketch.bpm || 120);
    engine.play(song.sketch, { bar: start });
    clip = { el, song, start, bars: n, last: -1, count: 0 };
    btn.classList.add("on");
    $(".bar .now-playing").textContent = `♪ ${SONGS[el.dataset.song].title}`;
  };
}

function stopClip() {
  if (engine.playing) engine.stop(0.6);
  if (clip) {
    $(".clip-btn", clip.el)?.classList.remove("on");
    $$(".chip.lit", clip.el).forEach(c => c.classList.remove("lit"));
  }
  clip = null;
  $(".bar .now-playing").textContent = "";
}

// いま鳴っている小節を数えて、和音を光らせ、指定の小節数で止める
function watch() {
  requestAnimationFrame(watch);
  if (!clip) return;
  if (!engine.playing) { stopClip(); return; }
  const now = engine.now;
  if (!now || now.bar === clip.last) return;
  clip.last = now.bar;
  clip.count++;
  if (clip.count > clip.bars) {
    const el = clip.el;
    engine.stop(1.2);
    clip = null;
    $(".clip-btn", el).classList.remove("on");
    $$(".chip.lit", el).forEach(c => c.classList.remove("lit"));
    $(".bar .now-playing").textContent = "";
    return;
  }
  $$(".chip", clip.el).forEach(c => c.classList.toggle("lit", Number(c.dataset.i) === clip.count - 1));
}

// ================================================================ クイズ

function buildQuiz(q) {
  const right = Number(q.dataset.answer);
  $$(".choices li", q).forEach((li, i) => {
    li.onclick = () => { $$(".choices li", q).forEach(x => x.classList.remove("picked")); li.classList.add("picked"); };
    li.dataset.i = i;
  });
  $(".reveal", q).onclick = () => {
    $(".answer", q).hidden = false;
    $$(".clip", q).forEach(c => c.classList.remove("hidden"));
    $$(".choices li", q)[right]?.classList.add("right");
  };
}

// ================================================================ はじめ

$$(".kbd").forEach(buildKeyboard);
$$(".play").forEach(b => (b.onclick = () => (b.classList.contains("on") ? stopAll() : playButton(b))));
$$(".prog").forEach(buildProg);
$$(".quiz").forEach(buildQuiz);
$$(".stopall").forEach(b => (b.onclick = stopAll));
fit();
go(Math.max(0, (Number(location.hash.slice(1)) || 1) - 1));
startedAt = null;
updateBar();
requestAnimationFrame(watch);

loadSongs().then(() => {
  $$(".clip").forEach(buildClip);
  const bad = Object.entries(loaded).filter(([, s]) => s.error);
  if (bad.length) toast(`曲を読み込めませんでした（${bad.map(([k]) => SONGS[k].title).join("、")}）。リポジトリのいちばん上でサーバーを立てていますか？`);
});
