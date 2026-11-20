// 持ち物の欄に出す、アイテムの 3D の絵。小さな描画用キャンバスで 1 回ずつ描いて画像（data URL）にし、覚えておく。
// ステッカーの印の画像が読めるのを待ってから描く。描けるまでは null を返す（呼んだ側は代わりの絵を出す）。

import * as THREE from "../vendor/three.module.min.js";
import { itemMesh } from "./models.js";
import { stickerTex, stickerReady } from "./render.js";
import { itemInfo, STK, HEALS } from "./items.js";

const W = 192, H = 168;   // 所持品メニューで大きく出しても粗くならない大きさ
const urls = new Map();       // code → data URL
export let iconVersion = 0;   // 絵ができるたびに増える（表示側が描き直すきっかけ）
const pending = new Set();
let R = null, scene = null, cam = null, queue = Promise.resolve();

function setup() {
  R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(W, H, false);
  R.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#556070", 2.2));
  const sun = new THREE.DirectionalLight("#fff6e0", 2.2);
  sun.position.set(1.5, 2.5, 2);
  scene.add(sun);
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
}

/** そのアイテムの絵の URL（まだなら null を返し、裏で描き始める） */
export function itemIconUrl(code) {
  if (urls.has(code)) return urls.get(code);
  if (!pending.has(code)) {
    pending.add(code);
    queue = queue.then(() => draw(code)).catch(() => { /* 描けなければステッカーのまま */ });
  }
  return null;
}

async function draw(code) {
  if (!R) setup();
  const obj = itemMesh(code, stickerTex, true);
  // 印のステッカーが読めるまで待つ
  const it = itemInfo(code);
  const mark = it.kind === "heal" ? HEALS[it.sub].stk : it.kind === "helmet" ? STK.fukanou : it.kind === "vest" ? STK.zazen : it.kind === "pack" ? STK.junbi : it.stk;
  if (mark) await stickerReady(mark);
  await new Promise(r => setTimeout(r, 30));
  // 斜め前から、ちょうど収まる大きさで
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.62;
  cam.left = -r * (W / H); cam.right = r * (W / H); cam.top = r; cam.bottom = -r;
  cam.position.copy(c).add(new THREE.Vector3(0.55, 0.5, 1).normalize().multiplyScalar(5));
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  scene.add(obj);
  R.render(scene, cam);
  urls.set(code, R.domElement.toDataURL("image/png"));
  iconVersion++;
  scene.remove(obj);
}
