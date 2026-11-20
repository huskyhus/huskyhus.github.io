# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""図とアニメーションが読むデータを data/ に書き出す。

data/<名前>.json と、file:// でも読めるように data/<名前>.js（window.DATA への代入）の両方を出力する。

実行: uv run scripts/build_data.py
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy import integrate

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

M, m, l, g = 1.0, 0.1, 0.5, 9.8


def lin(M, m, l, g):
    A = np.array([[0, 1, 0, 0], [0, 0, -m * g / M, 0], [0, 0, 0, 1], [0, 0, (M + m) * g / (M * l), 0]])
    B = np.array([[0], [1 / M], [0], [-1 / (M * l)]])
    return A, B


def pendulum_rhs(K=None):
    def f(t, s):
        x, xd, th, thd = s
        u = 0.0 if K is None else -(K @ s).item()
        lhs = np.array([[M + m, m * l * np.cos(th)], [np.cos(th), l]])
        rhs = np.array([u + m * l * thd**2 * np.sin(th), g * np.sin(th)])
        xdd, thdd = np.linalg.solve(lhs, rhs)
        return [xd, xdd, thd, thdd]

    return f


def r(a, n=5):
    return np.round(np.asarray(a, dtype=float), n).tolist()


def write(name: str, obj: dict) -> None:
    text = json.dumps(obj, ensure_ascii=False)
    (OUT / f"{name}.json").write_text(text + "\n", encoding="utf-8")
    (OUT / f"{name}.js").write_text(
        f"// scripts/build_data.py が生成。手で編集しない。\nwindow.DATA = window.DATA || {{}};\nwindow.DATA[{json.dumps(name)}] = {text};\n",
        encoding="utf-8",
    )
    print(f"data/{name}.json, data/{name}.js")


# ---- ch1：線形化と、放っておいたときに倒れる様子 ----
A, B = lin(M, m, l, g)
eig = np.linalg.eigvals(A)
p = float(np.sqrt((M + m) * g / (M * l)))

theta0 = 0.02  # rad
fallen = lambda t, s: abs(s[2]) - np.pi / 2
fallen.terminal = True
t_eval = np.arange(0, 3, 0.005)
sol = integrate.solve_ivp(pendulum_rhs(), [0, 3], [0, 0, theta0, 0], t_eval=t_eval, events=fallen, rtol=1e-9, atol=1e-12)

write(
    "ch1",
    {
        "params": {"M": M, "m": m, "l": l, "g": g},
        "p": round(p, 5),
        "A": r(A),
        "B": r(B),
        "eig": [{"re": round(float(e.real), 5), "im": round(float(e.imag), 5)} for e in sorted(eig, key=lambda e: e.real)],
        "fall": {
            "theta0": theta0,
            "dt": 0.005,
            "t": r(sol.t, 4),
            "x": r(sol.y[0]),
            "theta": r(sol.y[2]),
            "t_fallen": round(float(sol.t_events[0][0]), 4),
        },
    },
)


# ---- 共通 ----
from scipy import linalg, signal  # noqa: E402

b = 1 / (M * l)
kp, kd = 43.0, 4.0
Kpd = np.array([[0, 0, -kp, -kd]])  # u = -Kpd z = kp θ + kd θ̇、つまり C(s) = -(kp + kd s)


def sim(K, t_end, dt=0.02, z0=(0, 0, 0.2, 0)):
    t = np.arange(0, t_end + 1e-9, dt)
    s = integrate.solve_ivp(pendulum_rhs(K), [0, t_end], list(z0), t_eval=t, rtol=1e-9, atol=1e-12)
    u = -(K @ s.y).ravel()
    return {"dt": dt, "t": r(s.t, 3), "x": r(s.y[0], 4), "theta": r(s.y[2], 4), "u": r(u, 3)}


# ---- ch2：伝達関数の極と零点 ----
zr = float(np.sqrt(g / l))
write(
    "ch2",
    {
        "p": round(p, 5),
        "Ptheta": {"poles": [-round(p, 5), round(p, 5)], "zeros": []},
        "Px": {"poles": [-round(p, 5), 0, 0, round(p, 5)], "zeros": [-round(zr, 5), round(zr, 5)]},
    },
)

# ---- ch3：ステップ応答、根軌跡、PD を非線形モデルに掛けた結果 ----
zeta, wn = 0.5, 8.0
ts_ = np.arange(0, 2.0 + 1e-9, 0.002)
_, ys = signal.step(signal.lti([wn**2], [1, 2 * zeta * wn, wn**2]), T=ts_)
ipk = int(np.argmax(ys))
settle = float(ts_[np.where(np.abs(ys - 1) > 0.02)[0][-1] + 1])
write(
    "ch3",
    {
        "step": {"zeta": zeta, "wn": wn, "t": r(ts_, 3), "y": r(ys, 5),
                 "overshoot": round(float(ys[ipk] - 1), 4), "tpeak": round(float(ts_[ipk]), 3), "tsettle": round(settle, 3)},
        "pd": {"kp": kp, "kd": kd, "b": b, "p2": round(p**2, 5),
               "kp_min": round((M + m) * g, 5), "kp_double": round((p**2 + (b * kd / 2) ** 2) / b, 5)},
        "pdSim": sim(Kpd, 8.0),
    },
)

