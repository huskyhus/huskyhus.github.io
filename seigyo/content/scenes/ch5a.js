// ch5a 第5部（前半） 状態空間での設計
LECTURE.chapter({
  id: "ch5a",
  scenes: [
    {
      id: "s01",
      layout: "split",
      blocks: [
        { type: "def", label: "定義15（状態フィードバック）", text: "$K \\in \\mathbb{R}^{m\\times n}$ を用いて $u = -Kz$ とする制御則を<span class='term'>状態フィードバック</span>という。閉ループ系は $$\\dot z = (A - BK)z$$" },
        { type: "p", at: 2, text: "PD 制御は角度と角速度だけ。状態フィードバックは台車の位置と速度も使う。全状態が測れる仮定は、あとで外す。" },
        { type: "fig", area: "right", name: "stateFeedback" },
      ],
    },
    {
      id: "s02",
      layout: "full",
      blocks: [
        { type: "def", label: "定義16（可制御性）", text: "任意の $z_0, z_1$ と $T > 0$ に対し、$[0, T]$ 上の入力で $z(0) = z_0$ から $z(T) = z_1$ へ移せるとき $(A, B)$ は<span class='term'>可制御</span>であるという。" },
        { type: "math", at: 2, tex: "\\mathcal{C} = \\bigl[\\,B,\\ AB,\\ \\dots,\\ A^{n-1}B\\,\\bigr]\\quad(\\text{可制御性行列})" },
      ],
    },
    {
      id: "s03",
      layout: "full",
      blocks: [
        { type: "def", label: "定理（カルマンの階数条件）", text: "$(A, B)$ が可制御 $\\iff$ $\\operatorname{rank}\\mathcal{C} = n$" },
        { type: "p", at: 2, text: "時刻 $T$ に $0$ から届く点の集合は $u \\mapsto \\int_0^T e^{A(T-\\tau)}Bu(\\tau)\\,d\\tau$ の像。直交補空間の $v$ は $v^\\top e^{At}B = 0\\ (\\forall t)$。" },
        { type: "p", at: 3, text: "$t = 0$ で微分を繰り返すと $v^\\top A^k B = 0\\ (k = 0, 1, \\dots)$。逆はテイラー展開。ケイリー・ハミルトンより $k \\le n-1$ で十分。$\\square$" },
      ],
    },
    {
      id: "s04",
      layout: "full",
      blocks: [
        { type: "math", tex: "\\operatorname{rank}\\,[\\lambda I - A,\\ B] = n\\quad (\\forall\\lambda \\in \\mathbb{C})\\quad\\iff\\quad\\text{可制御}\\qquad(\\text{PBH 判定法})" },
        { type: "p", text: "階数が落ちる $\\lambda$ が、入力から届かない固有値。" },
        { type: "p", at: 2, text: "届かない固有値がすべて $\\mathbb{C}_-$ にあるとき $(A, B)$ は<span class='term'>可安定</span>であるという。" },
      ],
    },
    {
      id: "s05",
      layout: "full",
      blocks: [
        { type: "def", label: "定理（極配置）", text: "1入力系で、$(A, B)$ が可制御 $\\iff$ 任意の $n$ 次実モニック多項式 $\\chi$ に対し $\\det(sI - A + BK) = \\chi(s)$ となる $K$ がある。" },
        { type: "math", at: 2, tex: "A = \\begin{pmatrix} 0 & 1 & & \\\\ & \\ddots & \\ddots & \\\\ & & 0 & 1 \\\\ -a_0 & -a_1 & \\cdots & -a_{n-1} \\end{pmatrix},\\quad B = e_n\\quad\\Rightarrow\\quad BK \\text{ は最後の行だけを変える}" },
        { type: "p", at: 3, text: "逆向き：入力から届かない固有値は、$K$ をどう選んでも動かない。" },
      ],
    },
    {
      id: "s06",
      layout: "split",
      blocks: [
        { type: "math", tex: "|\\det\\mathcal{C}| = \\frac{g^2}{M^4\\ell^4} = 1536.64 \\ne 0" },
        { type: "p", text: "振り子は可制御。" },
        { type: "p", at: 2, text: "固有値を $-2, -3, -4, -5$ に置く $K$ はただ一つ：" },
        { type: "math", at: 2, tex: "K \\approx (-6.12,\\ -7.86,\\ -49.34,\\ -10.93)" },
        { type: "p", at: 3, text: "最初の2成分が台車の位置と速度への係数。PD 制御に欠けていた情報が入力に戻る。" },
        { type: "fig", area: "right", name: "polePlace", at: 2 },
      ],
    },
    {
      id: "s07",
      layout: "full",
      blocks: [
        { type: "def", label: "定義17（可観測性）", text: "$[0, T]$ の入出力から $z(0)$ が一意に定まるとき $(C, A)$ は<span class='term'>可観測</span>であるという。" },
        { type: "math", at: 2, tex: "(C, A)\\ \\text{可観測} \\iff (A^\\top, C^\\top)\\ \\text{可制御} \\iff \\operatorname{rank}\\begin{pmatrix} C \\\\ CA \\\\ \\vdots \\\\ CA^{n-1}\\end{pmatrix} = n" },
        { type: "p", at: 3, text: "見えない固有値がすべて $\\mathbb{C}_-$ にあるとき $(C, A)$ は<span class='term'>可検出</span>であるという。" },
      ],
    },
    {
      id: "s08",
      layout: "full",
      blocks: [
        { type: "math", tex: "C = (1, 0, 0, 0)\\ (y = x):\\quad \\operatorname{rank} = 4\\quad\\text{可観測}" },
        { type: "math", at: 2, tex: "C = (0, 0, 1, 0)\\ (y = \\theta):\\quad \\operatorname{rank} = 2" },
        { type: "p", at: 2, text: "角度をいくら見ても台車の位置は分からない。第2部で $P_\\theta$ から固有値 $0$ が消えていた理由。" },
      ],
    },
    {
      id: "s09",
      layout: "split",
      blocks: [
        { type: "def", label: "定義18（オブザーバ）", text: "$$\\dot{\\hat z} = A\\hat z + Bu + H(y - C\\hat z)$$ で推定値 $\\hat z$ を作る系を<span class='term'>オブザーバ</span>、$H$ を<span class='term'>オブザーバゲイン</span>と呼ぶ。" },
        { type: "math", at: 2, tex: "\\varepsilon = z - \\hat z,\\qquad \\dot\\varepsilon = (A - HC)\\varepsilon" },
        { type: "p", at: 3, text: "$(A - HC)^\\top = A^\\top - C^\\top H^\\top$：$(C, A)$ が可観測なら固有値を自由に置ける。" },
        { type: "fig", area: "right", name: "stateFeedback", opts: { observerAt: 1 } },
      ],
    },
    {
      id: "s10",
      layout: "full",
      blocks: [
        { type: "def", label: "定理（分離定理）", text: "$u = -K\\hat z$ とすると、閉ループの固有値は $\\sigma(A - BK) \\cup \\sigma(A - HC)$。" },
        { type: "math", at: 2, tex: "\\frac{d}{dt}\\begin{pmatrix} z \\\\ \\varepsilon \\end{pmatrix} = \\begin{pmatrix} A - BK & BK \\\\ 0 & A - HC \\end{pmatrix}\\begin{pmatrix} z \\\\ \\varepsilon \\end{pmatrix}" },
        { type: "p", at: 2, text: "制御器と推定器を別々に設計してよい。" },
      ],
    },
  ],
});
