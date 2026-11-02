// ガチャの操作: 引く・履歴をたどる・全体ガチャ。生成そのものは generate.js。
import { generatePart } from "./generate.js";
import { progressionSignature, HISTORY_LIMIT, PART_NAMES } from "./song.js";

const DEPENDENTS = ["counter", "harmony"];   // メロディを参照するパート
const clone = x => JSON.parse(JSON.stringify(x));

/** 今の進行（と、参照先のメロディ）の印。生成時と違えば「要引き直し」 */
export function basisOf(section, name) {
  const chords = progressionSignature(section);
  if (name === "drums") return "";
  if (!DEPENDENTS.includes(name)) return chords;
  const m = section.parts.melody;
  return `${chords}#${m.seed}#${m.notes.map(n => `${n.t}:${n.d}`).join(",")}`;   // 音の高さは調で変わるので見ない
}

export function isStale(section, name) {
  const part = section.parts[name];
  return part.notes.length > 0 && part.basis !== basisOf(section, name);
}

function generateInto(section, name, key, seed) {
  const part = section.parts[name];
  const notes = generatePart(name, { section, key, seed, params: part.params, melody: section.parts.melody.notes });
  part.seed = seed;
  part.notes = notes;
  part.basis = basisOf(section, name);
  return notes;
}

function pushHistory(part) {
  part.history.push({ seed: part.seed, params: clone(part.params), notes: part.notes, basis: part.basis });
  if (part.history.length > HISTORY_LIMIT) part.history.shift();
  part.historyIndex = part.history.length - 1;
}

/** メロディが変わったので、それを参照するパートを同じシードで作り直す（ロック中と未生成は触らない） */
function refreshDependents(section, key) {
  for (const name of DEPENDENTS) {
    const part = section.parts[name];
    if (part.locked || part.history.length === 0) continue;
    generateInto(section, name, key, part.seed);
    part.history[part.historyIndex] = { seed: part.seed, params: clone(part.params), notes: part.notes, basis: part.basis };
  }
}

/** 引く。seed の結果を履歴に積んで、今の音符にする。ロック中は何もせず false */
export function draw(section, name, key, seed) {
  const part = section.parts[name];
  if (part.locked) return false;
  generateInto(section, name, key, seed);
  pushHistory(part);
  if (name === "melody") refreshDependents(section, key);
  return true;
}

/** 履歴を delta だけ動かす（-1 = 前の結果へ）。動けなければ false */
export function moveHistory(section, name, delta, key) {
  const part = section.parts[name];
  if (part.locked) return false;
  const i = part.historyIndex + delta;
  if (i < 0 || i >= part.history.length) return false;
  const h = part.history[i];
  part.historyIndex = i;
  part.seed = h.seed;
  part.params = clone(h.params);
  part.notes = h.notes;
  part.basis = h.basis;
  if (name === "melody") refreshDependents(section, key);
  return true;
}

/** 全体ガチャ。ロックしていないパートを全部引く。newSeed() でパートごとのシードを受け取る */
export function drawAll(section, key, newSeed) {
  const done = [];
  for (const name of PART_NAMES) {
    const part = section.parts[name];
    if (part.locked) continue;
    generateInto(section, name, key, newSeed());
    pushHistory(part);
    done.push(name);
  }
  // メロディを引いたあとに対旋律とハモリが順に作られるので、ここで作り直す必要はない。
  // メロディがロックでも、今のメロディに対して作られる。
  return done;
}
