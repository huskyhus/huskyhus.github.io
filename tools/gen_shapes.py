# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "opencv-python-headless", "shapely>=2.1"]
# ///
"""stickers/*.png のアルファから Planck.js 用の衝突形状を生成する。

  uv run tools/gen_shapes.py [--preview out.png]

出力: data/shapes.json
  座標は画像中心を原点とした px 単位、y 軸は下向き（画像と同じ）。
  pieces: 凸多角形（頂点数 <= MAX_VERTS）のリスト。Planck.js の PolygonShape は
  内部で凸包を取り直すので、y 軸を反転しても頂点順は気にしなくてよい。
  outlines: 単純化した外形（デバッグ描画用）。
"""
import argparse
import json
import math
import pathlib

import cv2
import numpy as np
import shapely
from PIL import Image
from shapely.geometry import Polygon

ROOT = pathlib.Path(__file__).resolve().parent.parent / "hustower"   # ゲーム本体のフォルダ
SRC = ROOT / "stickers"
OUT = ROOT / "data" / "shapes.json"

ALPHA_THRESHOLD = 128      # これ以上の不透明度を実体とみなす
OPEN_RADIUS = 2            # 細い毛羽立ち（集中線など）を除去する半径 px
MIN_ISLAND_RATIO = 0.015   # 全体面積に対してこれ未満の島は衝突形状から除外
MAX_OUTLINE_VERTS = 40     # 外形 1 つあたりの最大頂点数
MAX_VERTS = 8              # 凸パーツ 1 つあたりの最大頂点数（Box2D 系の制約）
MIN_PIECE_AREA = 12.0      # これ未満の凸パーツは捨てる（px^2）
MIN_EDGE = 2.0             # これより短い辺の頂点は統合する px
MIN_WIDTH = 4.0            # これより薄いパーツは捨てる px
CONCAVITY_TOL = 3.0        # この深さ以下の凹みは凸包で埋める px


def load_mask(path):
    a = np.array(Image.open(path).convert("RGBA"))[..., 3]
    mask = (a >= ALPHA_THRESHOLD).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * OPEN_RADIUS + 1,) * 2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
    return mask, a.shape


def outlines(mask):
    """外側輪郭のみ（穴は埋める）を、面積の大きい順に返す。"""
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = sorted(cs, key=cv2.contourArea, reverse=True)
    total = sum(cv2.contourArea(c) for c in cs)
    return [c for c in cs if cv2.contourArea(c) >= total * MIN_ISLAND_RATIO]


def simplify(contour):
    """頂点数が上限以下かつ単純多角形になるまで許容誤差を広げる。"""
    eps = 1.0
    while True:
        pts = cv2.approxPolyDP(contour, eps, True).reshape(-1, 2).astype(float)
        poly = Polygon(pts)
        if len(pts) <= MAX_OUTLINE_VERTS and len(pts) >= 3 and poly.is_valid:
            return poly
        eps *= 1.25


def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def is_convex(pts):
    n = len(pts)
    sign = 0
    for i in range(n):
        c = cross(pts[i], pts[(i + 1) % n], pts[(i + 2) % n])
        if abs(c) < 1e-9:
            continue
        s = 1 if c > 0 else -1
        if sign == 0:
            sign = s
        elif s != sign:
            return False
    return True


def drop_collinear(pts):
    out = []
    n = len(pts)
    for i in range(n):
        if abs(cross(pts[i - 1], pts[i], pts[(i + 1) % n])) > 1e-6:
            out.append(pts[i])
    return out


def area(pts):
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                     for i in range(len(pts)))


def exact_convex_pieces(poly):
    """制約付きドロネー三角形分割 → Hertel-Mehlhorn（共有辺で凸を保つ限りマージ）。"""
    tris = shapely.constrained_delaunay_triangles(poly)
    pieces = []
    for t in tris.geoms:
        pts = [tuple(p) for p in list(t.exterior.coords)[:-1]]
        if area(pts) < 0:
            pts.reverse()
        if abs(area(pts)) > 1e-6:
            pieces.append(pts)

    def try_merge(a, b):
        # 共有辺 (u,v) を探す: a に u->v、b に v->u
        for i in range(len(a)):
            u, v = a[i], a[(i + 1) % len(a)]
            for j in range(len(b)):
                if b[j] == v and b[(j + 1) % len(b)] == u:
                    ra = a[i + 1:] + a[:i + 1]           # v ... u
                    rb = b[j + 1:] + b[:j + 1]           # u ... v
                    merged = drop_collinear(ra + rb[1:-1])
                    return merged if is_convex(merged) else None
        return None

    changed = True
    while changed:
        changed = False
        pieces.sort(key=area, reverse=True)
        for i in range(len(pieces)):
            for j in range(i + 1, len(pieces)):
                m = try_merge(pieces[i], pieces[j])
                if m:
                    pieces[i] = m
                    del pieces[j]
                    changed = True
                    break
            if changed:
                break
    return pieces


def hull_pts(geom):
    h = geom.convex_hull
    pts = [tuple(p) for p in list(h.exterior.coords)[:-1]]
    return pts if area(pts) > 0 else pts[::-1]


def bulge(hull, shape):
    """hull が元の形 shape から外にはみ出す最大距離。"""
    g = hull.difference(shape)
    if g.is_empty:
        return 0.0
    # 頂点は輪郭上に乗りがちなので、辺上の点も含めて測る
    pts = shapely.points(shapely.get_coordinates(shapely.segmentize(g, 1.0)))
    return float(shapely.distance(shape, pts).max())


