// マップ。シードから決まる（ホストはシードだけを送り、全員が同じマップを手元で作る）。
//   地形: 160×160 マスの高さ（1 マス 4m、全体 640m 四方）。島の形で、まわりは海
//   名所: まん中の町の広場（ハス君像と鳥居）・見張り台・巨大看板・ジャンプ台・町をつなぐ道
//   建物・木・岩・コンテナ: 軸にそろった箱（AABB）の当たり判定
//   落ちているもの: 建物の中を中心に置く（番号は 0 から順。ホストと全員で同じ）
// 決定的にするため Math.sin などは使わない（四則演算・sqrt・floor だけ）。

import { rng, clamp, smooth, lerp } from "./util.js";
import { IT, WEAPONS, AMMO_STACK } from "./items.js";

export const HALF = 320;
export const N = 160;
const SC = HALF / 256;   // 最初の 512m の島からの拡大率
export const CELL = (HALF * 2) / N;
export const WATER = 0;
export const GRID = 16;                   // 当たり判定の箱を入れる区画（m）
const GN = (HALF * 2) / GRID;
export const PLAYER_R = 0.35;
export const STAND_H = 1.75, CROUCH_H = 1.45;
export const PAD_JUMP = 24;   // ジャンプ台で飛び上がる速さ（m/s。約 14m の高さ = 2 階建ての屋根より上）
export const STEP = 0.5;
export const GRAVITY = 20;

// 箱の種類（見た目と、弾が当たった時の演出）
export const K = { WALL: 0, ROOF: 1, FLOOR: 2, STAIR: 3, CRATE: 4, CONTAINER: 5, ROCK: 6, TRUNK: 7, PAD: 8, RED: 9, STONE: 10, WOOD: 11, BOARD: 12 };

