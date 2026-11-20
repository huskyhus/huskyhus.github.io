// 武器・アイテム・ステッカーの表。素材は「ハス君シリーズ④」の 24 枚だけ。
// ステッカー 1 枚ごとに役目がある（武器・回復・装備・演出・スタンプ）。アバターには 24 枚どれでも使える。

export const STK = {
  omaemo: "744223937",    // おまえもな！        … たおした時
  wasureru: "744223938",  // 忘れるなよ！        … グレネード
  yatchi: "744223939",    // やっちまった！      … やられた時
  hansei: "744223940",    // すまん猛反省してる！ … スタンプ
  itsukan: "744223941",   // ありがたさ痛感！    … DMR
  kando: "744223942",     // 感動！              … 優勝
  haha: "744223943",      // 母は偉大なり！      … 救急キット
  mori: "744223944",      // 父は森！            … スナイパー
  kisoku: "744223945",    // めざせ規則生活！    … アサルト
  kansha: "744223946",    // 感謝しかない！      … アサルト（重）
  oroka: "744223947",     // おのれの愚かさ今知る！… 安全地帯の外
  zazen: "744223948",     // 座禅する！          … ベスト
  saraba: "744223949",    // 欲望よさらば        … 降下
  jigoku: "744223950",    // 地獄！              … ショットガン
  gyakuten: "744223951",  // 逆転劇              … 探知機（補給物資の中身）
  gomen: "744223952",     // ごめんなさい…       … スタンプ
  sumimasen: "744223953", // すみません          … ハンドガン
  fukanou: "744223954",   // 不可能です！        … ヘルメット
  yokubou: "744223955",   // 人は欲望と共にある  … 軽機関銃
  neru: "744223956",      // 寝る子は育つ        … 包帯
  hatarake: "744223957",  // 働け！              … サブマシンガン
  cheat: "744223958",     // 今日はチートデイ    … エナジードリンク
  junbi: "744223959",     // 準備完了！          … バックパック
  tokiwa: "744223960",    // 時は満ちた          … 安全地帯の収縮
};

export const STICKER_NAMES = {
  [STK.omaemo]: "おまえもな！", [STK.wasureru]: "忘れるなよ！", [STK.yatchi]: "やっちまった！",
  [STK.hansei]: "すまん猛反省してる！", [STK.itsukan]: "ありがたさ痛感！", [STK.kando]: "感動！",
  [STK.haha]: "母は偉大なり！", [STK.mori]: "父は森！", [STK.kisoku]: "めざせ規則生活！",
  [STK.kansha]: "感謝しかない！", [STK.oroka]: "おのれの愚かさ今知る！", [STK.zazen]: "座禅する！",
  [STK.saraba]: "欲望よさらば", [STK.jigoku]: "地獄！", [STK.gyakuten]: "逆転劇", [STK.gomen]: "ごめんなさい…",
  [STK.sumimasen]: "すみません", [STK.fukanou]: "不可能です！", [STK.yokubou]: "人は欲望と共にある",
  [STK.neru]: "寝る子は育つ", [STK.hatarake]: "働け！", [STK.cheat]: "今日はチートデイ",
  [STK.junbi]: "準備完了！", [STK.tokiwa]: "時は満ちた",
};

/** アバター（頭のパネル）に使えるステッカー。番号で送り合う */
export const AVATARS = Object.values(STK).sort();
export const stickerSrc = id => `stickers/${id}.png`;

/** スタンプ（T を押しながら 1〜8）。番号で送り合う */
export const STAMPS = [STK.hatarake, STK.kansha, STK.gomen, STK.sumimasen, STK.omaemo, STK.wasureru, STK.gyakuten, STK.hansei];

// ---- 弾 ----
export const AMMO = [
  { name: "9mm", color: "#f2c94c" },
  { name: "5.56mm", color: "#6fcf6f" },
  { name: "7.62mm", color: "#e0703c" },
  { name: "12ゲージ", color: "#d04848" },
];

