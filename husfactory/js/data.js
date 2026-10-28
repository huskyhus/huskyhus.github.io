// ゲームデータ定義：スタンプ・レシピ・機械・ミッション
window.HF = window.HF || {};

HF.DATA = (() => {
  // tier 0 は資源ノードから採掘できるスタンプ
  const STICKERS = {
    hatarake:  { name: '働け！',               file: '744223957.png', tier: 0, color: '#ff9eb5' },
    mori:      { name: '父は森！',             file: '744223944.png', tier: 0, color: '#7fd17f' },
    haha:      { name: '母は偉大なり！',       file: '744223943.png', tier: 0, color: '#c49bff' },
    neru:      { name: '寝る子は育つ',         file: '744223956.png', tier: 0, color: '#ffcf5c' },
    yatchi:    { name: 'やっちまった！',       file: '744223939.png', tier: 1 },
    zazen:     { name: '座禅する！',           file: '744223948.png', tier: 1 },
    kando:     { name: '感動！',               file: '744223942.png', tier: 1 },
    kisoku:    { name: 'めざせ規則生活！',     file: '744223945.png', tier: 1 },
    hansei:    { name: 'すまん猛反省してる！', file: '744223940.png', tier: 2 },
    arigatasa: { name: 'ありがたさ痛感！',     file: '744223941.png', tier: 2 },
    kansha:    { name: '感謝しかない！',       file: '744223946.png', tier: 2 },
    junbi:     { name: '準備完了！',           file: '744223959.png', tier: 2 },
    saraba:    { name: '欲望よさらば',         file: '744223949.png', tier: 2 },
    gomen:     { name: 'ごめんなさい…',        file: '744223952.png', tier: 3 },
    sumimasen: { name: 'すみません',           file: '744223953.png', tier: 3 },
    oroka:     { name: 'おのれの愚かさ今知る！', file: '744223947.png', tier: 3 },
    yokubou:   { name: '人は欲望と共にある',   file: '744223955.png', tier: 3 },
    cheat:     { name: '今日はチートデイ',     file: '744223958.png', tier: 3 },
    wasureru:  { name: '忘れるなよ！',         file: '744223938.png', tier: 3 },
    jigoku:    { name: '地獄！',               file: '744223950.png', tier: 4 },
    fukanou:   { name: '不可能です！',         file: '744223954.png', tier: 4 },
    gyakuten:  { name: '逆転劇',               file: '744223951.png', tier: 4 },
    omaemo:    { name: 'おまえもな！',         file: '744223937.png', tier: 4 },
    tokiwa:    { name: '時は満ちた',           file: '744223960.png', tier: 5 },
  };

  // type: proc = 加工機(1→1), comb = 合成機(2→1)。time は秒
  const RECIPES = [
    { id: 'r_yatchi',    type: 'proc', in: { hatarake: 1 },            out: 'yatchi',    time: 1.5 },
    { id: 'r_zazen',     type: 'proc', in: { neru: 1 },                out: 'zazen',     time: 1.5 },
    { id: 'r_kando',     type: 'proc', in: { haha: 1 },                out: 'kando',     time: 1.5 },
    { id: 'r_kisoku',    type: 'proc', in: { mori: 1 },                out: 'kisoku',    time: 1.5 },
    { id: 'r_hansei',    type: 'comb', in: { yatchi: 1, zazen: 1 },    out: 'hansei',    time: 2.5 },
    { id: 'r_arigatasa', type: 'comb', in: { kando: 1, hatarake: 1 },  out: 'arigatasa', time: 2.5 },
    { id: 'r_kansha',    type: 'comb', in: { kando: 1, mori: 1 },      out: 'kansha',    time: 2.5 },
    { id: 'r_junbi',     type: 'comb', in: { kisoku: 1, neru: 1 },     out: 'junbi',     time: 2.5 },
    { id: 'r_saraba',    type: 'comb', in: { zazen: 1, haha: 1 },      out: 'saraba',    time: 2.5 },
    { id: 'r_gomen',     type: 'comb', in: { hansei: 1, arigatasa: 1 }, out: 'gomen',    time: 3 },
    { id: 'r_sumimasen', type: 'proc', in: { gomen: 1 },               out: 'sumimasen', time: 2 },
    { id: 'r_oroka',     type: 'comb', in: { hansei: 1, yatchi: 1 },   out: 'oroka',     time: 3 },
    { id: 'r_yokubou',   type: 'comb', in: { saraba: 1, kando: 1 },    out: 'yokubou',   time: 3 },
    { id: 'r_cheat',     type: 'comb', in: { yokubou: 1, neru: 1 },    out: 'cheat',     time: 3 },
    { id: 'r_wasureru',  type: 'comb', in: { kansha: 1, junbi: 1 },    out: 'wasureru',  time: 3 },
    { id: 'r_jigoku',    type: 'comb', in: { cheat: 1, oroka: 1 },     out: 'jigoku',    time: 4 },
    { id: 'r_fukanou',   type: 'comb', in: { jigoku: 1, junbi: 1 },    out: 'fukanou',   time: 4 },
    { id: 'r_gyakuten',  type: 'comb', in: { fukanou: 1, wasureru: 1 }, out: 'gyakuten', time: 5 },
    { id: 'r_omaemo',    type: 'comb', in: { sumimasen: 1, wasureru: 1 }, out: 'omaemo', time: 4 },
    { id: 'r_tokiwa',    type: 'comb', in: { gyakuten: 1, omaemo: 1 }, out: 'tokiwa',    time: 6 },
  ];
  const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

  const TOOLS = {
    belt:  { name: 'ベルト', color: '#9aa0bb', cost: { hatarake: 1 },
             desc: 'ドラッグで連続設置。ベルトをタップで回転' },
    miner: { name: '採掘機', color: '#ffcf70', cost: { mori: 3, hatarake: 3 },
             desc: '資源の上に置く。矢印の方向へ送り出す' },
    proc:  { name: '加工機', color: '#8fd3ff', cost: { mori: 4, hatarake: 4 },
             desc: '1つのスタンプを別のスタンプに加工する' },
    comb:  { name: '合成機', color: '#c7a4ff', cost: { mori: 5, hatarake: 5, yatchi: 3 },
             desc: '2つのスタンプを合成する' },
    depot: { name: '納品口', color: '#7ee0a8', cost: { kisoku: 5, kando: 5 },
             desc: '届いたスタンプを在庫にする' },
  };

  const MISSIONS = [
    { title: 'はじめての出荷', text: '採掘機で資源を掘り、ベルトで納品口まで運ぼう。',
      need: { hatarake: 10, mori: 10 },
      reward: { tools: ['proc'], recipes: ['r_yatchi', 'r_zazen', 'r_kando', 'r_kisoku'], area: 1 } },
    { title: '加工の時間', text: '加工機でスタンプを加工しよう。違うスタンプが届くと詰まるので注意。',
      need: { yatchi: 10, zazen: 10 },
      reward: { tools: ['comb'], recipes: ['r_hansei', 'r_arigatasa', 'r_kansha', 'r_junbi', 'r_saraba'] } },
    { title: '気持ちを合成', text: '合成機は2種類のスタンプを受け取る。',
      need: { hansei: 8, kansha: 8, junbi: 8 },
      reward: { tools: ['depot'], recipes: ['r_gomen', 'r_sumimasen', 'r_oroka', 'r_yokubou'], area: 1 } },
    { title: '謝罪の工場', text: '謝って、悟って、欲望と向き合おう。',
      need: { sumimasen: 8, oroka: 8, yokubou: 8 },
      reward: { recipes: ['r_cheat', 'r_wasureru'] } },
    { title: '欲望と忘却', text: 'チートデイは大事。',
      need: { cheat: 6, wasureru: 6 },
      reward: { recipes: ['r_jigoku', 'r_fukanou', 'r_omaemo'], area: 1 } },
    { title: '地獄の先へ', text: '不可能を可能に。',
      need: { fukanou: 5, omaemo: 5 },
      reward: { recipes: ['r_gyakuten', 'r_tokiwa'] } },
    { title: '時は満ちた', text: '最後のスタンプを納品しよう。',
      need: { tokiwa: 1 },
      reward: { ending: true } },
  ];

  // エリアの半径（タイル）。ミッション報酬で段階的に広がる
  const AREA_RADIUS = [10, 16, 24, 34];

  // 序盤に必ず置かれる資源
  const FIXED_CLUSTERS = [
    { id: 'hatarake', x: -6, y: -3 },
    { id: 'mori',     x: 5,  y: 4 },
    { id: 'haha',     x: 12, y: -6 },
    { id: 'neru',     x: -12, y: 7 },
  ];

  return {
    STICKERS, RECIPES, RECIPE_BY_ID, TOOLS, MISSIONS, AREA_RADIUS, FIXED_CLUSTERS,
    BELT_SPEED: 2.5,   // タイル/秒
    MINER_TIME: 1.6,   // 秒/個
    BUFFER_MULT: 3,    // 機械が溜め込める入力数（レシピ必要数の倍率）
    START_INVENTORY: { hatarake: 40, mori: 20 },
  };
})();
