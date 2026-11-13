# Star rating upgrade check

S = /tmp/claude-0/-home-user-Chengyu-App/1260a1bd-b7ee-5671-be37-c173620f1b23/scratchpad/stars

A Chinese idiom dictionary for English-speaking learners rates how common each expression is:
**★★★ Core** — nearly every educated adult native speaker knows it and would use or meet it in everyday life, school
or the media. **★★ Common** — most educated adults recognise it and meet it now and then. **★ Uncommon** — literary,
specialised, regional or rarely heard.

The owner wants a coherency check that only ever **raises** a rating: ★ → ★★, or ★★ → ★★★. Never lower anything.
Do not edit anything outside S, do not run git.

Your file is one of: A1.txt, A2.txt (each line is now ★★; decide whether it should be ★★★) or B1.txt, B2.txt,
B3.txt (each line is now ★; decide whether it should be ★★). Each line:
`n. expression — type — corpus N — short meaning`.
"corpus N" is its count in a large modern Chinese corpus (THUOCL, 成语 only; other types show "n/a"). For reference,
among 成语: ★★★ ones have a median count of ~4,900 (lower quartile ~1,900); ★★ ones a median of ~700 (lower
quartile ~200); ★ ones a median of ~130. Use the count as strong evidence for 成语, but your own knowledge of
modern usage decides, especially for the other types. "exam/essay" marks expressions on exam or essay lists.

Calibration — current ratings that are about right (S/anchors.txt has more):
- 成语 ★★★ 力所能及 有备无患 层出不穷 心急如焚 · ★★ 好景不长 口吐莲花 明火执仗 · ★ 子为父隐 床头金尽 莫予毒也
- 俗语 ★★★ 三个臭皮匠，顶个诸葛亮 · 熟能生巧; ★★ 一分价钱一分货 · 酒逢知己千杯少
- 名句 ★★★ 谁知盘中餐，粒粒皆辛苦 · 床前明月光 kind of line every schoolchild recites; ★★ 举杯邀明月，对影成三人
- And ones that are clearly too low today (the kind you are looking for): 血浓于水 and 道高一尺，魔高一丈 at ★
  (both widely used → ★★).

Upgrade only when you are confident the expression is clearly more common than its current tier, i.e. it plainly
belongs with the calibration examples of the higher tier. If it is borderline, leave it. Expect a minority of lines
to need an upgrade; do not pad.

## Output
Write S/out-<your file name without .txt>.txt with one line per UPGRADE only, in input order:

    12 up
    57 up

Write it in pieces as you go (rewrite the whole file each time); when finished, add a last line `done`. If resumed,
continue after the last number written. Reply with how many lines you upgraded and 10 examples (expression + why).
