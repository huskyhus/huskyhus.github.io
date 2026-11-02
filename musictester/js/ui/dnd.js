// ドラッグ&ドロップ。Pointer Events で作るので、マウスでもタッチでも同じように動く。
// data-drag を持つ要素を掴み、data-drop を持つ要素の上で離すと onDrop(payload, target) を呼ぶ。
// payload は掴んだ要素の dataset.drag（JSON）か、getPayload(el) の戻り値。

const START_DISTANCE = 6;

export function installDnd({ getPayload, onDrop, makeGhost, canDrop = () => true }) {
  let active = null;

  const clearOver = () => {
    document.querySelectorAll(".drop-over").forEach(el => el.classList.remove("drop-over"));
  };

  const targetAt = (x, y, payload) => {
    const el = document.elementFromPoint(x, y)?.closest?.("[data-drop]");
    return el && canDrop(payload, el) ? el : null;
  };

  const end = () => {
    if (!active) return;
    active.ghost?.remove();
    active.source.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    clearOver();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    active = null;
  };

  function move(e) {
    if (!active || e.pointerId !== active.pointerId) return;
    if (!active.ghost) {
      const dist = Math.hypot(e.clientX - active.x, e.clientY - active.y);
      if (dist < START_DISTANCE) return;
      active.ghost = makeGhost(active.source, active.payload);
      active.ghost.classList.add("drag-ghost");
      document.body.append(active.ghost);
      active.source.classList.add("dragging");
      document.body.classList.add("is-dragging");
      window.getSelection()?.removeAllRanges();
    }
    active.ghost.style.left = `${e.clientX}px`;
    active.ghost.style.top = `${e.clientY}px`;
    clearOver();
    targetAt(e.clientX, e.clientY, active.payload)?.classList.add("drop-over");
    e.preventDefault();
  }

  function up(e) {
    if (!active || e.pointerId !== active.pointerId) return;
    const dragged = !!active.ghost;
    const payload = active.payload;
    const target = dragged ? targetAt(e.clientX, e.clientY, payload) : null;
    end();
    if (dragged) {
      // ドラッグのあとのクリックを無視する
      const swallow = ev => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 60);
      if (target) onDrop(payload, target);
    }
  }

  function cancel(e) {
    if (active && e.pointerId === active.pointerId) end();
  }

  document.addEventListener("pointerdown", e => {
    if (e.button !== 0 || active) return;
    if (e.target.closest("[data-nodrag]")) return;
    const source = e.target.closest("[data-drag]");
    if (!source) return;
    const payload = getPayload(source);
    if (!payload) return;
    active = { source, payload, pointerId: e.pointerId, x: e.clientX, y: e.clientY, ghost: null };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  });
}
