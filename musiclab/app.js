// ラボの画面。スケッチの一覧・再生・パラメータ・波形表示。
import { Engine, defaultParams } from "./lib/engine.js";
import { SKETCHES } from "./sketches/index.js";

const engine = new Engine();
const $ = id => document.getElementById(id);
const sketches = new Map();  // 名前 → スケッチ（読めなかったら Error）
let current = null;          // 選んでいるスケッチの名前

// 画面で選んだ値はスケッチごとに覚えておく（ページを開き直しても残る）
const STORE_KEY = "musiclab.params";
const store = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } })();
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* 保存できなくてもよい */ }
}
/** スケッチ name の今の値（覚えている値のうち、今も使えるものを引き継ぐ） */
function paramsFor(name, s) {
  store[name] = defaultParams(s, store[name] || {});
  return store[name];
}
engine.paramsOf = paramsFor;

/** fresh: キャッシュを避けて読み直す（ファイルを編集したあと用） */
async function load(name, fresh = false) {
  try {
    const mod = await import(`./sketches/${name}.js${fresh ? `?v=${Date.now()}` : ""}`);
    sketches.set(name, mod.default);
  } catch (e) {
    sketches.set(name, e);
  }
  return sketches.get(name);
}

function showError(e) {
  const box = $("error");
  box.style.display = e ? "block" : "none";
  box.textContent = e ? `${e.name}: ${e.message}` : "";
}
engine.onError = e => { showError(e); updatePlay(); };

// ---------------------------------------------------------------- 一覧

function renderList() {
  const list = $("list");
  list.replaceChildren(...SKETCHES.map(name => {
    const s = sketches.get(name);
    const b = document.createElement("button");
    b.textContent = s instanceof Error ? `⚠ ${name}` : s.title;
    const small = document.createElement("small");
    small.textContent = `${name}.js`;
    b.append(small);
    b.setAttribute("aria-current", String(name === current));
    b.onclick = () => select(name);
    return b;
  }));
}

function select(name) {
  current = name;
  try { localStorage.setItem("musiclab.sketch", name); } catch { /* 保存できなくてもよい */ }
  const s = sketches.get(name);
  renderList();
  if (s instanceof Error) {
    showError(s);
    engine.stop();
    updatePlay();
    return;
  }
  showError(null);
  engine.params = paramsFor(name, s);
  setBpm(s.bpm || 120);
  renderSketch(s);
  if (engine.playing) engine.play(s);
}

// ---------------------------------------------------------------- スケッチの表示

function renderSketch(s) {
  $("title").textContent = s.title || current;
  $("desc").textContent = s.description || "";
  $("status").textContent = "";
  const defs = Object.entries(s.params || {});
  $("paramsCard").style.display = defs.length ? "" : "none";
  $("params").replaceChildren(...defs.flatMap(([k, def]) => paramControl(k, def)));
}

/** params の 1 項目 → [ラベル, 操作部品] */
function paramControl(k, def) {
  const id = `p-${k}`;
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = def.label || k;
  const box = document.createElement("div");
  box.className = "ctl";
  const p = engine.params;
  const set = v => { p[k] = v; saveStore(); };
  let input;
  if (def.options) {
    // labels があれば、値の代わりにその名前を見せる
    input = document.createElement("select");
    for (const o of def.options) input.add(new Option(def.labels?.[o] ?? o, o));
    input.value = p[k];
    input.onchange = () => set(input.value);
    input.sync = () => { if (input.value !== p[k]) input.value = p[k]; };
    box.append(input);
  } else if (typeof def.value === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = p[k];
    input.onchange = () => set(input.checked);
    input.sync = () => { input.checked = p[k]; };
    box.append(input);
  } else {
    input = document.createElement("input");
    input.type = "range";
    Object.assign(input, { min: def.min ?? 0, max: def.max ?? 1, step: def.step ?? 0.01 });
    input.value = p[k];
    const out = document.createElement("output");
    out.textContent = p[k];
    input.oninput = () => { set(Number(input.value)); out.textContent = input.value; };
    input.sync = () => { if (Number(input.value) !== p[k]) { input.value = p[k]; out.textContent = p[k]; } };
    box.append(input, out);
  }
  input.id = id;
  input.classList.add("param");
  return [label, box];
}

// ---------------------------------------------------------------- 再生

function updatePlay() {
  $("play").textContent = engine.playing ? "■ 停止" : "▶ 再生";
}

function togglePlay() {
  const s = sketches.get(current);
  if (engine.playing) engine.stop();
  else if (!(s instanceof Error)) { showError(null); engine.play(s); }
  updatePlay();
}

