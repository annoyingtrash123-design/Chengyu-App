# Synonym / antonym review — brief for each reviewer

You are checking the synonym (S) and antonym (A) lists of a Chinese idiom dictionary for English-speaking learners
(成语, 俗语, 歇后语, 惯用语, 四字词语 "phrase", 名句 "mingju"). The owner wants **wrong items removed, nothing else**:
there is no cap on list length, and you are not asked to add or rank anything. A second reviewer will check every
item you flag, so flag only what you are confident is wrong.

L = /tmp/claude-0/-home-user-Chengyu-App/1260a1bd-b7ee-5671-be37-c173620f1b23/scratchpad/links
Do not edit anything outside L/out/. Do not run git.

## Input
Your chunk files are L/chunks/cNN.md (the lead tells you which). Each block is one entry and the links to review:

    ## 爱不释手 [chengyu 褒] = Loving something so much one can't put it down.
      S: 如获至宝 [chengyu 褒] = As delighted as if one had found a priceless treasure.
      A: 不屑一顾 [chengyu 贬] = To consider something not worth a glance.
      A: 非同一般 [not in dictionary]

The bracket gives the kind and tone (褒 commendatory, 贬 derogatory, nothing = neutral). Each pair appears only once
in the whole review. Links are two-way, so you only report a pair once.

## The test
**Would a mainstream Chinese 近义词/反义词 dictionary (汉典, 百度汉语, a printed 成语词典) plausibly list this item for
this entry?** Judge on the entry's main sense with your own knowledge of both expressions.

KEEP (do not flag):
- Near-synonyms that overlap in the main sense, even if not exact, of different strength, register or kind.
- Classic dictionary antonym pairs, even when one side is "stronger" or the contrast is of attitude:
  垂头丧气↔趾高气扬, 面不改色↔面红耳赤, 不学无术↔勤学苦练, 词不达意↔言简意赅, 屡战屡败↔屡败屡战,
  勤奋↔懒惰, 一帆风顺↔一波三折. And classic near-synonyms such as 响遏行云≈余音绕梁.
- A synonym of the opposite tone when the sense is the same (能言善辩 / 巧舌如簧): the app marks these on purpose.
- A warning proverb ↔ the advice it gives (S) or the fault it warns against (A): 欲速则不达 S 循序渐进, A 拔苗助长.
- **"[not in dictionary]" items**: these are almost always real words or phrases the app just doesn't have yet
  (失信于民, 遵纪守法, 一代宗师, 草率行事). Judge them on meaning like any other item. Never flag one for being absent
  from the dictionary or for being a plain word rather than an idiom.

FLAG:
- `remove` — the item shares only a topic, image or situation, not the meaning (哀兵必胜 S 破釜沉舟); an "antonym"
  that is merely different, or opposite only on a side detail (安然无恙 A 人头落地); a form of the entry itself
  (失去理智 under 丧失理智; 来无影去无踪 under 来去无踪); two forms of one expression in the same list; a clearly garbled
  or misremembered expression (盲人说象 for 盲人摸象).
- `move` — clearly in the wrong list: a true antonym under S, or a true synonym under A.

When unsure, KEEP. Expect most items to be fine.

## Output
For each chunk, write L/out/cNN.jsonl (one JSON object per line, UTF-8), only the flagged items:

    {"entry": "哀兵必胜", "item": "破釜沉舟", "list": "S", "verdict": "remove", "why": "topic only: resolve in battle, not 'the aggrieved win'"}

`entry` is the headword after `##` exactly as written; `item` exactly as written; `why` at most 15 English words.
Write each chunk's file as soon as that chunk is done (rewrite the whole file if you build it in parts), and end it
with `{"done": "cNN", "flagged": <n>}`. If a chunk's file already ends with a done line, skip it (you were resumed).
Read each chunk fully (Read with offset/limit if needed). When finished, reply with one line per chunk: the flagged
count and the most typical problem.
