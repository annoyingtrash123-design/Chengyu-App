"""Rebuild the 14 synonym/antonym review batches (links-batch-NN.txt) exactly as sent to the owner.

Run from the repo root at commit d01e205 (or any later commit before link changes are applied):
    python3 review-work/links/make_link_batches.py OUT_DIR
Line numbers in the batches (1..35110) are what Grok/Gemini replies refer to.
"""
import json, glob, sys, os

out = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out, exist_ok=True)
E = {}
for f in sorted(glob.glob('data/entries/*.json')):
    for e in json.load(open(f)):
        E[e['id']] = e
form = {}
for e in E.values():
    for v in e.get('variants', []):
        form.setdefault(v, e['id'])
for e in E.values():
    form[e['text']] = e['id']

def m(e, n=80):
    s = e['meaning']['en']
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'

seen = set(); rows = []
for id in sorted(E):
    e = E[id]
    for L, code in (('synonyms', 'SYN'), ('antonyms', 'ANT')):
        for t in e.get(L, []):
            o = form.get(t)
            if o:
                k = (min(id, o), max(id, o), L)
                if k in seen:
                    continue
                seen.add(k)
                rows.append((id, code, t, f"{e['text']} ({m(e)}) — {code}: {t} ({m(E[o])})"))
            else:
                rows.append((id, code, t, f"{e['text']} ({m(e)}) — {code}: {t} (not in this dictionary)"))

head = open(os.path.join(os.path.dirname(__file__), 'batch_header.txt')).read()
size = (len(rows) + 13) // 14
man = []
for b in range(14):
    part = rows[b * size:(b + 1) * size]
    lines = []
    for j, r in enumerate(part):
        n = b * size + j + 1
        man.append({"n": n, "entry_id": r[0], "list": r[1], "item": r[2]})
        lines.append(f"{n}. {r[3]}")
    open(os.path.join(out, f"links-batch-{b + 1:02d}.txt"), "w").write(head.format(b=b + 1) + "\n".join(lines) + "\n")
json.dump(man, open(os.path.join(out, "manifest.json"), "w"), ensure_ascii=False)
print(len(rows), "pairs,", size, "per batch")
