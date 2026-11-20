// 場面データと図を登録するための入れ物。ほかのスクリプトより先に読み込む。
window.DATA = window.DATA || {};
window.FIG = window.FIG || {};
window.LECTURE = {
  scenes: {},
  // content/scenes/<章>.js から呼ぶ
  chapter(def) {
    this.scenes[def.id] = def;
  },
};
