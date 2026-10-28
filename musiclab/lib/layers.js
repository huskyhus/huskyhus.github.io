// 声部を重ねる曲の組み立て。声部ごとに「鳴らす / 楽器 / 音量」を画面で選べるスケッチを作る。
//
// 声部: { name, pan（mix.js の PANS）, inst（最初の楽器）, vol（基準の音量）, play(x, voice, fx), echo? }
//   voice(t, 長さ, MIDI 番号, 音量の倍率 = 1, 楽器への追加の設定) で、画面で選んだ楽器が鳴る
//   on: false を書くと、最初は鳴らさない（画面で鳴らせる）
//   echo: { steps（16 分音符いくつ分遅らせるか）, feedback, wet } を書くと、その声部だけにエコーをかける。
//         play の 3 つ目の引数 fx.echo.setWet(v) で、セクションごとに深さを変えられる
//   reverb: 残響へ送る量（0〜1）。残響は曲全体で 1 つ（左右に広がる部屋の響き）。
//           fx.space.setLevel(v) で、曲全体の残響の深さを変えられる（静かなセクションほど深く、など）
//   ドラムの声部は inst の代わりに kit（最初のキット）を持ち、play(x, kit) にドラムキットが渡る
// x: { t, bar, pos, b（その小節: chord, lead など）, s16（16 分音符の秒数）, root / mid / high（和音の根音と構成音）,
//      bass（低音: 分数コードなら分母の音。root と同じ C2〜G2 の音域） }
import { createSynth, INSTRUMENTS, INSTRUMENT_LABELS, KITS } from "./synth.js";
import { PANS, createBus } from "./mix.js";
import { chordMidis, freq, bassOf } from "./theory.js";

/** 8 分音符単位の楽譜で、今の pos に始まる音（無ければ null） */
export const noteAt = (line, pos) => (line && pos % 2 === 0 ? line[pos / 2] : null);

/**
 * bars は小節ごとの { chord, ... }。info(b, x, 鳴っている声部の数) を返すと、小節の頭で画面に出す
 * swing: 拍の裏を後ろへずらす量（16 分音符の何個分か。0.67 で 3 連符のシャッフル）。
 *        拍の中の時間を「表の 8 分は長く、裏の 8 分は短く」伸び縮みさせる。音の出だしだけでなく終わりも同じように
 *        ずらすので、裏の音が次の拍の音に食い込まない
 * paramsFrom: [スケッチ名, スケッチ] を書くと、画面の設定（鳴らす・楽器・音量）をそのスケッチと共通にする（この曲の画面には出さない）
 */
export function layeredSong({ layers, bars, info, swing = 0, paramsFrom, ...rest }) {
  /** 16 分音符単位の位置 → シャッフルでずらした位置（拍の頭はそのまま、8 分の裏は swing だけ後ろ） */
  const swung = p => {
    const base = 4 * Math.floor(p / 4), f = p - base;
    return base + (f < 2 ? f * (2 + swing) / 2 : 2 + swing + (f - 2) * (2 - swing) / 2);
  };
  const params = {};
  layers.forEach((l, i) => {
    params[`on${i}`] = { label: `${i + 1}. ${l.name}`, value: l.on ?? true };
    params[`inst${i}`] = l.kit
      ? { label: "　キット", options: Object.keys(KITS), labels: KITS, value: l.kit }
      : { label: "　楽器", options: Object.keys(INSTRUMENTS), labels: INSTRUMENT_LABELS, value: l.inst };
    params[`vol${i}`] = { label: "　音量", min: 0, max: 2, step: 0.05, value: 1 };
  });

  return {
    ...rest,
    bars: bars.length,
    data: bars,        // 小節ごとのデータ（曲の切り替えで、行き先の最初のコードを知るため）
    layers,            // 声部（tools/voices.mjs が音を出さずに動かして点検する）
    params: paramsFrom ? {} : params,

    setup({ ac, out, noiseBuf, sixteenth }) {
      const { bus, level } = createBus(ac, out);
      // 残響: 声部から送られた音の響きだけを、卓（bus）へ戻す
      const room = createSynth(ac, bus, noiseBuf).reverb();
      const returnGain = ac.createGain();
      room.output.connect(returnGain).connect(bus);
      const space = { setLevel: v => returnGain.gain.setTargetAtTime(v, ac.currentTime, 0.3) };
      const voices = layers.map(l => {
        const gain = ac.createGain();
        const pan = ac.createStereoPanner();
        pan.pan.value = PANS[l.pan];
        gain.connect(pan).connect(bus);
        if (l.reverb) {
          const send = ac.createGain();
          send.gain.value = l.reverb;
          pan.connect(send).connect(room.input);
        }
        if (!l.echo) return { gain, synth: createSynth(ac, gain, noiseBuf), vol: 1, fx: { space } };
        const echo = createSynth(ac, gain, noiseBuf).echo({ ...l.echo, time: l.echo.steps * sixteenth });
        return { gain, synth: createSynth(ac, echo.input, noiseBuf), vol: 1, fx: { echo, space } };
      });
      return { voices, level };
    },

    onTempo({ state, sixteenth }) {
      layers.forEach((l, i) => l.echo && state.voices[i].fx.echo.setTime(l.echo.steps * sixteenth));
    },

    step(at, { params: own, paramsOf, state, sixteenth, say }) {
      const p = paramsFrom ? paramsOf(...paramsFrom) : own;
      const b = bars[at.bar];
      const x = {
        ...at, b, s16: sixteenth,
        t: at.t + (swung(at.pos) - at.pos) * sixteenth,
        root: chordMidis(b.chord, 0, 36, 7)[0],
        mid: chordMidis(b.chord, 0, 60, 6),
        high: chordMidis(b.chord, 0, 84, 6),
        bass: chordMidis({ root: bassOf(b.chord), tones: [0] }, 0, 36, 7)[0],
      };
      if (at.pos === 0 && info) say(info(b, x, layers.filter((_, i) => p[`on${i}`]).length));
      layers.forEach((l, i) => {
        const v = state.voices[i];
        // オフにしたら音量を 0 にして、鳴り残りもすぐ止める
        const vol = p[`on${i}`] ? p[`vol${i}`] : 0;
        if (v.vol !== vol) { v.gain.gain.setTargetAtTime(vol, at.t, 0.02); v.vol = vol; }
        if (!p[`on${i}`]) return;
        const inst = p[`inst${i}`];
        if (l.kit) { l.play(x, v.synth.kit(inst)); return; }
        // シャッフルのときは、音の終わりも同じ伸び縮みでずらす
        const len = dur => (swing ? (swung(at.pos + dur / sixteenth) - swung(at.pos)) * sixteenth : dur);
        l.play(x, (t, dur, m, mul = 1, opts = {}) => v.synth.play(inst, t, len(dur), freq(m), { ...opts, vol: l.vol * mul }), v.fx);
      });
    },
  };
}
