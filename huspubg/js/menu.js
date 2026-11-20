// Tab の所持品メニュー。装備（どのくらいダメージを減らすか）・武器（相手の防具ごとに何ダメージ・何発で倒せるか、反動、アタッチメント）・回復や弾など。
// 開いている間はマウスが使えて、アタッチメントの付け外し・付けかえ・捨てるができる。文字は textContent でだけ入れる。

import { WEAPONS, HEALS, AMMO, ARMOR_CUT, GRENADE, DETECT, IT, LEVEL_COLORS, TIER_COLORS, weaponTier, caps, stickerSrc,
  ATTS, ATT_DESC, PARTS, attFits, weaponStats, MAX_SPARES, itemTier } from "./items.js";
import { itemIconUrl, iconVersion } from "./icons.js";
import { AC } from "./protocol.js";

const $ = id => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const LV_NAME = ["なし", "Lv1", "Lv2", "Lv3"];
const pct = v => `${Math.round(v * 100)}%`;
const shots = d => (d >= 100 ? "1発" : `${Math.ceil(100 / d)}発`);

/** 武器 1 発のダメージ（相手の防具 lv、頭か） */
export function hitDamage(wid, lv, head) {
  const W = WEAPONS[wid];
  return W.dmg * (head ? W.head : 1) * (1 - ARMOR_CUT[lv]);
}

export class Menu {
  /** act({ a, v }) でホストへ行動を送る */
  constructor(act) { this.key = ""; this.act = act; this.waiting = []; this.iv = -1; }

  /** アイテムの 3D の絵をつける（まだできていなければ、できた時に入れる） */
  icon(im, code) {
    const u = itemIconUrl(code);
    if (u) im.src = u; else this.waiting.push([im, code]);
  }

  /** open: 開いているか / v: 自分の状態（expandY したもの）/ hand: 手に持っている枠 */
  update(open, v, hand) {
    $("menu").hidden = !open;
    if (!open || !v) return;
    const key = JSON.stringify([v.helmet, v.vest, v.pack, v.w1, v.m1, v.w2, v.m2, v.a0, v.a1, v.a2, v.a3, v.h0, v.h1, v.h2, v.gren, v.det, hand, v.att, v.spares]);
    if (key === this.key) {
      // 作り直さずに、あとからできたアイテムの絵だけ入れる（押している途中のボタンを消さないように）
      if (this.iv !== iconVersion) {
        this.iv = iconVersion;
        this.waiting = this.waiting.filter(([im, code]) => { const u = itemIconUrl(code); if (u) im.src = u; return !u; });
      }
      return;
    }
    this.key = key;
    this.waiting = [];
    this.iv = iconVersion;
    const root = $("menu");
    root.textContent = "";
    const head = el("div", "menu-head");
    head.append(el("b", "", "所持品"), el("small", "", "Tab で閉じる ・ アタッチメントはクリックで付け外し"));
    root.append(head);
    const cols = el("div", "menu-cols");
    cols.append(this.armor(v), this.weapons(v, hand), this.supplies(v));
    root.append(cols, this.spares(v));
  }

  // ---- 装備 ----
  armor(v) {
    const col = el("section", "mcol");
    col.append(el("h3", "", "装備"));
    const ex = (wid, head, lv) => Math.round(hitDamage(wid, lv, head));
    // ヘルメット
    col.append(this.gear(IT.HELMET, v.helmet, "ヘルメット", "不可能です！",
      v.helmet ? `頭に受けるダメージ −${pct(ARMOR_CUT[v.helmet])}` : "頭に受けるダメージはそのまま",
      [["Kar98k で頭", 7, true], ["M4 で頭", 3, true]].map(([n, w, h]) => `${n}: ${ex(w, h, 0)} → ${ex(w, h, v.helmet)}（${shots(ex(w, h, v.helmet))}）`)));
    // ベスト
    col.append(this.gear(IT.VEST, v.vest, "ベスト", "座禅する！",
      v.vest ? `胴に受けるダメージ −${pct(ARMOR_CUT[v.vest])}・グレネード −${pct(ARMOR_CUT[v.vest] * 0.7)}` : "胴に受けるダメージはそのまま",
      [["AKM で胴", 4, false], ["M4 で胴", 3, false], ["UMP で胴", 2, false]].map(([n, w, h]) => `${n}: ${ex(w, h, 0)} → ${ex(w, h, v.vest)}（${shots(ex(w, h, v.vest))}）`)));
    // バックパック
    const C = caps(v.pack), N = caps(Math.min(3, v.pack + 1));
    col.append(this.gear(IT.PACK, v.pack, "バックパック", "準備完了！",
      `弾は種類ごとに ${C.ammo} 発まで`,
      [`包帯 ${C.heal[0]}・救急キット ${C.heal[1]}・ドリンク ${C.heal[2]}・グレネード ${C.gren} まで`,
        v.pack < 3 ? `次の Lv なら 弾 ${N.ammo}・包帯 ${N.heal[0]}・救急 ${N.heal[1]}・ドリンク ${N.heal[2]}` : "これ以上は大きくならない"]));
    col.append(el("p", "mnote", "防具の軽減: Lv1 30% / Lv2 40% / Lv3 55%。（ ）の中は 体力 100 の相手を倒すのに必要な発数"));
    return col;
  }

