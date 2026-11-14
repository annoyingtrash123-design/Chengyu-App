"""Record Opus label decisions: positions in list-K.txt that DO get the label. Usage: pick.py K "positions" """
import sys, json
k, Y = sys.argv[1], sys.argv[2].split()
lines = open(f'review-work/labels/opus/list-{k}.txt').read().splitlines()
ns = [int(lines[int(p) - 1].split()[0]) for p in Y]
json.dump(ns, open(f'review-work/labels/opus/yes-{k}.json', 'w'))
print(k, "add", len(ns), "of", len(lines))
