// Node で動かす入口: node tests/run.js
import { readdirSync, readFileSync } from "node:fs";
import "./all.js";
import { assert, runAll, test } from "./harness.js";
import { parseSong, serializeSong } from "../js/core/song.js";

// 収録している曲のデータが今のスキーマで読めること（ファイルを読むので Node のときだけ）
const songsDir = new URL("../songs/", import.meta.url);
for (const file of readdirSync(songsDir)) {
  test(`収録曲を読める: ${file}`, () => {
    const text = readFileSync(new URL(file, songsDir), "utf8");
    const song = parseSong(text);
    assert.equal(serializeSong(song), JSON.stringify(JSON.parse(text)));
  });
}

const results = runAll();
const failed = results.filter(r => r.error);
for (const r of failed) console.error(`✗ ${r.name}\n    ${r.error.message}`);
console.log(`${results.length - failed.length} / ${results.length} 件成功`);
if (failed.length) process.exit(1);
