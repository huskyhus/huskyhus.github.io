// セクションの編集（小節のスロット）と、曲の構成（セクションの並び）
import { h, help, replace } from "./dom.js";
import { chordFace, fnClass } from "./chordview.js";
import { HELP } from "../core/explain.js";
import { realize } from "../core/theory.js";
import {
  addSection, deleteSection, duplicateSection, findSection, barChord, setBarChord, sectionChords,
} from "../core/song.js";

function slot(section, i, app) {
  const key = app.song.settings.key;
  const { ui } = app;
  const chord = barChord(section.bars[i]);
  const placeArmed = () => {
    app.placeChord(i, ui.armed);
  };
  const remove = () => {
    setBarChord(section, i, null);
    if (ui.lastBar === i) ui.lastBar = null;
    app.commit();
  };
  return h("div", {
    class: `slot ${ui.lastBar === i ? "current" : ""}`,
    "data-drop": "bar",
    "data-bar": i,
  },
  chord
    ? [
      h("button", {
        type: "button",
        class: `slot-chord ${fnClass(chord, key)}`,
        "data-drag": "bar",
        "data-bar-from": i,
        "aria-label": `${i + 1} 小節目`,
        onclick: () => {
          if (ui.armed) {
            placeArmed();
            return;
          }
          ui.info = chord;
          ui.lastBar = i;
          app.player.previewChord(chord, key, app.song.mix.parts.chords.timbre);
          app.render();
        },
        onkeydown: e => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            remove();
          }
        },
      }, chordFace(chord, key),
      section.bars[i].chords.slice(1).map(c => h("span", { class: "chord-roman" }, `→ ${realize(c.chord, key).name}`))),
      h("button", { type: "button", class: "slot-remove", "data-nodrag": "", "aria-label": `${i + 1} 小節目のコードを削除`, title: "削除", onclick: remove }, "×"),
    ]
    : h("button", {
      type: "button",
      class: "slot-empty",
      "aria-label": `${i + 1} 小節目（空き）`,
      onclick: () => {
        if (ui.armed) {
          placeArmed();
          return;
        }
        ui.lastBar = i;
        app.render();
      },
    }, ui.armed ? "ここに置く" : ""),
  h("span", { class: "slot-num" }, i + 1));
}

export function renderSections(app) {
  const panel = document.getElementById("section-panel");
  const { song, ui } = app;
  const section = findSection(song, ui.selectedId);
  const tabs = h("div", { class: "section-tabs", role: "tablist" },
    song.sections.map(s => h("button", {
      type: "button",
      role: "tab",
      class: `section-tab ${s.id === section.id ? "selected" : ""}`,
      "aria-selected": String(s.id === section.id),
      "data-drag": "section",
      "data-section": s.id,
      title: "押すと編集します。下の構成へドラッグして並べられます",
      onclick: () => app.selectSection(s.id),
    }, s.name)));
  const name = h("input", {
    type: "text",
    class: "section-name",
    value: section.name,
    maxlength: 20,
    "aria-label": "セクションの名前",
    onchange: e => {
      section.name = e.target.value.trim() || section.name;
      app.commit();
    },
  });
  const buttons = h("div", { class: "part-controls" },
    h("button", {
      type: "button", class: "btn small",
      onclick: () => {
        const s = addSection(song);
        app.selectSection(s.id);
        app.commit();
      },
    }, "＋ 追加"),
    h("button", {
      type: "button", class: "btn small",
      onclick: () => {
        const s = duplicateSection(song, section.id);
        app.selectSection(s.id);
        app.commit();
      },
    }, "複製"),
    h("button", {
      type: "button", class: "btn small",
      disabled: song.sections.length <= 1,
      onclick: () => {
        const filled = sectionChords(section).length > 0;
        if (filled && !window.confirm(`セクション「${section.name}」を削除しますか？`)) return;
        if (deleteSection(song, section.id)) {
          app.selectSection(song.sections[0].id);
          app.commit();
        }
      },
    }, "削除"));

  replace(panel,
    h("div", { class: "panel-head" },
      h("h2", {}, "セクション"), help(HELP.section), tabs, h("span", { class: "spacer" }), name, buttons),
    section.note && h("p", { class: "section-note" }, section.note),
    h("div", { class: "bars" }, section.bars.map((_, i) => slot(section, i, app))),
    h("div", { id: "suggest-box" }));
}

export function renderArrangement(app) {
  const panel = document.getElementById("arrangement-panel");
  const { song } = app;
  replace(panel,
    h("div", { class: "panel-head" }, h("h2", {}, "曲の構成"), help(HELP.arrangement),
      h("span", { class: "note" }, `全 ${song.arrangement.length * 8} 小節`)),
    h("div", { class: "arrangement" },
      song.arrangement.map((id, i) => h("div", {
        class: "arr-chip",
        "data-drag": "arr",
        "data-arr": i,
        "data-drop": "arr",
        "data-index": i,
      },
      findSection(song, id).name,
      h("button", {
        type: "button",
        "data-nodrag": "",
        "aria-label": `${i + 1} 番目を構成から外す`,
        title: "構成から外す",
        onclick: () => {
          song.arrangement.splice(i, 1);
          app.commit();
        },
      }, "×"))),
      h("div", { class: "arr-end", "data-drop": "arr", "data-index": song.arrangement.length },
        "セクションのタブをここへドラッグして追加")));
}