// ---- 武器 ----
// dmg: 1 発（散弾は 1 粒）の威力 / rpm: 毎分の発射数 / auto: 押しっぱなしで連射 / mag: 装弾数 / ext: 拡張マガジンで増える数 / reload: 秒
// hip / ads: 腰だめ・のぞきこみの拡散（度） / range: 威力が落ち始める距離 / maxRange: 届く距離 / head: 頭の倍率
// 反動（度）: rv 1 発ごとの上へのはね上がり / rh 左右のぶれ（±）/ rb 毎発かたよる向き（+ で右）/ climb 連射するほど増える割合 / rec 撃ち終わると戻る速さ（度/秒）
// zoom: アイアンサイトでのぞいた時の倍率 / top: 機関部の上の高さ（サイトの高さ。一人称の位置合わせ）
// fit: 付けられるアタッチメント { scope: 付けられる最大の倍率（0 なし / 1 レッドドットまで）, muzzle, grip, mag }
// model: 見た目の形（models.js）
// 格: P92 < UMP < M4 ≒ AKM（M4 は扱いやすく AKM は 1 発が重い）、S686 は近距離の一撃、SKS は中距離の連射、Kar98k は頭 1 発、M249 は弾数で押す
export const WEAPONS = [
  { name: "素手", short: "素手", stk: null, cls: "素手", ammo: -1, dmg: 16, rpm: 110, auto: true, mag: 0, ext: 0, reload: 0,
    hip: 0, ads: 0, range: 2, maxRange: 2.3, rv: 0, rh: 0, rb: 0, climb: 0, rec: 0, zoom: 1, top: 0, head: 1.5, pellets: 1, model: "fist",
    fit: { scope: 0, muzzle: false, grip: false, mag: false } },
  { name: "すみません P92", short: "P92", stk: STK.sumimasen, cls: "ハンドガン", ammo: 0, dmg: 24, rpm: 400, auto: false, mag: 15, ext: 5, reload: 1.9,
    hip: 2.6, ads: 1.4, range: 35, maxRange: 200, rv: 1.6, rh: 0.6, rb: 0, climb: 0, rec: 14, zoom: 1.15, top: 0.083, head: 2, pellets: 1, model: "pistol",
    fit: { scope: 1, muzzle: true, grip: false, mag: true } },
  { name: "働け！ UMP", short: "UMP", stk: STK.hatarake, cls: "サブマシンガン", ammo: 0, dmg: 24, rpm: 660, auto: true, mag: 30, ext: 10, reload: 2.2,
    hip: 2.0, ads: 0.6, range: 55, maxRange: 300, rv: 0.5, rh: 0.25, rb: 0.04, climb: 0.02, rec: 10, zoom: 1.3, top: 0.11, head: 1.9, pellets: 1, model: "smg",
    fit: { scope: 4, muzzle: true, grip: true, mag: true } },
  { name: "めざせ規則生活！ M4", short: "M4", stk: STK.kisoku, cls: "アサルトライフル", ammo: 1, dmg: 31, rpm: 720, auto: true, mag: 30, ext: 10, reload: 2.4,
    hip: 2.8, ads: 0.35, range: 110, maxRange: 600, rv: 0.7, rh: 0.3, rb: 0.08, climb: 0.04, rec: 8, zoom: 1.35, top: 0.11, head: 2.1, pellets: 1, model: "ar",
    fit: { scope: 8, muzzle: true, grip: true, mag: true } },
  { name: "感謝しかない！ AKM", short: "AKM", stk: STK.kansha, cls: "アサルトライフル", ammo: 2, dmg: 39, rpm: 600, auto: true, mag: 30, ext: 10, reload: 2.6,
    hip: 3.2, ads: 0.5, range: 110, maxRange: 600, rv: 1.2, rh: 0.6, rb: 0.18, climb: 0.07, rec: 6, zoom: 1.35, top: 0.11, head: 2.1, pellets: 1, model: "ak",
    fit: { scope: 4, muzzle: true, grip: false, mag: true } },
  { name: "地獄！ S686", short: "S686", stk: STK.jigoku, cls: "ショットガン", ammo: 3, dmg: 24, rpm: 160, auto: false, mag: 2, ext: 0, reload: 2.4,
    hip: 4.2, ads: 3.4, range: 10, maxRange: 55, rv: 4.5, rh: 1.2, rb: 0, climb: 0, rec: 14, zoom: 1.15, top: 0.075, head: 1.5, pellets: 9, model: "shotgun",
    fit: { scope: 1, muzzle: false, grip: false, mag: false } },
  { name: "ありがたさ痛感！ SKS", short: "SKS", stk: STK.itsukan, cls: "マークスマン", ammo: 2, dmg: 52, rpm: 300, auto: false, mag: 10, ext: 10, reload: 2.8,
    hip: 3.2, ads: 0.12, range: 220, maxRange: 800, rv: 1.9, rh: 0.5, rb: 0.15, climb: 0.08, rec: 9, zoom: 1.4, top: 0.06, head: 2.3, pellets: 1, model: "dmr",
    fit: { scope: 8, muzzle: true, grip: true, mag: true } },
  { name: "父は森！ Kar98k", short: "Kar98k", stk: STK.mori, cls: "スナイパー", ammo: 2, dmg: 92, rpm: 42, auto: false, mag: 5, ext: 0, reload: 3.4,
    hip: 4.0, ads: 0.03, range: 500, maxRange: 1000, rv: 3.6, rh: 0.4, rb: 0, climb: 0, rec: 4, zoom: 1.5, top: 0.06, head: 2.5, pellets: 1, model: "sniper",
    fit: { scope: 8, muzzle: true, grip: false, mag: false } },
  { name: "人は欲望と共にある M249", short: "M249", stk: STK.yokubou, cls: "軽機関銃", ammo: 1, dmg: 29, rpm: 800, auto: true, mag: 100, ext: 0, reload: 5.2,
    hip: 3.8, ads: 0.7, range: 100, maxRange: 600, rv: 0.75, rh: 0.55, rb: -0.1, climb: 0.03, rec: 5, zoom: 1.35, top: 0.11, head: 2, pellets: 1, model: "lmg",
    fit: { scope: 4, muzzle: false, grip: false, mag: false } },
];

