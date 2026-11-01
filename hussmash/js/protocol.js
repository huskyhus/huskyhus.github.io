// 通信メッセージの形と検査。相手は誰だかわからない前提で、受け取ったものは必ずここを通す。
//   1. 文字列であること・長さの上限（parse）
//   2. JSON として読めて、ただのオブジェクトであること
//   3. 決まった形のフィールドだけを取り出し、数値は有限・整数・範囲内に丸め、文字列は制御文字を消して短くする
// 検査を通ったものは「新しく作り直したオブジェクト」なので、知らないキーや __proto__ などは残らない。

import { MOVES, MOVE_BY_ID, isValidLoadout } from "./moves.js";
import { PHASES, STATES, EVENTS, PROJ_KINDS, MAX_PLAYERS, FSTATE_RANGES, STATS_RANGES } from "./sim.js";

export const MAX_FROM_CLIENT = 1024;   // クライアント → ホスト（入力・自己紹介）の 1 通の上限（文字数）
export const MAX_FROM_HOST = 8192;     // ホスト → クライアント（スナップショット）の 1 通の上限
export const INPUT_FRAMES = 10;        // 入力 1 通に入れる直近のフレーム数（何通か落ちても次の 1 通で埋まる）
export const NAME_MAX = 10;

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);

/** 数値なら丸めて範囲に収める。数値でなければ null */
function int(v, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** 数値なら（丸めずに）範囲に収める。数値でなければ null */
function num(v, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(lo, Math.min(hi, v));
}

/** 長さぴったりの数値の配列を、それぞれ範囲に収めて作り直す（範囲の 3 つ目が true なら小数のまま）。1 つでもだめなら null */
function ints(arr, ranges) {
  if (!Array.isArray(arr) || arr.length !== ranges.length) return null;
  const out = new Array(ranges.length);
  for (let i = 0; i < ranges.length; i++) {
    const v = (ranges[i][2] ? num : int)(arr[i], ranges[i][0], ranges[i][1]);
    if (v === null) return null;
    out[i] = v;
  }
  return out;
}

/** 名前: 制御文字・書字方向の制御文字・山かっこを消し、前後の空白を取り、NAME_MAX 文字まで */
export function cleanName(v) {
  if (typeof v !== "string") return "";
  const s = v.slice(0, 64)
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿<>]/g, "")
    .trim();
  return Array.from(s).slice(0, NAME_MAX).join("");
}

/** 受け取った生データを JSON のオブジェクトにする（文字列以外・長すぎ・壊れた JSON は null） */
export function parse(raw, maxLen) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > maxLen) return null;
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  return isObj(o) && typeof o.t === "string" ? o : null;
}

// ---- クライアント → ホスト ----

const IN_RANGES = [[-100, 100], [-100, 100], [0, 31], [0, 31]];   // スティック x, y（×100）、押している、このフレームで押した

/** hi: 名前と技の組み合わせ / in: 入力（s = いちばん新しいフレームの番号、i = 直近のフレームの入力。古い順） / by: 退出 */
export function checkFromClient(o) {
  switch (o.t) {
    case "hi": {
      const name = cleanName(o.n);
      if (!isValidLoadout(o.l)) return null;
      return { t: "hi", n: name, l: o.l.slice(), r: o.r === 1 };   // r: 準備OK
    }
    case "in": {
      const s = int(o.s, 0, 2 ** 31);
      if (s === null || !Array.isArray(o.i) || o.i.length < 1 || o.i.length > INPUT_FRAMES || o.i.length > s + 1) return null;
      const i = list(o.i, INPUT_FRAMES, IN_RANGES);
      return i && { t: "in", s, i };
    }
    case "by":
      return { t: "by" };
    default:
      return null;
  }
}

// ---- ホスト → クライアント ----

const F_RANGES = [
  [-3000, 5000], [-3000, 5000], [-1, 1], [0, STATES.length - 1],
  [-1, MOVES.length - 1], [0, 999], [0, 999], [0, 9], [0, 127], [0, 60],
  [0, 999], [0, 999], [0, 999], [0, 999], [0, 60],
];
const P_RANGES = [[0, 2 ** 31], [0, PROJ_KINDS.length - 1], [-3000, 5000], [-3000, 5000], [0, 3], [-1, 1], [0, 999]];
const E_RANGES = [[0, 2 ** 31], [0, EVENTS.length - 1], [-3000, 5000], [-3000, 5000], [-1, 3], [-1, 999], [0, 999]];
const Y_RANGES = [[-1, 2 ** 31], ...FSTATE_RANGES];   // 受け取る人のファイター: ホストが使い終わった入力の番号 + まるごとの状態

