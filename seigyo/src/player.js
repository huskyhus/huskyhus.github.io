// 場面の再生。章 → 場面 → ステップを1本の列に並べ、前後に進める。
// 章の終わりからは、そのまま次の章の最初の場面へ続く。
(function () {
  "use strict";
  const N = window.NARRATION;
  const stage = document.getElementById("stage");
  const sub = document.getElementById("subtitle");
  const crumb = document.getElementById("crumb");
  const posEl = document.getElementById("pos");
  const bar = document.getElementById("progress-bar");
  const menu = document.getElementById("menu");

  const SECONDS_PER_CHAR = 0.13; // 音声が無いときの自動送りの目安（読み1文字あたり）

  // ---- 章・場面・ステップを組み立てる ----
  const chapters = N.order.map((cid) => {
    const nch = N.chapters[cid];
    const sdef = LECTURE.scenes[cid] || { scenes: [] };
    const byId = Object.fromEntries((sdef.scenes || []).map((s) => [s.id, s]));
    const scenes = nch.scenes.map((ns) => {
      const def = byId[ns.id] || null;
      const lastBlock = def ? Math.max(1, ...(def.blocks || []).map((b) => b.at || 1)) : 1;
      return { id: ns.id, title: ns.title, def, narration: ns.steps, nsteps: Math.max(ns.steps.length, lastBlock) };
    });
    for (const id of Object.keys(byId)) {
      if (!nch.scenes.some((s) => s.id === id)) console.warn(`${cid}/${id}: 場面データはあるがナレーション原稿に無い`);
    }
    return { id: cid, part: nch.part, title: nch.title, scenes };
  });

  const timeline = [];
  chapters.forEach((ch, ci) =>
    ch.scenes.forEach((sc, si) => {
      for (let k = 1; k <= sc.nsteps; k++) timeline.push({ ci, si, step: k });
    })
  );

  // ---- 状態 ----
  let index = 0;
  let current = null; // { ci, si, blocks: [{el, at, until}], figs: [] }
  let subsOn = true;
  let audioOn = true;
  let autoplay = false;
  let audio = null;
  let timer = null;

  // ---- 文字と数式 ----
  function renderMath(el) {
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  function makeBlock(b) {
    let el;
    const html = (tag, cls, inner) => {
      const e = document.createElement(tag);
      e.className = cls;
      e.innerHTML = inner;
      return e;
    };
    switch (b.type) {
      case "title": el = html("h1", "b-title", b.text); break;
      case "subtitle": el = html("p", "b-subtitle", b.text); break;
      case "h": el = html("h3", "b-h", b.text); break;
      case "p": el = html("p", "b-p", b.text); break;
      case "note": el = html("p", "b-note", b.text); break;
      case "quote": el = html("p", "b-quote", b.text); break;
      case "list": el = html("ul", "b-list", b.items.map((i) => `<li>${i}</li>`).join("")); break;
      case "math": {
        el = document.createElement("div");
        el.className = "b-math";
        katex.render(b.tex, el, { displayMode: true, throwOnError: false });
        break;
      }
      case "def":
        el = html("div", "b-def", `<div class="label">${b.label}</div><div class="body">${b.text}</div>`);
        break;
      case "fig": {
        el = document.createElement("div");
        el.className = "fig";
        const make = FIG[b.name];
        if (!make) {
          el.textContent = `図 ${b.name} が見つからない`;
          return { el, fig: null };
        }
        return { el, fig: { make, opts: b.opts || {} } };
      }
      default: el = html("div", "b-html", b.html || "");
    }
    if (b.type !== "math") renderMath(el);
    return { el, fig: null };
  }

  // ---- 場面を作る ----
  function buildScene(ci, si) {
    const ch = chapters[ci];
    const sc = ch.scenes[si];
    if (current) current.figs.forEach((f) => f.inst && f.inst.destroy && f.inst.destroy());
    // 速く送ると、消えかけの場面が複数残りうる。消えかけのものは即座に消し、表示中のものだけ溶かす
    stage.querySelectorAll(".scene").forEach((old) => {
      if (old.classList.contains("leaving")) return old.remove();
      old.classList.add("leaving");
      old.classList.remove("shown");
      setTimeout(() => old.remove(), 350);
    });

    const root = document.createElement("section");
    const def = sc.def;
    const layout = def ? def.layout || "full" : "full";
    root.className = `scene layout-${layout}` + (def ? "" : " placeholder");
    root.innerHTML = `<div class="scene-head"><span class="part">${ch.part}</span><h2>${sc.title}</h2></div><div class="areas"></div>`;
    const areas = root.querySelector(".areas");
    const areaEls = {};
    const area = (name) => {
      if (!areaEls[name]) {
        const a = document.createElement("div");
        a.className = `area area-${name}`;
        areas.appendChild(a);
        areaEls[name] = a;
      }
      return areaEls[name];
    };
    // 2段組は左右の順を固定する
    if (layout.startsWith("split")) { area("left"); area("right"); }

    const blocks = [];
    const figs = [];
    if (def) {
      for (const b of def.blocks || []) {
        const { el, fig } = makeBlock(b);
        el.classList.add("blk");
        if (b.cls) el.classList.add(...b.cls.split(" "));
        if (b.style) el.style.cssText += b.style;
        area(b.area || (layout.startsWith("split") ? "left" : "main")).appendChild(el);
        blocks.push({ el, at: b.at || 1, until: b.until || null, dimAfter: b.dimAfter || null, collapse: !!b.collapse });
        if (fig) figs.push({ el, ...fig });
      }
    } else {
      // まだスライドを作っていない場面：原稿をそのまま本文として出す
      const m = area("main");
      m.innerHTML = `<span class="badge">スライド制作中 — 原稿を表示</span><div class="ph-text"></div><div class="ph-steps"></div>`;
    }
    stage.insertBefore(root, sub);
    // 図はDOMに入ってから作る（大きさを測れるように）
    for (const f of figs) f.inst = f.make(f.el, f.opts, { data: window.DATA, chapter: ch.id });
    requestAnimationFrame(() => root.classList.add("shown"));
    current = { ci, si, root, blocks, figs };
  }

  function applyStep(step) {
    const sc = chapters[current.ci].scenes[current.si];
    for (const b of current.blocks) {
      const visible = step >= b.at && (b.until === null || step <= b.until);
      b.el.classList.toggle("hidden", !visible);
      b.el.classList.toggle("gone", b.collapse && !visible);
      b.el.classList.toggle("dim", visible && b.dimAfter !== null && step > b.dimAfter);
    }
    for (const f of current.figs) if (f.inst && f.inst.step) f.inst.step(step);

    const nar = sc.narration[step - 1];
    if (!sc.def) {
      current.root.querySelector(".ph-text").textContent = nar ? nar.text : "";
      current.root.querySelector(".ph-steps").innerHTML = sc.narration.map((_, i) => `<i class="${i < step ? "on" : ""}"></i>`).join("");
    }
    sub.textContent = nar ? nar.text : "";
    sub.classList.toggle("off", !subsOn || !sc.def || !nar);
    return nar;
  }

  // ---- 移動 ----
  function go(i, { fromHash = false } = {}) {
    i = Math.max(0, Math.min(timeline.length - 1, i));
    const t = timeline[i];
    if (!current || current.ci !== t.ci || current.si !== t.si) buildScene(t.ci, t.si);
    index = i;
    const nar = applyStep(t.step);
    const ch = chapters[t.ci];
    const sc = ch.scenes[t.si];
    crumb.innerHTML = `<b>${ch.part} ${ch.title}</b>${sc.title}`;
    posEl.textContent = `${ch.id}/${sc.id}/${t.step}　（${i + 1} / ${timeline.length}）`;
    bar.style.width = `${((i + 1) / timeline.length) * 100}%`;
    const hash = `#${ch.id}/${sc.id}/${t.step}`;
    if (!fromHash && location.hash !== hash) history.replaceState(null, "", hash);
    markMenu();
    speak(nar);
  }
  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  function fromHash() {
    const m = location.hash.match(/^#([^/]+)\/([^/]+)(?:\/(\d+))?$/);
    if (!m) return 0;
    const ci = chapters.findIndex((c) => c.id === m[1]);
    if (ci < 0) return 0;
    const si = chapters[ci].scenes.findIndex((s) => s.id === m[2]);
    const step = +(m[3] || 1);
    const i = timeline.findIndex((t) => t.ci === ci && (si < 0 || t.si === si) && (si < 0 || t.step === step));
    return i < 0 ? 0 : i;
  }

  // ---- 音声と自動送り ----
  // 読み上げの優先順：
  //   1. 音声ファイル（window.AUDIO_FILES = { "ch1/s03/2": "audio/....ogg", ... } があれば。後から追加する用）
  //   2. ブラウザの音声合成（Web Speech API）で、原稿の yomi を読む
  //   3. どちらも無ければ、読みの文字数から待ち時間を決める（自動送りのときだけ）
  const tts = window.speechSynthesis || null;
  const voiceSel = document.getElementById("voice");
  const rateSel = document.getElementById("rate");
  let speechToken = 0;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても動く */ } },
  };

  function jaVoices() {
    return tts ? tts.getVoices().filter((v) => /^ja/i.test(v.lang)) : [];
  }
  function fillVoices() {
    const vs = jaVoices();
    const saved = store.get("seigyo.voice");
    voiceSel.innerHTML = vs.length
      ? vs.map((v) => `<option value="${v.name}">${v.name.replace(/^Microsoft |^Google /, "").replace(/ - Japanese.*$/, "")}${v.localService ? "" : "（オンライン）"}</option>`).join("")
      : `<option value="">日本語の声がない</option>`;
    if (saved && vs.some((v) => v.name === saved)) voiceSel.value = saved;
  }
  if (tts) {
    fillVoices();
    tts.addEventListener("voiceschanged", fillVoices);
  }
  voiceSel.addEventListener("change", () => { store.set("seigyo.voice", voiceSel.value); go(index); });
  rateSel.value = store.get("seigyo.rate") || "1.1";
  rateSel.addEventListener("change", () => { store.set("seigyo.rate", rateSel.value); go(index); });

  function stopSpeech() {
    speechToken++;
    if (audio) { audio.pause(); audio = null; }
    if (tts) tts.cancel();
    clearTimeout(timer);
  }
  function finished(token) {
    if (token === speechToken && autoplay) timer = setTimeout(next, 600);
  }
  function speak(nar) {
    stopSpeech();
    const token = speechToken;
    if (!nar) return autoplay && (timer = setTimeout(next, 3000));
    const byLength = () => { if (autoplay) timer = setTimeout(next, Math.max(1.5, (nar.yomi.length * SECONDS_PER_CHAR) / +rateSel.value) * 1000); };
    if (!audioOn) return byLength();

    const file = window.AUDIO_FILES && window.AUDIO_FILES[nar.id];
    if (file) {
      const a = new Audio(file);
      audio = a;
      a.addEventListener("ended", () => finished(token));
      a.addEventListener("error", () => { if (token === speechToken) speakTTS(nar, token, byLength); });
      a.play().catch(() => {}); // 自動再生が止められたときは error 側か、次の操作で鳴る
      return;
    }
    speakTTS(nar, token, byLength);
  }
  function speakTTS(nar, token, byLength) {
    const voice = jaVoices().find((v) => v.name === voiceSel.value) || jaVoices()[0];
    if (!tts || !voice) return byLength();
    // 長い発話は途中で切れるブラウザがあるので、文ごとに分けて順に読む
    const sentences = nar.yomi.split(/(?<=[。？！])/).map((s) => s.trim()).filter(Boolean);
    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = +rateSel.value;
      if (i === sentences.length - 1) u.addEventListener("end", () => finished(token));
      u.addEventListener("error", (e) => { if (e.error !== "interrupted" && e.error !== "canceled" && token === speechToken) byLength(); });
      tts.speak(u);
    });
  }

  // ---- メニュー ----
  function buildMenu() {
    menu.innerHTML = chapters.map((ch, ci) => `
      <h3 data-ci="${ci}">${ch.part} ${ch.title}<span>${ch.id}</span></h3>
      <ol>${ch.scenes.map((sc, si) => `<li data-ci="${ci}" data-si="${si}">${sc.title}${sc.def ? "" : "（原稿のみ）"}</li>`).join("")}</ol>`).join("");
    menu.addEventListener("click", (e) => {
      const t = e.target.closest("[data-ci]");
      if (!t) return;
      const ci = +t.dataset.ci;
      const si = t.dataset.si === undefined ? 0 : +t.dataset.si;
      go(timeline.findIndex((x) => x.ci === ci && x.si === si));
      toggleMenu(false);
    });
  }
  function markMenu() {
    if (menu.hidden) return;
    menu.querySelectorAll("li").forEach((li) =>
      li.classList.toggle("current", current && +li.dataset.ci === current.ci && +li.dataset.si === current.si));
  }
  function toggleMenu(open = menu.hidden) {
    menu.hidden = !open;
    document.getElementById("btn-menu").setAttribute("aria-pressed", String(open));
    markMenu();
  }

  // ---- 拡大縮小 ----
  function fit() {
    const vp = document.getElementById("viewport").getBoundingClientRect();
    const s = Math.min(vp.width / 1600, vp.height / 900) * 0.98;
    stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
  }

  // ---- 入力 ----
  const isControl = (el) => el.closest && el.closest(".interactive, input, button, select, textarea, a, .term");
  stage.addEventListener("click", (e) => { if (!isControl(e.target)) next(); });
  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("modal-open")) return; // 用語集などが開いている間は、そちらがキーを受け取る
    if (e.target.matches && e.target.matches("input, textarea, select")) {
      if (e.key !== "PageDown" && e.key !== "PageUp" && e.key !== "Escape") return;
    }
    switch (e.key) {
      case "ArrowRight": case " ": case "PageDown": case "Enter": next(); break;
      case "ArrowLeft": case "PageUp": case "Backspace": prev(); break;
      case "Home": go(0); break;
      case "End": go(timeline.length - 1); break;
      case "m": case "M": toggleMenu(); break;
      case "Escape": toggleMenu(false); break;
      case "s": case "S": setSubs(!subsOn); break;
      case "p": case "P": setAuto(!autoplay); break;
      case "a": case "A": setAudio(!audioOn); break;
      case "f": case "F": document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); break;
      default: return;
    }
    e.preventDefault();
  });
  const btn = (id, fn) => document.getElementById(id).addEventListener("click", fn);
  function setSubs(v) {
    subsOn = v;
    document.getElementById("btn-subs").setAttribute("aria-pressed", String(v));
    applyStep(timeline[index].step); // 音声は止めずに字幕だけ切り替える
  }
  function setAuto(v) { autoplay = v; document.getElementById("btn-auto").setAttribute("aria-pressed", String(v)); go(index); }
  function setAudio(v) { audioOn = v; document.getElementById("btn-audio").setAttribute("aria-pressed", String(v)); go(index); }
  btn("btn-prev", prev);
  btn("btn-next", next);
  btn("btn-menu", () => toggleMenu());
  btn("btn-subs", () => setSubs(!subsOn));
  btn("btn-auto", () => setAuto(!autoplay));
  btn("btn-audio", () => setAudio(!audioOn));
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", () => go(fromHash(), { fromHash: true }));

  // ---- 検査モード（index.html?check）：各場面の最後のステップで、はみ出しと数式の誤りを調べる ----
  function check() {
    const report = [];
    const sr = stage.getBoundingClientRect();
    const scale = sr.width / 1600;
    const lastSteps = timeline.filter((t, i) => i === timeline.length - 1 || timeline[i + 1].si !== t.si || timeline[i + 1].ci !== t.ci);
    for (const t of lastSteps) {
      const i = timeline.indexOf(t);
      go(i);
      stage.querySelectorAll(".scene.leaving").forEach((e) => e.remove());
      const id = `${chapters[t.ci].id}/${chapters[t.ci].scenes[t.si].id}/${t.step}`;
      if (!chapters[t.ci].scenes[t.si].def) { report.push(`${id} 場面データなし`); continue; }
      current.root.querySelectorAll(".katex-error").forEach((e) => report.push(`${id} KaTeX: ${e.title || e.textContent}`));
      const limitY = sub.classList.contains("off") ? 900 - 20 : 900 - 28 - sub.offsetHeight - 6;
      for (const b of current.blocks) {
        if (b.el.classList.contains("hidden")) continue;
        // flex で縮められた箱からはみ出す中身もあるので、子孫まで含めて測る
        let rb = -Infinity, rr = -Infinity;
        for (const e of [b.el, ...b.el.querySelectorAll("*")]) {
          if (e.closest(".hidden") && e.closest(".hidden") !== b.el) continue;
          if (e.closest(".katex-mathml, .katex svg, .hide-tail, clipPath, [clip-path], defs, marker")) continue; // 見えない部分、切り取られる部分
          const r = e.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          rb = Math.max(rb, r.bottom); rr = Math.max(rr, r.right);
        }
        const bottom = (rb - sr.top) / scale, right = (rr - sr.left) / scale;
        if (bottom > limitY + 1) report.push(`${id} 下にはみ出し ${Math.round(bottom - limitY)}px: ${b.el.className}`);
        if (right > 1600 - 40) report.push(`${id} 右にはみ出し ${Math.round(right - 1560)}px: ${b.el.className}`);
      }
    }
    // 速く送っても場面が1つだけ残ること（場面をまたいで10回続けて送る）
    go(0);
    for (let k = 0; k < 10; k++) go(timeline.findIndex((t, i) => i > index && (t.si !== timeline[index].si || t.ci !== timeline[index].ci)));
    setTimeout(() => {
      const n = stage.querySelectorAll(".scene").length;
      if (n !== 1) report.push(`速く送ったあと場面が ${n} 個残っている`);
      const pre = document.createElement("pre");
      pre.id = "check-report";
      pre.textContent = report.length ? report.join("\n") : "OK";
      document.body.appendChild(pre);
    }, 800);
  }

  // 用語集（src/glossary.js）などから使う窓口
  window.PLAYER = {
    index: () => index,
    indexOf: (id) => {
      const [cid, sid, step] = id.split("/");
      return timeline.findIndex((t) => chapters[t.ci].id === cid && chapters[t.ci].scenes[t.si].id === sid && t.step === +step);
    },
    goTo(id) { const i = this.indexOf(id); if (i >= 0) go(i); },
    renderMath,
  };

  buildMenu();
  fit();
  if (location.search.includes("check")) {
    window.addEventListener("load", () => setTimeout(check, 300));
  } else go(fromHash());
})();
