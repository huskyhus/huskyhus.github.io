// 3D 描画（Three.js）。物理は 2D のままで、見た目だけ立体にする。
// 迷路の座標 (x, y) → 3D の (x, 高さ, y)。床が y = 0、マス (x, y) は [x, x+1] × [y, y+1]。
// 盤面は「ボールを支点にして傾く台」の中に置き、傾きの入力に合わせて少し傾けて見せる。
// プレイヤーは玉乗り: 縞模様のボールが転がり、その上に全身の切り抜き画像を、
// いつもカメラを向く立ち絵（スプライト）にして乗せる。ボールは回るが、乗っているキャラの絵は回らない。

import * as THREE from "../vendor/three.module.min.js";

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif';

const COLORS = {
  bg: 0x3b2f4a,
  base: 0x5a3d30,
  wall: 0x9a6f55,
  floorA: "#fff4dc",
  floorB: "#fbeacb",
  good: "#ffc83d",
  bad: "#9b4dff",
  start: "#7bc96f",
  goal: "#ff6b4a",
};

const WALL_H = 0.42;
const FOV = 42;
const PITCH = 58 * Math.PI / 180;   // カメラの見下ろす角度
const VIEW_CELLS = 6.5;             // 画面の短辺に見せるマス数（ボールのあたりで）
const BOARD_TILT = 5 * Math.PI / 180;
const PARTICLES = 140;
const BEAM_H = 5;                   // 大当たりの光の柱の高さ
const FLOAT_H = WALL_H + 0.22;      // 「今日はチートデイ」（壁すり抜け）中に浮く高さ。壁の上を越えて見える
const RIDER_H = 0.85;               // 乗っているキャラの高さ（マス）
const RIDER_SINK = 0.04;            // 足をボールに少しめり込ませる（浮いて見えないように）
// バランスを取る動き（角度はラジアン。足もとを軸に、画面の中で左右へ傾ける）
const RIDER_LEAN = 0.6;             // 傾けた向き・速さから決める目標の角度の上限（約 34°）
const RIDER_LEAN_LIMIT = 0.8;       // 揺れ戻しも含めた角度の上限
const RIDER_TILT_GAIN = 0.55;       // 傾き（−1〜1）→ 目標の角度
const RIDER_SPEED_GAIN = 0.05;      // 横の速さ（マス/秒）→ 目標の角度
const LEAN_K = 45;                  // 目標へ引き戻すばね
const LEAN_D = 4;                   // 揺れの減衰（小さいほど行き過ぎてぐらぐらする）
const LEAN_KICK = 0.25;             // ボールの加速度 → 体が逆へ振られる強さ
const SWEAT_LEAN = 0.45;            // これより大きく傾くと汗が出る（約 26°）
const SWEAT_RATE = 10;              // 傾きが上限のときに飛び散るしずくの数（毎秒）
const SWEAT_DROPS = 10;             // しずくの使い回しの数
const BALL_STRIPES = ["#ff6b4a", "#ffffff", "#ffc83d", "#ffffff", "#4cb3ff", "#ffffff"];

// ------------------------------------------------------------ テクスチャ（2D キャンバスで作る）

/** 玉乗りのボールの模様（正距円筒図法: 横 360°・縦 180°）。縦じまは両極で集まって、ビーチボールの柄になる */
function makeBallCanvas() {
  const W = 256, H = 128;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const n = BALL_STRIPES.length * 2;
  for (let i = 0; i < n; i++) {
    g.fillStyle = BALL_STRIPES[i % BALL_STRIPES.length];
    g.fillRect(i * W / n, 0, W / n + 1, H);
  }
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H * 0.07);
  g.fillRect(0, H * 0.93, W, H * 0.07);
  return c;
}

