# musiclab（音の研究室）

ハスタワーの BGM と同じやり方（音声ファイルを使わず Web Audio で合成）で、いろいろな音楽を試すための場所です。
ハスタワー本体（`../hustower/`）とは独立していて、こちらを変えてもゲームには影響しません。

## 動かす

ES モジュールを読むため、`file://` で開いても動きません。**このフォルダ（`musiclab/`）**でローカルサーバーを立ててください。

```sh
uv run python -m http.server 8001
```

http://localhost:8001/ を開き、左の一覧からスケッチを選んで ▶ 再生。

- **Space**: 再生 / 停止、**R**: 再読込
- スケッチのファイルを編集したら「⟳ 再読込」を押すと、ページを開き直さずに反映されます（再生中なら同じ小節から続きます）。
  `lib/` を編集したときと、曲を編集して「曲の切り替え」に反映させたいときは、ページごと再読み込みしてください
- 画面で選んだ値（楽器・音量など）はスケッチごとにブラウザに保存され、ページを開き直しても残ります。「初期値に戻す」で戻せます
- エラーが出ると赤い枠に表示されて止まります。詳しくはブラウザのコンソールへ

## コード進行ラボ（chords.html）

http://localhost:8001/chords.html は、コード理論を学ぶ人向けのページです。研究室の画面からもリンクしています。

- 22 種類の定番進行（基本 / 長調 / 短調 / ジャズ・ブルース）を、ディグリー・コード名・機能（T / SD / D / SDm / セカンダリードミナント）で並べ、「なぜそう聞こえるか」を解説
- キーを変えると、コード名も音名も音階どおりに綴り直す（A♭ か G♯ か、E♯ や F𝄪 も）
- 「4 和音にする」で三和音に音階の 7 度を足す。「基本形 / ボイスリーディング」で押さえ方を比べ、声部が何半音動いたかを表示
- 鍵盤に構成音とベースを表示。ダイアトニックコードの表は押すと鳴る
- 進行のデータは `lib/progressions.js`、ディグリーの読み取り・綴り・機能・押さえ方は `lib/roman.js`

## 構成

