// いつもいっしょ！パート(1) 後半・ハス君シリーズ⑤
import { D, H, giveAt, I, sign } from "../movekit.js";

export default [
  // ===== いつもいっしょ！パート(1) 後半 =====
  {
    id: "kanarazu", sticker: "772622449", name: "必ず回復する！", kind: "回復の誓い", ai: "heal",
    desc: "回復を誓う。5 秒かけて少しずつ、合計 20% 回復する",
    total: 30, cd: 1200, tick: giveAt(12, { regen: 300 }),
    info: I(12, "12F", "なし（5 秒で 20% 回復）", "なし"),
  },
  {
    id: "daijoubu1", sticker: "772622450", name: "大丈夫だよ（ボール）", kind: "バリア", ai: "buff",
    desc: "体のまわりにバリアを張る。次に受けるダメージを合計 15% まで肩代わりし、その間はふっとばない",
    total: 24, cd: 900, tick: giveAt(10, { barrier: 15 }), aiOk: F => F.barrier <= 0,
    info: I(10, "10F", "なし（15% ぶんのバリア）", "なし"),
  },
  {
    id: "nemui", sticker: "772622451", name: "ねむいよ", kind: "あくび雲", ai: "trap",
    desc: "前にあくびの雲を置く（4 秒）。中にいる相手は「鈍足」になり、合計 1 秒いると眠ってしまう（70F）",
    total: 34, cd: 420,
    shots: [{
      f: 14, vis: "cloud", x: 110, y: -45, vx: 0, life: 240, w: 140, h: 110, noReflect: true,
      aura(p, G) {
        p.c ??= {};
        for (const T of G.list) {
          if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
          if (Math.abs(T.x - p.x) > p.w / 2 || Math.abs(T.y - 45 - p.y) > p.h / 2) continue;
          G.give(T, { slow: 30 }, true);
          p.c[T.slot] = (p.c[T.slot] || 0) + 1;
          if (p.c[T.slot] >= 60 && T.state !== "dizzy" && T.invuln <= 0) { G.stun(T, 70); p.c[T.slot] = -60; }
        }
      },
    }],
    info: I(14, "14F で雲が出る", "なし（鈍足・眠らせる）", "なし"),
  },
  {
    id: "ohayou2", sticker: "772622452", name: "おはよう（日の出）", kind: "上昇弾", ai: "atk", aiReach: 110,
    desc: "目の前から太陽がのぼる。真上へ上がっていく弾で、跳んでいる相手や上から来る相手を落とす",
    total: 30, cd: 90,
    shots: [{ f: 9, vis: "sun", x: 70, y: -20, vx: 0, vy: -6.5, life: 70, w: 70, h: 70, dmg: 9, base: 6, grow: 14, ang: 85, around: true }],
    info: { startup: 9, dmg: 9, power: 20 },
  },
  {
    id: "makasero2", sticker: "772622453", name: "まかせろ！（虹）", kind: "受けて立つ", ai: "def",
    desc: "長く構える（5〜50F）。攻撃されたら受け止めて押し返す（受けた攻撃の 0.7 倍・ふっとびは % に関係なく一定で、撃墜はしにくい）",
    total: 62, cd: 240, counter: D(5, 50),
    ctr(T, A, h, G, isProj) {
      T.invuln = 20;
      T.move.f = Math.max(T.move.f, 54);
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      if (A && !isProj && A.alive) {
        G.applyHit(T, A, { dmg: Math.max(5, Math.round(h.dmg * 0.7)), base: 12, grow: 0, ang: 30, fixed: true }, sign(A.x - T.x) || T.face, false, T.move.slot);
      }
    },
    info: I(5, "5F〜50F の間構える", "受けた技の 0.7 倍（最低 5%）", "12（% に関係なく一定）"),
  },
  {
    id: "daijoubu2", sticker: "772622454", name: "大丈夫だよ（くま）", kind: "強化消し", ai: "debuff",
    desc: "「大丈夫、落ち着いて」。まわり（半径 300）の相手のよい状態とバリアをすべて消す",
    total: 30, cd: 480,
    tick(F, G, f) { if (f === 12) { for (const T of G.foes(F, 300)) G.dispel(T); G.emit("boom", F.x, F.y - 50, F.slot, 30); } },
    aiOk: (F, G) => G.list.some(T => T !== F && T.alive && G.positives(T)),
    info: I(12, "12F", "なし（相手の強化を消す）", "なし"),
  },
  {
    id: "career", sticker: "772622455", name: "キャリアをつめスキルを磨け", kind: "使うほど速い", ai: "atk",
    desc: "ストレートパンチ。使うたびにスキルが磨かれ、出が速く・再使用が短くなる（4 回まで。撃墜されても残る）。最初は 14F、5 回目から 6F",
    total: 36, cd: 90,
    start(F) { const s = F.move.slot; F.move.v = Math.min(4, F.cnt[s]); F.cnt[s] = Math.min(4, F.cnt[s] + 1); },
    tick(F, G, f) {
      const s = 14 - F.move.v * 2;
      if (f >= s && f <= s + 2) G.strike(F, { box: [46, -50, 60, 44], dmg: 9, base: 6, grow: 11, ang: 35 }, "c");
      if (f >= s + 16) return false;
    },
    cdOf: (F, m) => 90 - m.v * 12,
    info: { startup: 14, dmg: 9, power: 19, text: { speed: "14F → 使うたびに 2F 速くなる（最速 6F）" } },
  },
  {
    id: "kisokutadashii", sticker: "772622456", name: "規則正しい生活", kind: "再使用アップ", ai: "buff",
    desc: "生活リズムを整える。8 秒間、ほかの技の再使用時間が 2 倍の速さで戻る",
    total: 30, cd: 1200, tick: giveAt(12, { quick: 480 }),
    info: I(12, "12F", "なし（8 秒 再使用↑）", "なし"),
  },
  {
    id: "sabishiiaitai", sticker: "772622457", name: "寂しいな 会いたいな", kind: "なみだの雨", ai: "far",
    desc: "前の空から、なみだの雨を 5 粒降らせる。1 粒 2% と 2 秒「鈍足」。広い範囲をおさえる",
    total: 32, cd: 240,
    shots: [70, 130, 190, 250, 310].map((x, i) => ({
      f: 10 + i * 3, vis: "orb", x, y: -260, vx: 0, vy: 5, g: 0.25, life: 60, w: 24, h: 30, dmg: 2, base: 3, grow: 2, ang: 70, st: { slow: 120 },
    })),
    info: { startup: 30, dmg: 10, power: 5, text: { dmg: "2% × 最大 5" } },
  },
  {
    id: "asobini1", sticker: "772622458", name: "遊びにおいでよ（気球）", kind: "気球", ai: "rec", hold: true, aiHold: 110,
    desc: "押している間、気球でゆっくり上がる（最大 2 秒）。左右にも動ける。高く戻れるが遅いので、ねらわれやすい。空中で 1 回まで",
    total: 200, cd: 0, oncePerAir: true, noDrift: true,
    tick(F, G, f) {
      if (f > 120 || (f > 6 && !G.held(F, F.move.slot))) return false;
      F.noGravity = true;
      F.vy = Math.max(F.vy - 0.4, -3.4);
      F.vx = G.stickX(F) * 4.2;
    },
    info: I(1, "すぐ（最大 2 秒上がる）", "なし", "なし（400 くらい上がる）"),
  },
  {
    id: "ukenee", sticker: "772622459", name: "それ、受けねぇ", kind: "弾無効", ai: "buff",
    desc: "スベった空気をまとう。5 秒間、飛んでくる飛び道具・爆発が当たっても消える（ダメージなし）",
    total: 24, cd: 900, tick: giveAt(10, { nullp: 300 }),
    aiOk: (F, G) => G.projs.some(p => p.owner !== F.slot),
    info: I(10, "10F", "なし（5 秒 飛び道具無効）", "なし"),
  },
  {
    id: "gogaku", sticker: "772622460", name: "語学は大事だ", kind: "3 方向弾", ai: "far",
    desc: "A・B・C の文字を、斜め上・まっすぐ・斜め下の 3 方向に飛ばす",
    total: 30, cd: 100,
    shots: [-0.25, 0, 0.25].map(a => ({ f: 10, vis: "orb", vx: 10 * Math.cos(a), vy: 10 * Math.sin(a), life: 50, w: 30, h: 30, dmg: 4, base: 4, grow: 5, ang: 30 })),
    info: { startup: 10, dmg: 4, power: 9, text: { dmg: "4%（3 方向）" } },
  },
  {
    id: "yubihaato", sticker: "772622461", name: "いつもありがとうございます（指ハート）", kind: "吸収弾", ai: "far",
    desc: "指ハートを飛ばす。当たると相手に 4%、自分は 6% 回復",
    total: 28, cd: 240,
    shots: [{ f: 10, vis: "heart", vx: 8, life: 60, w: 36, h: 32, dmg: 4, base: 3, grow: 5, ang: 35, heal: 6 }],
    info: { startup: 10, dmg: 4, power: 8, text: { dmg: "4%（自分は 6% 回復）" } },
  },
  {
    id: "ryokai3", sticker: "772622462", name: "了解（即答）", kind: "最速", ai: "atk",
    desc: "即答の小突き。いちばん速い 2F で出て、すきもほとんどない。ダメージは 2%",
    total: 10, cd: 0,
    hits: [H(2, 3, [38, -50, 46, 34], 2, 2, 2, 25)],
  },
  {
    id: "hanashi", sticker: "772622463", name: "話し聞くよ！", kind: "傾聴", ai: "def",
    desc: "相手の話（攻撃）を受け止める構え（4〜28F）。受け止めると、その攻撃のダメージぶん自分が回復する（飛び道具も）",
    total: 44, cd: 300, counter: D(4, 28),
    ctr(T, A, h, G) {
      T.invuln = 20;
      T.move.f = Math.max(T.move.f, 32);
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      G.heal(T, h.dmg);
    },
    info: I(4, "4F〜28F の間構える", "なし（受けた技のぶん回復）", "なし"),
  },
  {
    id: "yasai", sticker: "772622464", name: "野菜ジュース飲んだ？", kind: "にんじんの杭", ai: "trap",
    desc: "にんじんを山なりに投げ、床に突き立てる（5 秒）。相手の飛び道具を止め、触れた相手を押し返す。殴られると折れる",
    total: 30, cd: 360,
    shots: [{ f: 10, vis: "sticker", x: 30, y: -80, vx: 5, vy: -7, g: 0.5, stick: true, life: 300, w: 40, h: 80, wall: true, hp: 30, noReflect: true,
      wallHit: { dmg: 3, base: 7, grow: 0, ang: 30, fixed: true } }],
    info: { startup: 10, dmg: 3, power: 7, text: { dmg: "3%（触れるたび）", power: "7（% に関係なく一定）" } },
  },

  // ===== ハス君シリーズ⑤ =====
  {
    id: "hiHi", sticker: "786875953", name: "HI!", kind: "大ジャンプ", ai: "move", rec: true, oncePerAir: true,
    desc: "地上から、ふつうのジャンプの 1.5 倍の高さへ跳ぶ。空中で使うと小さく跳ぶ（空中で 1 回まで）。空中ジャンプは残る",
    total: 10, cd: 60,
    start(F) { F.vy = F.grounded ? -19 : -10; F.grounded = false; },
    info: I(1, "1F", "なし", "なし"),
  },
  {
    id: "daijoubu3", sticker: "786875954", name: "大丈夫だよ（ふんばり）", kind: "受け身", ai: "def", burst: true,
    desc: "ふっとばされている最中でも使える（ふっとび始めて 10F 後から）。その場でぴたっと止まって立て直す（1〜12F 無敵）。場外へのふっとびをこらえる",
    total: 18, cd: 720, inv: D(1, 12), noDrift: true,
    start(F) { F.vx = 0; F.vy = 0; },
    tick(F, G, f) { if (f < 8) { F.vx = 0; F.vy = 0; F.noGravity = true; } },
    info: I(1, "1F（ふっとび中も使える）", "なし（勢いを消す）", "なし"),
  },
  {
    id: "oramou", sticker: "786875955", name: "オラもうだめだ", kind: "死んだふり", ai: "def",
    desc: "ばたりと倒れて死んだふり（6〜70F）。その間に殴ってきた相手を、起き上がりアッパーで打ち上げる。つかみ・飛び道具には弱い",
    total: 80, cd: 300, low: D(1, 70), counter: D(6, 70), noDrift: true,
    tick(F) { F.sleeping = F.move.f <= 70; F.vx = 0; },
    ctr(T, A, h, G, isProj) {
      if (isProj) return false;
      T.invuln = 16;
      T.move.f = Math.max(T.move.f, 72);
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      if (A && A.alive) G.applyHit(T, A, { dmg: 10, base: 8, grow: 14, ang: 80 }, sign(A.x - T.x) || T.face, false, T.move.slot);
    },
    info: I(6, "6F〜70F 死んだふり", "10%（返した一撃）", "21（返した一撃）"),
  },
  {
    id: "yaruki", sticker: "786875956", name: "やる気倍増！", kind: "次の一撃 2 倍", ai: "buff",
    desc: "やる気を倍にする。10 秒以内に次に当てた攻撃 1 回だけ、ダメージ 2 倍・ふっとばし 1.25 倍",
    total: 30, cd: 900, tick: giveAt(12, { dbl: 600 }), aiOk: F => !F.has("dbl"),
    info: I(12, "12F", "なし（次の一撃 2 倍）", "なし"),
  },
  {
    id: "kyouchou", sticker: "786875957", name: "協調大切！", kind: "% を分け合う", ai: "special",
    desc: "近く（350 以内）のいちばん近い相手と % を足して半分ずつにする。自分が不利なときの逆転の一手。届かないと何も起きない",
    total: 40, cd: 1800,
    tick(F, G, f) {
      if (f !== 16) return;
      const T = G.nearestFoe(F, 350);
      if (!T) return;
      const avg = Math.round((F.dmg + T.dmg) / 2);
      F.dmg = avg; T.dmg = avg;
      G.emit("swap", (F.x + T.x) / 2, F.y - 80, F.slot, T.slot);
    },
    aiOk: (F, G, T) => !!T && F.dmg - T.dmg > 30 && Math.abs(F.x - T.x) < 340,
    info: I(16, "16F（350 以内）", "% を平均にする", "なし"),
  },
  {
    id: "kokodake", sticker: "786875958", name: "ここだけの話", kind: "技封じ", ai: "grab",
    desc: "耳元でひそひそ話をするつかみ。ダメージはないが、相手は 3 秒間技を使えなくなる（移動とジャンプはできる）",
    total: 30, cd: 480,
    hits: [H(6, 8, [34, -55, 40, 50], 0, 3, 0, 20, { grab: true, fixed: true, st: { seal: 180 } })],
    info: { text: { dmg: "なし（3 秒 技封じ）", power: "3（% に関係なく一定）" } },
  },
  {
    id: "gochisou", sticker: "786875959", name: "ごちそうさま", kind: "食後の合掌", ai: "heal",
    desc: "手を合わせて「ごちそうさま」。いちばん近い相手の % の 1/8 だけ回復（最大 15%）。相手を削ったあとに",
    total: 34, cd: 900,
    tick(F, G, f) { if (f === 14) { const T = G.nearestFoe(F); if (T) G.heal(F, Math.min(15, Math.round(T.dmg / 8))); } },
    aiOk: (F, G, T) => !!T && T.dmg > 60 && F.dmg > 20,
    info: I(14, "14F", "なし（相手の % の 1/8 回復）", "なし"),
  },
  {
    id: "benkyou", sticker: "786875960", name: "勉強でいこう！", kind: "参考書投げ", ai: "far",
    desc: "分厚い参考書を山なりに投げる。遅くて重いが、当たると大きい",
    total: 36, cd: 150,
    shots: [{ f: 14, vis: "sticker", x: 30, y: -70, vx: 7.5, vy: -7, g: 0.45, life: 90, w: 44, h: 38, dmg: 11, base: 7, grow: 13, ang: 45 }],
    info: { startup: 14, dmg: 11, power: 20 },
  },
  {
    id: "oreni", sticker: "786875961", name: "オレについて来い", kind: "連れ回し", ai: "grab",
    desc: "相手をつかんで前へ走り、勢いのまま投げ飛ばす（つかみ）。台のふちで止まるので、ふちの近くで使うと強い",
    total: 64, cd: 300,
    hits: [H(6, 9, [34, -45, 40, 50], 3, 0, 0, 0, { grab: true, fixed: true, stun: 60, onHit(A, T) { if (A.move) A.move.v = T.slot + 1; } })],
    tick(F, G, f) {
      const m = F.move;
      if (!m.v) { if (f >= 26) return false; return; }
      if (f < 10) return;
      const T = G.fighters[m.v - 1];
      if (!T || !T.alive) return false;
      if (f < 44) {
        F.vx = G.onStage(F.x + F.face * 70) ? F.face * 6 : 0;
        T.x = F.x + F.face * 45; T.y = F.y; T.vx = 0; T.vy = 0; T.state = "dizzy"; T.dizzy = 4;
      }
      if (f === 44) { G.hitDirect(F, T, { dmg: 9, base: 8, grow: 14, ang: 35 }); m.v = 0; }
    },
    info: { startup: 6, dmg: 12, power: 26, text: { dmg: "3% + 投げ 9%", power: "26（投げ）" } },
  },
  {
    id: "harasuita3", sticker: "786875962", name: "お腹すいた！", kind: "早食い", ai: "atk",
    desc: "3 回すばやくかじりつく。1 回 2% で、与えたダメージと同じだけ回復",
    total: 30, cd: 120,
    hits: [6, 12, 18].map(f => H(f, f + 1, [36, -50, 44, 40], 2, 3, 0, 20, { fixed: true, drain: 1 })),
  },
  {
    id: "gattai", sticker: "786875963", name: "合体", kind: "合体", ai: "buff",
    desc: "仲間と合体！ 6 秒間「アーマー」（12% 以下の攻撃ではひるまない）と「攻撃↑」。ただし重くて「鈍足」",
    total: 45, cd: 1500, tick: giveAt(24, { armor: 360, pow: 360, slow: 360 }),
    info: I(24, "24F", "なし（6 秒 アーマー・攻撃↑・鈍足）", "なし"),
  },
  {
    id: "katsu", sticker: "786875964", name: "喝！", kind: "一喝", ai: "atk", aiReach: 120,
    desc: "「喝！」の一声。すぐ近くの相手をまとめて 36F 気絶させる。範囲はせまい",
    total: 34, cd: 600,
    hits: [H(10, 12, [0, -50, 240, 140], 5, 3, 0, 60, { around: true, fixed: true, stun: 36 })],
    info: { text: { power: "なし（36F 気絶）" } },
  },
  {
    id: "megamawaru", sticker: "786875965", name: "目がまわる〜", kind: "ぐるぐる", ai: "atk",
    desc: "ぐるぐる回ってまわりを攻撃。当たった相手は 2.5 秒「混乱」（左右が逆になる）",
    total: 38, cd: 200,
    hits: [H(8, 20, [0, -45, 130, 80], 6, 5, 8, 50, { around: true, st: { confuse: 150 } })],
  },
  {
    id: "gomeitou", sticker: "786875966", name: "ご名答", kind: "割り込み", ai: "atk",
    desc: "相手の技の出かかりを読んで割り込む。技を出している最中の相手に当てると 10% で 30F 気絶させる。そうでなければ 4%",
    total: 22, cd: 60,
    hits: [H(5, 7, [40, -50, 50, 44], 4, 4, 5, 30, { mod: (F, T, G, h) => (T.state === "move" ? { ...h, dmg: 10, stun: 30 } : h) })],
    info: { text: { dmg: "4%（技の最中の相手に 10%＋気絶）" } },
  },
  {
    id: "utsukushii", sticker: "786875967", name: "美しい", kind: "見とれさせる", ai: "far",
    desc: "きらめきを飛ばす。こちらを向いている相手だけが見とれて 50F 動けなくなる。背中を向けている相手は素通り",
    total: 30, cd: 300,
    shots: [{ f: 10, vis: "star", vx: 9, life: 55, w: 40, h: 40, dmg: 2, base: 0, grow: 0, ang: 0, fixed: true, stun: 50,
      mod: (p, T, G, h) => (T.face === -sign(p.vx) ? h : null) }],
    info: { startup: 10, dmg: 2, text: { power: "なし（向いている相手を 50F 止める）" } },
  },
  {
    id: "oiteike", sticker: "786875968", name: "俺のことは置いていけ", kind: "残像", ai: "def",
    desc: "その場に残像を残して、後ろへ大きく跳びのく（1〜12F 無敵）。残像に触れた相手ははじかれる（3 秒）",
    total: 30, cd: 300, inv: D(1, 12),
    start(F) { F.vx = -F.face * 9; F.vy = -8; F.grounded = false; },
    shots: [{ f: 1, vis: "sticker", x: 0, y: -45, vx: 0, life: 180, w: 50, h: 90, trig: true, arm: 0, noReflect: true,
      ex: { r: 110, dmg: 8, base: 6, grow: 10, ang: 45 } }],
    info: { startup: 1, dmg: 8, power: 19, text: { speed: "1F（残像は 3 秒）" } },
  },
  {
    id: "hatena", sticker: "786875969", name: "？", kind: "なにが出るかな", ai: "special", noCopy: true,
    desc: "何が出るかはお楽しみ。全部の技の中から 1 つがランダムに出る（頭の上に出るのは「？」）。出た技の再使用時間（6 秒以上）がかかる",
    total: 10, cd: 360,
    start(F, G) { G.become(F, G.randomMove(), 360); },
    info: { text: { speed: "出た技しだい", dmg: "出た技しだい", power: "出た技しだい" } },
  },
  {
    id: "arigatou3", sticker: "786875970", name: "ありがとう！（3 匹）", kind: "感謝の連鎖", ai: "atk",
    desc: "感謝のタックル。当たると、その相手のそば（300 以内）にいる別の相手にも感謝が飛び火して 6%（多人数戦向き）",
    total: 32, cd: 100,
    hits: [H(8, 10, [42, -50, 56, 50], 8, 6, 10, 35, {
      onHit(A, T, G) {
        const U = G.list.find(U => U !== A && U !== T && U.alive && U.hover <= 0 && Math.hypot(U.x - T.x, U.y - T.y) < 300);
        if (!U) return;
        G.emit("boom", (T.x + U.x) / 2, U.y - 50, A.slot, 4);
        G.hitDirect(A, U, { dmg: 6, base: 5, grow: 8, ang: 45 }, sign(U.x - T.x) || 1);
      },
    })],
  },
  {
    id: "taichou", sticker: "786875971", name: "体調不良", kind: "くしゃみ", ai: "debuff", aiReach: 140,
    desc: "大きなくしゃみ。前の相手に風邪をうつす（5 秒「やけど」と「攻撃↓」）。自分も反動で 30F ふらつく",
    total: 30, cd: 420,
    hits: [H(12, 14, [60, -55, 110, 80], 4, 7, 3, 25, { st: { burn: 300, weak: 300 } })],
    tick(F, G, f) { if (f === 22) { G.stun(F, 30); return false; } },
  },
  {
    id: "aitai2", sticker: "786875972", name: "会いたいなぁ〜（赤ちゃん）", kind: "ちびっこ", ai: "buff",
    desc: "赤ちゃんに戻る。8 秒間、体が小さく（当たりにくく）足が速くなるが、攻撃は 0.8 倍",
    total: 26, cd: 1200, tick: giveAt(12, { mini: 480 }),
    info: I(12, "12F", "なし（8 秒 ちびっこ）", "なし"),
  },
  {
    id: "tsumikasane", sticker: "786875973", name: "日々の積み重ね", kind: "コツコツ", ai: "atk",
    desc: "コツコツ小突く（2%）。当てるたびに力がたまり、5 回目は 13% の大きな一撃になる（数は撃墜されても残る）",
    total: 16, cd: 0,
    hits: [H(4, 5, [38, -50, 46, 34], 2, 2, 2, 25, {
      mod: (F, T, G, h) => (F.cnt[F.move.slot] >= 4 ? { ...h, dmg: 13, base: 7, grow: 17, ang: 40 } : h),
      onHit(A) { const s = A.move?.slot; if (s != null) A.cnt[s] = A.cnt[s] >= 4 ? 0 : A.cnt[s] + 1; },
    })],
    info: { text: { dmg: "2%（5 回目は 13%）", power: "3（5 回目は 29）" } },
  },
  {
    id: "donden", sticker: "786875974", name: "どんでん返し", kind: "裏回りカウンター", ai: "def",
    desc: "構え（4〜22F）の間に殴られると、相手の背中側へ回りこんで、来た方向へ投げ返す。飛び道具は消すだけ",
    total: 44, cd: 300, counter: D(4, 22),
    ctr(T, A, h, G, isProj) {
      T.invuln = 20;
      T.move.f = Math.max(T.move.f, 30);
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      if (isProj || !A || !A.alive) return;
      const from = sign(T.x - A.x) || -A.face;
      const x = A.x - from * 55;
      if (!A.grounded || G.onStage(x)) { G.warp(T, x, A.y); T.face = sign(A.x - T.x) || T.face; }
      G.applyHit(T, A, { dmg: 10, base: 8, grow: 16, ang: 40 }, from, false, T.move.slot);
    },
    info: I(4, "4F〜22F の間構える", "10%（投げ返し）", "26（投げ返し）"),
  },
  {
    id: "gomakasuna", sticker: "786875975", name: "ごまかすな！", kind: "見破り", ai: "atk",
    desc: "ごまかしを見破る一撃。回避や布団の無敵・カウンター・死んだふりを無視して当たる。ふつうのガードには防がれる",
    total: 32, cd: 90,
    hits: [H(9, 12, [44, -50, 60, 60], 9, 6, 12, 35, { pierce: true })],
  },
  {
    id: "oyasumi4", sticker: "786875976", name: "おやすみなさい（くま）", kind: "寝かしつけ", ai: "grab",
    desc: "つかんで寝かしつける。相手の % が高いほど長く眠る（30〜80F）",
    total: 36, cd: 480,
    hits: [H(6, 8, [34, -45, 40, 50], 3, 0, 0, 0, { grab: true, fixed: true, stun: 30,
      mod: (F, T, G, h) => ({ ...h, stun: Math.min(80, 30 + Math.round(T.dmg * 0.4)) }) })],
    info: { text: { power: "なし（30〜80F 眠らせる）" } },
  },
];
