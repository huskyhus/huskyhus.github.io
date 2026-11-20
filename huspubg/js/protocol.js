// 通信メッセージの形と検査。相手は誰だかわからない前提で、受け取ったものは必ずここを通す。
//   1. 文字列であること・長さの上限（parse。巨大なデータはここで捨てる）
//   2. JSON として読めて、ただのオブジェクトであること
//   3. 決まった形のフィールドだけを取り出し、数値は有限・範囲内に収め、配列は長さを確かめ、文字列は制御文字を消して短くする
// 検査を通ったものは「新しく作り直したオブジェクト」なので、知らないキーや __proto__ などは残らない。

import { AVATARS, STAMPS, ITEM_COUNT, WEAPONS, IT } from "./items.js";

export const MAX_PLAYERS = 24;   // 人 + CPU。アバター（ステッカー 24 枚）が全員別になるように 24 まで。CPU はホストの中で動くので、増えても通信は「全員の位置」が少し増えるだけ
export const MAX_FROM_CLIENT = 1500;    // クライアント → ホスト 1 通の上限（文字数）
export const MAX_FROM_HOST = 24000;     // ホスト → クライアント 1 通の上限
export const NAME_MAX = 10;
export const MAX_LOOT_ID = 8191;
const BIG = 2 ** 31;

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);

function int(v, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
function num(v, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(lo, Math.min(hi, v));
}
/** 長さぴったりの数値の配列を作り直す。ranges[i] = [下限, 上限, 小数可] */
function arr(a, ranges) {
  if (!Array.isArray(a) || a.length !== ranges.length) return null;
  const out = new Array(ranges.length);
  for (let i = 0; i < ranges.length; i++) {
    const v = (ranges[i][2] ? num : int)(a[i], ranges[i][0], ranges[i][1]);
    if (v === null) return null;
    out[i] = v;
  }
  return out;
}
function list(a, max, ranges) {
  if (!Array.isArray(a) || a.length > max) return null;
  const out = [];
  for (const x of a) { const v = arr(x, ranges); if (!v) return null; out.push(v); }
  return out;
}
const F = true;
const POS = [-400, 400, F];
const ALT = [-50, 600, F];

/** 名前: 制御文字・書字方向の制御文字・山かっこを消し、前後の空白を取り、NAME_MAX 文字まで */
export function cleanName(v) {
  if (typeof v !== "string") return "";
  const s = v.slice(0, 64)
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿<>&"']/g, "")
    .trim();
  return Array.from(s).slice(0, NAME_MAX).join("");
}

/** 受け取った生データを JSON のオブジェクトにする（文字列以外・長すぎ・壊れた JSON は null） */
export function parse(raw, maxLen) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > maxLen) return null;
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  return isObj(o) && typeof o.t === "string" && o.t.length <= 4 ? o : null;
}

// ---- クライアント → ホスト ----
// mv の p: x, y, z, yaw, pitch, 状態（2 降下 / 3 パラシュート / 4 地上）, ビット（1 しゃがみ / 2 のぞきこみ / 4 走り）
const MV = [POS, ALT, POS, [-10, 10, F], [-1.6, 1.6, F], [0, 5], [0, 15]];
const V3 = [[-1, 1, F], [-1, 1, F], [-1, 1, F]];

// ATTACH: v = 予備の番号 × 2 + 銃の枠 / DETACH: v = 銃の枠 × 4 + 部位 / DROP_ATT: v = 予備の番号（8 は欠番）
export const AC = { PICK: 1, RELOAD: 2, HEAL: 3, HAND: 4, JUMP: 5, STAMP: 6, CANCEL: 7, DETECT: 9, ATTACH: 10, DETACH: 11, DROP_ATT: 12 };
/** 遊び方: 0 バトルロワイヤル / 1 チーム戦（人間チーム vs CPU チーム）/ 2 射撃訓練場（ひとりで） */
export const MODE = { BR: 0, TEAM: 1, RANGE: 2 };
/** 人の状態（F の 6 番目）: 0 不在 / 1 飛行機 / 2 降下 / 3 パラシュート / 4 地上 / 5 死亡 */
export const ST = { NONE: 0, PLANE: 1, FALL: 2, CHUTE: 3, GROUND: 4, DEAD: 5 };