```
index.html, app.js      研究室の画面（一覧・再生・パラメータ・波形とスペクトル）
chords.html, chords.js  コード進行ラボの画面
lib/engine.js           AudioContext と先読みスケジューラ。スケッチを 16 分音符ごとに呼ぶ
                        （スケッチが loopFrom を持てば、2 周目からはその小節へ戻る。イントロを 1 回だけ鳴らす曲用）
lib/synth.js            楽器とドラムキット（下の「楽器」を参照。8bit 部分は hustower の music.js から切り出し）
lib/mix.js              声部を左右に振り分けて、コンプレッサーでまとめる卓
lib/layers.js           声部ごとに「鳴らす / 楽器 / 音量」を選べる曲の組み立て（声部ごとのエコー、分数コードの低音 x.bass、
                        最初は鳴らさない声部 on: false、シャッフル swing、
                        曲全体の残響と声部ごとの送り reverb、画面の設定をほかの曲と共通にする paramsFrom）
lib/song.js             コード・メロディ・曲の性格（通常 / 戦闘 / ボス）のデータから、13 声部の編曲を作る
                        （セクションごとに feel / mood / solo / harmony / counters を指定できる。書き方はファイル先頭）
                        対旋律は 4 種類を自動で作る: 反行（旋律と逆向き。いつも鳴る）、高音のオブリガート（サビ）、
                        合いの手（旋律の隙間に答える。A）、低音の対旋律（和音の 3 度・7 度をつなぐ。C メロ）
lib/compose.js          作曲の道具（移調・同主調への変換・ソロ / ウォーキングベース / 12 音の旋律の自動生成）
lib/theory.js           音名・コード（分数コード "G/B" も）・音階・楽譜 1 行の読み取り、ハモリの音の選び方
sketches/index.js       一覧に出すスケッチの名前
sketches/*.js           スケッチ（1 ファイル 1 実験）
  hustower-a.js         ハスタワーの A メロ。音色・エコー・対旋律・ハモリを切り替えて聴き比べ
  hustower-jukebox.js   曲の切り替え: 下の曲（通常曲・戦闘曲・ボス戦曲・交響曲・協奏曲・エスニック版・本番合奏）の間を、1 小節のつなぎで途切れずに移る
  hustower-massive.js   通常曲 1「ハスタワー」  ハ長調・120 BPM   独自 / vi–IV–I–V / 丸サ進行
  hustower-massive-pop.js    通常曲 1 拡張版 1「王道」     A → B → A' → B' → C → ソロ → B'（大サビ）・56 小節
  hustower-massive-trade.js  通常曲 1 拡張版 2「掛け合い」 イントロ → A → B → C → ソロ → 掛け合い → A' → B'・60 小節
  hustower-massive-straight.js  通常曲 1 拡張版 3「まっすぐ」 イントロ → A → A' → B → C → ソロ → B'（大サビ）・52 小節
  hustower-massive-twochorus.js 通常曲 1 拡張版 4「1 番・2 番」 A → B → 間奏 → A' → B → C → 落ちサビ → ラスサビ・64 小節
                        （拡張版は hustower-massive.js の声部と barsOf を使う。A'・B' は変奏、ソロは 16 分で手書き）
  hustower-super.js     通常曲 1 決定版「スーパーハスタワー」 ハ長調 → 変ニ長調・124 BPM・46 小節（イントロは最初の 1 回だけ）
                        イントロ → A → B（サビ）→ A' → C（丸サ進行）→ 大サビ（半音上）→ A。11 声部を、セクションごとに音域と役割を分けて鳴らす。
                        分数コードの低音の線、音階どおりの 3 度下のハモリ、手書きのベルのオブリガートとエレピの和音、
                        IV への ii–V、偽終止での転調、裏コード（D♭7 → C）でハ長調へ戻るループ。tools の 2 つの点検で指摘ゼロ
                        （11 声部の編成は lib/superband.js。下の 5 曲も同じ編成で、コード進行・ソロ・響き・展開・感情を変えた別の曲）
  hustower-ultra.js     ウルトラハスタワー      ニ長調 → ホ長調・152 BPM  熱い泣き。王道進行のサビ、16 分のソロ、落ちサビ（偽終止 → B7sus4）、
                                                全音上のラスサビ（V7 → vi7 で引っ張ってから最高音 F#6 で着く）、♭VII△7 のつなぎ
  hustower-ocean.js     大海原のハスタワー      ヘ長調 → ト長調・80 BPM・12/8 風  郷愁。保続音とミクソリディアの ♭VII、借用の iv6 で短 6 度跳ぶ B、
                                                ベルのソロ、C7sus4 → C△7 で全音上へ、♭VI△7 へ流れる結び
  hustower-library.js   図書館のハスタワー      ニ短調・76 BPM  静かな哀愁ともどかしさ。ソロなし。ライン・クリシェ、2 度の偽終止、
                                                5 度圏を下りて一度だけ着く主和音、A7 の上の ♭13 の倚音、解決しない A7sus4
  hustower-ranch.js     牧場のハスタワー        ト長調・100 BPM・軽く跳ねる  夕暮れの郷愁。ヨナ抜きの旋律、借用の Cm6（E → E♭）、
                                                G にとどまる内声、ペンタトニックのソロ、Cm6 → G の寂しい終わり方
  hustower-academy.js   学園都市のハスタワー    変ロ長調 → ハ長調・138 BPM  放課後の切なさ。原曲の A メロをシティポップの和音で、
                                                食って入る小室進行のサビ、リードと対旋律の掛け合い、E7 で全音上のラスサビ
  hustower-session.js   競演のハスタワー        ホ短調 → 嬰ヘ短調・128 BPM・80 小節  3 人（リード・対旋律・ビブラフォン）の見せ場。
                                                シンコペーションのテーマ（funk の型）、3 人それぞれのソロ、2 小節ずつ → 1 小節ずつの掛け合い
                                                （組んだり離れたり、最後は 3 人ユニゾン）、全音上のテーマ B'、最高音 G6 の結び
  hustower-normal-2.js  通常曲 2「草原」        ト長調・112 BPM   カノン進行 / 循環進行 / サブドミナントマイナー
  hustower-normal-3.js  通常曲 3「街」          ヘ長調・128 BPM   Axis 進行 / ツーファイブ / ブルース進行
  hustower-normal-4.js  通常曲 4「夜」          ニ長調・96 BPM    メジャークリシェ / 王道進行 / 小室進行 → マリオ終止
  hustower-normal-5.js  通常曲 5「市場町」      変ロ長調・132 BPM カデンツ / 50 年代進行 / ダイアトニックの下降
  hustower-normal-6.js  通常曲 6「遺跡」        変ホ長調・100 BPM ミクソリディア I–♭VII–IV / リディア I–II / 偽終止
  hustower-normal-7.js  通常曲 7「歌の広場」    イ長調・116 BPM   プラガル I–IV / 上行 IV–V–vi–I / 半音上への転調
  hustower-normal-8.js  通常曲 8「合同演奏会」  ホ長調・108 BPM   I–VI7–ii–V7 / 逆循環 / バックドア iv–♭VII–I
  hustower-battle.js    戦闘曲 1「ハスタワー」  イ短調・160 BPM   i–VI–VII / iv–i–iv–V / アンダルシア進行
  hustower-battle-2.js  戦闘曲 2「疾走」        ホ短調・168 BPM   エピック進行 / 小室進行 / 王道進行
  hustower-battle-3.js  戦闘曲 3「迷宮」        ニ短調・172 BPM   マイナークリシェ / 短調のツーファイブ / カノン進行
  hustower-battle-4.js  戦闘曲 4「激突」        ト短調・176 BPM   ドリアン i–IV / 短調の循環 / マイナーブルース
  hustower-battle-5.js  戦闘曲 5「影の城」      ロ短調・164 BPM   短調の 5 度圏進行 / エオリアン終止 / 同主長調へ
  hustower-battle-6.js  戦闘曲 6「草原の追走」  嬰ハ短調・176 BPM ロック i–VII–VI–VII / 短調のカノン風の下降 / 上行 iv–v–VI–VII
  hustower-battle-7.js  戦闘曲 7「夜の森の影」  ヘ短調・158 BPM   自然短音階 i–iv–v / VI–iv–i–V / ナポリの和音
  hustower-battle-8.js  戦闘曲 8「調律の塔」    変ロ短調・184 BPM ドリアン i–III–VII–IV / VI–III–VII–i / 経過の減七
  hustower-boss-1.js    ボス戦曲 1「魔王」      ハ短調・150 BPM   フリジアン i–♭II / 減七の和音 / 王道進行
  hustower-boss-2.js    ボス戦曲 2「最終決戦」  嬰ヘ短調・190 BPM 三全音 i–♭V / エピック進行 / ピカルディ終止
                        （どの曲も A → サビ → C メロの 24 小節。進行は A / サビ / C メロの順）
  hustower-symphony.js  交響曲「黎明」          ハ長調 ⇄ ハ短調・120 BPM・128 小節（通常曲の性格）
  hustower-concerto.js  協奏曲「影」            イ短調 ⇄ イ長調・150 BPM・128 小節（戦闘曲の性格）
                        （長短の混在、相転移（同主調・転調・伴奏の型の切り替え）、無調、5 種類のソロ入り）
  light-and-shadow.js   光と影の合奏            長調と短調が混在する曲の例（光の声部 / 影の声部）
  hustower-ryukyu.js    ハスタワー 琉球版        琉球音階、三線風・パーランクー・跳ねるリズム
  hustower-wa.js        ハスタワー 和版          陰音階（都節）/ 陽音階、尺八・箏・笙風のドローン・和太鼓
  hustower-arabian.js   ハスタワー アラビアン版  マカーム・ヒジャーズ / ラスト（4 分音）、ネイ・ウード・マクスーム
  hustower-gamelan.js   ハスタワー ガムラン版    スレンドロ / ペロッグ（12 音にない音律）、コテカン・ゴング
                        （エスニック版の中身は lib/ethnic.js。ハスタワーの旋律の形のまま、各地の音階に置き換える）
  hustower-finale.js    調律の刻「本番合奏」    ステージ 12 の曲。ハ調・80 小節。「光と影の合奏」の C・D セクションの作り
                        （長調の旋律に、ハ短調から借りた和音を 1 小節ごとに混ぜる）で、最初から最後まで光と影が一緒に奏でる。
                        通常曲 1（A・B メロ）と戦闘曲 1（A・B メロ）のテーマを、旋律を 1 音も変えずに、もとのテンポ（120 / 160）ではさむ。
                        テーマのところの長短混在は、旋律とぶつからない借用和音だけで行う
  hustower-finale-peoples.js 本番合奏（諸民版）  前の版。対位法・ハーモニック・メジャー・C7(♯9)、諸民（琉球・和・ガムラン・砂漠）入り
lib/superband.js        スーパーハスタワーの 11 声部の編成。セクションの並び（コード・旋律・対旋律・ベル・伴奏の型）から曲を作る
                        （伴奏の型: intro / soft / normal / big / jazz / ballad / quiet / drop。ソロ・掛け合い・エコーの深さも書ける）
                        （音の深み: 曲全体の残響へ声部ごとに送る量、対旋律・ハモリ・オブリガートのエコー、長い音のビブラートと
                        ずらした 2 本を重ねるコーラス。ベルはビブラフォンを 2 本、違う速さで左右へ回す）
lib/lightshadow.js      光と影の合奏の編曲（光の声部 5 つ + 影の声部 4 つ。セクションごとに side と feel を選ぶ）
  progressions.js       定番のコード進行くらべ
  scales.js             同じフレーズを色々な音階で
  instruments.js        楽器の試聴: 1 つ選んで旋律・和音・ベース・単音で鳴らす
  fm.js                 FM 音源のプリセット聴き比べと、比・深さを手で変える実験
  _template.js          新しいスケッチのひな形
```

