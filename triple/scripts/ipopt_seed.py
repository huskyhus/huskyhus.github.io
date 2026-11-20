# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "casadi"]
# ///
"""既定パラメータでのスイングアップ（下下下→上上上）を IPOPT で解き，ブラウザ側
プランナー（js/planner.js）の初期値として data/ipopt_seed.json に書き出す。

実行: uv run scripts/ipopt_seed.py   （triple/ で実行）
続けて: node scripts/build_seed.mjs  （JS のプランナーで解き直して data/seed.js を作る）

モデル（JS 側 js/model.js と同じもの）
  状態 s = [x, th1, th2, th3, dx, dth1, dth2, dth3]，入力 u = 台車加速度 [m/s^2]
  th_i は鉛直上向きから時計回り。0 が倒立，pi が懸垂。
  M(th) th'' + c(th, th') + beta_i cos(th_i) u - g beta_i sin(th_i) + 摩擦 = 0
"""
import json
import sys
from pathlib import Path

import casadi as ca
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------- パラメータ
P = dict(
    g=9.81,
    m=[0.60, 0.45, 0.30],        # 各リンクの質量 [kg]
    l=[0.32, 0.28, 0.24],        # 各リンクの長さ（関節間）[m]
    a=[0.16, 0.14, 0.12],        # 関節から重心まで [m]
    J=None,                      # 重心まわり慣性モーメント（一様棒）
    d=[0.004, 0.003, 0.002],     # 関節の粘性摩擦 [N m s]
    umax=40.0,                   # 台車加速度の上限 [m/s^2]
    vmax=4.0,                    # 台車速度の上限 [m/s]
    xmax=0.75,                   # レールの半分の長さ [m]
)
P["J"] = [m * l * l / 12 for m, l in zip(P["m"], P["l"])]

def inertia_terms(p):
    m, l, a, J = p["m"], p["l"], p["a"], p["J"]
    n = 3
    beta = [m[i] * a[i] + l[i] * sum(m[i + 1:]) for i in range(n)]
    mu = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                mu[i][i] = J[i] + m[i] * a[i] ** 2 + l[i] ** 2 * sum(m[i + 1:])
            else:
                lo, hi = min(i, j), max(i, j)
                mu[i][j] = l[lo] * beta[hi]
    return beta, mu


BETA, MU = inertia_terms(P)


def dynamics(s, u, lib=ca):
    """連続時間の右辺 ds/dt。casadi の式でも numpy でも動く。"""
    th = [s[1], s[2], s[3]]
    w = [s[5], s[6], s[7]]
    g, d = P["g"], P["d"]
    if lib is ca:
        M = ca.SX.zeros(3, 3) if isinstance(s, ca.SX) else ca.MX.zeros(3, 3)
        rhs = ca.SX.zeros(3, 1) if isinstance(s, ca.SX) else ca.MX.zeros(3, 1)
        cos, sin = ca.cos, ca.sin
    else:
        M = np.zeros((3, 3))
        rhs = np.zeros(3)
        cos, sin = np.cos, np.sin
    for i in range(3):
        acc = 0
        for j in range(3):
            M[i, j] = MU[i][j] * cos(th[i] - th[j])
            if j != i:
                acc = acc + MU[i][j] * sin(th[i] - th[j]) * w[j] ** 2
        wprev = w[i - 1] if i > 0 else 0
        fr = d[i] * (w[i] - wprev)
        if i < 2:
            fr = fr - d[i + 1] * (w[i + 1] - w[i])
        rhs[i] = -acc - BETA[i] * cos(th[i]) * u + g * BETA[i] * sin(th[i]) - fr
    if lib is ca:
        ddth = ca.solve(M, rhs)
        return ca.vertcat(s[4], s[5], s[6], s[7], u, ddth)
    ddth = np.linalg.solve(M, rhs)
    return np.array([s[4], s[5], s[6], s[7], u, *ddth])


# casadi 関数（線形化用）
_s = ca.SX.sym("s", 8)
_u = ca.SX.sym("u")
_f = dynamics(_s, _u)
F = ca.Function("f", [_s, _u], [_f])
JAC = ca.Function("lin", [_s, _u], [ca.jacobian(_f, _s), ca.jacobian(_f, _u)])


def linearize(s, u):
    A, B = JAC(s, u)
    return np.array(A), np.array(B)


def equilibrium(code):
    return np.array([0.0] + [0.0 if c == "U" else np.pi for c in code] + [0.0] * 4)


