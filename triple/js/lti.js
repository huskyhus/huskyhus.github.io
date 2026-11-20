// 線形時不変系の小道具：状態空間表現 {A, B, C, D}（配列の配列）。
//   周波数応答、直列・フィードバック結合、極、時間応答のシミュレーション。
(function (root) {
  "use strict";
  const LA = root.LA || require("./linalg.js");

  const zeros = (n, m) => Array.from({ length: n }, () => new Array(m).fill(0));
  const ss = (A, B, C, D) => ({ A, B, C, D: D || zeros(C.length, B[0] ? B[0].length : 0) });
  const nx = (s) => s.A.length;
  const nu = (s) => s.B[0] ? s.B[0].length : s.D[0].length;
  const ny = (s) => s.C.length ? s.C.length : s.D.length;

  // 伝達関数 num/den（係数は高次から）→ 可制御正準形の状態空間（真にプロパーでなくてもよい：次数が等しい場合は D に出す）
  function tf2ss(num, den) {
    const a0 = den[0];
    den = den.map((v) => v / a0);
    num = num.map((v) => v / a0);
    const n = den.length - 1;
    while (num.length < n + 1) num.unshift(0);
    const d = num[0];
    const b = num.slice(1).map((v, i) => v - d * den[i + 1]);
    if (n === 0) return ss([], [], [], [[d]]);
    const A = zeros(n, n);
    for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
    for (let j = 0; j < n; j++) A[n - 1][j] = -den[n - j];
    const B = zeros(n, 1); B[n - 1][0] = 1;
    const C = [new Array(n).fill(0)];
    for (let j = 0; j < n; j++) C[0][j] = b[n - 1 - j];
    return ss(A, B, C, [[d]]);
  }

  // 直列：u → s1 → s2 → y
  function series(s1, s2) {
    const n1 = nx(s1), n2 = nx(s2), m = nu(s1), p = ny(s2);
    const A = zeros(n1 + n2, n1 + n2), B = zeros(n1 + n2, m), C = zeros(p, n1 + n2);
    for (let i = 0; i < n1; i++) { for (let j = 0; j < n1; j++) A[i][j] = s1.A[i][j]; for (let j = 0; j < m; j++) B[i][j] = s1.B[i][j]; }
    const B2C1 = n2 && n1 ? LA.mul(s2.B, s1.C) : zeros(n2, n1);
    const B2D1 = n2 ? LA.mul(s2.B, s1.D) : zeros(n2, m);
    for (let i = 0; i < n2; i++) {
      for (let j = 0; j < n1; j++) A[n1 + i][j] = B2C1[i][j];
      for (let j = 0; j < n2; j++) A[n1 + i][n1 + j] = s2.A[i][j];
      for (let j = 0; j < m; j++) B[n1 + i][j] = B2D1[i][j];
    }
    const D2C1 = n1 ? LA.mul(s2.D, s1.C) : zeros(p, 0);
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < n1; j++) C[i][j] = D2C1[i][j];
      for (let j = 0; j < n2; j++) C[i][n1 + j] = s2.C[i][j];
    }
    return ss(A, B, C, LA.mul(s2.D, s1.D));
  }

  // 周波数応答 G(jω) = C (jωI − A)⁻¹ B + D（1 入力 1 出力、[re, im] を返す）
  function freq(s, w, iu = 0, iy = 0) {
    const n = nx(s);
    if (n === 0) return [s.D[iy][iu], 0];
    // 実数 2n 次元の連立方程式に直して解く：[−A  −ωI; ωI  −A] [xr; xi] = [B; 0]
    const M = zeros(2 * n, 2 * n + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) { M[i][j] = -s.A[i][j]; M[n + i][n + j] = -s.A[i][j]; }
      M[i][n + i] = -w; M[n + i][i] = w;
      M[i][2 * n] = s.B[i][iu];
    }
    // ガウスの消去法（部分ピボット）
    const N = 2 * n;
    for (let c = 0; c < N; c++) {
      let p = c;
      for (let r = c + 1; r < N; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c];
      if (d === 0) return [NaN, NaN];
      for (let r = c + 1; r < N; r++) {
        const f = M[r][c] / d;
        if (f) for (let k = c; k <= N; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(N).fill(0);
    for (let r = N - 1; r >= 0; r--) {
      let v = M[r][N];
      for (let k = r + 1; k < N; k++) v -= M[r][k] * x[k];
      x[r] = v / M[r][r];
    }
    let re = s.D[iy][iu], im = 0;
    for (let i = 0; i < n; i++) { re += s.C[iy][i] * x[i]; im += s.C[iy][i] * x[n + i]; }
    return [re, im];
  }

  const poles = (s) => (nx(s) ? LA.eig(s.A) || [] : []);
  const isStable = (s, tol = -1e-9) => poles(s).every((p) => p.re < tol);

  // RK4 で x' = A x + B u(t) を進める（u は時刻の関数、一定刻み）
  function simulate(s, uFn, T, h, x0) {
    const n = nx(s);
    let x = x0 ? x0.slice() : new Array(n).fill(0);
    const f = (xx, uu) => s.A.map((row, i) => row.reduce((a, v, j) => a + v * xx[j], 0) + s.B[i].reduce((a, v, j) => a + v * uu[j], 0));
    const out = { t: [], y: [] };
    const N = Math.round(T / h);
    for (let k = 0; k <= N; k++) {
      const t = k * h, u = uFn(t);
      out.t.push(t);
      out.y.push(s.C.map((row, i) => row.reduce((a, v, j) => a + v * x[j], 0) + s.D[i].reduce((a, v, j) => a + v * u[j], 0)));
      if (k === N) break;
      const u2 = uFn(t + h / 2), u3 = uFn(t + h);
      const k1 = f(x, u), k2 = f(x.map((v, i) => v + (h / 2) * k1[i]), u2);
      const k3 = f(x.map((v, i) => v + (h / 2) * k2[i]), u2), k4 = f(x.map((v, i) => v + h * k3[i]), u3);
      x = x.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }
    return out;
  }

  // 2 次のパデ近似によるむだ時間 e^{−sT}
  const pade2 = (T) => (T <= 0 ? ss([], [], [], [[1]]) : tf2ss([T * T / 12, -T / 2, 1], [T * T / 12, T / 2, 1]));

  root.LTI = { zeros, ss, tf2ss, series, freq, poles, isStable, simulate, pade2, nx, nu, ny };
  if (typeof module !== "undefined") module.exports = root.LTI;
})(typeof window !== "undefined" ? window : globalThis);
