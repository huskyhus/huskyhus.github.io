// スケッチを MP3 に書き出す。音は再生するときと同じ Web Audio の合成を、Chrome の中でファイルへ描画する（実時間より速いとは限らない）。
// 使い方（musiclab フォルダで）: node tools/export.mjs <スケッチ名> [<スケッチ名> ...]
//   曲を 1 周（前奏があれば前奏から）+ 余韻 3 秒。export/<スケッチ名>.mp3 に書く。いちばん大きい所が -1 dBFS になるように音量をそろえる
//   必要なもの: Chrome（環境変数 CHROME で場所を変えられる）と ffmpeg
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const names = process.argv.slice(2);
if (!names.length) { console.log("使い方: node tools/export.mjs <スケッチ名> [<スケッチ名> ...]"); process.exit(1); }
const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "export");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SAMPLE_RATE = 44100, TAIL = 3, FADE = 1, PEAK = 10 ** (-1 / 20);
const TYPES = { ".js": "text/javascript", ".html": "text/html" };

const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { createSynth } from "/lib/synth.js";
import { defaultParams } from "/lib/engine.js";
const send = (path, body) => fetch(path, { method: "POST", body });
try {
  for (const name of ${JSON.stringify(names)}) {
    const song = (await import("/sketches/" + name + ".js")).default;
    const params = defaultParams(song);
    const bars = typeof song.bars === "function" ? song.bars(params) : song.bars;
    if (!bars) throw new Error(name + " は終わりのない曲なので書き出せません");
    const sr = ${SAMPLE_RATE}, steps = bars * 16, s16 = 60 / song.bpm / 4;
    // 曲の途中でテンポが遅くなっても入るように、長さに余裕を取る（あとで切る）
    const ac = new OfflineAudioContext(2, Math.ceil((steps * s16 * 1.05 + ${TAIL} + 2) * sr), sr);
    const noiseBuf = ac.createBuffer(1, sr * 2, sr);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const out = ac.createGain();
    out.connect(ac.destination);
    const ctx = {
      ac, out, noiseBuf, params, bpm: song.bpm, sixteenth: s16,
      synth: createSynth(ac, out, noiseBuf),
      say() {},
      setBpm(b) { ctx.bpm = b; ctx.sixteenth = 60 / b / 4; song.onTempo?.(ctx); },
      paramsOf: (n, s) => defaultParams(s),
    };
    ctx.state = song.setup ? song.setup(ctx) : {};
    let now = 0.05;
    for (let i = 0; i < steps; i++) {
      song.step({ t: now, step: i, bar: Math.floor(i / 16), pos: i % 16 }, ctx);
      now += ctx.sixteenth;
    }
    await send("/__log", name + ": 音を予約しました。描画しています");
    const buf = await ac.startRendering();
    const frames = Math.min(buf.length, Math.ceil((now + ${TAIL}) * sr));
    const L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Float32Array(frames * 2);
    for (let i = 0; i < frames; i++) { pcm[i * 2] = L[i]; pcm[i * 2 + 1] = R[i]; }
    await send("/__pcm/" + name, pcm.buffer);
  }
  await send("/__done", "");
} catch (e) {
  await send("/__error", String(e.stack || e));
}
</script>`;

/** 音量をそろえて、終わりをフェードアウトし、ffmpeg で MP3 にする */
async function writeMp3(name, bytes) {
  const pcm = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  let peak = 0, bad = 0;
  for (let i = 0; i < pcm.length; i++) {
    if (!Number.isFinite(pcm[i])) { pcm[i] = 0; bad++; continue; }
    peak = Math.max(peak, Math.abs(pcm[i]));
  }
  if (!peak) throw new Error(`${name} は無音でした`);
  const gain = PEAK / peak, frames = pcm.length / 2, fade = Math.floor(FADE * SAMPLE_RATE);
  for (let f = 0; f < frames; f++) {
    const env = gain * Math.min(1, (frames - f) / fade);
    pcm[f * 2] *= env;
    pcm[f * 2 + 1] *= env;
  }
  await mkdir(outDir, { recursive: true });
  const raw = join(tmpdir(), `musiclab-${name}-${process.pid}.pcm`), mp3 = join(outDir, `${name}.mp3`);
  await writeFile(raw, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  await new Promise((ok, ng) => {
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "f32le", "-ar", String(SAMPLE_RATE), "-ac", "2", "-i", raw, "-c:a", "libmp3lame", "-q:a", "2", mp3], { stdio: "inherit" });
    ff.on("error", ng);
    ff.on("close", code => (code ? ng(new Error(`ffmpeg が失敗しました（${code}）`)) : ok()));
  });
  await rm(raw);
  const sec = frames / SAMPLE_RATE;
  console.log(`${mp3}: ${Math.floor(sec / 60)} 分 ${Math.round(sec % 60)} 秒、元のピーク ${peak.toFixed(3)}、非数のサンプル ${bad}`);
}

let chrome;
const finish = code => { chrome?.kill(); process.exit(code); };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (req.method === "POST") {
    const chunks = [];
    req.on("data", d => chunks.push(d));
    req.on("end", async () => {
      res.end();
      const body = Buffer.concat(chunks);
      try {
        if (url === "/__log") console.log(body.toString());
        if (url === "/__error") throw new Error(body.toString());
        if (url.startsWith("/__pcm/")) await writeMp3(url.slice("/__pcm/".length), body);
        if (url === "/__done") finish(0);
      } catch (e) {
        console.error(e.message);
        finish(1);
      }
    });
    return;
  }
  if (url === "/__export.html") { res.setHeader("content-type", "text/html"); res.end(page); return; }
  readFile(join(root, normalize(url))).then(body => {
    res.setHeader("content-type", TYPES[extname(url)] || "application/octet-stream");
    res.end(body);
  }, () => { res.statusCode = 404; res.end(); });
});
server.listen(0, "127.0.0.1", () => {
  const profile = join(tmpdir(), `musiclab-export-${process.pid}`);
  chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/__export.html`]);
  chrome.on("error", e => { console.error(`Chrome を起動できません: ${e.message}`); process.exit(1); });
});
