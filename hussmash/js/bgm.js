// BGM。musiclab の仕組み（music/ にコピーしたエンジンとスケッチ）をそのまま使い、Web Audio で合成して鳴らす。
// music/ の中は musiclab と同じファイルなので、曲を直したら musiclab からコピーし直す。
//   タイトル・ロビー: 学園都市のハスタワー / 対戦: 戦闘曲 1「ハスタワー」

import { Engine, defaultParams } from "../music/lib/engine.js";
import ACADEMY from "../music/sketches/hustower-academy.js";
import BATTLE from "../music/sketches/hustower-battle.js";

const ON_KEY = "hussmash.bgmOn";
const VOLUME = 0.3;
const SONGS = { title: ACADEMY, battle: BATTLE };

const engine = new Engine();
let on = (() => { try { return localStorage.getItem(ON_KEY) !== "0"; } catch { return true; } })();
let want = "title";
let current = null;

export const isOn = () => on;
export const audioContext = () => engine.ac;

/** 最初のユーザー操作の中で呼ぶ（ブラウザの自動再生制限のため） */
export function unlockAudio() {
  engine.unlock();
  engine.setVolume(VOLUME);
  sync();
}

/** "title" か "battle"。同じ曲なら鳴らし直さない */
export function playSong(name) {
  want = name;
  if (engine.ac) sync();
}

function sync() {
  if (!on) { if (engine.playing) engine.stop(0.3); current = null; return; }
  if (current === want && engine.playing) return;
  const song = SONGS[want];
  if (engine.playing) engine.stop(0.5);
  engine.params = defaultParams(song);
  engine.bpm = song.bpm;
  engine.play(song);
  current = want;
}

export function setOn(v) {
  on = v;
  try { localStorage.setItem(ON_KEY, v ? "1" : "0"); } catch { /* 保存できなくても鳴る */ }
  if (engine.ac) sync();
}

// タブが裏に回ったら止めておく（スケジューラはタイマーで動くので、裏では間引かれて音が乱れる）
document.addEventListener("visibilitychange", () => {
  if (!engine.ac) return;
  if (document.hidden) engine.ac.suspend();
  else engine.ac.resume();
});
