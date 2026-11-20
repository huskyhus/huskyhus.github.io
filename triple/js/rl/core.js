// 強化学習の題材：谷から出られない非力な台車（強化学習の古典的なベンチマークと同じ力学）。
//   位置 x ∈ [−1.2, 0.6]、速さ v ∈ [−0.07, 0.07]、行動 a ∈ {−1（左へ押す）, 0, +1（右へ押す）}
//   v ← v + 0.001·power·a − 0.0025·gravity·cos(3x)、x ← x + v。右の頂上 x ≥ 0.5 に着けば終わり。
//   報酬は 1 歩ごとに −1（早く着くほど良い）。エンジンは弱く、坂を直接は登れない。
//   学習：Sarsa(λ)、タイルコーディングによる線形関数近似、置換型の適格度トレース。
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- 環境
  const X_MIN = -1.2, X_MAX = 0.6, V_MAX = 0.07, GOAL = 0.5;
  const height = (x) => Math.sin(3 * x);
  function makeEnv(opt = {}) {
    return { power: opt.power ?? 1, gravity: opt.gravity ?? 1, x: -0.5, v: 0, t: 0 };
  }
  function resetEnv(env, rnd = Math.random) { env.x = -0.6 + 0.2 * rnd(); env.v = 0; env.t = 0; return [env.x, env.v]; }
  function stepEnv(env, a) {
    let v = env.v + 0.001 * env.power * (a - 1) - 0.0025 * env.gravity * Math.cos(3 * env.x);
    v = Math.max(-V_MAX, Math.min(V_MAX, v));
    let x = env.x + v;
    if (x < X_MIN) { x = X_MIN; v = 0; }
    env.x = x; env.v = v; env.t++;
    const done = x >= GOAL;
    return { s: [x, v], r: -1, done };
  }

  // ---------------------------------------------------------------- タイルコーディング
  //   n 枚の格子（各 d×d）を少しずつずらして重ねる。状態は各格子で 1 つずつ、計 n 個のタイルを「点灯」させる
  function makeTiles(n = 8, d = 8) {
    const per = (d + 1) * (d + 1);
    return {
      n, d, size: n * per,
      active(x, v) {
        const fx = ((x - X_MIN) / (X_MAX - X_MIN)) * d, fv = ((v + V_MAX) / (2 * V_MAX)) * d;
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
          // ずらし方：(1, 3) の倍数（非対称にずらすと汎化が偏りにくい）
          const ox = ((i * 1) % n) / n, ov = ((i * 3) % n) / n;
          const ix = Math.min(d, Math.floor(fx + ox)), iv = Math.min(d, Math.floor(fv + ov));
          out[i] = i * per + ix * (d + 1) + iv;
        }
        return out;
      },
    };
  }

  // ---------------------------------------------------------------- Sarsa(λ)
  function makeAgent(opt = {}) {
    const tiles = makeTiles(opt.tilings ?? 8, opt.grid ?? 8);
    const init = opt.init ?? 0; // 価値の初期値（報酬が負なので 0 は「楽観的」）
    const w = [0, 1, 2].map(() => new Float64Array(tiles.size).fill(init / tiles.n));
    return {
      tiles, w,
      alpha: (opt.alpha ?? 0.5) / tiles.n, lambda: opt.lambda ?? 0.9, eps: opt.eps ?? 0, gamma: 1,
      episodes: 0, history: [],
    };
  }
  const qOf = (ag, F, a) => { let s = 0; for (const i of F) s += ag.w[a][i]; return s; };
  function greedy(ag, F, rnd = Math.random) {
    const q = [0, 1, 2].map((a) => qOf(ag, F, a));
    const m = Math.max(...q);
    const best = [0, 1, 2].filter((a) => q[a] >= m - 1e-12);
    return best[Math.floor(rnd() * best.length)];
  }
  function choose(ag, F, rnd = Math.random) { return rnd() < ag.eps ? Math.floor(rnd() * 3) : greedy(ag, F, rnd); }
  const valueAt = (ag, x, v) => { const F = ag.tiles.active(x, v); return Math.max(...[0, 1, 2].map((a) => qOf(ag, F, a))); };
  const policyAt = (ag, x, v) => greedy(ag, ag.tiles.active(x, v), () => 0.5);

  // 1 エピソード学習する。onStep があれば各歩で呼ぶ（アニメーション用）
  function runEpisode(ag, env, opt = {}) {
    const rnd = opt.rnd || Math.random, maxSteps = opt.maxSteps ?? 5000, learn = opt.learn !== false;
    const z = learn ? [0, 1, 2].map(() => new Map()) : null; // 適格度トレース（疎）
    let s = resetEnv(env, rnd);
    let F = ag.tiles.active(s[0], s[1]);
    let a = learn ? choose(ag, F, rnd) : greedy(ag, F, rnd);
    const traj = [[s[0], s[1]]];
    let steps = 0;
    while (steps < maxSteps) {
      const { s: s2, r, done } = stepEnv(env, a);
      steps++;
      traj.push([s2[0], s2[1]]);
      if (learn) {
        let delta = r - qOf(ag, F, a);
        // 置換型トレース：今の (状態, 行動) のタイルは 1 に、同じ状態の他の行動は 0 に
        for (const i of F) { for (let b = 0; b < 3; b++) z[b].delete(i); z[a].set(i, 1); }
        let F2 = null, a2 = 0;
        if (!done) { F2 = ag.tiles.active(s2[0], s2[1]); a2 = choose(ag, F2, rnd); delta += ag.gamma * qOf(ag, F2, a2); }
        const k = ag.alpha * delta, decay = ag.gamma * ag.lambda;
        for (let b = 0; b < 3; b++) {
          const wb = ag.w[b];
          for (const [i, e] of z[b]) {
            wb[i] += k * e;
            const ne = e * decay;
            if (ne < 1e-3) z[b].delete(i); else z[b].set(i, ne);
          }
        }
        if (done) break;
        F = F2; a = a2;
      } else {
        if (done) break;
        F = ag.tiles.active(s2[0], s2[1]); a = greedy(ag, F, rnd);
      }
      if (opt.onStep) opt.onStep(env, a);
    }
    if (learn) { ag.episodes++; ag.history.push(steps); }
    return { steps, traj, reached: env.x >= GOAL };
  }

  // 人が考えた規則：動いている向きに押す（エネルギーを注ぎ込む）
  function ruleEpisode(env, rnd = Math.random, maxSteps = 5000) {
    resetEnv(env, rnd);
    let steps = 0;
    const traj = [[env.x, env.v]];
    while (steps < maxSteps) {
      const a = env.v >= 0 ? 2 : 0;
      const { done } = stepEnv(env, a);
      steps++; traj.push([env.x, env.v]);
      if (done) break;
    }
    return { steps, traj };
  }

  // 乱数（再現できるように）
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  root.RL = { X_MIN, X_MAX, V_MAX, GOAL, height, makeEnv, resetEnv, stepEnv, makeTiles, makeAgent, runEpisode, ruleEpisode, valueAt, policyAt, greedy, rng };
  if (typeof module !== "undefined") module.exports = root.RL;
})(typeof window !== "undefined" ? window : globalThis);
