#!/usr/bin/env python3
"""Add origin/usage labels to entries from their recorded source and usage notes.

Run after every batch (and after adding a new rule here) so new labels are
back-filled onto old entries too. Only ever adds labels; never removes.

    python3 scripts/backfill_labels.py            # all entries
"""
import glob
import json
import re

# label → regex on origin.source (+ story for myths)
SOURCE_RULES = {
    "confucian-classics": r"《(论语|孟子|荀子|礼记|大学|中庸|孔子家语)",
    "daoist-classics": r"《(老子|庄子|列子|淮南子)",
    "buddhist-origin": r"《(金刚经|长阿含经|维摩诘经|妙法莲华经|法华经|大般涅槃经|涅槃经|心地观经|六祖坛经|景德传灯录|指月录|五灯会元)",
    "historical-records": r"《(史记|汉书|后汉书|三国志|晋书|宋书|南史|北史|魏书|北齐书|旧唐书|新唐书|宋史|左传|国语|战国策|资治通鉴)",
    "three-kingdoms": r"三国志|三国演义",
    "myths-legends": r"山海经|拾遗记|续玄怪录|搜神记|神话|淮南子·览冥",
    "poems-prose": r"(李白|杜甫|苏轼|陆游|白居易|孟郊|陈子昂|曹操《|龚自珍|朱熹《春日|王安石|秦观|李煜|崔郊|王勃|《诗经|屈原|赵孟頫|于谦|陶渊明|韩愈|范仲淹|欧阳修|王羲之|李密|柳宗元|丘迟|刘勰|钟嵘|宋玉|李正封|李延年|庾信|毛泽东《|李商隐|王褒|贾谊《过秦论|蔡邕|嵇康|罗大经)",
}
# label → regex on usage (zh + en)
USAGE_RULES = {
    "festive-greetings": r"祝福|New Year|blessing|greeting|春联",
    "wedding-wishes": r"婚礼|wedding|newlywed",
    "polite-humble": r"谦辞|self-deprecat|客套|polite formula",
    "essay-favourites": r"作文常用|school writing|作文",
}
MYTH_TEXTS = {"女娲补天", "炼石补天", "夸父逐日", "精卫填海", "开天辟地", "愚公移山", "天女散花", "月下老人", "八仙过海", "南柯一梦", "干将莫邪", "嫦娥奔月"}
# Hand-picked additions the keyword rules can't find.
MANUAL = {
    "wedding-wishes": ["举案齐眉", "天长地久", "郎才女貌", "珠联璧合", "白头偕老", "相敬如宾"],
    "festive-greetings": ["心想事成", "万事如意", "步步高升", "年年有余", "大吉大利", "圆满成功"],
    "polite-humble": ["洗耳恭听", "滥竽充数", "甘拜下风", "拙作", "献丑"],
    "comebacks-and-renewal": ["脱胎换骨", "东山再起", "起死回生", "卷土重来", "否极泰来", "死灰复燃"],
    "fairness-and-impartiality": ["大公无私", "一视同仁", "铁面无私", "公正无私"],
    "adaptability": ["见机行事", "因地制宜", "见风使舵", "灵机一动", "随遇而安", "对症下药"],
    "mistakes-and-correction": ["改过自新", "迷途知返", "亡羊补牢", "负荆请罪", "引咎自责", "文过饰非"],
    "fleeting-time": ["光阴似箭", "白驹过隙", "日月如梭", "光阴荏苒", "稍纵即逝", "昙花一现"],
    "chain-reactions": ["连锁反应", "牵一发而动全身"],
    "contentment-and-simplicity": ["知足常乐", "安贫乐道", "清心寡欲", "随遇而安"],
    "evenly-matched": ["棋逢对手", "势均力敌", "平分秋色", "旗鼓相当", "不相上下", "难分伯仲"],
    "competition-and-rivalry": ["争先恐后", "略胜一筹", "棋逢对手", "一决雌雄"],
    "innovation-and-progress": ["推陈出新", "标新立异", "日新月异", "革故鼎新"],
    "peace-and-prosperity": ["国泰民安", "风调雨顺", "五谷丰登", "安居乐业"],
    "value-of-time": ["时不我待", "机不可失"],
    "dead-ends-and-desperation": ["山穷水尽", "穷途末路", "进退两难", "走投无路"],
    "verbosity": ["拖泥带水", "言之无物", "喋喋不休", "长篇大论"],
    "public-opinion": ["众望所归", "政通人和"],
    "news-and-officialese": ["建章立制", "民主集中", "与时俱进", "开拓创新", "贪污腐败", "顺应民意", "违背民意", "政令不通", "清正廉洁", "勤政爱民", "圆满成功", "公平公正", "实事求是"],
    "luxury-and-extravagance": ["锦衣玉食", "八珍玉食", "珠光宝气", "山珍海味", "金玉满堂", "华服美饰"],
    "solitude-and-isolation": ["与世隔绝", "隐姓埋名", "离群索居", "孤苦伶仃", "形单影只", "独来独往"],
    "parenting-and-family": ["望子成龙", "望女成凤", "天伦之乐", "相依为命", "一家老小", "可怜天下父母心", "晨昏定省"],
    "family-and-home": ["家长里短", "柴米油盐", "养家糊口", "衣食住行", "左邻右舍"],
    "anger": ["火冒三丈", "怒不可遏", "怒气冲冲", "暴跳如雷", "气急败坏", "恼羞成怒", "忍无可忍", "怒发冲冠", "大发雷霆", "义愤填膺"],
    "joy-and-happiness": ["喜上眉梢", "如获至宝", "欣喜若狂", "喜出望外", "兴高采烈", "眉开眼笑", "喜笑颜开", "欢天喜地", "满心欢喜", "欢欣鼓舞"],
    "love-and-marriage": ["终身大事", "一见钟情", "天作之合", "郎才女貌", "白头偕老", "举案齐眉", "相敬如宾", "青梅竹马", "两小无猜", "两厢情愿", "一厢情愿"],
    "frankness-and-candour": ["直言不讳", "开门见山", "直截了当", "开诚布公", "推心置腹", "心直口快", "毫不讳言", "和盘托出", "指名道姓", "一针见血"],
    "unity-and-cooperation": ["齐心协力", "同舟共济", "众志成城", "同心同德", "万众一心", "团结一致", "抱成一团", "并肩作战", "守望相助", "步调一致", "上下一心"],
    "frugality-and-thrift": ["勤俭节约", "精打细算", "省吃俭用", "节衣缩食", "克勤克俭", "俭以养德", "厉行节约", "量入为出", "开源节流", "成由勤俭败由奢"],
    "weather-and-sky": ["万里无云", "风和日丽", "倾盆大雨", "大雨滂沱", "暴风骤雨", "狂风暴雨", "风雨交加", "雷电交加", "晴空万里", "阴雨连绵", "烈日炎炎", "天寒地冻", "冰天雪地", "白雪皑皑", "雨过天晴", "风雪交加", "秋高气爽"],
    "three-kingdoms": ["望梅止渴", "七步成诗", "三顾茅庐", "鞠躬尽瘁", "草船借箭", "万事俱备，只欠东风"],
}
# Hand-curated label lists (exam lists, themes judged by reviewers): data/source/label_lists.json, matched on headword or variant.
EXAM = {lab: set(texts) for lab, texts in json.load(open("data/source/label_lists.json", encoding="utf-8")).items()}

