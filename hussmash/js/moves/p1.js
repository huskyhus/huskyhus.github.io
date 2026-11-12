// ハス君シリーズ part1・ハス君シリーズ②
import { D, H, holdCharge, giveAt, I, sign, onlyGround } from "../movekit.js";

export default [
  // ===== ハス君シリーズ part1 =====
  {
    id: "ryokai", sticker: "507134614", name: "了解！", kind: "受け流し", ai: "def",
    desc: "出してすぐの一瞬（2〜6F）だけ構える。そこで攻撃を受けると受け流し、殴ってきた相手は 45F 目を回す。飛び道具は消える。タイミングが命",
    total: 28, cd: 50, counter: D(2, 6),
    ctr(T, A, h, G, isProj) {
      T.invuln = 14;
      T.move.f = Math.max(T.move.f, 20);
      G.emit("parry", T.x, T.y - 50, T.slot, 0);
      if (A && !isProj && A.alive) G.stun(A, 45);
    },
    info: I(2, "2F〜6F だけ構える（いちばん速い守り）", "なし（受け流す）", "なし（相手が 45F 目を回す）"),
  },
  {
    id: "kanshateru", sticker: "507134615", name: "感謝してるよ", kind: "合掌", ai: "atk",
    desc: "両手でぱちんとはさむ。ダメージは小さいが、当たった相手は 32F 目を回すので、次の技につなげられる",
    total: 34, cd: 90,
    hits: [H(8, 10, [40, -55, 50, 50], 4, 2, 0, 0, { fixed: true, stun: 32 })],
    info: { text: { power: "なし（32F 目を回す）" } },
  },
  {
    id: "xiexie", sticker: "507134616", name: "ありがとう（謝謝）", kind: "お辞儀", ai: "atk",
    desc: "深くお辞儀してから頭突き。お辞儀している間（3〜18F）は体が低く、飛び道具にも当たらない",
    total: 36, cd: 40, pinv: D(3, 18), low: D(3, 18),
    hits: [H(15, 18, [42, -35, 50, 40], 9, 6, 12, 30)],
  },
  {
    id: "genkiHi", sticker: "507134617", name: "元気？ Hi", kind: "ハイタッチ", ai: "atk",
    desc: "軽く手を出す。当たると自分が元気になって、4 秒「速さ↑」",
    total: 20, cd: 45,
    hits: [H(5, 7, [40, -60, 46, 40], 5, 4, 6, 40, { self: { haste: 240 } })],
  },
  {
    id: "konnichiwa", sticker: "507134618", name: "こんにちは", kind: "押す吹き出し", ai: "far",
    desc: "大きな「こんにちは」の吹き出しをゆっくり飛ばす。ダメージは小さいが、% に関係なく押し続けて相手の道をふさぐ",
    total: 30, cd: 150,
    shots: [{ f: 12, vis: "bubble", x: 50, y: -55, vx: 3.5, life: 150, w: 90, h: 90, dmg: 1, base: 7, grow: 0, ang: 12, fixed: true, pierce: true, every: 20 }],
    info: { startup: 12, dmg: 1, power: 7, text: { dmg: "1% × 何回も（押し続ける）", power: "7（% に関係なく一定）" } },
  },
  {
    id: "harasuita1", sticker: "507134619", name: "お腹すいたよ", kind: "吸い込み", ai: "atk", aiReach: 200,
    desc: "大きく息を吸って、前にいる相手を引き寄せる（6〜30F）。最後にかぶりついて、与えたダメージぶん回復する",
    total: 46, cd: 150,
    tick(F, G, f) {
      if (f < 6 || f > 30) return;
      for (const T of G.foes(F, 230)) {
        const dx = T.x - F.x;
        if (sign(dx) !== F.face || Math.abs(dx) < 45 || Math.abs(T.y - F.y) > 120 || T.invuln > 0) continue;
        T.x -= F.face * 4.5;
      }
    },
    hits: [H(31, 34, [40, -50, 60, 60], 8, 5, 8, 40, { drain: 1 })],
    info: { text: { speed: "6F から吸い込み、31F でかぶりつく", dmg: "8%（同じだけ回復）" } },
  },
  {
    id: "tsukareta", sticker: "507134620", name: "疲れたよぉ", kind: "ばたんきゅー", ai: "atk", aiReach: 140,
    desc: "前にばたんと倒れこむ。床すれすれの長い攻撃で、地上の相手だけに当たり、疲れがうつって 3 秒「鈍足」。起き上がるのが遅い",
    total: 52, cd: 45, low: D(10, 44),
    hits: [H(12, 16, [75, -12, 130, 26], 7, 5, 9, 25, { st: { slow: 200 }, mod: onlyGround })],
  },
  {
    id: "sabishii", sticker: "507134621", name: "さびしいなぁ", kind: "引き寄せ", ai: "far",
    desc: "「かまって」の投げ縄を飛ばす（届くのは 380 くらい）。当たった相手を目の前まで引き寄せて、22F 動けなくする",
    total: 36, cd: 180,
    shots: [{
      f: 10, vis: "ring", vx: 16, life: 24, w: 40, h: 40, dmg: 3, base: 0, grow: 0, ang: 0, fixed: true, stun: 22,
      hit(p, T, G) {
        const O = G.fighters[p.owner];
        if (!O || !O.alive || !T.alive) return;
        T.x = O.x + O.face * 55; T.y = O.y; T.vx = 0; T.vy = 0; T.grounded = O.grounded;
      },
    }],
    info: { startup: 10, dmg: 3, text: { power: "なし（目の前へ引き寄せて 22F 止める）" } },
  },
  {
    id: "kaettekite", sticker: "507134622", name: "帰って来てね", kind: "帰巣本能", ai: "rec",
    desc: "台のまん中へ向かって、少し上がりながら引き戻される復帰技（40F）。横には強いが高さはあまり稼げない。空中で 1 回まで",
    total: 40, cd: 0, oncePerAir: true, noDrift: true,
    tick(F) { F.vx = sign(800 - F.x) * 9; F.vy = -3; F.noGravity = true; },
    onLand: () => false,
    info: I(1, "すぐ（40F 引き戻される）", "なし", "なし（横に 360・上に 120 くらい）"),
  },
  {
    id: "machikirenai", sticker: "507134623", name: "待ち切れないよ", kind: "速攻突進", ai: "atk", aiReach: 140,
    desc: "待ちきれずに飛び出す、出の速い突進（3F）。ダメージもふっとびも小さい",
    total: 24, cd: 30, vel: [[2, 11, 11, null, false]],
    hits: [H(3, 11, [30, -45, 50, 60], 4, 4, 5, 25)],
  },
  {
    id: "asobouyo1", sticker: "507134624", name: "待ってるよ 遊ぼうよ", kind: "ボール", ai: "far",
    desc: "ボールを投げる。床ではずみながら転がっていく",
    total: 28, cd: 100,
    shots: [{ f: 10, vis: "ball", x: 40, y: -60, vx: 7, vy: -5, g: 0.5, bounce: 0.75, life: 160, w: 36, h: 36, dmg: 6, base: 5, grow: 7, ang: 55 }],
    info: { startup: 10, dmg: 6, power: 12 },
  },
  {
    id: "ochikomu", sticker: "507134625", name: "落ち込むよぉ", kind: "落ち込みオーラ", ai: "debuff", aiReach: 160,
    desc: "ずーんと落ち込んで、まわりに暗い気分を広げる。近くの相手は 2% と 5 秒「攻撃↓」（与えるダメージ 0.7 倍）",
    total: 36, cd: 300,
    hits: [H(14, 16, [0, -50, 330, 160], 2, 3, 0, 60, { fixed: true, around: true, st: { weak: 300 } })],
  },
  {
    id: "fumbari", sticker: "507134626", name: "もうひと踏ん張り", kind: "追加ジャンプ", ai: "rec",
    desc: "空中でもう一度、力いっぱい跳ぶ。足もとの相手は下へ踏みつける。空中で 1 回まで",
    total: 18, cd: 0, oncePerAir: true,
    start(F) { F.vy = -15.5; F.grounded = false; },
    hits: [H(1, 8, [0, 10, 70, 40], 4, 5, 4, -70)],
    info: { text: { speed: "1F（すぐ跳ぶ）" } },
  },
  {
    id: "genkideteru", sticker: "507134627", name: "元気にしてるよ！", kind: "元気アピール", ai: "heal",
    desc: "元気をアピールして、悪い状態（攻撃↓・鈍足・やけど・混乱など）を全部消し、2.5 秒かけて 10% 回復",
    total: 36, cd: 900,
    tick(F, G, f) { if (f === 16) { G.cleanse(F); G.give(F, { regen: 150 }); } },
    info: I(16, "16F", "なし（悪い状態を消す）", "なし（10% 回復）"),
  },
  {
    id: "ohayo1", sticker: "507134628", name: "おはよー", kind: "目覚まし", ai: "def",
    desc: "大声のおはよう。広い範囲（半径 260）の相手の技を止めて、14F ひるませる（ダメージなし）。ためや必殺技の阻止に",
    total: 30, cd: 360,
    tick(F, G, f) {
      if (f !== 8) return;
      for (const T of G.foes(F, 260)) if (T.invuln <= 0) G.stun(T, 14);
      G.emit("boom", F.x, F.y - 50, F.slot, 26);
    },
    info: I(8, "8F", "なし（まわりの技を止める）", "なし（14F ひるむ）"),
  },
  {
    id: "oyasumi1", sticker: "507134629", name: "おやすみなさい", kind: "子守唄", ai: "far",
    desc: "子守唄の音符をふわふわ飛ばす。当たった相手は 65F 眠って動けない。遅いので見てよけられる",
    total: 34, cd: 420,
    shots: [{ f: 12, vis: "note", vx: 4.5, sine: 2.2, sf: 0.12, life: 120, w: 40, h: 40, dmg: 1, base: 0, grow: 0, ang: 0, fixed: true, stun: 65 }],
    info: { startup: 12, dmg: 1, text: { power: "なし（65F 眠らせる）" } },
  },

  // ===== ハス君シリーズ② =====
  {
    id: "ryokai2", sticker: "650352750", name: "了解（グッド）", kind: "攻撃アップ", ai: "buff",
    desc: "親指を立てて気合いを入れる。8 秒間「攻撃↑」（与えるダメージ 1.25 倍・ふっとばし 1.1 倍）",
    total: 30, cd: 1200, tick: giveAt(14, { pow: 480 }), aiOk: F => !F.has("pow"),
    info: I(14, "14F", "なし（8 秒 攻撃↑）", "なし"),
  },
  {
    id: "hello", sticker: "650352751", name: "Hello!", kind: "スライディング", ai: "atk", aiReach: 160,
    desc: "低い姿勢ですべりこみ、相手の足をすくって上へ浮かせる。すべっている間は体が低く、高い攻撃をくぐれる",
    total: 36, cd: 40, low: D(5, 24), vel: [[6, 20, 10, null, false]],
    hits: [H(6, 20, [30, -18, 56, 36], 7, 7, 8, 80)],
  },
  {
    id: "genkiHello", sticker: "650352752", name: "元気？ Hello!", kind: "往復ビンタ", ai: "atk",
    desc: "前、後ろと手を振る 2 回攻撃。後ろの相手にも当たる",
    total: 26, cd: 25,
    hits: [H(5, 6, [40, -55, 50, 40], 4, 3, 4, 30), H(11, 13, [-40, -55, 54, 40], 5, 5, 9, 40, { dirBack: true })],
  },
  {
    id: "arigatou2", sticker: "650352753", name: "ありがとう（ハグ）", kind: "ハグ", ai: "grab",
    desc: "ぎゅっと抱きしめるつかみ。ガード・カウンターを貫く。相手に 6%、自分は 8% 回復",
    total: 38, cd: 300,
    hits: [H(5, 8, [34, -45, 40, 50], 6, 5, 4, 45, { grab: true, heal: 8 })],
    info: { text: { dmg: "6%（自分は 8% 回復）" } },
  },
  {
    id: "wasurenaide", sticker: "650352754", name: "忘れないで よろしく", kind: "時限爆弾", ai: "trap",
    desc: "足もとに置き土産を置く。1.5 秒後に大爆発。置いて逃げるか、相手を押しこむか",
    total: 24, cd: 360,
    shots: [{ f: 8, vis: "mine", x: 10, y: -14, vx: 0, life: 90, w: 30, h: 28, from: 999, noReflect: true,
      ex: { r: 170, dmg: 14, base: 8, grow: 15, ang: 60 } }],
    info: { startup: 98, dmg: 14, power: 23, text: { speed: "置いてから 90F で爆発" } },
  },
  {
    id: "wakuwaku", sticker: "650352755", name: "まっているよ わくわく", kind: "ため跳びかかり", ai: "atk", aiReach: 220, hold: true,
    desc: "押している間わくわくをため、離すと前へ跳びかかる。ためるほど遠く・強く（最大 1 秒）",
    total: 220, cd: 60,
    tick(F, G, f) {
      const t = holdCharge(F, G, f, 60);
      if (t < 0) return;
      const c = F.move.w;
      if (t === 1) { F.vx = F.face * (6 + 7 * c); F.vy = -8 - 2 * c; F.grounded = false; }
      if (t >= 1 && t <= 22) G.strike(F, { box: [30, -45, 60, 60], dmg: Math.round(6 + 8 * c), base: 5 + 3 * c, grow: 8 + 10 * c, ang: 40 }, "p");
      if ((t > 8 && F.grounded) || t >= 40) return false;
    },
    info: { startup: 2, dmg: 14, power: 31, text: { speed: "離して 1F（ためは最大 1 秒）", dmg: "6〜14%（ためるほど強い）", power: "13〜31（ためるほど強い）" } },
  },
  {
    id: "oyasumi2", sticker: "650352756", name: "おやすみなさい（Zzz）", kind: "寝返り", ai: "atk", aiReach: 200,
    desc: "寝ぼけてごろごろ前へ転がる。転がる間に何度も当たり、最後に少しふっとばす。体が低い",
    total: 52, cd: 100, low: D(4, 44), vel: [[6, 40, 6, null, false]],
    tick(F) { F.sleeping = true; },
    hits: [
      ...[8, 16, 24, 32].map(f => H(f, f + 1, [20, -20, 60, 40], 2, 3, 0, 30, { fixed: true })),
      H(40, 42, [20, -25, 64, 46], 4, 6, 9, 45),
    ],
  },
  {
    id: "otsukare", sticker: "650352757", name: "お疲れさまです", kind: "肩たたき", ai: "atk",
    desc: "トントンと 5 回たたき、最後にぽんと押す。最後が当たると疲れがうつって 4 秒「鈍足」",
    total: 42, cd: 90,
    hits: [
      ...[6, 10, 14, 18, 22].map(f => H(f, f, [38, -60, 44, 40], 1, 2, 0, 10, { fixed: true })),
      H(28, 30, [42, -55, 54, 50], 3, 5, 7, 35, { st: { slow: 240 } }),
    ],
  },
  {
    id: "harasuita2", sticker: "650352758", name: "お腹すいたよー", kind: "スープ", ai: "heal",
    desc: "スープを一気に飲んで、すぐに 7% 回復。飲んでいる 20F は無防備",
    total: 36, cd: 720,
    tick(F, G, f) { if (f === 20) G.heal(F, 7); },
    info: I(20, "20F", "なし（7% 回復）", "なし"),
  },
  {
    id: "kutakuta", sticker: "650352759", name: "くたくたです", kind: "脱力", ai: "buff",
    desc: "力を抜いてぐにゃっとなる。6 秒間「防御↑」（受けるダメージ 0.75 倍・ふっとび 0.85 倍）だが「鈍足」",
    total: 24, cd: 900, tick: giveAt(10, { tough: 360, slow: 360 }),
    info: I(10, "10F", "なし（6 秒 防御↑・鈍足）", "なし"),
  },
  {
    id: "itsumoarigato", sticker: "650352760", name: "いつもありがとうございます", kind: "追尾弾", ai: "far",
    desc: "感謝の手紙を飛ばす。ゆっくりだが、いちばん近い相手を追いかける",
    total: 30, cd: 180,
    shots: [{ f: 12, vis: "letter", vx: 5.5, vy: -1, homing: 0.06, life: 160, w: 36, h: 30, dmg: 6, base: 4, grow: 8, ang: 40 }],
    info: { startup: 12, dmg: 6, power: 12 },
  },
  {
    id: "birthday", sticker: "650352761", name: "Happy Birthday", kind: "ケーキ爆弾", ai: "far",
    desc: "ケーキを山なりに投げる。着地か当たったところでろうそくの火がはじけ、4 秒「やけど」（少しずつダメージ）",
    total: 34, cd: 240,
    shots: [{ f: 14, vis: "sticker", x: 30, y: -80, vx: 7, vy: -9, g: 0.45, life: 120, w: 44, h: 40, dmg: 4, base: 3, grow: 4, ang: 50,
      land: true, ex: { r: 120, dmg: 6, base: 4, grow: 8, ang: 70, st: { burn: 240 } } }],
    info: { startup: 14, dmg: 18, power: 12, text: { dmg: "4% + 爆発 6% + やけど 8%" } },
  },
  {
    id: "yutori", sticker: "650352762", name: "心にゆとりを", kind: "ゆとりの場", ai: "trap",
    desc: "その場に 4 秒間のゆとりの場を作る。中にいる相手は「鈍足」になる（出てもしばらく続く）",
    total: 30, cd: 600,
    shots: [{
      f: 12, vis: "aura", x: 0, y: -50, vx: 0, life: 240, w: 400, h: 220, noReflect: true,
      aura(p, G) {
        for (const T of G.list) {
          if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
          if (Math.abs(T.x - p.x) < p.w / 2 && Math.abs(T.y - 45 - p.y) < p.h / 2) G.give(T, { slow: 45 }, true);
        }
      },
    }],
    info: I(12, "12F", "なし（中の相手が鈍足）", "なし"),
  },
  {
    id: "aitai1", sticker: "650352763", name: "会いたいなぁ", kind: "追いかけハグ", ai: "grab", aiReach: 300,
    desc: "いちばん近い相手めがけて走り、つかまえる。相手が動いても向きを変えて追いかける。ガード・カウンターを貫く",
    total: 48, cd: 240, noDrift: true,
    tick(F, G, f) {
      if (f >= 8 && f <= 34) {
        const T = G.nearestFoe(F, 500);
        if (T) F.face = sign(T.x - F.x) || F.face;
        F.vx = F.face * 10;
        if (F.grounded && !G.onStage(F.x + F.vx * 3)) F.vx = 0;
        if (!F.grounded) F.vy = Math.min(F.vy, 2);
      } else F.vx *= 0.7;
    },
    hits: [H(8, 34, [30, -45, 46, 60], 8, 7, 10, 40, { grab: true })],
  },
  {
    id: "aseruna", sticker: "650352764", name: "あせるな！立ち止まれ！", kind: "動きを止める", ai: "def", aiReach: 180,
    desc: "「止まれ！」と一喝。前にいる相手のうち、動いている（走る・跳ぶ・技を出している）相手だけを 45F 止める。じっとしている相手には効かない",
    total: 36, cd: 240,
    hits: [H(10, 12, [90, -50, 180, 110], 3, 0, 0, 0, { fixed: true, stun: 45,
      mod: (F, T, G, h) => (Math.abs(T.vx) > 2 || T.state === "move" || !T.grounded ? h : null) })],
    info: { text: { power: "なし（動いている相手を 45F 止める）" } },
  },
  {
    id: "ganbarunba", sticker: "650352765", name: "がんばるんば", kind: "ボクシング連打", ai: "atk", hold: true, aiHold: 40,
    desc: "押している間、グローブで連打（最大 1 秒）。離すと最後にストレート",
    total: 200, cd: 70,
    tick(F, G, f) {
      const m = F.move;
      if (m.fire == null) {
        if (f >= 4 && f % 5 === 0) G.strike(F, { box: [44, -55, 54, 44], dmg: 1.5, base: 2, grow: 0, ang: 15, fixed: true }, "r" + f);
        if ((!G.held(F, m.slot) && f > 6) || f >= 60) m.fire = f;
        return;
      }
      const t = f - m.fire;
      if (t === 5) G.strike(F, { box: [50, -55, 64, 46], dmg: 5, base: 5, grow: 11, ang: 35 }, "fin");
      if (t >= 22) return false;
    },
    info: { startup: 5, dmg: 23, power: 16, text: { dmg: "1.5% × 最大 12 回 + 5%", power: "16（最後のストレート）" } },
  },
];
