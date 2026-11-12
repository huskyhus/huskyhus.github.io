// ハス君シリ－ズ{6}
import { D, H, holdCharge, released, giveAt, I, sign, STAGE_Y } from "../movekit.js";

export default [
  {
    id: "monju", sticker: "796167801", name: "文殊の知恵", kind: "集中砲火", ai: "far",
    desc: "知恵の玉を 3 つ、頭の上・前・後ろから出す。玉はいちばん近い相手めがけて集まってくる",
    total: 34, cd: 240,
    shots: [[0, -170, 0, -6], [60, -60, 6, 0], [-60, -60, -6, 0]].map(([x, y, vx, vy]) => ({
      f: 12, vis: "orb", x, y, vx, vy, homing: 0.12, life: 120, w: 30, h: 30, dmg: 4, base: 4, grow: 5, ang: 40,
    })),
    info: { startup: 12, dmg: 12, power: 9, text: { dmg: "4% × 3" } },
  },
  {
    id: "derukui", sticker: "796167802", name: "出る杭は打たれない", kind: "無敵対空", ai: "atk", rec: true, aiReach: 60, oncePerAir: true,
    desc: "杭のように真上へ飛び出す。出始め（1〜10F）は無敵なので、上からの攻撃を返せる。空中で使えば復帰にも。使った後は着地まで何もできない",
    total: 40, cd: 60, inv: D(1, 10),
    start(F) { F.vy = -12.5; F.grounded = false; },
    hits: [H(3, 12, [0, -70, 64, 110], 9, 7, 13, 85, { around: true })],
    tick(F, G, f) { if (f === 40) F.helpless = !F.grounded; },
  },
  {
    id: "toudai", sticker: "796167803", name: "灯台もと暗し", kind: "遠くだけ当たる光", ai: "far",
    desc: "灯台の光を前へ放つ。遠く（150〜600）まで一瞬で届くが、目の前の近い相手には当たらない",
    total: 42, cd: 200,
    hits: [H(14, 19, [375, -55, 450, 70], 9, 6, 11, 30)],
    aiOk: (F, G, T) => !!T && Math.abs(T.x - F.x) > 160,
  },
  {
    id: "buddy", sticker: "796167804", name: "バディは宝", kind: "相棒", ai: "trap",
    desc: "相棒のくまを横に呼ぶ（5 秒）。相棒はその場に立って、近づいた相手を自動でパンチする（0.6 秒に 1 回、5%）",
    total: 30, cd: 720,
    shots: [{
      f: 12, vis: "minion", x: 50, y: -45, vx: 0, life: 300, w: 46, h: 80, noReflect: true,
      aura(p, G) {
        if ((p.cd = (p.cd || 0) - 1) > 0) return;
        const O = G.fighters[p.owner];
        for (const T of G.list) {
          if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
          if (Math.abs(T.x - p.x) < 110 && Math.abs(T.y - 45 - p.y) < 80) {
            G.applyHit(O, T, { dmg: 5, base: 5, grow: 8, ang: 40 }, sign(T.x - p.x) || 1, true, p.ms);
            p.cd = 36;
            break;
          }
        }
      },
    }],
    info: { startup: 12, dmg: 5, power: 13, text: { dmg: "5%（近づいた相手に何度でも）" } },
  },
  {
    id: "datou", sticker: "796167805", name: "打倒！", kind: "打ち下ろし", ai: "ko",
    desc: "大きく振りかぶって打ち下ろす。地上の相手は高く打ち上げ、空中の相手は真下へたたき落とす。出は遅い",
    total: 54, cd: 60,
    hits: [H(19, 22, [55, -60, 80, 90], 16, 8, 19, 70, { mod: (F, T, G, h) => (T.grounded ? h : { ...h, ang: -65 }) })],
  },
  {
    id: "harapeko", sticker: "796167806", name: "腹ぺこ隊", kind: "行進", ai: "far",
    desc: "腹ぺこ隊が 3 匹、床を歩いて行進する。ゆっくりだが、台のふちまで歩いて相手を押していく",
    total: 36, cd: 300,
    shots: [12, 20, 28].map(f => ({ f, vis: "minion", x: 30, y: -20, vx: 3.2, life: 220, w: 34, h: 40, walk: true, dmg: 3, base: 6, grow: 3, ang: 35 })),
    info: { startup: 12, dmg: 9, power: 9, text: { dmg: "3% × 3" } },
  },
  {
    id: "taikan", sticker: "796167807", name: "体幹大事", kind: "アーマー", ai: "buff",
    desc: "体幹をきたえる。5 秒間「アーマー」: 12% 以下の攻撃ではひるまない（ダメージは受ける。つかみは防げない）",
    total: 24, cd: 900, tick: giveAt(10, { armor: 300 }),
    info: I(10, "10F", "なし（5 秒 アーマー）", "なし"),
  },
  {
    id: "jukkou", sticker: "796167808", name: "熟考せよ", kind: "瞑想", ai: "buff", hold: true, aiHold: 90,
    desc: "押している間、じっと考える（最大 2 秒・動けない）。考えている間、ほかの技の再使用時間が 4 倍の速さで戻る",
    total: 200, cd: 600, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      if (released(F, G, f, 120)) return false;
      G.cds(F, c => c - 3);
    },
    aiOk: F => F.cd.some(c => c > 300),
    info: I(1, "押している間", "なし（再使用 4 倍速）", "なし"),
  },
  {
    id: "urayamashii", sticker: "796167809", name: "羨ましいなぁ", kind: "強化コピー", ai: "buff",
    desc: "相手たちのよい状態（強化・バリア）を、相手から消さずに自分にもコピーする。距離は関係なし",
    total: 30, cd: 600,
    tick(F, G, f) { if (f === 12) for (const T of G.list) if (T !== F && T.alive && G.positives(T)) G.copyBuffs(F, T); },
    aiOk: (F, G) => G.list.some(T => T !== F && T.alive && G.positives(T)),
    info: I(12, "12F", "なし（相手の強化をコピー）", "なし"),
  },
  {
    id: "fuan", sticker: "796167810", name: "不安になるなよ！大丈夫", kind: "安心", ai: "buff",
    desc: "悪い状態をすべて消し、4 秒間「防御↑」",
    total: 26, cd: 720,
    tick(F, G, f) { if (f === 10) { G.cleanse(F); G.give(F, { tough: 240 }); } },
    info: I(10, "10F", "なし（悪い状態を消す・防御↑）", "なし"),
  },
  {
    id: "ryouri", sticker: "796167811", name: "料理男子！", kind: "フライパン", ai: "atk",
    desc: "熱々のフライパンでひっぱたく。当たると 2 秒「やけど」",
    total: 34, cd: 60,
    hits: [H(10, 13, [48, -55, 64, 54], 9, 6, 12, 40, { st: { burn: 120 } })],
  },
  {
    id: "geraku", sticker: "796167812", name: "下落しないと上昇しない！待て！", kind: "底からの上昇", ai: "rec",
    desc: "下から一気に上がる復帰技。台より下にいるほど高く上がり、強く当たる。台の上で使うと小さい。使った後は着地まで何もできない。空中で 1 回まで",
    total: 36, cd: 0, oncePerAir: true,
    start(F) { const d = Math.max(0, F.y - STAGE_Y); F.move.v = d; F.vy = -Math.min(22, 9 + d * 0.05); F.grounded = false; },
    hits: [H(2, 14, [0, -60, 70, 100], 6, 5, 8, 80, { around: true,
      mod: (F, T, G, h) => { const d = Math.min(300, F.move.v); return { ...h, dmg: Math.round(6 + d * 0.03), grow: 8 + d * 0.04 }; } })],
    tick(F, G, f) { if (f === 36) F.helpless = !F.grounded; },
    info: { text: { dmg: "6〜15%（低いほど強い）", power: "13〜25（低いほど強い）" } },
  },
  {
    id: "bouraku", sticker: "796167813", name: "焦ることは無い！暴落を待て！", kind: "暴落", ai: "atk", hold: true, aiReach: 160,
    desc: "押している間じっと待ち（最大 1.5 秒）、離すと相場が暴落。まわりの空中の相手を真下へたたき落とし、地上の相手は 20F 転ばせる。待つほど強い",
    total: 220, cd: 240,
    tick(F, G, f) {
      const t = holdCharge(F, G, f, 90);
      if (t < 0) return;
      const c = F.move.w;
      if (t === 3) {
        G.strike(F, { box: [0, -110, 340, 260], dmg: Math.round(7 + 7 * c), base: 6 + 4 * c, grow: 8 + 10 * c, ang: -80, around: true,
          mod: (F2, T, G2, h) => (T.grounded ? { ...h, dmg: Math.round(h.dmg / 2), stun: 20 } : h) }, "x");
        G.emit("boom", F.x, F.y - 60, F.slot, 17);
      }
      if (t >= 24) return false;
    },
    info: { startup: 4, dmg: 14, power: 28, text: { speed: "離して 3F（ためは最大 1.5 秒）", dmg: "7〜14%（地上の相手は半分）", power: "16〜28（空中の相手を下へ）" } },
  },
  {
    id: "kasege", sticker: "796167814", name: "稼げ！", kind: "稼ぎ時", ai: "buff",
    desc: "稼ぎ時！ 8 秒間、攻撃を当てるたびにほかの技の再使用時間が 1 秒縮む",
    total: 24, cd: 1200, tick: giveAt(10, { earn: 480 }),
    info: I(10, "10F", "なし（8 秒 稼ぎ）", "なし"),
  },
  {
    id: "kyasshu", sticker: "796167815", name: "暴落が来る！キャッシュを準備せよ", kind: "バリア（ため）", ai: "buff", hold: true, aiHold: 85,
    desc: "押している間、キャッシュ（バリア）をためる（最大 1.5 秒で 25%・無防備）。バリアは受けるダメージを肩代わりし、その間ふっとばない",
    total: 200, cd: 900, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      if (released(F, G, f, 90)) return false;
      if (f % 9 === 0) G.give(F, { barrier: 2.5 }, true);
    },
    aiOk: F => F.barrier <= 0,
    info: I(9, "押している間ためる", "なし（最大 25% のバリア）", "なし"),
  },
  {
    id: "moshimoshi", sticker: "796167816", name: "もしもーし！", kind: "呼び出し", ai: "far",
    desc: "いちばん近い相手を呼び出す。24F 後、相手のいた場所でベルが鳴り、当たると 5% と 2.5 秒「混乱」。鳴る前に動けばよけられる",
    total: 30, cd: 300,
    tick(F, G, f) {
      if (f === 10) G.shot(F, { at: "foe", vis: "ring", y: -50, vx: 0, life: 36, from: 24, until: 30, w: 110, h: 130,
        dmg: 5, base: 5, grow: 6, ang: 70, around: true, noReflect: true, st: { confuse: 150 } });
    },
    info: { startup: 34, dmg: 5, power: 11, text: { speed: "10F で呼び出し、24F 後に鳴る" } },
  },
  {
    id: "hana", sticker: "796167817", name: "花を贈るよ！感謝", kind: "花束", ai: "far",
    desc: "花束を投げて贈る。当たった相手はうっとりして 6 秒「攻撃↓」",
    total: 28, cd: 240,
    shots: [{ f: 10, vis: "sticker", vx: 8.5, vy: -1, g: 0.05, life: 70, w: 40, h: 40, dmg: 3, base: 3, grow: 4, ang: 30, st: { weak: 360 } }],
    info: { startup: 10, dmg: 3, power: 7 },
  },
  {
    id: "asobini2", sticker: "796167818", name: "遊びにおいで待ってるよ！", kind: "おもてなしマット", ai: "trap",
    desc: "前の床にマットを敷く（7 秒）。最初に踏んだ相手は 50F その場から動けなくなる",
    total: 30, cd: 480,
    shots: [{
      f: 12, vis: "mine", x: 100, y: -8, vx: 0, g: 1, stick: true, life: 420, w: 90, h: 16, noReflect: true,
      trig(p, T, G) { G.applyHit(G.fighters[p.owner], T, { dmg: 2, base: 0, grow: 0, ang: 0, fixed: true, stun: 50 }, 1, true, p.ms); },
    }],
    info: { startup: 12, dmg: 2, text: { power: "なし（踏んだ相手を 50F 止める）" } },
  },
  {
    id: "fruit", sticker: "796167819", name: "フルーツ食べよう！", kind: "フルーツ", ai: "heal",
    desc: "フルーツを 3 つばらまく（10 秒）。触れた人は 5% 回復。相手が拾っても回復してしまうので、まく場所に注意",
    total: 30, cd: 900,
    shots: [[-3, -9], [2, -10], [6, -8]].map(([vx, vy]) => ({
      f: 12, vis: "item", x: 0, y: -60, vx, vy, g: 0.5, stick: true, life: 600, w: 34, h: 34, item: 5, noReflect: true,
    })),
    info: I(12, "12F", "なし（拾うと 5% 回復 × 3）", "なし"),
  },
  {
    id: "chill", sticker: "796167820", name: "チルタイム！", kind: "くつろぎ", ai: "heal", hold: true, aiHold: 100,
    desc: "押している間、パフェでくつろいで回復（0.2 秒に 1%・最大 2 秒）。くつろいでいる間は受けるダメージ 1.3 倍",
    total: 200, cd: 900, noDrift: true, takeMul: 1.3,
    tick(F, G, f) {
      F.vx = 0;
      if (released(F, G, f, 120)) return false;
      if (f % 12 === 0) G.heal(F, 1, true);
    },
    info: I(12, "押している間", "なし（最大 10% 回復）", "なし"),
  },
  {
    id: "itsuwari", sticker: "796167821", name: "偽りの人生はごめんだ！", kind: "逆境強化", ai: "buff",
    desc: "悪い状態をはねのける。消した悪い状態 1 つにつき 3 秒「攻撃↑」（消すものがなくても 2 秒）",
    total: 26, cd: 600,
    tick(F, G, f) { if (f === 10) { const n = G.cleanse(F); G.give(F, { pow: 120 + n * 180 }); } },
    info: I(10, "10F", "なし（悪い状態を消して攻撃↑）", "なし"),
  },
  {
    id: "vitamin", sticker: "796167822", name: "ビタミンとれよ！乾燥注意！", kind: "戻ると回復", ai: "far",
    desc: "ビタミン剤をブーメランのように投げる。相手に当たると 4%（そこで消える）、無事に戻ってきてキャッチすると自分が 6% 回復",
    total: 28, cd: 300,
    shots: [{ f: 9, vis: "sticker", x: 40, y: -55, vx: 12, life: 140, w: 36, h: 34, boom: 0.38, retHeal: 6, dmg: 4, base: 3, grow: 5, ang: 35 }],
    info: { startup: 9, dmg: 4, power: 8, text: { dmg: "4%（戻ってくれば 6% 回復）" } },
  },
  {
    id: "yabai", sticker: "796167823", name: "ヤバい", kind: "逃げ足", ai: "move",
    desc: "ヤバい！と後ろへ跳びのき（1〜8F 無敵）、4 秒「速さ↑」",
    total: 20, cd: 360, inv: D(1, 8),
    start(F, G) { F.vx = -F.face * 9; F.vy = -6; F.grounded = false; G.give(F, { haste: 240 }); },
    info: I(1, "1F（1〜8F 無敵）", "なし", "なし"),
  },
  {
    id: "taishi", sticker: "796167824", name: "大志を抱け！", kind: "遠投", ai: "far",
    desc: "大志の星を空高く投げる。大きな山なりで、いちばん近い相手のいるあたり（150〜650）に落ち、着地点で爆発する。落ちるまで遅いので、見て動けばよけられる",
    total: 40, cd: 240,
    tick(F, G, f) {
      if (f !== 14) return;
      const T = G.nearestFoe(F, 900);
      const vx = T ? Math.max(2, Math.min(8.5, Math.abs(T.x - F.x) / 75)) : 7.5;
      if (T) F.face = sign(T.x - F.x) || F.face;
      G.shot(F, { vis: "star", x: 30, y: -100, vx, vy: -15, g: 0.42, life: 160, w: 40, h: 40, dmg: 8, base: 6, grow: 8, ang: 60,
        land: true, ex: { r: 150, dmg: 11, base: 7, grow: 14, ang: 65 } });
    },
    info: { startup: 80, dmg: 11, power: 21, text: { speed: "14F で投げ、80F くらいで落ちる", dmg: "爆発 11%（直撃 8%）" } },
  },
  {
    id: "iinaa", sticker: "796167825", name: "いいなぁ", kind: "ものほしげな目", ai: "debuff",
    desc: "ものほしげな視線を飛ばす。当たった相手は、すべての技の再使用時間が 3 秒増える（ダメージなし）",
    total: 26, cd: 420,
    shots: [{ f: 10, vis: "spark", vx: 10, life: 50, w: 40, h: 30, dmg: 0, base: 3, grow: 0, ang: 10, fixed: true,
      hit(p, T) { for (let i = 0; i < 4; i++) T.cd[i] = Math.min(1800, T.cd[i] + 180); } }],
    info: I(10, "10F", "なし（相手の再使用 +3 秒）", "なし"),
  },
  {
    id: "hiyase1", sticker: "796167826", name: "頭を冷やせ！", kind: "氷水", ai: "far", aiReach: 200,
    desc: "氷水を前にぶちまける。届くのは近めだが、当たった相手は凍って 50F 動けない",
    total: 34, cd: 420,
    shots: [{ f: 12, vis: "ice", x: 30, y: -70, vx: 6, vy: -4, g: 0.45, life: 40, w: 50, h: 44, dmg: 5, base: 0, grow: 0, ang: 0, fixed: true, stun: 50 }],
    info: { startup: 12, dmg: 5, text: { power: "なし（50F 凍らせる）" } },
  },
  {
    id: "oya", sticker: "796167827", name: "親の言うことには一理ある", kind: "小言", ai: "far", hold: true, aiHold: 60,
    desc: "押している間、小言の波を連続で飛ばす（最大 1.3 秒・動けない）。1 つ 2%、% に関係なく少し押す",
    total: 200, cd: 200, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      if (released(F, G, f, 80)) return false;
      if (f % 10 === 0) G.shot(F, { vis: "wave", vx: 9, life: 28, w: 34, h: 40, dmg: 2, base: 4, grow: 0, ang: 15, fixed: true });
    },
    info: { startup: 10, dmg: 16, power: 4, text: { dmg: "2% × 最大 8", power: "4（% に関係なく一定）" } },
  },
  {
    id: "itsumokansha", sticker: "796167828", name: "いつも感謝！", kind: "おじぎ突進", ai: "atk", aiReach: 180,
    desc: "何度もおじぎしながら前へ進む。4 回の頭突きのあと、最後に大きなおじぎで吹き飛ばす",
    total: 48, cd: 100, vel: [[4, 36, 4, null, false]],
    hits: [...[6, 14, 22, 30].map(f => H(f, f + 1, [38, -40, 46, 40], 2, 4, 0, 20, { fixed: true })), H(38, 40, [44, -45, 56, 50], 5, 6, 10, 40)],
  },
  {
    id: "stretch", sticker: "796167829", name: "ストレッチ！", kind: "のびーる", ai: "atk", aiReach: 200,
    desc: "ぐーっと体を伸ばす。いちばん長い（195）、細いリーチの攻撃",
    total: 38, cd: 40,
    hits: [H(12, 14, [110, -45, 170, 30], 9, 6, 12, 30)],
  },
  {
    id: "kikikanri", sticker: "796167830", name: "危機管理せよ！", kind: "自動迎撃", ai: "buff",
    desc: "6 秒間、警報装置を身につける。相手がすぐそばまで来ると自動ではじき返す（6%・最大 2 回、間は 0.5 秒）",
    total: 24, cd: 900,
    shots: [{
      f: 10, vis: "aura", follow: "owner", x: 0, y: -50, vx: 0, life: 360, w: 170, h: 170, noReflect: true,
      aura(p, G) {
        if ((p.cd = (p.cd || 0) - 1) > 0) return;
        const O = G.fighters[p.owner];
        for (const T of G.list) {
          if (T === O || !T.alive || T.hover > 0 || T.invuln > 0) continue;
          if (Math.abs(T.x - O.x) < 85 && Math.abs(T.y - O.y) < 90) {
            G.applyHit(O, T, { dmg: 6, base: 8, grow: 6, ang: 40 }, sign(T.x - O.x) || 1, true, p.ms);
            G.emit("boom", T.x, T.y - 50, O.slot, 5);
            p.n = (p.n || 0) + 1;
            p.cd = 30;
            if (p.n >= 2) p.dead = true;
            break;
          }
        }
      },
    }],
    info: { startup: 10, dmg: 6, power: 14, text: { dmg: "6%（近づいた相手に最大 2 回）" } },
  },
  {
    id: "original", sticker: "796167831", name: "自分のオリジナリティは何だ", kind: "毎回ちがう", ai: "atk",
    desc: "使うたびに形が変わる攻撃。前へのパンチ → 真上へのアッパー → まわりへの回転、の順にくり返す（いまどれかは自分で覚えておく）",
    total: 30, cd: 30,
    start(F) { const s = F.move.slot; F.move.v = F.cnt[s] % 3; F.cnt[s] = (F.cnt[s] + 1) % 3; },
    tick(F, G, f) {
      if (f < 8 || f > 11) return;
      const k = F.move.v;
      G.strike(F, k === 0 ? { box: [48, -50, 64, 44], dmg: 8, base: 6, grow: 11, ang: 35 }
        : k === 1 ? { box: [15, -110, 60, 90], dmg: 8, base: 6, grow: 12, ang: 85 }
        : { box: [0, -45, 130, 80], dmg: 7, base: 5, grow: 10, ang: 50, around: true }, "o");
    },
    info: { startup: 8, dmg: 8, power: 18, text: { dmg: "8%（回転は 7%）" } },
  },
  {
    id: "kanyou", sticker: "796167832", name: "寛容であれ！", kind: "受け入れる", ai: "def", hold: true, aiHold: 40,
    desc: "押している間、何でも受け入れる構え（最大 3 秒）。攻撃を受けてもふっとばず、ダメージも半分。ただし動けず、つかみには弱い",
    total: 200, cd: 150, noDrift: true, takeMul: 0.5,
    tick(F, G, f) {
      F.vx = 0;
      F.armorNow = 99;
      if (released(F, G, f, 180, 6)) return false;
    },
    info: I(1, "押している間", "なし（受けるダメージ半分・ふっとばない）", "なし"),
  },
];
