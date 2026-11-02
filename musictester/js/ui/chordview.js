// コードの表示（タイルとスロットで共通の中身）
import { h } from "./dom.js";
import { realize } from "../core/theory.js";

/** コード名・ディグリー・機能のバッジ */
export function chordFace(chord, key) {
  const c = realize(chord, key);
  return [
    h("span", { class: "chord-name" }, c.name),
    h("span", { class: "chord-roman" }, c.roman),
    h("span", { class: "fn-badge", title: `機能: ${c.func}` }, c.func),
  ];
}

export const fnClass = (chord, key) => `fn-${realize(chord, key).func}`;