# ---- ch4：ループ伝達関数 L(s) = 2(43 + 4s)/(s² − p²) の周波数応答 ----
from scipy import optimize  # noqa: E402


def Lpd(wv, kp=kp, kd=kd):
    s = 1j * np.asarray(wv)
    return b * (kp + kd * s) / (s**2 - p**2)


w = np.logspace(-1, np.log10(316), 600)
Lj = Lpd(w)
wc = float(optimize.brentq(lambda x: abs(Lpd(x)) - 1, 1, 100))
pm = float(180 + np.degrees(np.angle(Lpd(wc))))
write(
    "ch4",
    {
        "kp": kp, "kd": kd, "b": b, "p2": round(p**2, 5),
        "L0": round(float(Lpd(0).real), 5),
        "wc": round(wc, 4), "pm": round(pm, 3),
        "gainMin": round(1 / abs(float(Lpd(0).real)), 5),
        "w": r(w, 5),
        "magdB": r(20 * np.log10(np.abs(Lj)), 4),
        "phase": r(np.degrees(np.unwrap(np.angle(Lj))), 3),
        "re": r(Lj.real, 5),
        "im": r(Lj.imag, 5),
    },
)

# ---- ch5a：可制御性、可観測性、極配置 ----
Cc = np.hstack([np.linalg.matrix_power(A, k) @ B for k in range(4)])
ranks = {}
for name, C in (("x", [1, 0, 0, 0]), ("theta", [0, 0, 1, 0])):
    C = np.array([C])
    ranks[name] = int(np.linalg.matrix_rank(np.vstack([C @ np.linalg.matrix_power(A, k) for k in range(4)])))
poles = [-2, -3, -4, -5]
Kpl = signal.place_poles(A, B, poles).gain_matrix
write("ch5a", {"A": r(A), "B": r(B), "detC": round(float(abs(np.linalg.det(Cc))), 4), "rankObs": ranks,
               "poles": poles, "K": r(Kpl.ravel(), 4)})

# ---- ch5b：LQR ----
Q = np.diag([10.0, 1.0, 100.0, 1.0])
R = np.array([[1.0]])
X = linalg.solve_continuous_are(A, B, Q, R)
Klqr = np.linalg.solve(R, B.T @ X)
ev = np.linalg.eigvals(A - B @ Klqr)
wl = np.logspace(-1.5, 3, 800)
Llqr = np.array([(Klqr @ np.linalg.solve(1j * x * np.eye(4) - A, B)).item() for x in wl])
lqrSim = sim(Klqr, 6.0)
pdSim6 = sim(Kpd, 6.0)
i = int(np.argmax(np.abs(lqrSim["x"])))
write(
    "ch5b",
    {
        "Q": [10, 1, 100, 1], "R": 1, "K": r(Klqr.ravel(), 4),
        "eig": [{"re": round(float(e.real), 4), "im": round(float(e.imag), 4)} for e in ev],
        "lqr": lqrSim, "pd": pdSim6,
        "xmax": lqrSim["x"][i], "txmax": lqrSim["t"][i], "umax": round(float(np.max(np.abs(lqrSim["u"]))), 3),
        "loop": {"w": r(wl, 5), "re": r(Llqr.real, 5), "im": r(Llqr.imag, 5),
                 "minDist": round(float(np.min(np.abs(1 + Llqr))), 4)},
    },
)

# ---- ch6：感度積分（微分にフィルタを掛けた PD）と非最小位相の下界 ----
tau = 0.02  # 微分のフィルタ時定数 [s]


def S6(x):
    s = 1j * np.asarray(x)
    L = b * (kp + kd * s / (tau * s + 1)) / (s**2 - p**2)
    return 1 / (1 + L)


cl = np.roots([tau, 1, -p**2 * tau + b * kp * tau + b * kd, -p**2 + b * kp])
assert np.all(cl.real < 0), cl
integral, _ = integrate.quad(lambda x: np.log(abs(S6(x))), 0, np.inf, limit=500)
w6 = np.linspace(0, 400, 4001)
logS = np.log(np.abs(S6(w6)))
write(
    "ch6",
    {
        "tau": tau, "closedLoopPoles": [{"re": round(float(c.real), 4), "im": round(float(c.imag), 4)} for c in cl],
        "integral": round(float(integral), 4), "piP": round(float(np.pi * p), 4),
        "w": r(w6, 3), "logS": r(logS, 5),
        "neg": round(float(np.trapezoid(np.minimum(logS, 0), w6)), 3),
        "pos": round(float(np.trapezoid(np.maximum(logS, 0), w6)), 3),
        "zero": round(zr, 5), "p": round(p, 5), "bound": round(float((zr + p) / (p - zr)), 3),
        "params": {"M": M, "m": m},
    },
)