def approx_merge(pieces, shape):
    """隣接パーツの凸包が元の形から CONCAVITY_TOL px 以内しかはみ出さないならマージする。
    浅い凹みを吸収して細長いスリバーをなくす（衝突形状がわずかに膨らむ）。"""
    polys = [Polygon(p) for p in pieces]
    while True:
        best = None
        for i in range(len(polys)):
            for j in range(i + 1, len(polys)):
                a, b = polys[i], polys[j]
                if a.distance(b) > 0.5:
                    continue
                hull = shapely.union(a, b).convex_hull
                depth = bulge(hull, shape)
                if depth <= CONCAVITY_TOL and (best is None or depth < best[0]):
                    best = (depth, i, j, hull)
        if best is None:
            break
        _, i, j, hull = best
        polys[i] = hull
        del polys[j]
    return [drop_collinear(hull_pts(p)) for p in polys]


def split_convex(pts):
    """頂点数が MAX_VERTS を超える凸多角形を、短い対角線で再帰的に二分する。"""
    n = len(pts)
    if n <= MAX_VERTS:
        return [pts]
    half = n // 2
    i = min(range(n), key=lambda k: math.dist(pts[k], pts[(k + half) % n]))
    j = (i + half) % n
    a = [pts[(i + k) % n] for k in range(half + 1)]
    b = [pts[(j + k) % n] for k in range(n - half + 1)]
    return split_convex(a) + split_convex(b)


def min_width(pts):
    """凸多角形の最小幅（各辺から最も遠い頂点までの距離の最小値）。"""
    best = math.inf
    n = len(pts)
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        L = math.dist(p, q)
        if L < 1e-9:
            continue
        far = max(abs(cross(p, q, r)) / L for r in pts)
        best = min(best, far)
    return best


def convex_decompose(poly):
    pieces = approx_merge(exact_convex_pieces(poly), poly)
    return [s for p in pieces for s in split_convex(p)]


def clean_piece(pts):
    """短すぎる辺を潰し、小さすぎる・細すぎるパーツを捨てる。"""
    out = []
    for p in pts:
        if not out or math.dist(out[-1], p) >= MIN_EDGE:
            out.append(p)
    if len(out) > 1 and math.dist(out[0], out[-1]) < MIN_EDGE:
        out.pop()
    out = drop_collinear(out)
    if len(out) < 3 or area(out) < MIN_PIECE_AREA or min_width(out) < MIN_WIDTH:
        return None
    return out


def process(path):
    mask, (h, w) = load_mask(path)
    cx, cy = w / 2, h / 2
    pieces, outlines_out = [], []
    for c in outlines(mask):
        poly = simplify(c)
        outlines_out.append([[round(x - cx, 2), round(y - cy, 2)] for x, y in list(poly.exterior.coords)[:-1]])
        for p in convex_decompose(poly):
            p = clean_piece(p)
            if p:
                pieces.append([[round(x - cx, 2), round(y - cy, 2)] for x, y in p])
    total_area = sum(abs(area(p)) for p in pieces)
    return {
        "file": f"stickers/{path.name}",
        "width": w,
        "height": h,
        "area": round(total_area, 1),
        "outlines": outlines_out,
        "pieces": pieces,
    }


def preview(shapes, out):
    cols = 6
    W, H = shapes[0]["width"], shapes[0]["height"]
    rows = (len(shapes) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * W, rows * H), (40, 40, 40))
    for i, s in enumerate(shapes):
        im = Image.open(ROOT / s["file"]).convert("RGBA")
        bg = Image.new("RGBA", im.size, (40, 40, 40, 255))
        bg.alpha_composite(im)
        arr = np.array(bg.convert("RGB"))[:, :, ::-1].copy()
        arr = (arr * 0.55).astype(np.uint8)
        cx, cy = s["width"] / 2, s["height"] / 2
        rng = np.random.default_rng(i)
        for p in s["pieces"]:
            pts = np.array([[x + cx, y + cy] for x, y in p], np.int32)
            color = tuple(int(v) for v in rng.integers(80, 256, 3))
            cv2.polylines(arr, [pts], True, color, 1, cv2.LINE_AA)
        for o in s["outlines"]:
            pts = np.array([[x + cx, y + cy] for x, y in o], np.int32)
            cv2.polylines(arr, [pts], True, (0, 0, 255), 2, cv2.LINE_AA)
        cv2.putText(arr, f"{i}:{len(s['pieces'])}", (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        sheet.paste(Image.fromarray(arr[:, :, ::-1]), ((i % cols) * W, (i // cols) * H))
    sheet.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="輪郭とパーツを重ねた確認用 PNG の出力先")
    args = ap.parse_args()

    shapes = [process(p) for p in sorted(SRC.glob("*.png"))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"units": "px", "origin": "image-center", "yAxis": "down",
                               "stickers": shapes}, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    for s in shapes:
        print(f"{s['file']:28s} outlines={len(s['outlines'])} pieces={len(s['pieces']):2d} "
              f"maxVerts={max(len(p) for p in s['pieces'])} "
              f"minWidth={min(min_width(p) for p in s['pieces']):5.1f} area={s['area']}")
    print(f"wrote {OUT.relative_to(ROOT)}")
    if args.preview:
        preview(shapes, args.preview)


if __name__ == "__main__":
    main()
