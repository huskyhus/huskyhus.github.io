// Web Audio による効果音と BGM
HF.Audio = (() => {
  let ac = null, master, bgmGain, seGain;
  let timer = null, nextTime = 0, step = 0;
  const lastPlay = {};

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const settings = () => HF.Game.state().settings;

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.7;
      master.connect(ac.destination);
      bgmGain = ac.createGain();
      bgmGain.gain.value = 0.16;
      bgmGain.connect(master);
      seGain = ac.createGain();
      seGain.gain.value = 0.45;
      seGain.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    applySettings();
  }

  function tone(freq, t, dur, type, gain, dest, slideTo) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  const SE = {
    place:    t => tone(520, t, 0.09, 'square', 0.25, seGain, 820),
    remove:   t => tone(500, t, 0.12, 'triangle', 0.35, seGain, 200),
    rotate:   t => tone(700, t, 0.05, 'square', 0.15, seGain),
    fail:     t => { tone(180, t, 0.12, 'sawtooth', 0.2, seGain); tone(150, t + 0.1, 0.15, 'sawtooth', 0.2, seGain); },
    deliver:  t => tone(1240, t, 0.07, 'sine', 0.18, seGain, 1660),
    discover: t => [72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.07, 0.18, 'triangle', 0.35, seGain)),
    complete: t => [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(midi(n), t + i * 0.09, 0.3, 'square', 0.22, seGain)),
    click:    t => tone(900, t, 0.03, 'sine', 0.15, seGain),
  };

  function se(name, minGap) {
    if (!ac || !settings().se) return;
    const now = ac.currentTime;
    if (minGap && lastPlay[name] && now - lastPlay[name] < minGap) return;
    lastPlay[name] = now;
    SE[name](now);
  }

  // 4小節ループ（C - Am - F - G）。8分音符単位、-1 は休符
  const MELODY = [
    76, 79, 81, 79, 76, -1, 74, -1,
    72, 74, 76, -1, 81, 79, 76, -1,
    81, -1, 84, 81, 79, -1, 76, 74,
    74, 76, 79, -1, 74, -1, -1, -1,
  ];
  const ROOTS = [48, 45, 41, 43];
  const BPM = 104;

  function schedule() {
    const eighth = 60 / BPM / 2;
    while (nextTime < ac.currentTime + 0.2) {
      const i = step % 32;
      const bar = Math.floor(i / 8);
      const root = ROOTS[bar];
      const beat = i % 8;
      if (beat % 2 === 0) tone(midi(root + (beat % 4 === 0 ? 0 : 7)), nextTime, eighth * 1.6, 'triangle', 0.5, bgmGain);
      if (MELODY[i] > 0) tone(midi(MELODY[i]), nextTime, eighth * 0.9, 'square', 0.18, bgmGain);
      if (beat % 2 === 1) tone(midi(root + 24), nextTime, 0.04, 'sine', 0.08, bgmGain);
      nextTime += eighth;
      step++;
    }
  }

  function applySettings() {
    if (!ac) return;
    const on = settings().bgm;
    if (on && !timer) {
      nextTime = ac.currentTime + 0.1;
      timer = setInterval(schedule, 50);
    } else if (!on && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function init() {
    const G = HF.Game;
    G.on('placed', () => se('place'));
    G.on('removed', () => se('remove'));
    G.on('rotated', () => se('rotate'));
    G.on('placeFail', ({ err }) => { if (err !== 'occupied') se('fail', 0.3); });
    G.on('delivered', () => se('deliver', 0.12));
    G.on('discover', () => se('discover'));
    G.on('missionComplete', () => se('complete'));
    G.on('state', applySettings);
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) ac.suspend();
      else ac.resume();
    });
  }

  return { init, unlock, se, applySettings };
})();
