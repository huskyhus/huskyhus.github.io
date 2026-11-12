// ハス君といっしょpart.7
import { D, H, released, giveAt, I, sign, LEDGE_L, LEDGE_R } from "../movekit.js";

export default [
  {
    id: "muryoku", sticker: "847773233", name: "あまりに無力な存在", kind: "存在感ゼロ", ai: "buff",
    desc: "存在感を消す。8 秒間、追尾弾・ねらい撃ち・瞬間移動など「いちばん近い相手をねらう技」の対象にならない（ふつうの攻撃は当たる）",
    total: 24, cd: 900, tick: giveAt(10, { ghost: 480 }),
    info: I(10, "10F", "なし（8 秒 ねらわれない）", "なし"),
  },
  {
    id: "asahi", sticker: "847773234", name: "朝日が光を放つ はい！おはよう", kind: "朝日フラッシュ", ai: "atk", aiReach: 200,
    desc: "朝日のようにまぶしく光る。まわり（半径 260）でこちらを向いている相手は目がくらんで 30F 動けない。背中を向けていれば平気",
    total: 34, cd: 420,
    tick(F, G, f) {
      if (f !== 12) return;
      G.emit("boom", F.x, F.y - 60, F.slot, 26);
      for (const T of G.foes(F, 260)) if (T.invuln <= 0 && (T.face === sign(F.x - T.x) || F.x === T.x)) G.stun(T, 30);
    },
    info: I(12, "12F", "なし（向いている相手を 30F 止める）", "なし"),
  },
  {
    id: "tabidatou", sticker: "847773235", name: "さあ旅立とう！", kind: "跳び蹴り", ai: "atk", aiReach: 260,
    desc: "勢いよく前へ大きく跳び、降りながら足から突っこむ（降りている間だけ当たる）。遠くの相手に一気に届く",
    total: 50, cd: 90,
    start(F) { F.vx = F.face * 9; F.vy = -9; F.grounded = false; },
    hits: [H(16, 40, [25, -15, 50, 40], 9, 6, 12, 40, { mod: (F, T, G, h) => (F.vy > 0 ? h : null) })],
    onLand: () => false,
  },
  {
    id: "arigatou4", sticker: "847773236", name: "ありがとう！（羽）", kind: "天使の羽", ai: "buff", rec: true,
    desc: "天使の羽が生える。8 秒間「身軽」（ゆっくり落ちて高く跳べる）になり、空中ジャンプも 1 回戻る",
    total: 20, cd: 900,
    tick(F, G, f) { if (f === 8) { G.give(F, { light: 480 }); F.jumps = Math.max(F.jumps, 1); } },
    info: I(8, "8F", "なし（8 秒 身軽）", "なし"),
  },
  {
    id: "yaa", sticker: "847773237", name: "やぁ", kind: "振り向かせ", ai: "atk",
    desc: "「やぁ」と肩をたたく。当たった相手は思わずそっぽを向いて（こちらに背中を向けて）16F 固まる。背中からの技につなげる",
    total: 22, cd: 90,
    hits: [H(5, 7, [40, -60, 48, 40], 2, 0, 0, 0, { fixed: true, stun: 16, onHit(A, T) { T.face = -(sign(A.x - T.x) || -T.face); } })],
    info: { text: { power: "なし（向きを変えて 16F 止める）" } },
  },
  {
    id: "hitoridewa", sticker: "847773238", name: "一人では生きてはいけない 感謝", kind: "仲間のはさみ撃ち", ai: "atk", aiReach: 220,
    desc: "仲間を 2 匹呼ぶ。自分の前後の少し離れたところ（230）から内側へ突進してきて、両側の相手をはさみ撃ちにする",
    total: 34, cd: 240,
    tick(F, G, f) {
      if (f !== 10) return;
      for (const s of [1, -1]) G.shot(F, { vis: "minion", x: 230 * s, y: -40, vx: -9 * s, life: 26, w: 40, h: 50, dmg: 6, base: 5, grow: 9, ang: 40 });
    },
    info: { startup: 10, dmg: 6, power: 14, text: { dmg: "6%（前後から 1 匹ずつ）" } },
  },
  {
    id: "genkai", sticker: "847773239", name: "限界へ挑戦", kind: "限界突破", ai: "buff",
    desc: "自分が 80% 以上のときだけ限界を突破し、5 秒「攻撃↑」「アーマー」「速さ↑」。80% 未満では 2 秒「速さ↑」だけ",
    total: 28, cd: 900,
    tick(F, G, f) { if (f === 12) G.give(F, F.dmg >= 80 ? { pow: 300, armor: 300, haste: 300 } : { haste: 120 }); },
    aiOk: F => F.dmg >= 80,
    info: I(12, "12F", "なし（80% 以上で大強化）", "なし"),
  },
  {
    id: "seichou", sticker: "847773240", name: "成長率8%", kind: "複利", ai: "atk",
    desc: "当てるたびに威力が 8% ずつ複利で成長するキック（6% から。10 回まで。撃墜されても残る）",
    total: 30, cd: 45,
    hits: [H(8, 10, [44, -40, 56, 44], 6, 5, 9, 35, {
      mod: (F, T, G, h) => { const k = Math.pow(1.08, Math.min(10, F.cnt[F.move.slot])); return { ...h, dmg: Math.round(h.dmg * k * 10) / 10, grow: h.grow * Math.min(2, k) }; },
      onHit(A) { const s = A.move?.slot; if (s != null) A.cnt[s] = Math.min(10, A.cnt[s] + 1); },
    })],
    info: { text: { dmg: "6% → 当てるたび 1.08 倍（最大 13%）" } },
  },
  {
    id: "fukan", sticker: "847773241", name: "俯瞰せよ！", kind: "急降下強襲", ai: "atk", aiReach: 350,
    desc: "真上へ高く跳んで全体を見下ろし、26F でいちばん近い相手めがけて斜めに急降下して蹴る。降下中は相手を下へ落とす",
    total: 80, cd: 300, noDrift: true, endOnLedge: true,
    start(F) { F.vy = -17; F.vx = 0; F.grounded = false; },
    tick(F, G, f) {
      const m = F.move;
      if (f === 26) {
        const T = G.nearestFoe(F, 900);
        const dx = T ? T.x - F.x : F.face * 200, dy = T ? T.y - 40 - F.y : 300;
        const d = Math.hypot(dx, dy) || 1;
        m.v = dx / d * 16; m.w = Math.max(6, dy / d * 16);
        F.face = sign(dx) || F.face;
      }
      if (f >= 26) {
        F.vx = m.v; F.vy = m.w; F.noGravity = true;
        G.strike(F, { box: [10, -30, 60, 60], dmg: 10, base: 6, grow: 11, ang: -40 }, "d");
        if (F.grounded) return false;
      }
    },
    info: { startup: 26, dmg: 10, power: 20, text: { speed: "26F から急降下" } },
  },
  {
    id: "makasero3", sticker: "847773242", name: "まかせろ！（王冠）", kind: "アーマーパンチ", ai: "ko",
    desc: "どっしり構えて殴る。構え中（1〜14F）は 12% 以下の攻撃ではひるまない。出は遅いがつぶされにくい",
    total: 50, cd: 75, armor: [1, 14, 12],
    hits: [H(15, 18, [50, -50, 70, 56], 14, 8, 16, 38)],
  },
  {
    id: "okotoba", sticker: "847773243", name: "お言葉をきこう！", kind: "技を習う", ai: "def", noCopy: true,
    desc: "構え（4〜30F）の間に攻撃されると、受け流してその相手の技を覚え、すぐその技で返す（飛び道具なら、撃った相手の最後の技）",
    total: 44, cd: 360, counter: D(4, 30),
    ctr(T, A, h, G) {
      T.invuln = 16;
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      const d = A ? G.moveAt(A.lastMv) : null;
      if (d && !d.noCopy && !d.banned) { T.face = sign(A.x - T.x) || T.face; G.become(T, d, 480); }
      else T.move.f = Math.max(T.move.f, 34);
    },
    info: I(4, "4F〜30F の間構える", "相手の技しだい", "相手の技しだい"),
  },
  {
    id: "renkei", sticker: "847773244", name: "連携プレー", kind: "追撃コンボ", ai: "atk",
    desc: "すくい上げて浮かせ、自動で跳んで追いかけ、空中で下へたたき落とす連携。最初の一撃が外れると、跳ばずに終わる",
    total: 50, cd: 150,
    hits: [
      H(6, 8, [40, -40, 50, 50], 4, 9, 0, 80, { fixed: true, onHit(A) { if (A.move) A.move.v = 1; } }),
      H(24, 32, [30, -50, 70, 80], 8, 6, 10, -60),
    ],
    tick(F, G, f) { if (f === 14) { if (!F.move.v) return false; F.vy = -12; F.vx = F.face * 2; F.grounded = false; } },
    info: { text: { dmg: "4% + 8%", power: "16（最後は下へ）" } },
  },
  {
    id: "hotoke", sticker: "847773245", name: "地獄で仏", kind: "救いの手", ai: "rec",
    desc: "台より下（地獄）にいるときに使うと、仏の手で 16F 後に台のふちの上へ引き上げられる（その間無敵）。台の上や高いところで使うと 5% 回復するだけ",
    total: 30, cd: 900, noDrift: true,
    tick(F, G, f) {
      const m = F.move;
      if (f === 1) m.v = F.y > 640 ? 1 : 0;
      if (m.v) {
        F.vx = 0; F.vy = 0; F.noGravity = true; F.invuln = Math.max(F.invuln, 1);
        if (f === 16) G.warp(F, F.x < 800 ? LEDGE_L : LEDGE_R, 600);
      } else if (f === 12) G.heal(F, 5);
    },
    aiOk: F => F.y > 640,
    info: I(16, "16F（台より下のとき）", "なし（台の上では 5% 回復）", "なし"),
  },
  {
    id: "isshoku", sticker: "847773246", name: "一触即発！", kind: "触れたら爆発", ai: "def", hold: true, aiHold: 50,
    desc: "押している間、一触即発の構え（最大 2 秒・動けない）。その間に相手がすぐそば（75 以内）まで来ると大爆発",
    total: 200, cd: 300, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      const m = F.move;
      if (m.v) return f >= m.v + 18 ? false : undefined;
      if (released(F, G, f, 120, 6)) return false;
      F.charge = 30 + Math.round(Math.sin(f * 0.5) * 10);
      if (G.foes(F, 75).length) {
        m.v = f; F.charge = 0;
        G.strike(F, { box: [0, -50, 200, 160], dmg: 13, base: 8, grow: 17, ang: 50, around: true }, "b");
        G.emit("boom", F.x, F.y - 50, F.slot, 20);
      }
    },
    info: { startup: 1, dmg: 13, power: 30, text: { speed: "相手が触れた瞬間" } },
  },
  {
    id: "owaru", sticker: "847773247", name: "おぬしワルだな", kind: "背後の一撃", ai: "atk",
    desc: "悪だくみの一撃。相手の背中側から当てると 13%・強いふっとばし。正面からだと 6%",
    total: 30, cd: 60,
    hits: [H(8, 10, [44, -50, 54, 46], 6, 4, 6, 35, { mod: (F, T, G, h) => (T.face === F.face ? { ...h, dmg: 13, base: 7, grow: 15 } : h) })],
    info: { text: { dmg: "6%（背中からは 13%）", power: "12（背中からは 29）" } },
  },
  {
    id: "oyakoukou", sticker: "847773248", name: "出来る時に親孝行はしとけ", kind: "今のうちに", ai: "atk",
    desc: "出来るうちにやっておく一撃。相手の % が低いほど強い（0% で 13%、100% 以上で 4%）。序盤の削りに",
    total: 30, cd: 60,
    hits: [H(8, 10, [44, -50, 56, 46], 13, 5, 6, 35, { mod: (F, T, G, h) => ({ ...h, dmg: Math.round(13 - 9 * Math.min(1, T.dmg / 100)) }) })],
    info: { text: { dmg: "4〜13%（相手の % が低いほど）" } },
  },
  {
    id: "sakusen", sticker: "847773249", name: "作戦会議だ！", kind: "タイム", ai: "def",
    desc: "「タイム！」 近く（250 以内）の相手は 1 秒止まる（その間は無敵）。自分は 30F で動けるので、攻められている流れを切って立て直せる",
    total: 30, cd: 600,
    tick(F, G, f) {
      if (f !== 6) return;
      for (const T of G.foes(F, 250)) { G.stun(T, 60); T.invuln = Math.max(T.invuln, 60); }
      F.invuln = Math.max(F.invuln, 30);
      G.emit("boom", F.x, F.y - 50, F.slot, 25);
    },
    info: I(6, "6F", "なし（まわりを 1 秒止める・無敵）", "なし"),
  },
  {
    id: "seibai", sticker: "847773250", name: "成敗いたす！", kind: "大振り斬り", ai: "ko",
    desc: "刀で大きく斬りつける。前方の高い所から低い所まで広くとらえる、強い一撃",
    total: 52, cd: 75,
    hits: [H(18, 21, [70, -65, 130, 120], 16, 8, 18, 40)],
  },
  {
    id: "yorisou", sticker: "847773251", name: "寄り添う寄り添うよ！", kind: "ひっつき", ai: "atk", aiReach: 300,
    desc: "いちばん近い相手（300 以内）のそばにぴったりくっつき、2 秒間ついて回って小さくつつき続ける（0.3 秒ごとに 2%）。相手が台の外へ出たら離れる",
    total: 130, cd: 300, noDrift: true,
    start(F, G) { const T = G.nearestFoe(F, 300); F.move.v = T ? T.slot + 1 : 0; },
    tick(F, G, f) {
      const m = F.move;
      if (!m.v) return false;
      const T = G.fighters[m.v - 1];
      if (!T || !T.alive || !G.onStage(T.x) || f > 120) return false;
      const side = sign(F.x - T.x) || -T.face;
      F.x = T.x + side * 42; F.y = T.y; F.vx = 0; F.vy = 0; F.noGravity = true; F.grounded = T.grounded; F.face = -side;
      if (f % 18 === 0) G.hitDirect(F, T, { dmg: 2, base: 1, grow: 0, ang: 0, fixed: true });
    },
    info: { startup: 18, dmg: 12, power: 1, text: { dmg: "2% × 最大 6" } },
  },
  {
    id: "yume", sticker: "847773252", name: "夢で会いましょう", kind: "夢の世界", ai: "atk", aiReach: 180,
    desc: "まわり（半径 200）の相手を夢の世界へ連れていく。相手は 70F 眠り、自分も 40F 眠るが 6% 回復する",
    total: 30, cd: 720,
    tick(F, G, f) {
      if (f !== 16) return;
      for (const T of G.foes(F, 200)) if (T.invuln <= 0) G.stun(T, 70);
      G.heal(F, 6);
      G.stun(F, 40);
      return false;
    },
    info: I(16, "16F", "なし（自分は 6% 回復）", "なし（相手 70F・自分 40F 眠る）"),
  },
  {
    id: "shinkokyu", sticker: "847773253", name: "頭を冷やせ 深呼吸", kind: "深呼吸", ai: "buff",
    desc: "深呼吸して落ち着く。「混乱」「鈍足」を消し、ガードの耐久を満タンにして、3 秒「防御↑」",
    total: 30, cd: 600,
    tick(F, G, f) { if (f === 14) { G.cleanse(F, ["confuse", "slow"]); F.guardHp = 60; G.give(F, { tough: 180 }); } },
    info: I(14, "14F", "なし（混乱・鈍足を消す）", "なし"),
  },
  {
    id: "jibun", sticker: "847773254", name: "自分を守るのは、自分しかいない！", kind: "自己防衛", ai: "buff",
    desc: "身を守る心構え。6 秒以内に次に受ける攻撃を 1 回だけ、完全に防ぐ（つかみは防げない）",
    total: 24, cd: 720, tick: giveAt(10, { ward: 360 }),
    info: I(10, "10F", "なし（攻撃を 1 回防ぐ）", "なし"),
  },
  {
    id: "kyoumo", sticker: "847773255", name: "きょうも一日頑張りました", kind: "がんばったご褒美", ai: "heal",
    desc: "今のストックで相手に与えたダメージ（前に使ってから）の 1/4 だけ回復する（最大 20%）。攻めた後のご褒美",
    total: 34, cd: 900,
    tick(F, G, f) { if (f === 14) { G.heal(F, Math.min(20, Math.round(F.stockDmg / 4))); F.stockDmg = 0; } },
    aiOk: F => F.stockDmg > 40 && F.dmg > 30,
    info: I(14, "14F", "なし（与えたダメージの 1/4 回復）", "なし"),
  },
  {
    id: "kodoku", sticker: "847773256", name: "孤独だな", kind: "孤高", ai: "buff",
    desc: "近く（250 以内）に誰もいないときに使うと、孤高の力で 6 秒「攻撃↑」「防御↑」。誰かが近くにいると 2 秒「速さ↑」だけ",
    total: 26, cd: 900,
    tick(F, G, f) { if (f === 12) G.give(F, G.foes(F, 250).length ? { haste: 120 } : { pow: 360, tough: 360 }); },
    aiOk: (F, G) => !G.foes(F, 260).length,
    info: I(12, "12F", "なし（ひとりなら攻撃↑・防御↑）", "なし"),
  },
  {
    id: "bukka", sticker: "847773257", name: "物価高すぎる！", kind: "インフレ", ai: "debuff",
    desc: "物価が上がる！ すべての相手の、今たまっている再使用時間を 1.5 倍 + 1 秒にする（今すぐ使える技はそのまま）",
    total: 30, cd: 600,
    tick(F, G, f) {
      if (f !== 12) return;
      for (const T of G.list) {
        if (T === F || !T.alive) continue;
        for (let i = 0; i < 4; i++) if (T.cd[i] > 0) T.cd[i] = Math.min(1800, Math.round(T.cd[i] * 1.5 + 60));
        G.emit("debuff", T.x, T.y - 100, T.slot, -1);
      }
    },
    info: I(12, "12F（全員）", "なし（相手の再使用を延ばす）", "なし"),
  },
  {
    id: "toufu", sticker: "847773258", name: "豆腐メンタル", kind: "豆腐の壁", ai: "trap",
    desc: "目の前に豆腐の壁を立てる（4 秒）。相手の飛び道具と体を止めるが、もろいので攻撃を受けるとすぐ崩れる",
    total: 28, cd: 360,
    shots: [{ f: 10, vis: "wall", x: 70, y: -55, vx: 0, life: 240, w: 40, h: 110, wall: true, hp: 15, noReflect: true }],
    info: I(10, "10F", "なし（壁を立てる）", "なし"),
  },
  {
    id: "kusaruna", sticker: "847773259", name: "くさるな", kind: "発酵", ai: "atk",
    desc: "軽くつついて、長く効く「やけど」をうつす（7 秒・合計 14%）。当てたら距離をとってじわじわ削る",
    total: 24, cd: 300,
    hits: [H(6, 8, [40, -50, 48, 40], 2, 3, 2, 30, { st: { burn: 420 } })],
    info: { text: { dmg: "2% + やけど 14%" } },
  },
  {
    id: "zawawa", sticker: "847773260", name: "ざわわ、ざわわ", kind: "ざわめき", ai: "debuff",
    desc: "サトウキビ畑がざわめく。まわり（半径 400）の相手を 2 秒「混乱」させ、自分は 3 秒「存在感ゼロ」",
    total: 34, cd: 600,
    tick(F, G, f) { if (f === 14) { for (const T of G.foes(F, 400)) G.give(T, { confuse: 120 }); G.give(F, { ghost: 180 }); } },
    info: I(14, "14F", "なし（まわりを混乱）", "なし"),
  },
  {
    id: "nageruna", sticker: "847773261", name: "投げるな！感情はすてろ！", kind: "投げ無効", ai: "buff",
    desc: "感情をすてて踏ん張る。8 秒間つかまれない（つかみ技がすり抜ける）",
    total: 22, cd: 900, tick: giveAt(10, { nograb: 480 }),
    info: I(10, "10F", "なし（8 秒 つかみ無効）", "なし"),
  },
  {
    id: "nakushimono", sticker: "847773262", name: "なくしものはないですか？", kind: "落とし物", ai: "atk",
    desc: "相手のポケットをたたく。当たると相手は回復アイテム（6%）を落とす。先に拾えば自分が回復、相手に拾われることも",
    total: 30, cd: 300,
    hits: [H(8, 10, [42, -50, 52, 46], 5, 5, 6, 40, {
      onHit(A, T, G) { G.spawn(A, "item", { x: T.x, y: T.y - 60, vx: sign(A.x - T.x) * 2, vy: -6, g: 0.5, stick: true, life: 480, w: 34, h: 34, item: 6, noReflect: true }); },
    })],
  },
  {
    id: "hodoku", sticker: "847773263", name: "きょうは、心をほどく日", kind: "ほどく", ai: "special",
    desc: "まわり（半径 300）のみんなの状態（よいものも悪いものも、自分のも）を全部ほどいて消し、自分は 4% 回復",
    total: 30, cd: 600,
    tick(F, G, f) {
      if (f !== 12) return;
      for (const T of [F, ...G.foes(F, 300)]) { G.dispel(T); G.cleanse(T); }
      G.heal(F, 4);
      G.emit("boom", F.x, F.y - 50, F.slot, 30);
    },
    info: I(12, "12F", "なし（状態を全部消す・4% 回復）", "なし"),
  },
  {
    id: "checkmate", sticker: "847773264", name: "Checkmate!", kind: "詰み", ai: "ko",
    desc: "とどめの一手。目を回している・眠っている・ふっとび中の相手に当てると 16% で大きく吹き飛ばす。ふつうの相手には 5%",
    total: 34, cd: 90,
    hits: [H(9, 11, [46, -50, 60, 60], 5, 4, 6, 35, {
      mod: (F, T, G, h) => (T.state === "dizzy" || T.state === "hitstun" || T.sleeping ? { ...h, dmg: 16, base: 9, grow: 22, ang: 40 } : h),
    })],
    info: { text: { dmg: "5%（動けない相手には 16%）", power: "12（動けない相手には 38）" } },
  },
];
