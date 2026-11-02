// DOM の小さな道具。文字は textContent で入れるので、曲名などに HTML が混ざっても安全。

/** h("div", { class: "x", onclick: fn }, 子, 子…) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected") el[k] = !!v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export function replace(el, ...children) {
  el.textContent = "";
  append(el, children);
}

/** 用語の解説を出す (?) ボタン */
export const help = text => h("button", { type: "button", class: "help", "data-help": text, "aria-label": `解説: ${text}` }, "?");

// ---------------------------------------------------------------- 解説の吹き出し（1 つを使い回す）

/** モーダルのダイアログは最前面の層に出るので、開いている間はその中に置かないと隠れてしまう */
const layerRoot = () => document.querySelector("dialog[open]") || document.body;

let tip = null;
let tipOwner = null;

function showTip(owner) {
  if (!tip) {
    tip = h("div", { class: "tooltip", role: "tooltip" });
  }
  layerRoot().append(tip);
  tip.textContent = owner.dataset.help;
  tip.style.display = "block";
  const r = owner.getBoundingClientRect();
  const w = tip.offsetWidth;
  const hgt = tip.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const above = r.top - hgt - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${above >= 8 ? above : r.bottom + 8}px`;
  tipOwner = owner;
}

function hideTip() {
  if (tip) tip.style.display = "none";
  tipOwner = null;
}

export function installTooltips() {
  const ownerOf = e => e.target.closest?.("[data-help]");
  document.addEventListener("mouseover", e => {
    const o = ownerOf(e);
    if (o) showTip(o);
    else if (tipOwner) hideTip();
  });
  document.addEventListener("focusin", e => {
    const o = ownerOf(e);
    if (o) showTip(o);
  });
  document.addEventListener("focusout", hideTip);
  // タッチではホバーがないので、タップで開閉する
  document.addEventListener("click", e => {
    const o = ownerOf(e);
    if (o) showTip(o);
    else hideTip();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") hideTip();
  });
  window.addEventListener("scroll", hideTip, true);
}

// ---------------------------------------------------------------- 短い通知

let toastTimer = null;

export function toast(message, kind = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = h("div", { id: "toast", role: "status", "aria-live": "polite" });
  }
  layerRoot().append(el);
  el.textContent = message;
  el.className = `show toast-${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, kind === "error" ? 6000 : 2800);
}
