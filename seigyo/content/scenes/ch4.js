// ch4 第4部 周波数応答とナイキストの安定判別
LECTURE.chapter({
  id: "ch4",
  scenes: [
    {
      id: "s01",
      layout: "split",
      blocks: [
        { type: "def", label: "定義12（周波数応答、ボード線図）", text: "$G$ を BIBO 安定とする。入力 $\\sin\\omega t$ に対し、過渡項が消えたあとの出力は $$|G(j\\omega)|\\,\\sin\\bigl(\\omega t + \\arg G(j\\omega)\\bigr)$$" },
        { type: "p", at: 2, text: "$G(j\\omega)$ を<span class='term'>周波数応答</span>、$\\arg G(j\\omega)$ を<span class='term'>位相</span>、$|G(j\\omega)|$ を周波数 $\\omega$ でのゲインと呼ぶ。" },
        { type: "p", at: 3, text: "横軸 $\\log\\omega$、縦軸 $20\\log_{10}|G|$（<span class='term'>デシベル</span>）と位相の2枚組を<span class='term'>ボード線図</span>という。" },
        { type: "fig", area: "right", name: "sineResponse" },
      ],
    },
    {
      id: "s02",
      layout: "split",
      blocks: [
        { type: "p", text: "$G$ が不安定でも、複素数 $G(j\\omega)$ の値は定義できる。使うのはこちら。" },
        { type: "math", at: 2, tex: "L(s) = \\frac{2(43 + 4s)}{s^2 - 21.56}" },
        { type: "p", at: 2, text: "低い周波数でゲイン約 12 dB、$\\omega \\approx 9.7$ で 0 dB を横切る。" },
        { type: "fig", area: "right", name: "bodeNyquist", at: 2, opts: { bode: true, titleFn: (D) => `L(jω) のボード線図　ω = 0.1〜316 rad/s、ω ≈ <span class="num">${D.wc.toFixed(1)}</span> で 0 dB` } },
      ],
    },
    {
      id: "s03",
      layout: "split",
      blocks: [
        { type: "def", label: "定義13（ナイキスト線図）", text: "$\\omega$ を $-\\infty$ から $+\\infty$ まで動かしたときの $L(j\\omega)$ の像を、向きつきの閉曲線として描いたものを<span class='term'>ナイキスト線図</span>という。" },
        { type: "p", at: 2, text: "虚軸上の極は右側の小さな半円で避ける。$\\omega < 0$ の半分は $\\omega > 0$ の共役。" },
        { type: "fig", area: "right", name: "bodeNyquist", opts: { nyquist: true, titleFn: (D) => `L(jω) のナイキスト線図　ω = 0 で L(0) ≈ <span class="num">${D.L0.toFixed(2)}</span>` } },
      ],
    },
    {
      id: "s04",
      layout: "full",
      blocks: [
        { type: "def", label: "定理（ナイキストの安定判別法）", text: "$L = PC$ はプロパー、不安定な極零の約分なし。$P$ = $L$ の開右半平面の極の個数（重複度込み）。" },
        { type: "def", at: 2, label: "　", text: "$N$ = ナイキスト線図が $-1$ を反時計回りに回る回数。このとき $$\\text{閉ループが内部安定} \\iff N = P$$" },
      ],
    },
    {
      id: "s05",
      layout: "split",
      blocks: [
        { type: "p", text: "閉ループ極 = $1 + L$ の零点。開右半平面の個数を $Z$。$1 + L$ の極 = $L$ の極。" },
        { type: "p", at: 2, text: "右の閉曲線を時計回りにたどる。偏角原理より $1 + L$ の像は原点を時計回りに $Z - P$ 回まわる。" },
        { type: "p", at: 3, text: "$R \\to \\infty$ で半円の像は1点に潰れる。「$1 + L$ が $0$ を回る」=「$L$ が $-1$ を回る」から $N = P - Z$。$Z = 0 \\iff N = P$。$\\square$" },
        { type: "fig", area: "right", name: "contour" },
      ],
    },
    {
      id: "s06",
      layout: "split",
      blocks: [
        { type: "p", text: "振り子の $L$ の不安定な極は $s = +p$ の1つ：$P = 1$。" },
        { type: "p", at: 2, text: "曲線は $-1$ を反時計回りに1周する：$N = 1 = P$、閉ループは安定。" },
        { type: "p", at: 3, text: "$k_d = 0$ なら $L(j\\omega)$ は実数で、曲線は実軸上の線分（赤）に潰れる。何も回れない。" },
        { type: "fig", area: "right", name: "bodeNyquist", opts: { nyquist: true, kd0At: 3 } },
      ],
    },
    {
      id: "s07",
      layout: "split",
      blocks: [
        { type: "def", label: "定義14（安定余裕）", text: "$|L(j\\omega_c)| = 1$ となる $\\omega_c$ を<span class='term'>ゲイン交差周波数</span>、$180^\\circ + \\arg L(j\\omega_c)$ を<span class='term'>位相余裕</span>という。" },
        { type: "p", at: 2, text: "ループのゲインを何倍まで変えると曲線が $-1$ を通るか、その倍率を<span class='term'>ゲイン余裕</span>という。" },
        { type: "fig", area: "right", name: "bodeNyquist", opts: { nyquist: true, marginsAt: 1 } },
      ],
    },
    {
      id: "s08",
      layout: "full",
      blocks: [
        { type: "fig", name: "bodeNyquist", style: "--fig-max:370px", opts: { bode: true, nyquist: true, marginsAt: 1, omegaAt: 1, gainAt: 2 } },
        { type: "note", at: 3, text: "制御対象そのものが不安定なとき、制御を弱めると不安定になる。$43 \\times 0.25 \\approx 10.78$ は第3部の条件 $k_p > 10.78$ の言い換え。" },
      ],
    },
    {
      id: "s09",
      layout: "split",
      blocks: [
        { type: "p", text: "低い周波数：$|L|$ を大きくして $|S|$ を小さく（追従、外乱の抑制）。" },
        { type: "p", at: 2, text: "高い周波数：$|L|$ を小さく（雑音、モデル化していない振動）。その間を位相余裕を保って渡るように $C$ を選ぶのが<span class='term'>ループ整形</span>。" },
        { type: "p", at: 3, text: "$\\dfrac{1 + s/a}{1 + s/b}$（$a < b$）：<span class='term'>位相進み補償</span>。低域のゲインだけを上げる要素：<span class='term'>位相遅れ補償</span>。" },
        { type: "fig", area: "right", name: "loopShape", opts: { highAt: 2 } },
      ],
    },
    {
      id: "s10",
      layout: "full",
      blocks: [
        { type: "p", text: "右半平面に極も零点ももたない安定な $L$ では、位相はゲインから一意に決まる（実部と虚部のヒルベルト変換対と同じ構造）。" },
        { type: "p", at: 2, text: "$\\omega$ が10倍になるごとに 20 dB の割合でゲインが下がる区間では、位相はおよそ $-90^\\circ$。急に落とすと $-180^\\circ$ に近づき、余裕がなくなる。" },
      ],
    },
  ],
});
