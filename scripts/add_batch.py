#!/usr/bin/env python3
"""Add a batch of hand-written entries to data/entries/.

Fills in the boring, mechanical fields so they're always consistent:
  - id         toneless pinyin slug (made unique if needed)
  - frequency  from the THUOCL rank: top 600 → 1 (core), top 3000 → 2 (common), else 3,
               unless the draft sets it explicitly (needed for 俗语/歇后语/惯用语 etc.)
  - kind       defaults to "chengyu"
Refuses duplicates of existing entries or their variants.

    python3 scripts/add_batch.py drafts.json data/entries/p1-001.json
"""
import json
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent


def slug(pinyin: str) -> str:
    s = unicodedata.normalize("NFD", pinyin.replace("ü", "v"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    drafts_path, out_path = map(pathlib.Path, sys.argv[1:3])
    drafts = json.loads(drafts_path.read_text(encoding="utf-8"))
    rank = {}
    for i, line in enumerate((ROOT / "data/source/thuocl/THUOCL_chengyu.txt").read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            rank.setdefault(line.split("\t")[0].strip(), i)
    existing = []
    for f in sorted((ROOT / "data/entries").glob("*.json")):
        if f.resolve() != out_path.resolve():
            existing += json.loads(f.read_text(encoding="utf-8"))
    texts = {e["text"] for e in existing}
    ids = {e["id"] for e in existing}
    out = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else []
    texts |= {e["text"] for e in out}
    ids |= {e["id"] for e in out}
    added = 0
    for d in drafts:
        if d["text"] in texts:
            print(f"skip duplicate: {d['text']}")
            continue
        e = {"id": "", "text": d["text"], "pinyin": d["pinyin"], "kind": d.get("kind", "chengyu")}
        base = slug(d["text"] if False else d["pinyin"])
        if e["kind"] in ("xiehouyu", "suyu", "mingju") and len(base) > 40:
            base = "-".join(base.split("-")[:6])
        i, cand = 2, base
        while cand in ids:
            cand = f"{base}-{i}"
            i += 1
        e["id"] = cand
        r = rank.get(d["text"])
        e["frequency"] = d.get("frequency") or (1 if r and r <= 600 else 2 if r and r <= 3000 else 3)
        for k, v in d.items():
            if k not in e:
                e[k] = v
        out.append(e)
        texts.add(e["text"])
        ids.add(e["id"])
        added += 1
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"added {added} → {out_path} ({len(out)} in file)")


if __name__ == "__main__":
    main()
