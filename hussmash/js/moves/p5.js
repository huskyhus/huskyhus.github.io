// ハスくんと仲間たち
import { D, H, released, giveAt, I, sign, LEDGE_L, LEDGE_R } from "../movekit.js";

export default [
  {
    id: "kenzen", sticker: "820777873", name: "それは健全なのか", kind: "強化つぶし", ai: "atk",
    desc: "健全かどうかチェックするパンチ。相手がよい状態（強化・バリア）なら、それを全部はがして 13%。そうでなければ 4%",
    total: 32, cd: 120,
    hits: [H(10, 12, [44, -50, 56, 50], 4, 4, 5, 35, {
      mod: (F, T, G, h) => (G.positives(T) ? (G.dispel(T), { ...h, dmg: 13, base: 8, grow: 14 }) : h),
    })],
    info: { text: { dmg: "4%（強化中の相手には 13%）" } },
  },
  {
    id: "geigou", sticker: "820777874", name: "迎合するな", kind: "後ろ蹴り", ai: "atk", aiBack: true,
    desc: "背中を向けたまま強烈な後ろ蹴り。後ろの相手にだけ当たる",
    total: 30, cd: 45,
    hits: [H(9, 11, [-48, -45, 64, 44], 11, 7, 14, 40, { dirBack: true })],
  },
  {
    id: "nattoku", sticker: "820777875", name: "無理に納得するな", kind: "つかみ返し", ai: "def",
    desc: "つかまれるのを待つ構え（3〜25F）。つかまれたらふりほどいて投げ返す。打撃は防げないので、つかみを読んだときに",
    total: 40, cd: 240, gcounter: D(3, 25),
    gctr(T, A, h, G) {
      T.invuln = 16;
      T.move.f = Math.max(T.move.f, 30);
      G.emit("counter", T.x, T.y - 50, T.slot, 0);
      if (A.move) G.endMove(A);
      G.applyHit(T, A, { dmg: 9, base: 8, grow: 12, ang: 45 }, sign(A.x - T.x) || T.face, false, T.move.slot);
    },
    aiOk: (F, G, T) => !!T?.move?.def.hits?.some(h => h.grab),
    info: I(3, "3F〜25F の間構える（つかみにだけ効く）", "9%（投げ返し）", "20（投げ返し）"),
  },
  {
    id: "koukai", sticker: "820777876", name: "それで本当に後悔しないか？", kind: "崖際の一押し", ai: "atk",
    desc: "最後の確認の一押し。相手が台のふちに近いほど強くふっとばす（まん中ではとても弱い）",
    total: 32, cd: 90,
    hits: [H(10, 12, [44, -50, 56, 50], 7, 4, 6, 30, {
      mod: (F, T, G, h) => { const k = Math.max(0, 1 - Math.max(0, G.edgeDist(T.x)) / 400); return { ...h, base: 4 + 7 * k, grow: 6 + 16 * k }; },
    })],
    info: { text: { power: "10〜33（ふちに近いほど強い）" } },
  },
  {
    id: "semero", sticker: "820777877", name: "もっと攻めろ！", kind: "攻めの姿勢", ai: "buff",
    desc: "守りを捨てて攻める。6 秒間「攻撃↑」「速さ↑」だが「もろい」（受けるダメージ 1.3 倍）",
    total: 24, cd: 1080, tick: giveAt(10, { pow: 360, haste: 360, frail: 360 }),
    info: I(10, "10F", "なし（攻撃↑・速さ↑・もろい）", "なし"),
  },
  {
    id: "shusenjou", sticker: "820777878", name: "まだ主戦場ではない", kind: "撤退射撃", ai: "move",
    desc: "後ろへ大きく跳んで距離をとりながら、前へ小さな弾を撃つ",
    total: 30, cd: 180,
    start(F) { F.vx = -F.face * 8; F.vy = -9; F.grounded = false; },
    shots: [{ f: 8, vis: "orb", vx: 10, life: 50, w: 28, h: 28, dmg: 4, base: 4, grow: 5, ang: 25 }],
    info: { startup: 8, dmg: 4, power: 9 },
  },
  {
    id: "dynamic", sticker: "820777879", name: "ダイナミックに！", kind: "跳び回転", ai: "atk", rec: true, aiReach: 160, oncePerAir: true,
    desc: "前へ大きく跳びながら大回転。まわり全部に 2 回当たる。空中で 1 回まで",
    total: 42, cd: 120,
    start(F) { F.vx = F.face * 7; F.vy = -12; F.grounded = false; },
    hits: [H(6, 12, [0, -45, 120, 100], 4, 4, 2, 60, { around: true, fixed: true }), H(16, 26, [0, -45, 130, 110], 7, 6, 12, 50, { around: true })],
  },
  {
    id: "aranami", sticker: "820777880", name: "荒波にもまれてこい！", kind: "渦潮", ai: "far",
    desc: "大きな渦潮の泡をゆっくり飛ばす。中の相手を引きこみながら何度も当て、最後に打ち上げる",
    total: 34, cd: 360,
    shots: [{
      f: 12, vis: "bubble", x: 60, y: -50, vx: 3, life: 100, w: 90, h: 90, dmg: 1.5, base: 2, grow: 0, ang: 80, fixed: true, every: 12, pierce: true,
      last: { dmg: 5, base: 8, grow: 12, ang: 80 },
      tick(p, G) {
        for (const T of G.list) {
          if (T.slot === p.owner || !T.alive || T.hover > 0) continue;
          const dx = p.x - T.x, dy = p.y + 45 - T.y;
          if (Math.abs(dx) < 90 && Math.abs(dy) < 90) T.x += sign(dx) * Math.min(3, Math.abs(dx));
        }
      },
    }],
    info: { startup: 12, dmg: 18, power: 24, text: { dmg: "1.5% × 何回も + 最後 5%" } },
  },
  {
    id: "kitai", sticker: "820777881", name: "期待先行や", kind: "時間差ダメージ", ai: "atk",
    desc: "期待だけ先に当てる、すばやい小突き（3F・1%）。1 秒後、当てた相手の体で本当のダメージ（9%）が爆発する",
    total: 18, cd: 240,
    hits: [H(3, 4, [38, -50, 46, 34], 1, 2, 0, 20, { fixed: true,
      onHit(A, T, G) {
        G.shot(A, { vis: "spark", follow: "foe", tgt: T.slot, y: -50, vx: 0, life: 62, from: 60, w: 80, h: 110, dmg: 9, base: 7, grow: 12, ang: 60, around: true, noReflect: true });
      } })],
    info: { text: { dmg: "1% + 1 秒後に 9%", power: "23（1 秒後の爆発）" } },
  },
  {
    id: "mayou", sticker: "820777882", name: "迷う人は対象外", kind: "迷い断ち", ai: "atk",
    desc: "迷っている相手を斬る。技を出していない相手（立つ・歩く・ガード中）にだけ当たり、ガードもよく削る。技を出している相手はすり抜ける",
    total: 40, cd: 90,
    hits: [H(12, 15, [56, -50, 96, 90], 12, 8, 16, 40, { brk: 3, mod: (F, T, G, h) => (T.state === "move" && !T.guarding ? null : h) })],
  },
  {
    id: "sekkei", sticker: "820777883", name: "感情で動くな設計で動け", kind: "設計図地雷", ai: "trap",
    desc: "前の床に地雷を 3 つ等間隔に仕かける（0.5 秒後から有効・7 秒）。触れた相手の足もとで爆発",
    total: 36, cd: 480,
    shots: [80, 160, 240].map(x => ({ f: 14, vis: "mine", x, y: -10, vx: 0, g: 1, stick: true, life: 420, w: 34, h: 18, trig: true, arm: 30, noReflect: true,
      ex: { r: 90, dmg: 5, base: 7, grow: 7, ang: 75 } })),
    info: { startup: 44, dmg: 5, power: 14, text: { speed: "14F で置き、30F 後から有効", dmg: "5%（1 つにつき）" } },
  },
  {
    id: "gokai", sticker: "820777884", name: "とんだ誤解", kind: "フェイント", ai: "atk",
    desc: "頭の上に「別の技」のステッカーを出して相手をだます、すばやい突き。相手はありもしない技を警戒する",
    total: 22, cd: 120,
    start(F, G) { let d = G.randomMove(); if (d.id === "gokai") d = G.moveAt(G.moveIndex("mori")); F.bub = G.moveIndex(d.id); },
    hits: [H(5, 7, [42, -50, 52, 40], 5, 5, 7, 35)],
  },
  {
    id: "kahou", sticker: "820777885", name: "大幅下方修正", kind: "ナーフ", ai: "debuff", aiReach: 90,
    desc: "相手の性能を大幅に下方修正するパンチ。6 秒「攻撃↓」と 4 秒「鈍足」",
    total: 32, cd: 300,
    hits: [H(9, 11, [42, -50, 52, 44], 4, 4, 4, 30, { st: { weak: 360, slow: 240 } })],
  },
  {
    id: "debri", sticker: "820777886", name: "デブリ除去", kind: "弾消し", ai: "def",
    desc: "まわり（半径 350）の相手の飛び道具・設置物をすべて消し、すぐ近くの相手を少し押しのける",
    total: 26, cd: 300,
    tick(F, G, f) { if (f === 8) { G.clearProjs(F, 350); G.emit("boom", F.x, F.y - 50, F.slot, 35); } },
    hits: [H(8, 10, [0, -50, 160, 120], 0, 8, 0, 30, { fixed: true, around: true })],
    aiOk: (F, G) => G.projs.some(p => p.owner !== F.slot && Math.hypot(p.x - F.x, p.y - F.y) < 350),
    info: I(8, "8F", "なし（飛び道具を消す）", "8（% に関係なく一定）"),
  },
  {
    id: "shikumi", sticker: "820777887", name: "静かで成熟したしくみ", kind: "自動砲台", ai: "buff",
    desc: "頭の上に小さな砲台を浮かべる（6 秒）。砲台は 0.8 秒ごとに、いちばん近い相手へ自動で弾を撃つ（1 発 3%）",
    total: 26, cd: 900,
    shots: [{
      f: 10, vis: "orb", follow: "owner", x: -20, y: -130, vx: 0, life: 360, w: 26, h: 26, noReflect: true,
      aura(p, G) {
        if (p.t % 48 !== 0) return;
        const O = G.fighters[p.owner];
        const T = G.nearestFoe(O, 700);
        if (!T) return;
        const dx = T.x - p.x, dy = T.y - 50 - p.y, d = Math.hypot(dx, dy) || 1;
        const q = G.spawn(O, "orb", { x: p.x, y: p.y, vx: dx / d * 9, vy: dy / d * 9, life: 80, w: 22, h: 22, dmg: 3, base: 3, grow: 3, ang: 30 });
        if (q) { q.ms = p.ms; q.mi = p.mi; }
      },
    }],
    info: { startup: 58, dmg: 3, power: 7, text: { dmg: "3% × 最大 7" } },
  },
  {
    id: "tsuuka", sticker: "820777888", name: "終わりではない！通過儀礼だ!!", kind: "すり抜け斬り", ai: "atk", aiReach: 220,
    desc: "無敵で相手をすり抜けながら駆け抜ける（6〜20F）。すり抜けた相手には、30F に遅れて斬撃（10%）が当たる",
    total: 46, cd: 240, inv: D(6, 20), vel: [[6, 20, 13, null, false]],
    tick(F, G, f) {
      const m = F.move;
      if (f >= 6 && f <= 20) for (const T of G.foes(F, 70)) m.w |= 1 << T.slot;
      if (f !== 30) return;
      for (let s = 0; s < 4; s++) {
        if (!(m.w & (1 << s))) continue;
        const T = G.fighters[s];
        if (T && T.alive && Math.abs(T.x - F.x) < 450) G.hitDirect(F, T, { dmg: 10, base: 7, grow: 13, ang: 40 }, sign(T.x - F.x) || -F.face);
      }
    },
    info: { startup: 30, dmg: 10, power: 24, text: { speed: "6F で駆け出し、30F で斬撃" } },
  },
  {
    id: "kansoku", sticker: "820777889", name: "観測狼に徹せよ！", kind: "観測", ai: "debuff",
    desc: "遠くから相手を観測して弱点を見抜く。いちばん近い相手（700 以内）を 7 秒「もろい」（受けるダメージ 1.3 倍）にする",
    total: 30, cd: 600,
    tick(F, G, f) { if (f === 14) { const T = G.nearestFoe(F, 700); if (T) G.give(T, { frail: 420 }); } },
    info: I(14, "14F（700 以内）", "なし（7 秒 もろい）", "なし"),
  },
  {
    id: "jii", sticker: "820777890", name: "……じー", kind: "凝視", ai: "debuff", hold: true, aiHold: 60,
    desc: "押している間、前をじーっと見つめる（最大 2 秒・動けない）。視線（前 500 以内）の中にいる相手は技を使えない",
    total: 200, cd: 300, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      if (released(F, G, f, 120, 6)) return false;
      for (const T of G.list) {
        if (T === F || !T.alive || T.hover > 0) continue;
        const dx = (T.x - F.x) * F.face;
        if (dx > 0 && dx < 500 && Math.abs(T.y - F.y) < 120) G.give(T, { seal: 12 }, true);
      }
    },
    info: I(1, "押している間", "なし（見ている相手を技封じ）", "なし"),
  },
  {
    id: "seiri", sticker: "820777891", name: "冷静に整理しよう", kind: "整理", ai: "buff",
    desc: "冷静に整理して、ほかの技の再使用時間を半分にする",
    total: 24, cd: 600,
    tick(F, G, f) { if (f === 10) { G.cds(F, c => c / 2); G.emit("buff", F.x, F.y - 100, F.slot, -1); } },
    aiOk: F => F.cd.some(c => c > 300),
    info: I(10, "10F", "なし（再使用を半分に）", "なし"),
  },
  {
    id: "erai", sticker: "820777892", name: "偉いわけじゃない 劣っているわけでもない", kind: "対等", ai: "atk",
    desc: "対等に戻す一撃。自分の % が相手より高いほど強い（% の差の 1/5 だけダメージが増える。最大 +15%）",
    total: 32, cd: 120,
    hits: [H(9, 11, [44, -50, 56, 50], 5, 5, 8, 38, {
      mod: (F, T, G, h) => { const d = Math.max(0, Math.min(75, F.dmg - T.dmg)); return { ...h, dmg: Math.round(5 + d / 5), base: 5 + d / 15, grow: 8 + d / 6 }; },
    })],
    info: { text: { dmg: "5〜20%（自分の方が % が高いほど）", power: "15〜38" } },
  },
  {
    id: "monku", sticker: "820777893", name: "文句のつけようがない", kind: "ジャスト", ai: "ko", hold: true, aiHold: () => 24 + Math.floor(Math.random() * 12),
    desc: "押してためて離す。光の輪が閉じる瞬間（押して 28〜34F）に離すと、文句なしの強烈な一撃（18%）。ずれると弱い（6%）",
    total: 220, cd: 60,
    tick(F, G, f) {
      const m = F.move;
      if (m.fire == null) {
        F.charge = Math.min(60, Math.round(f * 60 / 31));
        if (!G.held(F, m.slot) || f >= 50) { m.fire = f; m.v = f >= 28 && f <= 34 ? 1 : 0; F.charge = 0; }
        return;
      }
      const t = f - m.fire;
      if (t === 3) {
        G.strike(F, m.v ? { box: [50, -50, 74, 54], dmg: 18, base: 9, grow: 21, ang: 38 } : { box: [46, -50, 60, 44], dmg: 6, base: 4, grow: 8, ang: 35 }, "j");
        if (m.v) G.emit("parry", F.x + F.face * 50, F.y - 50, F.slot, 1);
      }
      if (t >= 22) return false;
    },
    info: { startup: 31, dmg: 18, power: 36, text: { speed: "押して 28〜34F で離す（その 3F 後に出る）", dmg: "18%（ずれると 6%）", power: "36（ずれると 14）" } },
  },
  {
    id: "hikari", sticker: "820777894", name: "光が見えて来た", kind: "光の道", ai: "rec", oncePerAir: true,
    desc: "光に包まれて止まり（無敵）、30F 後にいちばん近い台のふちの上へ瞬間移動する。確実に戻れるが出が遅く、再使用は長い",
    total: 40, cd: 900, inv: D(1, 32), noDrift: true,
    tick(F, G, f) {
      if (f < 30) { F.vx = 0; F.vy = 0; F.noGravity = true; }
      if (f === 30) G.warp(F, F.x < 800 ? LEDGE_L : LEDGE_R, 600);
    },
    aiOk: F => F.y > 560,
    info: I(30, "30F で台の上へ", "なし", "なし"),
  },
  {
    id: "medetai", sticker: "820777895", name: "めでたい！", kind: "鯛ビンタ", ai: "ko", aiReach: 150,
    desc: "めで「たい」！ 大きな鯛でひっぱたく。リーチが長くふっとばしも強いが、出が遅い",
    total: 46, cd: 90,
    hits: [H(14, 16, [72, -50, 110, 50], 14, 8, 17, 35)],
  },
  {
    id: "amaete", sticker: "820777896", name: "甘えていいんだよ", kind: "みんな回復", ai: "heal",
    desc: "やさしい空気を広げる（5 秒）。自分のまわり（半径 160）にいる人はみんな少しずつ回復（最大 15%）。相手も近くにいれば回復してしまう",
    total: 26, cd: 900,
    shots: [{
      f: 10, vis: "aura", follow: "owner", x: 0, y: -50, vx: 0, life: 300, w: 320, h: 320, noReflect: true,
      aura(p, G) {
        if (p.t % 20 !== 0) return;
        for (const T of G.list) if (T.alive && T.hover <= 0 && Math.hypot(T.x - p.x, T.y - 45 - p.y) <= 160) G.heal(T, 1, true);
      },
    }],
    info: I(10, "10F", "なし（まわりのみんなが 15% 回復）", "なし"),
  },
  {
    id: "gorannshin", sticker: "820777897", name: "ご乱心", kind: "乱心", ai: "buff",
    desc: "ご乱心！ 4 秒間「攻撃↑」「速さ↑」。ただし自分も「混乱」して左右が逆になる",
    total: 22, cd: 900, tick: giveAt(10, { pow: 240, haste: 240, confuse: 240 }),
    info: I(10, "10F", "なし（攻撃↑・速さ↑・混乱）", "なし"),
  },
  {
    id: "ohayou3", sticker: "820777898", name: "おはよう（子猫）", kind: "子猫ダッシュ", ai: "far",
    desc: "子猫を走らせる。子猫は床を速く走って相手にじゃれつき、3 秒「鈍足」",
    total: 28, cd: 180,
    shots: [{ f: 10, vis: "minion", x: 30, y: -16, vx: 8, life: 90, w: 30, h: 30, walk: true, dmg: 4, base: 4, grow: 5, ang: 50, st: { slow: 180 } }],
    info: { startup: 10, dmg: 4, power: 9 },
  },
  {
    id: "ohayougozaimasu", sticker: "820777899", name: "おはようございます", kind: "早起き", ai: "buff",
    desc: "さわやかな朝のあいさつ。5 秒間「速さ↑」と「身軽」（ゆっくり落ちて、高く跳べる）",
    total: 24, cd: 900, tick: giveAt(10, { haste: 300, light: 300 }),
    info: I(10, "10F", "なし（速さ↑・身軽）", "なし"),
  },
  {
    id: "konnichiwa2", sticker: "820777900", name: "こんにちは（くま）", kind: "帽子投げ", ai: "far",
    desc: "帽子を投げる。帽子は少し飛んでからその場でくるくる回り続け、触れた相手に何度も当たる",
    total: 30, cd: 180,
    shots: [{ f: 10, vis: "sticker", x: 40, y: -60, vx: 14, drag: 0.93, life: 100, w: 50, h: 40, dmg: 2, base: 3, grow: 0, ang: 50, fixed: true, every: 12, pierce: true }],
    info: { startup: 10, dmg: 2, power: 3, text: { dmg: "2% × 何回も" } },
  },
  {
    id: "iikibun", sticker: "820777901", name: "いい気分だな", kind: "水はね", ai: "atk",
    desc: "水をぱしゃっとはね上げる。左右に広く低い攻撃で、% に関係なく押し返す。いい気分になって 2 秒回復",
    total: 30, cd: 300,
    hits: [H(8, 11, [0, -25, 220, 50], 4, 8, 0, 25, { fixed: true, around: true })],
    tick(F, G, f) { if (f === 8) G.give(F, { regen: 120 }, true); },
    info: { text: { power: "8（% に関係なく一定）" } },
  },
  {
    id: "ocha", sticker: "820777902", name: "お茶しよう", kind: "お茶に誘う", ai: "debuff",
    desc: "近く（300 以内）のいちばん近い相手をお茶に誘う。相手は 4 秒「攻撃↓」「鈍足」でくつろぎ、自分は 2 秒回復",
    total: 34, cd: 600,
    tick(F, G, f) { if (f === 14) { const T = G.nearestFoe(F, 300); if (T) G.give(T, { weak: 240, slow: 240 }); G.give(F, { regen: 120 }); } },
    info: I(14, "14F（300 以内）", "なし（攻撃↓・鈍足）", "なし"),
  },
  {
    id: "asobou2", sticker: "820777903", name: "遊ぼうよ（鳥）", kind: "鳥を飛ばす", ai: "far",
    desc: "青い鳥を飛ばす。鳥は大きく波打ちながら飛ぶので、高さを読んでよけにくい",
    total: 26, cd: 120,
    shots: [{ f: 9, vis: "sticker", x: 40, y: -60, vx: 7, life: 90, w: 38, h: 34, sine: 4.5, sf: 0.14, dmg: 5, base: 4, grow: 7, ang: 40 }],
    info: { startup: 9, dmg: 5, power: 11 },
  },
  {
    id: "ganbarou", sticker: "820777904", name: "がんばろう", kind: "雪中行軍", ai: "atk", aiReach: 200,
    desc: "雪の中を突き進む。進んでいる間（6〜30F）は 8% 以下の攻撃ではひるまず、最後に体当たり",
    total: 42, cd: 90, armor: [6, 30, 8], vel: [[6, 30, 5.5, null, false]],
    hits: [H(28, 31, [40, -45, 60, 70], 10, 6, 13, 35)],
  },
  {
    id: "kittodekiru", sticker: "820777905", name: "きっとできるよ", kind: "滑空", ai: "rec", oncePerAir: true,
    desc: "マフラーをなびかせて空を滑る（最大 2 秒）。ゆっくり落ちながら前へ進む。横からの復帰に強い。空中で 1 回まで",
    total: 120, cd: 0, noDrift: true,
    tick(F, G) { F.vy = Math.min(F.vy + 0.15, 1.2); F.noGravity = true; F.vx = F.face * 5.5 + G.stickX(F) * 1.5; },
    onLand: () => false,
    info: I(1, "すぐ（最大 2 秒）", "なし", "なし（横に 660 くらい）"),
  },
  {
    id: "pyon", sticker: "820777906", name: "（ぴょーん）", kind: "跳びかかり", ai: "atk", aiReach: 200,
    desc: "（文字のないステッカー）ぴょーんと前へ跳び、跳んでいる間は前に当たる。着地の衝撃で近くの相手も浮かせる",
    total: 50, cd: 70,
    start(F) { F.vx = F.face * 6; F.vy = -10; F.grounded = false; },
    hits: [H(5, 30, [25, -40, 50, 50], 6, 5, 9, 40)],
    tick(F, G, f) {
      const m = F.move;
      if (!m.w && f > 4 && F.grounded) { m.w = f; G.strike(F, { box: [0, -15, 150, 30], dmg: 4, base: 6, grow: 4, ang: 80, around: true }, "l"); }
      if (m.w && f >= m.w + 12) return false;
    },
  },
  {
    id: "muzukashii", sticker: "820777907", name: "むずかしいな", kind: "難問", ai: "debuff",
    desc: "いちばん近い相手（400 以内）に難問を出す。相手は考えこんで 2 秒間技を使えない（移動とジャンプはできる）",
    total: 30, cd: 600,
    tick(F, G, f) { if (f === 14) { const T = G.nearestFoe(F, 400); if (T) G.give(T, { seal: 120 }); } },
    info: I(14, "14F（400 以内）", "なし（2 秒 技封じ）", "なし"),
  },
  {
    id: "sabishiina", sticker: "820777908", name: "寂しいな", kind: "遠吠え", ai: "atk", aiReach: 180,
    desc: "遠吠えでまわり（半径 190）を攻撃（3%・小さく押す）。当たると 3 秒「攻撃↑」",
    total: 32, cd: 240,
    hits: [H(10, 13, [0, -55, 380, 180], 3, 6, 2, 40, { around: true, self: { pow: 180 } })],
  },
  {
    id: "doushiteru", sticker: "820777909", name: "どうしてるかなぁ", kind: "見張りの鳥", ai: "far",
    desc: "青い鳥を飛ばす。鳥はいちばん近い相手の頭上についてまわって見張り、2 秒後に急降下して下へたたき落とす",
    total: 30, cd: 300,
    tick(F, G, f) {
      if (f !== 10) return;
      G.shot(F, { vis: "sticker", follow: "foe", range: 900, y: -230, vx: 0, life: 150, from: 120, w: 50, h: 50, dmg: 7, base: 6, grow: 10, ang: -60, noReflect: true,
        tick(p) { if (p.t >= 120 && p.follow) { p.follow = null; p.vy = 18; p.vx = 0; } } });
    },
    info: { startup: 130, dmg: 7, power: 19, text: { speed: "2 秒見張ってから急降下" } },
  },
  {
    id: "tabi", sticker: "820777910", name: "旅、行きたいな", kind: "長距離移動", ai: "move", rec: true, oncePerAir: true,
    desc: "旅に出るように、前へ一気に長く移動する（1〜20F 無敵・攻撃なし）。空中でも使えて横の復帰に。空中で 1 回まで",
    total: 34, cd: 180, inv: D(1, 20), vel: [[2, 26, 13, 0, true]],
    info: I(2, "2F（1〜20F 無敵）", "なし", "なし（前に 320 くらい）"),
  },
  {
    id: "daijoubu4", sticker: "820777911", name: "大丈夫だよ（守る）", kind: "はじくガード", ai: "def", hold: true, guardMove: true,
    desc: "押している間ガード。攻撃を受け止めると、殴ってきた相手をはじき返す。ガードの耐久は減りやすい",
    total: 600, cd: 40,
    tick(F, G, f) {
      F.guarding = true; F.guardMode = 2;
      if (f > 8 && !G.held(F, F.move.slot)) return false;
      F.guardHp -= 0.2;
      if (F.guardHp <= 0) { G.guardBreak(F); return false; }
    },
    info: I(1, "1F（押した瞬間から守る）", "なし（受けた攻撃を無効）", "なし（殴った相手をはじく）"),
  },
  {
    id: "mimamoru", sticker: "820777912", name: "見守るよ", kind: "守りの子猫", ai: "buff",
    desc: "見守り役の子猫がそばにつく（6 秒）。子猫は近く（半径 120）に飛んできた相手の飛び道具を消してくれる",
    total: 24, cd: 720,
    shots: [{
      f: 10, vis: "minion", follow: "owner", x: -45, y: -30, vx: 0, life: 360, w: 30, h: 30, noReflect: true,
      aura(p, G) { const O = G.fighters[p.owner]; if (O) G.clearProjs(O, 120, O.x, O.y - 50); },
    }],
    info: I(10, "10F", "なし（6 秒 飛び道具を消す）", "なし"),
  },
];
