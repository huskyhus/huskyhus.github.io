// 研究用のエンジン。AudioContext と先読みスケジューラを持ち、スケッチを 16 分音符ごとに呼ぶ。
// 音の経路: スケッチ → out（スケッチごと）→ master → analyser（波形表示）→ スピーカー
import { createSynth } from "./synth.js";

const LOOKAHEAD = 0.12;      // 何秒先まで予約するか
const TICK_MS = 25;

/** スケッチの params 定義から初期値を作る。prev に同じ名前で使える値があれば引き継ぐ */
export function defaultParams(sketch, prev = {}) {
  const out = {};
  for (const [k, def] of Object.entries(sketch.params || {})) {
    const ok = k in prev && (def.options ? def.options.includes(prev[k]) : typeof prev[k] === typeof def.value);
    out[k] = ok ? prev[k] : def.value;
  }
  return out;
}

export class Engine {
  constructor() {
    this.ac = null;
    this.sketch = null;
    this.params = {};
    this.bpm = 120;
    this.step = 0;           // 16 分音符の通し番号
    this.nextTime = 0;
    this.timer = null;
    this.out = null;
    this.status = "";        // スケッチが ctx.say() で出す一言
    this.onError = null;
    this.paramsOf = null;    // (スケッチ名, スケッチ) → 画面で選んだ値。別のスケッチの設定を借りるとき用
    this.history = [];       // 予約した { step, t }（画面表示を音に合わせるため）
  }

  /** 最初のユーザー操作の中で呼ぶ（ブラウザの自動再生制限のため） */
  unlock() {
    if (this.ac) {
      if (this.ac.state === "suspended") this.ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = 0.5;
    this.analyser = this.ac.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser).connect(this.ac.destination);
    this.noiseBuf = this.ac.createBuffer(1, this.ac.sampleRate * 2, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  get playing() { return !!this.timer; }

  get loopBars() {
    const b = this.sketch?.bars;
    return typeof b === "function" ? b(this.params) : b || 0;
  }

  /** sketch を bar 小節目から鳴らす */
  play(sketch, { bar = 0 } = {}) {
    this.unlock();
    this.stop(0.05);
    const { ac } = this;
    this.sketch = sketch;
    this.out = ac.createGain();
    this.out.connect(this.master);
    const engine = this;
    this.ctx = {
      ac,
      out: this.out,
      noiseBuf: this.noiseBuf,
      synth: createSynth(ac, this.out, this.noiseBuf),
      params: this.params,
      get bpm() { return engine.bpm; },
      get sixteenth() { return 60 / engine.bpm / 4; },
      say: text => { engine.status = text; },
      setBpm: bpm => engine.setBpm(bpm),
      paramsOf: (name, sk) => (engine.paramsOf ? engine.paramsOf(name, sk) : defaultParams(sk)),
    };
    this.status = "";
    try {
      this.ctx.state = sketch.setup ? sketch.setup(this.ctx) : {};
    } catch (e) {
      this.fail(e);
      return;
    }
    this.step = bar * 16;
    this.history = [];
    this.nextTime = ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  /** fade 秒かけて止める */
  stop(fade = 0.3) {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const { ac } = this;
    const out = this.out;
    out.gain.setValueAtTime(out.gain.value, ac.currentTime);
    out.gain.linearRampToValueAtTime(0, ac.currentTime + fade);
    setTimeout(() => out.disconnect(), (fade + 1.5) * 1000);   // 予約済みの音が鳴り終わってから外す
  }

  setBpm(bpm) {
    this.bpm = bpm;
    this.sketch?.onTempo?.(this.ctx);
  }

  setVolume(v) {
    this.unlock();
    this.master.gain.setTargetAtTime(v, this.ac.currentTime, 0.02);
  }

  /** 今スピーカーから出ている位置（{ step, bar, pos }）。鳴っていなければ null */
  get now() {
    if (!this.playing) return null;
    const t = this.ac.currentTime;
    while (this.history.length > 1 && this.history[1].t <= t) this.history.shift();
    const h = this.history[0];
    return h && h.t <= t ? h : null;
  }

  fail(e) {
    console.error(e);
    this.stop(0.05);
    this.onError?.(e);
  }

  tick() {
    const { ac } = this;
    if (this.nextTime < ac.currentTime - 0.05) this.nextTime = ac.currentTime + 0.05;
    while (this.nextTime < ac.currentTime + LOOKAHEAD) {
      // スケッチが loopFrom（小節）を持てば、2 周目からはそこへ戻る（イントロを 1 回だけ鳴らす）
      const loop = this.loopBars * 16;
      const from = Math.min((this.sketch.loopFrom || 0) * 16, loop - 16);
      const s = !loop ? this.step : this.step < loop ? this.step : from + (this.step - loop) % (loop - from);
      const at = { t: this.nextTime, step: s, bar: Math.floor(s / 16), pos: s % 16 };
      try {
        this.sketch.step(at, this.ctx);
      } catch (e) {
        this.fail(e);
        return;
      }
      this.history.push(at);
      this.nextTime += 60 / this.bpm / 4;
      this.step++;
    }
  }
}
