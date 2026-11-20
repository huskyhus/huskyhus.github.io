// 3D の形（three.js）。銃・落ちているもの・人型のキャラ。
//   銃: 機関部・銃身・ストック・弾倉・照準（スコープ）を箱と円柱で。側面にその武器のステッカー。レア度の色の帯
//   落ちているもの: 弾箱・包帯・救急箱・缶・ヘルメット・ベスト・バッグ・グレネード・探知機。装備は Lv1 オリーブ / Lv2 銀青 / Lv3 金
//   キャラ: 関節（腰・ひざ・肩・ひじ）のある人型。頭はステッカーの「かぶりもの」

import * as THREE from "../vendor/three.module.min.js";
import { WEAPONS, AMMO, LEVEL_COLORS, TIER_COLORS, weaponTier, itemInfo, W_GRENADE, DETECT, STK, HEALS, IT } from "./items.js";

// ハス君スタンプの「印」。装備や回復アイテムの表面に貼る（render.js が setStickerTex でテクスチャの作り方を渡す）
let STICKER = null;
export function setStickerTex(fn) { STICKER = fn; }
const decalMats = new Map();
function decal(g, id, w, h, x, y, z, ry = 0, rx = 0) {
  if (!STICKER) return null;
  if (!decalMats.has(id)) decalMats.set(id, new THREE.MeshLambertMaterial({ map: STICKER(id, { border: "#ffffff" }), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMats.get(id));
  m.rotation.order = "YXZ";
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
  g.add(m);
  return m;
}
/** その装備・回復アイテムの印のステッカー */
const MARK = { helmet: STK.fukanou, vest: STK.zazen, pack: STK.junbi };

const matCache = new Map();
export function mat(color, opt = {}) {
  const key = color + JSON.stringify(opt);
  if (!matCache.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color, ...opt });
    matCache.set(key, m);
  }
  return matCache.get(key);
}
const GOLD = () => mat("#ffc83a", { emissive: "#5a3c00" });
const box = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
const cyl = (g, r, len, x, y, z, m, axis = "z", seg = 10) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  if (axis === "z") c.rotation.x = Math.PI / 2; else if (axis === "x") c.rotation.z = Math.PI / 2;
  c.position.set(x, y, z); g.add(c); return c;
};

// ---- 銃（-z が前。原点はにぎり） ----
// 取り付け位置: top 機関部の上面 / grip 前にぎりの z と下面の y / mag 弾倉の下端 [y, z]
const MOUNT = {
  pistol: { top: 0.08 }, smg: { top: 0.075, grip: [-0.28, -0.015], mag: [-0.165, -0.2] },
  ar: { top: 0.0725, grip: [-0.45, -0.015], mag: [-0.16, -0.21] }, ak: { top: 0.0725, grip: [-0.45, -0.015], mag: [-0.16, -0.18] },
  shotgun: { top: 0.07 }, dmr: { top: 0.0575, grip: [-0.45, -0.035], mag: [-0.13, -0.18] }, sniper: { top: 0.0575 },
  lmg: { top: 0.085 },
};
const SCOPE_R = [0, 0.019, 0.024, 0.029];   // 2 倍 / 4 倍 / 8 倍の筒の太さ

const gunCache = new Map();
/** 銃の形。stickerTex(id) を渡すと側面にステッカーを貼る。att: [スコープ, マズル, グリップ, マガジン]（アイテム番号） */
export function gunMesh(wid, stickerTex, att = [0, 0, 0, 0]) {
  const key = wid + ":" + att.join(",");
  if (!gunCache.has(key)) gunCache.set(key, buildGun(wid, stickerTex, att));
  const src = gunCache.get(key), c = src.clone();
  c.userData.muzzle = src.userData.muzzle.clone();   // clone() は userData を JSON で写すので、Vector3 を作り直す
  c.userData.sightY = src.userData.sightY;
  return c;
}

