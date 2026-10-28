// 曲の切り替え: 通常曲 1〜8・戦闘曲 1〜8・ボス戦曲 1〜2・交響曲「黎明」・協奏曲「影」・エスニック版 4 曲・本番合奏の間を、途切れずに移る。
// 「次の曲」を選ぶと、今の小節（または 4 小節の区切り）まで鳴らしてから 1 小節のつなぎを入れ、
// そのあいだにテンポをなめらかに変えて、次の曲の 1 小節目に入る。
// つなぎは、盛り上がる向き（通常 → 戦闘 → ボス）なら加速とスネアの連打、落ち着く向きなら分散和音が駆け下りる。
// どちらも、行き先の最初のコードへ向かう属七の和音（V7）を鳴らして、自然に着地させる。
// 各曲の楽器・音量は、それぞれの曲の画面で選んだものを使う。
import { createMix } from "../lib/mix.js";
import { chordMidis, freq } from "../lib/theory.js";

const NAMES = [
  "hustower-massive", "hustower-normal-2", "hustower-normal-3", "hustower-normal-4",
  "hustower-normal-5", "hustower-normal-6", "hustower-normal-7", "hustower-normal-8",
  "hustower-battle", "hustower-battle-2", "hustower-battle-3", "hustower-battle-4",
  "hustower-battle-5", "hustower-battle-6", "hustower-battle-7", "hustower-battle-8",
  "hustower-boss-1", "hustower-boss-2",
  "hustower-symphony", "hustower-concerto",
  "hustower-ryukyu", "hustower-wa", "hustower-arabian", "hustower-gamelan",
  "hustower-finale",
];
const SONGS = Object.fromEntries(await Promise.all(NAMES.map(async n => [n, (await import(`./${n}.js`)).default])));
const LABELS = Object.fromEntries(NAMES.map(n => [n, SONGS[n].title]));
const INTENSITY = { normal: 1, battle: 2, boss: 3 };

/** つなぎの 16 分音符 i 個目のテンポ（1 小節かけて from → to） */
const bridgeBpm = (from, to, i) => from + (to - from) * ((i + 1) / 16);

/** つなぎの 1 小節の秒数 */
const bridgeSeconds = (from, to) => Array.from({ length: 16 }, (_, i) => 60 / bridgeBpm(from, to, i) / 4).reduce((a, b) => a + b);

/**
 * つなぎの小節の 16 分音符 i 個目。target は行き先の最初のコード、tp は行き先の曲のパラメータ
 * （楽器は inst + 声部の番号: 1 = ベース、2 = ドラム、3 = アルペジオ）
 */
function bridge(t, i, { S, tp, s16, seconds, up, target }) {
  const kit = S.C.kit(tp.inst2);
  const root = chordMidis(target, 0, 36, 7)[0];   // 着地する根音
  const dom = root + 7;                            // その属音
  const v7 = [0, 4, 7, 10].map(d => (dom + d) % 12);
  if (up) {
    // 盛り上げ: 上昇ノイズ + スネアの連打。ベースは半音ずつ上って着地の根音へ、V7 の分散和音も駆け上がる
    if (i === 0) S.C.riser(t, seconds * 0.95);
    if (i % 4 === 0) kit.kick(t);
    if (i >= 8) kit.snare(t, 0.1 + (i - 8) * 0.025);
    else if (i % 2 === 0) kit.snare(t, 0.08 + i * 0.01);
    if (i % 2 === 0) S.C.play(tp.inst1, t, 2 * s16 * 0.8, freq(root - 8 + i / 2), { vol: 0.26 });
    const rise = ladder(v7, 55, 8, 1);   // 前半で 2 オクターブ上り、後半はその 1 オクターブ上をもう一度
    S.R.play(tp.inst3, t, s16 * 0.8, freq(rise[i % 8] + (i >= 8 ? 12 : 0)), { vol: 0.03 });
  } else {
    // 落ち着かせる: 属音を伸ばしたまま、V7 の分散和音が高い所から駆け下りる
    if (i === 0 || i === 8) kit.kick(t);
    if (i === 12) kit.snare(t);
    if (i % 2 === 0) kit.hat(t, false);
    S.R.play(tp.inst3, t, s16 * 0.9, freq(ladder(v7, 91, 16, -1)[i]), { vol: 0.035 });
    if (i === 0 || i === 8) S.C.play(tp.inst1, t, 7 * s16, freq(dom), { vol: 0.3 });
  }
}