function hash2(ix, iz, s) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
function fbm(x, z, s, oct) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, z * f, s + i * 101) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return v / tot;
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.heights = new Float32Array((N + 1) * (N + 1));
    this.boxes = [];
    this.buildings = [];
    this.posters = [];
    this.trees = [];
    this.rocks = [];
    this.bushes = [];
    this.loot = [];
    this.pads = [];
    this.roads = [];
    this.maxH = 0;
    this.generate();
    this.buildGrid();
  }

  // ---- 地形 ----
  hIdx(ix, iz) { return iz * (N + 1) + ix; }

  /** メッシュの三角形と同じ分け方で補間した高さ（見た目と当たり判定を一致させる） */
  heightAt(x, z) {
    const gx = clamp((x + HALF) / CELL, 0, N - 1e-6), gz = clamp((z + HALF) / CELL, 0, N - 1e-6);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const H = this.heights, i = iz * (N + 1) + ix;
    const h00 = H[i], h10 = H[i + 1], h01 = H[i + N + 1], h11 = H[i + N + 2];
    if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    return h00 + (h01 - h00) * fz + (h11 - h01) * fx;
  }

  generate() {
    const R = rng(this.seed);
    const s = Math.floor(R() * 100000);
    const H = this.heights;
    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const x = ix * CELL - HALF, z = iz * CELL - HALF;
        const d = Math.sqrt(x * x + z * z) / HALF;
        const wob = (fbm(x / 90, z / 90, s + 7, 3) - 0.5) * 0.25;
        const edge = smooth(0.66, 0.97, d + wob);
        const hills = fbm(x / 140, z / 140, s, 4);
        const bumps = fbm(x / 35, z / 35, s + 3, 2);
        let h = 3 + Math.max(0, hills - 0.42) * 70 + bumps * 3;
        h = h * (1 - edge) - 7 * edge;
        H[iz * (N + 1) + ix] = Math.max(-7, h);
      }
    }
    this.placeBuildings(R, s);
    this.placeLandmarks(R);
    this.placeNature(R, s);
    this.placeLoot(R);
    for (let i = 0; i < H.length; i++) this.maxH = Math.max(this.maxH, H[i]);
  }

  /** 建物の下を平らにする（rect は外形、まわり 2m は同じ高さ、その外 5m でなじませる） */
  flatten(x0, z0, x1, z1, base) {
    const H = this.heights;
    const ix0 = Math.max(0, Math.floor((x0 - 8 + HALF) / CELL)), ix1 = Math.min(N, Math.ceil((x1 + 8 + HALF) / CELL));
    const iz0 = Math.max(0, Math.floor((z0 - 8 + HALF) / CELL)), iz1 = Math.min(N, Math.ceil((z1 + 8 + HALF) / CELL));
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const x = ix * CELL - HALF, z = iz * CELL - HALF;
        const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
        const d = Math.sqrt(dx * dx + dz * dz);
        const t = smooth(2, 7, d);
        const i = iz * (N + 1) + ix;
        H[i] = lerp(base, H[i], t);
      }
    }
  }

  footprintOk(x0, z0, x1, z1) {
    let lo = 1e9, hi = -1e9;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) {
      for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 3) {
        const h = this.heightAt(x, z);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
    }
    if (lo < 1.2 || hi - lo > 7) return null;
    for (const b of this.buildings) {
      if (x0 < b.x1 + 7 && x1 > b.x0 - 7 && z0 < b.z1 + 7 && z1 > b.z0 - 7) return null;
    }
    return (lo + hi) / 2;
  }

  // ---- 建物 ----
  placeBuildings(R) {
    const towns = [];
    for (let tries = 0; towns.length < 7 && tries < 600; tries++) {
      const x = (R() * 2 - 1) * 175 * SC, z = (R() * 2 - 1) * 175 * SC;
      if (x * x + z * z > (190 * SC) ** 2) continue;
      if (this.heightAt(x, z) < 2) continue;
      if (towns.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 105 * 105)) continue;
      towns.push({ x, z });
    }
    // いちばんまん中に近い町を「広場の町」にする
    towns.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));
    this.towns = towns;
    if (towns[0]) this.plaza(R, towns[0].x, towns[0].z);
    towns.forEach((t, ti) => {
      let wh = 0;
      for (let gx = -1; gx <= 1; gx++) {
        for (let gz = -1; gz <= 1; gz++) {
          if (ti === 0 && gx === 0 && gz === 0) continue;   // 広場
          if (R() < 0.25) continue;
          const r = R();
          const type = r < 0.5 ? "house" : r < 0.78 || wh ? "two" : "warehouse";
          if (type === "warehouse") wh = 1;
          this.tryBuilding(R, type, t.x + gx * 27 + (R() - 0.5) * 3, t.z + gz * 27 + (R() - 0.5) * 3);
        }
      }
      // コンテナを少し
      for (let i = 0; i < 3; i++) {
        const a = R() * 4 | 0;
        const cx = t.x + (R() - 0.5) * 80, cz = t.z + (R() - 0.5) * 80;
        this.tryContainer(R, cx, cz, a & 1);
      }
    });
    // ぽつんと 1 軒
    for (let i = 0, tries = 0; i < 22 && tries < 500; tries++) {
      const x = (R() * 2 - 1) * 210 * SC, z = (R() * 2 - 1) * 210 * SC;
      if (x * x + z * z > (215 * SC) ** 2) continue;
      if (this.tryBuilding(R, R() < 0.7 ? "house" : "two", x, z)) i++;
    }
  }

  tryContainer(R, cx, cz, along) {
    const w = along ? 2.5 : 6.2, d = along ? 6.2 : 2.5;
    const base = this.footprintOk(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    if (base === null) return;
    this.flatten(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, base);
    const color = (R() * 4) | 0;
    this.boxes.push(box(cx - w / 2, base - 1, cz - d / 2, cx + w / 2, base + 2.6, cz + d / 2, K.CONTAINER, color));
    this.buildings.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, base, solid: true, doors: [], spots: [] });
  }

  tryBuilding(R, type, cx, cz) {
    const rot = (R() * 4) | 0;
    const [w, d] = type === "house" ? [8 + ((R() * 3) | 0), 8 + ((R() * 2) | 0)] : type === "two" ? [10, 8] : [16, 12];
    const [ww, dd] = rot & 1 ? [d, w] : [w, d];
    const x0 = cx - ww / 2, x1 = cx + ww / 2, z0 = cz - dd / 2, z1 = cz + dd / 2;
    const base = this.footprintOk(x0, z0, x1, z1);
    if (base === null) return false;
    this.flatten(x0, z0, x1, z1, base);
    const color = (R() * 6) | 0;
    const b = { x0, z0, x1, z1, base, type, rot, color, doors: [], spots: [], stairs: null, floor2: null };
    // ローカル座標（扉は +z 側）→ 世界座標
    const tp = (lx, lz) => rot === 0 ? [cx + lx, cz + lz] : rot === 1 ? [cx + lz, cz - lx] : rot === 2 ? [cx - lx, cz - lz] : [cx - lz, cz + lx];
    const B = (lx0, y0, lz0, lx1, y1, lz1, k) => {
      const [ax, az] = tp(lx0, lz0), [bx, bz] = tp(lx1, lz1);
      this.boxes.push(box(Math.min(ax, bx), base + y0, Math.min(az, bz), Math.max(ax, bx), base + y1, Math.max(az, bz), k, color));
    };
    const T = 0.3, hw = w / 2, hd = d / 2;
    // 壁。ops は開口部の列 { a, b（壁にそった範囲）, gaps: [[下, 上], ...] }
    const column = (yb, yt, gaps, put) => {
      let y = yb;
      for (const [lo, hi] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (lo > y) put(y, lo); y = Math.max(y, hi); }
      if (y < yt) put(y, yt);
    };
    const wallX = (z0_, z1_, yb, yt, ops) => {   // x 方向にのびる壁
      let cur = -hw;
      for (const o of ops.slice().sort((p, q) => p.a - q.a)) {
        if (o.a > cur) B(cur, yb, z0_, o.a, yt, z1_, K.WALL);
        column(yb, yt, o.gaps, (lo, hi) => B(o.a, lo, z0_, o.b, hi, z1_, K.WALL));
        cur = o.b;
      }
      if (cur < hw) B(cur, yb, z0_, hw, yt, z1_, K.WALL);
    };
    const wallZ = (x0_, x1_, yb, yt, ops) => {   // z 方向にのびる壁（端は x 方向の壁と重ならないように）
      let cur = -hd + T;
      for (const o of ops.slice().sort((p, q) => p.a - q.a)) {
        if (o.a > cur) B(x0_, yb, cur, x1_, yt, o.a, K.WALL);
        column(yb, yt, o.gaps, (lo, hi) => B(x0_, lo, o.a, x1_, hi, o.b, K.WALL));
        cur = o.b;
      }
      if (cur < hd - T) B(x0_, yb, cur, x1_, yt, hd - T, K.WALL);
    };
    const F = 0.2;   // 1 階の床の高さ
    B(-hw, -1.5, -hd, hw, F, hd, K.FLOOR);
    const posterAt = (lx, y, lz, nlx, nlz) => {
      const [px, pz] = tp(lx, lz), [nx, nz] = tp(nlx, nlz), [ox, oz] = tp(0, 0);
      this.posters.push({ x: px, y: base + y, z: pz, nx: nx - ox, nz: nz - oz, s: (R() * 24) | 0, w: 1.6, h: 1.3 });
    };

    if (type === "house" || type === "two") {
      const top = type === "house" ? 3.2 : 6.6;
      const doorX = (R() - 0.5) * (w - 4);
      const levels = type === "house" ? [F] : [F, 3.5];
      const winGaps = levels.map(y => [y + 1, y + 2.2]);
      // 扉の側（+z）。2 階建ては扉の上に 2 階の窓
      const doorGaps = [[F, F + 2.3]];
      if (type === "two") doorGaps.push([3.5 + 1.0, 3.5 + 2.2]);
      wallX(hd - T, hd, F, top, [{ a: doorX - 0.7, b: doorX + 0.7, gaps: doorGaps }]);
      // 裏（-z）: 窓を左右に、まん中にポスター
      const back = [{ a: -hw / 2 - 0.6, b: -hw / 2 + 0.6, gaps: winGaps }];
      if (type === "house") back.push({ a: hw / 2 - 0.6, b: hw / 2 + 0.6, gaps: winGaps });
      wallX(-hd, -hd + T, F, top, back);
      wallZ(-hw, -hw + T, F, top, [{ a: -0.7, b: 0.7, gaps: winGaps }]);
      wallZ(hw - T, hw, F, top, [{ a: -0.7, b: 0.7, gaps: winGaps }]);
      posterAt(type === "house" ? 0 : hw / 4, 1.9, -hd - 0.02, 0, -1);
      posterAt(-hw - 0.02, 1.9 + (type === "two" ? 3.3 : 0), hd / 2 - 0.2, -1, 0);
      B(-hw - 0.3, top, -hd - 0.3, hw + 0.3, top + 0.3, hd + 0.3, K.ROOF);
      const [dox, doz] = tp(doorX, hd + 1.4), [dix, diz] = tp(doorX, hd - 1.2);
      b.doors.push({ ox: dox, oz: doz, ix: dix, iz: diz });
      const spots = [];
      if (type === "two") {
        // 階段: 裏の壁ぞい、-x 側から +x 側へ上がる
        // 階段: 裏の壁ぞい。側壁から 1m あけて始まり、+x へ上がる（上りきったら手前（+z）の 2 階の床へ出る）
        const n = 11, run = 0.42, sx = -hw + T + 1.0, sz0 = -hd + T, sz1 = -hd + T + 1.2;
        for (let i = 0; i < n; i++) B(sx + i * run, F, sz0, sx + (i + 1) * run, F + 0.3 * (i + 1), sz1, K.STAIR);
        const ex = sx + n * run, mz = (sz0 + sz1) / 2;
        // 2 階の床（階段の上は穴）
        B(-hw + T, 3.2, sz1, hw - T, 3.5, hd - T, K.FLOOR);
        B(ex, 3.2, -hd + T, hw - T, 3.5, sz1, K.FLOOR);
        B(-hw + T, 3.2, -hd + T, sx, 3.5, sz1, K.FLOOR);
        // CPU の道: 下 → 階段の上の端 → 2 階の床
        b.stairs = [tp(sx - 0.5, mz), tp(ex - 0.3, mz), tp(ex - 0.3, sz1 + 0.8)];
        b.floor2 = base + 3.5;
        for (let i = 0; i < 2 + ((R() * 2) | 0); i++) spots.push([1, lerp(-hw + 1.2, hw - 1.2, R()), lerp(sz1 + 0.6, hd - 1.2, R())]);
        for (let i = 0; i < 2 + ((R() * 2) | 0); i++) spots.push([0, lerp(-hw + 1.2, hw - 1.2, R()), lerp(sz1 + 0.6, hd - 1.2, R())]);
      } else {
        for (let i = 0; i < 2 + ((R() * 3) | 0); i++) spots.push([0, lerp(-hw + 1.2, hw - 1.2, R()), lerp(-hd + 1.2, hd - 1.2, R())]);
      }
      for (const [fl, lx, lz] of spots) { const [x, z] = tp(lx, lz); b.spots.push({ x, y: base + (fl ? 3.5 : F), z, fl }); }
    } else {
      // 倉庫: 前後に大きな入口、高い窓、中に木箱
      const top = 6;
      const big = [{ a: -2, b: 2, gaps: [[F, F + 4.2]] }];
      wallX(hd - T, hd, F, top, big);
      wallX(-hd, -hd + T, F, top, big);
      const hi = [{ a: -3, b: -1.4, gaps: [[3.5, 4.7]] }, { a: 1.4, b: 3, gaps: [[3.5, 4.7]] }];
      wallZ(-hw, -hw + T, F, top, hi);
      wallZ(hw - T, hw, F, top, hi);
      B(-hw - 0.3, top, -hd - 0.3, hw + 0.3, top + 0.35, hd + 0.3, K.ROOF);
      posterAt(-hw / 2, 3.2, hd + 0.02, 0, 1);
      posterAt(hw / 2, 3.2, -hd - 0.02, 0, -1);
      const crates = [[-5, -3], [5, 2.5], [-4.5, 3], [4, -3.5], [0, 0]];
      for (const [cx2, cz2] of crates) {
        if (R() < 0.25) continue;
        const sz = 1.1 + R() * 0.3;
        B(cx2 - sz / 2, F, cz2 - sz / 2, cx2 + sz / 2, F + sz, cz2 + sz / 2, K.CRATE);
        if (R() < 0.6) { const [x, z] = tp(cx2, cz2); b.spots.push({ x, y: base + F + sz, z, fl: 2 }); }
      }
      for (let i = 0; i < 4 + ((R() * 3) | 0); i++) {
        const lx = lerp(-hw + 1.4, hw - 1.4, R()), lz = lerp(-hd + 1.4, hd - 1.4, R());
        if (crates.some(([a, c]) => Math.abs(a - lx) < 1.4 && Math.abs(c - lz) < 1.4)) continue;
        const [x, z] = tp(lx, lz);
        b.spots.push({ x, y: base + F, z, fl: 0 });
      }
      for (const sgn of [1, -1]) {
        const [dox, doz] = tp(0, sgn * (hd + 1.6)), [dix, diz] = tp(0, sgn * (hd - 1.4));
        b.doors.push({ ox: dox, oz: doz, ix: dix, iz: diz });
      }
    }
    this.buildings.push(b);
    return true;
  }

  // ---- 名所 ----
  /** 広場: 巨大なハス君像（両面のステッカー）と鳥居、ジャンプ台 */
  plaza(R, x, z) {
    const base = this.heightAt(x, z);
    this.flatten(x - 9, z - 10, x + 9, z + 13, base);
    const B = (x0, y0, z0, x1, y1, z1, k) => this.boxes.push(box(x + x0, base + y0, z + z0, x + x1, base + y1, z + z1, k, 0));
    B(-3, -1, -3, 3, 1.4, 3, K.STONE);                     // 台座
    B(-3.6, 1.4, -0.2, 3.6, 7.4, 0.2, K.BOARD);            // 像（大きなパネル）
    this.posters.push({ x, y: base + 4.4, z: z + 0.22, nx: 0, nz: 1, s: (R() * 24) | 0, w: 7, h: 5.8 });
    this.posters.push({ x, y: base + 4.4, z: z - 0.22, nx: 0, nz: -1, s: (R() * 24) | 0, w: 7, h: 5.8 });
    // 鳥居
    for (const sx of [-1, 1]) B(sx * 2.4 - 0.3, -1, 9 - 0.3, sx * 2.4 + 0.3, 5.2, 9 + 0.3, K.RED);
    B(-3.5, 5.2, 9 - 0.45, 3.5, 5.65, 9 + 0.45, K.RED);
    B(-2.9, 4.1, 9 - 0.2, 2.9, 4.4, 9 + 0.2, K.RED);
    this.buildings.push({ x0: x - 9, z0: z - 10, x1: x + 9, z1: z + 13, base, solid: true, plaza: true, doors: [], spots: [
      { x: x - 4.5, y: base, z: z - 5, fl: 0, good: true }, { x: x + 4.5, y: base, z: z - 5, fl: 0, good: true }] });
    for (const sx of [-1, 1]) this.addPad(x + sx * 6.5, z + 4.5, base);
  }

  /** ジャンプ台（乗ると高く跳ぶ。屋根の上に乗れる） */
  addPad(x, z, base) {
    if (base === undefined) base = Math.min(this.heightAt(x - 1.2, z - 1.2), this.heightAt(x + 1.2, z + 1.2), this.heightAt(x - 1.2, z + 1.2), this.heightAt(x + 1.2, z - 1.2));
    this.boxes.push(box(x - 1.2, base - 1, z - 1.2, x + 1.2, base + 0.3, z + 1.2, K.PAD, 0));
    this.pads.push({ x, z, y: base + 0.3 });
  }

  placeLandmarks(R) {
    const free = (x0, z0, x1, z1, m) => !this.buildings.some(b => x0 < b.x1 + m && x1 > b.x0 - m && z0 < b.z1 + m && z1 > b.z0 - m);
    // 見張り台
    for (let i = 0, tries = 0; i < 6 && tries < 500; tries++) {
      const x = (R() * 2 - 1) * 230 * SC, z = (R() * 2 - 1) * 230 * SC;
      if (x * x + z * z > (235 * SC) ** 2) continue;
      if (this.tryTower(R, x, z)) i++;
    }
    // 巨大看板
    for (let i = 0, tries = 0; i < 9 && tries < 500; tries++) {
      const x = (R() * 2 - 1) * 230 * SC, z = (R() * 2 - 1) * 230 * SC;
      const along = R() < 0.5;
      const [hx, hz] = along ? [3.6, 0.3] : [0.3, 3.6];
      if (!free(x - hx, z - hz, x + hx, z + hz, 6)) continue;
      const h0 = this.heightAt(x - hx, z - hz), h1 = this.heightAt(x + hx, z + hz);
      if (Math.min(h0, h1) < 1.5) continue;
      const base = Math.min(h0, h1);
      const P = (px, pz) => this.boxes.push(box(px - 0.2, base - 3, pz - 0.2, px + 0.2, base + 3.6, pz + 0.2, K.WOOD, 0));
      if (along) { P(x - 2.8, z); P(x + 2.8, z); } else { P(x, z - 2.8); P(x, z + 2.8); }
      this.boxes.push(box(x - hx, base + 3.6, z - hz, x + hx, base + 8.6, z + hz, K.BOARD, 0));
      for (const sg of [-1, 1]) {
        const nx = along ? 0 : sg, nz = along ? sg : 0;
        this.posters.push({ x: x + nx * 0.32, y: base + 6.1, z: z + nz * 0.32, nx, nz, s: (R() * 24) | 0, w: 6.8, h: 4.7 });
      }
      this.buildings.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, base, solid: true, doors: [], spots: [] });
      i++;
    }
    // ジャンプ台: 町に 1〜2 個、ほかに丘の上など
    const pad = (x, z, m) => {
      if (!free(x - 1.2, z - 1.2, x + 1.2, z + 1.2, m) || this.heightAt(x, z) < 1.5) return false;
      this.addPad(x, z);
      this.buildings.push({ x0: x - 1.2, z0: z - 1.2, x1: x + 1.2, z1: z + 1.2, base: 0, solid: true, doors: [], spots: [] });
      return true;
    };
    for (const t of this.towns.slice(1)) {
      const want = 1 + (R() < 0.5 ? 1 : 0);
      for (let k = 0, tries = 0; k < want && tries < 30; tries++) if (pad(t.x + (R() - 0.5) * 60, t.z + (R() - 0.5) * 60, 3)) k++;
    }
    for (let i = 0, tries = 0; i < 8 && tries < 300; tries++) if (pad((R() * 2 - 1) * 220 * SC, (R() * 2 - 1) * 220 * SC, 4)) i++;
    // 道: 町どうしを最小全域木でつなぐ（見た目だけ）
    const T = this.towns, used = [0];
    while (T.length && used.length < T.length) {
      let best = null;
      for (const a of used) for (let b = 0; b < T.length; b++) {
        if (used.includes(b)) continue;
        const d = (T[a].x - T[b].x) ** 2 + (T[a].z - T[b].z) ** 2;
        if (!best || d < best[2]) best = [a, b, d];
      }
      used.push(best[1]);
      this.roads.push([T[best[0]].x, T[best[0]].z, T[best[1]].x, T[best[1]].z]);
    }
  }

  /** 見張り台: 高さ 8m の台に、長い階段で上がる。上には良い武器 */
  tryTower(R, cx, cz) {
    const n = 27, run = 0.4, len = n * run;
    const x0 = cx - 1.8 - len - 0.8, x1 = cx + 1.8, z0 = cz - 1.8, z1 = cz + 1.8;
    const base = this.footprintOk(x0, z0, x1, z1);
    if (base === null) return false;
    this.flatten(x0, z0, x1, z1, base);
    const B = (a, y0, c, b, y1, d, k) => this.boxes.push(box(cx + a, base + y0, cz + c, cx + b, base + y1, cz + d, k, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(sx * 1.65 - 0.15, -1, sz * 1.65 - 0.15, sx * 1.65 + 0.15, 7.8, sz * 1.65 + 0.15, K.WOOD);
    B(-1.8, 7.8, -1.8, 1.8, 8.1, 1.8, K.WOOD);
    B(1.7, 8.1, -1.8, 1.8, 9.1, 1.8, K.WOOD);
    B(-1.8, 8.1, 1.7, 1.8, 9.1, 1.8, K.WOOD);
    B(-1.8, 8.1, -1.8, 1.8, 9.1, -1.7, K.WOOD);
    B(-1.8, 8.1, -1.8, -1.7, 9.1, -0.6, K.WOOD);
    B(-1.8, 8.1, 0.6, -1.7, 9.1, 1.8, K.WOOD);
    for (let i = 0; i < n; i++) B(-1.8 - (n - i) * run, -1, -0.6, -1.8 - (n - i - 1) * run, 0.3 * (i + 1), 0.6, K.STAIR);
    // 旗（ステッカー）
    B(1.6, 9.1, 1.6, 1.75, 12, 1.75, K.WOOD);
    this.posters.push({ x: cx + 1.78, y: base + 11.2, z: cz + 0.9, nx: 1, nz: 0, s: (R() * 24) | 0, w: 1.6, h: 1.3 });
    this.buildings.push({
      x0, z0, x1, z1, base, type: "tower", tower: true, doors: [], floor2: base + 8.1,
      stairs: [[cx - 1.8 - len - 0.6, cz], [cx - 1.95, cz], [cx, cz]],
      spots: [{ x: cx + 0.8, y: base + 8.1, z: cz - 0.8, fl: 1, good: true }, { x: cx + 0.8, y: base + 8.1, z: cz + 0.8, fl: 1, good: true }],
    });
    return true;
  }

  /** 点から道までの距離 */
  roadDist(x, z) {
    let best = 1e9;
    for (const [ax, az, bx, bz] of this.roads) {
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
      const dx = ax + vx * t - x, dz = az + vz * t - z;
      best = Math.min(best, dx * dx + dz * dz);
    }
    return Math.sqrt(best);
  }

  // ---- 木・岩・しげみ ----
  placeNature(R, s) {
    const near = (x, z, m) => this.buildings.some(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) || this.roadDist(x, z) < 4;
    const tg = new Map();
    const key = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
    for (let i = 0; i < 7000 && this.trees.length < 1000; i++) {
      const x = (R() * 2 - 1) * (HALF - 20), z = (R() * 2 - 1) * (HALF - 20);
      const h = this.heightAt(x, z);
      if (h < 1.5) continue;
      const dens = fbm(x / 60, z / 60, s + 11, 2);
      if (R() > (dens - 0.38) * 3.2) continue;
      if (near(x, z, 4)) continue;
      const k = key(x, z);
      if (tg.has(k)) continue;
      tg.set(k, 1);
      const sc = 0.8 + R() * 0.6;
      const kind = R() < 0.6 ? 0 : 1;
      this.trees.push({ x, z, y: h, s: sc, kind, c: R() });
      const tr = 0.22 * sc;
      this.boxes.push(box(x - tr, h - 1, z - tr, x + tr, h + 6 * sc, z + tr, K.TRUNK, 0));
    }
    for (let i = 0; i < 700 && this.rocks.length < 110; i++) {
      const x = (R() * 2 - 1) * (HALF - 30), z = (R() * 2 - 1) * (HALF - 30);
      const h = this.heightAt(x, z);
      if (h < 0.5 || near(x, z, 4)) continue;
      const sx = 1 + R() * 1.6, sy = 0.8 + R() * 1.2, sz = 1 + R() * 1.6;
      this.rocks.push({ x, y: h, z, sx, sy, sz, r: R() });
      this.boxes.push(box(x - sx * 0.92, h - 1, z - sz * 0.92, x + sx * 0.92, h + sy * 1.3, z + sz * 0.92, K.ROCK, 0));
    }
    for (let i = 0; i < 2500 && this.bushes.length < 500; i++) {
      const x = (R() * 2 - 1) * (HALF - 30), z = (R() * 2 - 1) * (HALF - 30);
      const h = this.heightAt(x, z);
      if (h < 1 || near(x, z, 2)) continue;
      if (R() > fbm(x / 60, z / 60, s + 11, 2) * 1.6) continue;
      this.bushes.push({ x, y: h, z, s: 0.7 + R() * 0.8 });
    }
  }

  // ---- 落ちているもの ----
  placeLoot(R) {
    const pick = table => {
      let tot = 0;
      for (const [, w] of table) tot += w;
      let r = R() * tot;
      for (const [v, w] of table) { r -= w; if (r < 0) return v; }
      return table[0][0];
    };
    const WEAP = [[1, 18], [2, 16], [3, 14], [4, 13], [5, 14], [6, 8], [7, 5], [8, 4]];
    const LV = [[1, 60], [2, 30], [3, 10]];
    const add = (code, qty, x, y, z) => this.loot.push({ id: this.loot.length, code, qty, x, y, z });
    const GOOD = [[3, 10], [4, 10], [6, 8], [7, 6], [8, 5]];
    const spawnAt = (x, y, z, good) => {
      const r = good ? R() * 0.45 : R();
      const off = () => (R() - 0.5) * 0.9;
      if (r < 0.32) {
        const w = pick(good ? GOOD : WEAP);
        add(IT.WEAPON + w - 1, WEAPONS[w].mag, x, y, z);   // 武器の数 = 込めてある弾の数
        const am = WEAPONS[w].ammo;
        for (let i = 0; i < 2; i++) add(IT.AMMO + am, AMMO_STACK[am], x + off(), y, z + off());
      } else if (r < 0.54) {
        add(IT.AMMO + pick([[0, 30], [1, 30], [2, 28], [3, 14]]), 0, x, y, z);
        const l = this.loot[this.loot.length - 1];
        l.qty = AMMO_STACK[l.code - IT.AMMO];
      } else if (r < 0.72) {
        const h = pick([[0, 60], [1, 15], [2, 25]]);
        add(IT.HEAL + h, h === 0 ? 5 : 1, x, y, z);
      } else if (r < 0.86) {
        add((R() < 0.5 ? IT.HELMET : IT.VEST) + pick(good ? [[2, 60], [3, 40]] : LV) - 1, 1, x, y, z);
      } else if (r < 0.9) {
        add(IT.PACK + pick(LV) - 1, 1, x, y, z);
      } else if (r < 0.95) {
        add(IT.GRENADE, 1, x, y, z);
      }
      // アタッチメント（ほかの物と同じ場所に、ときどき 1 つ）。良い場所（見張り台・広場）は倍率の高いスコープが出やすい
      const ar = R();
      if (ar < (good ? 0.5 : 0.17) || r >= 0.95) {
        const ATT = good ? [[1, 10], [2, 14], [3, 10], [5, 6], [8, 6]]
          : [[0, 30], [1, 22], [2, 12], [3, 4], [4, 14], [5, 8], [6, 14], [7, 12], [8, 18]];
        add(IT.ATT + pick(ATT), 1, x + off(), y, z + off());
      }
    };
    for (const b of this.buildings) for (const sp of b.spots) {
      spawnAt(sp.x, sp.y, sp.z, sp.good);
      if (R() < 0.35) spawnAt(sp.x + (R() - 0.5) * 1.6, sp.y, sp.z + (R() - 0.5) * 1.6, false);   // 24 人ぶん、少し多めに
    }
    // 外にも少し（木の近くなど）
    for (let i = 0, tries = 0; i < 40 && tries < 800; tries++) {
      const x = (R() * 2 - 1) * 200 * SC, z = (R() * 2 - 1) * 200 * SC;
      const h = this.heightAt(x, z);
      if (h < 1.5) continue;
      if (this.boxes.some(bx => x > bx.x0 - 1 && x < bx.x1 + 1 && z > bx.z0 - 1 && z < bx.z1 + 1)) continue;
      spawnAt(x, h, z);
      i++;
    }
    // 落ちているものに「どの建物の、何階か」を付ける（CPU の道さがし用）
    for (const l of this.loot) l.b = this.buildingAt(l.x, l.z);
  }

  buildingAt(x, z) {
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      if (!b.solid && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return i;
    }
    return -1;
  }

  // ---- 当たり判定の区画 ----
  buildGrid() {
    this.grid = Array.from({ length: GN * GN }, () => []);
    this.stamp = new Int32Array(this.boxes.length);
    this.stampN = 0;
    this.boxes.forEach((b, i) => {
      const gx0 = clamp(Math.floor((b.x0 + HALF) / GRID), 0, GN - 1), gx1 = clamp(Math.floor((b.x1 + HALF) / GRID), 0, GN - 1);
      const gz0 = clamp(Math.floor((b.z0 + HALF) / GRID), 0, GN - 1), gz1 = clamp(Math.floor((b.z1 + HALF) / GRID), 0, GN - 1);
      for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) this.grid[gz * GN + gx].push(i);
    });
  }

  /** 範囲 [x0,x1]×[z0,z1] にかかる箱を 1 回ずつ呼ぶ */
  query(x0, z0, x1, z1, fn) {
    const st = ++this.stampN;
    const gx0 = clamp(Math.floor((x0 + HALF) / GRID), 0, GN - 1), gx1 = clamp(Math.floor((x1 + HALF) / GRID), 0, GN - 1);
    const gz0 = clamp(Math.floor((z0 + HALF) / GRID), 0, GN - 1), gz1 = clamp(Math.floor((z1 + HALF) / GRID), 0, GN - 1);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        for (const i of this.grid[gz * GN + gx]) {
          if (this.stamp[i] === st) continue;
          this.stamp[i] = st;
          fn(this.boxes[i]);
        }
      }
    }
  }

  /**
   * 体（足もとの位置 x,y,z・速度 vx,vy,vz・高さ h）を dt 秒動かす。壁で止まり、段差（STEP まで）は上る。
   * 戻り値なし。b.onGround / b.inWater を書きかえる
   */
  moveBody(b, dt) {
    const R = PLAYER_R;
    const dist = Math.sqrt(b.vx * b.vx + b.vz * b.vz) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n;
      b.z += (b.vz * dt) / n;
      this.pushOut(b, R);
    }
    b.x = clamp(b.x, -HALF + 2, HALF - 2);
    b.z = clamp(b.z, -HALF + 2, HALF - 2);
    const prevY = b.y;
    const wasGround = b.onGround;
    b.y += b.vy * dt;
    let support = Math.max(this.heightAt(b.x, b.z), -1.1);
    let ceil = Infinity, pad = false;
    const r = R * 0.85;
    this.query(b.x - r, b.z - r, b.x + r, b.z + r, bx => {
      if (!circleRect(b.x, b.z, r, bx)) return;
      if (bx.y1 <= prevY + STEP + 0.001) {
        if (bx.y1 > support) { support = bx.y1; pad = bx.k === K.PAD; } else if (bx.y1 === support && bx.k === K.PAD) pad = true;
      }
      else if (bx.y0 >= prevY + b.h - 0.05 && bx.y0 < ceil) ceil = bx.y0;
    });
    b.onGround = false;
    if (b.y <= support) {
      b.y = support; if (b.vy < 0) b.vy = 0; b.onGround = true;
    } else if (wasGround && b.vy <= 0 && prevY - support <= 0.4) {
      b.y = support; b.vy = 0; b.onGround = true;
    }
    if (b.y + b.h > ceil) { b.y = Math.max(support, ceil - b.h); if (b.vy > 0) b.vy = 0; }
    b.inWater = b.y < WATER - 0.3;
    b.onPad = b.onGround && pad;
  }

  pushOut(b, R) {
    for (let pass = 0; pass < 2; pass++) {
      this.query(b.x - R, b.z - R, b.x + R, b.z + R, bx => {
        if (bx.y1 <= b.y + STEP || bx.y0 >= b.y + b.h) return;
        const cx = clamp(b.x, bx.x0, bx.x1), cz = clamp(b.z, bx.z0, bx.z1);
        const dx = b.x - cx, dz = b.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) return;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), p = (R - d) / d;
          b.x += dx * p; b.z += dz * p;
        } else {
          const l = b.x - bx.x0, rr = bx.x1 - b.x, f = b.z - bx.z0, k = bx.z1 - b.z;
          const m = Math.min(l, rr, f, k);
          if (m === l) b.x = bx.x0 - R; else if (m === rr) b.x = bx.x1 + R; else if (m === f) b.z = bx.z0 - R; else b.z = bx.z1 + R;
        }
      });
    }
  }

  /** 体の中心が、体の高さにある箱の中に入っているか（入っていればその箱） */
  insideBox(b) {
    let hit = null;
    this.query(b.x - 0.01, b.z - 0.01, b.x + 0.01, b.z + 0.01, bx => {
      if (b.x > bx.x0 && b.x < bx.x1 && b.z > bx.z0 && b.z < bx.z1 && bx.y1 > b.y + STEP && bx.y0 < b.y + b.h - 0.2) hit = bx;
    });
    return hit;
  }
  /**
   * 埋まり直し: 地面の下にいたら地面へ、箱に埋まっていたら近くの空いている所へ出す。
   * 位置が壊れていた（NaN など）・直せなかった時は false
   */
  unstick(b) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z)) return false;
    const g = Math.max(this.heightAt(b.x, b.z), -1.1);
    if (b.y < g - 0.3) { b.y = g; b.vy = 0; }
    if (!this.insideBox(b)) return true;
    const x0 = b.x, y0 = b.y, z0 = b.z;
    for (let r = 0.6; r <= 5; r += 0.4) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        b.x = x0 + Math.cos(a) * r; b.z = z0 + Math.sin(a) * r;
        b.y = this.groundAt(b.x, b.z, y0 + 1.2);
        if (Math.abs(b.y - y0) < 3 && !this.insideBox(b)) { b.vx = b.vz = b.vy = 0; return true; }
      }
    }
    b.x = x0; b.y = y0; b.z = z0;
    return false;
  }

  /** その場所に立った時の足もとの高さ（屋根の上なども含む）。fromY より上のものは見ない */
  groundAt(x, z, fromY = 1e9) {
    let g = Math.max(this.heightAt(x, z), -1.1);
    this.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3, bx => {
      if (circleRect(x, z, 0.3, bx) && bx.y1 > g && bx.y1 <= fromY) g = bx.y1;
    });
    return g;
  }

  /**
   * 光線（o から d 向き、長さ maxT まで）が地形か箱に当たる距離。当たらなければ maxT。
   * hit を渡すと { k: 箱の種類 or -1（地形）} を入れる
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT, hit) {
    let best = maxT, kind = null;
    // 箱: 区画を順にたどる（2D の DDA）
    let gx = Math.floor((ox + HALF) / GRID), gz = Math.floor((oz + HALF) / GRID);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(GRID / dx) : Infinity, tdz = dz !== 0 ? Math.abs(GRID / dz) : Infinity;
    let tmx = dx !== 0 ? ((dx > 0 ? (gx + 1) * GRID - HALF : gx * GRID - HALF) - ox) / dx : Infinity;
    let tmz = dz !== 0 ? ((dz > 0 ? (gz + 1) * GRID - HALF : gz * GRID - HALF) - oz) / dz : Infinity;
    const st = ++this.stampN;
    let tCell = 0;
    for (let guard = 0; guard < 200 && tCell < best; guard++) {
      if (gx >= 0 && gx < GN && gz >= 0 && gz < GN) {
        for (const i of this.grid[gz * GN + gx]) {
          if (this.stamp[i] === st) continue;
          this.stamp[i] = st;
          const t = rayBox(ox, oy, oz, dx, dy, dz, this.boxes[i]);
          if (t >= 0 && t < best) { best = t; kind = this.boxes[i].k; }
        }
      } else if ((gx < 0 && stepX < 0) || (gx >= GN && stepX > 0) || (gz < 0 && stepZ < 0) || (gz >= GN && stepZ > 0)) break;
      if (tmx < tmz) { tCell = tmx; tmx += tdx; gx += stepX; } else { tCell = tmz; tmz += tdz; gz += stepZ; }
    }
    // 地形: 地形の最高点より下にいる区間だけ 1m ずつ調べる
    let t0 = 0, t1 = best;
    const top = this.maxH + 0.5;
    if (oy > top) { if (dy >= 0) t1 = -1; else t0 = Math.max(t0, (top - oy) / dy); }
    else if (dy > 0) t1 = Math.min(t1, (top - oy) / dy);
    if (t1 > t0) {
      let prev = t0;
      for (let t = t0; t <= t1 + 1; t += 1) {
        const tt = Math.min(t, t1);
        const x = ox + dx * tt, y = oy + dy * tt, z = oz + dz * tt;
        if (y < this.heightAt(x, z)) {
          let a = prev, c = tt;
          for (let k = 0; k < 10; k++) {
            const m = (a + c) / 2;
            if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) c = m; else a = m;
          }
          if (c < best) { best = c; kind = -1; }
          break;
        }
        prev = tt;
        if (tt >= t1) break;
      }
    }
    if (hit) hit.k = kind;
    return best;
  }

  /** 2 点の間が見通せるか */
  visible(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.05;
  }

  /** 着地点にふさわしい陸か */
  isLand(x, z) { return this.heightAt(x, z) > 0.8; }
}

