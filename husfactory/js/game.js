// ゲームロジック：設置・撤去・シミュレーション・ミッション
HF.Game = (() => {
  const D = HF.DATA;
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const key = (x, y) => x + ',' + y;

  let S = null;
  const listeners = {};

  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, arg) { (listeners[ev] || []).forEach(fn => fn(arg)); }

  function setState(s) { S = s; emit('state', s); }
  function state() { return S; }

  const coordCache = new Map();
  function coords(k) {
    let c = coordCache.get(k);
    if (!c) {
      const i = k.indexOf(',');
      c = [+k.slice(0, i), +k.slice(i + 1)];
      coordCache.set(k, c);
    }
    return c;
  }

  function radius() { return D.AREA_RADIUS[S.areaLevel]; }
  function inArea(x, y) {
    const r = radius();
    return x >= -r && x < r && y >= -r && y < r;
  }

  // ---- 在庫 ----
  function count(id) { return S.inventory[id] || 0; }
  function give(id, n) { S.inventory[id] = count(id) + n; }
  function take(id, n) {
    S.inventory[id] = count(id) - n;
    if (S.inventory[id] <= 0) delete S.inventory[id];
  }
  function hasItems(cost) {
    for (const id in cost) if (count(id) < cost[id]) return false;
    return true;
  }

  function discover(id) {
    if (!S.discovered.includes(id)) {
      S.discovered.push(id);
      emit('discover', id);
    }
  }

  function isUnlocked(tool) { return S.unlocked.tools.includes(tool); }
  function recipesFor(type) {
    return D.RECIPES.filter(r => r.type === type && S.unlocked.recipes.includes(r.id));
  }

  // ---- 設置・撤去 ----
  function canPlace(type, x, y) {
    if (!isUnlocked(type)) return 'locked';
    if (!inArea(x, y)) return 'area';
    if (S.entities[key(x, y)]) return 'occupied';
    if (type === 'miner' && !S.nodes[key(x, y)]) return 'node';
    if (!hasItems(D.TOOLS[type].cost)) return 'cost';
    return null;
  }

  function place(type, x, y, d) {
    const err = canPlace(type, x, y);
    if (err) {
      emit('placeFail', { err, type });
      return false;
    }
    const cost = D.TOOLS[type].cost;
    for (const id in cost) take(id, cost[id]);
    const e = { t: type, d: d & 3 };
    if (type === 'belt') e.item = null;
    if (type === 'miner') { e.timer = 0; e.out = null; }
    if (type === 'proc' || type === 'comb') { e.recipe = null; e.inp = {}; e.out = null; e.timer = 0; }
    S.entities[key(x, y)] = e;
    emit('placed', { type, x, y });
    return true;
  }

  // 機械の中身（捨てずに在庫へ戻すため）
  function contents(e) {
    const list = [];
    if (e.item) list.push(e.item.id);
    if (e.out) list.push(e.out);
    if (e.inp) for (const id in e.inp) for (let i = 0; i < e.inp[id]; i++) list.push(id);
    return list;
  }

  function remove(x, y) {
    const k = key(x, y);
    const e = S.entities[k];
    if (!e) return false;
    if (e.hub) {
      emit('toast', '中央の納品口は撤去できない');
      return false;
    }
    const cost = D.TOOLS[e.t].cost;
    for (const id in cost) give(id, cost[id]);
    contents(e).forEach(id => give(id, 1));
    delete S.entities[k];
    emit('removed', { x, y });
    return true;
  }

  function get(x, y) { return S.entities[key(x, y)]; }

  function setDir(x, y, d) {
    const e = get(x, y);
    if (e) e.d = d & 3;
  }

  function rotate(x, y) {
    const e = get(x, y);
    if (!e) return;
    e.d = (e.d + 1) & 3;
    e.blocked = 0;
    emit('rotated', { x, y });
  }

  function setRecipe(x, y, rid) {
    const e = get(x, y);
    if (!e || !e.inp) return;
    for (const id in e.inp) give(id, e.inp[id]);
    e.inp = {};
    e.recipe = rid;
    e.timer = 0;
    emit('recipeSet', { x, y });
  }

  // ---- 搬送 ----
  // mdir: アイテムの進行方向
  function accept(e, id, mdir) {
    const fromFront = e.d === ((mdir + 2) & 3);
    switch (e.t) {
      case 'belt':
        if (e.item || fromFront) return false;
        e.item = { id, p: e.d === mdir ? 0 : 0.5 };
        return true;
      case 'proc':
      case 'comb': {
        if (fromFront) return false;
        let r = e.recipe && D.RECIPE_BY_ID[e.recipe];
        if (!r) {
          // レシピ未設定なら、届いたスタンプに合う最初のレシピを自動で選ぶ
          r = recipesFor(e.t).find(rc => rc.in[id]);
          if (!r) return false;
          e.recipe = r.id;
          e.inp = {};
        }
        const need = r.in[id];
        if (!need || (e.inp[id] || 0) >= need * D.BUFFER_MULT) return false;
        e.inp[id] = (e.inp[id] || 0) + 1;
        return true;
      }
      case 'depot':
        deliver(id);
        return true;
    }
    return false;
  }

  function pushOut(k, e, id) {
    const [x, y] = coords(k);
    const t = S.entities[key(x + DX[e.d], y + DY[e.d])];
    return !!t && accept(t, id, e.d);
  }

  function deliver(id) {
    give(id, 1);
    S.stats.delivered[id] = (S.stats.delivered[id] || 0) + 1;
    discover(id);
    const m = D.MISSIONS[S.mission.index];
    if (m && m.need[id]) {
      const p = S.mission.progress;
      if ((p[id] || 0) < m.need[id]) {
        p[id] = (p[id] || 0) + 1;
        if (Object.keys(m.need).every(n => (p[n] || 0) >= m.need[n])) completeMission();
      }
    }
    emit('delivered', id);
  }

  function completeMission() {
    const m = D.MISSIONS[S.mission.index];
    const r = m.reward;
    (r.tools || []).forEach(t => { if (!S.unlocked.tools.includes(t)) S.unlocked.tools.push(t); });
    (r.recipes || []).forEach(id => { if (!S.unlocked.recipes.includes(id)) S.unlocked.recipes.push(id); });
    if (r.area) S.areaLevel = Math.min(D.AREA_RADIUS.length - 1, S.areaLevel + r.area);
    S.mission.index++;
    S.mission.progress = {};
    emit('missionComplete', m);
    if (r.ending) {
      S.cleared = true;
      emit('ending');
    }
  }

  function hasInputs(e, r) {
    for (const id in r.in) if ((e.inp[id] || 0) < r.in[id]) return false;
    return true;
  }

  function tick(dt) {
    S.time += dt;
    for (const k in S.entities) {
      const e = S.entities[k];
      switch (e.t) {
        case 'belt':
          if (!e.item) break;
          e.item.p = Math.min(1, e.item.p + D.BELT_SPEED * dt);
          if (e.item.p >= 1) {
            if (pushOut(k, e, e.item.id)) { e.item = null; e.blocked = 0; }
            else e.blocked = (e.blocked || 0) + dt;
          }
          break;
        case 'miner':
          if (!e.out) {
            e.timer += dt;
            if (e.timer >= D.MINER_TIME) {
              e.timer = 0;
              e.out = S.nodes[k];
              discover(e.out);
            }
          }
          if (e.out) {
            if (pushOut(k, e, e.out)) { e.out = null; e.blocked = 0; }
            else e.blocked = (e.blocked || 0) + dt;
          }
          break;
        case 'proc':
        case 'comb': {
          const r = e.recipe && D.RECIPE_BY_ID[e.recipe];
          if (r && !e.out) {
            if (hasInputs(e, r)) {
              e.timer += dt;
              if (e.timer >= r.time) {
                e.timer = 0;
                for (const id in r.in) e.inp[id] -= r.in[id];
                e.out = r.out;
                S.stats.produced[r.out] = (S.stats.produced[r.out] || 0) + 1;
                discover(r.out);
              }
            } else {
              e.timer = 0;
            }
          }
          if (e.out) {
            if (pushOut(k, e, e.out)) { e.out = null; e.blocked = 0; }
            else e.blocked = (e.blocked || 0) + dt;
          }
          break;
        }
      }
    }
  }

  // 詰まり表示の判定：ベルト同士の渋滞は除き、行き止まりや受け取り拒否のみ
  function isJammed(k, e) {
    if (!(e.blocked > 1.5)) return false;
    const [x, y] = coords(k);
    const t = S.entities[key(x + DX[e.d], y + DY[e.d])];
    return !t || t.t !== 'belt';
  }

  return {
    on, emit, setState, state, key, coords, DX, DY,
    radius, inArea, count, hasItems, isUnlocked, recipesFor,
    canPlace, place, remove, get, setDir, rotate, setRecipe, contents,
    tick, isJammed,
  };
})();
