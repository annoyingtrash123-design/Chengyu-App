# Review working files

Working files for the content checks after the November 2026 review, kept in the repo so a container reset can't
lose them. Nothing here ships with the app.

- `links/` — synonym/antonym review: the brief, the batch generator (`make_link_batches.py`, rebuilds the 14 batches
  sent to the owner for Grok/Gemini, numbered 1–35110), and the replies received.
- `stars/` — star upgrade check (upgrades only): the brief, the candidate order (`A_ids.json` ★★→★★★,
  `B_ids.json` ★→★★), Sonnet's picks (`out-*.txt`, line numbers into those lists) and the resulting `plan.json`.
