// 声部を重ねる曲（layeredSong）の、実際に鳴る全声部を点検する。
// 使い方（musiclab フォルダで）: node tools/voices.mjs <スケッチ名>
//   声部を重ねる曲（layeredSong で作った曲）なら使える。声部はスケッチの LAYERS か、曲の layers から読む
//
// analyze.mjs が旋律・和音・ベースの根音だけを見るのに対して、こちらは声部の play() を音を出さずに動かし、
// 16 分音符ごとに「どの声部がどの高さを鳴らしているか」を集めて調べる。
//   中音域の混雑: C4〜C5 の 1 オクターブで、同時に鳴っている声部の数（旋律とベースを除く。4 以上を数える）
//   旋律との同音:   旋律と同じ高さを、ほかの声部が同時に鳴らしている所
//   旋律の上に出る: 旋律より上を鳴らす声部（オブリガートは上にいるのが役目なので除く）
//   導音の重複:     属和音の 3 度（導音）を、旋律として動く 2 つの声部（旋律・ハモリ・対旋律・オブリガート）が同時に鳴らす所。
//                   分散和音（アルペジオ・エレピ）とベースは数えない
//   声部のぶつかり: 上の声部が下の声部の半音上（短 2 度・短 9 度）で鳴っていて、どちらかが和音の外の音の所。
//                   拍の頭はすべての組み合わせ、拍の途中はベースと組む所だけ（弱拍の経過音は普通の書き方。低音とのぶつかりは目立つ）。
//                   上が半音下（長 7 度。Am7 の C の上の B など）は、テンションとしてよく使う響きなので数えない
//   連続 8 度・5 度: 旋律・ハモリ・対旋律・オブリガート・ベースのどの 2 つのあいだでも。
//                   ただし、2 つの声部が小節の中でずっと同じ音名（ユニゾン・オクターブで重ねる書き方）の小節は数えない
//
// 声部の役割は LAYERS の role（lead / harmony / counter / descant / chord / double / bass）で決める。
// 書いていなければ名前から推し量る（「オクターブ下」→ double、「ベース」→ bass など）
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [name] = process.argv.slice(2);
if (!name) { console.log("使い方: node tools/voices.mjs <スケッチ名>"); process.exit(1); }
const root = resolve(import.meta.dirname, "..");
const { chordMidis, bassOf } = await import(pathToFileURL(`${root}/lib/theory.js`));
const mod = await import(pathToFileURL(`${root}/sketches/${name}.js`));
const sketch = mod.default, LAYERS = mod.LAYERS ?? sketch.layers;
if (!LAYERS) { console.log(`${name} は声部を重ねる曲ではありません`); process.exit(1); }
const bars = sketch.data;

const mod12 = n => ((n % 12) + 12) % 12;
const NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const nm = m => NOTE[mod12(m)] + (Math.floor(m / 12) - 1);
const where = k => `${Math.floor(k / 16) + 1} 小節 ${Math.floor((k % 16) / 4) + 1} 拍${k % 4 ? `（16 分の ${(k % 4) + 1} つ目）` : ""}`;

function roleOf(l, i) {
  if (l.role) return l.role;
  if (l.kit || l.on === false) return "drum";   // ドラムと、最初は鳴らさない声部は調べない
  if (i === 0) return "lead";
  if (/オクターブ下/.test(l.name)) return "double";
  if (/ハモリ/.test(l.name)) return "harmony";
  if (/対旋律/.test(l.name)) return "counter";
  if (/オブリガート|ベル/.test(l.name)) return "descant";
  if (/ベース/.test(l.name)) return "bass";
  return "chord";
}
const roles = LAYERS.map(roleOf);
const pitched = LAYERS.map((_, i) => i).filter(i => roles[i] !== "drum");

// ---------------------------------------------------------------- 声部を動かして、鳴る音を集める

const events = LAYERS.map(() => []);   // 声部ごとの { start, end, midi }（時間は 16 分音符単位）
const fx = { echo: { setWet() {}, setTime() {} }, space: { setLevel() {} } };
bars.forEach((b, bar) => {
  for (let pos = 0; pos < 16; pos++) {
    const t = bar * 16 + pos;
    const x = {
      t, bar, pos, b, s16: 1,
      root: chordMidis(b.chord, 0, 36, 7)[0],
      mid: chordMidis(b.chord, 0, 60, 6),
      high: chordMidis(b.chord, 0, 84, 6),
      bass: chordMidis({ root: bassOf(b.chord), tones: [0] }, 0, 36, 7)[0],
    };
    LAYERS.forEach((l, i) => {
      if (l.kit) return;
      l.play(x, (start, dur, midi) => events[i].push({ start, end: start + dur, midi }), fx);
    });
  }
});

