// BGM。musiclab の仕組み（music/ にコピーしたエンジンとスケッチ）をそのまま使い、Web Audio で合成して鳴らす。
// music/ の中は musiclab と同じファイルなので、曲を直したら musiclab からコピーし直す。
// 曲はスーパーハスタワーだけ。タイトルでもプレイ中でも途切れずに鳴らし続ける。

import { Engine, defaultParams } from "../music/lib/engine.js";
import SONG from "../music/sketches/hustower-super.js";

const ON_KEY = "husmaze.bgmOn";
const VOLUME = 0.32;

const engine = new Engine();
let on = (() => { try { return localStorage.getItem(ON_KEY) !== "0"; } catch { return true; } })();
let tempoRate = 1;

export const isOn = () => on;
export const isPlaying = () => engine.playing;

/** 最初のユーザー操作の中で呼ぶ（ブラウザの自動再生制限のため）。オンなら鳴らし始める */
export function startBgm() {
  engine.unlock();
  engine.setVolume(VOLUME);
  if (!on || engine.playing) return;
  engine.params = defaultParams(SONG);
  engine.bpm = SONG.bpm * tempoRate;
  engine.play(SONG);
}

export function setOn(v) {
  on = v;
  try { localStorage.setItem(ON_KEY, v ? "1" : "0"); } catch { /* 保存できなくても鳴る */ }
  if (v) startBgm();
  else engine.stop(0.3);
}

/** テンポの倍率（スローモーション中は遅くする） */
export function setTempoRate(rate) {
  if (rate === tempoRate) return;
  tempoRate = rate;
  if (engine.playing) engine.setBpm(SONG.bpm * rate);
}

// タブが裏に回ったら止めておく（スケジューラはタイマーで動くので、裏では間引かれて音が乱れる）
document.addEventListener("visibilitychange", () => {
  if (!engine.ac) return;
  if (document.hidden) engine.ac.suspend();
  else engine.ac.resume();
});