async function reload() {
  const bar = engine.now?.bar ?? 0;
  const s = await load(current, true);
  renderList();
  if (s instanceof Error) { showError(s); return; }
  showError(null);
  engine.params = store[current] = defaultParams(s, engine.params);
  saveStore();
  renderSketch(s);
  if (engine.playing) engine.play(s, { bar });
}

/** パラメータを初期値に戻す（再生中の ctx が同じ入れ物を見ているので、中身だけ入れ替える） */
function resetParams() {
  const s = sketches.get(current);
  if (s instanceof Error) return;
  Object.assign(engine.params, defaultParams(s));
  saveStore();
  renderSketch(s);
}

function setBpm(v) {
  $("bpm").value = v;
  $("bpmOut").textContent = v;
  engine.setBpm(v);
}

$("play").onclick = togglePlay;
$("reload").onclick = reload;
$("reset").onclick = resetParams;
$("bpm").oninput = e => setBpm(Number(e.target.value));
$("vol").oninput = e => { engine.setVolume(Number(e.target.value)); $("volOut").textContent = Math.round(e.target.value * 100); };
$("volOut").textContent = 50;

document.addEventListener("keydown", e => {
  if (e.target.matches("select, textarea, button") || (e.target.matches("input") && e.target.type !== "range")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) reload();
});

// ---------------------------------------------------------------- 表示の更新（毎フレーム）

const beats = $("beats");
for (let i = 0; i < 16; i++) beats.append(document.createElement("i"));

function fitCanvas(c) {
  const w = c.clientWidth * devicePixelRatio;
  const h = c.clientHeight * devicePixelRatio;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c.getContext("2d");
}

function draw() {
  const now = engine.now;
  $("pos").textContent = now ? `${now.bar + 1}${engine.loopBars ? ` / ${engine.loopBars}` : ""} 小節 ・ ${Math.floor(now.pos / 4) + 1} 拍` : "-";
  [...beats.children].forEach((el, i) => el.classList.toggle("on", !!now && now.pos === i));
  $("status").textContent = engine.status;
  // スケッチがパラメータを書き換えたとき（自動巡回など）に画面へ反映
  for (const el of document.querySelectorAll(".param")) if (document.activeElement !== el) el.sync();
  // スケッチがテンポを変えたとき（曲の切り替えなど）も
  if (document.activeElement !== $("bpm") && Number($("bpm").value) !== Math.round(engine.bpm)) {
    $("bpm").value = Math.round(engine.bpm);
    $("bpmOut").textContent = Math.round(engine.bpm);
  }

  const css = getComputedStyle(document.documentElement);
  const scope = fitCanvas($("scope"));
  const spec = fitCanvas($("spectrum"));
  const { width: w, height: h } = scope.canvas;
  scope.clearRect(0, 0, w, h);
  spec.clearRect(0, 0, w, spec.canvas.height);
  scope.strokeStyle = css.getPropertyValue("--line");
  scope.beginPath(); scope.moveTo(0, h / 2); scope.lineTo(w, h / 2); scope.stroke();

  if (engine.analyser) {
    const an = engine.analyser;
    const wave = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(wave);
    // 上向きにゼロをまたぐ所から描くと、波形が止まって見える
    let start = 0;
    for (let i = 1; i < wave.length / 2; i++) if (wave[i - 1] < 0 && wave[i] >= 0) { start = i; break; }
    const n = wave.length / 2;
    scope.strokeStyle = css.getPropertyValue("--wave");
    scope.lineWidth = 2 * devicePixelRatio;
    scope.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      const y = h / 2 - wave[start + i] * h * 0.9;
      i ? scope.lineTo(x, y) : scope.moveTo(x, y);
    }
    scope.stroke();

    // スペクトル: 横軸は 30Hz〜16kHz の対数
    const bins = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(bins);
    const sh = spec.canvas.height;
    const nyq = engine.ac.sampleRate / 2;
    const lo = Math.log(30), hi = Math.log(16000);
    spec.fillStyle = css.getPropertyValue("--accent");
    const cols = Math.floor(w / (4 * devicePixelRatio));
    for (let c = 0; c < cols; c++) {
      const f = Math.exp(lo + (hi - lo) * (c / cols));
      const v = bins[Math.min(bins.length - 1, Math.round((f / nyq) * bins.length))] / 255;
      const bw = w / cols;
      spec.fillRect(c * bw, sh - v * sh, bw - devicePixelRatio, v * sh);
    }
  }
  requestAnimationFrame(draw);
}

// ---------------------------------------------------------------- 起動

await Promise.all(SKETCHES.map(name => load(name)));
let first = SKETCHES[0];
try { const saved = localStorage.getItem("musiclab.sketch"); if (SKETCHES.includes(saved)) first = saved; } catch { /* なくてもよい */ }
select(first);
requestAnimationFrame(draw);
