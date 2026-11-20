// 画面の上に重ねる表示（DOM と 2D キャンバス）。体力・装備・武器・回復・方位・ミニマップ・全体地図・キルログ・お知らせ。
// 文字列は textContent でだけ入れる（名前などは相手から来るので HTML として扱わない）。

import { HALF } from "./world.js";
import { WEAPONS, HEALS, AMMO, STK, STAMPS, stickerSrc, GRENADE, STICKER_NAMES, DETECT, TIER_COLORS, LEVEL_COLORS, weaponTier } from "./items.js";
import { SLOT_COLORS } from "./render.js";
import { itemIconUrl } from "./icons.js";
import { IT } from "./items.js";

const $ = id => document.getElementById(id);
const cache = new Map();
function set(el, key, v) {
  if (!el) return;
  if (cache.get(el)?.[key] === v) return;
  if (!cache.has(el)) cache.set(el, {});
  cache.get(el)[key] = v;
  if (key === "text") el.textContent = v;
  else if (key === "src") el.src = v;
  else if (key === "hidden") el.hidden = v;
  else if (key === "class") el.className = v;
  else if (key.startsWith("--")) el.style.setProperty(key, v);
  else el.style[key] = v;
}

export class Hud {
  constructor() {
    this.mini = $("minimap").getContext("2d");
    this.big = $("bigmap").getContext("2d");
    this.comp = $("compass").getContext("2d");
    this.mapImg = null;
    this.feedItems = [];
    this.dmgs = [];
    this.bannerT = 0;
    this.hitT = 0;
    // スタンプの一覧
    const st = $("stamps");
    st.textContent = "";
    STAMPS.forEach((id, i) => {
      const d = document.createElement("div");
      d.className = "stamp";
      const im = document.createElement("img"); im.src = stickerSrc(id); im.alt = "";
      const b = document.createElement("b"); b.textContent = String(i + 1);
      d.append(im, b);
      st.append(d);
    });
    // 回復の絵は 3D の形を描いたもの（できるまではステッカー）
    for (let i = 0; i < 3; i++) $("heal" + i).querySelector("img").src = itemIconUrl(IT.HEAL + i) || stickerSrc(HEALS[i].stk);
    for (const lv of [1, 2, 3]) for (const base of [IT.HELMET, IT.VEST, IT.PACK]) itemIconUrl(base + lv - 1);   // 先に作っておく
    $("heal3").querySelector("img").src = stickerSrc(DETECT.stk);
    $("grenImg").src = stickerSrc(GRENADE.stk);
    $("eqH").querySelector("img").src = stickerSrc(STK.fukanou);
    $("eqV").querySelector("img").src = stickerSrc(STK.zazen);
    $("eqP").querySelector("img").src = stickerSrc(STK.junbi);
  }

  /** マップの絵（1px = 1m）を作る */
  setMap(world) {
    const S = HALF * 2;
    const cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d");
    const im = g.createImageData(S, S);
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = world.heightAt(x - HALF + 0.5, z - HALF + 0.5);
      let r, gg, b;
      if (h < 0) { const d = Math.min(1, -h / 7); r = 70 - d * 25; gg = 150 - d * 40; b = 205 - d * 30; }
      else if (h < 1.2) { r = 216; gg = 197; b = 140; }
      else { const k = Math.min(1, h / 35); r = 104 + k * 40; gg = 158 + k * 20; b = 82 + k * 30; }
      const i = (z * S + x) * 4;
      im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.fillStyle = "rgba(40,80,40,0.35)";
    for (const t of world.trees) { g.beginPath(); g.arc(t.x + HALF, t.z + HALF, 2.2 * t.s, 0, 6.29); g.fill(); }
    g.strokeStyle = "rgba(200,170,120,0.85)"; g.lineWidth = 4; g.lineCap = "round";
    for (const [ax, az, bx, bz] of world.roads) { g.beginPath(); g.moveTo(ax + HALF, az + HALF); g.lineTo(bx + HALF, bz + HALF); g.stroke(); }
    for (const b of world.buildings) {
      g.fillStyle = b.tower ? "#8b6a43" : b.solid ? "#7d6a5a" : "#5a4a42";
      g.fillRect(b.x0 + HALF, b.z0 + HALF, b.x1 - b.x0, b.z1 - b.z0);
    }
    // 目もり（100m ごと）
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1;
    for (let k = 0; k <= S; k += 100) { g.beginPath(); g.moveTo(k + 12, 0); g.lineTo(k + 12, S); g.moveTo(0, k + 12); g.lineTo(S, k + 12); g.stroke(); }
    this.mapImg = cv;
    this.feedItems = [];
    $("feed").textContent = "";
  }

