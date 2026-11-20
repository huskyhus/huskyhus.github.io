// 古典制御の題材：ロボット関節のサーボ（モーター ─ ねじれる軸 ─ 腕）。
//   Jm θ̈m = τ − k(θm − θl) − c(θ̇m − θ̇l) − bm θ̇m
//   Jl θ̈l = k(θm − θl) + c(θ̇m − θ̇l) − bl θ̇l + d     （d：腕に加わる外乱トルク）
//   制御器：C(s) = Kp + Ki/s + Kd s/(τf s + 1)、必要ならノッチ N(s)、むだ時間 e^{−sTd}、トルク飽和。
//   時間応答では微分を測定値にかける（目標が跳んでもトルクが跳ねない「微分先行型」）。
//   閉ループの極（安定性）と一巡伝達関数は、微分を偏差にかける形と同じになる。
(function (root) {
  "use strict";
  const LA = root.LA || require("../linalg.js");
  const LTI = root.LTI || require("../lti.js");
  const PL = root.PL || require("../plot.js");
  const Cx = PL.Cx;

  const DEFAULT = {
    Jm: 0.004, Jl: 0.012, k: 26.6, zr: 0.01, bm: 0.002, bl: 0.0005, // 共振 ≒ 15 Hz、反共振 ≒ 7.5 Hz
    Kp: 3, Ki: 5, Kd: 0.25, tf: 0.002,
    notch: false, fn: 15, // ノッチの中心周波数 [Hz]
    Td: 0.002,            // むだ時間 [s]（計算・通信・PWM の遅れ）
    sensor: "motor",      // "motor"（コロケーション）| "load"（腕の角度を測る）
    tmax: 2, antiwindup: true,
  };

  // 軸の減衰係数 c は、共振の減衰比 zr から決める
  function damping(p) {
    const wr = Math.sqrt(p.k * (1 / p.Jm + 1 / p.Jl));
    return (2 * p.zr * p.k) / wr;
  }
  const resonanceHz = (p) => Math.sqrt(p.k * (1 / p.Jm + 1 / p.Jl)) / (2 * Math.PI);
  const antiResonanceHz = (p) => Math.sqrt(p.k / p.Jl) / (2 * Math.PI);

  // 対象の状態空間：x = [θm, θl, ωm, ωl]、入力 [τ, d]、出力 [θm, θl]
  function plantSS(p) {
    const c = damping(p), { Jm, Jl, k, bm, bl } = p;
    const A = [
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [-k / Jm, k / Jm, -(c + bm) / Jm, c / Jm],
      [k / Jl, -k / Jl, c / Jl, -(c + bl) / Jl],
    ];
    const B = [[0, 0], [0, 0], [1 / Jm, 0], [0, 1 / Jl]];
    const C = [[1, 0, 0, 0], [0, 1, 0, 0]];
    return LTI.ss(A, B, C, [[0, 0], [0, 0]]);
  }
  const sensorIdx = (p) => (p.sensor === "load" ? 1 : 0);

  // 制御器の伝達関数（PID とノッチ）を周波数で評価
  function pidJ(p, w) {
    const s = [0, w];
    const I = Cx.div([p.Ki, 0], s);
    const D = Cx.div(Cx.scale(s, p.Kd), Cx.add([1, 0], Cx.scale(s, p.tf)));
    return Cx.add(Cx.add([p.Kp, 0], I), D);
  }
  function notchTF(p) {
    const wn = 2 * Math.PI * p.fn, zz = 0.05, zp = 0.6;
    return { num: [1, 2 * zz * wn, wn * wn], den: [1, 2 * zp * wn, wn * wn] };
  }
  function notchJ(p, w) {
    if (!p.notch) return [1, 0];
    const t = notchTF(p), s = [0, w];
    return Cx.div(PL.polyval(t.num, s), PL.polyval(t.den, s));
  }

  // 一巡伝達関数 L(jω) = C N P e^{−jωTd}
  function loopJ(p, w, P = plantSS(p)) {
    const Pj = LTI.freq(P, w, 0, sensorIdx(p));
    return Cx.mul(Cx.mul(Cx.mul(pidJ(p, w), notchJ(p, w)), Pj), Cx.expj(-w * p.Td));
  }

  // ボード線図用のデータと、安定余裕
  function analyze(p, w0 = 1, w1 = 3000, n = 600) {
    const P = plantSS(p);
    const ws = PL.logspace(w0, w1, n);
    const L = ws.map((w) => loopJ(p, w, P));
    const mag = L.map((z) => 20 * Math.log10(Cx.abs(z)));
    const ph = PL.unwrapDeg(L.map((z) => (Cx.arg(z) * 180) / Math.PI));
    // 位相を −180° 付近に正規化（積分があるので低域で −180〜−90 に来るようにそろえる）
    const shift = 360 * Math.round((ph[0] + 135) / 360);
    for (let i = 0; i < ph.length; i++) ph[i] -= shift;
    const S = L.map((z) => 20 * Math.log10(1 / Cx.abs(Cx.add([1, 0], z))));
    // ゲイン交差（|L| = 1）と位相交差（∠L = −180° − 360°k）
    const gc = [], pc = [];
    for (let i = 1; i < n; i++) {
      if ((mag[i - 1] > 0) !== (mag[i] > 0)) {
        const a = mag[i - 1] / (mag[i - 1] - mag[i]);
        const w = ws[i - 1] * Math.pow(ws[i] / ws[i - 1], a);
        gc.push({ w, pm: 180 + (ph[i - 1] + a * (ph[i] - ph[i - 1])) });
      }
      const f0 = (ph[i - 1] + 180) / 360, f1 = (ph[i] + 180) / 360;
      if (Math.floor(f0) !== Math.floor(f1)) {
        const target = 360 * Math.max(Math.floor(f0), Math.floor(f1)) - 180;
        const a = (target - ph[i - 1]) / (ph[i] - ph[i - 1]);
        const w = ws[i - 1] * Math.pow(ws[i] / ws[i - 1], a);
        pc.push({ w, gm: -(mag[i - 1] + a * (mag[i] - mag[i - 1])) });
      }
    }
    // 位相余裕：各ゲイン交差で −180° までの角度（±180° に折り返す）のうち、いちばん小さいもの
    const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
    let pmv = Infinity, wpm = NaN;
    for (const g of gc) { g.pm = wrap180(g.pm); if (Math.abs(g.pm) < Math.abs(pmv)) { pmv = g.pm; wpm = g.w; } }
    // ゲイン余裕：位相交差で |L| < 1 なら「上げられる量」、|L| > 1 なら「下げられる量」（条件つき安定）
    const ups = pc.filter((g) => g.gm > 0), downs = pc.filter((g) => g.gm < 0);
    const gmv = ups.length ? Math.min(...ups.map((g) => g.gm)) : Infinity;
    const gmDown = downs.length ? Math.max(...downs.map((g) => g.gm)) : -Infinity;
    const wc = gc.length ? gc[0].w : NaN;
    const peakS = Math.max(...S);
    return { ws, L, mag, ph, S, gc, pc, pm: pmv, wpm, gm: gmv, gmDown, wc, peakS, stable: closedLoopStable(p, P) };
  }

  // 制御器の状態空間（PID ＋ ノッチ）：入力 e、出力 u
  function controllerSS(p) {
    const tf = p.tf;
    // 積分がないときは s を約分しておく（原点の極と零点の打ち消しを残さない）
    const num = p.Ki ? [p.Kp * tf + p.Kd, p.Kp + p.Ki * tf, p.Ki] : [p.Kp * tf + p.Kd, p.Kp];
    const den = p.Ki ? [tf, 1, 0] : [tf, 1];
    let K = LTI.tf2ss(num, den);
    if (p.notch) { const t = notchTF(p); K = LTI.series(K, LTI.tf2ss(t.num, t.den)); }
    return K;
  }

  // 閉ループ（線形、むだ時間は 2 次パデ近似）の状態空間：入力 [r, d]、出力 [θm, θl, τ]
  function closedLoop(p, P = plantSS(p)) {
    const K = controllerSS(p), Dl = LTI.pade2(p.Td);
    const nk = LTI.nx(K), nd = LTI.nx(Dl), np = 4, n = nk + nd + np;
    const si = sensorIdx(p);
    const A = LTI.zeros(n, n), B = LTI.zeros(n, 2), C = LTI.zeros(3, n), D = LTI.zeros(3, 2);
    const Cp = P.C[si];
    // 制御器：xk' = Ak xk + Bk (r − Cp xp)、u = Ck xk + Dk (r − Cp xp)
    const Dk = K.D[0][0], Dd = Dl.D[0][0];
    for (let i = 0; i < nk; i++) {
      for (let j = 0; j < nk; j++) A[i][j] = K.A[i][j];
      for (let j = 0; j < np; j++) A[i][nk + nd + j] = -K.B[i][0] * Cp[j];
      B[i][0] = K.B[i][0];
    }
    // u を行ベクトルで表す：u = uk·xk + ux·xp + Dk r
    const uk = nk ? K.C[0] : [], ux = Cp.map((v) => -Dk * v);
    // むだ時間：xd' = Ad xd + Bd u、τ = Cd xd + Dd u
    for (let i = 0; i < nd; i++) {
      for (let j = 0; j < nd; j++) A[nk + i][nk + j] = Dl.A[i][j];
      for (let j = 0; j < nk; j++) A[nk + i][j] += Dl.B[i][0] * uk[j];
      for (let j = 0; j < np; j++) A[nk + i][nk + nd + j] += Dl.B[i][0] * ux[j];
      B[nk + i][0] = Dl.B[i][0] * Dk;
    }
    // τ = tauX · [xk, xd, xp] + Dd Dk r
    const tauX = new Array(n).fill(0);
    for (let j = 0; j < nk; j++) tauX[j] = Dd * uk[j];
    for (let j = 0; j < nd; j++) tauX[nk + j] = nd ? Dl.C[0][j] : 0;
    for (let j = 0; j < np; j++) tauX[nk + nd + j] = Dd * ux[j];
    const tauR = Dd * Dk;
    // 対象：xp' = Ap xp + Bp [τ, d]
    for (let i = 0; i < np; i++) {
      for (let j = 0; j < np; j++) A[nk + nd + i][nk + nd + j] += P.A[i][j];
      for (let j = 0; j < n; j++) A[nk + nd + i][j] += P.B[i][0] * tauX[j];
      B[nk + nd + i][0] += P.B[i][0] * tauR;
      B[nk + nd + i][1] += P.B[i][1];
    }
    C[0][nk + nd] = 1;
    C[1][nk + nd + 1] = 1;
    for (let j = 0; j < n; j++) C[2][j] = tauX[j];
    D[2][0] = tauR;
    return LTI.ss(A, B, C, D);
  }
  function closedLoopStable(p, P) {
    const cl = closedLoop(p, P);
    const ps = LTI.poles(cl);
    return { ok: ps.every((z) => z.re < -1e-6), poles: ps };
  }

  // ステップ応答（飽和なし、むだ時間は厳密）と、その指標。目標 1 rad、腕の角度で評価する
  function stepInfo(p, T = 1, h = 0.0002) {
    const sim = new ServoSim({ ...p, tmax: Infinity });
    sim.r = 1;
    const t = [], y = [], ym = [], tau = [];
    const N = Math.round(T / h), every = 5;
    for (let i = 0; i <= N; i++) {
      if (i % every === 0) { t.push(sim.t); y.push(sim.x[1]); ym.push(sim.x[0]); tau.push(sim.tau); }
      sim.step(h);
      if (!Number.isFinite(sim.x[1]) || Math.abs(sim.x[1]) > 1e3) break;
    }
    const peak = Math.max(...y);
    let rise = NaN, settle = 0;
    for (let i = 0; i < y.length; i++) if (y[i] >= 0.9) { rise = t[i]; break; }
    for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - 1) > 0.02) { settle = t[i]; break; }
    return { t, y, ym, tau, overshoot: (peak - 1) * 100, rise, settle, final: y[y.length - 1] };
  }

  // 時間応答のシミュレータ（非線形：飽和と積分の巻き上がり、むだ時間はバッファ）
  class ServoSim {
    constructor(p) { this.setParams(p); this.reset(); }
    setParams(p) {
      this.p = { ...p };
      this.c = damping(p);
      const t = notchTF(p);
      this.N = p.notch ? LTI.tf2ss(t.num, t.den) : null;
      if (this.xn && (this.N ? 2 : 0) !== this.xn.length) this.xn = this.N ? [0, 0] : [];
    }
    reset() {
      this.x = [0, 0, 0, 0];   // θm, θl, ωm, ωl
      this.xi = 0; this.xf = 0; // 積分、微分フィルタ（測定値をフィルタしたもの）
      this.xn = this.N ? [0, 0] : [];
      this.t = 0; this.r = 0; this.d = 0;
      this.buf = []; this.tau = 0; this.sat = false; this.u = 0;
    }
    deriv(x, tau) {
      const { Jm, Jl, k, bm, bl } = this.p, c = this.c;
      const tw = k * (x[0] - x[1]) + c * (x[2] - x[3]);
      return [x[2], x[3], (tau - tw - bm * x[2]) / Jm, (tw - bl * x[3] + this.d) / Jl];
    }
    step(h) {
      const p = this.p;
      const y = this.x[sensorIdx(p)];
      const e = this.r - y;
      // PID（微分は測定値に、1 次フィルタつきでかける）
      const dterm = (-p.Kd * (y - this.xf)) / p.tf;
      let u = p.Kp * e + p.Ki * this.xi + dterm;
      // ノッチ
      if (this.N) {
        const N = this.N, z = this.xn;
        const out = N.C[0][0] * z[0] + N.C[0][1] * z[1] + N.D[0][0] * u;
        const dz = [N.A[0][0] * z[0] + N.A[0][1] * z[1] + N.B[0][0] * u, N.A[1][0] * z[0] + N.A[1][1] * z[1] + N.B[1][0] * u];
        this.xn = [z[0] + h * dz[0], z[1] + h * dz[1]];
        u = out;
      }
      this.u = u;
      // むだ時間
      const nDelay = Math.round(p.Td / h);
      this.buf.push(u);
      const ud = this.buf.length > nDelay ? this.buf.shift() : 0;
      const tau = Math.max(-p.tmax, Math.min(p.tmax, ud));
      this.sat = Math.abs(ud) > p.tmax;
      this.tau = tau;
      // 積分（飽和中に同じ向きへ積み増すのを止める＝条件付き積分）
      if (!(p.antiwindup && this.sat && Math.sign(e) === Math.sign(ud))) this.xi += h * e;
      this.xf += (h * (y - this.xf)) / p.tf;
      // 対象（RK4）
      const x = this.x;
      const k1 = this.deriv(x, tau);
      const k2 = this.deriv(x.map((v, i) => v + (h / 2) * k1[i]), tau);
      const k3 = this.deriv(x.map((v, i) => v + (h / 2) * k2[i]), tau);
      const k4 = this.deriv(x.map((v, i) => v + h * k3[i]), tau);
      this.x = x.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      this.t += h;
    }
  }

  root.Servo = { DEFAULT, plantSS, loopJ, pidJ, notchJ, analyze, controllerSS, closedLoop, stepInfo, ServoSim, resonanceHz, antiResonanceHz, sensorIdx };
  if (typeof module !== "undefined") module.exports = root.Servo;
})(typeof window !== "undefined" ? window : globalThis);
