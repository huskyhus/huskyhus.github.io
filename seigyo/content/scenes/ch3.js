// ch3 第3部 フィードバックの構造
LECTURE.chapter({
  id: "ch3",
  scenes: [
    {
      id: "s01",
      layout: "full",
      blocks: [
        { type: "fig", name: "feedbackDiagram", style: "--fig-max:270px", opts: { namesAt: 1, loopAt: 2 } },
        { type: "def", label: "定義8（標準フィードバック系）", text: "$r$：<span class='term'>参照信号</span>、$e = r - y$：<span class='term'>偏差</span>、$d$：<span class='term'>外乱</span>（選べず、値も知らない入力）。" },
        { type: "math", at: 2, tex: "L = PC,\\qquad S = \\frac{1}{1+L},\\qquad T = \\frac{L}{1+L} = 1 - S" },
        { type: "math", at: 3, tex: "Y = TR + PSD,\\qquad E = SR - PSD" },
      ],
    },
    {
      id: "s02",
      layout: "full",
      blocks: [
        { type: "math", tex: "\\frac{dT/T}{dP/P} = S" },
        { type: "p", text: "制御対象が $P$ からずれたときの $T$ の相対変化は $S$ 倍になる。" },
        { type: "p", at: 2, text: "$|S(j\\omega)|$ が小さい周波数では、モデルの誤差も外乱も出力にほとんど現れない。" },
      ],
    },
    {
      id: "s03",
      layout: "full",
      blocks: [
        { type: "fig", name: "feedbackDiagram", style: "--fig-max:270px", opts: { namesAt: 99, dAt: 3 } },
        { type: "def", label: "定義9（内部安定）", text: "$(r, d)$ から $(e, u)$ への4つの伝達関数がすべて BIBO 安定のとき<span class='term'>内部安定</span>という。" },
        { type: "p", at: 2, text: "$P = n_P/d_P$、$C = n_C/d_C$（既約）なら、内部安定 $\\iff$ $d_P d_C + n_P n_C$ の根（<span class='term'>閉ループ極</span>）がすべて $\\mathbb{C}_-$。" },
        { type: "p", at: 3, text: "不安定な極を $C$ の零点で打ち消すと、$T$ は安定に見えても $d$ から $y$ への経路が発散する。" },
      ],
    },
    {
      id: "s04",
      layout: "split",
      blocks: [
        { type: "def", label: "定義10（ステップ応答とその指標）", text: "初期値 $0$ から単位ステップ入力を加えたときの出力を<span class='term'>ステップ応答</span>という。安定なら $y_\\infty = G(0)$ に収束する。" },
        { type: "list", at: 2, items: ["<span class='term'>行き過ぎ量</span>：最大値が $y_\\infty$ を超える割合", "<span class='term'>整定時間</span>：$y_\\infty$ の $\\pm 2\\%$ の帯に入って出なくなる時刻"] },
        { type: "p", at: 3, text: "参照信号がステップのときの $\\lim e(t)$ を<span class='term'>定常偏差</span>という。" },
        { type: "fig", area: "right", name: "stepResponse", opts: { annotateAt: 2 } },
      ],
    },
    {
      id: "s05",
      layout: "split",
      blocks: [
        { type: "math", tex: "G(s) = \\frac{\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}" },
        { type: "p", text: "$\\zeta$：<span class='term'>減衰係数</span>、$\\omega_n$：<span class='term'>固有角周波数</span>。" },
        { type: "math", at: 2, tex: "\\text{極 } -\\zeta\\omega_n \\pm j\\omega_n\\sqrt{1-\\zeta^2},\\quad \\text{行き過ぎ量 } e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}},\\quad \\text{整定 } \\approx \\frac{4}{\\zeta\\omega_n}" },
        { type: "p", at: 3, text: "極が虚軸から遠いほど速く落ち着き、実軸からの角度が大きいほど振動的になる。" },
        { type: "fig", area: "right", name: "stepResponse", opts: { slidersAt: 2 } },
      ],
    },
    {
      id: "s06",
      layout: "full",
      blocks: [
        { type: "math", tex: "\\lim_{t\\to\\infty} e(t) = \\lim_{s\\to 0} s\\cdot S(s)\\frac{1}{s} = S(0) = \\frac{1}{1 + L(0)}" },
        { type: "p", at: 2, text: "$L$ が $s = 0$ に極をもてば $S(0) = 0$。消したい信号のモデル（ステップなら $1/s$、正弦波なら $1/(s^2+\\omega_0^2)$）をループに入れればよい。これを<span class='term'>内部モデル原理</span>と呼ぶ。" },
      ],
    },
    {
      id: "s07",
      layout: "full",
      blocks: [
        { type: "def", label: "定義11（PID 制御）", text: "$$u(t) = k_p\\, e(t) + k_i \\int_0^t e(\\tau)\\, d\\tau + k_d\\, \\dot e(t),\\qquad C(s) = k_p + \\frac{k_i}{s} + k_d s$$ を <span class='term'>PID 制御</span>、$k_i = 0$ のものを <span class='term'>PD 制御</span>という。" },
        { type: "p", at: 2, text: "信号に掛ける倍率を<span class='term'>ゲイン</span>と呼ぶ。$k_p, k_i, k_d$ は比例・積分・微分ゲイン。" },
        { type: "p", at: 3, text: "積分の項は内部モデル原理の最も簡単な実例、微分の項は減衰を与える。実装では $k_d s$ に高い周波数を切るフィルタを掛ける。" },
      ],
    },
    {
      id: "s08",
      layout: "split",
      blocks: [
        { type: "math", tex: "P_\\theta = \\frac{-b}{s^2 - p^2},\\qquad C(s) = -(k_p + k_d s)" },
        { type: "math", at: 2, tex: "s^2 + b k_d\\, s + (b k_p - p^2)" },
        { type: "p", at: 2, text: "内部安定 $\\iff$ $k_d > 0$ かつ $k_p > p^2/b = (M+m)g$" },
        { type: "p", at: 3, text: "角度に比例して押す強さが、重力が倒そうとする強さ $(M+m)g = 10.78$ N に勝つ。" },
        { type: "math", at: 4, tex: "k_p = 43,\\ k_d = 4:\\quad s^2 + 8s + 64.44,\\quad \\omega_n \\approx 8.0,\\ \\zeta \\approx 0.50" },
        { type: "fig", area: "right", name: "stepResponse", at: 4, opts: { annotateAt: 4 } },
      ],
    },
    {
      id: "s09",
      layout: "split",
      blocks: [
        { type: "math", tex: "s = -4 \\pm \\sqrt{37.56 - 2k_p}\\qquad (k_d = 4)" },
        { type: "list", at: 2, items: ["$k_p < 10.78$：正の実根があり倒れる", "$10.78 < k_p < 18.78$：負の実根が2つ", "$k_p > 18.78$：実部 $-4$ の共役複素根"] },
        { type: "p", at: 3, text: "ゲイン $k_p$ を動かしたときの根の軌跡を<span class='term'>根軌跡</span>という。係数が連続に動けば根も連続に動く、という事実の絵である。" },
        { type: "fig", area: "right", name: "rootLocus" },
      ],
    },
    {
      id: "s10",
      layout: "split",
      blocks: [
        { type: "p", text: "この制御器は角度しか見ておらず、$A$ の固有値 $0$（2重）に触れていない。" },
        { type: "p", at: 2, text: "非線形モデル、$\\theta(0) = 0.2$ rad：角度は戻るが、台車は約 $0.26$ m/s で流れ続け、8 秒後には $2.15$ m 先にいる。" },
        { type: "fig", area: "right", name: "cartAnim", at: 2, opts: { playAt: 2, title: "PD 制御：角度は立つが、台車は流れ続ける", sims: [{ data: "ch3.pdSim", label: "PD 制御" }] } },
      ],
    },
  ],
});