const total = bars.length * 16;
/** 16 分音符 k の少しあと（音の出だしの直後）に鳴っている音 */
const sounding = (i, k) => events[i].filter(e => e.start <= k + 0.1 && e.end > k + 0.1).map(e => e.midi);
const onsets = (i, k) => events[i].filter(e => e.start === k).map(e => e.midi);
const chordPcs = k => { const c = bars[Math.floor(k / 16)].chord; return c.tones.map(x => mod12(c.root + x)); };
const keyOf = k => bars[Math.floor(k / 16)].key ?? { tonic: 0, mode: "major" };

const issues = {
  "中音域の混雑（C4〜C5 に 4 声部以上）": [], "旋律との同音": [], "旋律の上に出る": [], "導音の重複": [],
  "声部のぶつかり（半音）": [], "連続 8 度": [], "連続 5 度": [],
};
const add = (k, s) => { if (!issues[k].includes(s)) issues[k].push(s); };
const LEAD = roles.indexOf("lead");
const upper = pitched.filter(i => !["bass", "lead"].includes(roles[i]));

/** 声部 i が 16 分音符 k に鳴らしているいちばん上の音 */
const top = (i, k) => { const ms = sounding(i, k); return ms.length ? Math.max(...ms) : null; };
/** 声部 a と z が、小節 bar の中で鳴っている間ずっと同じ音名か（わざと重ねている） */
const doubledBar = (a, z, bar) => {
  let both = 0;
  for (let k = bar * 16; k < bar * 16 + 16; k++) {
    const pa = top(a, k), pz = top(z, k);
    if (pa == null || pz == null) continue;
    if (mod12(pa - pz) !== 0) return false;
    both++;
  }
  return both >= 4;
};
let crowdMax = 0;
for (let k = 0; k < total; k++) {
  const lead = sounding(LEAD, k)[0];
  // 中音域の混雑
  const inMid = upper.filter(i => sounding(i, k).some(m => m >= 60 && m <= 72));
  crowdMax = Math.max(crowdMax, inMid.length);
  if (inMid.length >= 4) add("中音域の混雑（C4〜C5 に 4 声部以上）", `${Math.floor(k / 16) + 1} 小節（${inMid.map(i => LAYERS[i].name).join("・")}）`);
  if (lead != null) {
    for (const i of upper) {
      if (roles[i] === "double") continue;
      const ms = sounding(i, k);
      if (ms.includes(lead) && (onsets(i, k).length || onsets(LEAD, k).length)) add("旋律との同音", `${where(k)} ${LAYERS[i].name} ${nm(lead)}`);
      if (roles[i] !== "descant" && ms.some(m => m > lead) && onsets(i, k).concat(onsets(LEAD, k)).length) add("旋律の上に出る", `${where(k)} ${LAYERS[i].name}`);
    }
  }
  // 導音の重複: 属七・属和音（調の V、またはセカンダリードミナント）の 3 度
  const c = bars[Math.floor(k / 16)].chord;
  const isDom = c.tones.includes(4) && c.tones.includes(10) || mod12(c.root - keyOf(k).tonic) === 7 && c.tones.includes(4);
  if (isDom) {
    const lt = mod12(c.root + 4);
    let who = upper.concat(LEAD).filter(i => ["lead", "harmony", "counter", "descant"].includes(roles[i]) && sounding(i, k).some(m => mod12(m) === lt));
    // ユニゾン・オクターブで重ねている小節の 2 人は、1 本の線として数える
    const bar = Math.floor(k / 16);
    who = who.filter((i, n) => !who.slice(0, n).some(j => doubledBar(i, j, bar)));
    if (who.length >= 2 && who.some(i => onsets(i, k).some(m => mod12(m) === lt))) add("導音の重複", `${where(k)} ${NOTE[lt]}（${who.map(i => LAYERS[i].name).join("・")}）`);
  }
  // 声部のぶつかり（どちらかが鳴り始めた所）
  {
    const pcs = chordPcs(k);
    const notes = pitched.flatMap(i => sounding(i, k).map(m => ({ i, m })));
    for (let a = 0; a < notes.length; a++) for (let z = a + 1; z < notes.length; z++) {
      const p = notes[a], q = notes[z];
      if (!onsets(p.i, k).includes(p.m) && !onsets(q.i, k).includes(q.m)) continue;
      if (k % 4 && roles[p.i] !== "bass" && roles[q.i] !== "bass") continue;
      const [lo, hi] = p.m < q.m ? [p, q] : [q, p];
      if (p.i === q.i || mod12(hi.m - lo.m) !== 1) continue;
      if (pcs.includes(mod12(p.m)) && pcs.includes(mod12(q.m))) continue;   // ♭9 など、和音に含めた音どうしは意図したもの
      add("声部のぶつかり（半音）", `${where(k)} ${LAYERS[p.i].name} ${nm(p.m)} / ${LAYERS[q.i].name} ${nm(q.m)}（${c.name}）`);
    }
  }
}

