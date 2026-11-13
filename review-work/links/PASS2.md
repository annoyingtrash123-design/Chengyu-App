# Second opinion — brief for each Sonnet checker

A first reviewer flagged the links in your file as wrong. You are the independent second opinion: only links you
both reject get removed, so judge every line fresh and do not assume the flag is right.

Input: review-work/links/pass2/check-N.txt (the lead tells you N). Each line:
`n. ENTRY (short meaning) — SYN|ANT: ITEM (short meaning, or "not in this dictionary")`.
SYN = ITEM is listed as a synonym (近义词) of ENTRY; ANT = as an antonym (反义词).

Test: would a mainstream Chinese 近义词/反义词 dictionary (汉典, 百度汉语, a printed 成语词典) plausibly list ITEM for ENTRY?
KEEP: near-synonyms overlapping in the main sense (even if not exact, stronger/weaker, other register or kind — a
歇后语 or 俗语 can be a synonym of a 成语); classic antonym pairs (垂头丧气↔趾高气扬, 面不改色↔面红耳赤, 不学无术↔勤学苦练,
屡战屡败↔屡败屡战); a synonym of opposite tone with the same sense (能言善辩/巧舌如簧); a warning proverb ↔ the advice it
gives (SYN) or the fault it warns against (ANT): 欲速则不达 SYN 循序渐进, ANT 拔苗助长; plain words and phrases.
REMOVE: shares only a topic, image or situation; an "antonym" that is merely different or opposite only on a side
detail; a form of the entry itself, or part of it (谬以千里 under 差之毫厘，谬以千里); a garbled expression.
MOVE: clearly in the wrong list. If unsure, KEEP.

Output: review-work/links/pass2/out-N.txt, one line per input line, in order, using the input's number n:
`n keep` / `n remove` / `n move`. Rewrite the file every ~150 lines so nothing is lost; add `DONE` at the end. If the
file exists without DONE, continue after its last number. Do not edit anything else; do not run git.
Reply with counts of keep/remove/move.