// ---- アタッチメント ----
// part: 0 スコープ / 1 マズル / 2 グリップ / 3 マガジン（1 つの銃にそれぞれ 1 つずつ）
// zoom: スコープの倍率（レッドドットは 1 = 倍率はアイアンサイトと同じで、照準が赤い点になる）
// vk / hk: 縦・横の反動にかける数 / quiet: 音と弾の線を小さくする（サプレッサー）
export const PARTS = ["スコープ", "マズル", "グリップ", "マガジン"];
export const ATTS = [
  { name: "レッドドット", short: "ドット", part: 0, zoom: 1, sight: "reddot", stk: STK.kando },
  { name: "2 倍スコープ", short: "2倍", part: 0, zoom: 2, sight: "scope", stk: STK.kando },
  { name: "4 倍スコープ", short: "4倍", part: 0, zoom: 4, sight: "scope", stk: STK.kando },
  { name: "8 倍スコープ", short: "8倍", part: 0, zoom: 8, sight: "scope", stk: STK.kando },
  { name: "コンペンセイター", short: "コンペ", part: 1, vk: 0.75, hk: 0.75, stk: STK.gomen },
  { name: "サプレッサー", short: "サプ", part: 1, vk: 0.9, hk: 0.9, quiet: true, stk: STK.hansei },
  { name: "縦グリップ", short: "縦グリ", part: 2, vk: 0.8, hk: 1, stk: STK.zazen },
  { name: "アングルグリップ", short: "アングル", part: 2, vk: 1, hk: 0.6, stk: STK.zazen },
  { name: "拡張マガジン", short: "拡張", part: 3, stk: STK.yokubou },
];
export const ATT_DESC = [
  "照準が赤い点になる（倍率はそのまま）",
  "2 倍に拡大",
  "4 倍に拡大",
  "8 倍に拡大",
  "反動 −25%（縦も横も）",
  "撃った音が小さく、弾の線が見えにくくなる（反動 −10%）",
  "縦の反動 −20%",
  "横のぶれ −40%",
  "装弾数が増える",
];
/** その銃にそのアタッチメントが付けられるか */
export function attFits(wid, code) {
  const W = WEAPONS[wid], A = ATTS[code - IT.ATT];
  if (!W || !A) return false;
  if (A.part === 0) return W.fit.scope >= A.zoom;
  if (A.part === 1) return W.fit.muzzle;
  if (A.part === 2) return W.fit.grip;
  return W.fit.mag && W.ext > 0;
}
/** 付いているアタッチメント（[スコープ, マズル, グリップ, マガジン] のアイテム番号。0 = なし）から、その銃の性能 */
export function weaponStats(wid, att = [0, 0, 0, 0]) {
  const W = WEAPONS[wid];
  const A = att.map(c => (c ? ATTS[c - IT.ATT] : null));
  let vk = 1, hk = 1;
  for (const a of A) if (a) { vk *= a.vk ?? 1; hk *= a.hk ?? 1; }
  return {
    mag: W.mag + (A[3] ? W.ext : 0),
    zoom: A[0] ? Math.max(W.zoom, A[0].zoom) : W.zoom,
    sight: A[0] ? A[0].sight : W.model === "fist" ? "none" : "iron",
    vk, hk, quiet: !!A[1]?.quiet,
  };
}
export const W_FIST = 0;
export const W_GRENADE = 9;   // 手に持っているものの番号としてだけ使う（武器表には入れない）

export const GRENADE = { name: "忘れるなよ！ グレネード", stk: STK.wasureru, fuse: 3.2, radius: 7, dmg: 110, speed: 19 };

// 回復: 0 包帯 / 1 救急キット / 2 エナジードリンク
export const HEALS = [
  { name: "寝る子は育つ 包帯", short: "包帯", stk: STK.neru, time: 3, hp: 15, upto: 75, boost: 0, key: "4" },
  { name: "母は偉大なり！ 救急キット", short: "救急キット", stk: STK.haha, time: 6, hp: 100, upto: 100, boost: 0, key: "5" },
  { name: "今日はチートデイ ドリンク", short: "ドリンク", stk: STK.cheat, time: 3, hp: 0, upto: 0, boost: 40, key: "6" },
];