// 連続 8 度・5 度: 2 つの声部が両方とも高さを変え、同じ向きに動き、前も後も 8 度（1 度）または 5 度
const lineRoles = ["lead", "harmony", "counter", "descant", "bass"];
const lines = pitched.filter(i => lineRoles.includes(roles[i]));
// ベースの役は、いちばん最初のベースだけ（サブベース・FM ベースは同じ根音を重ねる役）。オクターブの跳ね返りは動きに数えない
const mainBass = lines.find(i => roles[i] === "bass");
const pairs = [];
for (const a of lines) for (const z of lines) if (a < z && (roles[a] !== "bass" || a === mainBass) && (roles[z] !== "bass" || z === mainBass)) pairs.push([a, z]);
 for (const [a, z] of pairs) {
  let prev = null;
  for (let k = 0; k < total; k++) {
    const pa = top(a, k), pz = top(z, k);
    if (pa == null || pz == null) { prev = null; continue; }
    if (prev) {
      const moved = (i, p, q) => (i === mainBass ? mod12(p) !== mod12(q) : p !== q);
      if (moved(a, prev[0], pa) && moved(z, prev[1], pz) && Math.sign(pa - prev[0]) === Math.sign(pz - prev[1])) {
        const i1 = mod12(prev[0] - prev[1]), i2 = mod12(pa - pz);
        const label = `${where(k)}（${LAYERS[a].name}と${LAYERS[z].name}）`;
        if (doubledBar(a, z, Math.floor(k / 16))) { prev = [pa, pz]; continue; }
        if (i1 === 0 && i2 === 0) add("連続 8 度", label);
        if (i1 === 7 && i2 === 7) add("連続 5 度", label);
      }
    }
    prev = [pa, pz];
  }
}

// ---------------------------------------------------------------- 出力

console.log(`\n${sketch.title}（${bars.length} 小節・${LAYERS.length} 声部）\n`);
console.log("声部の音域と役割");
for (const i of pitched) {
  const ms = events[i].map(e => e.midi);
  if (!ms.length) { console.log(`  ${LAYERS[i].name}: 鳴らない`); continue; }
  console.log(`  ${LAYERS[i].name}（${roles[i]}）: ${nm(Math.min(...ms))}〜${nm(Math.max(...ms))}`);
}
console.log("\nセクションごとに鳴る声部");
const sections = [...new Set(bars.map(b => b.section))];
for (const s of sections) {
  const from = bars.findIndex(b => b.section === s) * 16, to = (bars.findLastIndex(b => b.section === s) + 1) * 16;
  const on = LAYERS.map((l, i) => i).filter(i => (l => l.kit ? true : events[i].some(e => e.start >= from && e.start < to))(LAYERS[i]));
  const heard = on.filter(i => pitched.includes(i));
  console.log(`  ${s}: ${heard.length} 声部（${heard.map(i => LAYERS[i].name).join("・")}）`);
}
console.log(`\n中音域（C4〜C5）に同時に鳴る声部の最大: ${crowdMax}`);
console.log("\n点検の結果");
for (const [k, v] of Object.entries(issues)) {
  const head = v.slice(0, 12).join("、");
  console.log(`  ${k}: ${v.length ? `${v.length} 件 ― ${head}${v.length > 12 ? " ほか" : ""}` : "なし"}`);
}
