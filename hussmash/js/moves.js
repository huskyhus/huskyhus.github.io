// 技の定義。ステッカー 1 枚 = 技 1 つ。セリフに合わせて性能を決めている。
// ボタン（A / B / X / Y）は 4 つしかないので、24 個の中から 4 つを選んで持っていく。
//
// 数値の単位はフレーム（1/60 秒）とワールド座標のピクセル。
//   total  技の長さ（この間は他の技を出せない）
//   cd     技が終わってから、同じ技をもう一度使えるまで（0 なら終われば即）
//   hits   攻撃判定 [{ f: [出始め, 終わり], box: [前方向の中心, 高さの中心(上が負), 幅, 高さ], dmg, base, grow, ang }]
//            base / grow: ふっとばしの強さ。速さ = base + grow × (受けた後の%) / 100
//            ang: ふっとぶ角度（度。0 = 前、90 = 真上、負は下向き）
//            fixed: true なら % によらず base の強さ。around: true なら自分を中心に左右どちらにも飛ばす
//            grab: true ならガード・カウンターを無視する（つかみ）
//   hooks（sim.js から呼ばれる）
//     start(F, G)        技の始まり
//     tick(F, G, f)      毎フレーム。false を返すと技を終える
//     hold: true         ボタンを押している間だけ続く技（tick の中で G.held(F, slot) を見る）

const D = (lo, hi) => [lo, hi];