function buildGun(wid, stickerTex, att = [0, 0, 0, 0]) {
  const g = new THREE.Group();
  const W = WEAPONS[wid];
  const tier = weaponTier(wid);
  const metal = mat("#2b2d31"), mid = mat("#4a4f57"), wood = mat("#8a5a32"), poly = mat("#3b3a36");
  const trim = tier === 3 ? GOLD() : mat(TIER_COLORS[tier]);
  let decalZ = -0.12, decalY = 0.0, muzzle = -0.6;
  // レア度の色の線（銃の左右の側面）
  const band = (hw, len, y, z) => { for (const sx of [-1, 1]) box(g, 0.004, 0.016, len, sx * (hw + 0.002), y, z, trim); };
  switch (W.model) {
    case "pistol":
      box(g, 0.04, 0.06, 0.22, 0, 0.05, -0.08, metal);           // スライド
      box(g, 0.035, 0.04, 0.18, 0, 0.0, -0.07, mid);              // フレーム
      box(g, 0.035, 0.11, 0.05, 0, -0.05, 0.0, poly);             // グリップ
      band(0.018, 0.2, 0.048, -0.08);
      muzzle = -0.2; decalZ = -0.08; decalY = 0.04;
      break;
    case "smg":
      box(g, 0.055, 0.09, 0.36, 0, 0.03, -0.16, metal);
      cyl(g, 0.016, 0.1, 0, 0.04, -0.39, mid);
      box(g, 0.04, 0.17, 0.05, 0, -0.08, -0.2, mid);              // 弾倉
      box(g, 0.04, 0.1, 0.05, 0, -0.05, -0.02, poly);             // グリップ
      box(g, 0.04, 0.05, 0.22, 0, 0.03, 0.12, poly);              // ストック
      band(0.028, 0.3, 0.045, -0.16);
      muzzle = -0.45;
      break;
    case "ar": case "ak": {
      const ak = W.model === "ak";
      box(g, 0.055, 0.085, 0.42, 0, 0.03, -0.12, metal);
      box(g, 0.06, 0.07, 0.24, 0, 0.02, -0.45, ak ? wood : mid);  // ハンドガード
      cyl(g, 0.012, 0.22, 0, 0.04, -0.66, metal);                 // 銃身
      box(g, 0.035, 0.16, 0.06, 0, -0.08, -0.2, metal).rotation.x = ak ? 0.25 : 0.1;   // 弾倉
      box(g, 0.04, 0.1, 0.05, 0, -0.05, 0.02, ak ? wood : poly);
      box(g, 0.045, 0.08, 0.24, 0, 0.02, 0.2, ak ? wood : poly);  // ストック
      band(0.028, 0.36, 0.039, -0.12);
      muzzle = -0.78;
      break;
    }
    case "shotgun":
      cyl(g, 0.02, 0.62, -0.02, 0.04, -0.36, metal);
      cyl(g, 0.02, 0.62, 0.022, 0.04, -0.36, metal);
      box(g, 0.06, 0.08, 0.16, 0, 0.03, -0.0, mid);
      box(g, 0.06, 0.07, 0.22, 0, 0.0, -0.32, wood);
      box(g, 0.05, 0.1, 0.3, 0, -0.01, 0.2, wood);
      band(0.031, 0.16, 0.040, 0);
      muzzle = -0.68; decalZ = 0.0;
      break;
    case "dmr": case "sniper": {
      const sn = W.model === "sniper";
      box(g, 0.05, 0.075, 0.42, 0, 0.02, -0.1, sn ? wood : metal);
      box(g, 0.055, 0.07, 0.36, 0, 0.0, -0.45, wood);
      cyl(g, 0.012, sn ? 0.45 : 0.3, 0, 0.035, sn ? -0.82 : -0.74, metal);
      box(g, 0.05, 0.1, 0.32, 0, -0.01, 0.22, wood);
      if (!sn) box(g, 0.035, 0.12, 0.06, 0, -0.07, -0.18, metal);
      if (sn) box(g, 0.01, 0.01, 0.06, 0.035, 0.05, 0.0, metal);   // ボルト
      band(0.026, 0.3, 0.025, -0.1);
      muzzle = sn ? -1.05 : -0.9;
      break;
    }
    case "lmg":
      box(g, 0.07, 0.11, 0.46, 0, 0.03, -0.12, metal);
      box(g, 0.07, 0.07, 0.22, 0, 0.02, -0.46, mid);
      cyl(g, 0.016, 0.3, 0, 0.04, -0.72, metal);
      box(g, 0.13, 0.12, 0.13, 0.03, -0.08, -0.14, mid);          // 弾箱
      box(g, 0.04, 0.1, 0.05, 0, -0.05, 0.04, poly);
      box(g, 0.05, 0.09, 0.26, 0, 0.02, 0.22, poly);
      box(g, 0.008, 0.16, 0.008, -0.03, -0.08, -0.6, metal).rotation.z = 0.3;   // 二脚
      box(g, 0.008, 0.16, 0.008, 0.03, -0.08, -0.6, metal).rotation.z = -0.3;
      band(0.036, 0.42, 0.055, -0.12);
      muzzle = -0.88;
      break;
  }
  if (stickerTex && W.stk) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.105), new THREE.MeshBasicMaterial({ map: stickerTex(W.stk), transparent: true }));
    decal.position.set(-0.04, decalY, decalZ); decal.rotation.y = -Math.PI / 2;
    g.add(decal);
    const d2 = decal.clone(); d2.position.x = 0.04; d2.rotation.y = Math.PI / 2; g.add(d2);
  }
  // ---- 照準とアタッチメント ----
  const M = MOUNT[W.model] || { top: 0.07 };
  const top = M.top;
  let sightY = top + 0.022;
  const [sc, mz, gr, mg] = att.map(c => (c ? c - IT.ATT : -1));
  if (sc < 0) {
    // アイアンサイト: 手前の照門（2 本の柱のすき間）と、先の照星
    const rearZ = W.model === "pistol" ? -0.005 : -0.02, frontZ = muzzle + (W.model === "pistol" ? 0.02 : 0.08);
    for (const sx of [-1, 1]) box(g, 0.008, 0.024, 0.012, sx * 0.008, top + 0.012, rearZ, metal);
    box(g, 0.026, 0.006, 0.012, 0, top + 0.003, rearZ, metal);
    box(g, 0.005, 0.024, 0.008, 0, top + 0.012, frontZ, metal);
    if (W.model !== "pistol") box(g, 0.012, top + 0.012 - 0.04, 0.012, 0, (top + 0.04) / 2 - 0.001, frontZ, metal);   // 照星の台
    box(g, 0.004, 0.004, 0.004, 0, top + 0.026, frontZ, mat("#ffd23d", { emissive: "#806000" }));   // 照星の先の目印
    sightY = top + 0.018;
  } else if (sc === 0) {
    // レッドドット: 台と四角い窓、赤みのあるガラス
    const z = -0.1;
    box(g, 0.034, 0.01, 0.07, 0, top + 0.005, z, metal);
    const h = 0.042, w = 0.044, y0 = top + 0.01;
    box(g, w, 0.005, 0.05, 0, y0 + h, z, metal); box(g, 0.005, h, 0.05, -w / 2, y0 + h / 2, z, metal); box(g, 0.005, h, 0.05, w / 2, y0 + h / 2, z, metal);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.005, h - 0.004), new THREE.MeshBasicMaterial({ color: "#ff5040", transparent: true, opacity: 0.12, depthWrite: false }));
    glass.position.set(0, y0 + h / 2, z - 0.02); g.add(glass);
    sightY = y0 + h / 2;
  } else {
    // スコープ: 筒・前後のふくらみ・2 つの台
    const r = SCOPE_R[sc], len = [0, 0.13, 0.2, 0.28][sc], cy = top + r + 0.014, z = -0.11;
    cyl(g, r, len, 0, cy, z, metal, "z", 14);
    cyl(g, r * 1.35, 0.045, 0, cy, z - len / 2 - 0.02, metal, "z", 14);
    cyl(g, r * 1.2, 0.04, 0, cy, z + len / 2 + 0.018, metal, "z", 14);
    for (const dz of [-len * 0.3, len * 0.3]) box(g, 0.016, cy - top, 0.02, 0, top + (cy - top) / 2, z + dz, mid);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 14), new THREE.MeshBasicMaterial({ color: "#7fd0ff", transparent: true, opacity: 0.55 }));
    lens.position.set(0, cy, z - len / 2 - 0.043); lens.rotation.y = Math.PI; g.add(lens);
    if (sc === 3) cyl(g, 0.008, 0.02, r + 0.004, cy, z, mid, "x", 8);   // 8 倍は調整つまみ
    sightY = cy;
  }
  if (mz === 4) { cyl(g, 0.017, 0.07, 0, 0.04, muzzle - 0.035, mid, "z", 8); cyl(g, 0.018, 0.012, 0, 0.04, muzzle - 0.05, metal, "z", 8); muzzle -= 0.07; }
  if (mz === 5) { cyl(g, 0.023, 0.2, 0, 0.04, muzzle - 0.1, metal, "z", 14); muzzle -= 0.2; }
  if ((gr === 6 || gr === 7) && M.grip) {
    const [gz, gy] = M.grip;
    if (gr === 6) box(g, 0.026, 0.085, 0.03, 0, gy - 0.0425, gz, poly);
    else box(g, 0.026, 0.045, 0.085, 0, gy - 0.02, gz, poly).rotation.x = -0.45;
  }
  if (mg === 8 && M.mag) box(g, 0.038, 0.07, 0.06, 0, M.mag[0] - 0.03, M.mag[1], trim);   // 拡張マガジン（つぎ足した分はレア度の色）
  g.userData.muzzle = new THREE.Vector3(0, 0.04, muzzle);
  g.userData.sightY = sightY;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- 落ちているもの ----