/** アイテムのカード（白い台紙 + ステッカー + 良い/悪いの色の枠。大当たりは虹の枠） */
export function makeItemTexture(img, good, special = false) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const pad = 6;
  roundRect(g, pad, pad, size - pad * 2, size - pad * 2, 26);
  g.fillStyle = "#fff";
  g.fill();
  g.lineWidth = special ? 12 : 10;
  if (special) {
    const rainbow = g.createLinearGradient(0, 0, size, size);
    ["#ff6b4a", "#ffc83d", "#7bc96f", "#4cb3ff", "#b07cff"].forEach((c, i) => rainbow.addColorStop(i / 4, c));
    g.strokeStyle = rainbow;
  } else {
    g.strokeStyle = good ? COLORS.good : COLORS.bad;
  }
  g.stroke();
  const s = Math.min((size - 30) / img.width, (size - 30) / img.height);
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  if (!good) {
    g.fillStyle = COLORS.bad;
    g.beginPath();
    g.arc(size - 22, 22, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `bold 22px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("!", size - 22, 23);
  }
  return c;
}

function makeFloorCanvas(maze) {
  const k = 48;
  const c = document.createElement("canvas");
  c.width = maze.cols * k;
  c.height = maze.rows * k;
  const g = c.getContext("2d");
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      g.fillStyle = (x + y) % 2 ? COLORS.floorB : COLORS.floorA;
      g.fillRect(x * k, y * k, k, k);
    }
  }
  const mark = (cell, color, label) => {
    const x = maze.cx(cell) * k, y = maze.cy(cell) * k;
    g.fillStyle = color + "66";
    g.fillRect(x, y, k, k);
    g.fillStyle = color;
    g.font = `800 ${k * 0.26}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, x + k / 2, y + k * (label === "GOAL" ? 0.82 : 0.5));
  };
  mark(maze.start, COLORS.start, "START");
  mark(maze.goal, COLORS.goal, "GOAL");
  return c;
}

function makeCheckerCanvas() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 48;
  const g = c.getContext("2d");
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      g.fillStyle = (i + j) % 2 ? "#2b2d42" : "#fff";
      g.fillRect(i * 16, j * 16, 16, 16);
    }
  }
  return c;
}

