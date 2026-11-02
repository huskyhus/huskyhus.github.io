// 曲データ → 発音イベント。スケジューラもテストも、ここを通して「どの音をいつ鳴らすか」を決める。
import { realize, voiceChord } from "./theory.js";
import { findSection, sectionChords, PART_NAMES, STEPS_PER_BAR, SECTION_STEPS } from "./song.js";

/** セクションのコード伴奏 → [{ step, dur, notes, chord }]（dur は 16 分音符の数）。声部は順につなぐ */
export function chordEvents(section, key) {
  let prevUpper = null;
  return sectionChords(section).map(c => {
    const v = voiceChord(realize(c.chord, key), prevUpper);
    prevUpper = v.upper;
    return {
      step: c.bar * STEPS_PER_BAR + c.startBeat * 4,
      dur: c.beats * 4,
      notes: v.notes,
      chord: c.chord,
    };
  });
}

/** 再生する順のセクション id の並び */
export function playlist(song, scope, sectionId) {
  if (scope === "section") return findSection(song, sectionId) ? [sectionId] : [];
  return song.arrangement.filter(id => findSection(song, id));
}

/** 1 つのセクションの step 位置から始まる音（パート名つき） */
export function eventsAtStep(section, step, key) {
  const out = [];
  for (const e of chordEvents(section, key)) {
    if (e.step === step) out.push({ part: "chords", notes: e.notes, dur: e.dur, v: 0.8 });
  }
  for (const p of PART_NAMES) {
    for (const n of section.parts[p].notes) {
      if (n.t === step) out.push({ part: p, notes: n.drum ? [] : [n.midi], drum: n.drum, dur: n.d, v: n.v });
    }
  }
  return out;
}

/**
 * 曲全体を時刻つきのイベントに展開する（確認用。実際の再生は同じ eventsAtStep を 1 ステップずつ呼ぶ）。
 * 返り値: [{ time, duration, part, notes, drum, section, arrangementIndex }]
 */
export function renderEvents(song, scope = "song", sectionId = null) {
  const stepSec = 60 / song.settings.bpm / 4;
  const out = [];
  playlist(song, scope, sectionId).forEach((id, index) => {
    const section = findSection(song, id);
    for (let step = 0; step < SECTION_STEPS; step++) {
      for (const e of eventsAtStep(section, step, song.settings.key)) {
        out.push({
          time: (index * SECTION_STEPS + step) * stepSec,
          duration: e.dur * stepSec,
          part: e.part,
          notes: e.notes,
          drum: e.drum,
          section: id,
          arrangementIndex: index,
        });
      }
    }
  });
  return out;
}
