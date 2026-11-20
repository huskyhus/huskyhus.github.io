# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""README §6 の数値をすべて再計算して表示する。

実行: uv run scripts/verify_numbers.py
"""
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
from scipy import integrate, linalg, optimize, signal

M, m, l, g = 1.0, 0.1, 0.5, 9.8
p2 = (M + m) * g / (M * l)
p = np.sqrt(p2)
b = 1 / (M * l)

A = np.array([[0, 1, 0, 0], [0, 0, -m * g / M, 0], [0, 0, 0, 1], [0, 0, (M + m) * g / (M * l), 0]])
B = np.array([[0], [1 / M], [0], [-1 / (M * l)]])


def show(name, value):
    print(f"{name:<40} {value}")


show("p^2, p, b", (round(p2, 4), round(p, 4), b))
show("eig(A)", np.round(np.sort(np.linalg.eigvals(A).real), 4))

# PD
kp, kd = 43, 4
wn = np.sqrt(b * kp - p2)
zeta = b * kd / (2 * wn)
show("PD 特性多項式 s^2 + a1 s + a0", (b * kd, round(b * kp - p2, 4)))
show("omega_n, zeta", (round(wn, 4), round(zeta, 4)))
show("PD 安定条件 k_p > (M+m)g", (M + m) * g)

# 2次系 (zeta=0.5, wn=8) のステップ応答（連続時間、細かい刻み）
t = np.linspace(0, 3, 300001)
_, y = signal.step(signal.lti([64], [1, 8, 64]), T=t)
i = np.argmax(y)
ts = t[np.where(np.abs(y - 1) > 0.02)[0][-1] + 1]
show("行き過ぎ量, ピーク時刻, 2%整定時間", (round(y[i] - 1, 4), round(t[i], 3), round(ts, 3)))


def L(w, k=1.0):
    s = 1j * w
    return k * 2 * (43 + 4 * s) / (s**2 - p2)


wc = optimize.brentq(lambda w: abs(L(w)) - 1, 1, 100)
show("L(0)", round(L(0).real, 4))
show("omega_c, 位相余裕[deg]", (round(wc, 3), round(180 + np.degrees(np.angle(L(wc))), 2)))
show("下げてよいゲインの下限 1/|L(0)| , dB", (round(1 / abs(L(0)), 4), round(20 * np.log10(1 / abs(L(0))), 2)))

Cc = np.hstack([np.linalg.matrix_power(A, k) @ B for k in range(4)])
show("|det 可制御性行列|", round(abs(np.linalg.det(Cc)), 4))
for name, C in (("y = x", [1, 0, 0, 0]), ("y = theta", [0, 0, 1, 0])):
    C = np.array([C])
    O = np.vstack([C @ np.linalg.matrix_power(A, k) for k in range(4)])
    show(f"可観測性行列の階数 ({name})", np.linalg.matrix_rank(O))

Kp = signal.place_poles(A, B, [-2, -3, -4, -5]).gain_matrix
show("極配置 K", np.round(Kp, 2))

Q = np.diag([10, 1, 100, 1])
R = np.array([[1.0]])
X = linalg.solve_continuous_are(A, B, Q, R)
K = np.linalg.solve(R, B.T @ X)
show("LQR K", np.round(K, 2))
show("LQR 閉ループ固有値", np.round(np.linalg.eigvals(A - B @ K), 2))


def pendulum(t, s, K):
    x, xd, th, thd = s
    u = -(K @ s).item()
    lhs = np.array([[M + m, m * l * np.cos(th)], [np.cos(th), l]])
    rhs = np.array([u + m * l * thd**2 * np.sin(th), g * np.sin(th)])
    xdd, thdd = np.linalg.solve(lhs, rhs)
    return [xd, xdd, thd, thdd]


z0 = [0, 0, 0.2, 0]
sol = integrate.solve_ivp(pendulum, [0, 8], z0, args=(K,), max_step=1e-3)
u = -(K @ sol.y).ravel()
i = np.argmax(np.abs(sol.y[0]))
settle = sol.t[np.where(np.linalg.norm(sol.y, axis=0) > 0.01)[0][-1]]
show("LQR 非線形: x最大, 時刻, |u|最大", (round(sol.y[0, i], 3), round(sol.t[i], 2), round(np.abs(u).max(), 2)))
show("LQR 非線形: |z| < 0.01 になる時刻", round(settle, 2))

Kpd = np.array([[0, 0, -kp, -kd]])  # u = -(k_p θ + k_d θ̇) の符号を反転した C(s) = -(k_p + k_d s)
sol = integrate.solve_ivp(pendulum, [0, 8], z0, args=(Kpd,), max_step=1e-3)
show("PD 非線形: 8秒後の x, xdot, theta", np.round(sol.y[:3, -1], 3))

zr = np.sqrt(g / l)
show("P_x の右半平面零点 sqrt(g/l)", round(zr, 4))
show("感度積分の右辺 pi p", round(np.pi * p, 3))
p_short = np.sqrt((M + m) * g / (M * 0.25))
show("l = 0.25 のとき p, pi p", (round(p_short, 3), round(np.pi * p_short, 2)))
show("下界 |(z+p)/(z-p)|", round((zr + p) / (p - zr), 2))
