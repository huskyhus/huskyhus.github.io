// ch5b 第5部（後半） 最適レギュレータ
LECTURE.chapter({
  id: "ch5b",
  scenes: [
    {
      id: "s01",
      layout: "full",
      blocks: [
        { type: "p", text: "固有値はどこにでも置ける。では、どこに置けばよいか。" },
        { type: "p", at: 2, text: "左へ遠く置くほど速く収束するが、入力が大きくなり、雑音にも敏感になる。この兼ね合いを目的関数で書く。" },
      ],
    },
    {
      id: "s02",
      layout: "full",
      blocks: [
        { type: "math", tex: "J = \\int_0^\\infty \\bigl( z^\\top Q z + u^\\top R u \\bigr)\\, dt,\\qquad Q \\succeq 0,\\ R \\succ 0" },
        { type: "def", at: 2, label: "定理（最適レギュレータ、LQR）", text: "$(A, B)$ 可安定、$(Q^{1/2}, A)$ 可検出なら、<span class='term'>代数リッカチ方程式</span> $$A^\\top X + XA - XBR^{-1}B^\\top X + Q = 0$$ は $A - BR^{-1}B^\\top X$ をフルビッツにする半正定値解 $X$ をただ一つもつ。" },
        { type: "p", at: 3, text: "$J$ を最小にする入力は $u = -R^{-1}B^\\top X z$、最小値は $z(0)^\\top X z(0)$。これを<span class='term'>最適レギュレータ</span>（<span class='term'>LQR</span>）と呼ぶ。" },
      ],
    },
    {
      id: "s03",
      layout: "full",
      blocks: [
        { type: "p", text: "任意の安定化入力について $\\frac{d}{dt}(z^\\top X z)$ を計算し、リッカチ方程式を使うと" },
        { type: "math", at: 2, tex: "z^\\top Q z + u^\\top R u = -\\frac{d}{dt}\\bigl(z^\\top X z\\bigr) + \\bigl(u + R^{-1}B^\\top X z\\bigr)^{\\!\\top} R\\, \\bigl(u + R^{-1}B^\\top X z\\bigr)" },
        { type: "math", at: 3, tex: "J = z(0)^\\top X z(0) + \\int_0^\\infty \\bigl\\| R^{1/2}(u + R^{-1}B^\\top X z) \\bigr\\|^2 dt \\ \\ge\\ z(0)^\\top X z(0)" },
        { type: "note", at: 3, text: "解の存在と一意性はハミルトン行列の安定不変部分空間を使う。ここでは主張のみ。" },
      ],
    },
    {
      id: "s04",
      layout: "split",
      blocks: [
        { type: "math", tex: "Q = \\operatorname{diag}(10, 1, 100, 1),\\quad R = 1" },
        { type: "p", text: "角度のずれを台車のずれより重く罰する。" },
        { type: "math", at: 2, tex: "K \\approx (-3.16,\\ -4.43,\\ -39.58,\\ -8.48)" },
        { type: "p", at: 2, text: "閉ループ固有値 $-5.17 \\pm 1.72j$、$-1.10 \\pm 0.94j$。" },
        { type: "p", at: 3, text: "角度への係数は極配置の $49$ から $40$ へ。重みから置き場所が決まった。" },
        {
          type: "fig", area: "right", name: "polePlane", at: 2,
          opts: { title: "LQR の閉ループ固有値", range: [7, 2.5], height: 300, sets: [{ eig: "ch5b.eig" }] },
        },
      ],
    },
    {
      id: "s05",
      layout: "full",
      blocks: [
        {
          type: "fig", name: "cartAnim", style: "width:740px;align-self:center", opts: {
            playAt: 1,
            title: "非線形モデル、θ(0) = 0.2 rad。LQR では台車が約 0.35 m 先（t ≈ 0.9 s）まで走って戻る。PD では流れ続ける",
            sims: [{ data: "ch5b.pd", label: "PD" }, { data: "ch5b.lqr", label: "LQR", accent: true }],
          },
        },
      ],
    },
    {
      id: "s06",
      layout: "split",
      blocks: [
        { type: "math", tex: "L(s) = K(sI - A)^{-1}B,\\qquad |1 + L(j\\omega)| \\ge 1\\quad(\\forall\\omega)" },
        { type: "p", text: "カルマンの不等式。" },
        { type: "p", at: 2, text: "位相余裕 $60^\\circ$ 以上、ゲインは $1/2$ 倍から無限大倍まで変えても安定。" },
        { type: "p", at: 3, text: "オブザーバを挟むと保証は消える。カルマンフィルタと組んだ LQG でも余裕はいくらでも小さくなりうる（どちらも本講義の範囲外）。" },
        { type: "fig", area: "right", name: "lqrNyquist", at: 1 },
      ],
    },
  ],
});