  gear(base, lv, name, mark, main, lines) {
    const card = el("div", "mcard");
    card.style.setProperty("--lv", LEVEL_COLORS[lv] || "#555");
    const im = el("img", "micon");
    im.alt = "";
    if (lv) this.icon(im, base + lv - 1); else im.classList.add("empty");
    const body = el("div", "mbody");
    body.append(el("div", "mtitle", `${name} ${LV_NAME[lv]}`), el("div", "msub", lv ? `印「${mark}」` : "まだ持っていない"), el("div", "mmain", main));
    const ul = el("ul");
    for (const t of lines) ul.append(el("li", "", t));
    body.append(ul);
    card.append(im, body);
    return card;
  }

  // ---- 武器 ----
  weapons(v, hand) {
    const col = el("section", "mcol wide");
    col.append(el("h3", "", "武器（相手の防具ごとのダメージ）"));
    const slots = [[v.w1, v.m1, 0], [v.w2, v.m2, 1]];
    for (const [wid, mag, s] of slots) {
      const card = el("div", "mcard weapon" + (hand === s ? " on" : ""));
      card.style.setProperty("--lv", TIER_COLORS[weaponTier(wid)] || "#555");
      if (!wid) {
        card.append(el("div", "mtitle", `${s + 1}. あき`), el("div", "msub", "武器を拾うとここに入る"));
        col.append(card);
        continue;
      }
      const W = WEAPONS[wid], att = v.att[s], S = weaponStats(wid, att);
      const im = el("img", "micon stk"); im.src = stickerSrc(W.stk); im.alt = "";
      const body = el("div", "mbody");
      body.append(el("div", "mtitle", `${s + 1}. ${W.name}`),
        el("div", "msub", `${W.cls} ・ ${AMMO[W.ammo].name} ・ ${mag} / ${S.mag} 発（予備 ${v["a" + W.ammo]}）`),
        el("div", "mmain", `毎分 ${W.rpm} 発${W.auto ? "（連射）" : ""} ・ ${W.range}m まで全力、遠いほど減って ${W.maxRange}m で 45% 減 ・ 頭 ×${W.head}${W.pellets > 1 ? ` ・ 散弾 ${W.pellets} 粒` : ""}`),
        el("div", "mmain", `反動: 上へ ${(W.rv * S.vk).toFixed(2)}° ・ 左右 ±${(W.rh * S.hk).toFixed(2)}°${W.climb ? ` ・ 連射で +${Math.round(W.climb * 100)}%/発` : ""} ・ 照準 ${S.sight === "iron" ? "アイアンサイト" : S.sight === "reddot" ? "レッドドット" : `${S.zoom} 倍スコープ`}`));
      // アタッチメントの枠（クリックで外す）
      const slots = el("div", "attrow");
      for (let part = 0; part < 4; part++) {
        const ok = part === 0 ? W.fit.scope > 0 : part === 1 ? W.fit.muzzle : part === 2 ? W.fit.grip : W.fit.mag && W.ext > 0;
        const code = att[part];
        const b = el("button", "attslot" + (code ? " has" : "") + (ok ? "" : " no"));
        b.type = "button";
        b.title = code ? `${ATTS[code - IT.ATT].name}: ${ATT_DESC[code - IT.ATT]}（クリックで外す）` : ok ? `${PARTS[part]}（空き）` : `${PARTS[part]}は付けられない`;
        if (code) {
          const ai = el("img"); ai.alt = ""; this.icon(ai, code);
          b.style.setProperty("--t", TIER_COLORS[itemTier(code)]);
          b.append(ai, el("span", "", ATTS[code - IT.ATT].short));
          b.addEventListener("click", () => this.act({ a: AC.DETACH, v: s * 4 + part }));
        } else b.append(el("span", "", ok ? PARTS[part] : "×"));
        slots.append(b);
      }
      body.append(slots);
      // 表: 相手の防具 なし / Lv1 / Lv2 / Lv3
      const tb = el("table", "mtable");
      const tr0 = el("tr");
      tr0.append(el("th", "", W.pellets > 1 ? "相手の防具（全粒命中）" : "相手の防具"));
      for (let lv = 0; lv <= 3; lv++) { const th = el("th", "", LV_NAME[lv]); th.style.color = LEVEL_COLORS[lv]; tr0.append(th); }
      tb.append(tr0);
      for (const [label, h] of [["胴", false], ["頭", true]]) {
        const tr = el("tr");
        tr.append(el("td", "", label));
        for (let lv = 0; lv <= 3; lv++) {
          const d = hitDamage(wid, lv, h) * W.pellets;
          const td = el("td", "", `${Math.round(d)}`);
          td.append(el("small", "", ` ${shots(d)}`));
          if (d >= 100) td.classList.add("one");
          tr.append(td);
        }
        tb.append(tr);
      }
      body.append(tb);
      card.append(im, body);
      col.append(card);
    }
    const fist = WEAPONS[0];
    col.append(el("p", "mnote", `素手: 1 発 ${fist.dmg}（頭 ${Math.round(fist.dmg * fist.head)}）。グレネード: 中心で最大 ${GRENADE.dmg}、${GRENADE.radius}m まで（壁の向こうには届かない）。数字は 1 発のダメージ、右の小さい字は体力 100 の相手を倒すのに必要な発数`));
    return col;
  }

