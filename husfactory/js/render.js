// Canvas 描画。ワールド座標は 1 タイル = 1 単位、タイル (x,y) は [x, x+1) × [y, y+1)
HF.Render = (() => {
  const D = HF.DATA;
  const TILE = 48;
  let canvas, ctx, dpr = 1, W = 0, H = 0;
  const imgs = {};

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    for (const id in D.STICKERS) {
      const im = new Image();
      im.src = 'stickers/' + D.STICKERS[id].file;
      imgs[id] = im;
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function screenToWorld(v, sx, sy) {
    const s = TILE * v.zoom;
    return [(sx - W / 2) / s + v.x, (sy - H / 2) / s + v.y];
  }
  function worldToScreen(v, wx, wy) {
    const s = TILE * v.zoom;
    return [(wx - v.x) * s + W / 2, (wy - v.y) * s + H / 2];
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSticker(id, cx, cy, size, alpha) {
    const im = imgs[id];
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (im && im.complete && im.naturalWidth) {
      const w = size, h = size * im.naturalHeight / im.naturalWidth;
      ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawBelt(e, t) {
    ctx.fillStyle = '#8b8fa8';
    ctx.fillRect(-0.5, -0.36, 1, 0.72);
    ctx.fillStyle = '#b9bdd3';
    ctx.fillRect(-0.5, -0.36, 1, 0.07);
    ctx.fillRect(-0.5, 0.29, 1, 0.07);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.5, -0.3, 1, 0.6);
    ctx.clip();
    const off = e.blocked > 0 ? 0 : (t * D.BELT_SPEED) % 0.5;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 0.08;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = -1; i < 2; i++) {
      const x = -0.5 + i * 0.5 + off + 0.25;
      ctx.beginPath();
      ctx.moveTo(x - 0.1, -0.16);
      ctx.lineTo(x + 0.05, 0);
      ctx.lineTo(x - 0.1, 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMachine(e, k, S) {
    const tool = D.TOOLS[e.t];
    ctx.fillStyle = tool.color;
    rrect(-0.44, -0.44, 0.88, 0.88, 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,80,0.45)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    if (e.t !== 'depot') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0.3, -0.13);
      ctx.lineTo(0.47, 0);
      ctx.lineTo(0.3, 0.13);
      ctx.closePath();
      ctx.fill();
    }
  }

  function machineIcon(e, k, S) {
    if (e.t === 'miner') return S.nodes[k];
    if (e.t === 'proc' || e.t === 'comb') return e.recipe ? D.RECIPE_BY_ID[e.recipe].out : null;
    return null;
  }

  function machineProgress(e) {
    if (e.t === 'miner') return e.out ? 1 : e.timer / D.MINER_TIME;
    if ((e.t === 'proc' || e.t === 'comb') && e.recipe) return e.out ? 1 : e.timer / D.RECIPE_BY_ID[e.recipe].time;
    return 0;
  }

  const LABEL = { miner: '採掘', proc: '加工', comb: '合成', depot: '納品' };

  function draw(S, ui, t) {
    const G = HF.Game;
    const v = S.view;
    const s = TILE * v.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#b8a8d0';
    ctx.fillRect(0, 0, W, H);

    const [wx0, wy0] = screenToWorld(v, 0, 0);
    const [wx1, wy1] = screenToWorld(v, W, H);
    const x0 = Math.floor(wx0), y0 = Math.floor(wy0), x1 = Math.ceil(wx1), y1 = Math.ceil(wy1);
    const r = G.radius();
    const maxR = D.AREA_RADIUS[D.AREA_RADIUS.length - 1];

    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - v.x * s), dpr * (H / 2 - v.y * s));

    // 地面
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < -maxR || x >= maxR || y < -maxR || y >= maxR) continue;
        const inside = x >= -r && x < r && y >= -r && y < r;
        const odd = (x + y) & 1;
        ctx.fillStyle = inside ? (odd ? '#fff3dc' : '#ffeacb') : (odd ? '#d8cbe6' : '#d1c3e0');
        ctx.fillRect(x, y, 1.02, 1.02);
      }
    }
    // エリア境界
    ctx.strokeStyle = '#ff7aa8';
    ctx.lineWidth = 3 / s;
    ctx.setLineDash([8 / s, 6 / s]);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.setLineDash([]);

    // 資源ノード
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = x + ',' + y;
        const id = S.nodes[k];
        if (!id) continue;
        ctx.fillStyle = D.STICKERS[id].color;
        ctx.globalAlpha = 0.55;
        rrect(x + 0.06, y + 0.06, 0.88, 0.88, 0.3);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (!S.entities[k]) drawSticker(id, x + 0.5, y + 0.5, 0.5, 0.75);
      }
    }

    // 設置物
    const items = [];
    const marks = [];
    const labels = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = x + ',' + y;
        const e = S.entities[k];
        if (!e) continue;
        ctx.save();
        ctx.translate(x + 0.5, y + 0.5);
        ctx.rotate(e.d * Math.PI / 2);
        if (e.t === 'belt') drawBelt(e, t);
        else drawMachine(e, k, S);
        ctx.restore();
        if (e.t === 'belt') {
          if (e.item) {
            const p = e.item.p - 0.5;
            items.push([e.item.id, x + 0.5 + G.DX[e.d] * p, y + 0.5 + G.DY[e.d] * p]);
          }
        } else {
          const icon = machineIcon(e, k, S);
          if (icon) drawSticker(icon, x + 0.5, y + 0.47, 0.52);
          else if (e.t === 'depot') drawDepotIcon(x + 0.5, y + 0.5, e.hub);
          else drawQuestion(x + 0.5, y + 0.5);
          const prog = machineProgress(e);
          if (prog > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(x + 0.16, y + 0.8, 0.68, 0.07);
            ctx.fillStyle = '#ff5c8a';
            ctx.fillRect(x + 0.16, y + 0.8, 0.68 * Math.min(1, prog), 0.07);
          }
          labels.push([LABEL[e.t], x + 0.5, y]);
        }
        if (G.isJammed(k, e)) marks.push([x + 0.5, y + 0.5]);
      }
    }
    for (const [id, ix, iy] of items) drawSticker(id, ix, iy, 0.62);

    // ゴースト（マウスホバー時）
    if (ui.hover && D.TOOLS[ui.tool]) {
      const [hx, hy] = ui.hover;
      if (!S.entities[hx + ',' + hy]) {
        ctx.globalAlpha = 0.5;
        ctx.save();
        ctx.translate(hx + 0.5, hy + 0.5);
        ctx.rotate(ui.rot * Math.PI / 2);
        if (ui.tool === 'belt') drawBelt({}, t);
        else drawMachine({ t: ui.tool }, null, S);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    if (ui.hover && ui.tool === 'remove') {
      ctx.strokeStyle = '#ff3b6b';
      ctx.lineWidth = 3 / s;
      ctx.strokeRect(ui.hover[0] + 0.04, ui.hover[1] + 0.04, 0.92, 0.92);
    }
    if (ui.selected) {
      ctx.strokeStyle = '#ff3b8a';
      ctx.lineWidth = 3 / s;
      rrect(ui.selected[0] + 0.02, ui.selected[1] + 0.02, 0.96, 0.96, 0.2);
      ctx.stroke();
    }

    // 画面座標で描く文字類
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s >= 34) {
      ctx.font = `bold ${Math.round(s * 0.2)}px "M PLUS Rounded 1c", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const [text, lx, ly] of labels) {
        const [sx, sy] = worldToScreen(v, lx, ly);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeText(text, sx, sy + s * 0.04);
        ctx.fillStyle = '#4a3560';
        ctx.fillText(text, sx, sy + s * 0.04);
      }
    }
    const pulse = 1 + Math.sin(t * 8) * 0.12;
    for (const [mx, my] of marks) {
      const [sx, sy] = worldToScreen(v, mx, my - 0.45);
      const rad = Math.max(8, s * 0.2) * pulse;
      ctx.fillStyle = '#ff3b6b';
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(rad * 1.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', sx, sy + 1);
    }
  }

  function drawDepotIcon(cx, cy, hub) {
    ctx.fillStyle = '#fff';
    rrect(cx - 0.22, cy - 0.12, 0.44, 0.32, 0.06);
    ctx.fill();
    ctx.fillStyle = '#c98b4e';
    ctx.fillRect(cx - 0.22, cy - 0.12, 0.44, 0.08);
    if (hub) {
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath();
      ctx.arc(cx, cy - 0.26, 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawQuestion(cx, cy) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b5a85';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy - 0.05, 0.08, Math.PI, Math.PI * 2.4);
    ctx.lineTo(cx, cy + 0.06);
    ctx.stroke();
    ctx.fillStyle = '#6b5a85';
    ctx.fillRect(cx - 0.03, cy + 0.1, 0.06, 0.06);
  }

  return {
    TILE, init, draw, screenToWorld, worldToScreen,
    width: () => W, height: () => H,
  };
})();
