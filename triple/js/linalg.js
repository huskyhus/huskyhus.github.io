// 小さな密行列の演算（8×8 程度を想定）。行列は配列の配列（行優先）。
(function (root) {
  "use strict";

  const zeros = (n, m = n) => Array.from({ length: n }, () => new Array(m).fill(0));
  const eye = (n) => {
    const I = zeros(n);
    for (let i = 0; i < n; i++) I[i][i] = 1;
    return I;
  };
  const copy = (A) => A.map((r) => r.slice());
  const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));

  function mul(A, B) {
    const n = A.length, k = B.length, m = B[0].length;
    const C = zeros(n, m);
    for (let i = 0; i < n; i++)
      for (let p = 0; p < k; p++) {
        const a = A[i][p];
        if (a === 0) continue;
        for (let j = 0; j < m; j++) C[i][j] += a * B[p][j];
      }
    return C;
  }
  const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
  const sub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
  const scale = (A, c) => A.map((r) => r.map((v) => v * c));
  const norm1 = (A) => {
    let best = 0;
    for (let j = 0; j < A[0].length; j++) {
      let s = 0;
      for (let i = 0; i < A.length; i++) s += Math.abs(A[i][j]);
      best = Math.max(best, s);
    }
    return best;
  };

  // ガウス・ジョルダン（部分ピボット）
  function inv(A) {
    const n = A.length;
    const M = A.map((r, i) => [...r, ...eye(n)[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f === 0) continue;
        for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((r) => r.slice(n));
  }

  // 行列指数関数（スケーリング・二乗法＋テイラー展開）
  function expm(A) {
    const n = A.length;
    const s = Math.max(0, Math.ceil(Math.log2(norm1(A) / 0.5)) + 1);
    const As = scale(A, Math.pow(2, -s));
    let E = eye(n), term = eye(n);
    for (let k = 1; k <= 14; k++) {
      term = scale(mul(term, As), 1 / k);
      E = add(E, term);
    }
    for (let i = 0; i < s; i++) E = mul(E, E);
    return E;
  }

  // 零次ホールドによる離散化：[[A B],[0 0]] の指数関数から Ad, Bd を取り出す
  function c2d(A, B, Ts) {
    const n = A.length, m = B[0].length;
    const Mx = zeros(n + m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) Mx[i][j] = A[i][j] * Ts;
      for (let j = 0; j < m; j++) Mx[i][n + j] = B[i][j] * Ts;
    }
    const E = expm(Mx);
    return {
      Ad: E.slice(0, n).map((r) => r.slice(0, n)),
      Bd: E.slice(0, n).map((r) => r.slice(n)),
    };
  }

  // 離散時間リッカチ方程式を構造保存倍化法（SDA）で解く
  //   P = Q + AᵀPA − AᵀPB (R + BᵀPB)⁻¹ BᵀPA
  function dare(A, B, Q, R) {
    const n = A.length;
    const Rinv = inv(R);
    let Ak = copy(A);
    let G = mul(mul(B, Rinv), T(B));
    let H = copy(Q);
    const I = eye(n);
    for (let it = 0; it < 80; it++) {
      const W = inv(add(I, mul(G, H)));
      const AW = mul(Ak, W);
      const A1 = mul(AW, Ak);
      const G1 = add(G, mul(mul(AW, G), T(Ak)));
      const H1 = add(H, mul(mul(T(Ak), H), mul(W, Ak)));
      const diff = norm1(sub(H1, H)) / Math.max(1e-300, norm1(H1));
      Ak = A1; G = G1; H = H1;
      if (diff < 1e-13) break;
    }
    const P = scale(add(H, T(H)), 0.5);
    const BtP = mul(T(B), P);
    const K = mul(inv(add(R, mul(BtP, B))), mul(BtP, A));
    return { P, K };
  }

  // 実行列の固有値：ヘッセンベルグ化（elmhes）＋ フランシスの二重シフト QR（hqr）
  // Numerical Recipes の手順を 1 始まりの添字のまま移したもの。
  function eig(A0) {
    const n = A0.length;
    const a = zeros(n + 1);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i + 1][j + 1] = A0[i][j];

    // elmhes
    for (let m = 2; m < n; m++) {
      let x = 0, i = m;
      for (let j = m; j <= n; j++)
        if (Math.abs(a[j][m - 1]) > Math.abs(x)) { x = a[j][m - 1]; i = j; }
      if (i !== m) {
        for (let j = m - 1; j <= n; j++) [a[i][j], a[m][j]] = [a[m][j], a[i][j]];
        for (let j = 1; j <= n; j++) [a[j][i], a[j][m]] = [a[j][m], a[j][i]];
      }
      if (x) {
        for (i = m + 1; i <= n; i++) {
          let y = a[i][m - 1];
          if (y !== 0) {
            y /= x;
            a[i][m - 1] = y;
            for (let j = m; j <= n; j++) a[i][j] -= y * a[m][j];
            for (let j = 1; j <= n; j++) a[j][m] += y * a[j][i];
          }
        }
      }
    }
    for (let i = 3; i <= n; i++) for (let j = 1; j <= i - 2; j++) a[i][j] = 0;

    // hqr
    const wr = new Array(n + 1).fill(0), wi = new Array(n + 1).fill(0);
    const sign = (x, y) => (y >= 0 ? Math.abs(x) : -Math.abs(x));
    let anorm = 0;
    for (let i = 1; i <= n; i++)
      for (let j = Math.max(i - 1, 1); j <= n; j++) anorm += Math.abs(a[i][j]);
    let nn = n, t = 0;
    let p = 0, q = 0, r = 0, s = 0, w = 0, x = 0, y = 0, z = 0;
    while (nn >= 1) {
      let its = 0, l;
      do {
        for (l = nn; l >= 2; l--) {
          s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l]);
          if (s === 0) s = anorm;
          if (Math.abs(a[l][l - 1]) + s === s) { a[l][l - 1] = 0; break; }
        }
        x = a[nn][nn];
        if (l === nn) {
          wr[nn] = x + t; wi[nn--] = 0;
        } else {
          y = a[nn - 1][nn - 1];
          w = a[nn][nn - 1] * a[nn - 1][nn];
          if (l === nn - 1) {
            p = 0.5 * (y - x);
            q = p * p + w;
            z = Math.sqrt(Math.abs(q));
            x += t;
            if (q >= 0) {
              z = p + sign(z, p);
              wr[nn - 1] = wr[nn] = x + z;
              if (z) wr[nn] = x - w / z;
              wi[nn - 1] = wi[nn] = 0;
            } else {
              wr[nn - 1] = wr[nn] = x + p;
              wi[nn - 1] = -(wi[nn] = z);
            }
            nn -= 2;
          } else {
            if (its === 60) return null;
            if (its === 10 || its === 20) {
              t += x;
              for (let i = 1; i <= nn; i++) a[i][i] -= x;
              s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2]);
              y = x = 0.75 * s;
              w = -0.4375 * s * s;
            }
            ++its;
            let m;
            for (m = nn - 2; m >= l; m--) {
              z = a[m][m];
              r = x - z;
              s = y - z;
              p = (r * s - w) / a[m + 1][m] + a[m][m + 1];
              q = a[m + 1][m + 1] - z - r - s;
              r = a[m + 2][m + 1];
              s = Math.abs(p) + Math.abs(q) + Math.abs(r);
              p /= s; q /= s; r /= s;
              if (m === l) break;
              const u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r));
              const v = Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1]));
              if (u + v === v) break;
            }
            for (let i = m + 2; i <= nn; i++) {
              a[i][i - 2] = 0;
              if (i !== m + 2) a[i][i - 3] = 0;
            }
            for (let k = m; k <= nn - 1; k++) {
              if (k !== m) {
                p = a[k][k - 1];
                q = a[k + 1][k - 1];
                r = 0;
                if (k !== nn - 1) r = a[k + 2][k - 1];
                if ((x = Math.abs(p) + Math.abs(q) + Math.abs(r)) !== 0) {
                  p /= x; q /= x; r /= x;
                }
              }
              if ((s = sign(Math.sqrt(p * p + q * q + r * r), p)) !== 0) {
                if (k === m) {
                  if (l !== m) a[k][k - 1] = -a[k][k - 1];
                } else a[k][k - 1] = -s * x;
                p += s;
                x = p / s; y = q / s; z = r / s;
                q /= p; r /= p;
                for (let j = k; j <= nn; j++) {
                  p = a[k][j] + q * a[k + 1][j];
                  if (k !== nn - 1) {
                    p += r * a[k + 2][j];
                    a[k + 2][j] -= p * z;
                  }
                  a[k + 1][j] -= p * y;
                  a[k][j] -= p * x;
                }
                const mmin = nn < k + 3 ? nn : k + 3;
                for (let i = l; i <= mmin; i++) {
                  p = x * a[i][k] + y * a[i][k + 1];
                  if (k !== nn - 1) {
                    p += z * a[i][k + 2];
                    a[i][k + 2] -= p * r;
                  }
                  a[i][k + 1] -= p * q;
                  a[i][k] -= p;
                }
              }
            }
          }
        }
      } while (l < nn - 1);
    }
    const out = [];
    for (let i = 1; i <= n; i++) out.push({ re: wr[i], im: wi[i] });
    return out;
  }

  root.LA = { zeros, eye, copy, T, mul, add, sub, scale, inv, expm, c2d, dare, eig };
  if (typeof module !== "undefined") module.exports = root.LA;
})(typeof window !== "undefined" ? window : globalThis);
