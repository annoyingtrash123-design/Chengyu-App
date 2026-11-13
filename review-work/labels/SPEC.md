# Label check — brief for each Sonnet checker

The dictionary tags each expression with labels (标签). Each line in your file proposes ADDING one label to one
expression that lacks it (proposed because its synonyms carry it, or because its meaning mentions diligence):
`n. EXPRESSION (meaning) — has: current labels — ADD? Label / 标签`.

Answer `yes` only if the label genuinely fits the expression's meaning, following the owner's rules: labels follow
the meaning, not the topic or imagery; the **side rule** — a label must not cover both sides of an opposition
(a laziness idiom never gets "Diligence & dedication"; a vice never gets "Positive character qualities");
there is no limit on labels per entry, so add it whenever it truly fits. If unsure, answer `no`.

Input: review-work/labels/check-N.txt. Output: review-work/labels/out-N.txt, one line per input line, in order:
`n yes` or `n no`. Rewrite the file every ~200 lines; add `DONE` at the end; if it exists without DONE, continue
after its last number. Do not edit anything else, do not run git. Reply with counts.
