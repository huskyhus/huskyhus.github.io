// サイト全体の構成と、ナビゲーションの描画。
//   各ページは <body data-root="(triple/ への相対パス)" data-series="(シリーズの id)"> を持つ。
//   ・#siteNav       … 全ページ共通の上のバー（見取り図と 5 つのシリーズ）
//   ・#steps, #kicker, [data-pager] … 解説ページのページ番号と前後リンク
//   ・ol.toc[data-series] … そのシリーズの解説の目次
//   ・#sitemap       … 見取り図ページのサイトマップ
(function () {
  "use strict";
  const SERIES = [
    {
      id: "classical", short: "古典制御", title: "古典制御", subject: "ロボット関節のサーボ",
      era: "1920〜50 年代", demo: "サーボを調整する", color: "var(--warn)",
      idea: "入力と出力の関係を「周波数」で見る。PID、ボード線図、ナイキストの安定判別、安定余裕。",
      pages: [
        { href: "tf.html", title: "入力と出力の性格", sub: "伝達関数" },
        { href: "step.html", title: "ステップ応答と極", sub: "速さ・揺れ・行き過ぎ" },
        { href: "pid.html", title: "PID をきちんと", sub: "定常偏差・積分の巻き上がり・調整則" },
        { href: "bode.html", title: "揺すって測る", sub: "周波数応答とボード線図" },
        { href: "nyquist.html", title: "安定の余裕", sub: "ナイキストの安定判別" },
        { href: "shaping.html", title: "共振と遅れ", sub: "ループ整形・ノッチ・位相進み" },
        { href: "limits.html", title: "古典制御の強みと限界", sub: "そして現代制御へ" },
        { href: "math.html", title: "数学的に定式化すると", sub: "線形時不変系・ナイキスト・ボードの積分定理" },
      ],
    },
    {
      id: "modern", short: "現代制御", title: "現代制御", subject: "三重倒立振り子",
      era: "1960 年代", demo: "三重振り子を振り上げる", color: "var(--link2)",
      idea: "8 つの状態をまとめて扱う。最適軌道、LQR と時変 LQR、カルマンフィルタ。",
      pages: [
        { href: "control.html", title: "制御ってなに？", sub: "フィードバックと PID" },
        { href: "pendulum.html", title: "倒立振り子はなぜ難しい？", sub: "不安定・劣駆動・カオス" },
        { href: "plan.html", title: "台本を書く", sub: "最適な振り上げ軌道を計算する" },
        { href: "lqr.html", title: "ずれを直す", sub: "LQR と時変 LQR" },
        { href: "kalman.html", title: "見えないものを見る", sub: "カルマンフィルタ" },
        { href: "reality.html", title: "現実はもっと厳しい", sub: "雑音・誤差・遅れ" },
        { href: "beyond.html", title: "制御理論の地図", sub: "古典・現代・その先" },
        { href: "math.html", title: "数学的に定式化すると", sub: "最適制御・リッカチ方程式・時変系・推定" },
      ],
    },
    {
      id: "robust", short: "ロバスト制御", title: "ロバスト制御", subject: "ばねでつながった 2 つの台車",
      era: "1980〜90 年代", demo: "ばねの強さが変わっても止める", color: "var(--ok)",
      idea: "モデルの誤差を最初から設計に入れ、「この範囲なら必ず安定」を保証する。小ゲイン定理と H∞ 制御。",
      pages: [
        { href: "uncertainty.html", title: "モデルはいつも間違っている", sub: "不確かさとは" },
        { href: "benchmark.html", title: "題材：ばねでつながった台車", sub: "測る場所と動かす場所が違う" },
        { href: "lqg.html", title: "最適なのに壊れやすい", sub: "LQG の落とし穴" },
        { href: "smallgain.html", title: "小さな輪は回らない", sub: "小ゲイン定理と不確かさの表し方" },
        { href: "hinf.html", title: "最悪の場合を抑える", sub: "H∞ 制御" },
        { href: "tradeoff.html", title: "ただでは手に入らない", sub: "ロバスト性と性能のトレードオフ" },
        { href: "today.html", title: "ロバスト制御の今", sub: "現場での使われ方と限界" },
        { href: "math.html", title: "数学的に定式化すると", sub: "H∞ 空間・小ゲイン定理・DGKF の定理" },
      ],
    },
    {
      id: "mpc", short: "モデル予測制御", title: "モデル予測制御（MPC）", subject: "自動車の車線変更",
      era: "1970 年代〜", demo: "障害物をよけて車線を変える", color: "var(--link1)",
      idea: "毎回、少し先までの最適な計画を解き直し、最初の一手だけ実行する。制約を直接守れる。",
      pages: [
        { href: "horizon.html", title: "先を読んで、一手だけ指す", sub: "予測と再計画" },
        { href: "vehicle.html", title: "題材：車線変更", sub: "車のモデル" },
        { href: "constraints.html", title: "制約を守る", sub: "LQR と飽和では足りない" },
        { href: "qp.html", title: "毎回、最適化を解く", sub: "二次計画問題と内点法" },
        { href: "tuning.html", title: "どこまで先を読むか", sub: "ホライズンと重み" },
        { href: "mismatch.html", title: "予測が外れたら", sub: "モデル誤差と外乱" },
        { href: "today.html", title: "MPC の今", sub: "工場から自動車・ロケットまで" },
        { href: "math.html", title: "数学的に定式化すると", sub: "有限ホライズン最適制御・安定性・内点法" },
      ],
    },
    {
      id: "rl", short: "強化学習", title: "強化学習", subject: "谷から出られない非力な台車",
      era: "2010 年代〜", demo: "試行錯誤で谷を抜け出す", color: "var(--link3)",
      idea: "モデルを使わず、試行錯誤と報酬から振る舞いを学ぶ。価値関数、探索と活用、関数近似。",
      pages: [
        { href: "trial.html", title: "試行錯誤で学ぶ", sub: "報酬・方策・エージェント" },
        { href: "task.html", title: "題材：谷の台車", sub: "遅れてやってくる報酬" },
        { href: "value.html", title: "場所の良さを測る", sub: "価値関数とベルマン方程式" },
        { href: "explore.html", title: "試すか、使うか", sub: "探索と活用" },
        { href: "approx.html", title: "連続な世界を覚える", sub: "関数近似とタイルコーディング" },
        { href: "control.html", title: "制御理論とのつながり", sub: "LQR も強化学習の一種" },
        { href: "today.html", title: "強化学習の今", sub: "成果と課題" },
        { href: "math.html", title: "数学的に定式化すると", sub: "マルコフ決定過程・縮小写像・確率近似" },
      ],
    },
  ];
  window.SITE = SERIES;

  const body = document.body;
  const root = body.dataset.root || "";
  const sid = body.dataset.series || "";
  const file = location.pathname.split(/[\\/]/).pop() || "index.html";
  const inGuide = /[\\/]guide[\\/][^\\/]*$/.test(location.pathname);
  const sIdx = SERIES.findIndex((s) => s.id === sid);
  const series = SERIES[sIdx];
  const guideHref = (s, p) => `${root}${s.id}/guide/${p ? p.href : ""}`;
  const demoHref = (s) => `${root}${s.id}/`;

  // 上のバー
  const bar = document.getElementById("siteNav");
  if (bar) {
    bar.className = "sitebar";
    bar.innerHTML =
      `<a class="home${sid ? "" : " on"}" href="${root || "./"}">制御工学の見取り図</a>` +
      SERIES.map((s) => `<a class="${s.id === sid ? "on" : ""}" href="${demoHref(s)}" style="--sc:${s.color}">${s.short}</a>`).join("");
  }

  // 解説ページのページ番号・前後リンク
  if (series && inGuide) {
    const idx = series.pages.findIndex((p) => p.href === file);
    const steps = document.getElementById("steps");
    if (steps) {
      steps.innerHTML = `<a href="${demoHref(series)}" class="demo" title="デモ">▶</a>` +
        series.pages.map((p, i) => `<a href="${p.href}" class="${i === idx ? "on" : ""}" title="${p.title}">${i + 1}</a>`).join("");
    }
    const kicker = document.getElementById("kicker");
    if (kicker) kicker.textContent = idx >= 0 ? `${series.title}の解説 ${idx + 1} / ${series.pages.length}` : `${series.title}の解説`;
    const link = (href, small, title, cls) => `<a class="${cls}" href="${href}"><small>${small}</small>${title}</a>`;
    let prev, next;
    if (idx < 0) {
      prev = link(demoHref(series), "← デモ", series.demo, "prev");
      next = link(series.pages[0].href, "はじめから →", series.pages[0].title, "next");
    } else {
      prev = idx > 0 ? link(series.pages[idx - 1].href, "← 前", series.pages[idx - 1].title, "prev")
        : link("./", "← 目次", `${series.title}の解説`, "prev");
      const ns = SERIES[sIdx + 1];
      next = idx < series.pages.length - 1 ? link(series.pages[idx + 1].href, "次 →", series.pages[idx + 1].title, "next")
        : ns ? link(guideHref(ns), "次のシリーズ →", ns.title, "next")
        : link(root || "./", "おわり →", "制御工学の見取り図に戻る", "next");
    }
    document.querySelectorAll("[data-pager]").forEach((el) => (el.innerHTML = `<nav class="pager" aria-label="ページ送り">${prev}${next}</nav>`));
  }

  // シリーズの目次
  document.querySelectorAll("ol.toc[data-series], ol#toc").forEach((ol) => {
    const s = SERIES.find((x) => x.id === (ol.dataset.series || sid));
    if (!s) return;
    ol.classList.add("toc");
    ol.innerHTML = s.pages.map((p, i) =>
      `<li><a href="${guideHref(s, p)}"><span class="toc-n">${i + 1}</span><span><b>${p.title}</b><small>${p.sub}</small></span></a></li>`
    ).join("");
  });

  // 見取り図のサイトマップ
  const map = document.getElementById("sitemap");
  if (map) {
    map.innerHTML = SERIES.map((s) =>
      `<section class="map-col" style="--sc:${s.color}"><h3><a href="${demoHref(s)}">${s.title}</a></h3>` +
      `<p class="map-sub">${s.era}・題材：${s.subject}</p><ul>` +
      `<li><a href="${demoHref(s)}"><b>デモ</b>：${s.demo}</a></li>` +
      `<li><a href="${guideHref(s)}">解説の目次</a></li>` +
      s.pages.map((p, i) => `<li><a href="${guideHref(s, p)}">${i + 1}. ${p.title}</a></li>`).join("") +
      `</ul></section>`
    ).join("");
  }
  const cards = document.getElementById("seriesCards");
  if (cards) {
    cards.innerHTML = SERIES.map((s, i) =>
      `<article class="series-card" style="--sc:${s.color}">` +
      `<p class="sc-era">${i + 1}. ${s.era}</p><h3>${s.title}</h3>` +
      `<p class="sc-subject">題材：${s.subject}</p><p class="sc-idea">${s.idea}</p>` +
      `<p class="sc-links"><a class="sc-demo" href="${demoHref(s)}">デモ：${s.demo}</a><a href="${guideHref(s)}">解説（${s.pages.length} ページ）</a></p></article>`
    ).join("");
  }
})();