  drawMap(g, size, cx, cz, scale, st) {
    // st: { me: {x,z,yaw}, Z, PL, plane: [sx,sz,ex,ez], marks: [{x,z,c}] }
    g.save();
    g.clearRect(0, 0, size, size);
    g.fillStyle = "#3a7fb0"; g.fillRect(0, 0, size, size);
    g.translate(size / 2, size / 2);
    g.scale(scale, scale);
    g.translate(-cx, -cz);
    if (this.mapImg) g.drawImage(this.mapImg, -HALF, -HALF);
    const Z = st.Z;
    if (Z) {
      // 安全地帯の外を青く
      g.fillStyle = "rgba(40,70,220,0.28)";
      g.beginPath(); g.rect(-HALF * 2, -HALF * 2, HALF * 4, HALF * 4); g.moveTo(Z[0] + Math.max(0.1, Z[2]), Z[1]); g.arc(Z[0], Z[1], Math.max(0.1, Z[2]), 0, Math.PI * 2, true); g.fill();
      g.lineWidth = 2 / scale; g.strokeStyle = "#5d8bff"; g.beginPath(); g.arc(Z[0], Z[1], Math.max(0.1, Z[2]), 0, 6.29); g.stroke();
      if (Z[5] > 0 && Z[5] < Z[2] - 0.5) { g.strokeStyle = "#ffffff"; g.setLineDash([6 / scale, 4 / scale]); g.beginPath(); g.arc(Z[3], Z[4], Z[5], 0, 6.29); g.stroke(); g.setLineDash([]); }
    }
    if (st.plane) {
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 2 / scale; g.setLineDash([8 / scale, 6 / scale]);
      g.beginPath(); g.moveTo(st.plane[0], st.plane[1]); g.lineTo(st.plane[2], st.plane[3]); g.stroke(); g.setLineDash([]);
    }
    if (st.PL && st.PL[3]) {
      g.fillStyle = "#fff"; g.beginPath(); g.arc(st.PL[0], st.PL[1], 5 / scale, 0, 6.29); g.fill();
    }
    for (const d of st.drops || []) {
      g.fillStyle = d.landed ? "#ff5a4a" : "#ffb02e"; g.strokeStyle = "#fff"; g.lineWidth = 1.5 / scale;
      const r = 5 / scale;
      g.fillRect(d.x - r, d.z - r, r * 2, r * 2); g.strokeRect(d.x - r, d.z - r, r * 2, r * 2);
    }
    for (const m of st.marks || []) {
      g.fillStyle = m.c; g.strokeStyle = "#fff"; g.lineWidth = 1.5 / scale;
      g.beginPath(); g.arc(m.x, m.z, 5 / scale, 0, 6.29); g.fill(); g.stroke();
      if (m.label && st.big) { g.fillStyle = "#fff"; g.font = `${12 / scale}px system-ui`; g.textAlign = "center"; g.fillText(m.label, m.x, m.z - 8 / scale); }
    }
    if (st.me) {
      g.translate(st.me.x, st.me.z);
      g.rotate(-st.me.yaw);
      g.fillStyle = "#ffdf3d"; g.strokeStyle = "#222"; g.lineWidth = 1.5 / scale;
      g.beginPath(); g.moveTo(0, -9 / scale); g.lineTo(6 / scale, 6 / scale); g.lineTo(0, 3 / scale); g.lineTo(-6 / scale, 6 / scale); g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
  }

  minimap(st) {
    const c = $("minimap");
    if (!st.me) return;
    this.drawMap(this.mini, c.width, st.me.x, st.me.z, c.width / 180, st);
  }
  bigmap(st, show) {
    set($("bigmapWrap"), "hidden", !show);
    if (!show) return;
    const c = $("bigmap");
    this.drawMap(this.big, c.width, 0, 0, c.width / (HALF * 2), { ...st, big: true });
  }

  compass(yaw) {
    const c = $("compass"), g = this.comp, W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    // yaw 0 = 北（-z）。右回りが東
    const deg = ((-yaw * 180) / Math.PI + 360) % 360;
    const pxPerDeg = W / 120;
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(255,255,255,0.8)"; g.textAlign = "center"; g.font = "bold 13px system-ui";
    for (let d = Math.floor(deg - 60); d <= deg + 60; d++) {
      if (d % 5) continue;
      const x = W / 2 + (d - deg) * pxPerDeg;
      const dd = ((d % 360) + 360) % 360;
      const label = { 0: "北", 90: "東", 180: "南", 270: "西" }[dd];
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, H - (dd % 15 ? 5 : 10)); g.lineTo(x, H); g.stroke();
      if (label) { g.fillStyle = "#ffdf3d"; g.fillText(label, x, 14); g.fillStyle = "#fff"; }
      else if (dd % 15 === 0) { g.font = "11px system-ui"; g.fillText(String(dd), x, 14); g.font = "bold 13px system-ui"; }
    }
    g.fillStyle = "#ffdf3d"; g.beginPath(); g.moveTo(W / 2 - 5, 0); g.lineTo(W / 2 + 5, 0); g.lineTo(W / 2, 6); g.fill();
    set($("bearing"), "text", String(Math.round(deg) % 360));
  }

