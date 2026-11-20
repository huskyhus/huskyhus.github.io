// 用語集のモーダル。G キー、下の「用語」ボタン、スライド中の太字の用語のクリックで開く。
// 既定では、今のステップまでに定義した用語だけを出す（README §5 の規則を、用語集でも守る）。
(function () {
  "use strict";
  const entries = LECTURE.glossary || [];
  const modal = document.getElementById("glossary");
  const list = modal.querySelector(".gl-list");
  const search = modal.querySelector("input[type=search]");
  const showAll = modal.querySelector("input[type=checkbox]");
  const count = modal.querySelector(".gl-count");
  const btn = document.getElementById("btn-glossary");
  const PARTS = { ch1: "第1部", ch2: "第2部", ch3: "第3部", ch4: "第4部", ch5a: "第5部", ch5b: "第5部", ch6: "第6部" };

  // 項目の DOM は一度だけ作る（KaTeX の描画を毎回しない）
  const items = entries.map((g) => {
    const el = document.createElement("article");
    el.className = "gl-item" + (g.kind === "定理" ? " gl-theorem" : "");
    el.innerHTML = `
      <header><h3>${g.term}</h3><span class="gl-label">${g.label}</span>
        <button type="button" class="gl-jump" title="定義した場面へ">この場面へ ▶</button></header>
      <p class="gl-def">${g.def}</p>
      <p class="gl-meaning"><span class="gl-tag">工学的な意味</span>${g.meaning}</p>`;
    el.querySelector(".gl-jump").addEventListener("click", () => { close(); PLAYER.goTo(g.at); });
    return { g, el, part: PARTS[g.at.split("/")[0]], rendered: false };
  });

  function render() {
    const here = PLAYER.index();
    const q = search.value.trim().toLowerCase();
    let shown = 0, lastPart = null;
    list.innerHTML = "";
    for (const it of items) {
      const defined = PLAYER.indexOf(it.g.at) <= here;
      if (!defined && !showAll.checked) continue;
      if (q && !(it.g.term + it.g.def + it.g.meaning).toLowerCase().includes(q)) continue;
      if (it.part !== lastPart) {
        const h = document.createElement("h2");
        h.textContent = it.part;
        list.appendChild(h);
        lastPart = it.part;
      }
      it.el.classList.toggle("gl-future", !defined);
      if (!it.rendered) { PLAYER.renderMath(it.el); it.rendered = true; }
      list.appendChild(it.el);
      shown++;
    }
    const total = items.filter((it) => PLAYER.indexOf(it.g.at) <= here).length;
    count.textContent = showAll.checked ? `全 ${items.length} 語（未定義のものは薄く表示）` : `ここまでに定義した ${total} / ${items.length} 語`;
    if (!shown) list.innerHTML = `<p class="gl-empty">${q ? "該当する用語がない" : "まだ用語を定義していない"}</p>`;
  }

  function open(term) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    btn.setAttribute("aria-pressed", "true");
    search.value = "";
    render();
    const it = term && find(term);
    if (it && it.el.isConnected) {
      it.el.scrollIntoView({ block: "center" });
      it.el.classList.add("gl-flash");
      setTimeout(() => it.el.classList.remove("gl-flash"), 1200);
    } else {
      list.scrollTop = list.scrollHeight; // 最後に定義した用語のあたりを見せる
      search.focus();
    }
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    btn.setAttribute("aria-pressed", "false");
  }
  function find(text) {
    const t = text.trim();
    return items.find((it) => it.g.term === t || it.g.match === t) || items.find((it) => it.g.term.includes(t) || t.includes(it.g.match || it.g.term));
  }

  btn.addEventListener("click", () => (modal.hidden ? open() : close()));
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  modal.querySelector(".gl-close").addEventListener("click", close);
  search.addEventListener("input", render);
  showAll.addEventListener("change", render);
  document.addEventListener("keydown", (e) => {
    if (!modal.hidden) {
      if (e.key === "Escape") { close(); e.preventDefault(); }
      return;
    }
    if ((e.key === "g" || e.key === "G") && !(e.target.matches && e.target.matches("input, textarea, select"))) {
      open();
      e.preventDefault();
    }
  });
  // index.html?glossary で開いた状態で始める。?check では全項目の数式を検査する
  window.addEventListener("load", () => {
    if (location.search.includes("glossary")) open();
    if (location.search.includes("check")) {
      const bad = [];
      for (const it of items) {
        if (!it.rendered) { PLAYER.renderMath(it.el); it.rendered = true; }
        if (it.el.querySelector(".katex-error")) bad.push(`glossary KaTeX: ${it.g.term}`);
      }
      const pre = document.createElement("pre");
      pre.id = "glossary-report";
      pre.textContent = bad.length ? bad.join("\n") : `OK（${items.length} 語）`;
      document.body.appendChild(pre);
    }
  });

  // スライド中の太字の用語をクリックすると、その項目を開く
  document.getElementById("stage").addEventListener("click", (e) => {
    const t = e.target.closest(".term");
    if (t) open(t.textContent);
  });
})();