export const MOVES = [
  {
    id: "jab", sticker: "744223957", name: "働け！", kind: "弱攻撃",
    desc: "出が速い小パンチ。連打して相手を休ませない。ふっとばす力は弱い",
    total: 14, cd: 0,
    hits: [{ f: D(3, 5), box: [42, -50, 50, 34], dmg: 3, base: 2.5, grow: 3, ang: 30 }],
  },
  {
    id: "mori", sticker: "744223944", name: "父は森！", kind: "強攻撃",
    desc: "大きく振りかぶる剛腕。出は遅いが、当たれば遠くまでふっとばす",
    total: 50, cd: 30,
    hits: [{ f: D(17, 21), box: [55, -50, 70, 60], dmg: 18, base: 8, grow: 22, ang: 40 }],
  },
  {
    id: "haha", sticker: "744223943", name: "母は偉大なり！", kind: "つかみ",
    desc: "近くの相手をつかんで投げる。ガードもカウンターも貫く。届く距離は短い",
    total: 34, cd: 40,
    hits: [{ f: D(6, 9), box: [34, -45, 40, 50], dmg: 10, base: 7, grow: 12, ang: 45, grab: true }],
  },
  {
    id: "neru", sticker: "744223956", name: "寝る子は育つ", kind: "回復",
    desc: "その場で寝て、% を最大 18 回復する。殴られると起きる（回復はそこまで）",
    total: 110, cd: 600,
    tick(F, G, f) {
      F.sleeping = true;
      if (f > 15 && f < 100 && f % 5 === 0) G.heal(F, 1);
    },
  },
  {
    id: "yatchi", sticker: "744223939", name: "やっちまった！", kind: "突進",
    desc: "前へ勢いよく突っ込む。空中でも真横に飛べるが、止まれないので場外に注意",
    total: 46, cd: 60,
    hits: [{ f: D(9, 22), box: [30, -45, 60, 70], dmg: 12, base: 6, grow: 13, ang: 35 }],
    tick(F, G, f) {
      if (f >= 9 && f <= 22) { F.vx = F.face * 15; F.vy = Math.min(F.vy, 0); F.noGravity = true; }
      else if (f === 23) F.vx = F.face * 4;
    },
  },
  {
    id: "zazen", sticker: "744223948", name: "座禅する！", kind: "ガード",
    desc: "押している間、攻撃を受けても無傷。ガードには耐久があり、割られると目を回す。つかみは防げない",
    total: 600, cd: 20, hold: true,
    tick(F, G, f) {
      F.guarding = true;
      if (f > 8 && !G.held(F, F.move.slot)) return false;
      F.guardHp -= 0.12;
      if (F.guardHp <= 0) { G.guardBreak(F); return false; }
    },
  },
  {
    id: "kando", sticker: "744223942", name: "感動！", kind: "飛び道具",
    desc: "感動の波動をまっすぐ飛ばす。遠くからちくちく削る",
    total: 30, cd: 45,
    tick(F, G, f) {
      if (f === 10) G.spawn(F, "wave", { x: F.x + F.face * 40, y: F.y - 50, vx: F.face * 11, vy: 0, life: 70,
        w: 44, h: 40, dmg: 7, base: 3, grow: 6, ang: 30 });
    },
  },
  {
    id: "kisoku", sticker: "744223945", name: "めざせ規則生活！", kind: "連続攻撃",
    desc: "規則正しい 3 連撃。最後の一撃で浮かせる",
    total: 38, cd: 20,
    hits: [
      { f: D(5, 6), box: [40, -50, 50, 40], dmg: 3, base: 3, grow: 0, ang: 20, fixed: true },
      { f: D(13, 14), box: [42, -50, 54, 40], dmg: 3, base: 3, grow: 0, ang: 20, fixed: true },
      { f: D(21, 24), box: [46, -55, 64, 54], dmg: 7, base: 6, grow: 11, ang: 60 },
    ],
    tick(F, G, f) { if (f < 24 && F.grounded) F.vx = F.face * 1.5; },
  },
  {
    id: "hansei", sticker: "744223940", name: "すまん猛反省してる！", kind: "カウンター",
    desc: "構えている間に攻撃されると、謝りながら倍返しする。読みが外れると隙だらけ",
    total: 44, cd: 90,
    tick(F, G, f) { F.counter = f >= 4 && f <= 24; },
  },
  {
    id: "itsukan", sticker: "744223941", name: "ありがたさ痛感！", kind: "対空",
    desc: "真上へ突き上げるアッパー。空中の相手を上へ打ち上げる。空中で出すと少し上昇",
    total: 34, cd: 25,
    hits: [{ f: D(7, 12), box: [20, -95, 60, 80], dmg: 11, base: 6, grow: 24, ang: 85 }],
    start(F) { if (!F.grounded) F.vy = Math.min(F.vy, -7); },
  },
  {
    id: "kansha", sticker: "744223946", name: "感謝しかない！", kind: "回転",
    desc: "感謝しながら回転し、まわり全部を攻撃。囲まれたときに",
    total: 36, cd: 40,
    hits: [{ f: D(8, 18), box: [0, -45, 130, 80], dmg: 9, base: 5, grow: 12, ang: 50, around: true }],
  },
  {
    id: "junbi", sticker: "744223959", name: "準備完了！", kind: "ため",
    desc: "押している間ためて、離すと正拳突き。ためるほど強い（最大 1 秒）",
    total: 200, cd: 40, hold: true,
    tick(F, G, f) {
      const m = F.move;
      if (m.fire == null) {
        F.charge = Math.min(60, f);
        if (!G.held(F, m.slot) || f >= 60) m.fire = f;
        return;
      }
      const t = f - m.fire;
      const c = F.charge / 60;
      if (t === 4) G.strike(F, { box: [48, -50, 70, 46], dmg: Math.round(8 + 16 * c), base: 5 + 4 * c, grow: 10 + 14 * c, ang: 38 });
      if (t === 5) F.charge = 0;
      if (t >= 24) return false;
    },
  },
  {
    id: "saraba", sticker: "744223949", name: "欲望よさらば", kind: "急降下",
    desc: "空中から真下へ踏みつけ、相手を下へたたき落とす（メテオ）。地上では足元の衝撃波",
    total: 60, cd: 30,
    start(F) { F.move.air = !F.grounded; },
    tick(F, G, f) {
      const m = F.move;
      if (m.air) {
        if (f < 6) { F.vy = 0; F.vx *= 0.8; F.noGravity = true; return; }
        F.vy = 18; F.vx = 0;
        G.strike(F, { box: [0, -10, 56, 40], dmg: 10, base: 4, grow: 9, ang: -80, group: "dive" });
        if (F.grounded || f > 50) return false;
      } else {
        if (f === 10) G.strike(F, { box: [0, -15, 150, 34], dmg: 8, base: 5, grow: 8, ang: 75, around: true });
        if (f > 30) return false;
      }
    },
  },
  {
    id: "gomen", sticker: "744223952", name: "ごめんなさい…", kind: "回避",
    desc: "すばやく転がって、その間は無敵。スティックの向きへ（倒していなければ後ろへ）",
    total: 26, cd: 30,
    start(F, G) {
      const sx = G.stickX(F);
      F.move.dir = sx ? Math.sign(sx) : -F.face;
    },
    tick(F, G, f) {
      if (f >= 2 && f <= 16) { F.invuln = Math.max(F.invuln, 1); F.vx = F.move.dir * 9; }
      else F.vx *= 0.6;
      if (!F.grounded && f === 2) F.vy = Math.min(F.vy, -3);
    },
  },
  {
    id: "sumimasen", sticker: "744223953", name: "すみません", kind: "押し出し",
    desc: "低姿勢で押しのける。ダメージはないが、% に関係なく一定の距離を押し返す",
    total: 28, cd: 30,
    hits: [{ f: D(6, 12), box: [50, -45, 80, 90], dmg: 1, base: 14, grow: 0, ang: 8, fixed: true }],
  },
  {
    id: "oroka", sticker: "744223947", name: "おのれの愚かさ今知る！", kind: "落雷",
    desc: "いちばん近い相手の頭上に雷を落とす。落ちるまで時間があるので、読まれると避けられる",
    total: 34, cd: 180,
    tick(F, G, f) {
      if (f !== 14) return;
      const t = G.nearestFoe(F);
      const x = t ? t.x : F.x + F.face * 200;
      G.spawn(F, "bolt", { x, y: 300, vx: 0, vy: 0, life: 50, w: 70, h: 1000, dmg: 13, base: 6, grow: 12, ang: 80,
        from: 40, around: true, noReflect: true });
    },
  },
  {
    id: "yokubou", sticker: "744223955", name: "人は欲望と共にある", kind: "吸収",
    desc: "かみついて、与えたダメージの半分だけ自分の % を回復する",
    total: 34, cd: 90,
    hits: [{ f: D(9, 12), box: [38, -50, 46, 44], dmg: 10, base: 4, grow: 9, ang: 40, drain: 0.5 }],
  },
  {
    id: "cheat", sticker: "744223958", name: "今日はチートデイ", kind: "復帰",
    desc: "空高く舞い上がる復帰技。スティックで左右に曲げられる。使った後は着地まで何もできない",
    total: 34, cd: 0, oncePerAir: true,
    hits: [{ f: D(4, 16), box: [0, -50, 80, 100], dmg: 5, base: 5, grow: 6, ang: 80, around: true }],
    start(F) { F.vy = -18; },
    tick(F, G, f) {
      F.vx = G.stickX(F) * 4.5;
      if (f < 16) F.vy = Math.min(F.vy, -14);
      if (f === 34) F.helpless = !F.grounded;
    },
  },
  {
    id: "wasureru", sticker: "744223938", name: "忘れるなよ！", kind: "ブーメラン",
    desc: "ステッカーを投げると、行って戻ってくる。行きと帰りの 2 回当たる",
    total: 28, cd: 100,
    tick(F, G, f) {
      if (f === 8) G.spawn(F, "boomerang", { x: F.x + F.face * 40, y: F.y - 55, vx: F.face * 14, vy: 0, life: 150,
        w: 46, h: 40, dmg: 6, base: 4, grow: 7, ang: 40 });
    },
  },
  {
    id: "jigoku", sticker: "744223950", name: "地獄！", kind: "設置",
    desc: "前方に地獄の業火の柱を立てる。触れた相手を焼き続け、最後に打ち上げる",
    total: 40, cd: 150,
    tick(F, G, f) {
      if (f === 18) G.spawn(F, "fire", { x: F.x + F.face * 120, y: F.y - 80, vx: 0, vy: 0, life: 48,
        w: 90, h: 160, dmg: 3, base: 2, grow: 0, ang: 90, fixed: true, every: 8, around: true, noReflect: true,
        last: { dmg: 6, base: 7, grow: 12, ang: 75 } });
    },
  },
  {
    id: "fukanou", sticker: "744223954", name: "不可能です！", kind: "反射",
    desc: "前に壁を張り、飛んでくる飛び道具をはね返す（強くなって返る）。近くの相手も少し押し返す",
    total: 30, cd: 60,
    hits: [{ f: D(4, 8), box: [40, -50, 50, 90], dmg: 2, base: 7, grow: 0, ang: 20, fixed: true }],
    tick(F, G, f) { if (f >= 3 && f <= 20) G.reflect(F, [45, -50, 70, 110]); },
  },
  {
    id: "gyakuten", sticker: "744223951", name: "逆転劇", kind: "逆転",
    desc: "自分の % が高いほど強くなる一撃。追い込まれてからが本番",
    total: 44, cd: 90,
    tick(F, G, f) {
      if (f !== 13) return;
      const p = Math.min(F.dmg, 150) / 150;
      G.strike(F, { box: [50, -50, 66, 56], dmg: Math.round(5 + 15 * p), base: 4 + 5 * p, grow: 8 + 18 * p, ang: 40 });
    },
  },
  {
    id: "omaemo", sticker: "744223937", name: "おまえもな！", kind: "入れ替え",
    desc: "いちばん近い相手と位置と勢いを入れ替える。場外から相手と入れ替わって生還できる",
    total: 30, cd: 480,
    banned: true,   // 場外から入れ替えて相手を落とすのが強すぎるので禁止（選べない・持ち込めない）
    tick(F, G, f) {
      if (f !== 16) return;
      const t = G.nearestFoe(F);
      if (t) G.swap(F, t);
    },
  },
  {
    id: "tokiwa", sticker: "744223960", name: "時は満ちた", kind: "必殺",
    desc: "長い時間をかけて力をため、まわりを大爆発で吹き飛ばす。最強だが、ためている間は無防備",
    total: 80, cd: 900,
    tick(F, G, f) {
      F.charge = Math.min(60, Math.round(f * 60 / 48));
      if (f === 48) { F.charge = 0; G.strike(F, { box: [0, -50, 300, 220], dmg: 22, base: 10, grow: 22, ang: 50, around: true }); }
      if (!F.grounded && f < 48) { F.vy = Math.min(F.vy, 1); }
    },
  },
];

