// アプリの入口。状態を 1 か所に持ち、変更のたびに画面を描き直す。
import { h, installTooltips, replace, toast } from "./ui/dom.js";
import { installDnd } from "./ui/dnd.js";
import { chordFace, fnClass } from "./ui/chordview.js";
import { renderPalette } from "./ui/palette.js";
import { renderSections, renderArrangement } from "./ui/sections.js";
import { renderGuide, renderSuggestions } from "./ui/guide.js";
import { renderDictionary } from "./ui/dictionary.js";
import { renderParts, highlightRolls } from "./ui/parts.js";
import { openIoDialog } from "./ui/io.js";
import { Player } from "./audio/player.js";
import { HELP } from "./core/explain.js";
import { saveWork, loadWork, safeStorage } from "./core/storage.js";
import { tonicName } from "./core/theory.js";
import {
  createSong, findSection, changeKey, clampBpm, setBarChord, swapBars, moveInArrangement, barChord,
} from "./core/song.js";

const $ = id => document.getElementById(id);
const SAVE_DELAY_MS = 300;
let saveTimer = null;

/** 描き直しでフォーカスを失わないよう、パネルの中で何番目の部品かを覚えて戻す */
function rememberFocus() {
  const active = document.activeElement;
  const panel = active?.closest?.(".panel");
  if (!panel) return () => {};
  const controls = root => [...root.querySelectorAll("button, input, select, summary")];
  const index = controls(panel).indexOf(active);
  return () => {
    if (index >= 0 && !panel.contains(active)) controls(panel)[index]?.focus({ preventScroll: true });
  };
}

function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const result = saveWork(safeStorage(), app.song, app.ui.selectedId);
  app.ui.saveNote = {
    full: "",
    "no-history": "ブラウザの保存容量が足りないため、ガチャの履歴を除いて自動保存しています。ファイルへの保存では履歴も残ります。",
    failed: "このブラウザには自動保存できません。ファイルに保存してください。",
  }[result];
}

const app = {
  song: createSong(),
  ui: {
    selectedId: "s1",
    paletteTab: "diatonic",
    size: 3,
    info: null,     // 解説を出しているコード
    armed: null,    // 押して選んだコード（次に押した小節へ置く）
    lastBar: null,  // 最後に置いた / 選んだ小節
    loop: false,
    playScope: null,
    insertAt: "auto",
    insertRepeat: false,
    openProgression: null,
    autoPlay: true,
    saveNote: "",
  },
  player: null,

  render() {
    const restoreFocus = rememberFocus();
    syncHeader();
    renderPalette(this);
    renderSections(this);
    renderArrangement(this);
    renderSuggestions(this);
    renderGuide(this);
    renderDictionary(this);
    renderParts(this);
    highlightPosition(this.player.currentPos);
    restoreFocus();
  },

  /** 曲を変更したあとに呼ぶ */
  commit() {
    this.render();
    this.save();
  },

  /** 画面を描き直さずに保存だけ（スライダーなど）。連続した変更はまとめて書く */
  save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
  },

  play(scope) {
    play(scope);
  },

  /** 読み込んだ曲に入れ替える */
  replaceSong(song) {
    this.player.stop();
    this.song = song;
    Object.assign(this.ui, { selectedId: song.sections[0].id, lastBar: null, info: null, armed: null });
    this.player.applyMix();
    this.commit();
    updateTransport();
  },

  /** 小節のスロットだけ描き直す（タイルを押して「ここに置く」を出すとき） */
  refreshSlots() {
    renderSections(this);
    renderSuggestions(this);
    highlightPosition(this.player.currentPos);
  },

  selectSection(id) {
    if (this.ui.selectedId !== id) {
      this.ui.selectedId = id;
      this.ui.lastBar = null;
      this.save();
    }
    this.render();
  },

  get section() {
    return findSection(this.song, this.ui.selectedId);
  },

  /** 小節 bar にコードを置いて、続きの候補の基準にする */
  placeChord(bar, chord) {
    setBarChord(this.section, bar, chord);
    this.ui.lastBar = bar;
    this.ui.armed = null;
    this.commit();
  },
};

app.player = new Player(() => app.song);

// ---------------------------------------------------------------- 上の帯

function syncHeader() {
  const { song, ui } = app;
  const { key, bpm } = song.settings;
  const tonic = $("tonic");
  // 開いているプルダウンが閉じないよう、綴りが変わるときだけ作り直す
  if (tonic.dataset.mode !== key.mode) {
    tonic.dataset.mode = key.mode;
    replace(tonic, Array.from({ length: 12 }, (_, i) => h("option", { value: i }, tonicName({ tonic: i, mode: key.mode }))));
  }
  tonic.value = key.tonic;
  $("mode").value = key.mode;
  $("bpm").value = bpm;
  $("bpm-range").value = bpm;
  if (document.activeElement !== $("title")) $("title").value = song.title;
  $("loop").setAttribute("aria-pressed", String(ui.loop));
}

function setKey(tonic, mode) {
  changeKey(app.song, { tonic, mode });
  app.commit();
}

function setBpm(value) {
  if (value !== "") app.song.settings.bpm = clampBpm(value);   // 空にされたら今の値へ戻す
  $("bpm").value = app.song.settings.bpm;
  $("bpm-range").value = app.song.settings.bpm;
  app.save();
}

