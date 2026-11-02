// 作業中のデータの自動保存。localStorage は使えないこともあるので、失敗しても例外を外へ出さない。
// storage は引数で受け取る（テストでは偽物を渡す）。
import { serializeSong, parseSong, PART_NAMES } from "./song.js";

const SONG_KEY = "musictester.song";
const SELECTED_KEY = "musictester.selected";

/** 履歴を除いた曲（容量が足りないとき用。今の音符は残る） */
export function withoutHistory(song) {
  const copy = JSON.parse(serializeSong(song));
  for (const s of copy.sections) {
    for (const p of PART_NAMES) {
      s.parts[p].history = [];
      s.parts[p].historyIndex = -1;
    }
  }
  return copy;
}

/** 保存する → "full" | "no-history" | "failed" */
export function saveWork(storage, song, selectedId) {
  try {
    storage.setItem(SELECTED_KEY, selectedId);
    storage.setItem(SONG_KEY, serializeSong(song));
    return "full";
  } catch {
    try {
      storage.setItem(SONG_KEY, serializeSong(withoutHistory(song)));
      return "no-history";
    } catch {
      return "failed";
    }
  }
}

/** 読む → { song, selectedId } か null（ない・壊れている・読めない） */
export function loadWork(storage) {
  try {
    const text = storage.getItem(SONG_KEY);
    if (!text) return null;
    return { song: parseSong(text), selectedId: storage.getItem(SELECTED_KEY) };
  } catch {
    return null;
  }
}

/** window.localStorage を安全に取り出す（アクセス自体が例外になる環境があるので） */
export function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error("localStorage を使えません");
      },
    };
  }
}
