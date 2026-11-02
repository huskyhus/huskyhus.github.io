// コードパレットと、コードの解説欄
import { h, help, replace } from "./dom.js";
import { chordFace, fnClass } from "./chordview.js";
import { diatonicChords, secondaryChords, borrowedChords } from "../core/palette.js";
import { explainChord, FUNCTION_INFO, HELP } from "../core/explain.js";
import { keyName, scaleNames } from "../core/theory.js";

const sameChord = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);

function tile(chord, app) {
  const key = app.song.settings.key;
  const { ui } = app;
  const el = h("button", {
    type: "button",
    class: `tile ${fnClass(chord, key)} ${sameChord(ui.armed, chord) ? "armed" : ""}`,
    "data-drag": "chord",
    onclick: () => {
      // タップ: 説明を出して試聴し、次に小節を押すとそこへ置ける状態にする
      ui.armed = sameChord(ui.armed, chord) ? null : chord;
      ui.info = chord;
      app.player.previewChord(chord, key, app.song.mix.parts.chords.timbre);
      document.querySelectorAll(".tile.armed").forEach(t => t.classList.remove("armed"));
      if (ui.armed) el.classList.add("armed");
      renderInfo(app);
      app.refreshSlots();
    },
    onmouseenter: () => {
      if (!sameChord(ui.info, chord)) {
        ui.info = chord;
        renderInfo(app);
      }
    },
    onfocus: () => {
      ui.info = chord;
      renderInfo(app);
    },
  }, chordFace(chord, key));
  el.dragChord = chord;
  return el;
}

function renderInfo(app) {
  const box = document.getElementById("chord-info");
  if (!box) return;
  const key = app.song.settings.key;
  const { ui } = app;
  if (!ui.info) {
    replace(box,
      h("p", {}, `${keyName(key)}の音階: ${scaleNames(key).join(" ")}`),
      h("p", { class: "note" }, "タイルにマウスを乗せると、構成音と役割の説明が出ます。タイルを小節へドラッグして置きます。押すと試聴できます（押したあとに小節を押しても置けます）。"));
    return;
  }
  const e = explainChord(ui.info, key);
  replace(box,
    h("div", { class: "info-head" },
      h("span", { class: "info-title" }, e.title),
      h("button", {
        type: "button",
        class: "btn small",
        onclick: () => app.player.previewChord(ui.info, key, app.song.mix.parts.chords.timbre),
      }, "♪ 試聴")),
    h("div", { class: "info-tones", "aria-label": "構成音" }, e.tones.map(t => h("span", {}, t))),
    e.lines.map(l => h("p", {}, l)),
    h("p", { class: "fn-line" }, e.functionText));
}

export function renderPalette(app) {
  const panel = document.getElementById("palette-panel");
  const { ui, song } = app;
  const { mode } = song.settings.key;
  const size = ui.size;
  const tabs = h("div", { class: "tabs", role: "tablist" },
    [["diatonic", "ダイアトニック"], ["outside", "調の外"]].map(([id, label]) =>
      h("button", {
        type: "button",
        role: "tab",
        class: "tab",
        "aria-selected": String(ui.paletteTab === id),
        onclick: () => {
          ui.paletteTab = id;
          renderPalette(app);
        },
      }, label)));
  const sizes = h("div", { class: "tabs", role: "group", "aria-label": "和音の音数" },
    [[3, "三和音"], [4, "四和音"]].map(([n, label]) =>
      h("button", {
        type: "button",
        class: "tab",
        "aria-pressed": String(size === n),
        onclick: () => {
          ui.size = n;
          ui.armed = null;
          renderPalette(app);
        },
      }, label)), help(HELP.size));

  const body = ui.paletteTab === "diatonic"
    ? [h("div", { class: "group-label" }, mode === "major" ? "長調のコード" : "短調のコード（V と vii° は和声短音階から）", help(HELP.degree)),
      h("div", { class: "tiles" }, diatonicChords(mode, size).map(c => tile(c, app)))]
    : [h("div", { class: "group-label" }, "セカンダリードミナント", help(HELP.secondary)),
      h("div", { class: "tiles" }, secondaryChords(mode, size).map(c => tile(c, app))),
      h("div", { class: "group-label" }, "同主調からの借用和音", help(HELP.borrowed)),
      h("div", { class: "tiles" }, borrowedChords(mode, size).map(c => tile(c, app)))];

  replace(panel,
    h("div", { class: "panel-head" }, h("h2", {}, "コードパレット"), h("span", { class: "spacer" }), sizes),
    tabs,
    h("div", { style: { marginTop: "8px" } }, body),
    h("div", { class: "legend" },
      ["T", "S", "D"].map(f => h("span", { class: `fn-${f}` }, h("i"), `${f} ${FUNCTION_INFO[f].name}（${FUNCTION_INFO[f].short}）`)),
      help(HELP.function)),
    h("div", { class: "info", id: "chord-info" }));
  renderInfo(app);
}
