# /// script
# requires-python = ">=3.10"
# ///
"""README と sketch.md、ナレーション原稿の整合を検査する。

1. README §5 の用語表と sketch.md 末尾の照合表が同じか。
2. README §3 と sketch.md の時間配分表が同じか。
3. sketch.md の講義本体で、各用語が定義の場所より前に出ていないか。
4. content/narration/*.md で同じことを調べる（定義の場所は <!-- def 定義N --> の印）。
5. 範囲外の語（カルマンフィルタ、LQG など）が決めた場所以外に出ていないか。

実行: uv run scripts/check_terms.py
"""
import re
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ruby import split  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
README = (ROOT / "README.md").read_text(encoding="utf-8")
SKETCH = (ROOT / "sketch.md").read_text(encoding="utf-8")
CHAPTERS = ["ch1", "ch2", "ch3", "ch4", "ch5a", "ch5b", "ch6"]
CHAPTER_PART = {"ch1": 1, "ch2": 2, "ch3": 3, "ch4": 4, "ch5a": 5, "ch5b": 5, "ch6": 6}
OUT_OF_SCOPE = ["カルマンフィルタ", "LQG", "離散時間", "サンプリング", "モデル予測", "MPC", "H∞ 制御", "H∞制御", "非線形制御"]
# 範囲外の語を出してよい場所（第5部の LQR の安定余裕の段落）
ALLOWED_OUT_OF_SCOPE = {"カルマンフィルタ", "LQG"}

errors: list[str] = []


def table_after(text: str, header: str) -> list[tuple[str, ...]]:
    """header を含む行から始まる Markdown 表の本体の行を返す。"""
    lines = text.splitlines()
    start = next(i for i, ln in enumerate(lines) if ln.startswith("|") and header in ln)
    rows = []
    for ln in lines[start + 2 :]:
        if not ln.startswith("|"):
            break
        rows.append(tuple(c.strip() for c in ln.strip("|").split("|")))
    return rows


# 1. 用語表
readme_terms = table_after(README, "定義する場所")
sketch_terms = table_after(SKETCH, "定義した場所")
norm = lambda rows: [(a, b.replace("（±2%）", "")) for a, b in rows]
readme_terms_cmp = [(a.replace("（±2%）", ""), b) for a, b in readme_terms]
if readme_terms_cmp != list(sketch_terms):
    errors.append("README §5 と sketch.md の用語表が一致しない")
    for r, s in zip(readme_terms_cmp, sketch_terms):
        if r != s:
            errors.append(f"  README: {r}\n  sketch: {s}")

# 2. 時間配分表
if table_after(README, "時刻（分）") != table_after(SKETCH, "時刻（分）"):
    errors.append("README §3 と sketch.md の時間配分表が一致しない")


def split_terms(cell: str) -> list[str]:
    out = []
    for t in cell.split("、"):
        t = t.replace("（±2%）", "")
        m = re.match(r"(.+?)（(.+?)）$", t)
        out += [m.group(1), m.group(2)] if m else [t]
    return [t.strip() for t in out if t.strip()]


def parse_location(loc: str) -> tuple[int, str | None]:
    """(部, 定義ラベル or None)。定義ラベルがあればその定義の位置、無ければ部の先頭が基準。"""
    part = int(re.search(r"第(\d)部", loc).group(1))
    if "定理" in loc:  # 「第6部の定理と定義20」のように定理の中で定義する語は、部の先頭を基準にする
        return part, None
    m = re.search(r"定義(\d+)", loc)
    return part, (f"定義{m.group(1)}" if m else None)


# 単独では誤検出の多い1文字の語は、文脈つきで調べる
SPECIAL = {"系": r"(?<![体関家直])系(?!列)", "極": r"(?<![積究])極(?!限|端|め|力|大|小|性)"}


def check(body: str, part_starts: dict[int, int], def_pos: dict[str, int], where: str) -> None:
    # 見出し（部・場面の題）は対象外。位置がずれないよう同じ長さの空白で塗りつぶす
    prose = re.sub(r"^#.*$", lambda m: " " * len(m.group()), body, flags=re.M)
    for cell, loc in readme_terms:
        part, label = parse_location(loc)
        if label:
            if label not in def_pos:
                continue  # まだ原稿が無い章
            anchor = def_pos[label]
        else:
            if part not in part_starts:
                continue
            anchor = part_starts[part]
            if "定義11の後" in loc:
                anchor = def_pos.get("定義11", anchor)
        for term in split_terms(cell):
            pat = SPECIAL.get(term, re.escape(term))
            m = re.search(pat, prose)
            if m and m.start() < anchor:
                line = body.count("\n", 0, m.start()) + 1
                ctx = body[max(0, m.start() - 20) : m.end() + 20].replace("\n", " ")
                errors.append(f"{where}:{line} 「{term}」が {loc} より前に出ている … {ctx}")


