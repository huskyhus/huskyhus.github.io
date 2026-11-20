// 制御器と状態推定、シミュレータ。
//   ・軌道追従：計画した軌道まわりの時変 LQR（離散時間、制御周期 TS）
//   ・倒立の維持／スタート前の静止：平衡点での定常 LQR
//   ・状態推定：位置（x, θ1, θ2, θ3）だけを雑音つきで観測し、拡張カルマンフィルタで速度も推定
//   ・現実の不完全さ（cfg.noise と cfg.reality）
//       観測雑音 σx, σθ／モーター出力雑音 σu（制御周期ごとに独立な正規乱数）
//       モデル誤差：実機の質量・長さが名目値から正規分布でばらつく、関節摩擦が名目の何倍か
//       むだ時間：計算した指令が実際に効くまでの遅れ（制御周期の整数倍）。予測で補償することもできる
//       エンコーダの量子化：角度が 1 回転あたり ppr カウントに丸められる
//   制御器と推定器は名目モデルしか知らない。
(function (root) {
  "use strict";
  const TM = root.TM || require("./model.js");
  const LA = root.LA || require("./linalg.js");
  const Planner = root.Planner || require("./planner.js");

  const TS = 0.002;      // 制御周期 [s]
  const SUB = 4;         // 1 周期あたりの RK4 ステップ（0.5 ms、プランナーと同じ刻み）
  const TAU = 2 * Math.PI;
  const wrap = (a) => a - TAU * Math.round(a / TAU);
  const LOST_TRACK = 1.2; // 計画軌道からのずれがこれを超えたら失敗 [rad]
  const LOST_HOLD = 0.9;  // 倒立からのずれがこれを超えたら失敗 [rad]
  const FROZEN_STRIDE = 10; // 凍結した極を記録する間隔（制御周期の数）
  // 立て直しの設定：エネルギーを抜くゲイン k と上限 umax、台車を中央へ戻す強さ kx, kv、
  // レールの安全フィルタ（ブレーキ brake [m/s²]、余白 margin [m]）、下の LQR へ引き継ぐ条件（hand*）、
  // 振り上げ直す条件（下で calmTime 秒、角度・速度・位置が calm* 以内）
  const RECOVER = {
    k: 10, umax: 15, kx: 4, kv: 4, brake: 30, margin: 0.1,
    handAngle: 1.0, handVel: 4, calmAngle: 0.05, calmVel: 0.15, calmX: 0.05, calmTime: 0.5,
  };

  // ---------------------------------------------------------------- 設計
  function weightMats(w) {
    const q = [w.qx, w.qth, w.qth, w.qth, w.qv, w.qv, w.qv, w.qv];
    const Q = LA.zeros(8);
    q.forEach((v, i) => (Q[i][i] = v * TS));
    return { Q, R: [[w.r * TS]] };
  }

  function stationaryLQR(md, code, w) {
    const eq = TM.equilibrium(code);
    const { A, B } = TM.linearize(md, eq, 0);
    const { Ad, Bd } = LA.c2d(A, B, TS);
    const { Q, R } = weightMats(w);
    const { K, P } = LA.dare(Ad, Bd, Q, R);
    const zs = LA.eig(LA.sub(Ad, LA.mul(Bd, K))) || [];
    const closed = zs.map((z) => ({ re: Math.log(Math.hypot(z.re, z.im)) / TS, im: Math.atan2(z.im, z.re) / TS }));
    const open = LA.eig(A) || [];
    return { code, eq, K: Float64Array.from(K[0]), P, closed, open };
  }

  // 計画した軌道に沿って離散時間リッカチ方程式を後ろ向きに解く
  function buildController(prob, z, w) {
    const md = prob.md;
    const traj = Planner.sampleTrajectory(prob, z, TS);
    const N = traj.xs.length - 1;
    const { Q, R } = weightMats(w);
    const up = stationaryLQR(md, "UUU", w);
    const down = stationaryLQR(md, "DDD", w);
    let P = up.P;
    const Ks = new Array(N);
    // 「凍結した極」：各時刻の線形化 A(t) と閉ループ A(t) − B(t)K(t) の固有値（表示用、FROZEN_STRIDE 周期ごと）。
    // 時変系では、これが全部左半平面にあっても安定とは限らず、逆も言えない。あくまで参考。
    const frozen = [];
    for (let k = N - 1; k >= 0; k--) {
      const { A, B } = TM.linearize(md, traj.xs[k], traj.us[k]);
      const { Ad, Bd } = LA.c2d(A, B, TS);
      const BtP = LA.mul(LA.T(Bd), P);
      const den = R[0][0] + LA.mul(BtP, Bd)[0][0];
      const K = LA.scale(LA.mul(BtP, Ad), 1 / den);
      const Acl = LA.sub(Ad, LA.mul(Bd, K));
      if (k % FROZEN_STRIDE === 0) {
        const zs = LA.eig(Acl) || [];
        frozen[k / FROZEN_STRIDE] = {
          k,
          open: LA.eig(A) || [],
          closed: zs.map((z) => ({ re: Math.log(Math.hypot(z.re, z.im)) / TS, im: Math.atan2(z.im, z.re) / TS })),
        };
      }
      P = LA.add(Q, LA.mul(LA.mul(LA.T(Ad), P), Acl));
      P = LA.scale(LA.add(P, LA.T(P)), 0.5);
      Ks[k] = Float64Array.from(K[0]);
    }
    return { prob, md, traj, Ks, up, down, N, T: prob.T, weights: { ...w }, frozen };
  }

  // ---------------------------------------------------------------- 乱数
  function makeRng(seed) {
    let a = seed >>> 0 || 0x9e3779b9;
    const uni = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let spare = null;
    const gauss = () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0;
      while (u === 0) u = uni();
      v = uni();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(TAU * v);
      return r * Math.cos(TAU * v);
    };
    return { uni, gauss };
  }

  // ---------------------------------------------------------------- 8×8 の小道具（行優先 Float64Array）
  function mm(A, B, n, k, m, out) {
    out = out || new Float64Array(n * m);
    out.fill(0);
    for (let i = 0; i < n; i++)
      for (let p = 0; p < k; p++) {
        const a = A[i * k + p];
        if (a === 0) continue;
        for (let j = 0; j < m; j++) out[i * m + j] += a * B[p * m + j];
      }
    return out;
  }
  function transpose(A, n, m) {
    const out = new Float64Array(n * m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[j * n + i] = A[i * m + j];
    return out;
  }
  function inv4(S) {
    const A = Array.from({ length: 4 }, (_, i) => Array.from(S.subarray(i * 4, i * 4 + 4)));
    return Float64Array.from(LA.inv(A).flat());
  }

  // ---------------------------------------------------------------- 実機のパラメータ
  const REALITY0 = { massErr: 0, lenErr: 0, fric: 1, delay: 0, comp: false, ppr: 0 };

  // 名目のパラメータから、ばらつきを乗せた「実機」のパラメータを引く
  function drawPlant(params, reality, rng) {
    const m = params.m.map((v) => v * Math.max(0.2, 1 + reality.massErr * rng.gauss()));
    const l = params.l.map((v) => v * Math.max(0.3, 1 + reality.lenErr * rng.gauss()));
    const d = params.d.map((v) => v * reality.fric);
    return { g: params.g, m, l, d };
  }

  // ---------------------------------------------------------------- シミュレータ
  class Sim {
    constructor(ctrl, cfg = {}) {
      this.ctrl = ctrl;
      this.nom = ctrl.md; // 制御器と推定器が使う名目モデル
      this.noise = { sx: 0, sth: 0, su: 0, ...(cfg.noise || {}) };
      this.reality = { ...REALITY0, ...(cfg.reality || {}) };
      this.estimator = cfg.estimator || "ekf";
      // 推定器が見込むモデルの不確かさ：角加速度に加わる未知の外乱の標準偏差 [rad/s²]（プロセス雑音の上乗せ）
      this.ekfQa = cfg.ekfQa || 0;
      this.feedback = cfg.feedback !== false;
      // 倒れたら自動で立て直す：エネルギーを抜いて下で静止させ、同じ台本でもう一度振り上げる
      this.autoRecover = !!cfg.autoRecover;
      this.maxRetries = cfg.maxRetries ?? 5;
      this.rc = { ...RECOVER, ...(cfg.recover || {}) };
      const seed = cfg.seed || 1;
      this.rng = makeRng(seed);
      this.plantParams = drawPlant(ctrl.prob.spec.params, this.reality, makeRng(seed * 7919 + 13));
      this.md = TM.makeModel(this.plantParams); // 実機
      this.plantStep = TM.makeIntegrator(this.md);
      this.estStep = TM.makeIntegrator(this.nom);
      this.predStep = TM.makeIntegrator(this.nom);
      this.uLimit = 1.25 * ctrl.prob.spec.umax;
      this.rail = ctrl.prob.spec.xmax + 0.05;
      this.f0 = new Float64Array(8);
      this.f1 = new Float64Array(8);
      this.reset();
    }

    reset() {
      this.s = Float64Array.from(TM.equilibrium("DDD"));
      this.est = Float64Array.from(this.s);
      this.Pc = new Float64Array(64);
      for (let i = 0; i < 8; i++) this.Pc[i * 9] = 1e-8;
      this.k = 0;
      this.mode = "pre";
      this.k0 = 0;
      this.started = false;
      this.off = [0, 0, 0];
      this.u = 0; this.uCmd = 0; this.sat = false;
      this.ref = null;
      this.hitRail = false;
      this.hitAt = -1;
      this.lostAt = -1;
      this.peakTrack = 0;  // 追従中の角度ずれの最大値（真値と計画）[rad]
      this.peakHold = 0;   // 倒立維持中の角度ずれの最大値 [rad]
      this.peakEst = 0;    // 推定誤差（角度）の最大値 [rad]
      this.retries = 0;    // 自動で振り上げ直した回数
      this.settleK = 0;    // 下で静止している周期の数
      this.recovering = false;
      // むだ時間：発行済みでまだ効いていない指令の待ち行列
      this.queue = Array.from({ length: this.reality.delay }, () => ({ ffTau: null, ufb: 0 }));
    }

    get t() { return this.k * TS; }
    get tau() { return (this.k - this.k0) * TS; }

    startSwing() {
      if (this.mode !== "pre") this.reset();
      const x0 = this.ctrl.traj.xs[0];
      this.off = [0, 1, 2].map((j) => TAU * Math.round((this.est[1 + j] - x0[1 + j]) / TAU));
      this.mode = "track";
      this.started = true;
      this.k0 = this.k;
      this.peakTrack = 0;
      this.peakHold = 0;
    }

    // 外乱：リンク i の角速度に dω を加える。推定器にも「何かあった」と知らせる。
    poke(i, dw) {
      this.s[5 + i] += dw;
      this.Pc[(5 + i) * 9] += dw * dw;
    }

    // 指令（待ち行列の 1 要素）から、その周期の中の時刻 dt での加速度指令を作る
    cmdFn(entry) {
      const lim = this.uLimit, prob = this.ctrl.prob, kn = this.ctrl.traj.knots;
      return (dt) => {
        const ff = entry.ffTau === null ? 0 : Planner.uAtKnots(prob, kn, entry.ffTau + dt);
        return Math.max(-lim, Math.min(lim, ff + entry.ufb));
      };
    }

    measure() {
      const { sx, sth } = this.noise, g = this.rng.gauss, s = this.s;
      const y = [s[0] + sx * g(), s[1] + sth * g(), s[2] + sth * g(), s[3] + sth * g()];
      const ppr = this.reality.ppr;
      if (ppr > 0) {
        const q = TAU / ppr;
        for (let i = 1; i < 4; i++) y[i] = q * Math.round(y[i] / q);
      }
      return y;
    }

    ekfUpdate(y) {
      const P = this.Pc;
      const ppr = this.reality.ppr;
      const qv = ppr > 0 ? (TAU / ppr) ** 2 / 12 : 0; // 量子化誤差の分散（一様分布）
      const rx = Math.max(this.noise.sx, 1e-5) ** 2, rt = Math.max(this.noise.sth, 1e-5) ** 2 + qv;
      const S = new Float64Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) S[i * 4 + j] = P[i * 8 + j];
      S[0] += rx; S[5] += rt; S[10] += rt; S[15] += rt;
      const Si = inv4(S);
      const PHt = new Float64Array(32);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) PHt[i * 4 + j] = P[i * 8 + j];
      const K = mm(PHt, Si, 8, 4, 4);
      const nu = [y[0] - this.est[0], y[1] - this.est[1], y[2] - this.est[2], y[3] - this.est[3]];
      for (let i = 0; i < 8; i++) {
        let v = 0;
        for (let j = 0; j < 4; j++) v += K[i * 4 + j] * nu[j];
        this.est[i] += v;
      }
      const HP = P.slice(0, 32);
      const KHP = mm(K, HP, 8, 4, 8);
      for (let i = 0; i < 64; i++) P[i] -= KHP[i];
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
        const v = 0.5 * (P[i * 8 + j] + P[j * 8 + i]);
        P[i * 8 + j] = v; P[j * 8 + i] = v;
      }
    }

    ekfPredict(uFn) {
      // 名目モデルで線形化（前進差分）して F ≈ I + A h + (A h)²/2、Γ ≈ (I h + A h²/2) B
      const md = this.nom, e = this.est, h = TS;
      const u0 = uFn(0);
      const A = new Float64Array(64), B = new Float64Array(8);
      TM.derivInto(md, e, u0, this.f0);
      const sp = Float64Array.from(e);
      for (let j = 0; j < 8; j++) {
        const eps = 1e-6;
        sp[j] = e[j] + eps;
        TM.derivInto(md, sp, u0, this.f1);
        for (let i = 0; i < 8; i++) A[i * 8 + j] = (this.f1[i] - this.f0[i]) / eps;
        sp[j] = e[j];
      }
      TM.derivInto(md, e, u0 + 1e-4, this.f1);
      for (let i = 0; i < 8; i++) B[i] = (this.f1[i] - this.f0[i]) / 1e-4;
      const Ah = A.map((v) => v * h);
      const Ah2 = mm(Ah, Ah, 8, 8, 8);
      const F = new Float64Array(64);
      for (let i = 0; i < 64; i++) F[i] = Ah[i] + 0.5 * Ah2[i];
      for (let i = 0; i < 8; i++) F[i * 9] += 1;
      const AB = mm(A, B, 8, 8, 1);
      const G = new Float64Array(8);
      for (let i = 0; i < 8; i++) G[i] = B[i] * h + 0.5 * AB[i] * h * h;
      const hh = TS / SUB;
      for (let j = 0; j < SUB; j++) this.estStep(e, hh, uFn(j * hh), uFn((j + 0.5) * hh), uFn((j + 1) * hh));
      const FP = mm(F, this.Pc, 8, 8, 8);
      const P = mm(FP, transpose(F, 8, 8), 8, 8, 8);
      const su2 = this.noise.su ** 2;
      const qa = (this.ekfQa * h) ** 2;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) P[i * 8 + j] += su2 * G[i] * G[j];
        P[i * 9] += i >= 5 ? 1e-10 + qa : i === 4 ? 1e-10 : 1e-12;
      }
      this.Pc = P;
    }

    // むだ時間の補償：まだ効いていない指令を名目モデルに流して、指令が効く時刻の状態を予測する
    predictAhead() {
      const p = Float64Array.from(this.est);
      for (const entry of this.queue) {
        const f = this.cmdFn(entry);
        this.predStep(p, TS, f(0), f(TS / 2), f(TS));
      }
      return p;
    }

    // 安全フィルタ：今からブレーキをかけてもレールの内側で止まれなくなるなら、ほかの目的より停止を優先する
    railGuard(u, e) {
      const room = this.ctrl.prob.spec.xmax - this.rc.margin - Math.abs(e[0]);
      const out = Math.sign(e[0]) * e[4]; // 外向きの速さ
      if (out > 0 && out * out >= 2 * this.rc.brake * Math.max(room, 0)) return -Math.sign(e[0]) * this.rc.brake;
      return u;
    }

    // 1 制御周期進める
    step() {
      const ctrl = this.ctrl;
      const d = this.reality.delay;
      const comp = this.reality.comp && d > 0;

      // 1) 観測と推定
      if (this.estimator === "ekf") this.ekfUpdate(this.measure());
      else this.est.set(this.s);
      for (let j = 1; j < 4; j++) this.peakEst = Math.max(this.peakEst, Math.abs(this.est[j] - this.s[j]));

      // 2) 制御則。補償するときは「指令が効く時刻」の状態と目標で計算する
      const e = comp ? this.predictAhead() : this.est;
      const lead = comp ? d : 0;
      const kk = this.k - this.k0;          // 今の時刻の軌道上の番号
      const kRef = kk + lead;               // この指令が効く時刻の番号
      let ufb = 0, ffTau = null;
      if (this.mode === "track" && kRef >= ctrl.N) this.mode = "hold";
      if (this.mode === "track") {
        const xr = ctrl.traj.xs[kRef], K = ctrl.Ks[kRef];
        let worst = 0;
        for (let j = 0; j < 8; j++) {
          const off = j >= 1 && j <= 3 ? this.off[j - 1] : 0;
          const dd = e[j] - off - xr[j];
          if (this.feedback) ufb -= K[j] * dd;
          if (j >= 1 && j <= 3) worst = Math.max(worst, Math.abs(dd));
        }
        ffTau = kRef * TS;
        if (worst > LOST_TRACK) { this.mode = "lost"; this.lostAt = this.t; ffTau = null; ufb = 0; }
      }
      if (this.mode === "hold" || this.mode === "pre") {
        const D = this.mode === "hold" ? ctrl.up : ctrl.down;
        let worst = 0;
        for (let j = 0; j < 8; j++) {
          let err = e[j] - D.eq[j];
          if (j >= 1 && j <= 3) { err = wrap(err); worst = Math.max(worst, Math.abs(err)); }
          ufb -= D.K[j] * err;
        }
        if (this.mode === "hold" && worst > LOST_HOLD) { this.mode = "lost"; this.lostAt = this.t; }
        if (this.mode === "pre" && worst > LOST_HOLD) ufb = Math.max(-6, Math.min(6, ufb));
        // 立て直し中：レールに当てないようにしつつ、下で十分に落ち着いたら同じ台本で振り上げ直す
        if (this.mode === "pre" && this.recovering) {
          ufb = this.railGuard(Math.max(-this.rc.umax, Math.min(this.rc.umax, ufb)), e);
          let calm = worst < this.rc.calmAngle && Math.abs(e[0]) < this.rc.calmX;
          for (let j = 4; j < 8; j++) if (Math.abs(e[j]) > this.rc.calmVel) calm = false;
          this.settleK = calm ? this.settleK + 1 : 0;
          if (this.settleK * TS >= this.rc.calmTime) {
            this.recovering = false;
            if (this.retries < this.maxRetries) { this.retries++; this.startSwing(); }
          }
        }
      }
      if (this.mode === "lost" && this.autoRecover) { this.mode = "recover"; this.recovering = true; }
      if (this.mode === "recover") {
        // 振り子のエネルギーを抜く。台車の加速度 u が振り子に入れる仕事率は −u Σβᵢ cosθᵢ θ̇ᵢ なので、
        // u = k Σβᵢ cosθᵢ θ̇ᵢ とすればエネルギーは必ず減る。台車はゆるく中央へ引き戻す。
        const b = this.nom.beta;
        let p = 0;
        for (let i = 0; i < 3; i++) p += b[i] * Math.cos(e[1 + i]) * e[5 + i];
        ufb = Math.max(-this.rc.umax, Math.min(this.rc.umax, this.rc.k * p - this.rc.kx * e[0] - this.rc.kv * e[4]));
        ufb = this.railGuard(ufb, e);
        ffTau = null;
        // 下の平衡点の近くまで来たら、下での LQR に引き継ぐ
        let near = true;
        for (let j = 1; j < 4; j++) if (Math.abs(wrap(e[j] - Math.PI)) > this.rc.handAngle || Math.abs(e[4 + j]) > this.rc.handVel) near = false;
        if (near) { this.mode = "pre"; this.settleK = 0; }
      }
      if (this.mode === "lost") {
        ufb = Math.max(-6, Math.min(6, -6 * this.est[4] - 3 * this.est[0]));
        ffTau = null;
      }

      // 計画との比較（表示と評価用。真の状態と、今の時刻の計画）
      this.ref = null;
      if (this.started && kk < ctrl.N) {
        const xr = ctrl.traj.xs[kk];
        this.ref = { s: xr, off: this.off, u: ctrl.traj.us[kk] };
        if (this.mode !== "lost")
          for (let j = 1; j < 4; j++) this.peakTrack = Math.max(this.peakTrack, Math.abs(this.s[j] - this.off[j - 1] - xr[j]));
      }
      if (this.mode === "hold" && kk >= ctrl.N)
        for (let j = 1; j < 4; j++) this.peakHold = Math.max(this.peakHold, Math.abs(wrap(this.s[j])));

      // 3) むだ時間：今の指令を待ち行列に入れ、d 周期前の指令を取り出して実機に効かせる
      const issued = { ffTau, ufb };
      let applied = issued;
      if (d > 0) { this.queue.push(issued); applied = this.queue.shift(); }
      const cmd = this.cmdFn(applied);
      const raw = (applied.ffTau === null ? 0 : Planner.uAtKnots(ctrl.prob, ctrl.traj.knots, applied.ffTau)) + applied.ufb;
      this.sat = Math.abs(raw) > this.uLimit;
      const w = this.noise.su * this.rng.gauss();
      this.uCmd = cmd(0);
      this.u = this.uCmd + w;
      const hh = TS / SUB;
      for (let j = 0; j < SUB; j++) {
        this.plantStep(this.s, hh, cmd(j * hh) + w, cmd((j + 0.5) * hh) + w, cmd((j + 1) * hh) + w);
        if (Math.abs(this.s[0]) > this.rail) {
          const side = Math.sign(this.s[0]);
          this.s[0] = side * this.rail;
          if (this.s[4] * side > 0) this.s.set(TM.velocityJump(this.md, this.s, -this.s[4]));
          this.hitRail = true;
          this.hitAt = this.t;
        }
      }

      // 4) 推定の時間更新（効いた指令は既知、雑音 w は未知）
      if (this.estimator === "ekf") this.ekfPredict(cmd);
      this.k++;
    }
  }

  // ---------------------------------------------------------------- 耐性試験
  // スイングアップして HOLD 秒倒立を保てたら成功
  const HOLD = 3;
  function runTrial(ctrl, cfg, seed) {
    const sim = new Sim(ctrl, { ...cfg, seed });
    for (let i = 0; i < 100; i++) sim.step(); // 0.2 s 静止
    sim.startSwing();
    const end = sim.k + ctrl.N + Math.round(HOLD / TS);
    while (sim.k < end && sim.mode !== "lost") sim.step();
    let final = 0;
    for (let j = 1; j < 4; j++) final = Math.max(final, Math.abs(wrap(sim.s[j])));
    const success = sim.mode === "hold" && !sim.hitRail && final < 0.2;
    return { success, lost: sim.mode === "lost", hit: sim.hitRail, peakTrack: sim.peakTrack, peakHold: sim.peakHold, final };
  }

  root.TC = { TS, SUB, HOLD, REALITY0, FROZEN_STRIDE, RECOVER, wrap, stationaryLQR, buildController, Sim, runTrial, makeRng, drawPlant };
  if (typeof module !== "undefined") module.exports = root.TC;
})(typeof window !== "undefined" ? window : globalThis);
