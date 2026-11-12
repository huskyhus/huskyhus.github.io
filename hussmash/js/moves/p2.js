// ハス君といっしょ③・いつもいっしょ！パート(1) 前半
import { D, H, holdCharge, giveAt, I, sign, clamp } from "../movekit.js";

export default [
  // ===== ハス君といっしょ③ =====
  {
    id: "ok", sticker: "705381865", name: "OK!", kind: "浮かせ", ai: "atk",
    desc: "OK サインで相手を真上へぽんと浮かせる。% に関係なく同じ高さに浮くので、次の技につなげやすい",
    total: 20, cd: 30,
    hits: [H(4, 6, [36, -50, 46, 50], 4, 10, 0, 88, { fixed: true })],
  },
  {
    id: "yoroshiku", sticker: "705381866", name: "よろしくお願いします！", kind: "握手", ai: "grab",
    desc: "がっちり握手するつかみ。ガード・カウンターを貫き、相手は 3 秒「混乱」（左右が逆になる）",
    total: 36, cd: 420,
    hits: [H(6, 8, [34, -45, 40, 50], 4, 6, 3, 40, { grab: true, st: { confuse: 180 } })],
  },
  {
    id: "kanekure", sticker: "705381867", name: "金くれ", kind: "カツアゲ", ai: "atk",
    desc: "相手のよい状態（強化・バリア）をうばって自分のものにする。うばう物がなければ 5% 回復",
    total: 30, cd: 300,
    hits: [H(7, 9, [38, -50, 48, 44], 5, 4, 6, 35, {
      onHit(A, T, G) {
        const got = G.dispel(T);
        if (Object.keys(got).length) G.give(A, got); else G.heal(A, 5);
      },
    })],
  },
  {
    id: "haikei", sticker: "705381868", name: "拝啓お元気ですか", kind: "紙飛行機", ai: "far",
    desc: "手紙の紙飛行機をすーっと飛ばす。少しずつ下がっていく。当たると 5 秒「もろい」（受けるダメージ 1.3 倍）",
    total: 28, cd: 180,
    shots: [{ f: 10, vis: "letter", y: -70, vx: 9, vy: 0.9, life: 90, w: 40, h: 26, dmg: 4, base: 3, grow: 5, ang: 30, st: { frail: 300 } }],
    info: { startup: 10, dmg: 4, power: 8 },
  },
  {
    id: "keigu", sticker: "705381869", name: "お体にはお気をつけください 敬具", kind: "防御アップ", ai: "buff",
    desc: "体に気をつける。8 秒間「防御↑」（受けるダメージ 0.75 倍・ふっとび 0.85 倍）",
    total: 30, cd: 1200, tick: giveAt(14, { tough: 480 }), aiOk: F => !F.has("tough"),
    info: I(14, "14F", "なし（8 秒 防御↑）", "なし"),
  },
  {
    id: "tasukete", sticker: "705381870", name: "助けて〜", kind: "抜け出し", ai: "def", burst: true,
    desc: "ふっとばされている最中でも使える（ふっとび始めて 10F 後から）。叫んでまわりの相手を押しのけ、20F 無敵。連続攻撃から抜け出すための技",
    total: 26, cd: 900, inv: D(1, 20),
    start(F) { F.vx *= 0.3; F.vy = Math.min(F.vy, 0) * 0.3; },
    hits: [H(3, 6, [0, -50, 300, 220], 0, 10, 0, 35, { fixed: true, around: true })],
    info: I(1, "1F（ふっとび中も使える）", "なし（押しのける）", "10（% に関係なく一定）"),
  },
  {
    id: "imatasukeru", sticker: "705381871", name: "今助けるぅ", kind: "斜めダッシュ", ai: "rec",
    desc: "斜め上へ一気に飛び出す復帰技。使った後も動ける（しりもちにならない）。空中で 1 回まで",
    total: 30, cd: 0, oncePerAir: true, vel: [[4, 20, 9, -9, true]],
    hits: [H(4, 20, [10, -50, 60, 70], 4, 5, 5, 50)],
  },
  {
    id: "congrats", sticker: "705381872", name: "Congrats!", kind: "クラッカー", ai: "atk", aiReach: 200,
    desc: "クラッカーを鳴らす。紙吹雪が扇形に 5 つ広がる。近いほどたくさん当たる",
    total: 28, cd: 70,
    shots: [-0.3, -0.15, 0, 0.15, 0.3].map(a => ({
      f: 8, vis: "spark", y: -55, vx: 13 * Math.cos(a), vy: 13 * Math.sin(a), life: 16, w: 26, h: 26, dmg: 2, base: 4, grow: 2, ang: 30,
    })),
    info: { startup: 8, dmg: 10, power: 6, text: { dmg: "2% × 最大 5" } },
  },
  {
    id: "roger", sticker: "705381873", name: "ラジャ!!", kind: "敬礼チョップ", ai: "atk",
    desc: "敬礼からのチョップ。空中の相手を真下へたたき落とす（メテオ）。地上の相手は跳ね上がる",
    total: 30, cd: 45,
    hits: [H(8, 10, [42, -60, 50, 60], 9, 6, 11, -70)],
  },
  {
    id: "sorena", sticker: "705381874", name: "それな", kind: "ものまね", ai: "special", noCopy: true,
    desc: "いちばん近い相手が最後に使った技を、そのまままねして出す（頭の上に出るのは「それな」）。まねした技の再使用時間（8 秒以上）がかかる。相手がまだ何も使っていなければ小パンチ",
    total: 16, cd: 120,
    start(F, G) {
      const T = G.nearestFoe(F);
      const d = T ? G.moveAt(T.lastMv) : null;
      if (d && !d.noCopy && !d.banned) G.become(F, d, 480);
    },
    hits: [H(4, 6, [40, -50, 46, 34], 3, 2, 3, 30)],
    info: { text: { speed: "まねした技しだい", dmg: "まねした技しだい", power: "まねした技しだい" } },
  },
  {
    id: "oyasumi3", sticker: "705381875", name: "おやすみ", kind: "布団", ai: "def",
    desc: "布団にもぐりこむ。もぐっている間（3〜44F）は無敵だが、その場から動けない。出てくると 3% 回復",
    total: 54, cd: 300, inv: D(3, 44), noDrift: true,
    tick(F, G, f) { F.vx = 0; F.sleeping = f <= 44; if (f === 45) G.heal(F, 3); },
    info: I(3, "3F〜44F 無敵", "なし（3% 回復）", "なし"),
  },
  {
    id: "kigyou", sticker: "705381876", name: "会社を辞めて起業する", kind: "自分に投資", ai: "buff",
    desc: "思い切って独立。自分に 10% のダメージを受ける代わりに、8 秒間「攻撃↑」と「速さ↑」",
    total: 30, cd: 1200,
    tick(F, G, f) { if (f === 14) { G.hurt(F, 10); G.give(F, { pow: 480, haste: 480 }); } },
    aiOk: F => !F.has("pow") && F.dmg < 90,
    info: I(14, "14F", "自分に 10%（8 秒 攻撃↑・速さ↑）", "なし"),
  },
  {
    id: "sansei", sticker: "705381877", name: "賛成！", kind: "挙手", ai: "atk", aiReach: 50,
    desc: "勢いよく手を挙げる。頭の上の細く高い範囲に当たり、真上へ飛ばす対空技",
    total: 26, cd: 35,
    hits: [H(5, 9, [12, -145, 40, 120], 8, 7, 12, 90)],
  },
  {
    id: "igiari", sticker: "705381878", name: "異議あり", kind: "弾消し", ai: "far",
    desc: "「異議あり！」の声を飛ばす。途中にある相手の飛び道具を消しながら進み、相手に当たる",
    total: 30, cd: 120,
    shots: [{ f: 10, vis: "sticker", vx: 11, life: 55, w: 54, h: 48, dmg: 6, base: 5, grow: 7, ang: 25, eat: true }],
    info: { startup: 10, dmg: 6, power: 12 },
  },
  {
    id: "shouten", sticker: "705381879", name: "「昇天」チーン", kind: "昇天", ai: "rec",
    desc: "魂になって真上へ昇る。昇っている間（1〜30F）は無敵だが攻撃はできず、その後は着地まで何もできない。空中で 1 回まで",
    total: 34, cd: 0, oncePerAir: true, inv: D(1, 30), noDrift: true,
    tick(F, G, f) {
      if (f <= 30) { F.vy = -10.5; F.vx = G.stickX(F) * 2.5; F.noGravity = true; }
      if (f === 34) F.helpless = !F.grounded;
    },
    info: I(1, "1F（30F 昇る・その間無敵）", "なし", "なし"),
  },
  {
    id: "taeru", sticker: "705381880", name: "耐えるよ！！", kind: "耐えて反撃", ai: "def",
    desc: "2〜40F の間、20% 以下の攻撃ではひるまない（ダメージは受ける）。耐えたダメージが大きいほど、42F の反撃が強くなる。つかみには弱い",
    total: 60, cd: 300, armor: [2, 40, 20],
    tick(F, G, f) {
      if (f !== 42) return;
      const a = Math.min(F.move.v, 30);
      G.strike(F, { box: [48, -50, 70, 60], dmg: Math.round(5 + a * 0.8), base: 5 + a * 0.15, grow: 8 + a * 0.5, ang: 40 }, "r");
    },
    info: { startup: 42, dmg: 29, power: 31, text: { speed: "2〜40F 耐えて、42F で反撃", dmg: "5〜29%（耐えたぶん強い）", power: "13〜31" } },
  },

  // ===== いつもいっしょ！パート(1) 前半 =====
  {
    id: "naminori", sticker: "772622433", name: "波乗りぃ！", kind: "波乗り", ai: "atk", rec: true, aiReach: 260,
    desc: "波に乗って前へ進む（8〜50F）。高さを保ったまま横に長く進めるので、横からの復帰にも。進む間 4 回当たる。空中で 1 回まで",
    total: 56, cd: 120, oncePerAir: true, noDrift: true,
    tick(F, G, f) {
      if (f >= 8 && f <= 50) { F.vx = F.face * 8; F.vy = 0; F.noGravity = true; } else F.vx *= 0.85;
    },
    hits: [
      ...[12, 22, 32].map(f => H(f, f + 3, [20, -30, 80, 70], 3, 4, 3, 40)),
      H(42, 46, [20, -30, 80, 70], 4, 6, 8, 45),
    ],
  },
  {
    id: "nicetry", sticker: "772622434", name: "NICE TRY!", kind: "もう一回", ai: "buff",
    desc: "ナイストライ！ 再使用までいちばん長くかかっている、ほかのボタンの技を、すぐもう一度使えるようにする",
    total: 20, cd: 600,
    tick(F, G, f) {
      if (f !== 8) return;
      let best = -1;
      for (let i = 0; i < 4; i++) if (i !== F.move.slot && F.cd[i] > (best >= 0 ? F.cd[best] : 0)) best = i;
      if (best >= 0) { F.cd[best] = 0; G.emit("buff", F.x, F.y - 100, F.slot, -1); }
    },
    aiOk: F => F.cd.some((c, i) => c > 300 && F.loadout[i] !== "nicetry"),
    info: I(8, "8F", "なし（技 1 つの再使用をなくす）", "なし"),
  },
  {
    id: "poem", sticker: "772622435", name: "いいポエムだね", kind: "ただよう弾", ai: "far",
    desc: "ポエムの音符を 3 つ、ゆらゆらと斜め上へただよわせる。空中の相手や、跳んで近づく相手に",
    total: 34, cd: 180,
    shots: [10, 16, 22].map(f => ({ f, vis: "note", vx: 3.2, vy: -1.3, sine: 2.5, sf: 0.18, life: 130, w: 36, h: 36, dmg: 3, base: 4, grow: 5, ang: 60 })),
    info: { startup: 10, dmg: 9, power: 9, text: { dmg: "3% × 3" } },
  },
  {
    id: "maizoukin", sticker: "772622436", name: "徳川埋蔵金", kind: "発掘", ai: "buff",
    desc: "その場を 45F 掘る（無防備）。出てくるものは運しだい: 12% 回復（45%）/ 6 秒「攻撃↑」「速さ↑」（35%）/ 小判の雨でまわりを攻撃（20%）",
    total: 62, cd: 900, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      if (f !== 46) return;
      const r = G.rand(100);
      if (r < 45) G.heal(F, 12);
      else if (r < 80) G.give(F, { pow: 360, haste: 360 });
      else for (let i = 0; i < 6; i++) {
        G.shot(F, { vis: "coin", face: 1, x: -150 + i * 60, y: -360, vx: 0, vy: 4, g: 0.3, life: 80, w: 34, h: 34, dmg: 5, base: 5, grow: 6, ang: 70, around: true });
      }
    },
    info: I(46, "46F（掘り終わるまで無防備）", "運しだい（小判 5% × 最大 6）", "運しだい"),
  },
  {
    id: "shuyaku", sticker: "772622437", name: "主役登場！", kind: "登場ジャンプ", ai: "ko", aiReach: 320,
    desc: "スポットライトを浴びて高く跳び、いちばん近い相手のそばに着地して衝撃波。跳ぶ瞬間（1〜10F）は無敵。着地のすきが大きい",
    total: 90, cd: 300, inv: D(1, 10), noDrift: true,
    start(F, G) {
      const T = G.nearestFoe(F, 600);
      const tx = T ? clamp(T.x, 430, 1170) : F.x + F.face * 200;
      F.vx = clamp((tx - F.x) / 50, -9, 9);
      F.vy = -15; F.grounded = false;
    },
    tick(F, G, f) {
      const m = F.move;
      if (!m.w && f > 4 && F.grounded) {
        m.w = f;
        F.vx = 0;
        G.strike(F, { box: [0, -40, 300, 90], dmg: 12, base: 7, grow: 16, ang: 65, around: true }, "land");
        G.emit("boom", F.x, F.y - 20, F.slot, 15);
      }
      if (m.w && f >= m.w + 24) return false;
    },
    info: { startup: 50, dmg: 12, power: 23, text: { speed: "着地したとき（50F くらい）" } },
  },
  {
    id: "zenin", sticker: "772622438", name: "全員集合！", kind: "全員引き寄せ", ai: "debuff",
    desc: "号令をかけて、すべての相手を自分の方へ引き寄せる（ダメージなし）。遠くの相手を呼びこみ、得意な近い技で迎えうつ",
    total: 34, cd: 600,
    tick(F, G, f) {
      if (f !== 12) return;
      for (const T of G.list) {
        if (T === F || !T.alive || T.hover > 0 || T.invuln > 0) continue;
        const d = F.x - T.x;
        if (Math.abs(d) < 60) continue;
        G.yank(T, sign(d) * Math.min(18, 6 + Math.abs(d) * 0.025), -4, 18);
      }
      G.emit("boom", F.x, F.y - 50, F.slot, 10);
    },
    info: I(12, "12F", "なし（全員を引き寄せる）", "なし"),
  },
  {
    id: "dance", sticker: "772622439", name: "レッツダンス", kind: "ダンス", ai: "atk",
    desc: "ステップで前・後ろ・前・後ろと 4 回当て、最後にくるりと回って吹き飛ばす。踊りきると 3 秒「速さ↑」",
    total: 50, cd: 120,
    hits: [
      H(8, 9, [40, -50, 50, 50], 3, 4, 0, 20, { fixed: true }),
      H(16, 17, [-40, -50, 50, 50], 3, 4, 0, 20, { fixed: true, dirBack: true }),
      H(24, 25, [40, -50, 50, 50], 3, 4, 0, 20, { fixed: true }),
      H(32, 33, [-40, -50, 50, 50], 3, 4, 0, 20, { fixed: true, dirBack: true }),
      H(40, 43, [0, -50, 140, 80], 4, 6, 10, 55, { around: true }),
    ],
    tick(F, G, f) { if (f === 48) G.give(F, { haste: 180 }); },
  },
  {
    id: "shimobe", sticker: "772622440", name: "行けわがしもべたち", kind: "しもべ召喚", ai: "far",
    desc: "小さなしもべを 3 匹呼び出す。しもべは空を飛んで相手を追いかけ、ぶつかって消える",
    total: 36, cd: 420,
    shots: [12, 18, 24].map((f, i) => ({
      f, vis: "minion", x: 20, y: -90 + i * 20, vx: 4, vy: -2 + i * 2, homing: 0.05, homeAfter: 10, life: 170, w: 30, h: 30, dmg: 4, base: 3, grow: 5, ang: 45,
    })),
    info: { startup: 12, dmg: 12, power: 8, text: { dmg: "4% × 3" } },
  },
  {
    id: "hokore", sticker: "772622441", name: "誇れ", kind: "誇り高き構え", ai: "buff", hold: true, aiHold: 70,
    desc: "押している間、胸を張って誇りをためる（最大 1.5 秒・無防備）。離すと、ためた時間の 5 倍のあいだ「攻撃↑」",
    total: 200, cd: 900, noDrift: true,
    tick(F, G, f) {
      F.vx = 0;
      const t = holdCharge(F, G, f, 90);
      if (t === 1) G.give(F, { pow: Math.round(F.move.w * 90 * 5) });
      if (t >= 10) return false;
    },
    info: I(1, "ためた時間しだい", "なし（最大 7.5 秒 攻撃↑）", "なし"),
  },
  {
    id: "goshoutai", sticker: "772622442", name: "ご招待", kind: "招待状", ai: "far",
    desc: "招待状を投げる。当たると相手は 26F 止まり、自分が相手のすぐ横へ瞬間移動する（招かれて行く）",
    total: 30, cd: 360,
    shots: [{
      f: 10, vis: "letter", vx: 10, life: 70, w: 36, h: 30, dmg: 3, base: 0, grow: 0, ang: 0, fixed: true, stun: 26,
      hit(p, T, G) {
        const O = G.fighters[p.owner];
        if (!O || !O.alive || O.state === "hitstun" || O.state === "dizzy") return;
        let side = sign(O.x - T.x) || -T.face;
        if (T.grounded && !G.onStage(T.x + side * 55)) side = -side;
        G.warp(O, T.x + side * 55, T.y);
        O.face = -side;
      },
    }],
    info: { startup: 10, dmg: 3, text: { power: "なし（26F 止めて、そばへ移動）" } },
  },
  {
    id: "manekarezaru", sticker: "772622443", name: "招かれざる客", kind: "裏回り", ai: "atk", aiReach: 500,
    desc: "14F 後、いちばん近い相手（600 以内）の背中側へ瞬間移動して、ひと押し。前だけのガードは後ろから破れる",
    total: 40, cd: 360,
    tick(F, G, f) {
      if (f !== 14) return;
      const T = G.nearestFoe(F, 600);
      if (!T) return;
      let x = T.x - T.face * 55;
      if (T.grounded && !G.onStage(x)) x = T.x + T.face * 55;
      G.warp(F, x, T.y);
      F.face = sign(T.x - F.x) || F.face;
    },
    hits: [H(18, 21, [40, -50, 56, 60], 8, 7, 12, 35)],
  },
  {
    id: "kowareru", sticker: "772622444", name: "壊れる…", kind: "自爆", ai: "ko", aiReach: 140,
    desc: "心が壊れて大爆発（30F）。まわり全部を大きく吹き飛ばすが、自分も 18% のダメージを受ける",
    total: 64, cd: 1500,
    tick(F, G, f) {
      F.charge = f < 30 ? f * 2 : 0;
      if (f === 30) { G.hurt(F, 18); G.emit("boom", F.x, F.y - 50, F.slot, 30); }
    },
    hits: [H(30, 32, [0, -50, 300, 230], 20, 9, 22, 55, { around: true })],
    info: { text: { dmg: "20%（自分も 18%）" } },
  },
  {
    id: "kowasu", sticker: "772622445", name: "壊す(^-)ニヤリ", kind: "ガード破壊", ai: "atk",
    desc: "にやりと笑ってガードを壊すパンチ。ガードに当たると一発で割る。ガードしていない相手にはふつうのパンチ",
    total: 34, cd: 120,
    hits: [H(12, 14, [44, -50, 56, 50], 8, 6, 10, 35, { brk: 8 })],
  },
  {
    id: "bimi", sticker: "772622446", name: "美味！", kind: "おやつ", ai: "heal",
    desc: "おいしいおやつをぱくっ。4% 回復して、3 秒「速さ↑」",
    total: 22, cd: 600,
    tick(F, G, f) { if (f === 10) { G.heal(F, 4); G.give(F, { haste: 180 }); } },
    info: I(10, "10F", "なし（4% 回復）", "なし"),
  },
  {
    id: "makasero1", sticker: "772622447", name: "まかせろ", kind: "前進ガード", ai: "def", hold: true, guardMove: true,
    desc: "押している間、前だけを守りながらじりじり前へ進む。前からの攻撃は無傷（耐久あり）。後ろからの攻撃とつかみには弱い",
    total: 600, cd: 40, noDrift: true,
    tick(F, G, f) {
      F.guarding = true; F.guardMode = 1;
      if (F.grounded) F.vx = G.onStage(F.x + F.face * 30) ? F.face * 2.2 : 0;
      if (f > 8 && !G.held(F, F.move.slot)) return false;
      F.guardHp -= 0.15;
      if (F.guardHp <= 0) { G.guardBreak(F); return false; }
    },
    info: I(1, "1F（押した瞬間から前を守る）", "なし（前からの攻撃を無効）", "なし"),
  },
  {
    id: "cooldown", sticker: "772622448", name: "cool down!", kind: "再使用リセット", ai: "buff",
    desc: "頭を冷やして、ほかの 3 つの技をすぐ使える状態に戻す",
    total: 30, cd: 1500,
    tick(F, G, f) { if (f === 12) { G.cds(F, () => 0); G.emit("buff", F.x, F.y - 100, F.slot, -1); } },
    aiOk: F => F.cd.filter(c => c > 200).length >= 2,
    info: I(12, "12F", "なし（ほかの技の再使用をなくす）", "なし"),
  },
];