## 曲を点検する

```sh
node tools/analyze.mjs hustower-finale
node tools/voices.mjs hustower-super
```

曲の和声と旋律を、音楽理論の基本的な決まりで点検します（`data` に小節ごとの `chord` と `lead` を持つスケッチなら使えます）。

- 和声: 小節ごとの度数（ローマ数字）と機能（T / SD / D / SDm / セカンダリードミナント）、セクションの終わりの終止の種類
- 属七が向かう先へ進んでいるか、導音（シ）がドへ・属七の 7 度が順次下行で解決しているか
- 強拍（1・3 拍目）が和音の音か、歌いにくい跳躍（オクターブを超える、増 2 度）
- 旋律とベース・対旋律のあいだの連続 8 度・連続 5 度、声部の交差
- 転回形（G/B → V⁶）、転調先の調での偽終止、裏コード（♭II7 → I）も読む

`tools/voices.mjs` は、声部を重ねる曲（`LAYERS` を export するスケッチ）の、実際に鳴る全声部を点検します。
声部の `play()` を音を出さずに動かし、16 分音符ごとにどの声部が何を鳴らしているかを集めます。

- 声部ごとの音域と、セクションごとに鳴っている声部
- 中音域（C4〜C5）の混雑、旋律との同音、旋律より上に出る声部
- 導音の重複（旋律として動く声部どうし）、短 9 度のぶつかり、全声部のあいだの連続 8 度・連続 5 度

