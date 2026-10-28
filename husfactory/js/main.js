// 起動とメインループ。アプリが閉じている・非表示の間は工場は止まる
(() => {
  const G = HF.Game;
  G.setState(HF.State.load() || HF.State.create());

  const canvas = document.getElementById('view');
  HF.Render.init(canvas);
  HF.UI.init();
  HF.Input.init(canvas);
  HF.Audio.init();

  const STEP = 1 / 20;
  let acc = 0, last = performance.now(), saveT = 0;

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      G.tick(STEP);
      acc -= STEP;
    }
    saveT += dt;
    if (saveT > 10) {
      saveT = 0;
      HF.State.save(G.state());
    }
    HF.Render.draw(G.state(), HF.UI.ui, now / 1000);
    HF.UI.frame(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => { if (document.hidden) HF.State.save(G.state()); });
  window.addEventListener('pagehide', () => HF.State.save(G.state()));

  // 他のツールやコンソールから状態を扱うための入口
  HF.getState = () => JSON.parse(HF.State.serialize(G.state()));
  HF.setState = obj => G.setState(HF.State.normalize(typeof obj === 'string' ? JSON.parse(obj) : obj));
})();
