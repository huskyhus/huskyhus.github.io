// ch1 第1部 制御の問題と倒立振り子
// 場面 id とステップ数は content/narration/ch1.md と対応する。
// ブロック：at = 現れるステップ、until = 消えるステップ、dimAfter = このステップより後は薄くする。
LECTURE.chapter({
  id: "ch1",
  scenes: [
    {
      id: "s01",
      layout: "title",
      blocks: [
        { type: "title", text: "数学科のための制御工学" },
        { type: "subtitle", text: "第1部　制御の問題と倒立振り子" },
        {
          type: "quote",
          at: 2,
          text: "制御とは、<em>外から加える量</em>を時間の関数として<em>選び</em>、ある<em>装置</em>の<em>振る舞い</em>を<em>望みの形</em>にすることである。",
        },
      ],
    },
    {
      id: "s02",
      layout: "split",
      blocks: [
        {
          type: "def",
          label: "定義1（系、状態、入力、出力）",
          text: "次の常微分方程式と写像の組を<span class='term'>系</span>という。$$\\dot z(t) = f\\bigl(z(t), u(t)\\bigr),\\qquad y(t) = h\\bigl(z(t), u(t)\\bigr)$$",
        },
        {
          type: "list",
          at: 2,
          items: [
            "$z(t) \\in \\mathbb{R}^n$：<span class='term'>状態</span>",
            "$u(t) \\in \\mathbb{R}^m$：<span class='term'>入力</span>（こちらが選べる量）",
            "$y(t) \\in \\mathbb{R}^p$：<span class='term'>出力</span>（センサで測れる量）",
          ],
        },
        { type: "p", at: 3, text: "制御したい系を<span class='term'>制御対象</span>（プラント）と呼ぶ。" },
        { type: "note", at: 3, text: "$f \\in C^1$、$u$ が区分連続なら、初期値と入力から解は局所的に一意に決まる。" },
        { type: "fig", area: "right", name: "sysBox", opts: { namesAt: 2, plantAt: 3 } },
      ],
    },
    {
      id: "s03",
      layout: "split",
      blocks: [
        { type: "def", label: "定義2（開ループと閉ループ）", text: "入力を時刻の既知関数として前もって決めるやり方を<span class='term'>開ループ</span>制御（フィードフォワード）という。" },
        {
          type: "p",
          at: 2,
          text: "出力の観測値から入力を決めるやり方、たとえば $u(t) = k\\bigl(y(t)\\bigr)$ を<span class='term'>フィードバック</span>制御という。その結果できる自律系が<span class='term'>閉ループ</span>系である。",
        },
        { type: "p", at: 3, text: "$y$ から $u$ を作る規則が<span class='term'>制御則</span>、それを実装したものが<span class='term'>制御器</span>（コントローラ）である。" },
        { type: "fig", area: "right", name: "loops", opts: { feedbackAt: 2, lawAt: 3 } },
      ],
    },
    {
      id: "s04",
      layout: "split",
      blocks: [
        {
          type: "list",
          items: [
            "台車：質量 $M$、水平な直線上を摩擦なしに動く",
            "振り子：長さ $\\ell$ の質量のない棒と先端の質点 $m$",
            "入力 $u$：台車を押す力",
          ],
        },
        { type: "p", at: 2, text: "質点の位置は $(x + \\ell\\sin\\theta,\\ \\ell\\cos\\theta)$。" },
        { type: "p", at: 3, text: "ラグランジュ方程式から：" },
        {
          type: "math",
          at: 3,
          tex: "\\begin{aligned}(M+m)\\ddot x + m\\ell\\,(\\ddot\\theta\\cos\\theta - \\dot\\theta^2\\sin\\theta) &= u\\\\ \\ddot x\\cos\\theta + \\ell\\ddot\\theta - g\\sin\\theta &= 0\\end{aligned}",
        },
        { type: "fig", area: "right", name: "pendulumSchematic", opts: { coordsAt: 2 } },
      ],
    },
    {
      id: "s05",
      layout: "full",
      blocks: [
        { type: "def", label: "定義3（平衡点と線形化）", text: "$f(z_e, u_e) = 0$ をみたす組 $(z_e, u_e)$ を<span class='term'>平衡点</span>という。" },
        {
          type: "p",
          at: 2,
          text: "平衡点で $A = \\partial f/\\partial z$、$B = \\partial f/\\partial u$、$C = \\partial h/\\partial z$、$D = \\partial h/\\partial u$ をとり、ずれ $\\xi = z - z_e$、$v = u - u_e$ について書いた系を<span class='term'>線形化</span>系と呼ぶ。",
        },
        { type: "math", at: 2, tex: "\\dot\\xi = A\\xi + Bv,\\qquad \\eta = C\\xi + Dv" },
        { type: "note", at: 3, text: "以下、記号を節約して $\\xi, v$ をあらためて $z, u$ と書く。" },
      ],
    },
    {
      id: "s06",
      layout: "full",
      blocks: [
        { type: "math", tex: "z = (x,\\ \\dot x,\\ \\theta,\\ \\dot\\theta)^{\\top} = 0,\\qquad u = 0\\quad\\text{が平衡点}" },
        { type: "p", at: 2, text: "$\\sin\\theta \\approx \\theta$、$\\cos\\theta \\approx 1$ として $\\ddot x, \\ddot\\theta$ について解くと：" },
        {
          type: "math",
          at: 2,
          tex: "A = \\begin{pmatrix} 0 & 1 & 0 & 0 \\\\ 0 & 0 & -\\dfrac{mg}{M} & 0 \\\\ 0 & 0 & 0 & 1 \\\\ 0 & 0 & \\dfrac{(M+m)g}{M\\ell} & 0 \\end{pmatrix},\\qquad B = \\begin{pmatrix} 0 \\\\ \\dfrac{1}{M} \\\\ 0 \\\\ -\\dfrac{1}{M\\ell} \\end{pmatrix}",
        },
      ],
    },
    {
      id: "s07",
      layout: "split",
      blocks: [
        { type: "math", tex: "\\det(\\lambda I - A) = \\lambda^2(\\lambda^2 - p^2),\\quad p^2 = \\frac{(M+m)g}{M\\ell}" },
        { type: "p", text: "固有値は $0$（2重）と $\\pm p$。" },
        { type: "p", at: 2, text: "$+p$ があるので、微小なずれは $e^{pt}$ の速さで増える。これが「倒れる」の数学的な意味である。" },
        {
          type: "p",
          at: 3,
          text: "$M = 1$ kg、$m = 0.1$ kg、$\\ell = 0.5$ m、$g = 9.8$ m/s² で $p^2 = 21.56$、$p \\approx 4.64\\ \\mathrm{s}^{-1}$。",
        },
        { type: "note", at: 3, text: "右のスライダーで棒の長さを変えられる。講義の数値は $\\ell = 0.5$ m に固定する。" },
        { type: "fig", area: "right", name: "ch1Instability", opts: { fallAt: 2, sliderAt: 3 } },
      ],
    },
  ],
});
