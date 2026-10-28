// タッチ・マウス入力。1本指: ツールに応じて移動/設置、2本指: 移動とズーム
HF.Input = (() => {
  const G = HF.Game;
  const R = HF.Render;
  const ZMIN = 0.35, ZMAX = 2.5;
  let canvas, ui;
  const pts = new Map();
  let g = null; // 現在のジェスチャ

  function tileAt(sx, sy) {
    const [wx, wy] = R.screenToWorld(G.state().view, sx, sy);
    return [Math.floor(wx), Math.floor(wy)];
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pair() {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function init(c) {
    canvas = c;
    ui = HF.UI.ui;
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('pointerleave', () => { ui.hover = null; });
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', key);
  }

  function down(e) {
    canvas.setPointerCapture(e.pointerId);
    HF.Audio.unlock();
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1) {
      const panOnly = e.pointerType === 'mouse' && e.button !== 0;
      const drawTool = ui.tool === 'belt' || ui.tool === 'remove';
      g = {
        type: !panOnly && drawTool ? 'draw' : 'pan',
        tap: !panOnly,
        sx: p.x, sy: p.y, lx: p.x, ly: p.y,
        moved: false,
        start: tileAt(p.x, p.y),
        tile: tileAt(p.x, p.y),
        placed: new Set(),
      };
    } else if (pts.size === 2) {
      const v = G.state().view;
      const { d, m } = pair();
      g = { type: 'pinch', d0: d, z0: v.zoom, world: R.screenToWorld(v, m.x, m.y) };
    }
  }

  function move(e) {
    const p = local(e);
    if (e.pointerType === 'mouse') ui.hover = tileAt(p.x, p.y);
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, p);
    if (!g) return;
    const v = G.state().view;
    if (g.type === 'pinch') {
      if (pts.size < 2) return;
      const { d, m } = pair();
      v.zoom = Math.max(ZMIN, Math.min(ZMAX, g.z0 * d / g.d0));
      const s = R.TILE * v.zoom;
      v.x = g.world[0] - (m.x - R.width() / 2) / s;
      v.y = g.world[1] - (m.y - R.height() / 2) / s;
      return;
    }
    if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 8) g.moved = true;
    if (g.moved) {
      if (g.type === 'pan') {
        const s = R.TILE * v.zoom;
        v.x -= (p.x - g.lx) / s;
        v.y -= (p.y - g.ly) / s;
      } else {
        stepTo(tileAt(p.x, p.y));
      }
    }
    g.lx = p.x;
    g.ly = p.y;
  }

  function up(e) {
    pts.delete(e.pointerId);
    if (g && g.type !== 'pinch' && !g.moved && g.tap && pts.size === 0) tap(g.start);
    if (g && (g.type !== 'pinch' || pts.size === 0)) g = null;
    if (pts.size === 0) g = null;
  }

  function cancel(e) {
    pts.delete(e.pointerId);
    g = null;
  }

  function wheel(e) {
    e.preventDefault();
    const v = G.state().view;
    const p = local(e);
    const before = R.screenToWorld(v, p.x, p.y);
    v.zoom = Math.max(ZMIN, Math.min(ZMAX, v.zoom * Math.exp(-e.deltaY * 0.0015)));
    const after = R.screenToWorld(v, p.x, p.y);
    v.x += before[0] - after[0];
    v.y += before[1] - after[1];
  }

  function key(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'r' || e.key === 'R') HF.UI.rotateTool();
    if (e.key === 'Escape') HF.UI.setTool('view');
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 7) HF.UI.setTool(HF.UI.TOOL_ORDER[n - 1]);
  }

  const k = t => t[0] + ',' + t[1];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];

  // ドラッグ中、1タイルずつ進めながらベルト設置/撤去
  function stepTo(t) {
    let guard = 200;
    while (!same(g.tile, t) && guard-- > 0) {
      const dx = t[0] - g.tile[0], dy = t[1] - g.tile[1];
      let d, next;
      if (Math.abs(dx) >= Math.abs(dy)) {
        d = dx > 0 ? 0 : 2;
        next = [g.tile[0] + Math.sign(dx), g.tile[1]];
      } else {
        d = dy > 0 ? 1 : 3;
        next = [g.tile[0], g.tile[1] + Math.sign(dy)];
      }
      applyStep(g.tile, next, d);
      g.tile = next;
    }
  }

  function applyStep(a, b, d) {
    const isStart = same(a, g.start);
    if (ui.tool === 'remove') {
      if (isStart) G.remove(a[0], a[1]);
      G.remove(b[0], b[1]);
      return;
    }
    const ea = G.get(a[0], a[1]);
    if (!ea) {
      if (isStart && G.place('belt', a[0], a[1], d)) g.placed.add(k(a));
    } else if (ea.t === 'belt' && (isStart || g.placed.has(k(a)))) {
      G.setDir(a[0], a[1], d);
    }
    if (!G.get(b[0], b[1]) && G.place('belt', b[0], b[1], d)) g.placed.add(k(b));
    ui.rot = d;
    HF.UI.refreshTools();
  }

  function tap(t) {
    const [x, y] = t;
    const e = G.get(x, y);
    const tool = ui.tool;
    if (tool === 'remove') {
      G.remove(x, y);
      return;
    }
    if (tool === 'view') {
      if (e) HF.UI.openInspect(x, y);
      else HF.UI.closeSheet();
      return;
    }
    if (e) {
      if (tool === 'belt' && e.t === 'belt') G.rotate(x, y);
      else HF.UI.openInspect(x, y);
      return;
    }
    HF.UI.closeSheet();
    G.place(tool, x, y, ui.rot);
  }

  return { init };
})();
