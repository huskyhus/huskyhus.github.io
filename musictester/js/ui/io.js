// 保存と読み込みのダイアログ（ファイル / テキスト）
import { h, help, replace, toast } from "./dom.js";
import { createSong, parseSong, serializeSong } from "../core/song.js";
import { HELP } from "../core/explain.js";

const fileNameOf = title => `${(title || "song").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "song"}.json`;

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text, textarea) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // クリップボードの API が使えない環境（http など）向け
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

export function openIoDialog(app) {
  const dialog = document.getElementById("io-dialog");
  const exportText = serializeSong(app.song);
  const exportArea = h("textarea", { readonly: true, "aria-label": "曲の JSON", value: exportText });
  const importArea = h("textarea", { "aria-label": "読み込む JSON", placeholder: "ここに JSON を貼り付けます" });
  const message = h("p", { class: "note", role: "alert" });

  const load = text => {
    let song;
    try {
      song = parseSong(text);
    } catch (e) {
      message.textContent = `読み込めませんでした: ${e.message}`;
      return;
    }
    if (!window.confirm("今の曲を、読み込んだ曲で置き換えますか？")) return;
    app.replaceSong(song);
    dialog.close();
    toast(`「${song.title}」を読み込みました`);
  };

  const file = h("input", {
    type: "file",
    accept: ".json,application/json",
    "aria-label": "読み込むファイル",
    onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        load(await f.text());
      } catch {
        message.textContent = "ファイルを読めませんでした";
      }
      e.target.value = "";
    },
  });

  replace(dialog,
    h("div", { class: "io-head" }, h("h2", {}, "保存と読み込み"), help(HELP.io),
      h("button", { type: "button", class: "btn small", onclick: () => dialog.close() }, "閉じる")),
    h("h3", {}, "書き出す"),
    exportArea,
    h("div", { class: "io-actions" },
      h("button", { type: "button", class: "btn primary", onclick: () => downloadText(exportText, fileNameOf(app.song.title)) }, "ファイルに保存"),
      h("button", {
        type: "button",
        class: "btn",
        onclick: async () => {
          toast(await copyText(exportText, exportArea) ? "コピーしました" : "コピーできませんでした。テキストを選択してコピーしてください", "info");
        },
      }, "テキストをコピー")),
    h("h3", {}, "読み込む"),
    h("div", { class: "io-actions" }, file),
    importArea,
    h("div", { class: "io-actions" },
      h("button", { type: "button", class: "btn primary", onclick: () => load(importArea.value) }, "貼り付けたテキストを読み込む")),
    message,
    h("h3", {}, "新しく始める"),
    h("div", { class: "io-actions" },
      h("button", {
        type: "button",
        class: "btn",
        onclick: () => {
          if (!window.confirm("今の曲を消して、新しい曲を始めますか？")) return;
          app.replaceSong(createSong());
          dialog.close();
        },
      }, "新しい曲")),
    h("p", { class: "note", style: { marginTop: "8px" } }, app.ui.saveNote || "作業中のデータは、このブラウザに自動で保存されます。"));
  dialog.showModal();
}
