// HTML の UI：ミッション表示・ツールバー・シート・モーダル
HF.UI = (() => {
  const D = HF.DATA;
  const G = HF.Game;
  const ui = { tool: 'view', rot: 0, selected: null, hover: null };
  const TOOL_ORDER = ['view', 'belt', 'miner', 'proc', 'comb', 'depot', 'remove'];
  const ARROWS = ['→', '↓', '←', '↑'];
  const ERR_TEXT = {
    locked: 'まだ解放されていない',
    area: 'エリアの外です（ミッションで広がる）',
    node: '採掘機は資源の上に置こう',
    cost: '在庫が足りない',
  };

  const $ = sel => document.querySelector(sel);
  let sheetKind = null;
  let refreshT = 0;
  const lastHTML = new WeakMap();

  function setHTML(el, html) {
    if (lastHTML.get(el) === html) return;
    lastHTML.set(el, html);
    el.innerHTML = html;
  }

  function stk(id, cls) {
    const s = D.STICKERS[id];
    return `<img class="stk ${cls || ''}" src="stickers/${s.file}" alt="${s.name}" title="${s.name}">`;
  }

  function costHTML(cost) {
    return Object.entries(cost).map(([id, n]) => {
      const have = G.count(id);
      return `<span class="cost ${have < n ? 'short' : ''}">${stk(id, 'xs')}×${n}<small>(${have})</small></span>`;
    }).join('');
  }

  // ---- トースト ----
  let toastTimer = null, lastToast = '', lastToastAt = 0;
  function toast(html, ms) {
    const now = performance.now();
    if (html === lastToast && now - lastToastAt < 1500) return;
    lastToast = html;
    lastToastAt = now;
    const el = $('#toast');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  }

  // ---- ツールバー ----
  function setTool(tool) {
    if (D.TOOLS[tool] && !G.isUnlocked(tool)) {
      toast(ERR_TEXT.locked);
      return;
    }
    ui.tool = tool;
    if (tool !== 'view') closeSheet();
    HF.Audio.se('click');
    refreshTools();
  }

  function rotateTool() {
    ui.rot = (ui.rot + 1) & 3;
    HF.Audio.se('rotate');
    refreshTools();
  }

  function toolButtonHTML(tool) {
    if (tool === 'view') return `<span class="ico ico-view">👆</span><span>見る</span>`;
    if (tool === 'remove') return `<span class="ico ico-remove">🧹</span><span>撤去</span>`;
    const t = D.TOOLS[tool];
    const locked = !G.isUnlocked(tool);
    return `<span class="ico" style="background:${t.color}">${locked ? '🔒' : ''}</span><span>${t.name}</span>`;
  }

  function refreshTools() {
    const bar = $('#toolbar');
    const html = TOOL_ORDER.map((tool, i) => {
      const locked = D.TOOLS[tool] && !G.isUnlocked(tool);
      return `<button class="tool ${ui.tool === tool ? 'on' : ''} ${locked ? 'locked' : ''}" data-tool="${tool}" title="${i + 1}">${toolButtonHTML(tool)}</button>`;
    }).join('') +
      `<button class="tool rot" id="rotBtn" title="R"><span class="ico ico-rot" style="transform:rotate(${ui.rot * 90}deg)">➜</span><span>向き</span></button>`;
    setHTML(bar, html);
    refreshHint();
  }

  function refreshHint() {
    const el = $('#hint');
    let html;
    if (ui.tool === 'view') html = 'タップで機械を調べる／ドラッグで移動／2本指でズーム';
    else if (ui.tool === 'remove') html = 'タップかドラッグで撤去。材料と中身は在庫に戻る';
    else {
      const t = D.TOOLS[ui.tool];
      html = `<b>${t.name}</b> <span class="dir">${ARROWS[ui.rot]}</span> ${costHTML(t.cost)}<div class="desc">${t.desc}</div>`;
    }
    setHTML(el, html);
  }

  // ---- ミッション ----
  function refreshMission() {
    const S = G.state();
    const m = D.MISSIONS[S.mission.index];
    let html;
    if (!m) {
      html = `<div class="m-title">🎉 全ミッション達成！</div><div class="m-sub">自由に工場を広げよう</div>`;
    } else {
      const needs = Object.entries(m.need).map(([id, n]) => {
        const p = S.mission.progress[id] || 0;
        return `<span class="need ${p >= n ? 'done' : ''}">${stk(id, 'sm')}<b>${p}/${n}</b></span>`;
      }).join('');
      html = `<div class="m-title"><span class="m-no">${S.mission.index + 1}/${D.MISSIONS.length}</span>${m.title}</div><div class="needs">${needs}</div>`;
    }
    setHTML($('#missionBtn'), html);
  }

  function rewardText(r) {
    const parts = [];
    (r.tools || []).forEach(t => parts.push(`${D.TOOLS[t].name}`));
    if (r.recipes && r.recipes.length) parts.push(`レシピ${r.recipes.length}種`);
    if (r.area) parts.push('エリア拡張');
    if (r.ending) parts.push('エンディング');
    return parts.join('・');
  }

  function openMission() {
    const S = G.state();
    const m = D.MISSIONS[S.mission.index];
    const done = D.MISSIONS.slice(0, S.mission.index).map((mm, i) => `<li class="done">✔ ${i + 1}. ${mm.title}</li>`).join('');
    let cur = '';
    if (m) {
      const needs = Object.entries(m.need).map(([id, n]) =>
        `<div class="row">${stk(id, 'md')}<div><div class="name">${D.STICKERS[id].name}</div><div class="num">${S.mission.progress[id] || 0} / ${n}</div></div></div>`).join('');
      cur = `<h3>${S.mission.index + 1}. ${m.title}</h3><p>${m.text}</p>${needs}<p class="reward">報酬：${rewardText(m.reward)}</p>`;
    } else {
      cur = '<h3>全ミッション達成！</h3><p>おつかれさま。工場は引き続き動かせます。</p>';
    }
    openSheet('mission', `<div class="sheet-head"><h2>ミッション</h2>${closeBtn()}</div>${cur}<ul class="mlist">${done}</ul><p class="note">ミッションの進行は、ミッション開始後に納品口へ届いた数で数えます。</p>`);
  }

  // ---- シート ----
  function closeBtn() { return `<button class="x" data-close>×</button>`; }

  function openSheet(kind, html) {
    sheetKind = kind;
    const el = $('#sheet');
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  function closeSheet() {
    sheetKind = null;
    ui.selected = null;
    $('#sheet').classList.add('hidden');
  }

  function openInventory() {
    const S = G.state();
    const ids = Object.keys(D.STICKERS).filter(id => S.discovered.includes(id));
    const cells = ids.map(id => `<div class="cell ${G.count(id) ? '' : 'zero'}">${stk(id, 'lg')}<div class="name">${D.STICKERS[id].name}</div><div class="num">×${G.count(id)}</div></div>`).join('');
    openSheet('inventory', `<div class="sheet-head"><h2>在庫</h2>${closeBtn()}</div><div class="grid">${cells}</div>`);
  }

  function recipeRowHTML(r, unlocked, S) {
    const known = id => S.discovered.includes(id);
    const io = id => known(id) || unlocked ? stk(id, 'md') : `<span class="unknown">？</span>`;
    const ins = Object.keys(r.in).map(io).join('<span class="op">＋</span>');
    return `<div class="recipe ${unlocked ? '' : 'locked'}"><span class="kind">${r.type === 'proc' ? '加工' : '合成'}</span>${ins}<span class="op">→</span>${io(r.out)}${unlocked ? `<span class="rname">${D.STICKERS[r.out].name}</span>` : '<span class="rname">未解放</span>'}</div>`;
  }

  function openBook() {
    const S = G.state();
    const total = Object.keys(D.STICKERS).length;
    const res = Object.keys(D.STICKERS).filter(id => D.STICKERS[id].tier === 0)
      .map(id => `<div class="recipe"><span class="kind" style="background:${D.STICKERS[id].color}">資源</span>${stk(id, 'md')}<span class="rname">${D.STICKERS[id].name}</span></div>`).join('');
    const rows = D.RECIPES.map(r => recipeRowHTML(r, S.unlocked.recipes.includes(r.id), S)).join('');
    openSheet('book', `<div class="sheet-head"><h2>スタンプ図鑑 <small>${S.discovered.length}/${total}</small></h2>${closeBtn()}</div><h3>資源ノード</h3>${res}<h3>レシピ</h3>${rows}`);
  }

  function openInspect(x, y) {
    const e = G.get(x, y);
    if (!e) return;
    ui.selected = [x, y];
    const name = e.t === 'belt' ? 'ベルト' : D.TOOLS[e.t].name;
    let recipes = '';
    if (e.t === 'proc' || e.t === 'comb') {
      const list = G.recipesFor(e.t);
      recipes = '<h3>レシピ</h3>' + (list.length ? list.map(r => {
        const ins = Object.keys(r.in).map(id => stk(id, 'sm')).join('＋');
        return `<button class="rsel ${e.recipe === r.id ? 'on' : ''}" data-recipe="${r.id}">${ins}<span class="op">→</span>${stk(r.out, 'sm')}<span class="rname">${D.STICKERS[r.out].name}</span></button>`;
      }).join('') : '<p class="note">使えるレシピがまだない</p>') +
        '<p class="note">未設定のときは、最初に届いたスタンプに合うレシピが自動で選ばれる。レシピに合わないスタンプが届くとベルトが詰まる。</p>';
    }
    const actions = e.hub ? '' :
      `<div class="actions"><button class="btn" data-act="rotate">⟳ 回転</button><button class="btn danger" data-act="remove">撤去</button></div>`;
    openSheet('inspect', `<div class="sheet-head"><h2>${name} <small>(${x}, ${y})</small></h2>${closeBtn()}</div><div id="inspStatus"></div>${actions}${recipes}`);
    refreshInspect();
  }

  function refreshInspect() {
    if (sheetKind !== 'inspect' || !ui.selected) return;
    const [x, y] = ui.selected;
    const S = G.state();
    const e = G.get(x, y);
    const el = $('#inspStatus');
    if (!e) { closeSheet(); return; }
    if (!el) return;
    const k = G.key(x, y);
    let html = '';
    if (e.t === 'belt') {
      html = e.item ? `運搬中：${stk(e.item.id, 'sm')} ${D.STICKERS[e.item.id].name}` : '空';
    } else if (e.t === 'miner') {
      const id = S.nodes[k];
      html = `採掘：${stk(id, 'sm')} ${D.STICKERS[id].name}`;
    } else if (e.t === 'depot') {
      html = '届いたスタンプはすべて在庫になる。';
    } else {
      const r = e.recipe && D.RECIPE_BY_ID[e.recipe];
      if (!r) html = 'レシピ未設定';
      else {
        const ins = Object.keys(r.in).map(id => `${stk(id, 'sm')}<b>${e.inp[id] || 0}</b>`).join(' ');
        html = `入力：${ins}　出力：${e.out ? stk(e.out, 'sm') : 'なし'}`;
      }
    }
    if (G.isJammed(k, e)) html += '<div class="jam">⚠ 詰まっている！出口の先を確認しよう</div>';
    setHTML(el, html);
  }

  // ---- モーダル ----
  function openModal(html) {
    const m = $('#modal');
    m.querySelector('.modal-card').innerHTML = html;
    m.classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); }

  function openMenu() {
    const S = G.state();
    openModal(`
      <div class="sheet-head"><h2>メニュー</h2>${closeBtn()}</div>
      <div class="toggles">
        <label><input type="checkbox" id="optBgm" ${S.settings.bgm ? 'checked' : ''}> BGM</label>
        <label><input type="checkbox" id="optSe" ${S.settings.se ? 'checked' : ''}> 効果音</label>
      </div>
      <h3>状態データ（JSON）</h3>
      <p class="note">工場の状態はすべてこのJSONに入っています。コピーして保存したり、別の端末で読み込んだりできます。</p>
      <textarea id="jsonBox" spellcheck="false"></textarea>
      <div class="actions">
        <button class="btn" data-act="json-refresh">現在の状態を表示</button>
        <button class="btn" data-act="json-copy">コピー</button>
        <button class="btn" data-act="json-download">ダウンロード</button>
      </div>
      <div class="actions">
        <button class="btn" data-act="json-load">テキストから読み込む</button>
        <label class="btn">ファイルから読み込む<input type="file" id="jsonFile" accept=".json,application/json" hidden></label>
      </div>
      <h3>その他</h3>
      <div class="actions">
        <button class="btn" data-act="help">遊び方</button>
        <button class="btn danger" data-act="reset">最初からやり直す</button>
      </div>`);
    $('#jsonBox').value = HF.State.serialize(S, true);
  }

  function openHelp() {
    openModal(`
      <div class="sheet-head"><h2>ハスファクトリーへようこそ</h2>${closeBtn()}</div>
      <div class="help">
        ${stk('hatarake', 'lg')}
        <ol>
          <li><b>採掘機</b>を資源の上に置くと、スタンプを掘り出して矢印の方向へ送る。</li>
          <li><b>ベルト</b>はドラッグで引ける。中央の<b>納品口</b>までつなごう。</li>
          <li>納品したスタンプは在庫になり、機械を建てる材料になる。</li>
          <li><b>加工機</b>・<b>合成機</b>で新しいスタンプを作ろう。合わないスタンプが届くと<b>詰まる</b>。スタンプは捨てられない！</li>
          <li>ミッションを達成すると機械やレシピが解放される。最後は「時は満ちた」を納品！</li>
        </ol>
        <p class="note">操作：1本指ドラッグで移動、2本指でズーム。PCではホイールでズーム、右ドラッグで移動、Rで向き変更。</p>
      </div>
      <div class="actions"><button class="btn primary" data-close>はじめる</button></div>`);
  }

  function openEnding() {
    openModal(`
      <div class="ending">
        ${stk('tokiwa', 'xl')}
        <h2>時は満ちた</h2>
        <p>24種のスタンプを生み出すハスキー工場が完成した。<br>働いて、やっちまって、反省して、感謝して、<br>欲望と共に、ついに逆転した。</p>
        <p class="note">プレイ時間：${formatTime(G.state().time)}</p>
        <div class="actions"><button class="btn primary" data-close>工場に戻る</button></div>
      </div>`);
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
    return h ? `${h}時間${m}分` : `${m}分`;
  }

  function loadJSON(text) {
    try {
      const s = HF.State.parse(text);
      G.setState(s);
      HF.State.save(s);
      closeModal();
      closeSheet();
      toast('状態を読み込んだ');
    } catch (err) {
      toast('読み込めなかった：' + err.message, 3500);
    }
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- イベント ----
  function onClick(ev) {
    const t = ev.target.closest('button, [data-close]');
    if (!t) return;
    HF.Audio.unlock();
    if (t.hasAttribute('data-close')) {
      if (t.closest('#modal')) closeModal(); else closeSheet();
      return;
    }
    if (t.dataset.tool) { setTool(t.dataset.tool); return; }
    if (t.id === 'rotBtn') { rotateTool(); return; }
    if (t.dataset.recipe && ui.selected) {
      G.setRecipe(ui.selected[0], ui.selected[1], t.dataset.recipe);
      openInspect(ui.selected[0], ui.selected[1]);
      return;
    }
    const S = G.state();
    switch (t.dataset.act) {
      case 'rotate': G.rotate(ui.selected[0], ui.selected[1]); break;
      case 'remove': G.remove(ui.selected[0], ui.selected[1]); closeSheet(); break;
      case 'json-refresh': $('#jsonBox').value = HF.State.serialize(S, true); break;
      case 'json-copy':
        $('#jsonBox').value = HF.State.serialize(S, true);
        navigator.clipboard.writeText($('#jsonBox').value).then(() => toast('コピーした'), () => {
          $('#jsonBox').select();
          toast('選択したので手動でコピーしてください');
        });
        break;
      case 'json-download': download(`husfactory-${new Date().toISOString().slice(0, 10)}.json`, HF.State.serialize(S, true)); break;
      case 'json-load': loadJSON($('#jsonBox').value); break;
      case 'help': openHelp(); break;
      case 'reset':
        if (confirm('工場をすべて消して最初からやり直しますか？（今の状態はJSONで保存しておくと戻せます）')) {
          const s = HF.State.create();
          s.flags.seenHelp = true;
          G.setState(s);
          HF.State.save(s);
          closeModal();
          closeSheet();
          ui.tool = 'view';
          refreshTools();
        }
        break;
    }
  }

  function onChange(ev) {
    const S = G.state();
    if (ev.target.id === 'optBgm') { S.settings.bgm = ev.target.checked; HF.Audio.unlock(); HF.Audio.applySettings(); }
    if (ev.target.id === 'optSe') S.settings.se = ev.target.checked;
    if (ev.target.id === 'jsonFile' && ev.target.files[0]) {
      ev.target.files[0].text().then(loadJSON);
    }
  }

  function init() {
    document.body.addEventListener('click', onClick);
    document.body.addEventListener('change', onChange);
    $('#missionBtn').addEventListener('click', openMission);
    $('#invBtn').addEventListener('click', openInventory);
    $('#bookBtn').addEventListener('click', openBook);
    $('#menuBtn').addEventListener('click', openMenu);
    $('#modal').addEventListener('click', ev => { if (ev.target.id === 'modal') closeModal(); });

    G.on('state', () => { refreshAll(); });
    G.on('placeFail', ({ err }) => {
      if (err === 'cost') {
        const t = D.TOOLS[ui.tool];
        toast(`${ERR_TEXT.cost}：${t ? costHTML(t.cost) : ''}`);
      } else if (ERR_TEXT[err]) toast(ERR_TEXT[err]);
    });
    G.on('toast', msg => toast(msg));
    G.on('discover', id => toast(`<div class="newstk">${stk(id, 'md')}<div><small>新しいスタンプ！</small><br>${D.STICKERS[id].name}</div></div>`, 2800));
    G.on('missionComplete', m => {
      toast(`<div class="newstk"><div><small>ミッション達成！</small><br>${m.title}<br><small>報酬：${rewardText(m.reward)}</small></div></div>`, 3500);
      refreshAll();
      HF.State.save(G.state());
    });
    G.on('ending', () => setTimeout(openEnding, 800));
    G.on('removed', () => refreshInspect());

    refreshAll();
    if (!G.state().flags.seenHelp) {
      G.state().flags.seenHelp = true;
      openHelp();
    }
  }

  function refreshAll() {
    refreshTools();
    refreshMission();
  }

  function frame(dt) {
    refreshT += dt;
    if (refreshT < 0.25) return;
    refreshT = 0;
    refreshMission();
    refreshHint();
    refreshInspect();
  }

  return {
    ui, TOOL_ORDER, init, frame, setTool, rotateTool, refreshTools,
    openInspect, closeSheet, toast,
  };
})();