const itemCache = new Map();
/** icon: 持ち物の欄に出す絵用（ベストを寝かせずに立てる） */
export function itemMesh(code, stickerTex, icon = false) {
  const key = code + (icon ? ":i" : "");
  if (!itemCache.has(key)) itemCache.set(key, buildItem(code, stickerTex, icon));
  return itemCache.get(key).clone();
}

function buildItem(code, stickerTex, icon) {
  const it = itemInfo(code);
  const g = new THREE.Group();
  const lvMat = lv => (lv === 3 ? GOLD() : mat(LEVEL_COLORS[lv]));
  switch (it.kind) {
    case "weapon": {
      const gun = buildGun(it.sub, stickerTex);
      gun.rotation.z = Math.PI / 2;   // 横に寝かせる
      gun.position.y = 0.08;
      g.add(gun);
      break;
    }
    case "ammo": {
      box(g, 0.34, 0.18, 0.22, 0, 0.09, 0, mat("#4b5320"));
      box(g, 0.345, 0.05, 0.225, 0, 0.12, 0, mat(AMMO[it.sub].color));
      for (let i = 0; i < 4; i++) cyl(g, 0.018, 0.09, -0.12 + i * 0.08, 0.22, 0, mat("#d8b45a"), "y", 6);
      break;
    }
    case "heal": {
      const mk = HEALS[it.sub].stk;
      if (it.sub === 0) {
        // 包帯: ロール 2 つ。手前のロールのラベルに「寝る子は育つ」
        cyl(g, 0.07, 0.12, -0.06, 0.07, 0, mat("#f5f0e6"), "y", 12);
        cyl(g, 0.07, 0.12, 0.08, 0.07, 0.03, mat("#f5f0e6"), "y", 12);
        box(g, 0.2, 0.01, 0.05, 0.01, 0.135, 0.015, mat("#d9c7a0"));
        decal(g, mk, 0.11, 0.09, -0.06, 0.07, 0.072);
      } else if (it.sub === 1) {
        // 救急キット: 赤十字の横に「母は偉大なり！」
        box(g, 0.38, 0.24, 0.14, 0, 0.12, 0, mat("#f7f7f7"));
        for (const s of [-1, 1]) {
          const cx = s > 0 ? -0.09 : 0;
          box(g, 0.13, 0.04, 0.01, cx, 0.12, s * 0.072, mat("#e0302a")); box(g, 0.04, 0.13, 0.01, cx, 0.12, s * 0.072, mat("#e0302a"));
        }
        box(g, 0.12, 0.03, 0.04, 0, 0.255, 0, mat("#888"));
        decal(g, mk, 0.15, 0.125, 0.085, 0.12, 0.0715);
      } else {
        // ドリンク: 缶のラベルに「今日はチートデイ」
        cyl(g, 0.06, 0.2, 0, 0.1, 0, mat("#ff8c1a"), "y", 14);
        cyl(g, 0.055, 0.015, 0, 0.205, 0, mat("#cfd3d6"), "y", 14);
        cyl(g, 0.061, 0.06, 0, 0.1, 0, mat("#ffd23d"), "y", 14);
        decal(g, mk, 0.1, 0.083, 0, 0.11, 0.063);
      }
      break;
    }
    case "helmet": {
      const m = lvMat(it.sub);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
      dome.position.y = 0.05; g.add(dome);
      cyl(g, 0.23, 0.03, 0, 0.05, 0, m, "y", 18);
      if (it.sub >= 2) box(g, 0.06, 0.05, 0.04, 0, 0.2, -0.17, mat("#222"));   // 暗視の台
      decal(g, MARK.helmet, 0.15, 0.125, 0, 0.13, 0.168, 0, -0.55);           // 前に「不可能です！」
      break;
    }
    case "vest": {
      const m = lvMat(it.sub);
      box(g, 0.44, 0.5, 0.22, 0, 0.3, 0, m);
      for (const s of [-1, 1]) box(g, 0.08, 0.14, 0.2, s * 0.14, 0.6, 0, m);
      box(g, 0.3, 0.1, 0.23, 0, 0.2, 0, mat("#2f3524"));
      decal(g, MARK.vest, 0.2, 0.165, 0, 0.39, 0.112);                         // 胸に「座禅する！」
      if (icon) return finish(g);
      g.rotation.x = -Math.PI / 2 + 0.2; g.position.y = 0;
      const w = new THREE.Group(); w.add(g); w.position.y = 0.12;
      return finish(w);
    }
    case "pack": {
      const m = lvMat(it.sub);
      box(g, 0.36, 0.44, 0.2, 0, 0.22, 0, m);
      box(g, 0.28, 0.16, 0.08, 0, 0.14, 0.13, it.sub === 3 ? mat("#c8962a") : mat("#5a4632"));
      for (const s of [-1, 1]) box(g, 0.05, 0.36, 0.03, s * 0.1, 0.24, -0.11, mat("#333"));
      decal(g, MARK.pack, 0.17, 0.14, 0, 0.15, 0.172);                         // ポケットに「準備完了！」
      break;
    }
    case "att": {
      const metal = mat("#2b2d31"), mid = mat("#4a4f57");
      const k = it.sub;
      if (k === 0) {
        box(g, 0.05, 0.015, 0.09, 0, 0.0075, 0, metal);
        box(g, 0.06, 0.008, 0.06, 0, 0.068, 0, metal); box(g, 0.008, 0.06, 0.06, -0.03, 0.04, 0, metal); box(g, 0.008, 0.06, 0.06, 0.03, 0.04, 0, metal);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.05), new THREE.MeshBasicMaterial({ color: "#ff5040", transparent: true, opacity: 0.35 }));
        gl.position.set(0, 0.04, 0.02); g.add(gl);
      } else if (k <= 3) {
        const r = SCOPE_R[k] * 1.6, len = [0, 0.13, 0.2, 0.28][k] * 1.5;
        cyl(g, r, len, 0, r + 0.02, 0, metal, "z", 14);
        cyl(g, r * 1.35, 0.06, 0, r + 0.02, -len / 2 - 0.03, metal, "z", 14);
        cyl(g, r * 1.2, 0.05, 0, r + 0.02, len / 2 + 0.025, metal, "z", 14);
        for (const dz of [-len * 0.3, len * 0.3]) box(g, 0.025, 0.03, 0.03, 0, 0.012, dz, mid);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 14), new THREE.MeshBasicMaterial({ color: "#7fd0ff" }));
        lens.position.set(0, r + 0.02, len / 2 + 0.051); g.add(lens);
      } else if (k === 4) {
        cyl(g, 0.035, 0.14, 0, 0.035, 0, mid, "z", 10);
        for (let i = 0; i < 3; i++) box(g, 0.072, 0.012, 0.012, 0, 0.035, -0.04 + i * 0.04, metal);
      } else if (k === 5) {
        cyl(g, 0.045, 0.36, 0, 0.045, 0, metal, "z", 16);
        cyl(g, 0.047, 0.02, 0, 0.045, 0.17, mid, "z", 16);
      } else if (k === 6) {
        box(g, 0.05, 0.17, 0.06, 0, 0.085, 0, mat("#3b3a36"));
        box(g, 0.06, 0.02, 0.1, 0, 0.17, 0, metal);
      } else if (k === 7) {
        box(g, 0.05, 0.08, 0.16, 0, 0.05, 0, mat("#3b3a36")).rotation.x = -0.45;
        box(g, 0.06, 0.02, 0.12, 0, 0.11, 0.02, metal);
      } else {
        box(g, 0.07, 0.24, 0.1, 0, 0.12, 0, metal).rotation.x = 0.15;
        box(g, 0.072, 0.06, 0.102, 0, 0.21, 0.012, GOLD());
      }
      decal(g, it.stk, 0.08, 0.066, 0, 0.09, 0.08);
      break;
    }
    case "grenade": {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat("#3d6b3a")); s.position.y = 0.08; g.add(s);
      box(g, 0.02, 0.06, 0.03, 0, 0.16, 0, mat("#999"));
      box(g, 0.015, 0.1, 0.02, 0.03, 0.12, 0, mat("#bbb"));
      break;
    }
    case "detect": {
      box(g, 0.16, 0.26, 0.06, 0, 0.13, 0, mat("#222"));
      box(g, 0.12, 0.12, 0.01, 0, 0.17, -0.031, mat("#2bff8a", { emissive: "#0a8a40" }));
      cyl(g, 0.008, 0.18, 0.05, 0.34, 0, mat("#bbb"), "y", 6);
      box(g, 0.165, 0.02, 0.065, 0, 0.27, 0, GOLD());
      box(g, 0.165, 0.02, 0.065, 0, 0.0, 0, GOLD());
      if (stickerTex) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.1), new THREE.MeshBasicMaterial({ map: stickerTex(DETECT.stk), transparent: true }));
        d.position.set(0, 0.06, -0.032); d.rotation.y = Math.PI; g.add(d);
      }
      break;
    }
  }
  return finish(g);
}
function finish(g) { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }

