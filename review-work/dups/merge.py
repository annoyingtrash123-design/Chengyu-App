"""Merge duplicate entries: (headword, duplicate) pairs. The duplicate becomes a variant of the headword."""
import json, glob, os
PAIRS = [
    ("三寸不烂之舌", "三寸之舌"), ("独具匠心", "匠心独运"), ("翻天覆地", "天翻地覆"), ("请君入瓮", "引君入瓮"),
    ("当头一棒", "当头棒喝"), ("糊里糊涂", "稀里糊涂"), ("身临其境", "亲临其境"), ("远水解不了近渴", "远水不解近渴"),
    ("失去理智", "丧失理智"), ("武大郎开店——比我高的不要", "武大郎开店——不容大个儿"),
]
files = {f: (open(f).read(),) for f in sorted(glob.glob('data/entries/*.json'))}
files = {f: (raw, json.loads(raw)) for f, (raw,) in files.items()}
by = {e['text']: (f, e) for f, (_, d) in files.items() for e in d}
changed = set()
ren = {}
for H, D in PAIRS:
    fh, h = by[H]; fd, d = by[D]
    forms = [D] + d.get('variants', [])
    h.setdefault('variants', [])
    for v in forms:
        if v != H and v not in h['variants']:
            h['variants'].append(v)
    for k, v in d.get('variant_kinds', {}).items():
        h.setdefault('variant_kinds', {})[k] = v
    for key in ('synonyms', 'antonyms'):
        cur = h.setdefault(key, [])
        for t in d.get(key, []):
            if t not in cur and t not in (H, D) and t not in h['variants']:
                cur.append(t)
    other = {'synonyms': 'antonyms', 'antonyms': 'synonyms'}
    for key in ('synonyms', 'antonyms'):
        h[key] = [t for t in h[key] if t not in (H, D) and t not in h['variants'] and not (key == 'antonyms' and t in h['synonyms'])]
    for t in d.get('themes', []):
        if t not in h.setdefault('themes', []):
            h['themes'].append(t)
    h['frequency'] = min(h['frequency'], d['frequency'])
    files[fd][1].remove(d)
    changed |= {fh, fd}
    for v in forms:
        ren[v] = H
# point every other entry's links at the headword
for f, (_, data) in files.items():
    for e in data:
        for key in ('synonyms', 'antonyms'):
            lst = e.get(key, [])
            new = []
            for t in lst:
                t2 = ren.get(t, t)
                if t2 != e['text'] and t2 not in new and t2 not in e.get('variants', []):
                    new.append(t2)
            if new != lst:
                e[key] = new; changed.add(f)
for f in changed:
    raw, data = files[f]
    if not data:
        os.remove(f); print("removed empty", f); continue
    s = json.dumps(data, ensure_ascii=False, indent=2)
    if raw.endswith("\n"): s += "\n"
    open(f, 'w').write(s)
# label hand lists
p = 'data/source/label_lists.json'; s = open(p).read()
for v, H in ren.items():
    s = s.replace(f'"{v}"', f'"{H}"')
open(p, 'w').write(s)
print("merged", len(PAIRS), "files", len(changed))