# 3. sketch.md の講義本体
body_start = SKETCH.index("## 第1部")
body_end = SKETCH.index("## 用語の定義箇所")
body = SKETCH[body_start:body_end]
part_starts = {int(m.group(1)): m.start() for m in re.finditer(r"^## 第(\d)部", body, re.M)}
def_pos = {f"定義{m.group(1)}": m.start() for m in re.finditer(r"\*\*定義(\d+)", body)}
check(body, part_starts, def_pos, "sketch.md(第1部からの行)")

# 5. 範囲外の語（sketch.md の講義本体）
for word in OUT_OF_SCOPE:
    for m in re.finditer(re.escape(word), body):
        in_part5 = part_starts[5] <= m.start() < part_starts[6]
        if not (word in ALLOWED_OUT_OF_SCOPE and in_part5):
            errors.append(f"sketch.md 範囲外の語「{word}」が許可されていない場所に出ている")

# 4. ナレーション原稿
narr_dir = ROOT / "content" / "narration"
texts, starts, pos = [], {}, 0
for ch in CHAPTERS:
    f = narr_dir / f"{ch}.md"
    if not f.exists():
        continue
    t = f.read_text(encoding="utf-8")
    t = "\n".join(" ".join(split(ln)) if "{" in ln else ln for ln in t.splitlines())  # 字幕とよみの両方を調べる
    starts.setdefault(CHAPTER_PART[ch], pos)
    texts.append(t)
    pos += len(t) + 1
narr = "\n".join(texts)
if narr:
    ndefs = {f"定義{m.group(1)}": m.start() for m in re.finditer(r"<!-- def 定義(\d+) -->", narr)}
    # 「定義N。」の文より前の印の位置を定義の始まりとみなす
    check(narr, starts, ndefs, "narration")
    ids = re.findall(r"^### (\S+)", narr, re.M)
    if len(ids) != len(set(ids)):
        errors.append("narration: ステップ ID が重複している")
    for word in OUT_OF_SCOPE:
        for m in re.finditer(re.escape(word), narr):
            in_part5 = 5 in starts and starts[5] <= m.start() < starts.get(6, len(narr))
            if not (word in ALLOWED_OUT_OF_SCOPE and in_part5):
                errors.append(f"narration: 範囲外の語「{word}」が許可されていない場所に出ている")

# 6. 用語集（content/glossary.js）
gfile = ROOT / "content" / "glossary.js"
if gfile.exists():
    import json

    src = gfile.read_text(encoding="utf-8")
    body_g = src[src.index("[", src.index("LECTURE.glossary")) : src.rindex("]") + 1]
    glossary = json.loads(body_g)
    narr_json = json.loads((narr_dir / "narration.json").read_text(encoding="utf-8"))
    order, step_text = [], {}
    for cid in narr_json["order"]:
        for sc in narr_json["chapters"][cid]["scenes"]:
            for st in sc["steps"]:
                order.append(st["id"])
                step_text[st["id"]] = st["text"] + st["yomi"]
    pos_of = {sid: i for i, sid in enumerate(order)}
    # (a) 用語表の語はすべて用語集にある
    for cell, _ in readme_terms:
        for term in split_terms(cell):
            if not any(term in g["term"] or term == g.get("match") for g in glossary):
                errors.append(f"glossary: 用語表の「{term}」が用語集に無い")
    # (b) at が実在し、そのステップの原稿に語が出る
    for g in glossary:
        if g["at"] not in pos_of:
            errors.append(f"glossary: 「{g['term']}」の at {g['at']} が原稿に無い")
        elif g.get("match", g["term"]) not in step_text[g["at"]]:
            errors.append(f"glossary: 「{g['term']}」の at {g['at']} の原稿に「{g.get('match', g['term'])}」が無い")
    # (c) 説明文に、その項目より後で定義する用語を使わない
    defined_at = []  # (用語表の語, 定義するステップの位置)
    for cell, _ in readme_terms:
        for term in split_terms(cell):
            g = next((g for g in glossary if term in g["term"] or term == g.get("match")), None)
            if g and g["at"] in pos_of:
                defined_at.append((term, pos_of[g["at"]]))
    for g in glossary:
        if g["at"] not in pos_of:
            continue
        here = pos_of[g["at"]]
        text = g["def"] + " " + g["meaning"]
        for term, p in defined_at:
            if p > here and re.search(SPECIAL.get(term, re.escape(term)), text):
                errors.append(f"glossary: 「{g['term']}」（{g['at']}）の説明に、後で定義する「{term}」が出ている")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print("OK: 用語表・時間配分表は一致、用語の順序違反なし、範囲外の語は許可した場所のみ、用語集も整合")
