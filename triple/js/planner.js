// スイングアップ軌道のプランナー（ブラウザ内で動く）。
//
//   最小化   J = ∫₀ᵀ u(t)² dt   （＋ 制約違反へのペナルティ）
//   条件     ṡ = f(s, u),  s(0) = 下下下,  s(T) = 上上上,  |x| ≤ xmax, |ẋ| ≤ vmax, |u| ≤ umax
//
// 離散化：多重シューティング。[0, T] を M 区間に分け、各区間の始点の状態 s_k を未知数にする。
//   区間の中は RK4（刻み ≒ 0.5 ms）で積分し、区間の終点と次の区間の始点の食い違い（欠損）
//   c_k = Φ_k(s_k, u) − s_{k+1} を 0 にする。入力 u(t) は NU 区間の区分線形関数。
//   三重振り子はカオス的で、単一シューティングだと終端の感度が e^{λT} で爆発する。
//   区間を短く（≒ 60 ms）切れば、各区間内での誤差の増幅は高々数倍で済む。
//
// 解法：SQP（逐次二次計画）。ステップは
//     min gᵀΔ + ½ ΔᵀWΔ  s.t.  c + JΔ = 0
//   を (J W⁻¹ Jᵀ) λ = c − J W⁻¹ g で解いて Δ = −W⁻¹(g + Jᵀλ)。
//   W はコストのヘッセ行列（入力について厳密）に、ダイナミクスの曲率 λᵀ∇²c を区間ごとの
//   減衰つき BFGS で近似したものを足す（区分準ニュートン法）。
//   l1 メリット関数のバックトラックと二次補正（SOC）で大域化する。
//   入力の更新が十分小さくなったら g = 0 としたニュートン射影（欠損だけを最小ノルムで消す）に
//   切り替え、欠損を二次収束で 0 に追い込む。
(function (root) {
  "use strict";
  const TM = root.TM || (typeof require !== "undefined" ? require("./model.js") : null);

  const NX = 8;
  const H_INNER = 0.0005; // 区間内の RK4 の刻みの目安 [s]

  // ---------------------------------------------------------------- 問題
  // spec = { params:{g,m,l,d}, T, xmax, vmax, umax, goal:[8], M, NU }
  function createProblem(spec) {
    const M = spec.M || 50;
    const NU = 2 * M; // 区間あたり入力 2 区間（structure() と jacobian() がこれを前提にする）
    const md = TM.makeModel(spec.params);
    const hs = spec.T / M;
    const nIn = Math.max(1, Math.round(hs / H_INNER));
    return {
      spec, md, M, NU, T: spec.T,
      hs, nIn, h: hs / nIn, hu: spec.T / NU,
      s0: TM.equilibrium("DDD"),
      goal: spec.goal.slice(),
      NS: NX * (M - 1),           // 未知の節点状態の数
      nz: NX * (M - 1) + NU - 1,  // 未知数の総数（入力の両端 u_0 = u_NU = 0 は固定）
      nc: NX * M,                 // 欠損の数
      step: TM.makeIntegrator(md),
      str: structure(M, NU, NX * (M - 1)),
    };
  }

  // z から全入力ノット（両端の 0 を含む）を取り出す
  function knots(prob, z) {
    const u = new Float64Array(prob.NU + 1);
    for (let i = 1; i < prob.NU; i++) u[i] = z[prob.NS + i - 1];
    return u;
  }
  function uAtKnots(prob, u, t) {
    const x = t / prob.hu;
    let i = Math.floor(x);
    if (i < 0) return u[0];
    if (i >= prob.NU) return u[prob.NU];
    const a = x - i;
    return u[i] + a * (u[i + 1] - u[i]);
  }
  function nodeState(prob, z, k, out) {
    if (k === 0) { for (let i = 0; i < NX; i++) out[i] = prob.s0[i]; return out; }
    if (k === prob.M) { for (let i = 0; i < NX; i++) out[i] = prob.goal[i]; return out; }
    const o = NX * (k - 1);
    for (let i = 0; i < NX; i++) out[i] = z[o + i];
    return out;
  }

  // 区間 k を s から積分する（s はその場で書き換え）。nSub 倍細かく刻むこともできる。
  function integrateSegment(prob, s, u, k, nSub = 1, record = null) {
    const n = prob.nIn * nSub, h = prob.hs / n;
    let t = k * prob.hs;
    if (record) record(t, s);
    for (let j = 0; j < n; j++) {
      prob.step(s, h, uAtKnots(prob, u, t), uAtKnots(prob, u, t + h / 2), uAtKnots(prob, u, t + h));
      t = k * prob.hs + (j + 1) * h;
      if (record) record(t, s);
    }
    return s;
  }

  // ---------------------------------------------------------------- 目的関数
  const RHO = { x: 1e4, v: 1e2, u: 10 };
  const X_MARGIN = 0.01;

  function penalty(v, lim, rho) {
    const e = Math.abs(v) - lim;
    if (e <= 0) return [0, 0, 0];
    return [rho * e * e, 2 * rho * e * Math.sign(v), 2 * rho];
  }

  // コスト、勾配、ヘッセ行列の対角への加算分
  function objective(prob, z) {
    const { NS, NU, hu, spec } = prob;
    const u = knots(prob, z);
    let f = 0, J = 0;
    for (let i = 0; i < NU; i++) J += (hu / 3) * (u[i] * u[i] + u[i] * u[i + 1] + u[i + 1] * u[i + 1]);
    f = J;
    const g = new Float64Array(prob.nz);
    const hd = new Float64Array(prob.nz);
    for (let i = 1; i < NU; i++) g[NS + i - 1] = (hu / 3) * (4 * u[i] + u[i - 1] + u[i + 1]);
    let pen = 0;
    const add = (idx, v, lim, rho) => {
      const [p, dp, ddp] = penalty(v, lim, rho);
      pen += p; g[idx] += dp; hd[idx] += ddp;
    };
    for (let k = 1; k < prob.M; k++) {
      const o = NX * (k - 1);
      add(o, z[o], spec.xmax - X_MARGIN, RHO.x);
      add(o + 4, z[o + 4], spec.vmax, RHO.v);
    }
    for (let i = 1; i < NU; i++) add(NS + i - 1, u[i], spec.umax, RHO.u);
    return { f: f + pen, J, pen, g, hd };
  }

  // ---------------------------------------------------------------- 欠損とヤコビアン
  function residuals(prob, z) {
    const c = new Float64Array(prob.nc);
    const u = knots(prob, z);
    const s = new Float64Array(NX), nxt = new Float64Array(NX);
    for (let k = 0; k < prob.M; k++) {
      nodeState(prob, z, k, s);
      integrateSegment(prob, s, u, k);
      nodeState(prob, z, k + 1, nxt);
      for (let i = 0; i < NX; i++) c[NX * k + i] = s[i] - nxt[i];
    }
    return c;
  }

  // ヤコビアンを疎な行（列番号と値の組）で返す。区間ごとに前進差分。
  function* jacobian(prob, z) {
    const { M, NU, NS } = prob;
    const c = new Float64Array(prob.nc);
    const rows = Array.from({ length: prob.nc }, () => ({ col: [], val: [] }));
    const u = knots(prob, z);
    const s = new Float64Array(NX), e = new Float64Array(NX), sp = new Float64Array(NX);
    const nxt = new Float64Array(NX);
    const EPS_S = 1e-7, EPS_U = 1e-6;
    const ratio = NU / M;
    for (let k = 0; k < M; k++) {
      nodeState(prob, z, k, s);
      e.set(s);
      integrateSegment(prob, e, u, k);
      nodeState(prob, z, k + 1, nxt);
      for (let i = 0; i < NX; i++) c[NX * k + i] = e[i] - nxt[i];
      if (k > 0) {
        for (let j = 0; j < NX; j++) {
          sp.set(s);
          sp[j] += EPS_S;
          integrateSegment(prob, sp, u, k);
          for (let i = 0; i < NX; i++) {
            rows[NX * k + i].col.push(NX * (k - 1) + j);
            rows[NX * k + i].val.push((sp[i] - e[i]) / EPS_S);
          }
        }
      }
      if (k < M - 1) {
        for (let i = 0; i < NX; i++) {
          rows[NX * k + i].col.push(NX * k + i);
          rows[NX * k + i].val.push(-1);
        }
      }
      // 区間 k に効く入力ノットは ratio·k 〜 ratio·(k+1)
      for (let q = ratio * k; q <= ratio * (k + 1); q++) {
        if (q <= 0 || q >= NU) continue;
        const old = u[q];
        u[q] = old + EPS_U;
        sp.set(s);
        integrateSegment(prob, sp, u, k);
        u[q] = old;
        for (let i = 0; i < NX; i++) {
          rows[NX * k + i].col.push(NS + q - 1);
          rows[NX * k + i].val.push((sp[i] - e[i]) / EPS_U);
        }
      }
      if (k % 10 === 9) yield null;
    }
    return { c, rows };
  }

  // ---------------------------------------------------------------- 線形代数（密）
  function cholesky(S, n) {
    const L = new Float64Array(n * n);
    for (let j = 0; j < n; j++) {
      let d = S[j * n + j];
      for (let k = 0; k < j; k++) d -= L[j * n + k] * L[j * n + k];
      if (!(d > 0)) return null;
      const ljj = Math.sqrt(d);
      L[j * n + j] = ljj;
      for (let i = j + 1; i < n; i++) {
        let v = S[i * n + j];
        for (let k = 0; k < j; k++) v -= L[i * n + k] * L[j * n + k];
        L[i * n + j] = v / ljj;
      }
    }
    return L;
  }
  function cholSolve(L, n, b) {
    const y = Float64Array.from(b);
    for (let i = 0; i < n; i++) {
      let v = y[i];
      for (let k = 0; k < i; k++) v -= L[i * n + k] * y[k];
      y[i] = v / L[i * n + i];
    }
    for (let i = n - 1; i >= 0; i--) {
      let v = y[i];
      for (let k = i + 1; k < n; k++) v -= L[k * n + i] * y[k];
      y[i] = v / L[i * n + i];
    }
    return y;
  }
  // ---------------------------------------------------------------- ヘッセ行列の近似（区分 BFGS）と帯行列
  // 区間 k の欠損 c_k が依存する未知数は s_k（k ≥ 1）と入力ノット u_{2k}, u_{2k+1}, u_{2k+2} だけ。
  // したがってラグランジュ関数のヘッセ行列は区間ごとのブロックの和になり、未知数を時間順に
  // 並べると帯行列（半帯幅 ≒ 10）になる。各ブロックを減衰つき BFGS で近似する。
  function structure(M, NU, NS) {
    const segVars = [];
    for (let k = 0; k < M; k++) {
      const v = [];
      if (k > 0) for (let j = 0; j < NX; j++) v.push(NX * (k - 1) + j);
      for (let q = 2 * k; q <= 2 * k + 2; q++) if (q >= 1 && q <= NU - 1) v.push(NS + q - 1);
      segVars.push(v);
    }
    const ord = [];
    for (let k = 0; k < M; k++) {
      if (k > 0) for (let j = 0; j < NX; j++) ord.push(NX * (k - 1) + j);
      for (const q of [2 * k + 1, 2 * k + 2]) if (q <= NU - 1) ord.push(NS + q - 1);
    }
    const pos = new Int32Array(ord.length);
    ord.forEach((v, p) => (pos[v] = p));
    let bw = 1;
    for (const v of segVars) for (const a of v) for (const b of v) bw = Math.max(bw, Math.abs(pos[a] - pos[b]));
    for (let q = 1; q < NU - 1; q++) bw = Math.max(bw, Math.abs(pos[NS + q - 1] - pos[NS + q]));
    const loc = segVars.map((v) => new Map(v.map((x, i) => [x, i])));
    return { segVars, ord, pos, bw, loc };
  }

  const DELTA = 0.02; // 状態の方向の最小の曲率（ステップの尺度）

  function initBlocks(prob) {
    return prob.str.segVars.map((v) => {
      const n = v.length, B = new Float64Array(n * n);
      v.forEach((x, i) => (B[i * n + i] = x < prob.NS ? DELTA : 1e-3 * prob.hu));
      return B;
    });
  }

  // y = ∇(λᵀc)(z⁺) − ∇(λᵀc)(z) をブロックごとに作り、減衰つき BFGS で更新する
  function updateBlocks(prob, blocks, rowsOld, rowsNew, lam, step) {
    const { segVars, loc } = prob.str;
    for (let k = 0; k < prob.M; k++) {
      const v = segVars[k], n = v.length, B = blocks[k];
      const s = new Float64Array(n), y = new Float64Array(n);
      let smax = 0;
      for (let i = 0; i < n; i++) { s[i] = step[v[i]]; smax = Math.max(smax, Math.abs(s[i])); }
      if (smax < 1e-8) continue; // 差分ヤコビアンの誤差に埋もれる
      for (let a = 0; a < NX; a++) {
        const r = NX * k + a, ro = rowsOld[r], rn = rowsNew[r];
        for (let p = 0; p < rn.col.length; p++) {
          const li = loc[k].get(rn.col[p]);
          if (li !== undefined) y[li] += (rn.val[p] - ro.val[p]) * lam[r];
        }
      }
      const Bs = new Float64Array(n);
      let sBs = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        let v2 = 0;
        for (let j = 0; j < n; j++) v2 += B[i * n + j] * s[j];
        Bs[i] = v2; sBs += s[i] * v2; sy += s[i] * y[i];
      }
      if (!(sBs > 1e-20)) continue;
      if (sy < 0.2 * sBs) {
        const th = (0.8 * sBs) / (sBs - sy);
        sy = 0;
        for (let i = 0; i < n; i++) { y[i] = th * y[i] + (1 - th) * Bs[i]; sy += s[i] * y[i]; }
      }
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) B[i * n + j] += (y[i] * y[j]) / sy - (Bs[i] * Bs[j]) / sBs;
    }
  }

  // W = コストのヘッセ行列（入力の三重対角）＋ ペナルティ ＋ Σ ブロック ＋ μI を帯行列で組む
  function assembleW(prob, obj, blocks, mu) {
    const { str, NS, NU, hu, nz } = prob;
    const w = str.bw + 1;
    const Wb = new Float64Array(nz * w);
    const add = (i, j, v) => {
      let p = str.pos[i], q = str.pos[j];
      if (q > p) { const t = p; p = q; q = t; }
      Wb[p * w + (p - q)] += v;
    };
    for (let i = 0; i < nz; i++) add(i, i, obj.hd[i] + (i < NS ? mu : mu * hu));
    for (let q = 1; q <= NU - 1; q++) {
      add(NS + q - 1, NS + q - 1, (4 * hu) / 3);
      if (q < NU - 1) add(NS + q - 1, NS + q, hu / 3);
    }
    blocks.forEach((B, k) => {
      const v = str.segVars[k], n = v.length;
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) add(v[i], v[j], B[i * n + j]);
    });
    return Wb;
  }

  function bandChol(Wb, n, b) {
    const w = b + 1;
    const L = new Float64Array(n * w);
    for (let j = 0; j < n; j++) {
      let d = Wb[j * w];
      for (let k = Math.max(0, j - b); k < j; k++) { const l = L[j * w + (j - k)]; d -= l * l; }
      if (!(d > 0)) return null;
      const ljj = Math.sqrt(d);
      L[j * w] = ljj;
      const iEnd = Math.min(n - 1, j + b);
      for (let i = j + 1; i <= iEnd; i++) {
        let v = Wb[i * w + (i - j)];
        for (let k = Math.max(0, i - b); k < j; k++) v -= L[i * w + (i - k)] * L[j * w + (j - k)];
        L[i * w + (i - j)] = v / ljj;
      }
    }
    return L;
  }

  // W⁻¹ y を返す関数（y, 戻り値とも元の並び）
  function makeWsolver(prob, L) {
    const { pos, ord, bw } = prob.str, n = prob.nz, w = bw + 1;
    const yp = new Float64Array(n);
    return (y) => {
      for (let i = 0; i < n; i++) yp[pos[i]] = y[i];
      for (let i = 0; i < n; i++) {
        let v = yp[i];
        for (let k = Math.max(0, i - bw); k < i; k++) v -= L[i * w + (i - k)] * yp[k];
        yp[i] = v / L[i * w];
      }
      for (let i = n - 1; i >= 0; i--) {
        let v = yp[i];
        const kEnd = Math.min(n - 1, i + bw);
        for (let k = i + 1; k <= kEnd; k++) v -= L[k * w + (k - i)] * yp[k];
        yp[i] = v / L[i * w];
      }
      const x = new Float64Array(n);
      for (let p = 0; p < n; p++) x[ord[p]] = yp[p];
      return x;
    };
  }

  // ---------------------------------------------------------------- SQP 本体
  const norm1 = (c) => { let s = 0; for (const v of c) s += Math.abs(v); return s; };
  const normInf = (c) => { let s = 0; for (const v of c) s = Math.max(s, Math.abs(v)); return s; };

  // ジェネレータ：反復ごとに進捗を yield し、最後に結果を return する。
  function* solve(prob, z0, opt = {}) {
    const maxIt = opt.maxIt || 80;
    const tolC = opt.tolC || 1e-10;   // 欠損の許容値
    const tolU = opt.tolU || 5e-4;    // 入力の更新量がこれ以下なら最適とみなす [m/s²]
    let z = Float64Array.from(z0);
    let mu = 0, thMin = null;
    const filter = [];
    let obj = objective(prob, z);
    let c = residuals(prob, z);
    let it = 0, lastStep = Infinity, status = "maxit";
    let polish = 0;
    const blocks = initBlocks(prob);
    let prev = null, regS = 1e-14, fails = 0;
    const t0 = Date.now();
    for (it = 1; it <= maxIt; it++) {
      const jac = yield* jacobian(prob, z);
      c = jac.c;
      const rows = jac.rows;
      const nc = prob.nc, nz = prob.nz;
      if (prev && !polish) updateBlocks(prob, blocks, prev.rows, rows, prev.lam, prev.step);
      // 分解に失敗したら（BFGS の近似が悪条件になったとき）、近似を捨て、減衰を強めてやり直す
      const recover = () => {
        blocks.splice(0, blocks.length, ...initBlocks(prob));
        prev = null;
        mu = mu ? mu * 10 : 1e-2;
        regS *= 1e3;
        return ++fails <= 8;
      };
      const L = bandChol(assembleW(prob, obj, blocks, mu), nz, prob.str.bw);
      if (!L) { if (recover()) continue; status = "singular"; break; }
      const Wsolve = makeWsolver(prob, L);
      const gUse = polish ? new Float64Array(nz) : obj.g;

      // JW = J W⁻¹（密、nc × nz）。各行は W x = J_rᵀ を帯行列で解いて作る
      const JW = new Float64Array(nc * nz);
      const er = new Float64Array(nz);
      for (let r = 0; r < nc; r++) {
        const { col, val } = rows[r];
        for (let q = 0; q < col.length; q++) er[col[q]] = val[q];
        JW.set(Wsolve(er), r * nz);
        for (let q = 0; q < col.length; q++) er[col[q]] = 0;
      }
      // S = JW Jᵀ、右辺 = c − JW g
      const S = new Float64Array(nc * nc);
      const rhs = new Float64Array(nc);
      for (let r = 0; r < nc; r++) {
        const o = r * nz;
        let gv = 0;
        for (let j = 0; j < nz; j++) gv += JW[o + j] * gUse[j];
        rhs[r] = c[r] - gv;
        for (let q = r; q < nc; q++) {
          const { col, val } = rows[q];
          let v = 0;
          for (let p = 0; p < col.length; p++) v += JW[o + col[p]] * val[p];
          S[r * nc + q] = v;
          S[q * nc + r] = v;
        }
      }
      let tr = 0;
      for (let r = 0; r < nc; r++) tr += S[r * nc + r];
      for (let r = 0; r < nc; r++) S[r * nc + r] += regS * tr / nc;
      const LS = cholesky(S, nc);
      if (!LS) { if (recover()) continue; status = "singular"; break; }
      regS = Math.max(1e-14, regS / 10);
      const lam = cholSolve(LS, nc, rhs);
      // Δ = −W⁻¹(g + Jᵀλ)
      const y = Float64Array.from(gUse);
      for (let r = 0; r < nc; r++) {
        const { col, val } = rows[r];
        for (let p = 0; p < col.length; p++) y[col[p]] += val[p] * lam[r];
      }
      const dz = Wsolve(y);
      for (let i = 0; i < nz; i++) dz[i] = -dz[i];

      if (polish) {
        // ニュートン射影：全ステップを取り、欠損が減ったかだけを見る
        const zp = new Float64Array(nz);
        for (let i = 0; i < nz; i++) zp[i] = z[i] + dz[i];
        const cp = residuals(prob, zp);
        const vOld = normInf(c), vNew = normInf(cp);
        if (!(vNew < vOld)) { status = vOld < tolC * 100 ? "converged" : "polish"; break; }
        z = zp; c = cp; obj = objective(prob, z);
        yield { it, viol: vNew, cost: obj.J, pen: obj.pen, alpha: 1, mu, du: lastStep, polish: true };
        if (vNew < tolC) { status = "converged"; break; }
        if (++polish > 6) { status = "polish"; break; }
        continue;
      }

      // フィルタ法の直線探索（Wächter–Biegler）：欠損 θ = ‖c‖₁ か目的関数 f のどちらかが
      // 十分に減り、かつ過去の (θ, f) の組のどれにも負けていなければ受け入れる。
      // 欠損が十分小さく Δ が f の降下方向なら、f のアルミホ条件を要求する（f 型の反復）。
      const th0 = norm1(c), f0 = obj.f;
      let dg = 0;
      for (let i = 0; i < nz; i++) dg += obj.g[i] * dz[i];
      if (thMin === null) thMin = 1e-4 * Math.max(1, th0);
      const fType = dg < 0 && th0 <= thMin;
      const GAM = 1e-5;
      const trial = (zz) => {
        const cc = residuals(prob, zz);
        const oo = objective(prob, zz);
        return { c: cc, obj: oo, th: norm1(cc), f: oo.f };
      };
      const okTrial = (t, a) => {
        if (!Number.isFinite(t.th) || !Number.isFinite(t.f)) return false;
        for (const e of filter) if (!(t.th < (1 - GAM) * e.th || t.f < e.f - GAM * e.th)) return false;
        if (fType) return t.f <= f0 + 1e-4 * a * dg;
        return t.th < (1 - GAM) * th0 || t.f < f0 - GAM * th0;
      };
      let alpha = 1, accepted = null, zNew = null;
      const zt = new Float64Array(nz);
      for (let i = 0; i < nz; i++) zt[i] = z[i] + dz[i];
      const tr1 = trial(zt);
      if (okTrial(tr1, 1)) {
        accepted = tr1; zNew = zt;
      } else if (Number.isFinite(tr1.th)) {
        // 二次補正：同じ J で c(z+Δ) を打ち消す最小ノルムの修正を足す
        const lc = cholSolve(LS, nc, tr1.c);
        const yc = new Float64Array(nz);
        for (let r = 0; r < nc; r++) {
          const { col, val } = rows[r];
          for (let p = 0; p < col.length; p++) yc[col[p]] += val[p] * lc[r];
        }
        const dc = Wsolve(yc);
        const zs = new Float64Array(nz);
        for (let i = 0; i < nz; i++) zs[i] = zt[i] - dc[i];
        const tr2 = trial(zs);
        if (okTrial(tr2, 1)) { accepted = tr2; zNew = zs; }
      }
      while (!accepted && alpha > 1 / 1024) {
        alpha /= 2;
        for (let i = 0; i < nz; i++) zt[i] = z[i] + alpha * dz[i];
        const tr3 = trial(zt);
        if (okTrial(tr3, alpha)) { accepted = tr3; zNew = Float64Array.from(zt); }
      }
      if (accepted && !fType) filter.push({ th: th0, f: f0 });
      if (!accepted) {
        // 直線探索が行き詰まったら、BFGS の近似を捨てて減衰を強める
        mu = mu === 0 ? 1 : mu * 10;
        prev = null;
        blocks.splice(0, blocks.length, ...initBlocks(prob));
        if (mu > 1e8) { status = "linesearch"; break; }
        yield { it, viol: normInf(c), cost: obj.J, pen: obj.pen, alpha: 0, mu };
        continue;
      }
      mu = alpha === 1 ? mu / 4 : mu;
      if (mu < 1e-6) mu = 0;
      const step = new Float64Array(nz);
      let du = 0;
      for (let i = 0; i < nz; i++) {
        step[i] = zNew[i] - z[i];
        if (i >= prob.NS) du = Math.max(du, Math.abs(step[i]));
      }
      prev = { rows, lam, step };
      lastStep = du;
      z = zNew; obj = accepted.obj; c = accepted.c;
      const viol = normInf(c);
      yield { it, viol, cost: obj.J, pen: obj.pen, alpha, mu, du };
      if (!Number.isFinite(viol)) { status = "nan"; break; }
      if (viol < tolC && du < tolU) { status = "converged"; break; }
      if (du < tolU && viol < 1e-5) polish = 1;
    }
    const viol = normInf(c);
    const ok = status === "converged" || ((status === "maxit" || status === "polish") && viol < 1e-8);
    return { ok, status, z, iters: Math.min(it, maxIt), viol, cost: obj.J, pen: obj.pen, du: lastStep, ms: Date.now() - t0 };
  }

  // ---------------------------------------------------------------- 初期値
  // 別の問題の解を、時間を伸縮して新しい問題の初期値にする
  function warmStart(prevProb, zPrev, prob) {
    const z = new Float64Array(prob.nz);
    const r = prevProb.T / prob.T; // 速度は r 倍、加速度は r² 倍
    const s = new Float64Array(NX);
    for (let k = 1; k < prob.M; k++) {
      // 正規化時刻 k/M の状態を前の解の節点から線形補間する
      const x = (k / prob.M) * prevProb.M;
      const i = Math.min(Math.floor(x), prevProb.M - 1), a = x - i;
      const A = nodeState(prevProb, zPrev, i, new Float64Array(NX));
      const B = nodeState(prevProb, zPrev, i + 1, new Float64Array(NX));
      for (let j = 0; j < NX; j++) s[j] = A[j] + a * (B[j] - A[j]);
      for (let j = 4; j < NX; j++) s[j] *= r;
      z.set(s, NX * (k - 1));
    }
    const up = knots(prevProb, zPrev);
    for (let i = 1; i < prob.NU; i++) {
      z[prob.NS + i - 1] = uAtKnots(prevProb, up, (i / prob.NU) * prevProb.T) * r * r;
    }
    return z;
  }

  // ---------------------------------------------------------------- 継続法
  const lerp = (a, b, t) => a + (b - a) * t;
  function lerpSpec(A, B, t) {
    const la = (x, y) => x.map((v, i) => lerp(v, y[i], t));
    return {
      params: { g: B.params.g, m: la(A.params.m, B.params.m), l: la(A.params.l, B.params.l), d: la(A.params.d, B.params.d) },
      T: lerp(A.T, B.T, t), xmax: lerp(A.xmax, B.xmax, t), vmax: lerp(A.vmax, B.vmax, t), umax: lerp(A.umax, B.umax, t),
      goal: B.goal, M: B.M, NU: B.NU,
    };
  }

  // from = { prob, z }（解けている問題）から target の仕様まで、パラメータを少しずつ動かして解く
  function* continuation(from, targetSpec, onStage) {
    let cur = from, lam = 0, step = 1, stages = 0;
    const total0 = Date.now();
    while (lam < 1 - 1e-12) {
      const l2 = Math.min(1, lam + step);
      const spec = lerpSpec(from.prob.spec, targetSpec, l2);
      const prob = createProblem(spec);
      const final = l2 >= 1;
      if (onStage) onStage({ lam: l2, step, stages });
      const res = yield* solve(prob, warmStart(cur.prob, cur.z, prob),
        final ? { maxIt: 100 } : { maxIt: 30, tolC: 1e-6, tolU: 5e-2 });
      stages++;
      if (res.ok) {
        cur = { prob, z: res.z, res };
        lam = l2;
        step = step * 2;
      } else {
        step = (l2 - lam) / 2;
        if (step < 1 / 128) return { ok: false, reached: lam, stages, ms: Date.now() - total0, last: res };
      }
    }
    return { ok: true, prob: cur.prob, z: cur.z, res: cur.res, stages, ms: Date.now() - total0 };
  }

  // ---------------------------------------------------------------- 解の利用
  // 刻み dt の等間隔で状態と入力を標本化する（区間内の RK4 の節点を 3 次エルミート補間）
  function sampleTrajectory(prob, z, dt) {
    const u = knots(prob, z);
    const ts = [], ss = [], fs = [];
    const f = new Float64Array(NX);
    for (let k = 0; k < prob.M; k++) {
      const s = nodeState(prob, z, k, new Float64Array(NX));
      integrateSegment(prob, s, u, k, 1, (t, st) => {
        if (ts.length && Math.abs(t - ts[ts.length - 1]) < 1e-12) return;
        ts.push(t);
        ss.push(Float64Array.from(st));
        TM.derivInto(prob.md, st, uAtKnots(prob, u, t), f);
        fs.push(Float64Array.from(f));
      });
    }
    const n = Math.round(prob.T / dt);
    const xs = [], us = [];
    let j = 0;
    for (let i = 0; i <= n; i++) {
      const t = Math.min(i * dt, prob.T);
      while (j < ts.length - 2 && ts[j + 1] < t) j++;
      const h = ts[j + 1] - ts[j], a = (t - ts[j]) / h;
      const h00 = 2 * a ** 3 - 3 * a ** 2 + 1, h10 = a ** 3 - 2 * a ** 2 + a;
      const h01 = -2 * a ** 3 + 3 * a ** 2, h11 = a ** 3 - a ** 2;
      const x = new Float64Array(NX);
      for (let q = 0; q < NX; q++)
        x[q] = h00 * ss[j][q] + h10 * h * fs[j][q] + h01 * ss[j + 1][q] + h11 * h * fs[j + 1][q];
      xs.push(x);
      us.push(uAtKnots(prob, u, t));
    }
    return { dt, xs, us, knots: u };
  }

  // 精度の見積もり：区間を 2 倍細かく刻んで積分し直したときの終点の差（RK4 の打ち切り誤差）
  function integrationError(prob, z) {
    const u = knots(prob, z);
    let worst = 0;
    for (let k = 0; k < prob.M; k++) {
      const a = nodeState(prob, z, k, new Float64Array(NX));
      const b = Float64Array.from(a);
      integrateSegment(prob, a, u, k, 1);
      integrateSegment(prob, b, u, k, 2);
      for (let i = 0; i < NX; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
    }
    return worst;
  }

  // 区間内も含めた制約の最大値（ペナルティ法なので事後に確かめる）
  function constraintPeaks(traj) {
    let x = 0, v = 0, u = 0;
    for (const s of traj.xs) { x = Math.max(x, Math.abs(s[0])); v = Math.max(v, Math.abs(s[4])); }
    for (const q of traj.us) u = Math.max(u, Math.abs(q));
    return { x, v, u };
  }

  // 同期的に回すための補助（node 用）
  function runSync(gen) {
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
  }

  root.Planner = {
    createProblem, solve, continuation, warmStart, residuals, objective,
    sampleTrajectory, integrationError, constraintPeaks, knots, uAtKnots, runSync, lerpSpec,
  };
  if (typeof module !== "undefined") module.exports = root.Planner;
})(typeof window !== "undefined" ? window : globalThis);