/** pcs（音名の集合）に入る音を、start から dir の向きに n 個並べる */
function ladder(pcs, start, n, dir) {
  const out = [];
  for (let m = start; out.length < n; m += dir) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

export default {
  title: "曲の切り替え",
  description: "通常曲 1〜4・戦闘曲 1〜4・ボス戦曲 1〜2・交響曲「黎明」・協奏曲「影」・エスニック版 4 曲・本番合奏の間を、1 小節のつなぎで途切れずに移る。「次の曲」を選ぶと、区切りで切り替わる。楽器は、それぞれの曲の画面で選んだものを使う。",
  bpm: SONGS[NAMES[0]].bpm,
  bars: 0,
  params: {
    next: { label: "次の曲（選ぶと切り替わる）", options: NAMES, labels: LABELS, value: NAMES[0] },
    timing: { label: "切り替えるタイミング", options: ["次の小節", "次の 4 小節の区切り"], value: "次の小節" },
  },

  setup(ctx) {
    // 曲ごとの ctx（自分用の params と state を持ち、ほかは親の ctx のまま）は、初めて鳴らすときに作る
    const songs = {};
    const songCtx = name => {
      if (!songs[name]) {
        const c = Object.create(ctx);
        c.params = ctx.paramsOf(name, SONGS[name]);
        c.say = () => {};
        c.state = SONGS[name].setup(c);
        songs[name] = c;
      }
      return songs[name];
    };
    const song = ctx.params.next;
    songCtx(song);
    ctx.setBpm(SONGS[song].bpm);
    return { songCtx, mix: createMix(ctx), song, s: 0, bridge: null, landed: false };
  },

  step({ t }, ctx) {
    const { params: p, state: st, say } = ctx;
    const want = p.next;

    // 小節の頭で、切り替えるかどうか決める
    if (!st.bridge && st.s % 16 === 0 && want !== st.song) {
      const bar = (st.s / 16) % SONGS[st.song].bars;
      if (p.timing === "次の小節" || bar % 4 === 0) {
        const up = INTENSITY[SONGS[want].mood] > INTENSITY[SONGS[st.song].mood];
        st.bridge = { to: want, i: 0, from: ctx.bpm, up };
        st.songCtx(want);   // 行き先の楽器を先に用意しておく
      }
    }

    if (st.bridge) {
      const { to, i, from, up } = st.bridge;
      const goal = SONGS[to].bpm;
      ctx.setBpm(bridgeBpm(from, goal, i));
      say(`${LABELS[to]}へ切り替え中… ${Math.round(ctx.bpm)} BPM`);
      bridge(t, i, {
        S: st.mix.S, tp: st.songCtx(to).params, s16: ctx.sixteenth, up,
        seconds: bridgeSeconds(from, goal), target: SONGS[to].data[0].chord,
      });
      if (++st.bridge.i === 16) Object.assign(st, { song: to, s: 0, bridge: null, landed: true });
      return;
    }

    const song = SONGS[st.song];
    const c = st.songCtx(st.song);
    const s = st.s % (song.bars * 16);
    const at = { t, step: s, bar: Math.floor(s / 16), pos: s % 16 };
    // 切り替わった 1 拍目はシンバルで着地
    if (st.landed) st.mix.S.C.kit(c.params.inst2).crash(t);
    st.landed = false;
    song.step(at, c);
    const b = song.data[at.bar];
    const waiting = want !== st.song ? `（${p.timing}で${LABELS[want]}へ）` : "";
    say(`${song.title} ・ ${b.section}${b.prog ? `（${b.prog}）` : ""} ・ ${at.bar + 1} / ${song.bars} 小節${waiting}`);
    st.s++;
  },
};