export function checkFromClient(o) {
  switch (o.t) {
    case "hi": {
      const a = int(o.a, 0, AVATARS.length - 1);
      if (a === null) return null;
      return { t: "hi", n: cleanName(o.n), a, r: o.r === 1 ? 1 : 0 };
    }
    case "mv": {
      const s = int(o.s, 0, BIG), ea = int(o.ea, -1, BIG);
      const p = arr(o.p, MV);
      if (s === null || ea === null || !p) return null;
      return { t: "mv", s, ea, p };
    }
    case "sh": {
      const s = int(o.s, 0, BIG), w = int(o.w, 0, WEAPONS.length - 1), rt = num(o.rt, 0, 1e12);
      const og = arr(o.o, [POS, ALT, POS]);
      const d = list(o.d, 12, V3);
      if (s === null || w === null || rt === null || !og || !d || d.length < 1) return null;
      for (const v of d) { const l = Math.hypot(v[0], v[1], v[2]); if (l < 0.5) return null; v[0] /= l; v[1] /= l; v[2] /= l; }
      return { t: "sh", s, w, o: og, d, rt };
    }
    case "gr": {
      const og = arr(o.o, [POS, ALT, POS]);
      const v = arr(o.v, [[-40, 40, F], [-40, 40, F], [-40, 40, F]]);
      if (!og || !v) return null;
      return { t: "gr", o: og, v };
    }
    case "ac": {
      const a = int(o.a, 1, 12), v = int(o.v, -1, MAX_LOOT_ID);
      if (a === null || v === null) return null;
      if (a === AC.STAMP && (v < 0 || v >= STAMPS.length)) return null;
      return { t: "ac", a, v };
    }
    case "by":
      return { t: "by" };
    default:
      return null;
  }
}

// ---- ホスト → クライアント ----
// F（みんなの姿）: x, y, z, yaw, pitch, 状態（0 不在 / 1 飛行機 / 2 降下 / 3 パラシュート / 4 地上 / 5 死亡）, hp, 手に持つもの, ビット, 装備
const FR = [POS, ALT, POS, [-10, 10, F], [-1.6, 1.6, F], [0, 5], [0, 100, F], [0, 9], [0, 63], [0, 63]];
// Y（自分だけ）
export const Y_KEYS = ["ack", "hp", "boost", "helmet", "vest", "pack", "hand", "w1", "m1", "w2", "m2", "a0", "a1", "a2", "a3",
  "h0", "h1", "h2", "gren", "kills", "act", "actP", "corr", "cx", "cy", "cz", "rank", "dmg", "det", "detT",
  // アタッチメント: 枠 1・枠 2 の [スコープ, マズル, グリップ, マガジン]（アイテム番号、0 = なし）と、予備 6 つ
  "t10", "t11", "t12", "t13", "t20", "t21", "t22", "t23", "x0", "x1", "x2", "x3", "x4", "x5"];
const ATT = [0, ITEM_COUNT - 1];
const YR = [[-1, BIG], [0, 100, F], [0, 100, F], [0, 3], [0, 3], [0, 3], [0, 3], [0, 8], [0, 120], [0, 8], [0, 120],
  [0, 999], [0, 999], [0, 999], [0, 999], [0, 99], [0, 99], [0, 99], [0, 9], [0, 99], [0, 4], [0, 1, F],
  [0, BIG], POS, ALT, POS, [0, MAX_PLAYERS], [0, 99999], [0, 9], [0, 10, F], ...new Array(14).fill(ATT)];
// Z（安全地帯）: 中心 x, z, 半径, 次の中心 x, z, 次の半径, 段階, 残り秒, 収縮中, 外の毎秒ダメージ
const ZR = [POS, POS, [0, 600, F], POS, POS, [0, 600, F], [0, 9], [0, 999, F], [0, 1], [0, 50, F]];
const PLR = [[-1000, 1000, F], [-1000, 1000, F], [-10, 10, F], [0, 1]];
const TR = [[0, MAX_PLAYERS - 1], [0, 31], POS, ALT, POS, POS, ALT, POS];   // 弾の線: 撃った人, 武器（+16 = サプレッサー付き）, 始点, 終点
const GR = [[0, BIG], [0, MAX_PLAYERS - 1], POS, ALT, POS];   // グレネード: id, 投げた人, x, y, z
const HR = [[0, MAX_PLAYERS - 1], [0, 999], [0, 1], [0, 1]];
const DR = [POS, POS];
const RR = [[0, MAX_PLAYERS - 1], [1, MAX_PLAYERS], [0, 99], [0, 99999]];
const AR = [[0, 99], POS, ALT, POS, [0, 1]];          // 補給物資: id, x, y, z, 着地した
const XR = [[0, MAX_PLAYERS - 1], POS, POS];          // 探知機で見えている人: 番号, x, z
const ER = [[0, BIG], [0, 7], [-1000, 100000, F], [-1000, 100000, F], [-1000, 100000, F], [-1000, 100000, F], [-1000, 100000, F], [-1000, 100000, F]];
const ISI = v => Number.isInteger(v);