export const ARMOR_CUT = [0, 0.3, 0.4, 0.55];   // レベルごとのダメージ軽減

// ---- 落ちているもの（アイテム番号） ----
// 0〜7: 武器 1〜8 / 8〜11: 弾 / 12〜14: 回復 / 15〜17: ヘルメット Lv1〜3 / 18〜20: ベスト Lv1〜3 / 21〜23: バックパック Lv1〜3 / 24: グレネード / 25: 探知機
// 26〜34: アタッチメント（ATTS の順）
export const IT = { WEAPON: 0, AMMO: 8, HEAL: 12, HELMET: 15, VEST: 18, PACK: 21, GRENADE: 24, DETECT: 25, ATT: 26 };
export const ITEM_COUNT = 35;
export const MAX_SPARES = 6;   // 銃に付けていない予備のアタッチメントを持てる数

/** 探知機: 補給物資にだけ入っている。使うと DETECT.time 秒、地図に全員の位置が出る */
export const DETECT = { name: "逆転劇 探知機", short: "探知機", stk: STK.gyakuten, time: 5, max: 3, key: "7" };

export function itemInfo(code) {
  if (code < IT.AMMO) { const w = WEAPONS[code + 1]; return { kind: "weapon", sub: code + 1, name: w.name, stk: w.stk }; }
  if (code < IT.HEAL) { const a = code - IT.AMMO; return { kind: "ammo", sub: a, name: AMMO[a].name + " 弾", stk: null, color: AMMO[a].color }; }
  if (code < IT.HELMET) { const h = HEALS[code - IT.HEAL]; return { kind: "heal", sub: code - IT.HEAL, name: h.name, stk: h.stk }; }
  if (code < IT.VEST) { const lv = code - IT.HELMET + 1; return { kind: "helmet", sub: lv, name: `不可能です！ ヘルメット Lv${lv}`, stk: STK.fukanou }; }
  if (code < IT.PACK) { const lv = code - IT.VEST + 1; return { kind: "vest", sub: lv, name: `座禅する！ ベスト Lv${lv}`, stk: STK.zazen }; }
  if (code < IT.GRENADE) { const lv = code - IT.PACK + 1; return { kind: "pack", sub: lv, name: `準備完了！ バックパック Lv${lv}`, stk: STK.junbi }; }
  if (code < IT.DETECT) return { kind: "grenade", sub: 0, name: GRENADE.name, stk: GRENADE.stk };
  if (code < IT.ATT) return { kind: "detect", sub: 0, name: DETECT.name, stk: DETECT.stk };
  const a = ATTS[code - IT.ATT];
  return { kind: "att", sub: code - IT.ATT, part: a.part, name: a.name, stk: a.stk };
}

// ---- レア度（見た目の色）: 1 ふつう（白） / 2 いい（青） / 3 すごい（金） ----
const W_TIER = [0, 1, 1, 2, 2, 1, 2, 3, 3];
export const TIER_COLORS = ["#ffffff", "#e8e8e8", "#4da3ff", "#ffc83a"];
export const LEVEL_COLORS = ["#555", "#7d8a5a", "#8fb3d9", "#ffc83a"];   // 装備 Lv1 オリーブ / Lv2 銀青 / Lv3 金
export function itemTier(code) {
  if (code < IT.AMMO) return W_TIER[code + 1];
  if (code < IT.HEAL) return 1;
  if (code < IT.HELMET) return [1, 2, 2][code - IT.HEAL];
  if (code < IT.GRENADE) return ((code - IT.HELMET) % 3) + 1;
  if (code < IT.ATT) return code === IT.DETECT ? 3 : 2;
  return [1, 2, 2, 3, 2, 3, 1, 2, 2][code - IT.ATT];
}
export const weaponTier = wid => W_TIER[wid] ?? 0;
/** 地面のラベル用の短い名前 */
export function itemShort(code) {
  const it = itemInfo(code);
  switch (it.kind) {
    case "weapon": return WEAPONS[it.sub].short;
    case "ammo": return AMMO[it.sub].name;
    case "heal": return HEALS[it.sub].short;
    case "helmet": return `ヘルメット Lv${it.sub}`;
    case "vest": return `ベスト Lv${it.sub}`;
    case "pack": return `バッグ Lv${it.sub}`;
    case "detect": return "探知機";
    case "att": return ATTS[it.sub].name;
    default: return "グレネード";
  }
}

/** バックパックのレベルごとの持てる数 */
export function caps(pack) {
  return {
    ammo: 90 + pack * 60,
    heal: [8 + pack * 4, 2 + pack, 3 + pack * 2],
    gren: 2 + pack,
  };
}

/** 弾 1 箱の数 */
export const AMMO_STACK = [30, 30, 30, 10];