/** 汗のしずく（上がとがった水滴。白いつや入り） */
function makeDropCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(40, 20, 52, 30, 52, 42);
  g.arc(32, 42, 20, 0, Math.PI);
  g.bezierCurveTo(12, 30, 24, 20, 32, 4);
  const fill = g.createLinearGradient(0, 4, 0, 62);
  fill.addColorStop(0, "#d8f4ff");
  fill.addColorStop(1, "#5bbcf0");
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = "#2d86c4";
  g.stroke();
  g.fillStyle = "rgba(255, 255, 255, 0.9)";
  g.beginPath();
  g.ellipse(25, 42, 4, 8, -0.3, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeTextCanvas(text, color) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const g = c.getContext("2d");
  g.font = `800 40px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 8;
  g.strokeStyle = "#fff";
  g.strokeText(text, 64, 34);
  g.fillStyle = color;
  g.fillText(text, 64, 34);
  return c;
}

function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  else g.rect(x, y, w, h);
}

// ------------------------------------------------------------ シーン

export class Scene3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.bg, 14, 30);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camDist = 12;
    this.camTarget = new THREE.Vector3();

    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x5a4a6a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
    sun.shadow.bias = -0.0015;
    this.sun = sun;
    this.scene.add(sun, sun.target);

    // 支点（ボールの位置）→ 盤面
    this.pivot = new THREE.Group();
    this.board = new THREE.Group();
    this.pivot.add(this.board);
    this.scene.add(this.pivot);

    this.sprites = {
      reverse: canvasTexture(makeTextCanvas("⇄", COLORS.bad)),
      best: canvasTexture(makeTextCanvas("BEST", "#6c7086")),
      drop: canvasTexture(makeDropCanvas()),
    };
    this.particles = [];
    this.lastBall = null;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // 短辺に VIEW_CELLS マス見えるよう、ボールまでの距離を決める
    const visH = w < h ? VIEW_CELLS / (w / h) : VIEW_CELLS;
    this.camDist = Math.min(22, visH / (2 * Math.tan(FOV * Math.PI / 360)));
  }

  /** 迷路を作り直す（日付が変わったとき） */
  build(maze, itemTextures) {
    this.board.clear();
    this.maze = maze;
    const { cols, rows } = maze;
    const std = opts => new THREE.MeshStandardMaterial({ roughness: 0.8, ...opts });

    const base = new THREE.Mesh(new THREE.BoxGeometry(cols + 0.6, 0.5, rows + 0.6), std({ color: COLORS.base }));
    base.position.set(cols / 2, -0.25, rows / 2);
    base.receiveShadow = true;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows), std({ map: canvasTexture(makeFloorCanvas(maze)) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cols / 2, 0.001, rows / 2);
    floor.receiveShadow = true;
    this.board.add(base, floor);

    // 壁: 1 つの箱を伸ばして並べる（インスタンス描画）
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color: COLORS.wall, roughness: 0.65 }), maze.rects.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    maze.rects.forEach((r, i) => {
      m.compose(
        new THREE.Vector3((r.x0 + r.x1) / 2, WALL_H / 2, (r.y0 + r.y1) / 2),
        q,
        new THREE.Vector3(r.x1 - r.x0, WALL_H, r.y1 - r.y0),
      );
      walls.setMatrixAt(i, m);
    });
    walls.castShadow = walls.receiveShadow = true;
    this.board.add(walls);

    // ゴールの旗と輪
    const gx = maze.cx(maze.goal) + 0.5, gz = maze.cy(maze.goal) + 0.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1), std({ color: 0xdddddd, metalness: 0.5 }));
    pole.position.set(gx - 0.3, 0.55, gz - 0.3);
    pole.castShadow = true;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36, 8, 1),
      std({ map: canvasTexture(makeCheckerCanvas()), side: THREE.DoubleSide }));
    flag.position.set(gx - 0.05, 0.9, gz - 0.3);
    flag.castShadow = true;
    this.flag = flag;
    this.goalRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: COLORS.goal, transparent: true }));
    this.goalRing.rotation.x = -Math.PI / 2;
    this.goalRing.position.set(gx, 0.01, gz);
    this.board.add(pole, flag, this.goalRing);

    // アイテム: 浮かぶカード（いつもカメラを向く）+ 床の輪。大当たりは大きめで、遠くから見える光の柱つき。
    // aura のアイテム（地の獄）は赤黒いオーラの柱をまとう
    this.itemObjs = maze.items.map(it => {
      const good = itemTextures.good[it.kind];
      const special = itemTextures.special[it.kind];
      const aura = itemTextures.aura[it.kind];
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTextures.tex[it.kind] }));
      sprite.scale.setScalar(special ? 0.9 : 0.72);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 32),
        new THREE.MeshBasicMaterial({ color: good ? COLORS.good : COLORS.bad, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2;
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
      shadow.rotation.x = -Math.PI / 2;
      const g = new THREE.Group();
      g.add(sprite, ring, shadow);
      let beam = null;
      if (special || aura) {
        // 光（大当たり）は足し合わせて明るく、オーラ（地の獄）はふつうに重ねて暗く見せる
        beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, BEAM_H, 20, 1, true),
          new THREE.MeshBasicMaterial({ color: aura ? 0x5a0010 : it.kind === "jackpot" ? 0xffd84a : 0x9fe8ff, transparent: true, opacity: 0.35,
            side: THREE.DoubleSide, depthWrite: false, blending: aura ? THREE.NormalBlending : THREE.AdditiveBlending }));
        beam.position.y = BEAM_H / 2;
        g.add(beam);
      }
      g.position.set(it.x, 0, it.y);
      ring.position.y = 0.012;
      shadow.position.y = 0.008;
      this.board.add(g);
      return { group: g, sprite, beam, phase: it.cell, lift: special ? 0.65 : 0.55 };
    });

    // プレイヤー: 転がるボール + 乗っているキャラ（立ち絵）
    const sphere = new THREE.SphereGeometry(1, 32, 20);
    this.ball = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: canvasTexture(makeBallCanvas()), roughness: 0.35 }));
    this.ball.castShadow = true;
    // 立ち絵はカメラに正対するので上のほうが奥へ倒れ、奥の壁にめり込む。壁に隠れないよう最後に重ねて描く
    this.rider = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.rider.center.set(0.5, 0);   // 足もとを基準に立たせる
    this.rider.renderOrder = 10;
    // ゴースト（ベストの走り）: 半透明のボールとキャラ
    this.ghostBall = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x9a9cb0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghostRider = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9a9cb0, transparent: true, opacity: 0.4, depthTest: false }));
    this.ghostRider.center.set(0.5, 0);
    this.ghostRider.renderOrder = 9;
    this.ghostLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sprites.best, transparent: true, opacity: 0.8, depthTest: false }));
    this.ghostLabel.scale.set(0.5, 0.25, 1);
    this.barrier = new THREE.Mesh(sphere,
      new THREE.MeshBasicMaterial({ color: 0x50c8ff, transparent: true, opacity: 0.25, depthWrite: false }));
    this.assistRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32),
      new THREE.MeshBasicMaterial({ color: 0x4cd07d, transparent: true, opacity: 0.8 }));
    this.assistRing.rotation.x = -Math.PI / 2;
    this.status = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sprites.reverse, depthTest: false }));
    this.status.scale.set(0.5, 0.25, 1);
    this.board.add(this.ball, this.rider, this.ghostBall, this.ghostRider, this.ghostLabel, this.barrier, this.assistRing, this.status);
    this.applyRider();

    // 汗: 頭のまわりから飛び散るしずく（使い回す）
    this.sweat = [];
    for (let i = 0; i < SWEAT_DROPS; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sprites.drop, transparent: true, depthTest: false }));
      sp.renderOrder = 11;
      sp.visible = false;
      this.board.add(sp);
      this.sweat.push({ sprite: sp, v: new THREE.Vector3(), life: 0 });
    }

    // 粒（使い回す）
    const pg = new THREE.SphereGeometry(1, 6, 4);
    this.particles = [];
    for (let i = 0; i < PARTICLES; i++) {
      const p = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: true }));
      p.visible = false;
      this.board.add(p);
      this.particles.push({ mesh: p, life: 0, maxLife: 1, v: new THREE.Vector3() });
    }
    this.lastBall = null;
  }

  /** 乗っているキャラの立ち絵（全身の切り抜き画像） */
  setRider(img) {
    this.riderTex = canvasTexture(img);
    this.riderW = RIDER_H * img.width / img.height;
    this.applyRider();
  }

  applyRider() {
    if (!this.riderTex || !this.rider) return;
    for (const sp of [this.rider, this.ghostRider]) {
      sp.material.map = this.riderTex;
      sp.material.needsUpdate = true;
      sp.scale.set(this.riderW, RIDER_H, 1);
    }
  }

  burst(x, y, color, count, { up = 2.5, spread = 2.5, height = 0.3 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.particles.find(q => q.life <= 0);
      if (!p) return;
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * spread;
      p.v.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s);
      p.mesh.position.set(x, height, y);
      p.mesh.material.color.set(color);
      p.mesh.scale.setScalar(0.035 + Math.random() * 0.04);
      p.mesh.visible = true;
      p.life = p.maxLife = 0.5 + Math.random() * 0.5;
    }
  }

  /**
   * s: { ball, items, effects, ghostPos, tilt, time, dt, title }
   */
  update(s) {
    const { ball, effects: fx, time, dt } = s;
    const r = ball.r;

    // 「今日はチートデイ」（壁すり抜け）中は、ボールごと空中に浮いて壁の上を越えていく。
    // ふわふわ上下し、切れる直前は揺れを速く大きくして知らせる。終わるとなめらかに降りる
    if (dt > 0) this.float = (this.float ?? 0) + ((fx.ghost ? 1 : 0) - (this.float ?? 0)) * Math.min(1, dt * 6);
    const ending = fx.ghost && fx.ghost < 0.8;
    const lift = (this.float ?? 0) * FLOAT_H + (fx.ghost ? Math.sin(time * (ending ? 18 : 3)) * (ending ? 0.06 : 0.04) : 0);
    if (fx.ghost && dt > 0 && Math.random() < 0.5) {
      this.burst(ball.x, ball.y, "#bff0ff", 1, { up: -0.3, spread: 0.3, height: lift + 0.05 });
    }

    // ボールは進んだ距離 / 半径 だけ、進行方向に垂直な軸で回す（浮いている間は回さない）
    let vx = 0, vz = 0;
    if (this.lastBall) {
      const dx = ball.x - this.lastBall.x, dz = ball.y - this.lastBall.y;
      const d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < 1) {
        if ((this.float ?? 0) < 0.3) {
          this.ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz, 0, -dx).normalize(), d / r));
        }
        if (dt > 0) { vx = dx / dt; vz = dz / dt; }
      }
    }
    this.lastBall = { x: ball.x, y: ball.y };
    this.ball.position.set(ball.x, r + lift, ball.y);
    this.ball.scale.setScalar(r);

    // キャラはボールのてっぺんに立ち、足もとを軸に体を傾けてバランスを取る。
    // 目標の角度（傾けた向き・進む速さ・止まっていても続く小さな揺れ）へ、ばねで引き戻されつつ行き過ぎて、ぐらぐらする。
    // ボールが急に速さを変える（加速・壁にぶつかる）と、体は慣性で逆へ振られる
    if (dt > 0) {
      const target = clamp(-(s.tilt.x * RIDER_TILT_GAIN + vx * RIDER_SPEED_GAIN), RIDER_LEAN)
        + Math.sin(time * 2.3) * 0.06 + Math.sin(time * 3.7) * 0.03;
      const ax = clamp((vx - (this.prevVx ?? 0)) / dt, 400);
      this.prevVx = vx;
      this.leanVel = (this.leanVel ?? 0) + ((target - (this.lean ?? 0)) * LEAN_K - (this.leanVel ?? 0) * LEAN_D + ax * LEAN_KICK) * dt;
      const next = (this.lean ?? 0) + this.leanVel * dt;
      this.lean = clamp(next, RIDER_LEAN_LIMIT);
      if (this.lean !== next) this.leanVel = 0;   // 上限で止まったら、勢いもそこで止める
    }
    this.rider.position.set(ball.x, r * 2 - RIDER_SINK + lift, ball.y);
    this.rider.material.rotation = this.lean ?? 0;
    // 前後に傾けたときは、身をかがめるように少し縮める
    this.rider.scale.y = RIDER_H * (1 - Math.abs(s.tilt.y) * 0.15);
    this.updateSweat(dt);
    const h = r * 2 + RIDER_H;   // ボールとキャラを合わせた高さ
    this.rider.material.color.set(fx.ice ? 0xa8dcff : fx.dash ? 0xffe0a0 : 0xffffff);
    this.ball.material.emissive.set(fx.ice ? 0x3a7fb0 : fx.dash ? 0x7a4a00 : 0x000000);

    this.barrier.visible = !!fx.barrier;
    this.barrier.position.set(ball.x, h * 0.5 + lift, ball.y);
    this.barrier.scale.setScalar(h * (0.6 + Math.sin(time * 8) * 0.03));
    this.assistRing.visible = !!fx.assist;
    this.assistRing.position.set(ball.x, 0.015, ball.y);
    this.assistRing.scale.setScalar(r * 1.5);
    const st = fx.reverse ? "reverse" : null;
    this.status.visible = !!st;
    if (st) {
      this.status.material.map = this.sprites[st];
      this.status.position.set(ball.x + r * 0.8, h + lift + 0.12 + Math.sin(time * 3) * 0.05, ball.y);
    }
    if (fx.dash && Math.random() < 0.6) this.burst(ball.x, ball.y, COLORS.good, 1, { up: 0.6, spread: 0.4 });

    const gp = s.ghostPos;
    this.ghostBall.visible = this.ghostRider.visible = this.ghostLabel.visible = !!gp;
    if (gp) {
      this.ghostBall.position.set(gp.x, r, gp.y);
      this.ghostBall.scale.setScalar(r);
      this.ghostRider.position.set(gp.x, r * 2 - RIDER_SINK, gp.y);
      this.ghostLabel.position.set(gp.x, h + 0.15, gp.y);
    }

    s.items.forEach((it, i) => {
      const o = this.itemObjs[i];
      o.group.visible = !it.taken;
      o.sprite.position.y = o.lift + Math.sin(time * 3 + o.phase) * 0.06;
      if (o.beam) o.beam.material.opacity = 0.25 + Math.sin(time * 4 + o.phase) * 0.1;
    });

    this.goalRing.scale.setScalar(1 + Math.sin(time * 4) * 0.12);
    this.flag.rotation.y = Math.sin(time * 3) * 0.25;

    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.mesh.position.y < 0.03) { p.mesh.position.y = 0.03; p.v.y *= -0.4; }
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) p.mesh.visible = false;
    }

    // 盤面の傾き（ボールを支点に）
    this.pivot.position.set(ball.x, 0, ball.y);
    this.board.position.set(-ball.x, 0, -ball.y);
    this.pivot.rotation.x = s.tilt.y * BOARD_TILT;
    this.pivot.rotation.z = -s.tilt.x * BOARD_TILT;

    // カメラ
    if (s.title) {
      const a = time * 0.12;
      const cx = this.maze.cols / 2, cz = this.maze.rows / 2;
      this.camTarget.set(cx, 0, cz);
      this.camera.position.set(cx + Math.sin(a) * 9, 15, cz + Math.cos(a) * 9);
    } else {
      const k = Math.min(1, dt * 8);
      this.camTarget.x += (ball.x - this.camTarget.x) * k;
      this.camTarget.z += (ball.y - this.camTarget.z) * k;
      this.camTarget.y = 0;
      this.camera.position.set(
        this.camTarget.x,
        this.camDist * Math.sin(PITCH),
        this.camTarget.z + this.camDist * Math.cos(PITCH),
      );
    }
    this.camera.lookAt(this.camTarget);
    const dist = this.camera.position.distanceTo(this.camTarget);
    this.scene.fog.near = dist + 4;
    this.scene.fog.far = dist + 20;
    this.sun.position.set(this.camTarget.x - 3, 10, this.camTarget.z - 2);
    this.sun.target.position.copy(this.camTarget);

    this.renderer.render(this.scene, this.camera);
  }

  /** 大きく傾いているときの汗。傾きが SWEAT_LEAN を超えた分に応じて、頭のまわりのランダムな位置からしずくが飛び散る */
  updateSweat(dt) {
    const lean = this.lean ?? 0;
    const over = Math.max(0, (Math.abs(lean) - SWEAT_LEAN) / (RIDER_LEAN_LIMIT - SWEAT_LEAN));
    // 立ち絵はカメラに正対しているので、画面の右（camX）と上（camY）の向きで頭の位置を出す
    const camX = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const camY = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const hh = this.rider.scale.y * 0.8;
    const head = this.rider.position.clone()
      .addScaledVector(camX, -Math.sin(lean) * hh)
      .addScaledVector(camY, Math.cos(lean) * hh);

    if (dt > 0 && over > 0 && Math.random() < over * SWEAT_RATE * dt) {
      const d = this.sweat.find(q => q.life <= 0);
      if (d) {
        // 頭のまわりのランダムな位置から、その位置の外向きへ飛ばす
        const a = Math.random() * Math.PI * 2;
        const ox = Math.cos(a), oy = Math.sin(a) * 0.8;
        d.sprite.position.copy(head).addScaledVector(camX, ox * 0.2).addScaledVector(camY, oy * 0.2);
        d.v.copy(camX).multiplyScalar(ox * (0.6 + Math.random() * 0.8)).add(new THREE.Vector3(0, 0.8 + Math.max(0, oy) + Math.random() * 0.6, 0));
        d.sprite.scale.setScalar(0.08 + Math.random() * 0.05);
        d.sprite.visible = true;
        d.life = 0.7;
      }
    }
    for (const d of this.sweat) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 7 * dt;
      d.sprite.position.addScaledVector(d.v, dt);
      d.sprite.material.opacity = Math.min(1, d.life / 0.3);
      if (d.life <= 0 || d.sprite.position.y < 0.02) { d.life = 0; d.sprite.visible = false; }
    }
  }

  /** カメラを今のボールの位置へすぐ合わせる（開始・ワープのとき） */
  snapCamera(x, y) {
    this.camTarget.set(x, 0, y);
    this.lastBall = null;
  }

  /** 迷路の座標 → 画面の CSS ピクセル。ついでに、そこでの 1 マスの大きさと、カメラの前にあるか */
  project(x, y, w, h) {
    const p = new THREE.Vector3(x, 0, y).project(this.camera);
    const q = new THREE.Vector3(x + 1, 0, y).project(this.camera);
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, cell: Math.abs(q.x - p.x) / 2 * w, front: p.z < 1 };
  }
}
