// ch2 第2部 線形系の解、安定性、伝達関数
LECTURE.chapter({
  id: "ch2",
  scenes: [
    {
      id: "s01",
      layout: "full",
      blocks: [
        { type: "math", tex: "\\dot z = Az + Bu,\\qquad y = Cz + Du" },
        { type: "p", text: "定数変化法で解がそのまま書ける。" },
        { type: "math", at: 2, tex: "z(t) = \\underbrace{e^{At} z(0)}_{\\text{初期値が運ばれる}} + \\underbrace{\\int_0^t e^{A(t-\\tau)} B\\, u(\\tau)\\, d\\tau}_{\\text{入力の影響の重ね合わせ}}" },
        { type: "note", at: 2, text: "$e^{At}$ の振る舞いは $A$ のジョルダン標準形で決まる。" },
      ],
    },
    {
      id: "s02",
      layout: "split",
      blocks: [
        {
          type: "def",
          label: "定義4（安定性）",
          text: "自律系 $\\dot z = f(z)$、$f(0) = 0$ を考える。任意の $\\varepsilon > 0$ に対し $\\delta > 0$ があって $|z(0)| < \\delta \\Rightarrow |z(t)| < \\varepsilon\\ (t \\ge 0)$ のとき、原点は<span class='term'>リアプノフ安定</span>であるという。",
        },
        { type: "p", at: 2, text: "さらに原点の近くから出た解が $t \\to \\infty$ で $0$ に収束するとき<span class='term'>漸近安定</span>という。単に「安定」と言えば漸近安定のこと。" },
        { type: "p", at: 3, text: "$\\sigma(A) \\subset \\mathbb{C}_-$ をみたす $A$ を<span class='term'>フルビッツ行列</span>（安定行列）と呼ぶ。" },
        { type: "fig", area: "right", name: "epsDelta", opts: { asympAt: 2 } },
      ],
    },
    {
      id: "s03",
      layout: "split",
      blocks: [
        { type: "def", label: "命題1", text: "$\\dot z = Az$ の原点が漸近安定 $\\iff$ $A$ がフルビッツ。" },
        { type: "p", at: 2, text: "非線形系でも、線形化 $A$ がフルビッツなら平衡点は漸近安定、$A$ が実部正の固有値をもてば不安定（リアプノフの間接法）。" },
        { type: "p", at: 3, text: "振り子の $A$ は $+p \\approx 4.64$ をもつ。元の非線形の振り子も不安定である。" },
        {
          type: "fig", area: "right", name: "polePlane", at: 3,
          opts: { title: "線形化した振り子の A の固有値　+p ≈ 4.64 が右半平面にある", range: [8, 3], height: 300, sets: [{ eig: "ch1.eig", labels: [{ re: 4.64, im: 0, text: "+p", cls: "var" }] }] },
        },
      ],
    },
    {
      id: "s04",
      layout: "full",
      blocks: [
        {
          type: "def",
          label: "定義5（ラプラス変換）",
          text: "$[0, \\infty)$ 上の局所可積分関数 $f$ が $|f(t)| \\le Ke^{at}$ をみたすとき、$\\operatorname{Re} s > a$ で $$F(s) = \\int_0^\\infty f(t) e^{-st}\\, dt$$",
        },
        { type: "list", at: 2, items: ["線形性", "微分則 $\\mathcal{L}[f'] = sF(s) - f(0)$", "畳み込み $\\mapsto$ 積"] },
        { type: "p", at: 3, text: "<span class='term'>終値定理</span>：$sF(s)$ が $\\operatorname{Re} s \\ge 0$ で正則なら $\\displaystyle\\lim_{t\\to\\infty} f(t) = \\lim_{s\\to 0} sF(s)$。" },
      ],
    },
    {
      id: "s05",
      layout: "full",
      blocks: [
        { type: "def", label: "定義6（伝達関数、極、零点、プロパー）", text: "$z(0) = 0$ で状態方程式をラプラス変換すると $Y(s) = G(s)U(s)$。$$G(s) = C(sI - A)^{-1}B + D$$ を入力から出力への<span class='term'>伝達関数</span>という。" },
        { type: "p", at: 2, text: "1入力1出力なら $G$ は実係数の有理関数。既約分数の分母の根を<span class='term'>極</span>、分子の根を<span class='term'>零点</span>と呼ぶ。" },
        { type: "p", at: 3, text: "$|s| \\to \\infty$ で有界なら<span class='term'>プロパー</span>、$0$ に収束すれば厳密にプロパー。物理的な系の伝達関数はプロパーである。" },
      ],
    },
    {
      id: "s06",
      layout: "full",
      blocks: [
        { type: "math", tex: "u(t) = e^{st}\\quad\\Longrightarrow\\quad y(t) = G(s)\\, e^{st}\\qquad (s \\notin \\sigma(A)\\text{、初期値を適当に選ぶ})" },
        { type: "p", at: 2, text: "伝達関数は「指数関数を入れたら何倍の指数関数が出てくるか」の表である。第4部では $s = j\\omega$ と置いて正弦波を読む。" },
      ],
    },
    {
      id: "s07",
      layout: "full",
      blocks: [
        { type: "math", tex: "G(s) = C\\,\\frac{\\operatorname{adj}(sI - A)}{\\det(sI - A)}\\,B + D" },
        { type: "p", text: "極 $\\subset \\sigma(A)$。ただし $\\det(sI-A)$ の因子が分子と約分されて消えることがある。" },
        { type: "p", at: 2, text: "消えた固有値が $\\mathbb{C}_-$ の外にあると、入出力だけ見ていても気づかない不安定が中に残る。" },
      ],
    },
    {
      id: "s08",
      layout: "split",
      blocks: [
        { type: "def", label: "定義7（BIBO 安定）", text: "有界な入力にいつも有界な出力を返すとき <span class='term'>BIBO 安定</span>という。プロパーな有理関数 $G$ では、BIBO 安定 $\\iff$ 極がすべて $\\mathbb{C}_-$。" },
        { type: "p", at: 2, text: "根を求めずに係数の四則演算で判定できる（ラウス・フルビッツ）。" },
        { type: "list", at: 3, items: ["$s^2 + a_1 s + a_0$：$a_1 > 0,\\ a_0 > 0$", "$s^3 + a_2 s^2 + a_1 s + a_0$：係数がすべて正で $a_2 a_1 > a_0$"] },
        { type: "fig", area: "right", name: "quadRoots", at: 3 },
      ],
    },
    {
      id: "s09",
      layout: "split",
      blocks: [
        { type: "math", tex: "P_\\theta(s) = \\frac{-b}{s^2 - p^2},\\qquad b = \\frac{1}{M\\ell} = 2" },
        { type: "p", at: 2, text: "$P_\\theta$ の分母には固有値 $0$（2重）が現れない。角度だけでは台車の行方が見えない。" },
        { type: "math", at: 3, tex: "P_x(s) = \\frac{s^2 - g/\\ell}{M\\, s^2 (s^2 - p^2)}" },
        { type: "p", at: 3, text: "右半平面の零点 $\\sqrt{g/\\ell} \\approx 4.43$。第6部で限界として戻ってくる。" },
        {
          type: "fig", area: "right", name: "polePlane",
          opts: {
            title: "×：極、○：零点", range: [7, 2], height: 440,
            sets: [
              { label: "P_θ", poles: "ch2.Ptheta.poles", zeros: "ch2.Ptheta.zeros" },
              { label: "P_x", poles: "ch2.Px.poles", zeros: "ch2.Px.zeros", at: 3 },
            ],
          },
        },
      ],
    },
  ],
});