// ---- 人型のキャラ ----
/**
 * 人型を作る。shirt: 服の色 / headMat: 頭（かぶりもの）の前後に貼るステッカーのマテリアル
 * 戻り値の各部を posePerson で動かす
 */
export function humanoid(shirt, headMat) {
  const skin = mat("#f0c9a0"), pants = mat("#3a3f4a"), shoe = mat("#2a2420"), cloth = mat(shirt), white = mat("#ffffff");
  const root = new THREE.Group();
  const pose = new THREE.Group(); root.add(pose);
  const hips = new THREE.Group(); hips.position.y = 0.92; pose.add(hips);
  box(hips, 0.34, 0.16, 0.2, 0, 0, 0, pants);
  const leg = s => {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.1, -0.03, 0); hips.add(thigh);
    box(thigh, 0.14, 0.44, 0.16, 0, -0.22, 0, pants);
    const knee = new THREE.Group(); knee.position.y = -0.44; thigh.add(knee);
    box(knee, 0.12, 0.42, 0.13, 0, -0.21, 0, pants);
    box(knee, 0.13, 0.07, 0.25, 0, -0.43, -0.05, shoe);
    return { thigh, knee };
  };
  const L = leg(-1), Rg = leg(1);
  const upper = new THREE.Group(); upper.position.y = 0.06; hips.add(upper);
  box(upper, 0.4, 0.5, 0.22, 0, 0.27, 0, cloth);
  cyl(upper, 0.06, 0.08, 0, 0.56, 0, skin, "y", 8);
  const headG = new THREE.Group(); headG.position.y = 0.6; upper.add(headG);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.36), [white, white, white, white, headMat, headMat]);
  head.position.y = 0.18; headG.add(head);
  const helmet = new THREE.Group(); headG.add(helmet);
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.26, 0.47, 0); sh.rotation.order = "YXZ"; upper.add(sh);
    box(sh, 0.11, 0.3, 0.12, 0, -0.15, 0, cloth);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    box(el, 0.09, 0.28, 0.1, 0, -0.14, 0, skin);
    box(el, 0.09, 0.09, 0.1, 0, -0.31, 0, skin);
    return { sh, el };
  };
  const LA = arm(-1), RA = arm(1);
  const gun = new THREE.Group(); gun.position.set(0.1, 0.36, -0.2); upper.add(gun);
  const vest = new THREE.Group(); upper.add(vest);
  const pack = new THREE.Group(); upper.add(pack);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, pose, hips, upper, headG, head, helmet, vest, pack, gun, L, R: Rg, LA, RA, eq: -1 };
}

