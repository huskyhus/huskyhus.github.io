# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""SNS でリンクを貼ったときに出るカード画像（OGP）を作る。

  uv run tools/gen_ogp.py

出力: hustower/ogp.png（600x600。X の summary カードは正方形で表示される）
透過のままだと黒背景で表示されることがあるので、ゲームと同じ空色の背景に載せる。
"""
import pathlib

from PIL import Image

GAME = pathlib.Path(__file__).resolve().parent.parent / "hustower"
STICKER = GAME / "stickers" / "744223954.png"   # 「不可能です！」
OUT = GAME / "ogp.png"
SIZE = 600
MARGIN = 40

TOP = (124, 198, 240)      # ゲームの空の色（render.js の skyColors と同じ）
BOTTOM = (214, 240, 252)


def main():
    bg = Image.new("RGBA", (SIZE, SIZE))
    for y in range(SIZE):
        t = y / (SIZE - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,)
        bg.paste(c, (0, y, SIZE, y + 1))

    st = Image.open(STICKER).convert("RGBA")
    st = st.crop(st.getbbox())   # 透明な余白を除く
    scale = (SIZE - MARGIN * 2) / max(st.size)
    st = st.resize((round(st.width * scale), round(st.height * scale)), Image.LANCZOS)
    bg.alpha_composite(st, ((SIZE - st.width) // 2, (SIZE - st.height) // 2))
    bg.convert("RGB").save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(GAME.parent)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
