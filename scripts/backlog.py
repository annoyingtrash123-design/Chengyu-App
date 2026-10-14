#!/usr/bin/env python3
"""Content progress report for the dictionary.

Shows how many entries exist by type and frequency, which expressions from
the original master list (data/master_list.json) still need full entries, and
which synonyms/antonyms are referenced but not yet in the dictionary.

    python3 scripts/backlog.py            # full report
    python3 scripts/backlog.py --summary  # counts only (used in CI)
    python3 scripts/backlog.py --todo 50  # next 50 master-list items to write

Standard library only. The authoritative data checks live in the Rust tests
(core/src/validate.rs); this script is a planning aid.
"""

import argparse
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load_entries():
    entries = []
    for path in sorted((DATA / "entries").glob("*.json")):
        with path.open(encoding="utf-8") as f:
            items = json.load(f)
        if not isinstance(items, list):
            sys.exit(f"{path}: expected a JSON array")
        entries.extend(items)
    return entries


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--summary", action="store_true", help="print counts only")
    ap.add_argument("--todo", type=int, default=20, metavar="N", help="how many outstanding master-list items to show")
    args = ap.parse_args()

    entries = load_entries()
    texts = {e["text"] for e in entries} | {v for e in entries for v in e.get("variants", [])}
    by_kind = collections.Counter(e["kind"] for e in entries)
    by_freq = collections.Counter(e["frequency"] for e in entries)

    print(f"Entries: {len(entries)}")
    for kind in ("chengyu", "suyu", "xiehouyu", "guanyongyu", "phrase", "mingju"):
        print(f"  {kind:<11} {by_kind.get(kind, 0)}")
    names = {1: "core", 2: "common", 3: "literary"}
    print("  by frequency: " + ", ".join(f"{names[k]} {by_freq.get(k, 0)}" for k in (1, 2, 3)))

    master_path = DATA / "master_list.json"
    master = json.loads(master_path.read_text(encoding="utf-8")) if master_path.exists() else []
    outstanding = [m for m in master if m["text"] not in texts]
    print(f"Master list: {len(master) - len(outstanding)}/{len(master)} written, {len(outstanding)} to go")

    missing = sorted(
        {link for e in entries for link in e.get("synonyms", []) + e.get("antonyms", []) if link not in texts}
    )
    print(f"Linked expressions not yet in the dictionary: {len(missing)}")

    for name in ("phase1", "phase2", "phase3-chengyu"):
        qp = DATA / "queue" / f"{name}.json"
        if qp.exists():
            q = json.loads(qp.read_text(encoding="utf-8"))
            done = sum(1 for m in q if m["text"] in texts)
            print(f"  {name}: {done}/{len(q)} written")

    if args.summary:
        return
    if outstanding:
        print(f"\nNext {min(args.todo, len(outstanding))} from the master list:")
        for m in outstanding[: args.todo]:
            print(f"  {m['text']}  {m.get('pinyin', '')}")
    if missing:
        print("\nReferenced as synonym/antonym but missing:")
        print("  " + "、".join(missing))


if __name__ == "__main__":
    main()
