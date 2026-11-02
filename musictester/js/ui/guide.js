// 理論ガイド（機能の流れ・終止・継ぎ目・強進行）と、次のコードの候補
import { h, help, replace } from "./dom.js";
import { analyzeSection } from "../core/guide.js";
import { suggestNext, completedProgressions, sequenceEndingAt } from "../core/progressions.js";
import { HELP } from "../core/explain.js";
import { realize } from "../core/theory.js";
import { BARS_PER_SECTION, barChord } from "../core/song.js";

const MAX_SUGGESTIONS = 6;

function card(title, helpText, verdict, text, extra) {
  return h("div", { class: "guide-card" },
    h("h3", {}, title, helpText && help(helpText)),
    verdict && h("div", { class: "verdict" }, verdict),
    h("p", {}, text),
    extra);
}

export function renderGuide(app) {
  const panel = document.getElementById("guide-panel");
  const key = app.song.settings.key;
  const a = analyzeSection(app.section, key);
  const head = h("div", { class: "panel-head" }, h("h2", {}, "理論ガイド"), help(HELP.guide));
  if (a.count < 2) {
    replace(panel, head, h("p", { class: "note" }, "コードを 2 つ以上置くと、流れや終止の解説がここに出ます。"));
    return;
  }
  const c = a.cadence;
  const cadenceVerdict = `${c.label}（${c.from.name} → ${c.to.name}）`;
  const cadenceNote = c.reachedEnd ? null : h("p", { class: "note" }, `${c.lastBar + 1} 小節目までの判定です。`);
  const strongText = a.strong.length
    ? a.strong.map(t => `${t.from.name} → ${t.to.name}`).join("、")
    : "今の進行には、根音が完全 5 度下がる動きはありません。";
  replace(panel,
    head,
    h("div", { class: "guide-grid" },
      card("終わり方（終止）", HELP.cadence, cadenceVerdict, c.text, cadenceNote),
      card("ループの継ぎ目", HELP.seam, `${a.seam.from.name} → ${a.seam.to.name}`, a.seam.text),
      card("強進行", HELP.strong, a.strong.length ? `${a.strong.length} か所` : "なし", strongText)),
    h("ol", { class: "flow-list" }, a.transitions.map(t => h("li", { class: t.kind },
      h("span", { class: "flow-move" }, `${t.from.name} → ${t.to.name}`, h("small", {}, `${t.from.func}→${t.to.func}`)),
      h("span", {}, t.strong && t.from.name !== t.to.name && h("span", { class: "tag-strong" }, "強進行"), t.text)))));
}

/** 候補の基準になる小節（最後に置いた小節。なければコードのある最後の小節） */
function anchorBar(app) {
  const { bars } = app.section;
  const last = app.ui.lastBar;
  if (last !== null && barChord(bars[last])) return last;
  for (let i = BARS_PER_SECTION - 1; i >= 0; i--) if (barChord(bars[i])) return i;
  return null;
}

export function renderSuggestions(app) {
  const box = document.getElementById("suggest-box");
  if (!box) return;
  const key = app.song.settings.key;
  const section = app.section;
  const bar = anchorBar(app);
  if (bar === null) {
    replace(box);
    return;
  }
  const seq = sequenceEndingAt(section, bar);
  const done = completedProgressions(seq, key.mode);
  const nextBar = bar + 1;
  const items = nextBar < BARS_PER_SECTION ? suggestNext(seq, key.mode).slice(0, MAX_SUGGESTIONS) : [];
  if (items.length === 0 && done.length === 0) {
    replace(box);
    return;
  }
  replace(box, h("div", { class: "suggest" },
    h("div", { class: "suggest-head" }, "次のコードの候補", help(HELP.suggest),
      items.length > 0 && h("span", { class: "note" }, `押すと ${nextBar + 1} 小節目に置きます`)),
    done.length > 0 && h("p", { class: "note" }, `ここまでで ${done.map(p => p.name).join("、")} ができています。`),
    h("div", { class: "suggest-list" }, items.map(s => {
      const c = realize(s.next, key);
      return h("button", {
        type: "button",
        class: "suggest-item",
        title: s.progression.impression,
        onclick: () => app.placeChord(nextBar, s.next),
      }, "次に ", h("b", {}, `${c.name}（${c.roman}）`), ` を置くと ${s.progression.name} になります`);
    }))));
}
