// パートのガチャとミキサー
import { h, help, replace, toast } from "./dom.js";
import { STYLES } from "../core/generate.js";
import { draw, drawAll, moveHistory, isStale } from "../core/gacha.js";
import { chordEvents } from "../core/playback.js";
import { sectionChords, PART_NAMES, PART_LABEL, TIMBRES, SECTION_STEPS, STEPS_PER_BAR, BARS_PER_SECTION } from "../core/song.js";
import { HELP } from "../core/explain.js";
import { spell, mod12 } from "../core/theory.js";

const SVG = "http://www.w3.org/2000/svg";
const DRUM_ROWS = ["crash", "openhat", "hat", "tomHigh", "tomLow", "snare", "kick"];
const NEEDS_CHORDS = ["melody", "bass", "counter", "harmony"];

const LETTER_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const midiName = n => `${spell(LETTER_OF_PC[mod12(n)], n)}${Math.floor(n / 12) - 1}`;

export const newSeed = () => Math.floor(Math.random() * 2147483647) + 1;

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** 8 小節分の音符の絵。rows: [{ t, d, y, h }]（y と h は 0〜1） */
function roll(rects, emptyText) {
  const svg = svgEl("svg", { viewBox: `0 0 ${SECTION_STEPS} 100`, preserveAspectRatio: "none", "aria-hidden": "true" });
  for (let b = 1; b < BARS_PER_SECTION; b++) {
    svg.append(svgEl("line", { class: "bar-line", x1: b * STEPS_PER_BAR, x2: b * STEPS_PER_BAR, y1: 0, y2: 100 }));
  }
  for (const r of rects) {
    svg.append(svgEl("rect", {
      class: "note-rect",
      x: r.t,
      width: Math.max(0.5, r.d - 0.12),
      y: r.y * 100,
      height: Math.max(2, r.h * 100),
      rx: 0.4,
    }));
  }
  return h("div", { class: "roll" }, svg,
    h("div", { class: "roll-playhead", hidden: true }),
    rects.length === 0 && emptyText ? h("div", { class: "roll-empty" }, emptyText) : null);
}

function pitchRects(notes) {
  if (notes.length === 0) return [];
  const pitches = notes.map(n => n.midi);
  const lo = Math.min(...pitches) - 2;
  const hi = Math.max(...pitches) + 2;
  const span = Math.max(12, hi - lo);
  const height = 1 / (span + 1);
  return notes.map(n => ({ t: n.t, d: n.d, y: (hi - n.midi) / (span + 1), h: Math.max(height, 0.05) }));
}

function drumRects(notes) {
  const rows = DRUM_ROWS.length;
  return notes.map(n => ({ t: n.t, d: 1, y: Math.max(0, DRUM_ROWS.indexOf(n.drum)) / rows, h: 0.85 / rows }));
}

function mixControls(app, name) {
  const { song } = app;
  const p = song.mix.parts[name];
  const label = PART_LABEL[name];
  const toggle = (cls, prop, text, title) => h("button", {
    type: "button",
    class: `ms ${cls}`,
    "aria-pressed": String(p[prop]),
    "aria-label": `${label}を${title}`,
    title,
    onclick: e => {
      p[prop] = !p[prop];
      e.target.setAttribute("aria-pressed", String(p[prop]));
      app.player.applyMix();
      app.save();
    },
  }, text);
  return h("div", { class: "part-mix" },
    h("div", { class: "row" },
      toggle("mute", "mute", "M", "ミュート"),
      toggle("solo", "solo", "S", "ソロ"),
      h("input", {
        type: "range", min: 0, max: 1, step: 0.01, value: p.volume, "aria-label": `${label}の音量`, title: "音量",
        oninput: e => {
          p.volume = Number(e.target.value);
          app.player.applyMix();
          app.save();
        },
      })),
    TIMBRES[name].length > 1 && h("div", { class: "row" },
      h("select", {
        "aria-label": `${label}の音色`,
        title: "音色",
        onchange: e => {
          p.timbre = e.target.value;
          app.save();
        },
      }, TIMBRES[name].map(([value, text]) => h("option", { value, selected: p.timbre === value }, text)))));
}

/** ピアノの音の選択肢（low〜high） */
function noteSelect(value, low, high, label, onchange) {
  const options = [];
  for (let n = low; n <= high; n++) {
    if (mod12(n) === 0 || mod12(n) === 5 || mod12(n) === 7 || n === value) options.push(n);
  }
  return h("select", { "aria-label": label, title: label, onchange: e => onchange(Number(e.target.value)) },
    options.map(n => h("option", { value: n, selected: n === value }, midiName(n))));
}

const RANGE_LIMITS = { melody: [48, 96], bass: [24, 60], counter: [41, 84], harmony: [36, 96] };

function paramControls(app, name, part) {
  const { params } = part;
  const save = () => app.save();
  const limits = RANGE_LIMITS[name];
  return h("div", { class: "param-grid" },
    h("label", {}, h("span", {}, "音の密度 ", help(HELP.density)),
      h("input", {
        type: "range", min: 0, max: 1, step: 0.05, value: params.density,
        oninput: e => {
          params.density = Number(e.target.value);
          save();
        },
      })),
    limits && h("div", {}, h("span", {}, "音域 ", help(HELP.range)),
      h("div", { class: "range-pair" },
        noteSelect(params.low, limits[0], limits[1], "音域の下", v => {
          params.low = v;
          save();
        }),
        "〜",
        noteSelect(params.high, limits[0], limits[1], "音域の上", v => {
          params.high = v;
          save();
        }))),
    h("label", {}, "スタイル",
      h("select", {
        onchange: e => {
          params.style = e.target.value;
          save();
        },
      }, STYLES[name].map(([value, text]) => h("option", { value, selected: params.style === value }, text)))));
}

