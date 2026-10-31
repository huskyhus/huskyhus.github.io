// プレイヤー。「忘れるなよ」のハスキーがボールに乗って（玉乗りで）迷路を進む。
// avatar はステッカーから全身を背景ごと切り抜いた画像（作り方は README）。
// 動き（単位はマス、秒）:
//   accel    最大に傾けたときの加速度
//   damp     転がり抵抗。大きいほど慣性が弱く、すぐ止まれる
//   maxSpeed 最高速
//   bounce   壁の跳ね返り
// 傾けっぱなしの速さはおよそ min(accel / damp, maxSpeed)。ゆっくりだが思いどおりに動かせる性能。

export const PLAYER = {
  name: "忘れるなよ",
  avatar: "avatars/wasureru.png",
  accel: 20, damp: 4.2, maxSpeed: 4.8, bounce: 0.25,
};
