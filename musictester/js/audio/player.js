// 再生。AudioContext の時刻を基準に、先読みして音を予約する。
// setInterval は「次を予約しに行くきっかけ」にだけ使い、発音の時刻は nextTime から計算する。
// 音の経路: 音色 → session（再生ごと）→ パートの gain → sum → コンプレッサー → master → スピーカー
import { Synth } from "./synth.js";
import { findSection, MIX_NAMES, SECTION_STEPS, STEPS_PER_BAR } from "../core/song.js";
import { eventsAtStep, playlist } from "../core/playback.js";
import { realize, voiceChord } from "../core/theory.js";

const TICK_MS = 25;
const LOOKAHEAD = 0.15;           // 通常の先読み（秒）
const LOOKAHEAD_HIDDEN = 1.5;     // 裏のタブではタイマーが 1 秒ごとに間引かれるので、長めに予約する

export class Player {
  /** getSong: 今の曲を返す関数。編集がすぐ次のステップに反映されるよう、毎回読み直す */
  constructor(getSong) {
    this.getSong = getSong;
    this.ac = null;
    this.timer = null;
    this.scope = "song";
    this.sectionId = null;
    this.loop = false;
    this.onPosition = null;   // 音に合わせた位置 { sectionId, arrangementIndex, bar, step } か null（停止）
    this.queue = [];
    this.raf = null;
    this.currentPos = null;
  }

  get playing() { return !!this.timer; }

  /** ユーザー操作の中で最初に呼ぶ（ブラウザの自動再生制限のため） */
  ensureAudio() {
    if (this.ac) {
      if (this.ac.state === "suspended") this.ac.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ac = new AC();
    this.ac = ac;
    this.synth = new Synth(ac);
    this.sum = ac.createGain();
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.master = ac.createGain();
    this.sum.connect(this.comp).connect(this.master).connect(ac.destination);
    this.partGains = {};
    for (const m of MIX_NAMES) {
      const g = ac.createGain();
      g.connect(this.sum);
      this.partGains[m] = g;
    }
    this.previewGain = ac.createGain();
    this.previewGain.gain.value = 0.8;
    this.previewGain.connect(this.sum);
    this.applyMix(true);
    return true;
  }

  /** ミックスの設定を音に反映する（ミュート・ソロ・音量） */
  applyMix(instant = false) {
    if (!this.ac) return;
    const { mix } = this.getSong();
    const anySolo = MIX_NAMES.some(m => mix.parts[m].solo);
    const now = this.ac.currentTime;
    const set = (param, v) => {
      if (instant) param.value = v;
      else param.setTargetAtTime(v, now, 0.015);
    };
    for (const m of MIX_NAMES) {
      const p = mix.parts[m];
      const audible = anySolo ? p.solo : !p.mute;
      set(this.partGains[m].gain, audible ? p.volume : 0);
    }
    set(this.master.gain, mix.master);
  }

  /** scope = "song" | "section" で再生を始める。何も鳴らせなければ false */
  start({ scope, sectionId, loop }) {
    if (!this.ensureAudio()) return false;
    const song = this.getSong();
    if (playlist(song, scope, sectionId).length === 0) return false;
    this.stop(0.03);
    this.scope = scope;
    this.sectionId = sectionId;
    this.loop = loop;
    this.index = 0;
    this.step = 0;
    this.queue = [];
    this.session = {};
    for (const m of MIX_NAMES) {
      const g = this.ac.createGain();
      g.connect(this.partGains[m]);
      this.session[m] = g;
    }
    this.nextTime = this.ac.currentTime + 0.08;
    this.finished = false;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.watchPosition();
    return true;
  }

  stop(fade = 0.06) {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    const { session } = this;
    const now = this.ac.currentTime;
    // 予約済みの音は止められないので、その再生専用の gain を絞ってから外す
    for (const g of Object.values(session)) {
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
    }
    setTimeout(() => {
      for (const g of Object.values(session)) g.disconnect();
    }, (fade + 0.2) * 1000);
    this.currentPos = null;
    this.onPosition?.(null);
  }

  tick() {
    const { ac } = this;
    if (this.finished) {
      if (ac.currentTime >= this.nextTime) this.stop(0.5);
      return;
    }
    // タイマーが大きく遅れたら、過去の時刻に予約しないよう現在へ合わせる
    if (this.nextTime < ac.currentTime - 0.05) this.nextTime = ac.currentTime + 0.05;
    const ahead = typeof document !== "undefined" && document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
    while (this.nextTime < ac.currentTime + ahead) {
      if (!this.scheduleStep()) return;
    }
  }

  /** 1 ステップ分を予約する。曲の終わりで止まるなら false */
  scheduleStep() {
    const song = this.getSong();
    const list = playlist(song, this.scope, this.sectionId);
    if (this.index >= list.length) {
      if (!this.loop || list.length === 0) {
        this.finished = true;
        return false;
      }
      this.index = 0;
    }
    const section = findSection(song, list[this.index]);
    const t = this.nextTime;
    for (const e of eventsAtStep(section, this.step, song.settings.key)) this.playEvent(e, t, song);
    if (this.step % STEPS_PER_BAR === 0) {
      this.queue.push({ time: t, sectionId: section.id, arrangementIndex: this.scope === "song" ? this.index : -1, bar: this.step / STEPS_PER_BAR });
    }
    this.nextTime += 60 / song.settings.bpm / 4;
    this.step++;
    if (this.step >= SECTION_STEPS) {
      this.step = 0;
      this.index++;
    }
    return true;
  }

  playEvent(e, t, song) {
    const dest = this.session[e.part];
    const stepSec = 60 / song.settings.bpm / 4;
    if (e.drum) {
      this.synth.drum(dest, e.drum, t, e.v);
      return;
    }
    const timbre = song.mix.parts[e.part].timbre;
    for (const midi of e.notes) this.synth.tone(dest, timbre, midi, t, e.dur * stepSec, e.v);
  }

  /** 音の出るタイミングに合わせて画面へ位置を知らせる */
  watchPosition() {
    const frame = () => {
      if (!this.timer) return;
      const now = this.ac.currentTime;
      // 裏のタブから戻ったときに溜まっている分は、最新の位置だけ知らせる
      let latest = null;
      while (this.queue.length && this.queue[0].time <= now) latest = this.queue.shift();
      if (latest) {
        this.currentPos = latest;
        this.onPosition?.(latest);
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** パレットのコードの試聴（ミュートやソロに関係なく鳴らす） */
  previewChord(chord, key, timbre = "piano") {
    if (!this.ensureAudio()) return;
    const v = voiceChord(realize(chord, key));
    const t = this.ac.currentTime + 0.02;
    for (const n of v.notes) this.synth.tone(this.previewGain, timbre, n, t, 1.1, 0.8);
  }

  /** 進行の試聴。1 つ 0.6 秒で順に鳴らす */
  previewSequence(chords, key, timbre = "piano") {
    if (!this.ensureAudio()) return;
    let prev = null;
    const start = this.ac.currentTime + 0.02;
    chords.forEach((chord, i) => {
      const v = voiceChord(realize(chord, key), prev);
      prev = v.upper;
      for (const n of v.notes) this.synth.tone(this.previewGain, timbre, n, start + i * 0.6, 0.58, 0.8);
    });
  }
}
