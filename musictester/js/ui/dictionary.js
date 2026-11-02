// 有名なコード進行の辞書
import { h, help, replace, toast } from "./dom.js";
import { PROGRESSIONS, progressionChords, insertProgression } from "../core/progressions.js";
import { realize } from "../core/theory.js";
import { BARS_PER_SECTION, barChord } from "../core/song.js";

const firstEmptyBar = section => {
  const i = section.bars.findIndex(b => !barChord(b));
  return i < 0 ? 0 : i;
};

function item(prog, app) {
  const { song, ui } = app;
  const key = song.settings.key;
  const chords = progressionChords(prog, key.mode).map(c => realize(c, key));
  const other = prog.mode !== key.mode;
  return h("details", {
    class: "dict-item",
    open: ui.openProgression === prog.id,
    ontoggle: e => {
      if (e.target.open) ui.openProgression = prog.id;
      else if (ui.openProgression === prog.id) ui.openProgression = null;
    },
  },
  h("summary", {}, prog.name, other && h("span", { class: "mode-tag" }, prog.mode === "major" ? "長調の進行" : "短調の進行"),
    h("span", { class: "dict-degrees" }, prog.degrees.join(" – "))),
  h("div", { class: "dict-body" },
    h("p", { class: "dict-names" }, chords.map(c => c.name).join(" – ")),
    h("p", {}, prog.impression),
    h("p", { class: "note" }, prog.scene),
    other && h("p", { class: "note" }, key.mode === "minor"
      ? "短調では、同じ度数の短調の和音に置き換えて入れます。"
      : "長調では、借用和音として同じ響きのまま入れます。"),
    h("div", { class: "dict-actions" },
      h("button", {
        type: "button",
        class: "btn small primary",
        onclick: () => {
          const section = app.section;
          const start = ui.insertAt === "auto" ? firstEmptyBar(section) : Number(ui.insertAt);
          const last = insertProgression(section, prog, key.mode, start, ui.insertRepeat);
          ui.lastBar = last;
          app.commit();
          toast(`${prog.name} を ${start + 1} 小節目から入れました`);
        },
      }, "セクションに挿入"),
      h("button", {
        type: "button",
        class: "btn small",
        onclick: () => app.player.previewSequence(progressionChords(prog, key.mode), key, song.mix.parts.chords.timbre),
      }, "♪ 試聴"))));
}

export function renderDictionary(app) {
  const panel = document.getElementById("dictionary-panel");
  const { song, ui } = app;
  const { mode } = song.settings.key;
  const sorted = [...PROGRESSIONS].sort((a, b) => (a.mode === mode ? 0 : 1) - (b.mode === mode ? 0 : 1));
  const list = panel.querySelector(".dict-list");
  const scroll = list ? list.scrollTop : 0;
  replace(panel,
    h("div", { class: "panel-head" }, h("h2", {}, "有名なコード進行"),
      help("ディグリーで書かれているので、どの調でも同じ響きの型として使えます。")),
    h("div", { class: "dict-actions", style: { marginBottom: "6px" } },
      h("label", { class: "toggle-label" }, "挿入先",
        h("select", {
          "aria-label": "挿入先の小節",
          onchange: e => { ui.insertAt = e.target.value; },
        },
        h("option", { value: "auto", selected: ui.insertAt === "auto" }, "最初の空き小節"),
        Array.from({ length: BARS_PER_SECTION }, (_, i) =>
          h("option", { value: i, selected: ui.insertAt === String(i) }, `${i + 1} 小節目`)))),
      h("label", { class: "toggle-label" },
        h("input", { type: "checkbox", checked: ui.insertRepeat, onchange: e => { ui.insertRepeat = e.target.checked; } }),
        "最後まで繰り返す")),
    h("div", { class: "dict-list" }, sorted.map(p => item(p, app))));
  panel.querySelector(".dict-list").scrollTop = scroll;
}
