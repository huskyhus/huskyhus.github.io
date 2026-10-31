// アイテム定義。ステッカーのセリフに合わせて効果を決めている。
// good: 金の枠（取ると得）／ bad: 紫の枠（取ると損）／ special: 虹の枠と光の柱（迷路に決まった数だけ置く大当たり）
// duration があるものは「状態」として一定時間続く。0 のものは取った瞬間に効く。
// time はタイムの増減（秒）。aura は置いてある間、赤黒いオーラの柱をまとう（取ったときはふつうのアイテムと同じ）。

export const ITEMS = {
  jackpot: {
    sticker: "744223943", good: true, special: true, duration: 0, time: -30,
    name: "母は偉大なり", effect: "タイム −30 秒！",
  },
  treasure: {
    sticker: "744223944", good: true, special: true, duration: 0, time: -10,
    name: "父は森", effect: "タイム −10 秒",
  },

  timeBonus: {
    sticker: "744223941", good: true, duration: 0, weight: 3, time: -3,
    name: "ありがたさ痛感", effect: "タイム −3 秒",
  },
  dash: {
    sticker: "744223959", good: true, duration: 4, weight: 2,
    name: "準備完了！", effect: "4 秒間ダッシュ（加速・最高速アップ）",
  },
  ghost: {
    sticker: "744223958", good: true, duration: 3, weight: 1.5,
    name: "今日はチートデイ", effect: "3 秒間 空中に浮いて壁を飛び越える",
  },
  assist: {
    sticker: "744223945", good: true, duration: 8, weight: 1.5,
    name: "めざせ規則生活", effect: "8 秒間 通路の真ん中を走るようにアシスト",
  },
  slow: {
    sticker: "744223960", good: true, duration: 12, weight: 1.5,
    name: "時は満ちた", effect: "12 秒間 スローモーション（時計がゆっくり進むが、操作も鈍くなる）",
  },
  warp: {
    sticker: "744223951", good: true, duration: 0, weight: 1,
    name: "逆転劇", effect: "ゴールへの道を 10 マス先へワープ",
  },
  barrier: {
    sticker: "744223949", good: true, duration: 8, weight: 1.5,
    name: "欲望よさらば", effect: "悪い効果を消し、8 秒間 悪いアイテムを無効化",
  },

  reverse: {
    sticker: "744223954", good: false, duration: 5, weight: 2,
    name: "不可能です！", effect: "5 秒間 操作が逆になる",
  },
  ice: {
    sticker: "744223939", good: false, duration: 6, weight: 2,
    name: "やっちまった！", effect: "6 秒間 つるつる滑って止まれない",
  },
  penalty: {
    sticker: "744223956", good: false, duration: 0, weight: 2, time: 3,
    name: "寝る子は育つ", effect: "タイム ＋3 秒",
  },
  hell: {
    sticker: "744223950", good: false, aura: true, duration: 0, weight: 1.5, time: 10,
    name: "地の獄", effect: "タイム ＋10 秒",
  },
  dark: {
    sticker: "744223947", good: false, duration: 6, weight: 2,
    name: "おのれの愚かさ今知る", effect: "6 秒間 まわりが真っ暗に",
  },
};

/** ふつうに散らばるアイテム（special は迷路の生成で決まった場所に置く） */
export const GOOD_KINDS = Object.keys(ITEMS).filter(k => ITEMS[k].good && !ITEMS[k].special);
export const BAD_KINDS = Object.keys(ITEMS).filter(k => !ITEMS[k].good);

/** 画面演出用のステッカー（アイテム以外） */
export const UI_STICKERS = {
  title: "744223937",     // おまえもな！
  newBest: "744223942",   // 感動！
  clear: "744223946",     // 感謝しかない！
  pause: "744223940",     // すまん 猛反省してる！
};

export const stickerSrc = id => `stickers/${id}.png`;
