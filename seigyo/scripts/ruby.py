"""ナレーション原稿の読み指定 {表記|よみ} を解く。build_narration.py と check_terms.py が使う。

- 括弧の深さを数えて対応する } を探すので、表記に e^{pt} のような波括弧を書ける。
- 表記とよみは最後の | で分ける。表記に |S| のような絶対値を書ける（よみには | を書かない）。
- 字幕では ^{...} と _{...} を、可能なら上付き・下付き文字に直す。
"""

SUP = dict(zip("0123456789+−-()abcdefghijklmnoprstuvwxyzABTn/=", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᵀⁿᐟ⁼"))
SUB = dict(zip("0123456789+−-()aeoxhklmnpstij", "₀₁₂₃₄₅₆₇₈₉₊₋₋₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼ"))


def _scripts(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c in "^_" and i + 1 < len(s) and s[i + 1] == "{":
            depth, j = 0, i + 1
            while j < len(s):
                depth += {"{": 1, "}": -1}.get(s[j], 0)
                if depth == 0:
                    break
                j += 1
            inner = s[i + 2 : j]
            table = SUP if c == "^" else SUB
            conv = inner.replace(" ", "")
            if all(ch in table for ch in conv):
                out.append("".join(table[ch] for ch in conv))
            else:
                out.append(("^" if c == "^" else "_") + "(" + inner + ")")
            i = j + 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def split(raw: str) -> tuple[str, str]:
    """(字幕, よみ) を返す。"""
    text, yomi, i = [], [], 0
    while i < len(raw):
        if raw[i] == "{":
            depth, j = 0, i
            while j < len(raw):
                depth += {"{": 1, "}": -1}.get(raw[j], 0)
                if depth == 0:
                    break
                j += 1
            if j >= len(raw):
                raise ValueError(f"閉じていない {{ : {raw[i:i + 40]}")
            inner = raw[i + 1 : j]
            k = inner.rfind("|")
            if k < 0:
                raise ValueError(f"よみが無い: {{{inner}}}")
            text.append(_scripts(inner[:k]))
            yomi.append(inner[k + 1 :])
            i = j + 1
        else:
            text.append(raw[i])
            yomi.append(raw[i])
            i += 1
    return "".join(text), "".join(yomi)
