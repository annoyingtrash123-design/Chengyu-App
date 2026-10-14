#!/usr/bin/env python3
"""Flag likely variant mistakes for a human to review (not a hard check).

  - two near-identical forms in one synonym/antonym list (稳如泰山 + 安如泰山)
  - a usage note that says 也作 / "Also written" when the entry has no `variants`
  - a synonym that is a near-form of the entry itself (绿水青山 → 青山绿水)

    python3 scripts/lint_variants.py [data/entries/p1-007.json ...]
"""
import glob
import json
import re
import sys


# Pairs already reviewed and confirmed to be distinct expressions.
DISTINCT = {
    frozenset(p)
    for p in [
        ("拉关系", "托关系"),
        ("翻天覆地", "天翻地覆"),
        ("截然不同", "迥然不同"),
        ("大惑不解", "迷惑不解"),
        ("荒无人烟", "渺无人烟"),
        ("悠然自得", "怡然自得"),
        ("巧夺天工", "巧匠天工"),
        ("稀里糊涂", "糊里糊涂"),
    ]
}


def near(a: str, b: str) -> bool:
    if a == b or frozenset((a, b)) in DISTINCT:
        return False
    if sorted(a) == sorted(b):
        return True
    return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1


files = sys.argv[1:] or sorted(glob.glob("data/entries/*.json"))
# Every recorded form → its headword, so two forms of one entry are caught too.
main_of = {}
for f in glob.glob("data/entries/*.json"):
    for e in json.load(open(f, encoding="utf-8")):
        for form in [e["text"], *e.get("variants", [])]:
            main_of.setdefault(form, e["text"])
found = 0
for f in files:
    for e in json.load(open(f, encoding="utf-8")):
        t = e["text"]
        for key in ("synonyms", "antonyms"):
            items = e.get(key, [])
            for i, a in enumerate(items):
                if key == "synonyms" and sorted(a) == sorted(t) and near(a, t):
                    print(f"{f}: {t}: {key} {a} looks like a variant of the entry itself")
                    found += 1
                if main_of.get(a) == t and a != t:
                    print(f"{f}: {t}: {key} {a} is a recorded variant of the entry itself")
                    found += 1
                for b in items[i + 1:]:
                    if a in main_of and main_of.get(a) == main_of.get(b):
                        print(f"{f}: {t}: {key} lists {a} and {b} — both forms of {main_of[a]}")
                        found += 1
                    elif near(a, b):
                        print(f"{f}: {t}: {key} lists {a} and {b} — variants of each other?")
                        found += 1
        notes = e["usage"]["zh"] + " " + e["usage"]["en"]
        if re.search(r"(也作|也写作|又作)[“\"「]|[Aa]lso written", notes) and not e.get("variants"):
            print(f"{f}: {t}: usage mentions another written form but `variants` is empty")
            found += 1
print(f"{found} to review")