  /** 毎フレームの数値（v: 自分の状態） */
  stats(v) {
    set($("hpfill"), "width", `${Math.max(0, v.hp)}%`);
    set($("hpfill"), "class", v.hp < 25 ? "crit" : v.hp < 50 ? "low" : "");
    set($("hpnum"), "text", String(Math.ceil(Math.max(0, v.hp))));
    // 減った分は白く残してから、少し遅れて縮める
    if (v.hp > (this.trail ?? 100)) this.trail = v.hp;
    this.trail = Math.max(v.hp, (this.trail ?? 100) - 0.6);
    set($("hptrail"), "width", `${Math.max(0, this.trail)}%`);
    set($("boostfill"), "width", `${v.boost}%`);
    for (const [id, lv, base] of [["eqH", v.helmet, IT.HELMET], ["eqV", v.vest, IT.VEST], ["eqP", v.pack, IT.PACK]]) {
      set($(id), "hidden", !lv);
      if (lv) { const u = itemIconUrl(base + lv - 1); if (u) set($(id).querySelector("img"), "src", u); }
      set($(id).querySelector("b"), "text", "Lv" + lv);
      set($(id), "--lv", LEVEL_COLORS[lv] || "#555");
    }
    // 武器
    for (let s = 0; s < 2; s++) {
      const el = $("ws" + s), wid = v.w[s];
      set(el, "hidden", !wid);
      if (!wid) continue;
      const W = WEAPONS[wid];
      set(el, "class", "wslot" + (v.hand === s ? " on" : ""));
      set(el, "--tier", TIER_COLORS[weaponTier(wid)]);
      set(el.querySelector("img"), "src", stickerSrc(W.stk));
      set(el.querySelector(".wn"), "text", `${s + 1}  ${W.short}`);
      set(el.querySelector(".wa"), "text", `${v.mag[s]} / ${v.ammo[W.ammo]}`);
      set(el.querySelector(".wt"), "text", AMMO[W.ammo].name);
    }
    set($("wsg"), "hidden", !v.gren);
    set($("wsg"), "class", "wslot small" + (v.hand === 3 ? " on" : ""));
    set($("grenN"), "text", `3  グレネード ×${v.gren}`);
    set($("wsf"), "class", "wslot small" + (v.hand === 2 ? " on" : ""));
    for (let i = 0; i < 3; i++) {
      set($("heal" + i), "class", "heal" + (v.heals[i] ? "" : " none") + (v.act === 2 + i ? " on" : ""));
      set($("heal" + i).querySelector("b"), "text", String(v.heals[i]));
      const u = itemIconUrl(IT.HEAL + i);
      if (u) set($("heal" + i).querySelector("img"), "src", u);
    }
    set($("heal3"), "hidden", !v.det && !(v.detT > 0));
    set($("heal3"), "class", "heal det" + (v.detT > 0 ? " on" : ""));
    set($("heal3").querySelector("b"), "text", v.detT > 0 ? `${Math.ceil(v.detT)}秒` : String(v.det));
    set($("alive"), "text", v.teams ? `${v.teams[0]} / ${v.teams[1]}` : String(v.alive));
    set($("aliveLabel"), "text", v.teams ? "人間 / CPU" : "生存");
    set($("kills"), "text", String(v.kills));
    // 装填・回復の進み
    set($("act"), "hidden", !v.act);
    if (v.act) {
      set($("actfill"), "width", `${Math.round(v.actP * 100)}%`);
      set($("actlabel"), "text", v.act === 1 ? "リロード中…" : `${HEALS[v.act - 2].short}を使用中…`);
    }
  }