/** できごと（取りこぼさないように、相手が受け取ったと返事するまで何度も送る）を種類ごとに確かめる */
function checkEvent(e) {
  const [, k, a, b, c] = e;
  switch (k) {
    case 0: return ISI(a) && a >= 0 && a <= MAX_LOOT_ID;
    case 1: return ISI(a) && a >= 0 && a <= MAX_LOOT_ID && ISI(b) && b >= 0 && b < ITEM_COUNT && ISI(c) && c >= 0 && c <= 999
      && Math.abs(e[5]) <= 400 && e[6] > -50 && e[6] < 600 && Math.abs(e[7]) <= 400;
    case 2: return ISI(a) && a >= -1 && a < MAX_PLAYERS && ISI(b) && b >= 0 && b < MAX_PLAYERS && ISI(c) && c >= 0 && c <= 11;
    case 3: return Math.abs(a) <= 400 && Math.abs(c) <= 400;
    case 4: return ISI(a) && a >= 0 && a < MAX_PLAYERS && ISI(b) && b >= 0 && b < STAMPS.length;
    case 5: return ISI(a) && a >= 0 && a <= 9;
    case 6: return ISI(a) && a >= -1 && a < MAX_PLAYERS && ISI(b) && b >= 0 && b <= 2;   // 勝った人（-1 = チーム戦・相打ち）, 勝ったチーム（1 人間 / 2 CPU）
    case 7: return ISI(a) && a >= 0 && a <= 99 && Math.abs(b) <= 400 && Math.abs(c) <= 400;   // 補給物資の投下
    default: return false;
  }
}

export function checkFromHost(o) {
  switch (o.t) {
    case "lb": {
      const seed = int(o.seed, 0, BIG), ph = int(o.ph, 0, 2), you = int(o.you, 0, MAX_PLAYERS - 1), md = int(o.md ?? 0, 0, 2);
      if (seed === null || ph === null || you === null || md === null) return null;
      if (!Array.isArray(o.P) || o.P.length !== MAX_PLAYERS) return null;
      const P = [];
      for (const p of o.P) {
        if (!isObj(p)) return null;
        const k = int(p.k, 0, 2);   // 0: 空き / 1: 人 / 2: CPU
        const a = int(p.a, 0, AVATARS.length - 1);
        if (k === null || a === null) return null;
        P.push({ k, n: k ? cleanName(p.n) : "", a, r: p.r === 1 ? 1 : 0, m: p.m === 1 ? 1 : 0 });
      }
      return { t: "lb", seed, ph, you, md, P };
    }
    case "st": {
      const f = int(o.f, 0, BIG), tm = num(o.tm, 0, 1e12), ph = int(o.ph, 0, 2), al = int(o.al, 0, MAX_PLAYERS);
      if (f === null || tm === null || ph === null || al === null) return null;
      if (!Array.isArray(o.F) || o.F.length !== MAX_PLAYERS) return null;
      const Fs = [];
      for (const a of o.F) {
        if (a === null) { Fs.push(null); continue; }
        const v = arr(a, FR);
        if (!v) return null;
        Fs.push(v);
      }
      const Z = arr(o.Z, ZR), PL = arr(o.PL, PLR);
      const Y = o.Y === undefined ? null : arr(o.Y, YR);
      if (!Z || !PL || (o.Y !== undefined && !Y)) return null;
      const E = list(o.E ?? [], 32, ER), T = list(o.T ?? [], 32, TR), G = list(o.G ?? [], 16, GR);
      const H = list(o.H ?? [], 24, HR), D = list(o.D ?? [], 12, DR), R = list(o.R ?? [], MAX_PLAYERS, RR);
      const A = list(o.A ?? [], 8, AR), X = list(o.X ?? [], MAX_PLAYERS, XR);
      if (!E || !T || !G || !H || !D || !R || !A || !X) return null;
      if (!E.every(checkEvent)) return null;
      return { t: "st", f, tm, ph, al, F: Fs, Z, PL, Y, E, T, G, H, D, R, A, X };
    }
    case "no": {
      const r = o.r === "full" || o.r === "started" ? o.r : "other";
      return { t: "no", r };
    }
    default:
      return null;
  }
}

export function expandY(y) {
  const o = {};
  Y_KEYS.forEach((k, i) => { o[k] = y[i]; });
  const a = v => (v >= IT.ATT ? v : 0);   // アタッチメント以外の番号は「なし」にする
  o.att = [[o.t10, o.t11, o.t12, o.t13].map(a), [o.t20, o.t21, o.t22, o.t23].map(a)];
  o.spares = [o.x0, o.x1, o.x2, o.x3, o.x4, o.x5].map(a).filter(Boolean);
  return o;
}