## スケッチを足す

1. `sketches/_template.js` をコピーして `sketches/my-idea.js` を作る
2. `sketches/index.js` の一覧に `"my-idea"` を足す
3. ページを再読み込み

スケッチは次の形のオブジェクトを `export default` します。

| 項目 | 内容 |
| --- | --- |
| `title`, `description` | 画面に出る名前と説明 |
| `bpm` | 選んだときのテンポ（画面のスライダーで変えられる） |
| `bars` | ループの長さ（小節）。`p => …` のようにパラメータから決めてもよい。0 なら終わりなし |
| `params` | 画面で触れるつまみ。`min`/`max` があればスライダー、`options` があればプルダウン（`labels` で表示名を付けられる）、`value` が true/false ならチェックボックス |
| `setup(ctx)` | 再生開始時に 1 回。返した値が `ctx.state` に入る（エコーなどを作っておく） |
| `step({ t, bar, pos }, ctx)` | 16 分音符ごとに呼ばれる。`t` の時刻に音を予約する。`pos` は小節内の 0〜15 |
| `onTempo(ctx)` | テンポが変わったとき（任意） |

`ctx` で使えるもの: `synth`（楽器）、`params`（つまみの今の値）、`state`、`bpm`、`sixteenth`（16 分音符の秒数）、
`say(text)`（画面に一言出す）、`ac`（AudioContext）、`out`（このスケッチの出力。自前のノードをつなぐとき）、
`noiseBuf`（ノイズ素材。`createSynth(ac, 出力先, noiseBuf)` で別の出力先に鳴らす楽器一式を作るとき）、
`setBpm(bpm)`（スケッチからテンポを変える）、`paramsOf(スケッチ名, スケッチ)`（ほかのスケッチの画面で選んだ値を借りる）。