function list(arr, max, ranges) {
  if (!Array.isArray(arr) || arr.length > max) return null;
  const out = [];
  for (const a of arr) {
    const v = ints(a, ranges);
    if (!v) return null;
    out.push(v);
  }
  return out;
}

/** lb: ロビーの状態 / st: 対戦のスナップショット / no: 入れなかった */
export function checkFromHost(o) {
  switch (o.t) {
    case "lb": {
      const s = int(o.s, 0, 2 ** 31);
      const ph = int(o.ph, 0, PHASES.length - 1);
      const st = int(o.st, 0, 9);   // 0 = ストック無限
      const you = int(o.you, 0, MAX_PLAYERS - 1);
      if (s === null || ph === null || st === null || you === null) return null;
      if (!Array.isArray(o.P) || o.P.length !== MAX_PLAYERS) return null;
      const P = [];
      for (const p of o.P) {
        if (!isObj(p)) return null;
        const k = int(p.k, 0, 2);   // 0: 空き / 1: 人 / 2: CPU
        if (k === null) return null;
        P.push({ k, n: k ? cleanName(p.n) : "", m: p.m === 1 ? 1 : 0, lv: k === 2 ? (int(p.lv, 0, 3) ?? 2) : 0, r: p.r === 1 ? 1 : 0 });   // m: 今の対戦に出ている / lv: CPU の強さ / r: 準備OK
      }
      return { t: "lb", s, ph: PHASES[ph], st, you, P };
    }
    case "st": {
      const f = int(o.f, 0, 2 ** 31);
      const ph = int(o.ph, 0, PHASES.length - 1);
      const tm = int(o.tm, 0, 9999);
      if (f === null || ph === null || tm === null) return null;
      if (!Array.isArray(o.F) || o.F.length !== MAX_PLAYERS) return null;
      const F = [];
      for (const a of o.F) {
        if (a === null) { F.push(null); continue; }
        const v = ints(a, F_RANGES);
        if (!v) return null;
        F.push(v);
      }
      const P = list(o.P, 24, P_RANGES);
      const E = list(o.E, 24, E_RANGES);
      if (!P || !E) return null;
      if (!Array.isArray(o.R) || o.R.length > MAX_PLAYERS) return null;
      const R = [];
      for (const r of o.R) {
        const v = int(r, 0, MAX_PLAYERS - 1);
        if (v === null || R.includes(v)) return null;
        R.push(v);
      }
      const Y = o.Y === undefined ? null : ints(o.Y, Y_RANGES);
      if (o.Y !== undefined && !Y) return null;
      let St = null;   // 成績（対戦が終わってから）
      if (o.S !== undefined) {
        if (!Array.isArray(o.S) || o.S.length !== MAX_PLAYERS) return null;
        St = [];
        for (const a of o.S) {
          if (a === null) { St.push(null); continue; }
          const v = ints(a, STATS_RANGES);
          if (!v) return null;
          St.push(v);
        }
      }
      return { t: "st", f, ph: PHASES[ph], tm, F, P, E, R, I: o.I === 1 ? 1 : 0, Y, S: St };
    }
    case "no": {
      const r = o.r === "full" || o.r === "started" ? o.r : "other";
      return { t: "no", r };
    }
    default:
      return null;
  }
}

/** スナップショットの配列を、描画で使いやすい形に開く */
export function expandSnapshot(s) {
  return {
    f: s.f, ph: s.ph, tm: s.tm, R: s.R, I: s.I,
    Y: s.Y && { ack: s.Y[0], state: s.Y.slice(1) },
    S: s.S ? s.S.map(a => a && {
      dmg: a[0], kos: a[1], falls: a[2], sds: a[3], taken: a[4],
      foe: [0, 1, 2, 3].map(i => ({ dmg: a[5 + i * 2], ko: a[6 + i * 2] })),
      mv: [0, 1, 2, 3].map(i => ({ move: MOVES[a[25 + i]], hits: a[13 + i * 3], dmg: a[14 + i * 3], ko: a[15 + i * 3] })),
    }) : null,
    F: s.F.map(a => a && {
      x: a[0], y: a[1], face: a[2] || 1, st: STATES[a[3]], mv: a[4] >= 0 ? MOVES[a[4]] : null, mf: a[5],
      dmg: a[6], stocks: a[7], flags: a[8], guardHp: a[9], cd: a.slice(10, 14), charge: a[14],
    }),
    P: s.P.map(p => ({ id: p[0], kind: PROJ_KINDS[p[1]], x: p[2], y: p[3], owner: p[4], dir: p[5] || 1, t: p[6] })),
    E: s.E.map(e => ({ id: e[0], k: EVENTS[e[1]], x: e[2], y: e[3], s: e[4], p: e[5], q: e[6] })),
  };
}

export { MOVE_BY_ID };