/**
 * グレネードを dt 秒進める（ホストの本物と、手元の予測線で同じものを使う）。
 * g: { x, y, z, vx, vy, vz }
 */
export function grenadeStep(world, g, dt) {
  g.vy -= GRAVITY * 0.8 * dt;
  const sp = Math.hypot(g.vx, g.vy, g.vz);
  if (sp > 0.01) {
    const len = sp * dt;
    const hit = {};
    const tw = world.raycast(g.x, g.y, g.z, g.vx / sp, g.vy / sp, g.vz / sp, len + 0.1, hit);
    if (tw < len + 0.1) {
      // 当たった面がわからないので、ゆるく跳ね返す（地面なら上へ、壁なら横を反転）
      const gy = world.groundAt(g.x + g.vx * dt, g.z + g.vz * dt, g.y + 0.3);
      if (g.y + g.vy * dt <= gy + 0.15 || hit.k === -1) { g.vy = Math.abs(g.vy) * 0.3; g.vx *= 0.6; g.vz *= 0.6; }
      else { g.vx *= -0.4; g.vz *= -0.4; }
      return;
    }
  }
  g.x = clamp(g.x + g.vx * dt, -HALF, HALF); g.y += g.vy * dt; g.z = clamp(g.z + g.vz * dt, -HALF, HALF);
  const gy = world.groundAt(g.x, g.z, g.y + 0.3);
  if (g.y < gy + 0.1) { g.y = gy + 0.1; g.vy = Math.abs(g.vy) * 0.3; g.vx *= 0.6; g.vz *= 0.6; }
}