  zone(Z, inZone) {
    if (!Z) return;
    const left = Math.max(0, Math.ceil(Z[7]));
    const t = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    set($("zoneInfo"), "text", Z[2] <= 0.5 ? "安全地帯 消滅" : Z[8] ? `収縮中 ${t}` : Z[6] > 6 ? "" : `収縮まで ${t}`);
    set($("zoneInfo"), "class", Z[8] ? "warn" : "");
    set($("outZone"), "hidden", inZone);
  }

  /**
   * 照準。show: 腰だめの十字（広がりつき）を出すか
   * sight: のぞきこみの照準 "" なし / "iron" アイアンサイト（照星と照門）/ "reddot" 赤い点 / "scope2"・"scope4"・"scope8" スコープ
   */
  crosshair(gapPx, show, sight) {
    set($("cross"), "--gap", `${gapPx.toFixed(1)}px`);
    set($("cross"), "hidden", !show);
    const scope = sight.startsWith("scope");
    set($("scope"), "hidden", !scope);
    if (scope) set($("scope"), "class", `scope z${sight.slice(5)}`);
    set($("adsdot"), "hidden", sight !== "reddot");
    set($("iron"), "hidden", sight !== "iron");
  }

  /** 撃たれた: 量に応じて画面が赤く光る・血しぶき・体力バーがゆれる */
  hurt(dmg) {
    const r = $("redflash");
    r.style.setProperty("--a", String(Math.min(1, 0.35 + dmg / 30)));
    r.classList.remove("on"); void r.offsetWidth; r.classList.add("on");
    const n = Math.min(4, 1 + Math.floor(dmg / 15));
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = "splat";
      const side = Math.random() < 0.5;
      s.style.left = `${side ? Math.random() * 25 : 75 + Math.random() * 20}%`;
      s.style.top = `${10 + Math.random() * 70}%`;
      s.style.setProperty("--s", String(0.6 + Math.min(1.4, dmg / 25) * Math.random()));
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      $("splats").append(s);
      setTimeout(() => s.remove(), 1600);
    }
    const bar = document.querySelector(".bars");
    bar.classList.remove("shake"); void bar.offsetWidth; bar.classList.add("shake");   // void: アニメーションをやり直すため
  }

  /** 体力が少ない時の画面（hp 0〜100） */
  lowHp(hp) {
    const k = Math.max(0, Math.min(1, (60 - hp) / 60));
    set($("lowhp"), "opacity", k.toFixed(2));
    set($("lowhp"), "class", hp < 25 ? "lowhp pulse" : "lowhp");
    set($("view"), "filter", hp < 50 ? `saturate(${(0.25 + 0.75 * hp / 50).toFixed(2)})` : "");
  }

  hit(head, kill, dmg) {
    // 与えたダメージの数字（頭は赤、倒したら金色）
    if (dmg > 0) {
      const n = document.createElement("div");
      n.className = "dmgnum" + (head ? " head" : "") + (kill ? " kill" : "");
      n.textContent = String(dmg);
      n.style.marginLeft = `${(Math.random() - 0.5) * 20}px`;
      $("dmgnums").append(n);
      setTimeout(() => n.remove(), 800);
    }
    const el = $("hitm");
    el.className = "hitm show" + (head ? " head" : "") + (kill ? " kill" : "");
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => { el.className = "hitm"; }, kill ? 400 : 180);
  }

  /** 撃たれた向き（画面の上 = 前） */
  damageFrom(angle) {
    const d = document.createElement("div");
    d.className = "dmgdir";
    d.style.transform = `rotate(${angle}rad)`;
    $("dmgdirs").append(d);
    setTimeout(() => d.remove(), 1200);
    const r = $("redflash");
    r.classList.remove("on"); void r.offsetWidth; r.classList.add("on");
  }

  feed(parts) {
    // parts: [{ text, color }]
    const row = document.createElement("div");
    row.className = "feedrow";
    for (const p of parts) {
      if (p.img) { const im = document.createElement("img"); im.src = p.img; im.alt = ""; row.append(im); continue; }
      const s = document.createElement("span"); s.textContent = p.text; if (p.color) s.style.color = p.color; row.append(s);
    }
    $("feed").append(row);
    while ($("feed").children.length > 5) $("feed").firstChild.remove();
    setTimeout(() => row.classList.add("fade"), 6000);
    setTimeout(() => row.remove(), 7000);
  }

  /** 大きなお知らせ（ステッカーと文字） */
  banner(stk, text, sub = "", ms = 2600) {
    const b = $("banner");
    b.querySelector("img").src = stickerSrc(stk);
    b.querySelector("img").alt = STICKER_NAMES[stk] || "";
    b.querySelector(".bt").textContent = text;
    b.querySelector(".bs").textContent = sub;
    b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove("show"), ms);
  }

  prompt(text) { set($("prompt"), "hidden", !text); set($("prompt"), "text", text || ""); }
  stampsShown(on) { set($("stamps"), "hidden", !on); }
  /** 観戦中の表示（見ている人の名前と体力。下の体力バーは自分のもの = 0 なので、見ている人の体力をここに出す） */
  spectating(name, hp) {
    set($("spec"), "hidden", !name);
    set($("specName"), "text", name ? `${name}　体力 ${Math.max(0, hp ?? 0)}` : "");
    set(document.querySelector(".bottom"), "opacity", name ? "0.35" : "1");
  }

  /**
   * やられた画面。info: { killer（名前 or null）, color, weapon（名前）, icon（ステッカー）, head, dist, cause, rank, total, kills, dmg }
   * null で消す
   */
  death(info) {
    const d = $("death");
    d.hidden = !info;
    if (!info) return;
    d.textContent = "";
    const im = document.createElement("img"); im.className = "dimg"; im.src = stickerSrc(STK.yatchi); im.alt = "やっちまった！";
    const body = document.createElement("div");
    const t = document.createElement("div"); t.className = "dt"; t.textContent = "やられた…";
    const k = document.createElement("div"); k.className = "dk";
    if (info.killer) {
      const n = document.createElement("b"); n.textContent = info.killer; n.style.color = info.color;
      k.append(n, document.createTextNode(" に"));
      if (info.icon) { const wi = document.createElement("img"); wi.src = stickerSrc(info.icon); wi.alt = ""; k.append(wi); }
      k.append(document.createTextNode(`${info.weapon}で倒された${info.head ? "（ヘッドショット）" : ""}・${info.dist}m`));
    } else k.textContent = info.cause || "倒れた";
    const s = document.createElement("div"); s.className = "ds";
    for (const [v, label] of [[`#${info.rank}`, `/ ${info.total} 位`], [info.kills, "キル"], [info.dmg, "ダメージ"]]) {
      const sp = document.createElement("span"); const b = document.createElement("b"); b.textContent = String(v); sp.append(b, document.createTextNode(label)); s.append(sp);
    }
    body.append(t, k, s);
    d.append(im, body);
  }

  /** キルカメラの表示（名前 or null） */
  killcam(name) {
    set($("killcam"), "hidden", !name);
    set($("kcName"), "text", name ? `${name} の視点` : "");
    $("game").classList.toggle("killcam-on", !!name);
  }
  setColor(slot) { document.documentElement.style.setProperty("--me", SLOT_COLORS[slot % 6]); }
}