// MOVES の並び（= スナップショットで送る番号）は変えない。禁止した技も定義は残す
export const MOVE_INDEX = Object.fromEntries(MOVES.map((m, i) => [m.id, i]));
export const MOVE_BY_ID = Object.fromEntries(MOVES.map(m => [m.id, m]));
export const SELECTABLE = MOVES.filter(m => !m.banned);
export const DEFAULT_LOADOUT = ["jab", "mori", "kando", "cheat"];
export const BUTTONS = ["A", "B", "X", "Y"];

export const stickerSrc = id => `stickers/${id}.png`;

/** 技を選ぶ画面での分け方 */
export const GROUPS = [
  { name: "攻撃", ids: ["jab", "mori", "kisoku", "itsukan", "kansha", "junbi", "gyakuten", "tokiwa"] },
  { name: "飛び道具・設置", ids: ["kando", "wasureru", "oroka", "jigoku"] },
  { name: "守り", ids: ["zazen", "hansei", "gomen", "fukanou", "sumimasen"] },
  { name: "移動・復帰", ids: ["cheat", "yatchi", "saraba"] },
  { name: "くせ者", ids: ["haha", "neru", "yokubou"] },
];

/** 4 つの技 id として正しいか（重複なし・存在する id・禁止されていない） */
export function isValidLoadout(ld) {
  return Array.isArray(ld) && ld.length === 4
    && ld.every(id => typeof id === "string" && id in MOVE_BY_ID && !MOVE_BY_ID[id].banned)
    && new Set(ld).size === 4;
}