  // ---- 予備のアタッチメント ----
  spares(v) {
    const sec = el("section", "mspares");
    sec.append(el("h3", "", `予備のアタッチメント（${v.spares.length} / ${MAX_SPARES}）`));
    if (!v.spares.length) { sec.append(el("p", "mnote", "拾ったアタッチメントは、付けられる銃の空いている所に自動で付きます。付かない物はここに入ります。")); return sec; }
    const row = el("div", "spare-row");
    v.spares.forEach((code, i) => {
      const A = ATTS[code - IT.ATT];
      const card = el("div", "spare");
      card.style.setProperty("--t", TIER_COLORS[itemTier(code)]);
      const im = el("img"); im.alt = ""; this.icon(im, code);
      card.append(im, el("b", "", A.name), el("small", "", ATT_DESC[code - IT.ATT]));
      const btns = el("div", "btns");
      for (const s of [0, 1]) {
        const wid = s === 0 ? v.w1 : v.w2;
        const b = el("button", "", wid ? `${s + 1} ${WEAPONS[wid].short}に付ける` : `${s + 1} なし`);
        b.type = "button";
        b.disabled = !wid || !attFits(wid, code);
        b.addEventListener("click", () => this.act({ a: AC.ATTACH, v: i * 2 + s }));
        btns.append(b);
      }
      const d = el("button", "drop", "捨てる"); d.type = "button";
      d.addEventListener("click", () => this.act({ a: AC.DROP_ATT, v: i }));
      btns.append(d);
      card.append(btns);
      row.append(card);
    });
    sec.append(row);
    return sec;
  }

  // ---- 回復・弾など ----
  supplies(v) {
    const col = el("section", "mcol");
    col.append(el("h3", "", "回復・弾・そのほか"));
    const C = caps(v.pack);
    const desc = [
      `75 まで +${HEALS[0].hp}・${HEALS[0].time} 秒`,
      `100 まで回復・${HEALS[1].time} 秒`,
      `ブースト +${HEALS[2].boost}（少しずつ回復、60 以上で少し速く走れる）・${HEALS[2].time} 秒`,
    ];
    for (let i = 0; i < 3; i++) {
      const row = el("div", "mrow");
      const im = el("img", "micon small"); this.icon(im, IT.HEAL + i); im.alt = "";
      const t = el("div", "mbody");
      t.append(el("div", "mtitle", `${HEALS[i].name}  ×${v["h" + i]} / ${C.heal[i]}`), el("div", "msub", `${desc[i]} ・ キー ${HEALS[i].key}`));
      row.append(im, t);
      col.append(row);
    }
    const g = el("div", "mrow");
    const gi = el("img", "micon small stk"); gi.src = stickerSrc(GRENADE.stk); gi.alt = "";
    const gt = el("div", "mbody");
    gt.append(el("div", "mtitle", `${GRENADE.name}  ×${v.gren} / ${C.gren}`), el("div", "msub", `3 か G で持つ・左クリックで投げる（予測線が出る）・${GRENADE.fuse} 秒で爆発`));
    g.append(gi, gt);
    col.append(g);
    const d = el("div", "mrow");
    const di = el("img", "micon small stk"); di.src = stickerSrc(DETECT.stk); di.alt = "";
    const dt = el("div", "mbody");
    dt.append(el("div", "mtitle", `${DETECT.name}  ×${v.det} / ${DETECT.max}`), el("div", "msub", `補給物資の中身。7 で使うと ${DETECT.time} 秒間、地図に全員の位置が出る`));
    d.append(di, dt);
    col.append(d);
    // 弾
    col.append(el("h4", "", "弾"));
    const tb = el("table", "mtable ammo");
    for (let a = 0; a < 4; a++) {
      const tr = el("tr");
      const name = el("td", "", AMMO[a].name); name.style.color = AMMO[a].color;
      const users = WEAPONS.filter(W => W.ammo === a).map(W => W.short).join("・");
      tr.append(name, el("td", "", `${v["a" + a]} / ${C.ammo}`), el("td", "msub", users));
      tb.append(tr);
    }
    col.append(tb);
    return col;
  }
}