function box(x0, y0, z0, x1, y1, z1, k, c) { return { x0, y0, z0, x1, y1, z1, k, c }; }

function circleRect(x, z, r, b) {
  const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
  return (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r;
}

/** 光線と箱。当たる距離（内側から出る時も含めて最初の面）、当たらなければ -1 */
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let t0 = -Infinity, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    const o = a === 0 ? ox : a === 1 ? oy : oz;
    const d = a === 0 ? dx : a === 1 ? dy : dz;
    const lo = a === 0 ? b.x0 : a === 1 ? b.y0 : b.z0;
    const hi = a === 0 ? b.x1 : a === 1 ? b.y1 : b.z1;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let ta = (lo - o) / d, tb = (hi - o) / d;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  if (t1 < 0) return -1;
  return t0 >= 0 ? t0 : 0;
}

/**
 * 光線と人（立っている体を縦の線分 + 半径で近似、頭は球）。当たれば { t, head }、なければ null。
 * p: { x, y, z, h }（y は足もと）
 */
export function rayPlayer(ox, oy, oz, dx, dy, dz, maxT, p) {
  const headY = p.y + p.h - 0.28;
  // 頭
  let best = null;
  const th = raySphere(ox, oy, oz, dx, dy, dz, p.x, headY, p.z, 0.33);
  if (th >= 0 && th <= maxT) best = { t: th, head: true };
  // 体: 縦の円柱（半径 0.4、足もと〜首）
  const r = 0.4;
  const fx = ox - p.x, fz = oz - p.z;
  const a = dx * dx + dz * dz;
  if (a > 1e-9) {
    const bq = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
    const disc = bq * bq - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const tA = (-bq - sq) / (2 * a), tB = (-bq + sq) / (2 * a);
      const y0 = p.y, y1 = headY - 0.3;
      // 円柱の中にいる区間 [tA, tB] と、高さが範囲内の区間の重なり
      let lo = Math.max(tA, 0), hi = Math.min(tB, maxT);
      if (Math.abs(dy) > 1e-9) {
        let ya = (y0 - oy) / dy, yb = (y1 - oy) / dy;
        if (ya > yb) { const s = ya; ya = yb; yb = s; }
        lo = Math.max(lo, ya); hi = Math.min(hi, yb);
      } else if (oy < y0 || oy > y1) hi = -1;
      if (lo <= hi && (!best || lo < best.t)) best = { t: lo, head: false };
    }
  }
  return best;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const fx = ox - cx, fy = oy - cy, fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (c < 0 ? 0 : -1);
}