function updateTransport() {
  const { player, ui } = app;
  $("stop").disabled = !player.playing;
  $("play-song").classList.toggle("is-playing", player.playing && ui.playScope === "song");
  $("play-section").classList.toggle("is-playing", player.playing && ui.playScope === "section");
}

function play(scope) {
  const { ui, player, song } = app;
  if (scope === "song" && song.arrangement.length === 0) {
    toast("曲の構成が空です。セクションを構成へ追加してください。");
    return;
  }
  ui.playScope = scope;
  player.start({ scope, sectionId: ui.selectedId, loop: ui.loop });
  updateTransport();
}

function stop() {
  app.player.stop();
  updateTransport();
}

function highlightPosition(pos) {
  document.querySelectorAll(".slot.playing, .arr-chip.playing").forEach(el => el.classList.remove("playing"));
  highlightRolls(pos, app.ui.selectedId);
  if (!pos) return;
  if (pos.sectionId === app.ui.selectedId) {
    document.querySelector(`.slot[data-bar="${pos.bar}"]`)?.classList.add("playing");
  }
  if (pos.arrangementIndex >= 0) {
    document.querySelector(`.arr-chip[data-arr="${pos.arrangementIndex}"]`)?.classList.add("playing");
  }
}

app.player.onPosition = pos => {
  // 曲全体の再生中は、鳴っているセクションを画面に出す
  if (pos && app.ui.playScope === "song" && pos.sectionId !== app.ui.selectedId) {
    app.ui.selectedId = pos.sectionId;
    app.ui.lastBar = null;
    app.render();
  }
  highlightPosition(pos);
  if (!pos) updateTransport();
};

function wireHeader() {
  $("help-key").dataset.help = HELP.key;
  $("help-bpm").dataset.help = HELP.bpm;
  $("title").addEventListener("input", e => {
    app.song.title = e.target.value;
    app.save();
  });
  $("open-io").addEventListener("click", () => openIoDialog(app));
  $("tonic").addEventListener("change", e => setKey(Number(e.target.value), app.song.settings.key.mode));
  $("mode").addEventListener("change", e => setKey(app.song.settings.key.tonic, e.target.value));
  $("bpm-range").addEventListener("input", e => {
    setBpm(e.target.value);
  });
  $("bpm").addEventListener("change", e => {
    setBpm(e.target.value);
  });
  $("play-song").addEventListener("click", () => play("song"));
  $("play-section").addEventListener("click", () => play("section"));
  $("stop").addEventListener("click", stop);
  $("loop").addEventListener("click", () => {
    app.ui.loop = !app.ui.loop;
    app.player.loop = app.ui.loop;
    syncHeader();
  });
  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.target.closest("input, select, textarea, button, dialog")) return;
    e.preventDefault();
    if (app.player.playing) stop();
    else play("section");
  });
}

// ---------------------------------------------------------------- ドラッグ&ドロップ

function dragPayload(el) {
  switch (el.dataset.drag) {
    case "chord": return { type: "chord", chord: el.dragChord };
    case "bar": return { type: "bar", from: Number(el.dataset.barFrom) };
    case "arr": return { type: "arr", from: Number(el.dataset.arr) };
    case "section": return { type: "section", id: el.dataset.section };
    default: return null;
  }
}

function dragGhost(el, payload) {
  const key = app.song.settings.key;
  const chord = payload.type === "chord" ? payload.chord : payload.type === "bar" ? barChord(app.section.bars[payload.from]) : null;
  if (chord) return h("div", { class: `tile ${fnClass(chord, key)}` }, chordFace(chord, key));
  return h("div", { class: "arr-chip" }, el.firstChild.textContent);
}

function onDrop(payload, target) {
  const kind = target.dataset.drop;
  if (kind === "bar") {
    const to = Number(target.dataset.bar);
    if (payload.type === "chord") {
      app.placeChord(to, payload.chord);
    } else if (payload.type === "bar") {
      swapBars(app.section, payload.from, to);
      app.ui.lastBar = to;
      app.commit();
    }
    return;
  }
  if (kind === "arr") {
    const to = Number(target.dataset.index);
    if (payload.type === "arr") moveInArrangement(app.song, payload.from, to);
    else if (payload.type === "section") app.song.arrangement.splice(to, 0, payload.id);
    app.commit();
  }
}

const canDrop = (payload, target) => {
  if (target.dataset.drop === "bar") return payload.type === "chord" || payload.type === "bar";
  if (target.dataset.drop === "arr") return payload.type === "arr" || payload.type === "section";
  return false;
};

// ---------------------------------------------------------------- 起動

function restoreWork() {
  const saved = loadWork(safeStorage());
  if (!saved) return;
  app.song = saved.song;
  app.ui.selectedId = findSection(saved.song, saved.selectedId) ? saved.selectedId : saved.song.sections[0].id;
}

function init() {
  restoreWork();
  installTooltips();
  installDnd({ getPayload: dragPayload, onDrop, makeGhost: dragGhost, canDrop });
  wireHeader();
  app.render();
  updateTransport();
  // タブを閉じる直前の変更も残す
  window.addEventListener("pagehide", () => {
    if (saveTimer !== null) flushSave();
  });
}

init();
window.musictester = app;   // 動作確認用（コンソールから曲の中身を見られる）
