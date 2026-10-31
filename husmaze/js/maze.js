// 迷路の自動生成。座標は「1 マス = 1」。マス (x, y) は [x, x+1] × [y, y+1] を占める。
// 穴掘り法で 1 本道の迷路を作ってから、壁を少し抜いて回り道（ループ）を作る。
//
// アイテムの置き方（マップ全体を使わせるための工夫）:
//   1. ぶっ壊れ（−30 秒）を 1 個、外周付近で最短ルートからいちばん遠いマスに置く。取りに行くと大回りになる
//   2. その枝道の途中に、悪いアイテムを罠として並べる（バリアがあれば無傷で通れる）
//   3. お宝（−10 秒）を 2 個、外周付近の別の場所に、ぶっ壊れやお互いから離して置く
//   4. 残りのアイテムは「すでに置いたアイテムからいちばん遠いマス」を順に選んで、マップ全体に散らす
//      （良いアイテムは行き止まり・ルートの外、悪いアイテムは半分を最短ルート上）

import { makeRng, hashSeed } from "./rng.js";
import { ITEMS, GOOD_KINDS, BAD_KINDS } from "./items.js";

export const COLS = 12;
export const ROWS = 18;
export const WALL_HALF = 0.07;   // 壁の厚みの半分
const LOOP_RATE = 0.07;          // 残った内壁のうち抜く割合
const GOOD_COUNT = 8;
const BAD_COUNT = 7;
const TREASURE_COUNT = 2;
const GUARD_COUNT = 2;           // ぶっ壊れへの枝道に置く罠の数
const EDGE = 2;                  // 外周から何マスまでを「外周付近」とするか
const TREASURE_GAP = 7;          // お宝どうし・ぶっ壊れとの最低距離（マス、マンハッタン）
const JACKPOT_DETOUR = 18;       // ぶっ壊れまでの寄り道の目安（最短ルートから片道何マスか）
const TREASURE_DETOUR = 7;       // お宝までの寄り道の目安
const ITEM_GAP = 3;              // アイテム同士の最低距離（マス、マンハッタン）

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Maze {
  constructor(seedText) {
    this.cols = COLS;
    this.rows = ROWS;
    const rng = makeRng(hashSeed(`husmaze:${seedText}`));
    // right[i]: マス i とその右のマスの間に壁がある / down[i]: 下のマスとの間
    this.right = new Uint8Array(COLS * ROWS).fill(1);
    this.down = new Uint8Array(COLS * ROWS).fill(1);
    this.carve(rng);
    this.addLoops(rng);
    this.start = 0;
    const fromStart = this.distances(this.start);
    // ゴールは下の 3 行のうち、スタートからいちばん遠いマス（毎日ある程度の長さを保つ）
    this.goal = 0;
    for (let i = COLS * (ROWS - 3); i < COLS * ROWS; i++) {
      if (fromStart[i] > fromStart[this.goal]) this.goal = i;
    }
    this.toGoal = this.distances(this.goal);
    this.items = this.placeItems(rng, fromStart);
    this.rects = this.buildRects();
  }

  idx(x, y) { return y * COLS + x; }
  cx(i) { return i % COLS; }
  cy(i) { return Math.floor(i / COLS); }

  /** マス i から (dx, dy) 方向に進めるか */
  isOpen(i, dx, dy) {
    const x = this.cx(i) + dx, y = this.cy(i) + dy;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (dx === 1) return !this.right[i];
    if (dx === -1) return !this.right[i - 1];
    if (dy === 1) return !this.down[i];
    return !this.down[i - COLS];
  }

  setOpen(i, dx, dy) {
    if (dx === 1) this.right[i] = 0;
    else if (dx === -1) this.right[i - 1] = 0;
    else if (dy === 1) this.down[i] = 0;
    else this.down[i - COLS] = 0;
  }

  neighbors(i) {
    const out = [];
    for (const [dx, dy] of DIRS) if (this.isOpen(i, dx, dy)) out.push(i + dx + dy * COLS);
    return out;
  }

  carve(rng) {
    const seen = new Uint8Array(COLS * ROWS);
    const stack = [0];
    seen[0] = 1;
    while (stack.length) {
      const i = stack[stack.length - 1];
      const x = this.cx(i), y = this.cy(i);
      const options = DIRS.filter(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen[this.idx(nx, ny)];
      });
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy] = rng.pick(options);
      this.setOpen(i, dx, dy);
      const n = this.idx(x + dx, y + dy);
      seen[n] = 1;
      stack.push(n);
    }
  }

  addLoops(rng) {
    for (let i = 0; i < COLS * ROWS; i++) {
      if (this.cx(i) < COLS - 1 && this.right[i] && rng() < LOOP_RATE) this.right[i] = 0;
      if (this.cy(i) < ROWS - 1 && this.down[i] && rng() < LOOP_RATE) this.down[i] = 0;
    }
  }

  /** 幅優先探索で各マスまでの歩数。from は 1 マスか、マスの配列（いちばん近いものからの歩数） */
  distances(from) {
    const d = new Int32Array(COLS * ROWS).fill(-1);
    const q = [from].flat();
    for (const i of q) d[i] = 0;
    for (let h = 0; h < q.length; h++) {
      for (const n of this.neighbors(q[h])) {
        if (d[n] < 0) { d[n] = d[q[h]] + 1; q.push(n); }
      }
    }
    return d;
  }

  /** マス i からゴールまでの最短ルート（i を含む） */
  pathToGoal(i) {
    const path = [i];
    while (i !== this.goal) {
      i = this.neighbors(i).find(n => this.toGoal[n] === this.toGoal[i] - 1);
      path.push(i);
    }
    return path;
  }

  cellAt(x, y) {
    const cx = Math.min(COLS - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(ROWS - 1, Math.max(0, Math.floor(y)));
    return this.idx(cx, cy);
  }

  placeItems(rng, fromStart) {
    const items = [];
    const taken = [];
    const all = [...Array(COLS * ROWS).keys()];
    const path = this.pathToGoal(this.start);
    const onPath = new Set(path);
    const offDist = this.distances(path);   // 最短ルートから何マス外れているか
    const isDeadEnd = i => this.neighbors(i).length === 1;
    const isEdge = i => {
      const x = this.cx(i), y = this.cy(i);
      return x < EDGE || y < EDGE || x >= COLS - EDGE || y >= ROWS - EDGE;
    };
    const gap = (i, j) => Math.abs(this.cx(i) - this.cx(j)) + Math.abs(this.cy(i) - this.cy(j));
    const nearest = i => taken.reduce((m, j) => Math.min(m, gap(i, j)), 99);
    const free = i => fromStart[i] >= 3 && this.toGoal[i] >= 2 && !taken.includes(i);
    const put = (kind, i) => {
      taken.push(i);
      items.push({ kind, cell: i, x: this.cx(i) + 0.5, y: this.cy(i) + 0.5 });
    };
    /** cands のうち score がいちばん高いマス（乱数で同点を崩す） */
    const best = (cands, score) => {
      let pick, top = -Infinity;
      for (const i of cands) {
        const v = score(i) + rng() * 0.5;
        if (v > top) { top = v; pick = i; }
      }
      return pick;
    };

    // 1. ぶっ壊れ: 外周付近で、最短ルートからの寄り道が JACKPOT_DETOUR マスに近いマス（行き止まりを少しひいきする）。
    //    いちばん遠いマスにすると日によって往復 100 マスを超え、−30 秒でも割に合わなくなるので、遠さをそろえる
    const jackpot = best(all.filter(i => free(i) && isEdge(i)), i => -Math.abs(offDist[i] - JACKPOT_DETOUR) + (isDeadEnd(i) ? 1 : 0));
    put("jackpot", jackpot);

    // 2. 罠: ぶっ壊れから最短ルートへ戻る枝道の途中に、悪いアイテムを等間隔に並べる
    const branch = [];
    for (let i = jackpot; offDist[i] > 0;) {
      i = this.neighbors(i).find(n => offDist[n] === offDist[i] - 1);
      if (offDist[i] > 0) branch.push(i);
    }
    const guards = pickKinds(rng, BAD_KINDS, GUARD_COUNT);
    if (branch.length >= GUARD_COUNT * 2) {
      guards.forEach((kind, k) => put(kind, branch[Math.floor(branch.length * (k + 1) / (GUARD_COUNT + 1))]));
    }

    // 3. お宝: 外周付近で、寄り道が TREASURE_DETOUR マスに近く、ほかのお宝・ぶっ壊れから離れたマス
    for (let k = 0; k < TREASURE_COUNT; k++) {
      const cands = all.filter(i => free(i) && isEdge(i) && [jackpot, ...items.filter(it => it.kind === "treasure").map(it => it.cell)]
        .every(j => gap(i, j) >= TREASURE_GAP));
      const i = best(cands, i => -Math.abs(offDist[i] - TREASURE_DETOUR) + Math.min(nearest(i), 8) * 0.3);
      if (i !== undefined) put("treasure", i);
    }

    // 4. 残り: すでに置いたアイテムからいちばん遠いマスを順に選ぶ（マップ全体に散る）
    const spread = (cands, kinds) => {
      for (const kind of kinds) {
        const i = best(cands.filter(j => free(j) && nearest(j) >= ITEM_GAP), j => Math.min(nearest(j), 10));
        if (i === undefined) return;
        put(kind, i);
      }
    };
    spread(all.filter(i => isDeadEnd(i) || !onPath.has(i)), pickKinds(rng, GOOD_KINDS, GOOD_COUNT));
    const bad = pickKinds(rng, BAD_KINDS, BAD_COUNT);
    const half = Math.ceil(bad.length / 2);
    spread(path, bad.slice(0, half));
    spread(all.filter(i => !isDeadEnd(i)), bad.slice(half));
    return items;
  }

  /** 当たり判定・描画用の壁の長方形。一直線に続く壁はつなげる */
  buildRects() {
    const t = WALL_HALF;
    const rects = [];
    // 横向きの壁（y = 0..ROWS の線上）
    for (let y = 0; y <= ROWS; y++) {
      let runStart = -1;
      for (let x = 0; x <= COLS; x++) {
        const wall = x < COLS && (y === 0 || y === ROWS || this.down[this.idx(x, y - 1)]);
        if (wall && runStart < 0) runStart = x;
        if (!wall && runStart >= 0) {
          rects.push({ x0: runStart - t, y0: y - t, x1: x + t, y1: y + t });
          runStart = -1;
        }
      }
    }
    // 縦向きの壁（x = 0..COLS の線上）
    for (let x = 0; x <= COLS; x++) {
      let runStart = -1;
      for (let y = 0; y <= ROWS; y++) {
        const wall = y < ROWS && (x === 0 || x === COLS || this.right[this.idx(x - 1, y)]);
        if (wall && runStart < 0) runStart = y;
        if (!wall && runStart >= 0) {
          rects.push({ x0: x - t, y0: runStart - t, x1: x + t, y1: y + t });
          runStart = -1;
        }
      }
    }
    return rects;
  }
}

/** 全種類を 1 個ずつ入れてから、残りを重みつきで選ぶ */
function pickKinds(rng, kinds, count) {
  const out = rng.shuffle([...kinds]).slice(0, count);
  const total = kinds.reduce((s, k) => s + ITEMS[k].weight, 0);
  while (out.length < count) {
    let r = rng() * total;
    out.push(kinds.find(k => (r -= ITEMS[k].weight) < 0) ?? kinds[0]);
  }
  return rng.shuffle(out);
}
