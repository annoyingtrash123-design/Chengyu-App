"""Turn Opus decisions (positions in list-K.txt) into removal/move line numbers. Usage: python3 apply_decisions.py K "R positions" "M positions" """
import sys, json
k, R, M = sys.argv[1], sys.argv[2].split(), sys.argv[3].split()
lines = open(f'review-work/links/opus/list-{k}.txt').read().splitlines()
pick = lambda ps: [lines[int(p) - 1].split()[0] for p in ps]
out = {"remove": pick(R), "move": pick(M)}
json.dump(out, open(f'review-work/links/opus/decisions-{k}.json', 'w'))
print(k, "remove", len(out['remove']), "move", len(out['move']), "of", len(lines))
