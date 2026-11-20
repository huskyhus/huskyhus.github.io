// 描画（three.js）。マップ・人・落ちているもの・安全地帯・飛行機・補給物資・弾の線・爆発・グレネードの予測線・一人称の銃。
// ステッカーは白い台紙つきのテクスチャにして、人の頭（かぶりもの）・ポスター・看板・銃の側面・スタンプに使う。
// 形そのもの（銃・アイテム・人型）は models.js。

import * as THREE from "../vendor/three.module.min.js";
import { N, CELL, HALF, K } from "./world.js";
import { AVATARS, STAMPS, STK, stickerSrc, W_GRENADE, itemTier, itemShort, TIER_COLORS, GRENADE } from "./items.js";
import { PLANE_ALT } from "./sim.js";
import { gunMesh, itemMesh, humanoid, dressPerson, posePerson, mat, setStickerTex } from "./models.js";

// 24 人ぶんの色（最初の 6 色は見分けやすい色、あとは色相を少しずつずらす）
export const SLOT_COLORS = ["#ff6b4a", "#3d8bff", "#2ec27e", "#f5c211", "#c061cb", "#26c6da",
  ...Array.from({ length: 18 }, (_, i) => `hsl(${Math.round((i * 137.5 + 20) % 360)}, ${i % 2 ? 65 : 80}%, ${i % 3 ? 58 : 48}%)`)];
const WALL_COLORS = ["#f3e2c7", "#d9e8f5", "#f6d1d1", "#e3f1d5", "#efe6a8", "#e0d4f2"];
const ROOF_COLORS = ["#b5523b", "#4f6d8f", "#7b5a3c", "#a8423f", "#5b7f4a", "#8a5a8f"];
const CONT_COLORS = ["#c0392b", "#2e86c1", "#27ae60", "#d68910"];

const imgCache = new Map();
function loadImg(id) {
  if (!imgCache.has(id)) {
    imgCache.set(id, new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = stickerSrc(id);
    }));
  }
  return imgCache.get(id);
}

/** ステッカーの画像が読めるまで待つ（読めなくても終わる） */
export function stickerReady(id) { return loadImg(id); }