function afterDraw(app) {
  app.commit();
  if (app.ui.autoPlay && !app.player.playing) app.play("section");
}

function runDraw(app, name, seed) {
  const section = app.section;
  if (NEEDS_CHORDS.includes(name) && sectionChords(section).length === 0) {
    toast("先にコードを置いてください");
    return;
  }
  if (name === "harmony" && section.parts.melody.notes.length === 0) {
    toast("ハモリはメロディに合わせて作ります。先にメロディを引いてください");
    return;
  }
  draw(section, name, app.song.settings.key, seed);
  afterDraw(app);
}

function partRow(app, name) {
  const section = app.section;
  const key = app.song.settings.key;
  const part = section.parts[name];
  const stale = isStale(section, name);
  const historyCount = part.history.length;
  const seedInput = h("input", {
    type: "number",
    class: "seed-input",
    min: 1,
    value: part.seed,
    "aria-label": `${PART_LABEL[name]}のシード`,
    title: "シード",
  });
  return h("div", { class: `part-row part-${name}`, "data-part": name },
    h("div", {},
      h("div", { class: "part-title" }, h("span", { class: "part-dot" }), PART_LABEL[name]),
      h("button", {
        type: "button",
        class: "btn primary part-gacha",
        disabled: part.locked,
        onclick: () => runDraw(app, name, newSeed()),
      }, "ガチャを引く"),
      h("div", { class: "part-controls", style: { marginTop: "4px" } },
        h("button", {
          type: "button",
          class: "btn small toggle",
          "aria-pressed": String(part.locked),
          title: "ロックすると全体ガチャでも変わりません",
          onclick: () => {
            part.locked = !part.locked;
            app.commit();
          },
        }, part.locked ? "ロック中" : "ロック"),
        h("button", {
          type: "button",
          class: "btn small",
          disabled: part.locked || part.historyIndex <= 0,
          "aria-label": "前の結果へ",
          title: "前の結果へ",
          onclick: () => {
            moveHistory(section, name, -1, key);
            app.commit();
          },
        }, "◀"),
        h("span", { class: "note" }, historyCount ? `${part.historyIndex + 1}/${historyCount}` : "0/0"),
        h("button", {
          type: "button",
          class: "btn small",
          disabled: part.locked || part.historyIndex >= historyCount - 1,
          "aria-label": "次の結果へ",
          title: "次の結果へ",
          onclick: () => {
            moveHistory(section, name, 1, key);
            app.commit();
          },
        }, "▶")),
      h("div", { class: "part-controls", style: { marginTop: "4px" } },
        h("span", { class: "note" }, "シード", help(HELP.seed)),
        seedInput,
        h("button", {
          type: "button",
          class: "btn small",
          disabled: part.locked,
          title: "このシードと今のパラメータで作り直します",
          onclick: () => runDraw(app, name, Math.max(1, Math.floor(Number(seedInput.value)) || 1)),
        }, "再生成"))),
    h("div", {},
      roll(name === "drums" ? drumRects(part.notes) : pitchRects(part.notes), "まだありません"),
      stale && h("div", { class: "stale" }, "コード進行やメロディが変わりました。引き直すと合わせ直せます"),
      paramControls(app, name, part)),
    mixControls(app, name));
}

function chordRow(app) {
  const events = chordEvents(app.section, app.song.settings.key);
  const notes = events.flatMap(e => e.notes.map(midi => ({ t: e.step, d: e.dur, midi })));
  return h("div", { class: "part-row part-chords", "data-part": "chords" },
    h("div", {},
      h("div", { class: "part-title" }, h("span", { class: "part-dot" }), PART_LABEL.chords),
      h("span", { class: "note" }, "セクションに置いたコードを鳴らします")),
    h("div", {}, roll(pitchRects(notes), "コードを置くとここに出ます")),
    mixControls(app, "chords"));
}

export function renderParts(app) {
  const panel = document.getElementById("parts-panel");
  const { song, ui } = app;
  replace(panel,
    h("div", { class: "panel-head" },
      h("h2", {}, "パートとミキサー"), help(HELP.gacha),
      h("span", { class: "note" }, `セクション ${app.section.name} のパート`),
      h("span", { class: "spacer" }),
      h("label", { class: "toggle-label" },
        h("input", { type: "checkbox", checked: ui.autoPlay, onchange: e => { ui.autoPlay = e.target.checked; } }),
        "引いたらすぐ再生"),
      h("button", {
        type: "button",
        class: "btn primary",
        onclick: () => {
          const section = app.section;
          if (sectionChords(section).length === 0) {
            toast("先にコードを置いてください");
            return;
          }
          const done = drawAll(section, song.settings.key, newSeed);
          if (done.length === 0) toast("すべてのパートがロックされています");
          else afterDraw(app);
        },
      }, "全体ガチャ")),
    h("div", { class: "master-row", style: { marginBottom: "4px" } },
      h("span", { class: "note" }, "マスター音量", help(HELP.mixer)),
      h("input", {
        type: "range", min: 0, max: 1, step: 0.01, value: song.mix.master, "aria-label": "マスター音量",
        oninput: e => {
          song.mix.master = Number(e.target.value);
          app.player.applyMix();
          app.save();
        },
      })),
    chordRow(app),
    PART_NAMES.map(name => partRow(app, name)));
}

/** 再生位置を、音符の絵の上に出す */
export function highlightRolls(pos, selectedId) {
  const show = pos && pos.sectionId === selectedId;
  document.querySelectorAll(".roll-playhead").forEach(el => {
    el.hidden = !show;
    if (show) el.style.left = `${(pos.bar / BARS_PER_SECTION) * 100}%`;
  });
}
