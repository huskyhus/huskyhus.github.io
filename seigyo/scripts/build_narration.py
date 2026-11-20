# /// script
# requires-python = ">=3.10"
# ///
"""content/narration/ch*.md を読み、ブラウザ用の content/narration/narration.js を書き出す。

index.html は file:// で開いても動く必要があり、そこでは fetch で JSON を読めないため、
`window.NARRATION = {...}` を代入する JS として出力する。同じ内容を narration.json にも書く。

実行: uv run scripts/build_narration.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ruby import split  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "content" / "narration"
ORDER = ["ch1", "ch2", "ch3", "ch4", "ch5a", "ch5b", "ch6"]


def parse(path: Path) -> dict:
    chapter: dict = {"scenes": []}
    scene = step = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            cid, part, *title = line[2:].split(" ", 2)
            chapter.update(id=cid, part=part, title=" ".join(title))
        elif line.startswith("## "):
            sid, title = line[3:].split(" ", 1)
            scene = {"id": sid, "title": title, "steps": []}
            chapter["scenes"].append(scene)
        elif line.startswith("### "):
            step = {"id": line[4:].strip(), "raw": [], "defs": []}
            scene["steps"].append(step)
        elif m := re.match(r"<!-- def (\S+) -->", line):
            step["defs"].append(m.group(1))
        elif line.strip() and step is not None:
            step["raw"].append(line.strip())
    for sc in chapter["scenes"]:
        for st in sc["steps"]:
            raw = "".join(st.pop("raw"))
            st["text"], st["yomi"] = split(raw)  # 字幕と、音声合成に渡す読み
            expected = f"{chapter['id']}/{sc['id']}/"
            if not st["id"].startswith(expected):
                raise SystemExit(f"{path.name}: ステップ ID {st['id']} が {expected} で始まっていない")
    return chapter


chapters = {cid: parse(DIR / f"{cid}.md") for cid in ORDER if (DIR / f"{cid}.md").exists()}
out = {"order": [c for c in ORDER if c in chapters], "chapters": chapters}
text = json.dumps(out, ensure_ascii=False, indent=1)
(DIR / "narration.json").write_text(text + "\n", encoding="utf-8")
(DIR / "narration.js").write_text(
    "// scripts/build_narration.py が生成。手で編集しない。\nwindow.NARRATION = " + text + ";\n", encoding="utf-8"
)
n = sum(len(sc["steps"]) for c in chapters.values() for sc in c["scenes"])
print(f"{len(chapters)} 章、{n} ステップを書き出した")