/** 装備の見た目（レベルで色が変わる）。eq = ヘルメット + ベスト×4 + バッグ×16 */
export function dressPerson(H, eq) {
  if (H.eq === eq) return;
  H.eq = eq;
  for (const g of [H.helmet, H.vest, H.pack]) g.clear();
  const h = eq & 3, v = (eq >> 2) & 3, p = (eq >> 4) & 3;
  const lv = l => (l === 3 ? GOLD() : mat(LEVEL_COLORS[l]));
  if (h) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lv(h));
    dome.scale.set(1, 0.55, 0.9); dome.position.y = 0.36; H.helmet.add(dome);
    decal(H.helmet, MARK.helmet, 0.17, 0.14, 0, 0.43, -0.235, Math.PI, -0.5);
  }
  if (v) {
    box(H.vest, 0.44, 0.36, 0.27, 0, 0.3, 0, lv(v));
    for (const s of [-1, 1]) box(H.vest, 0.09, 0.08, 0.26, s * 0.13, 0.5, 0, lv(v));
    decal(H.vest, MARK.vest, 0.2, 0.165, 0, 0.3, -0.137, Math.PI);
  }
  if (p) {
    box(H.pack, 0.34, 0.42 + p * 0.04, 0.16, 0, 0.28, 0.2, lv(p));
    box(H.pack, 0.26, 0.14, 0.06, 0, 0.18, 0.3, p === 3 ? mat("#c8962a") : mat("#5a4632"));
    decal(H.pack, MARK.pack, 0.2, 0.165, 0, 0.38 + p * 0.02, 0.282);
  }
  for (const g of [H.helmet, H.vest, H.pack]) g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

