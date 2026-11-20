// CPU の道さがし（ホストだけが使う）。
//   0.5m ごとの「歩けるか」の地図を 1 回だけ作る（体の高さにある箱 = 壁・木の幹・岩・コンテナ・木箱・階段・ジャンプ台は通れない）
//   まっすぐ歩けるならそのまま。だめなら、出発点と目的地（遠ければ 48m 先まで）を囲む範囲で A* をして、
//   見通せる点どうしを結んで道を短くする。扉の幅（1.4m）でも、体の太さを引いて必ず 1 マスは通れる。

import { HALF, K } from "./world.js";

const RES = 0.5;
const NG = Math.round((HALF * 2) / RES);
const CLEAR = 0.4;          // 体の半径（少し余裕）
const MAX_LEG = 48;         // 1 回の道さがしで進む距離
const MAX_EXPAND = 40000;   // 1 回の道さがしで調べるマスの上限

export class Nav {
  constructor(world) {
    this.w = world;
    const g = this.g = new Uint8Array(NG * NG);   // 0: 歩ける / 1: 通れない / 2: 水（遅い）
    for (let iz = 0; iz < NG; iz++) for (let ix = 0; ix < NG; ix++) {
      if (world.heightAt(ix * RES - HALF + RES / 2, iz * RES - HALF + RES / 2) < -0.6) g[iz * NG + ix] = 2;
    }
    for (const b of world.boxes) {
      if (b.k === K.FLOOR || b.k === K.ROOF) continue;
      const gh = world.heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      if (b.k !== K.PAD && (b.y1 <= gh + 0.5 || b.y0 >= gh + 1.7)) continue;   // 足もとの段差や頭の上は通れる
      const ix0 = Math.max(0, Math.ceil((b.x0 - CLEAR + HALF) / RES - 0.5)), ix1 = Math.min(NG - 1, Math.floor((b.x1 + CLEAR + HALF) / RES - 0.5));
      const iz0 = Math.max(0, Math.ceil((b.z0 - CLEAR + HALF) / RES - 0.5)), iz1 = Math.min(NG - 1, Math.floor((b.z1 + CLEAR + HALF) / RES - 0.5));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) g[iz * NG + ix] = 1;
    }
    // A* の作業用（使い回す）
    this.cost = new Float32Array(0);
    this.from = new Int32Array(0);
    this.mark = new Uint32Array(0);
    this.gen = 0;
  }

  cell(x, z) { return [Math.floor((x + HALF) / RES), Math.floor((z + HALF) / RES)]; }
  center(ix, iz) { return [ix * RES - HALF + RES / 2, iz * RES - HALF + RES / 2]; }
  blocked(ix, iz) { return ix < 0 || iz < 0 || ix >= NG || iz >= NG || this.g[iz * NG + ix] === 1; }
  freeAt(x, z) { const [ix, iz] = this.cell(x, z); return !this.blocked(ix, iz); }

  /** 2 点の間をまっすぐ歩けるか */
  lineClear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / (RES * 0.5));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      const [ix, iz] = this.cell(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (this.blocked(ix, iz)) return false;
    }
    return true;
  }

  /** 近くの歩けるマス（なければ null） */
  nearestFree(x, z, rad = 8) {
    const [cx, cz] = this.cell(x, z);
    if (!this.blocked(cx, cz)) return [cx, cz];
    for (let r = 1; r <= rad; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || this.blocked(cx + dx, cz + dz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = [cx + dx, cz + dz]; }
      }
      if (best) return best;
    }
    return null;
  }

  /** 建物 b の外形の中で、(x,z) にいちばん近い歩けるマスの中心（なければ元の点） */
  snapInside(x, z, b) {
    const [cx, cz] = this.cell(x, z);
    let best = null, bd = 1e9;
    for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
      const ix = cx + dx, iz = cz + dz;
      if (this.blocked(ix, iz)) continue;
      const [wx, wz] = this.center(ix, iz);
      if (wx < b.x0 + 0.3 || wx > b.x1 - 0.3 || wz < b.z0 + 0.3 || wz > b.z1 - 0.3) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [wx, wz]; }
    }
    return best || [x, z];
  }

  /**
   * (sx,sz) から (tx,tz) へ向かう道（[x,z] の列）。遠い時は途中（MAX_LEG 先）までの道を返すので、着いたらまた呼ぶ。
   */
  findPath(sx, sz, tx, tz) {
    let gx = tx, gz = tz;
    const dist = Math.hypot(tx - sx, tz - sz);
    if (dist > MAX_LEG) { gx = sx + ((tx - sx) / dist) * MAX_LEG; gz = sz + ((tz - sz) / dist) * MAX_LEG; }
    if (this.freeAt(sx, sz) && this.lineClear(sx, sz, gx, gz)) return [[gx, gz]];
    const s = this.nearestFree(sx, sz, 6), t = this.nearestFree(gx, gz, 10);
    if (!s || !t) return [[gx, gz]];
    // 調べる範囲
    const pad = 24;
    const x0 = Math.max(0, Math.min(s[0], t[0]) - pad), x1 = Math.min(NG - 1, Math.max(s[0], t[0]) + pad);
    const z0 = Math.max(0, Math.min(s[1], t[1]) - pad), z1 = Math.min(NG - 1, Math.max(s[1], t[1]) + pad);
    const W = x1 - x0 + 1, H = z1 - z0 + 1, size = W * H;
    if (this.cost.length < size) { this.cost = new Float32Array(size); this.from = new Int32Array(size); this.mark = new Uint32Array(size); }
    const gen = ++this.gen;
    const cost = this.cost, from = this.from, mark = this.mark;   // mark: gen*2 = 開いた / gen*2+1 = 閉じた
    const idx = (ix, iz) => (iz - z0) * W + (ix - x0);
    const heur = (ix, iz) => { const dx = Math.abs(ix - t[0]), dz = Math.abs(iz - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = new Heap();
    const si = idx(s[0], s[1]);
    cost[si] = 0; from[si] = -1; mark[si] = gen * 2;
    heap.push(si, heur(s[0], s[1]));
    const ti = idx(t[0], t[1]);
    let found = false, n = 0;
    while (heap.size && n++ < MAX_EXPAND) {
      const cur = heap.pop();
      if (mark[cur] === gen * 2 + 1) continue;
      mark[cur] = gen * 2 + 1;
      if (cur === ti) { found = true; break; }
      const cx = (cur % W) + x0, cz = ((cur / W) | 0) + z0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || this.blocked(nx, nz)) continue;
        if (dx && dz && (this.blocked(cx + dx, cz) || this.blocked(cx, cz + dz))) continue;   // 角をすり抜けない
        const ni = idx(nx, nz);
        if (mark[ni] === gen * 2 + 1) continue;
        const step = (dx && dz ? 1.414 : 1) * (this.g[nz * NG + nx] === 2 ? 3 : 1);
        const c = cost[cur] + step;
        if (mark[ni] !== gen * 2 || c < cost[ni]) {
          cost[ni] = c; from[ni] = cur; mark[ni] = gen * 2;
          heap.push(ni, c + heur(nx, nz));
        }
      }
    }
    if (!found) return [[gx, gz]];
    const cells = [];
    for (let i = ti; i !== -1; i = from[i]) cells.push([(i % W) + x0, ((i / W) | 0) + z0]);
    cells.reverse();
    // 見通せる点どうしを結んで短くする
    const pts = cells.map(([ix, iz]) => this.center(ix, iz));
    const out = [];
    let a = [sx, sz], i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineClear(a[0], a[1], pts[j][0], pts[j][1])) j--;
      out.push(pts[j]);
      a = pts[j]; i = j;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(k, v) {
    const K_ = this.k, V = this.v;
    let i = K_.length;
    K_.push(k); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (V[p] <= v) break;
      K_[i] = K_[p]; V[i] = V[p]; i = p;
    }
    K_[i] = k; V[i] = v;
  }
  pop() {
    const K_ = this.k, V = this.v;
    const top = K_[0];
    const lk = K_.pop(), lv = V.pop();
    if (K_.length) {
      let i = 0;
      const n = K_.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && V[c + 1] < V[c]) c++;
        if (V[c] >= lv) break;
        K_[i] = K_[c]; V[i] = V[c]; i = c;
      }
      K_[i] = lk; V[i] = lv;
    }
    return top;
  }
}
