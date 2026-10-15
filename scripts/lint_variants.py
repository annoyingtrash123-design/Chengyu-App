#!/usr/bin/env python3
"""Flag likely variant mistakes for a human to review (not a hard check).

  - two near-identical forms in one synonym/antonym list (稳如泰山 + 安如泰山)
  - a usage note that says 也作 / "Also written" when the entry has no `variants`
  - a synonym that is a near-form of the entry itself (绿水青山 → 青山绿水)

    python3 scripts/lint_variants.py [data/entries/p1-007.json ...]
"""
import glob
import json
import re
import sys


# Pairs already reviewed and confirmed to be distinct expressions.
DISTINCT = {
    frozenset(p)
    for p in [
        ("拉关系", "托关系"),
        ("翻天覆地", "天翻地覆"),
        ("截然不同", "迥然不同"),
        ("大惑不解", "迷惑不解"),
        ("荒无人烟", "渺无人烟"),
        ("悠然自得", "怡然自得"),
        ("巧夺天工", "巧匠天工"),
        ("稀里糊涂", "糊里糊涂"),
        ("暮气沉沉", "死气沉沉"),
        ("耸人听闻", "骇人听闻"),
        ("各自为战", "各自为政"),
        ("动人心魄", "动人心弦"),
        ("动人心魄", "扣人心弦"),
        ("闻风而逃", "闻风而动"),
        ("窥见一斑", "可见一斑"),
        ("一泻千里", "一日千里"),
        ("引以为荣", "引以为戒"),
        ("各执己见", "固执己见"),
        ("各执己见", "各抒己见"),
        ("各持己见", "各抒己见"),
        ("因时制宜", "因地制宜"),
        ("言而有信", "言而无信"),
        ("来者不善", "来者不拒"),
        ("不能自已", "不能自拔"),
        ("火急火燎", "心急火燎"),
        ("惜字如金", "惜墨如金"),
        ("言之有理", "言之有物"),
        ("表里不一", "表里如一"),
        ("无机可乘", "有机可乘"),
        ("天长日久", "天长地久"),
        ("后发制人", "先发制人"),
        ("气吞山河", "气壮山河"),
        ("风雪交加", "风雨交加"),
        ("不可限量", "不可估量"),
        ("野心勃勃", "雄心勃勃"),
        ("深得人心", "深入人心"),
        ("深得民心", "深入民心"),
        ("年近古稀", "年逾古稀"),
        ("夺门而出", "夺眶而出"),
        ("贪污腐化", "贪污腐败"),
        ("一哄而散", "一哄而上"),
        ("一诺千金", "一掷千金"),
        ("一诺千金", "一刻千金"),
        ("一诺千金", "一字千金"),
        ("一掷千金", "一字千金"),
        ("自行其是", "各行其是"),
        ("屡战屡败", "屡败屡战"),
        ("有气无力", "有心无力"),
        ("不胜其烦", "不厌其烦"),
        ("后继无人", "后继有人"),
        ("一笑了之", "一走了之"),
        ("不知所云", "不知所措"),
        ("不知所云", "不知所终"),
        ("知难而进", "知难而退"),
        ("路人皆知", "人人皆知"),
        ("路人皆知", "尽人皆知"),
        ("发财致富", "发家致富"),
        ("寸步不让", "寸步不离"),
        ("舍己为人", "舍己救人"),
        ("真枪实弹", "荷枪实弹"),
        ("视若无睹", "熟视无睹"),
        ("一拥而上", "一哄而散"),
        ("言之有物", "言之无物"),
        ("有志之士", "有识之士"),
        ("前仆后继", "前赴后继"),
        ("任人唯贤", "任人唯亲"),
        ("一哄而上", "一拥而上"),
        ("神采飞扬", "文采飞扬"),
        ("白雪皑皑", "冬雪皑皑"),
        ("不知所终", "不知所措"),
        ("精耕细作", "精工细作"),
        ("一掷千金", "一刻千金"),
        ("相安无事", "平安无事"),
        ("破烂不堪", "破败不堪"),
        ("不以为意", "不以为然"),
        ("万不得已", "迫不得已"),
        ("拥政爱民", "勤政爱民"),
        ("感天动地", "惊天动地"),
        ("精美绝伦", "精彩绝伦"),
        ("将信将疑", "半信半疑"),
    ]
}


def near(a: str, b: str) -> bool:
    if a == b or frozenset((a, b)) in DISTINCT:
        return False
    if sorted(a) == sorted(b):
        return True
    return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1


files = sys.argv[1:] or sorted(glob.glob("data/entries/*.json"))
# Every recorded form → its headword, so two forms of one entry are caught too.
main_of = {}
for f in glob.glob("data/entries/*.json"):
    for e in json.load(open(f, encoding="utf-8")):
        for form in [e["text"], *e.get("variants", [])]:
            main_of.setdefault(form, e["text"])
found = 0
for f in files:
    for e in json.load(open(f, encoding="utf-8")):
        t = e["text"]
        for key in ("synonyms", "antonyms"):
            items = e.get(key, [])
            for i, a in enumerate(items):
                if key == "synonyms" and sorted(a) == sorted(t) and near(a, t):
                    print(f"{f}: {t}: {key} {a} looks like a variant of the entry itself")
                    found += 1
                if main_of.get(a) == t and a != t:
                    print(f"{f}: {t}: {key} {a} is a recorded variant of the entry itself")
                    found += 1
                for b in items[i + 1:]:
                    if a in main_of and main_of.get(a) == main_of.get(b):
                        print(f"{f}: {t}: {key} lists {a} and {b} — both forms of {main_of[a]}")
                        found += 1
                    elif near(a, b):
                        print(f"{f}: {t}: {key} lists {a} and {b} — variants of each other?")
                        found += 1
        notes = e["usage"]["zh"] + " " + e["usage"]["en"]
        if re.search(r"(也作|也写作|又作)[“\"「]|[Aa]lso written", notes) and not e.get("variants"):
            print(f"{f}: {t}: usage mentions another written form but `variants` is empty")
            found += 1
print(f"{found} to review")
