# ハスタワー

ステッカーを積み上げて高さを競う、1人用のスコアアタックゲームです。
HTML / CSS / JavaScript だけで動く静的サイトで、物理演算には [Planck.js](https://piqnt.com/planck.js/) v1.5.0（MIT ライセンス、`hustower/vendor/` に同梱）を使っています。

公開先: https://huskyhus.github.io/hustower/

## 遊び方

| 操作 | スマホ | PC |
| --- | --- | --- |
| 動かす | ドラッグ | マウス移動 / ← → |
| 回す | ↺ ↻ ボタン（タップで 15°、長押しで連続） | ボタン / ホイール（5°）/ Q E ↑ |
| 落とす | 指を離す | クリック / Space |
| ホールド（1 手 1 回） | HOLD 枠をタップ | HOLD 枠をクリック / C / Shift |

台から1枚でも落ちたらゲームオーバーです。スコアは、ピースが静止したときの塔の最高到達点（m）です。

- **スコアアタック**: ピースの順番は毎回ランダム
- **デイリーチャレンジ**: 日付（日本時間）ごとに全員同じ順番。ベストは日ごとに記録
- 置いた後に塔がほとんど動かなければ PERFECT / NICE、5m ごとに節目の演出
- 8bit 風のループ BGM（テンポ 120、5m ごとに +3 BPM で最大 150）。1 周 50 小節で、キメ → 転調（B にハモリ）→ C メロ（対旋律つき）→ 哀愁ソロ（引き）→ 溜めのあと、さらに転調して次の周へ。ゲームオーバーでも曲は止まらず、一瞬だけ音量が下がる。右上の 🎵 で BGM、🔊 で効果音をそれぞれオン/オフ
- ゲームオーバー画面から、塔の画像をシェア（対応端末は共有シート、それ以外は PNG 保存）または X にポスト

## ローカルで動かす

`fetch` で JSON を読むため、`file://` で開いても動きません。ローカルサーバーを立ててください。

```sh
uv run python -m http.server 8000
```

- ゲーム: http://localhost:8000/hustower/
- 当たり判定を表示: http://localhost:8000/hustower/?debug （ゲーム中に G キーでも切り替え可）。
  `?debug` のときはコンソールから `hustower.game` / `hustower.effects` を触れます
- 形状データのビューア: http://localhost:8000/tools/viewer.html

## 構成

リポジトリは GitHub Pages のユーザーサイト（huskyhus.github.io）で、ゲームは `hustower/` に置いています。

```
hustower/                  ゲーム本体（https://huskyhus.github.io/hustower/）
  index.html               OGP / X カードの meta タグもここ
  ogp.png                  リンクを貼ったときのカード画像（tools/gen_ogp.py で生成）
  js/physics.js            物理（Planck.js のラッパー。DOM 非依存）
  js/game.js               状態管理・入力・モード
  js/view.js, render.js    座標変換と描画（ゲーム画面とシェア画像で共用）
  js/effects.js            パーティクル・文字・画面揺れ
  js/audio.js              効果音（Web Audio で合成、音声ファイルなし）
  js/music.js              BGM（楽譜はファイル先頭の LEAD / CHORDS）
  js/share.js              シェア画像の生成と共有
  stickers/*.png           ステッカー画像（24枚）
  data/shapes.json         画像から生成した衝突形状
  vendor/planck.min.js     物理エンジン
tools/                     開発用
  gen_shapes.py            shapes.json の生成
  gen_ogp.py               ogp.png の生成
  viewer.html              shapes.json の確認用ビューア
  sim_test.mjs             物理のヘッドレステスト
```

## ステッカーを追加・差し替えるとき

1. `hustower/stickers/` に透過 PNG を置く
2. 形状データを作り直す: `uv run tools/gen_shapes.py`（`--preview out.png` で確認用画像も出力）
3. ビューアで輪郭を確認する
4. 必要なら物理のテストを実行する: `node tools/sim_test.mjs`

## 公開

ビルドは不要です。`main` に push すれば GitHub Pages（Settings → Pages → Branch: `main` / `(root)`）で
https://huskyhus.github.io/hustower/ に公開されます。

リンクを貼ったときのカード（OGP / X の summary カード）は `hustower/index.html` の meta タグで設定しています。
画像は絶対 URL で指定しているので、公開先の URL が変わったらそこも直してください。
カード画像を変えるときは `tools/gen_ogp.py` のステッカー指定を変えて `uv run tools/gen_ogp.py`。
