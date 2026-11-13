# Duplicate-entry check — brief for the Sonnet checker

Owner's rule: variants are ONE entry — the headword is the most common form, other forms go in `variants`.
Each line in review-work/dups/candidates.txt pairs two entries that might be forms of the same expression:
`n. A [kind] (meaning) || B [kind] (meaning)`.

Decide: `same` = they are the same expression in two forms (a variant character, swapped order, an added/dropped
particle or word, a colloquial rewording of the same saying) with the same meaning, used interchangeably — e.g.
远水不解近渴 / 远水解不了近渴, 丧失理智 / 失去理智, 请君入瓮 / 引君入瓮; or `distinct` = two separate established
expressions that dictionaries list separately even if close in meaning (截然不同 / 迥然不同, 前仆后继 / 前赴后继,
因地制宜 / 因时制宜). A short idiom and the longer quotation or 歇后语 it comes from are `distinct`. If unsure: distinct.
For `same`, name the headword: the more common form.

Output review-work/dups/verdicts.txt, one line per input line, in order:
`n distinct` or `n same | HEADWORD`. Add `DONE` at the end. Do not edit anything else, do not run git.
Reply with the number of `same` pairs and list them.
