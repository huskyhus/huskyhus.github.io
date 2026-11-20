// ch6 第6部 ロバスト性と根本的な限界、まとめ
LECTURE.chapter({
  id: "ch6",
  scenes: [
    {
      id: "s01",
      layout: "full",
      blocks: [
        { type: "def", label: "定義19（H∞ ノルム、ロバスト安定）", text: "極がすべて $\\mathbb{C}_-$ にあるプロパーな $G$ について $\\|G\\|_\\infty = \\sup_\\omega |G(j\\omega)|$ を <span class='term'>H∞ ノルム</span>という。" },
        { type: "math", at: 2, tex: "P_{\\text{true}} \\in \\bigl\\{\\, P(1 + W\\Delta) : \\Delta \\text{ 安定},\\ \\|\\Delta\\|_\\infty \\le 1 \\,\\bigr\\}" },
        { type: "p", at: 3, text: "集合のすべての元で内部安定なとき<span class='term'>ロバスト安定</span>化するという。必要十分条件は $\\|WT\\|_\\infty < 1$。" },
      ],
    },
    {
      id: "s02",
      layout: "split",
      blocks: [
        { type: "def", label: "定理（ボードの感度積分）", text: "$L$ の<span class='term'>相対次数</span>（分母と分子の次数の差）が 2 以上、閉ループが内部安定、$L$ の開右半平面の極を $p_1, \\dots, p_k$ とすると $$\\int_0^\\infty \\log|S(j\\omega)|\\, d\\omega = \\pi\\sum_{i=1}^k \\operatorname{Re} p_i$$" },
        { type: "p", at: 2, text: "右辺 $\\ge 0$。どこかで $|S| < 1$ にすれば、必ずどこかで $|S| > 1$ になる。" },
        { type: "fig", area: "right", name: "sensIntegral", opts: { posAt: 2 } },
      ],
    },
    {
      id: "s03",
      layout: "split",
      blocks: [
        { type: "p", text: "$\\log S$ を右半平面の大きな半円で囲み、コーシーの積分定理。相対次数 2 以上なので半円の寄与は消える。" },
        { type: "p", at: 2, text: "不安定な極は $S$ の零点。ブラシュケ積 $\\displaystyle\\prod_i \\frac{s - p_i}{s + \\bar p_i}$ で外してから計算すると、右辺が現れる。" },
        { type: "fig", area: "right", name: "contour", opts: { marksAt: 99 } },
      ],
    },
    {
      id: "s04",
      layout: "split",
      blocks: [
        { type: "math", tex: "\\pi p \\approx 14.6" },
        { type: "p", at: 2, text: "PD の $L$ は相対次数 1。微分にフィルタを掛けると 2 以上になる。右の図は時定数 0.02 s のフィルタで数値積分した結果。" },
        { type: "p", at: 3, text: "$p^2 = (M+m)g/(M\\ell)$：$\\ell = 0.25$ m なら $p \\approx 6.57$、右辺 $\\approx 20.6$。短い棒ほど立てにくい。" },
        { type: "fig", area: "right", name: "sensIntegral", opts: { posAt: 1 } },
      ],
    },
    {
      id: "s05",
      layout: "full",
      blocks: [
        { type: "def", label: "定義20（非最小位相）", text: "開右半平面に零点をもつ伝達関数を<span class='term'>非最小位相</span>であるという。" },
        { type: "p", at: 2, text: "零点 $z$ があると内部安定性から $S(z) = 1$。最大値原理より $\\|S\\|_\\infty \\ge 1$。" },
        { type: "math", at: 3, tex: "\\|S\\|_\\infty \\ge \\left| \\frac{z + p}{z - p} \\right|" },
      ],
    },
    {
      id: "s06",
      layout: "split",
      blocks: [
        { type: "p", text: "$P_x$：零点 $z \\approx 4.43$、極 $p \\approx 4.64$。とても近い。" },
        { type: "p", at: 2, text: "$x$ だけを測ると、どんな制御器でも $\\|S\\|_\\infty \\ge 9.07/0.216 \\approx 42$。" },
        { type: "p", at: 3, text: "可観測であることと実際に扱えることは別。角度センサを足せば壁は大きく下がる。" },
        { type: "note", at: 2, text: "$p/z = \\sqrt{(M+m)/M}$ なので、下界は $\\ell$ によらず $m/M$ だけで決まる。" },
        { type: "fig", area: "right", name: "nmpBound" },
      ],
    },
    {
      id: "s07",
      layout: "full",
      blocks: [
        { type: "quote", style: "font-size:34px;margin:0", text: "制御とは、<em>外から加える量</em>を時間の関数として<em>選び</em>、ある<em>装置</em>の<em>振る舞い</em>を<em>望みの形</em>にすることである。" },
        { type: "list", at: 2, items: ["第1部：外から加える量、装置 → 入力、系", "第2部：振る舞い → 固有値、極", "第3・4部：望みの形 → 感度関数、安定余裕", "第5部：選ぶ → 可制御性、最適化"] },
        { type: "p", at: 3, text: "第6部：望みの形には、右半平面の極と零点が決める上限がある。" },
      ],
    },
    {
      id: "s08",
      layout: "title",
      blocks: [
        { type: "h", text: "次に読むもの" },
        { type: "list", items: ["Åström–Murray『Feedback Systems』：全体の見通し", "Sontag『Mathematical Control Theory』：数学的に厳密な扱い", "Doyle–Francis–Tannenbaum『Feedback Control Theory』：第6部の続き"] },
      ],
    },
  ],
});