# ---------------------------------------------------------------- 軌道最適化
def solve_ocp(start, goal, T, N, guess, rng):
    """エルミート・シンプソン直接コロケーションで ∫(u^2 + ρ du^2) dt を最小化。"""
    opti = ca.Opti()
    X = opti.variable(8, N + 1)
    Xm = opti.variable(8, N)
    U = opti.variable(1, N + 1)
    Um = opti.variable(1, N)
    h = T / N
    cost = 0
    for k in range(N):
        xk, xk1, xm = X[:, k], X[:, k + 1], Xm[:, k]
        uk, uk1, um = U[k], U[k + 1], Um[k]
        fk, fk1, fm = F(xk, uk), F(xk1, uk1), F(xm, um)
        opti.subject_to(xm == 0.5 * (xk + xk1) + h / 8 * (fk - fk1))
        opti.subject_to(xk1 == xk + h / 6 * (fk + 4 * fm + fk1))
        cost += h / 6 * (uk ** 2 + 4 * um ** 2 + uk1 ** 2)
        cost += 1e-3 * ((uk1 - uk) / h) ** 2 * h
    opti.minimize(cost)
    opti.subject_to(X[:, 0] == start)
    opti.subject_to(X[:, N] == goal)
    opti.subject_to(U[0] == 0)
    opti.subject_to(U[N] == 0)
    opti.subject_to(opti.bounded(-P["xmax"], X[0, :], P["xmax"]))
    opti.subject_to(opti.bounded(-P["xmax"], Xm[0, :], P["xmax"]))
    opti.subject_to(opti.bounded(-P["vmax"], X[4, :], P["vmax"]))
    opti.subject_to(opti.bounded(-P["umax"], U, P["umax"]))
    opti.subject_to(opti.bounded(-P["umax"], Um, P["umax"]))

    tt = np.linspace(0, 1, N + 1)
    Xg, Ug = guess(tt, rng)
    opti.set_initial(X, Xg)
    opti.set_initial(Xm, 0.5 * (Xg[:, :-1] + Xg[:, 1:]))
    opti.set_initial(U, Ug)
    opti.set_initial(Um, 0.5 * (Ug[:-1] + Ug[1:]))
    opti.solver("ipopt", {"print_time": False},
                {"print_level": 0, "max_iter": 3000, "tol": 1e-8, "acceptable_tol": 1e-6})
    try:
        sol = opti.solve()
    except RuntimeError:
        return None
    return dict(T=T, N=N, X=np.array(sol.value(X)), Xm=np.array(sol.value(Xm)),
                U=np.array(sol.value(U)).ravel(), Um=np.array(sol.value(Um)).ravel(),
                cost=float(sol.value(cost)))


def make_guess(start, goal):
    def guess(tt, rng):
        amp = rng.uniform(-0.4, 0.4)
        freq = rng.integers(1, 4)
        s = 0.5 - 0.5 * np.cos(np.pi * tt)
        X = np.outer(start, 1 - s) + np.outer(goal, s)
        X[0] = amp * np.sin(freq * np.pi * tt)
        for i in range(1, 4):
            X[i] += rng.normal(0, 0.6) * np.sin(np.pi * tt)
        # 速度は位置の数値微分で揃える
        U = np.zeros_like(tt)
        return X, U
    return guess


def sample(sol, dt):
    """エルミート・シンプソンの補間（状態は3次，入力は2次）で等間隔に標本化する。"""
    T, N = sol["T"], sol["N"]
    h = T / N
    n = int(round(T / dt))
    ts = np.linspace(0, T, n + 1)
    Xs = np.zeros((n + 1, 8))
    Us = np.zeros(n + 1)
    for idx, t in enumerate(ts):
        k = min(int(t / h), N - 1)
        tau = t / h - k
        x0, x1, xm = sol["X"][:, k], sol["X"][:, k + 1], sol["Xm"][:, k]
        u0, u1, um = sol["U"][k], sol["U"][k + 1], sol["Um"][k]
        f0 = np.array(F(x0, u0)).ravel()
        f1 = np.array(F(x1, u1)).ravel()
        fm = np.array(F(xm, um)).ravel()
        # 2次補間した微分を積分した3次多項式
        Xs[idx] = x0 + h * (f0 * tau + 0.5 * (-3 * f0 + 4 * fm - f1) * tau ** 2
                            + (2 * f0 - 4 * fm + 2 * f1) / 3 * tau ** 3)
        Us[idx] = u0 * (1 - tau) * (1 - 2 * tau) + 4 * um * tau * (1 - tau) + u1 * tau * (2 * tau - 1)
    return ts, Xs, Us


def goal_variants(start_code, goal_code):
    """終点の角度は 2π の倍数だけずらしても同じ姿勢なので，いくつか試す。"""
    base = equilibrium(goal_code)
    outs = []
    for shifts in [(0, 0, 0), (1, 1, 1), (-1, -1, -1), (0, 1, 1), (0, -1, -1), (1, 0, 0), (-1, 0, 0),
                   (0, 0, 1), (0, 0, -1), (1, 1, 0), (-1, -1, 0)]:
        g = base.copy()
        for i in range(3):
            g[1 + i] += 2 * np.pi * shifts[i]
        outs.append(g)
    return outs


def main():
    T = 3.0
    best = None
    rng = np.random.default_rng(1)
    start = equilibrium("DDD")
    for goal in goal_variants("DDD", "UUU"):
        for _ in range(6):
            sol = solve_ocp(start, goal, T, 150, make_guess(start, goal), rng)
            if sol is not None and (best is None or sol["cost"] < best["cost"]):
                best = sol
                print(f"cost={sol['cost']:.2f} goal={np.round(goal[1:4] / np.pi, 1)}π", flush=True)
    M, NU = 50, 100
    ts, Xs, Us = sample(best, T / NU)
    out = dict(T=T, M=M, NU=NU, cost=best["cost"], goal=Xs[-1].tolist(),
               nodes=Xs[::NU // M].tolist(), u=Us.tolist(),
               params={k: P[k] for k in ["g", "m", "l", "d", "umax", "vmax", "xmax"]})
    path = ROOT / "data" / "ipopt_seed.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out), encoding="utf-8")
    print("wrote", path, "cost", round(best["cost"], 3))


if __name__ == "__main__":
    main()