/** 白い台紙＋ステッカーのテクスチャ（読み込み後に絵が入る） */
const texCache = new Map();
export function stickerTex(id, opt = {}) {
  const key = id + JSON.stringify(opt);
  if (texCache.has(key)) return texCache.get(key);
  const W = opt.w ?? 256, H = opt.h ?? 212;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const pad = opt.pad ?? 8;
  const paint = im => {
    g.clearRect(0, 0, W, H);
    if (opt.bg !== null) {
      g.fillStyle = opt.bg ?? "#ffffff";
      roundRect(g, 0, 0, W, H, opt.round ?? 22); g.fill();
      if (opt.border) { g.lineWidth = 10; g.strokeStyle = opt.border; roundRect(g, 5, 5, W - 10, H - 10, (opt.round ?? 22) - 4); g.stroke(); }
    }
    if (im) {
      const s = Math.min((W - pad * 2) / im.width, (H - pad * 2) / im.height);
      g.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
    }
  };
  paint(null);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  loadImg(id).then(im => { paint(im); tex.needsUpdate = true; });
  texCache.set(key, tex);
  return tex;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function textTex(text, color = "#fff", bg = "rgba(0,0,0,0.45)", w = 256, h = 64, font = 30) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  g.fillStyle = bg; roundRect(g, 0, 0, w, h, 14); g.fill();
  g.fillStyle = color; g.font = `bold ${font}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 2, w - 12);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
setStickerTex((id, opt) => stickerTex(id, opt));

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#9fd3f0");
    this.scene.fog = new THREE.Fog("#a9d6ee", 160, 720);
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.08, 1600);
    this.scene.add(this.camera);
    const hemi = new THREE.HemisphereLight("#dff2ff", "#7a8a5a", 1.25);
    this.scene.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight("#fff4dc", 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    // 一人称の銃は別の場面で、深さを消してから重ねる
    this.vScene = new THREE.Scene();
    this.vCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.vScene.add(new THREE.HemisphereLight("#ffffff", "#666666", 2.2));
    const vl = new THREE.DirectionalLight("#ffffff", 1.4); vl.position.set(1, 2, 1); this.vScene.add(vl);
    this.vRoot = new THREE.Group(); this.vScene.add(this.vRoot);
    this.vModels = new Map();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex(), color: "#ffe9a8", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flash.scale.set(0.35, 0.35, 1);
    this.flash.visible = false;
    this.vRoot.add(this.flash);

    this.mapGroup = null;
    this.people = new Map();
    this.loot = new Map();   // id → { l, obj（近づいた時に作る）, label }
    this.drops = new Map();
    this.fx = [];
    this.gren = new Map();
    this.buildFixed();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vCam.aspect = w / h; this.vCam.updateProjectionMatrix();
  }

  buildFixed() {
    // 海
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: "#3a8fc4", transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0;
    this.scene.add(water);
    // 安全地帯（青い壁）と次の安全地帯（白い線）
    const zg = new THREE.CylinderGeometry(1, 1, 1, 128, 1, true);
    this.zoneMesh = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ color: "#3d6bff", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.zoneMesh.renderOrder = 5;
    this.nextMesh = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.nextMesh.renderOrder = 4;
    this.scene.add(this.zoneMesh, this.nextMesh);
    // 飛行機
    const pl = this.plane = new THREE.Group();
    const white = new THREE.MeshLambertMaterial({ color: "#f4f4f4" }), orange = new THREE.MeshLambertMaterial({ color: "#ff6b4a" });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 26, 12), white); body.rotation.x = Math.PI / 2; pl.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 12), white); nose.rotation.x = -Math.PI / 2; nose.position.z = -15.5; pl.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 5), orange); wing.position.set(0, -0.4, -2); pl.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 3), orange); tail.position.set(0, 0.6, 11.5); pl.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 3.5), orange); fin.position.set(0, 3, 11.5); pl.add(fin);
    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.5, 10), white); eng.rotation.x = Math.PI / 2; eng.position.set(s * 7, -1.4, -3); pl.add(eng);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(9, 7.4), new THREE.MeshBasicMaterial({ map: stickerTex(STK.saraba), transparent: true }));
      ban.position.set(s * 2.25, 0.4, 0); ban.rotation.y = s * Math.PI / 2; pl.add(ban);
    }
    pl.traverse(o => { o.castShadow = true; });
    pl.visible = false;
    this.scene.add(pl);
    // 弾の線
    this.tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 4, 1, true);
    this.tracerGeo.translate(0, 0.5, 0); this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: "#fff2a0", transparent: true, opacity: 0.9, depthWrite: false });
    this.puffTex = flashTex();
    // グレネードの予測線と、爆発の届く範囲
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
    this.traj = new THREE.Line(tg, new THREE.LineDashedMaterial({ color: "#ffdf3d", dashSize: 0.35, gapSize: 0.2, depthTest: false, transparent: true }));
    this.traj.renderOrder = 10; this.traj.frustumCulled = false; this.traj.visible = false;
    this.trajEnd = new THREE.Mesh(new THREE.RingGeometry(GRENADE.radius - 0.25, GRENADE.radius, 48), new THREE.MeshBasicMaterial({ color: "#ff6b4a", transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false }));
    this.trajEnd.rotation.x = -Math.PI / 2; this.trajEnd.renderOrder = 10; this.trajEnd.visible = false;
    this.trajDot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: "#ff6b4a", depthTest: false }));
    this.trajDot.renderOrder = 10; this.trajDot.visible = false;
    // 線は 1px で見えにくいので、点の列も並べる
    this.trajDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffdf3d", depthTest: false, transparent: true, opacity: 0.9 }), 80);
    this.trajDots.renderOrder = 10; this.trajDots.frustumCulled = false; this.trajDots.count = 0;
    this.scene.add(this.traj, this.trajEnd, this.trajDot, this.trajDots);
  }

  /** グレネードの予測線。pts: [x,y,z, ...]（null で消す） */
  setTrajectory(pts) {
    const on = !!pts && pts.length >= 6;
    this.traj.visible = this.trajEnd.visible = this.trajDot.visible = on;
    if (!on) { this.trajDots.count = 0; return; }
    const a = this.traj.geometry.attributes.position;
    const n = Math.min(400, pts.length / 3);
    for (let i = 0; i < n * 3; i++) a.array[i] = pts[i];
    a.needsUpdate = true;
    this.traj.geometry.setDrawRange(0, n);
    this.traj.computeLineDistances();
    const m4 = this._m4 ??= new THREE.Matrix4();
    let k = 0;
    for (let i = 6; i < n && k < 80; i += 3) { m4.makeTranslation(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); this.trajDots.setMatrixAt(k++, m4); }
    this.trajDots.count = k;
    this.trajDots.instanceMatrix.needsUpdate = true;
    const ex = pts[(n - 1) * 3], ey = pts[(n - 1) * 3 + 1], ez = pts[(n - 1) * 3 + 2];
    this.trajEnd.position.set(ex, ey + 0.05, ez);
    this.trajDot.position.set(ex, ey, ez);
  }

  /** 補給物資。list: [[id, x, y, z, 着地], ...] */
  setDrops(list) {
    const seen = new Set();
    for (const [id, x, y, z, landed] of list) {
      seen.add(id);
      let D = this.drops.get(id);
      if (!D) {
        const g = new THREE.Group();
        const crate = new THREE.Group(); g.add(crate);
        const wood = mat("#b8874a"), metal = mat("#3a4a5a");
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.4), wood); c.position.y = 0.5; crate.add(c);
        for (const yy of [0.05, 0.95]) { const band = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.1, 1.44), metal); band.position.y = yy; crate.add(band); }
        for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.74), new THREE.MeshLambertMaterial({ map: stickerTex(STK.gyakuten) }));
          p.position.set(nx * 0.71, 0.5, nz * 0.71); p.rotation.y = Math.atan2(nx, nz); crate.add(p);
        }
        const chute = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshLambertMaterial({ color: "#e8402f", side: THREE.DoubleSide }));
        dome.scale.set(1, 0.5, 1); dome.position.y = 5.5; chute.add(dome);
        const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([0, 1, 2, 3].flatMap(k => {
          const a = (k / 4) * Math.PI * 2;
          return [new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(Math.cos(a) * 3, 5.6, Math.sin(a) * 3)];
        })), new THREE.LineBasicMaterial({ color: "#333" }));
        chute.add(lines);
        g.add(chute);
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(g);
        D = { g, chute, smokeT: 0 };
        this.drops.set(id, D);
      }
      D.g.position.set(x, y, z);
      D.chute.visible = !landed;
      D.landed = landed;
    }
    for (const [id, D] of this.drops) if (!seen.has(id)) { this.scene.remove(D.g); this.drops.delete(id); }
  }
  clearDrops() { for (const D of this.drops.values()) this.scene.remove(D.g); this.drops.clear(); }

  // ---- マップ ----
  buildWorld(world) {
    if (this.mapGroup) { this.scene.remove(this.mapGroup); this.mapGroup.traverse(o => { o.geometry?.dispose?.(); }); }
    for (const L of this.loot.values()) { if (L.obj) this.scene.remove(L.obj); if (L.label) this.scene.remove(L.label); }
    this.loot.clear();
    this.clearDrops();
    this.world = world;
    const G = this.mapGroup = new THREE.Group();
    this.scene.add(G);
    // 地形
    const n1 = N + 1;
    const pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3);
    const c = new THREE.Color();
    const H = world.heights;
    const pads = world.buildings;
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const i = iz * n1 + ix, x = ix * CELL - HALF, z = iz * CELL - HALF, h = H[i];
      pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
      const sl = Math.abs((H[Math.min(i + 1, H.length - 1)] - H[Math.max(i - 1, 0)])) + Math.abs((H[Math.min(i + n1, H.length - 1)] - H[Math.max(i - n1, 0)]));
      const v = ((ix * 7 + iz * 13) % 5) / 40;
      if (h < 0.6) c.set("#d8c58c");
      else if (h < 1.6) c.set("#b9c27a");
      else if (sl > 5) c.set("#8b8a78");
      else if (h > 24) c.set("#7f9a5c");
      else c.setRGB(0.36 + v, 0.6 + v, 0.28);
      if (h > 0.6 && world.roadDist(x, z) < 3.5) c.set("#bfa77c");
      if (pads.some(b => !b.solid && x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) c.set("#b49a6a");
      if (pads.some(b => b.plaza && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) c.set("#c9c1b0");
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const idx = [];
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const a = iz * n1 + ix, b = a + 1, d = a + n1, e = d + 1;
      idx.push(a, e, b, a, d, e);   // world.heightAt と同じ分け方
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    terrain.receiveShadow = true;
    G.add(terrain);

    // 建物などの箱（木の幹・岩は別に描く）
    const boxes = world.boxes.filter(b => b.k !== K.TRUNK && b.k !== K.ROCK);
    const bp = new Float32Array(boxes.length * 24 * 3), bn = new Float32Array(boxes.length * 24 * 3), bc = new Float32Array(boxes.length * 24 * 3);
    const bi = [];
    let v = 0;
    const FACES = [
      [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
      [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
      [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
    ];
    for (const b of boxes) {
      const col0 = b.k === K.WALL ? WALL_COLORS[b.c] : b.k === K.ROOF ? ROOF_COLORS[b.c] : b.k === K.FLOOR ? "#a67c52" : b.k === K.STAIR ? "#8d6a45"
        : b.k === K.CRATE ? "#b8874a" : b.k === K.PAD ? "#ff4fa3" : b.k === K.RED ? "#d8342a" : b.k === K.STONE ? "#b9b4aa"
          : b.k === K.WOOD ? "#8b6a43" : b.k === K.BOARD ? "#f4f4f4" : CONT_COLORS[b.c % 4];
      for (const [nrm, corners] of FACES) {
        c.set(b.k === K.PAD && nrm[1] === 1 ? "#ffd23d" : col0);
        if (nrm[1] === 0) c.multiplyScalar(nrm[0] !== 0 ? 0.93 : 1);
        if (b.k === K.CONTAINER && nrm[1] === 0) c.multiplyScalar(0.9);
        for (const [cx, cy, cz] of corners) {
          bp[v * 3] = cx ? b.x1 : b.x0; bp[v * 3 + 1] = cy ? b.y1 : b.y0; bp[v * 3 + 2] = cz ? b.z1 : b.z0;
          bn[v * 3] = nrm[0]; bn[v * 3 + 1] = nrm[1]; bn[v * 3 + 2] = nrm[2];
          bc[v * 3] = c.r; bc[v * 3 + 1] = c.g; bc[v * 3 + 2] = c.b;
          v++;
        }
        bi.push(v - 4, v - 3, v - 2, v - 4, v - 2, v - 1);
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    bg.setAttribute("normal", new THREE.BufferAttribute(bn, 3));
    bg.setAttribute("color", new THREE.BufferAttribute(bc, 3));
    bg.setIndex(bi);
    const bm = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    bm.castShadow = true; bm.receiveShadow = true;
    G.add(bm);

    // ポスター
    for (const p of world.posters) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w ?? 1.6, p.h ?? 1.3), new THREE.MeshLambertMaterial({ map: stickerTex(AVATARS[p.s], { border: "#ffffff" }) }));
      m.position.set(p.x + p.nx * 0.03, p.y, p.z + p.nz * 0.03);
      m.rotation.y = Math.atan2(p.nx, p.nz);
      G.add(m);
    }
    // ジャンプ台の上の矢印（上向き）
    for (const p of world.pads) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 4), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 }));
      arrow.position.set(p.x, p.y + 1.2, p.z);
      arrow.userData.spin = true;
      G.add(arrow);
    }
    this.padArrows = G.children.filter(o => o.userData.spin);
    // 町のまん中の看板（広場の町には像があるので置かない）
    world.towns.forEach((t, i) => {
      if (i === 0) return;
      const h = world.heightAt(t.x, t.z);
      const id = AVATARS[(i * 7 + 3) % AVATARS.length];
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4, 0.25), new THREE.MeshLambertMaterial({ color: "#6b4f2e" }));
      post.position.set(t.x, h + 2, t.z); post.castShadow = true;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 0.15), [0, 0, 0, 0, 1, 1].map(k => k ? new THREE.MeshLambertMaterial({ map: stickerTex(id) }) : new THREE.MeshLambertMaterial({ color: "#ffffff" })));
      sign.position.set(t.x, h + 4.4, t.z); sign.castShadow = true;
      G.add(post, sign);
    });

    // 木
    const tree0 = world.trees.filter(t => t.kind === 0), tree1 = world.trees.filter(t => t.kind === 1);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: "#7a5734" }), world.trees.length);
    world.trees.forEach((t, i) => { m4.compose(p3.set(t.x, t.y - 0.3, t.z), q.identity(), s3.set(t.s, 3.2 * t.s, t.s)); trunk.setMatrixAt(i, m4); });
    trunk.castShadow = true;
    G.add(trunk);
    const leaf = (list, geo, yoff, color) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: "#ffffff" }), Math.max(1, list.length));
      list.forEach((t, i) => {
        q.setFromAxisAngle(p3.set(0, 1, 0), t.c * 6.28);
        m4.compose(p3.set(t.x, t.y + yoff * t.s, t.z), q, s3.set(t.s, t.s, t.s));
        m.setMatrixAt(i, m4);
        m.setColorAt(i, c.set(color).offsetHSL((t.c - 0.5) * 0.06, 0, (t.c - 0.5) * 0.12));
      });
      m.count = list.length;
      m.castShadow = true; m.receiveShadow = true;
      G.add(m);
    };
    leaf(tree0, mergeCones(), 2.9, "#2f7a3c");   // 葉の下の端が目の高さ（1.6m）より上になるように
    leaf(tree1, new THREE.IcosahedronGeometry(2.1, 0), 4.2, "#4f9a3a");
    // 岩・しげみ
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: "#8f9190" }), Math.max(1, world.rocks.length));
    world.rocks.forEach((r, i) => {
      q.setFromAxisAngle(p3.set(0, 1, 0), r.r * 6.28);
      m4.compose(p3.set(r.x, r.y + r.sy * 0.35, r.z), q, s3.set(r.sx, r.sy, r.sz));
      rocks.setMatrixAt(i, m4);
      rocks.setColorAt(i, c.set("#9a9c9a").offsetHSL(0, 0, (r.r - 0.5) * 0.15));
    });
    rocks.castShadow = true; rocks.receiveShadow = true;
    G.add(rocks);
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: "#ffffff" }), Math.max(1, world.bushes.length));
    world.bushes.forEach((b, i) => {
      m4.compose(p3.set(b.x, b.y + 0.35 * b.s, b.z), q.identity(), s3.set(b.s * 1.1, b.s * 0.8, b.s * 1.1));
      bush.setMatrixAt(i, m4);
      bush.setColorAt(i, c.set("#3f8a35").offsetHSL(0, 0, (((i * 37) % 10) / 10 - 0.5) * 0.1));
    });
    bush.castShadow = true;
    G.add(bush);
  }

  // ---- 落ちているもの ----
  // 近づいた時に形を作る（600 個以上あるので）。足もとにレア度の色の輪、近くでは名前
  addLoot(l) {
    this.removeLoot(l.id);
    this.loot.set(l.id, { l, obj: null, label: null, ph: (l.id * 0.37) % 6.28 });
  }
  removeLoot(id) {
    const L = this.loot.get(id);
    if (!L) return;
    if (L.obj) this.scene.remove(L.obj);
    if (L.label) this.scene.remove(L.label);
    this.loot.delete(id);
  }
  lootObj(L) {
    const { l } = L;
    const g = new THREE.Group();
    const m = itemMesh(l.code, stickerTex);
    g.add(m);
    const tier = itemTier(l.code);
    const ring = new THREE.Mesh(this._ringGeo ??= new THREE.RingGeometry(0.34, 0.46, 24),
      this._ringMat?.[tier] ?? ((this._ringMat ??= [])[tier] = new THREE.MeshBasicMaterial({ color: TIER_COLORS[tier], transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    g.add(ring);
    if (tier === 3) {
      // 金色のものは光の柱
      const beam = new THREE.Mesh(this._beamGeo ??= new THREE.CylinderGeometry(0.06, 0.25, 4, 8, 1, true),
        this._beamMat ??= new THREE.MeshBasicMaterial({ color: "#ffd86a", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 2; g.add(beam);
    }
    g.position.set(l.x, l.y + 0.02, l.z);
    g.userData.spin = m;
    this.scene.add(g);
    return g;
  }
  lootLabel(L) {
    const tier = itemTier(L.l.code);
    const key = L.l.code;
    this._labels ??= new Map();
    if (!this._labels.has(key)) this._labels.set(key, new THREE.SpriteMaterial({ map: textTex(itemShort(key), TIER_COLORS[tier] === "#e8e8e8" ? "#ffffff" : TIER_COLORS[tier], "rgba(0,0,0,0.55)", 256, 56, 28), transparent: true, depthWrite: false }));
    const s = new THREE.Sprite(this._labels.get(key));
    s.scale.set(0.62, 0.136, 1);
    s.position.set(L.l.x, L.l.y + 0.62, L.l.z);
    this.scene.add(s);
    return s;
  }

  // ---- 人 ----
  /** tagColor: 名前の色（チーム戦では敵 = 赤 / 味方 = 水色） */
  person(slot, av, name, tagColor = "#fff") {
    let P = this.people.get(slot);
    if (P && P.av === av && P.name === name && P.tagColor === tagColor) return P;
    if (P) this.scene.remove(P.g);
    const color = SLOT_COLORS[slot % SLOT_COLORS.length];
    const g = new THREE.Group();
    const H = humanoid(color, new THREE.MeshLambertMaterial({ map: stickerTex(AVATARS[av], { border: color }) }));
    g.add(H.root);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color: "#ffd27a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.scale.set(0.5, 0.5, 1); flash.visible = false; H.gun.add(flash);
    // パラシュート
    const chute = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    dome.scale.set(1, 0.5, 0.75); dome.position.y = 4.2; chute.add(dome);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.2, 1.9, 0), new THREE.Vector3(-2.3, 4.3, 0), new THREE.Vector3(0.2, 1.9, 0), new THREE.Vector3(2.3, 4.3, 0),
      new THREE.Vector3(-0.2, 1.9, 0), new THREE.Vector3(0, 4.3, -1.7), new THREE.Vector3(0.2, 1.9, 0), new THREE.Vector3(0, 4.3, 1.7)]),
    new THREE.LineBasicMaterial({ color: "#333" }));
    chute.add(lines);
    chute.visible = false;
    g.add(chute);
    // 名前とスタンプ
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(name || "?", tagColor), transparent: true, depthWrite: false }));
    tag.scale.set(1.3, 0.32, 1); tag.position.y = 2.25;
    g.add(tag);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    bubble.scale.set(1.5, 1.24, 1); bubble.position.y = 2.95; bubble.visible = false;
    g.add(bubble);
    this.scene.add(g);
    P = { g, H, flash, chute, tag, bubble, av, name, tagColor, bubbleT: 0, walk: 0, lx: 0, lz: 0, hold: -1 };
    this.people.set(slot, P);
    return P;
  }
  removePerson(slot) { const P = this.people.get(slot); if (P) { this.scene.remove(P.g); this.people.delete(slot); } }

  /** 見えているその人の銃口の位置（弾の線の始まり）。銃を持っていない・見えていないなら null */
  muzzleOf(slot) {
    const P = this.people.get(slot);
    if (!P || !P.g.visible || !P.H.gun.visible) return null;
    const gm = P.H.gun.children.find(c => c.userData.muzzle);
    if (!gm) return null;
    P.g.updateMatrixWorld(true);
    const m = gm.userData.muzzle;
    return gm.localToWorld(new THREE.Vector3(m.x, m.y, m.z));
  }

  /** f: { x,y,z,yaw,pitch,st,hold,fl,eq } / show: 体を見せるか（自分の一人称では消す） */
  updatePerson(slot, av, name, f, show, dt, camPos) {
    const P = this.person(slot, av, name, f.tag || "#fff");
    const vis = show && f.st >= 2 && f.st <= 5;
    P.g.visible = vis;
    if (!vis) return;
    P.g.position.set(f.x, f.y, f.z);
    P.g.rotation.set(0, f.yaw, 0);
    const dead = f.st === 5;
    // 持っている銃
    if (P.hold !== f.hold) {
      P.hold = f.hold;
      for (const c of [...P.H.gun.children]) if (c !== P.flash) P.H.gun.remove(c);
      if (f.hold > 0 && f.hold !== W_GRENADE) P.H.gun.add(gunMesh(f.hold, stickerTex));
    }
    dressPerson(P.H, f.eq);
    // 歩き
    const sp = Math.hypot(f.x - P.lx, f.z - P.lz) / Math.max(dt, 0.001);
    P.lx = f.x; P.lz = f.z;
    const moving = f.st === 4 && sp > 0.5 && sp < 20;
    if (moving) P.walk += dt * Math.min(sp, 7) * 1.8;
    P.amp = (P.amp ?? 0) + ((moving ? Math.min(1, sp / 5) : 0) - (P.amp ?? 0)) * Math.min(1, dt * 8);
    posePerson(P.H, f, P.walk, P.amp);
    P.chute.visible = f.st === 3;
    P.flash.visible = !!(f.fl & 32) && Math.random() < 0.7;
    if (P.flash.visible) { const gm = P.H.gun.children.find(c => c.userData.muzzle); if (gm) P.flash.position.copy(gm.userData.muzzle); }
    // 名前は近くだけ
    const d = camPos ? camPos.distanceTo(P.g.position) : 0;
    P.tag.visible = !dead && d < 35;
    if (P.bubbleT > 0) { P.bubbleT -= dt; P.bubble.visible = P.bubbleT > 0; P.bubble.position.y = 2.95 + Math.max(0, P.bubbleT - 2.6) * 0.8; }
    if (dead) { P.tag.visible = false; P.bubble.visible = false; }
  }
  showStamp(slot, idx) {
    const P = this.people.get(slot);
    if (!P) return;
    P.bubble.material.map = stickerTex(STAMPS[idx]);
    P.bubble.material.needsUpdate = true;
    P.bubbleT = 3;
    P.bubble.visible = true;
  }

  // ---- 一人称の銃 ----
  /** 一人称の銃（付いているアタッチメントごとに作って覚えておく） */
  viewModel(hold, att = [0, 0, 0, 0]) {
    const key = hold + ":" + att.join(",");
    if (!this.vModels.has(key)) this.vModels.set(key, buildViewModel(hold, att));
    for (const [k, m] of this.vModels) { m.visible = k === key; if (m.parent !== this.vRoot) this.vRoot.add(m); }
    return this.vModels.get(key);
  }

  // ---- 効果 ----
  tracer(ox, oy, oz, ex, ey, ez, faint = false) {
    const len = Math.hypot(ex - ox, ey - oy, ez - oz);
    if (len < 0.5) return;
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    m.position.set(ox, oy, oz);
    m.lookAt(ex, ey, ez);
    const w = faint ? 0.45 : 1;   // サプレッサー付きは細く薄い
    m.scale.set(w, w, len);
    this.scene.add(m);
    this.fx.push({ o: m, t: 0, life: 0.07, kind: "tracer", base: faint ? 0.25 : 0.9 });
  }
  puff(x, y, z, color = "#d9c9a3", size = 0.5, life = 0.35) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color, transparent: true, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    this.scene.add(s);
    this.fx.push({ o: s, t: 0, life, kind: "puff", size });
  }
  explosion(x, y, z) {
    for (let i = 0; i < 10; i++) this.puff(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, i < 4 ? "#ffb347" : "#7a7268", 2 + Math.random() * 2.5, 0.6 + Math.random() * 0.6);
    const light = new THREE.PointLight("#ffb347", 60, 30, 1.5);
    light.position.set(x, y + 1, z);
    this.scene.add(light);
    this.fx.push({ o: light, t: 0, life: 0.35, kind: "light" });
  }
  setGrenades(list) {
    const seen = new Set();
    for (const [id, x, y, z] of list) {
      seen.add(id);
      let m = this.gren.get(id);
      if (!m) {
        m = itemMesh(24, stickerTex);   // 落ちているグレネードと同じ形
        m.scale.setScalar(1.4);
        this.scene.add(m); this.gren.set(id, m);
      }
      m.position.set(x, y, z);
      m.rotation.x += 0.15; m.rotation.z += 0.1;
    }
    for (const [id, m] of this.gren) if (!seen.has(id)) { this.scene.remove(m); this.gren.delete(id); }
  }

  setZone(Z) {
    const [cx, cz, r, nx, nz, nr] = Z;
    this.zoneMesh.visible = r > 0.5;
    this.zoneMesh.position.set(cx, 200, cz);
    this.zoneMesh.scale.set(Math.max(r, 0.01), 900, Math.max(r, 0.01));
    this.nextMesh.visible = nr > 0.5 && nr < r - 1;
    this.nextMesh.position.set(nx, 200, nz);
    this.nextMesh.scale.set(Math.max(nr, 0.01), 900, Math.max(nr, 0.01));
  }
  setPlane(PL) {
    this.plane.visible = !!PL[3];
    this.plane.position.set(PL[0], PLANE_ALT + 3, PL[1]);
    this.plane.rotation.set(0, PL[2], 0);
  }

  frame(dt, view) {
    // 効果を進める
    for (const f of this.fx) {
      f.t += dt;
      const k = f.t / f.life;
      if (f.kind === "tracer") f.o.material.opacity = (f.base ?? 0.9) * (1 - k);
      else if (f.kind === "puff") { f.o.material.opacity = 0.9 * (1 - k); const s = f.size * (1 + k * 1.5); f.o.scale.set(s, s, 1); }
      else if (f.kind === "light") f.o.intensity = 60 * (1 - k);
      if (k >= 1) { this.scene.remove(f.o); f.o.material?.dispose?.(); f.dead = true; }
    }
    this.fx = this.fx.filter(f => !f.dead);
    // 落ちているもの: 近くだけ形を作って回す。もっと近くは名前
    const t = performance.now() / 1000;
    const cp = this.camera.position;
    for (const L of this.loot.values()) {
      const dx = L.l.x - cp.x, dz = L.l.z - cp.z, d2 = dx * dx + dz * dz;
      const near = d2 < 70 * 70;
      if (near && !L.obj) L.obj = this.lootObj(L);
      if (L.obj) {
        L.obj.visible = near;
        if (near) { const m = L.obj.userData.spin; m.rotation.y = t * 0.8 + L.ph; m.position.y = 0.06 + Math.sin(t * 2 + L.ph) * 0.03; }
      }
      const lab = d2 < 6 * 6 && Math.abs(L.l.y - cp.y) < 4;
      if (lab && !L.label) L.label = this.lootLabel(L);
      if (L.label) L.label.visible = lab;
    }
    for (const a of this.padArrows || []) { a.rotation.y = t * 2; a.position.y += Math.sin(t * 4) * 0.004; }
    // 補給物資: 着地したら赤い煙
    for (const D of this.drops.values()) {
      if (D.landed && (D.smokeT -= dt) <= 0) {
        D.smokeT = 0.25;
        const p = D.g.position;
        this.puff(p.x + (Math.random() - 0.5) * 0.6, p.y + 1.3 + Math.random() * 2, p.z + (Math.random() - 0.5) * 0.6, "#ff5a4a", 1.5, 2.2);
      }
    }
    // 影は見ている場所のまわりだけ
    this.sun.position.set(cp.x + 60, cp.y + 120, cp.z + 30);
    this.sun.target.position.set(cp.x, cp.y - 10, cp.z);
    this.r.clear();
    this.r.render(this.scene, this.camera);
    if (view) {
      this.r.clearDepth();
      this.r.render(this.vScene, this.vCam);
    }
  }
}

function mergeCones() {
  // 段々の針葉樹（2 段の円すいを 1 つの形に）
  const a = new THREE.ConeGeometry(1.8, 3, 7).translate(0, 0, 0);
  const b = new THREE.ConeGeometry(1.3, 2.6, 7).translate(0, 1.6, 0);
  const pos = [...a.toNonIndexed().attributes.position.array, ...b.toNonIndexed().attributes.position.array];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function flashTex() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

/** 一人称の銃（models.js の銃に手と袖を足す）。銃口は userData.muzzle */
function buildViewModel(hold, att) {
  const g = new THREE.Group();
  const skin = mat("#f0c9a0"), sleeve = mat("#5b6b4a");
  const B = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const hand = (x, y, z) => { B(0.07, 0.08, 0.1, x, y, z, skin); B(0.09, 0.09, 0.3, x, y - 0.02, z + 0.2, sleeve); };
  if (hold === 0) {
    hand(-0.14, -0.02, -0.05); hand(0.14, -0.02, -0.05);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.3);
    return g;
  }
  if (hold === W_GRENADE) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat("#3d6b3a"));
    s.position.set(0.02, 0.02, -0.1); g.add(s);
    hand(0.02, -0.04, -0.05);
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.2);
    return g;
  }
  const gun = gunMesh(hold, stickerTex, att);
  g.add(gun);
  hand(0.0, -0.07, 0.02);
  hand(-0.01, -0.03, -0.32);
  g.userData.muzzle = gun.userData.muzzle.clone();
  g.userData.sightY = gun.userData.sightY;
  return g;
}

export { THREE };
