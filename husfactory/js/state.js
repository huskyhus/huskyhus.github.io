// ゲームの状態。すべて JSON で表現できるプレーンなオブジェクトとして保持する
//
// {
//   format: 'husfactory-save', version: 1,
//   seed, time,                         // マップ生成シード、累計プレイ秒
//   areaLevel,                          // DATA.AREA_RADIUS の添字
//   nodes:    { "x,y": stickerId },     // 資源ノード
//   entities: { "x,y": Entity },        // 設置物
//   inventory: { stickerId: count },
//   discovered: [stickerId],
//   unlocked: { tools: [], recipes: [] },
//   mission: { index, progress: { stickerId: count } },
//   stats: { delivered: {}, produced: {} },
//   cleared, flags: { seenHelp },
//   view: { x, y, zoom },
//   settings: { bgm, se },
// }
//
// Entity:
//   belt  { t, d, item: null | { id, p } }   p: タイル内の進行度 0..1
//   miner { t, d, timer, out }
//   proc / comb { t, d, recipe, inp: { id: n }, out, timer }
//   depot { t, d, hub? }
//   d: 0=右 1=下 2=左 3=上。blocked は詰まり経過秒
HF.State = (() => {
  const FORMAT = 'husfactory-save';
  const VERSION = 1;
  const LS_KEY = 'husfactory.save.v1';

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function genNodes(seed) {
    const D = HF.DATA;
    const R = rng(seed);
    const maxR = D.AREA_RADIUS[D.AREA_RADIUS.length - 1];
    const nodes = {};
    function blob(cx, cy, id, size) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.hypot(dx, dy) > size * (0.75 + R() * 0.5)) continue;
          const x = cx + dx, y = cy + dy;
          if (Math.abs(x) <= 2 && Math.abs(y) <= 2) continue;
          if (x < -maxR || x >= maxR || y < -maxR || y >= maxR) continue;
          nodes[x + ',' + y] = id;
        }
      }
    }
    D.FIXED_CLUSTERS.forEach(c => blob(c.x, c.y, c.id, 1.6));
    const ids = Object.keys(D.STICKERS).filter(id => D.STICKERS[id].tier === 0);
    for (let i = 0; i < 28; i++) {
      const ang = R() * Math.PI * 2;
      const dist = 9 + R() * (maxR - 11);
      const cx = Math.round(Math.cos(ang) * dist);
      const cy = Math.round(Math.sin(ang) * dist);
      blob(cx, cy, ids[Math.floor(R() * ids.length)], 1 + R() * 0.9);
    }
    return nodes;
  }

  function create(seed) {
    const D = HF.DATA;
    if (seed == null) seed = Math.floor(Math.random() * 1e9);
    return {
      format: FORMAT,
      version: VERSION,
      seed,
      time: 0,
      areaLevel: 0,
      nodes: genNodes(seed),
      entities: { '0,0': { t: 'depot', d: 0, hub: true } },
      inventory: { ...D.START_INVENTORY },
      discovered: Object.keys(D.START_INVENTORY),
      unlocked: { tools: ['belt', 'miner'], recipes: [] },
      mission: { index: 0, progress: {} },
      stats: { delivered: {}, produced: {} },
      cleared: false,
      flags: { seenHelp: false },
      view: { x: 0.5, y: 0.5, zoom: 1 },
      settings: { bgm: true, se: true },
    };
  }

  // 読み込んだデータの欠損を補い、未知の ID を取り除く
  function normalize(obj) {
    const D = HF.DATA;
    if (!obj || typeof obj !== 'object' || obj.format !== FORMAT) throw new Error('husfactory のセーブデータではありません');
    if (obj.version > VERSION) throw new Error('新しいバージョンのセーブデータです');
    const base = create(typeof obj.seed === 'number' ? obj.seed : undefined);
    const s = { ...base, ...obj };
    for (const k of ['unlocked', 'mission', 'stats', 'flags', 'view', 'settings']) {
      s[k] = { ...base[k], ...(obj[k] || {}) };
    }
    if (!obj.nodes) s.nodes = base.nodes;
    const known = id => !!D.STICKERS[id];
    s.discovered = (s.discovered || []).filter(known);
    s.inventory = Object.fromEntries(Object.entries(s.inventory || {}).filter(([id, n]) => known(id) && n > 0));
    s.unlocked.tools = s.unlocked.tools.filter(t => D.TOOLS[t]);
    s.unlocked.recipes = s.unlocked.recipes.filter(r => D.RECIPE_BY_ID[r]);
    s.areaLevel = Math.max(0, Math.min(D.AREA_RADIUS.length - 1, s.areaLevel | 0));
    const ents = {};
    for (const [k, e] of Object.entries(s.entities || {})) {
      if (!e || !D.TOOLS[e.t]) continue;
      e.d = (e.d | 0) & 3;
      if (e.t === 'belt' && e.item && !known(e.item.id)) e.item = null;
      if (e.t === 'proc' || e.t === 'comb') {
        if (e.recipe && !D.RECIPE_BY_ID[e.recipe]) e.recipe = null;
        e.inp = e.inp || {};
        e.timer = e.timer || 0;
      }
      ents[k] = e;
    }
    s.entities = ents;
    s.version = VERSION;
    return s;
  }

  function serialize(state, pretty) {
    return JSON.stringify(state, null, pretty ? 1 : 0);
  }

  function parse(json) {
    return normalize(JSON.parse(json));
  }

  function save(state) {
    try { localStorage.setItem(LS_KEY, serialize(state)); } catch (e) { /* 保存できない環境 */ }
  }

  function load() {
    try {
      const json = localStorage.getItem(LS_KEY);
      return json ? parse(json) : null;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* noop */ }
  }

  return { create, normalize, serialize, parse, save, load, clear, FORMAT, VERSION };
})();