/**
 * 姿勢をつける。f: { st, fl, pitch, hold }、walk: 歩きの位相、amp: 歩きの大きさ（0〜1）
 * st: 2 降下 / 3 パラシュート / 4 地上 / 5 死亡
 */
export function posePerson(H, f, walk, amp) {
  const crouch = (f.fl & 1) && f.st === 4;
  const pitch = f.pitch;
  H.pose.rotation.set(0, 0, 0); H.pose.position.set(0, 0, 0);
  H.hips.position.y = crouch ? 0.6 : 0.92;
  H.upper.rotation.x = crouch ? -0.25 : 0;
  H.headG.rotation.x = pitch * 0.5;
  const sw = Math.sin(walk) * 0.6 * amp;
  const set = (o, x, y = 0, z = 0) => o.rotation.set(x, y, z);
  // 脚
  if (crouch) {
    set(H.L.thigh, 1.25 + sw * 0.3); set(H.L.knee, -2.0);
    set(H.R.thigh, 1.0 - sw * 0.3); set(H.R.knee, -1.7);
  } else {
    set(H.L.thigh, sw); set(H.L.knee, -(1 - Math.cos(walk)) * 0.4 * amp);
    set(H.R.thigh, -sw); set(H.R.knee, -(1 + Math.cos(walk)) * 0.4 * amp);
  }
  // 腕
  if (f.st === 2) {
    H.pose.rotation.x = -1.35;
    set(H.LA.sh, 0, 0, -1.3); set(H.RA.sh, 0, 0, 1.3); set(H.LA.el, 0.4); set(H.RA.el, 0.4);
    set(H.L.thigh, 0.1, 0, -0.25); set(H.R.thigh, 0.1, 0, 0.25); set(H.L.knee, -0.6); set(H.R.knee, -0.6);
  } else if (f.st === 3) {
    set(H.LA.sh, Math.PI - 0.3, 0, -0.4); set(H.RA.sh, Math.PI - 0.3, 0, 0.4); set(H.LA.el, 0.3); set(H.RA.el, 0.3);
    set(H.L.thigh, 0.3); set(H.R.thigh, 0.1); set(H.L.knee, -0.4); set(H.R.knee, -0.3);
  } else if (f.st === 5) {
    H.pose.rotation.x = Math.PI / 2; H.pose.position.y = 0.15;
    set(H.LA.sh, 0, 0, -0.8); set(H.RA.sh, 0, 0, 0.9); set(H.LA.el, 0.2); set(H.RA.el, 0.3);
  } else if (f.hold === W_GRENADE) {
    set(H.RA.sh, 2.6, 0, 0.2); set(H.RA.el, 0.7);
    set(H.LA.sh, 1.0, -0.3); set(H.LA.el, 0.5);
  } else if (f.hold > 0) {
    // 銃を構える
    set(H.RA.sh, 0.75 + pitch * 0.8, 0.2); set(H.RA.el, 1.15);
    set(H.LA.sh, 1.35 + pitch, -0.75); set(H.LA.el, 0.35);
  } else {
    // 素手（ファイティングポーズ）
    set(H.RA.sh, 0.9 + sw * 0.2, 0.15); set(H.RA.el, 1.7);
    set(H.LA.sh, 0.9 - sw * 0.2, -0.15); set(H.LA.el, 1.7);
  }
  H.gun.rotation.x = pitch;
  H.gun.visible = f.st === 4 && f.hold > 0 && f.hold !== W_GRENADE;
}