# Never auto-add these (checked by hand: the keyword match is misleading).
EXCLUDE = {("塞翁失马", "festive-greetings"), ("时光飞逝", "festive-greetings"), ("锣鼓喧天", "festive-greetings"), ("叶公好龙", "myths-legends")}

added = 0
for f in sorted(glob.glob("data/entries/*.json")):
    data = json.load(open(f, encoding="utf-8"))
    changed = False
    for e in data:
        o = e.get("origin") or {}
        src = o.get("source", "") if o else ""
        use = e["usage"]["zh"] + " " + e["usage"]["en"]
        want = [lab for lab, rx in SOURCE_RULES.items() if src and re.search(rx, src)]
        want += [lab for lab, rx in USAGE_RULES.items() if re.search(rx, use)]
        want += [lab for lab, texts in MANUAL.items() if e["text"] in texts]
        forms = {e["text"], *e.get("variants", [])}
        want += [lab for lab, texts in EXAM.items() if forms & texts]
        if e["text"] in MYTH_TEXTS:
            want.append("myths-legends")
        for lab in want:
            if (e["text"], lab) in EXCLUDE:
                continue
            if lab not in e["themes"]:
                e["themes"].append(lab)
                added += 1
                changed = True
    if changed:
        open(f, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"added {added} labels")