楽譜は hustower と同じ書き方で、`parseLine("C5 . G4 - E5")` のように 1 小節を 8 分音符で書きます（`-` は伸ばす、`.` は休符）。

## 楽器

`synth.play(楽器名, t, 長さ, 周波数, { vol })` で鳴らします。楽器名は `INSTRUMENTS`（[lib/synth.js](lib/synth.js)）のキーです。

| グループ | 楽器名 |
| --- | --- |
| 8bit・電子音 | `pulse06` `pulse12` `pulse18` `pulse25` `pulse33` `pulse40`（パルス波。数字はデューティ比 %）、`square`、`nestri`（ファミコンの 4bit 三角波）、`triangle`、`sawtooth`、`sine`、`synth-bass` |
| FM | `fm-epiano` `fm-bell` `fm-bass` `fm-brass` `fm-marimba` `fm-organ` |
| リアル | `piano`、`guitar` `harp` `upright-bass`（撥弦: Karplus-Strong）、`marimba` `vibraphone` `glocken`（叩く楽器: モーダル合成）、`strings`、`flute`、`brass`、`organ` |
| 打楽器 | `xylophone` `woodblock`（モーダル合成）、`timpani` `conga` `bongo`（皮の太鼓: 音程が少し下がるサイン波 + 打音。長さに関係なく自然に消える） |
| 弦 | `ukulele` `mandolin`（長い音はトレモロ）`banjo` `pizzicato`（撥弦）、`violin` `cello`（独奏: ストリングスを 1 本にして胴の共鳴を足す） |
| 管・リード | `accordion` `harmonica` `oboe` `clarinet` `bassoon` `bagpipe`（リード: パルス波などに管の共鳴を足す）、`recorder` `ocarina` `panflute`（フルートの仲間）、`horn` `trombone` `tuba`（ブラスの仲間） |
| 声 | `whistle`（口笛）、`hum`（ハミング）、`voice-aah`（歌声）、`choir` `choir-ooh`（合唱。ノコギリ波を母音の共鳴（フォルマント）に通す） |

楽器の設定（`INSTRUMENTS` の `group` `label` `kind` `gain` 以外）は、そのまま音源の関数に渡ります。同じ音源の設定違いで楽器を増やすときは、`INSTRUMENTS` に 1 行足すだけで済みます。

ドラムは `synth.kit("8bit" | "acoustic" | "electro")` でキットを選び、`kick` `snare` `hat` `crash` `clap` `shaker` `tom` を鳴らします。
音源はどれも、録音した音を使わずにその場で合成しています。そのため「リアル」も本物そっくりではなく、それらしい音です。

## 公開について

このフォルダは huskyhus.github.io のリポジトリの中にあるので、push すると https://huskyhus.github.io/musiclab/ で見えるようになります
（トップページからはリンクしていません。検索よけに `noindex` を付けています）。公開したくない場合は、push する前に `.gitignore` に入れてください。