/** 保存してあった組み合わせを直す（禁止になった技・知らない技は、空いている技に差し替える） */
export function repairLoadout(ld) {
  if (!Array.isArray(ld) || ld.length !== 4) return DEFAULT_LOADOUT.slice();
  const out = [];
  for (const id of ld) {
    const ok = typeof id === "string" && MOVE_BY_ID[id] && !MOVE_BY_ID[id].banned && !out.includes(id);
    out.push(ok ? id : null);
  }
  const spare = [...DEFAULT_LOADOUT, ...SELECTABLE.map(m => m.id)].filter(id => !out.includes(id));
  return out.map(id => id ?? spare.shift());
}

// 技を選ぶ画面に出す性能の補足。
//   startup / dmg / power: 攻撃判定を hits に書いていない技の数値（dmg は最大・power は 100% のときのふっとばしの目安）
//   text: 数値だけではわからない技の説明（速さ・威力・ふっとびの欄にそのまま出す）。数値のない欄は、ここで必ず説明する
const INFO = {
  jab: { text: { dmg: "3%（連打できる）" } },
  haha: { text: { speed: "6F（届くのは目の前だけ）", dmg: "10%（ガード・カウンターを無視）" } },
  neru: { startup: 16, text: { speed: "16F で眠り、回復が始まる", dmg: "なし（自分の % を最大 18 回復）", power: "なし（殴られると起きる）" } },
  yatchi: { text: { speed: "9F で突っ込み始める" } },
  zazen: { startup: 1, text: { speed: "1F（押した瞬間から守る）", dmg: "なし（受けた攻撃を無効にする）", power: "なし（自分が少し押される）" } },
  kando: { startup: 10, dmg: 7, power: 9, text: { dmg: "7%（まっすぐ飛ぶ）" } },
  kisoku: { text: { dmg: "3 + 3 + 7 = 13%", power: "17（最後の一撃だけ）" } },
  hansei: { startup: 4, text: { speed: "4F〜24F の間だけ構える", dmg: "受けた技の 1.3 倍（最低 8%）", power: "22（返した一撃）" } },
  junbi: { startup: 5, dmg: 24, power: 33, text: { speed: "離して 4F（ためは最大 1 秒）", dmg: "8〜24%（ためるほど強い）", power: "15〜33（ためるほど強い）" } },
  saraba: { startup: 6, dmg: 10, power: 13, text: { speed: "空中 6F / 地上 10F", dmg: "空中 10% / 地上 8%", power: "13（空中では真下へ落とす）" } },
  gomen: { startup: 2, text: { speed: "2F〜16F の間は無敵", dmg: "なし（転がって避けるだけ）", power: "なし" } },
  sumimasen: { text: { dmg: "1%", power: "14（% に関係なく一定）" } },
  oroka: { startup: 54, dmg: 13, power: 18, text: { speed: "14F で予告、さらに 40F 後に落雷" } },
  yokubou: { text: { dmg: "10%（半分の 5% を自分が回復）" } },
  cheat: { text: { speed: "4F（すぐ上昇する）", dmg: "5%（上昇中に当たる）" } },
  wasureru: { startup: 8, dmg: 12, power: 11, text: { dmg: "6% × 2（行きと帰り）" } },
  jigoku: { startup: 18, dmg: 24, power: 19, text: { speed: "18F で柱が立つ", dmg: "3% × 数回 + 最後 6%", power: "19（最後の一撃で打ち上げ）" } },
  fukanou: { text: { dmg: "2%（飛び道具ははね返す）", power: "7（% に関係なく一定）" } },
  gyakuten: { startup: 13, dmg: 20, power: 31, text: { dmg: "5〜20%（自分の % が高いほど）", power: "12〜31（自分の % が高いほど）" } },
  omaemo: { startup: 16, text: { dmg: "なし（位置を入れ替えるだけ）", power: "なし" } },
  tokiwa: { startup: 48, dmg: 22, power: 32, text: { speed: "48F（ためている間は無防備）", dmg: "22%（まわり全部）" } },
};

/** 技の一覧画面に出す性能。速さ・威力・ふっとびは 1〜5 の段階（数値のない欄は 0）と、欄に出す文 */
export function moveStats(m) {
  const h = m.hits?.[m.hits.length - 1];
  const first = m.hits?.[0];
  const info = INFO[m.id] || {};
  const text = info.text || {};
  const startup = info.startup ?? (first ? first.f[0] : null);
  const dmg = info.dmg ?? (m.hits ? m.hits.reduce((s, x) => s + x.dmg, 0) : null);
  const power = info.power ?? (h ? h.base + h.grow : null);
  const step = (v, cuts) => (v == null ? 0 : 1 + cuts.filter(c => v >= c).length);
  return {
    startup, dmg, power,
    cd: Math.max(m.cd, 0),
    speedLv: startup == null ? 0 : 6 - step(startup, [5, 9, 14, 25]),
    dmgLv: step(dmg, [5, 9, 13, 18]),
    powerLv: step(power, [8, 14, 20, 28]),
    speedText: text.speed ?? (startup != null ? `${startup}F` : "—"),
    dmgText: text.dmg ?? (dmg != null ? `${dmg}%` : "—"),
    powerText: text.power ?? (power != null ? String(Math.round(power)) : "—"),
  };
}
