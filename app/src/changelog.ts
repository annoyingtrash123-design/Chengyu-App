// "What's new", shown in Me → Updates and after an update is applied.
// Add a new entry at the top whenever a user-visible change ships.

export interface Release {
  version: string;
  date: string;
  en: string[];
  zh: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "0.18",
    date: "2026-10-29",
    en: [
      "Past results now keep every game, not just quizzes: idiom chain, unscramble, crossword, memory and synonym/antonym match, each with the expressions it used.",
      "Idiom chain: giving up shows a valid answer as the next link, with its pinyin and meaning.",
      "Crossword: new “Type answers” mode — write each expression yourself instead of picking from the characters.",
      "Contents map fills the whole screen, corners included, with bigger bubbles; tapping in, the bubbles spread out from the preview, and going back folds them back in.",
      "Contents map: going back from an entry returns to the bubbles you opened it from.",
      "Contents map: pinch (or scroll) to zoom and drag to look around inside the map; the rest of the screen stays put.",
      "时移事易 added as another form of 时移世易.",
      "Back button works like an app: it steps out of what you opened, then to a blank Search page, and the next press closes the app (after a search: results, then blank, one more press stays, then closes); switching tabs no longer piles up in the back history.",
      "The tab bar hides while the keyboard is open, so the search box sits right on the keyboard.",
    ],
    zh: [
      "历史成绩现在保存所有游戏：成语接龙、拼成语、填字、翻牌和近反义配对，每局都列出用到的词语。",
      "成语接龙：认输时显示一个可以接的成语（含拼音和释义）。",
      "填字游戏：新增“自己输入”模式，不用选字，直接写出整个成语。",
      "内容总览铺满整个屏幕（包括四角），气泡更大；放大时气泡从预览中展开，返回时再收回去。",
      "内容总览：从词条返回时回到打开它的那一层气泡。",
      "内容总览：可双指缩放、拖动查看，页面其他部分不动。",
      "收录“时移事易”，作为“时移世易”的另一写法。",
      "返回键更像应用：先退出打开的页面，再回到空白搜索页，再按一次退出应用（搜索后：结果、空白页、再停留一次，然后退出）；切换标签不再计入返回记录。",
      "键盘打开时隐藏底部标签栏，搜索框紧贴键盘。",
    ],
  },
  {
    version: "0.17",
    date: "2026-10-28",
    en: [
      "A full check of every entry: wrong synonyms and antonyms removed, every valid one linked both ways, about 150 duplicate entries merged (the other forms still find the entry in search), headwords changed to the most common form, and hundreds of label, pinyin, example and origin fixes.",
      "Star ratings now reflect how well native speakers know an idiom, not just how often it appears in print: famous story and textbook idioms such as 叶公好龙, 负荆请罪 and 班门弄斧 are now ★★★.",
      "About 450 new entries from the wider frequency list (e.g. 铸剑为犁, 安不忘危, 言有尽而意无穷), and about 440 more verified origins.",
      "New labels: periods of origin (先秦, 秦汉, 魏晋南北朝, 隋唐五代, 宋代, 元代) and specific character traits (honesty, loyalty, kindness, courage, diligence, composure, greed, cruelty, cunning, fickleness).",
      "Contents map (from Me): all entries as zoomable bubbles. Group by label, type or stars, layer type and star filters on top, and tap any bubble to fly into it, down to the expressions themselves.",
      "Me is simpler: study statistics and history removed; Updates and a new About & licences section (content note, privacy, data sources) fold away. Clues and flashcards no longer hide characters with ○.",
      "Home shows the chengyu of the day as the full entry (examples, origin, synonyms, labels) with a favourite button, no need to open it separately.",
      "Search box moved to the bottom of the screen, just above the tabs: bigger and within thumb reach; tap anywhere on the empty page (or the Search tab again) to start typing.",
      "Long lists have a fast-scroll bar on the right: drag it to jump straight to any position.",
      "Study and game decks updated: pick by star tier (★★★/★★/★), by type, or by any label, including the new era and trait labels.",
      "Quizzes and games now use idioms and sayings only (plain phrases stay in the dictionary), and the meaning questions no longer hide characters with ○.",
    ],
    zh: [
      "全面校对所有词条：删去不准确的近义词和反义词，有效的近反义词全部双向链接；合并约一百五十条重复词条（其他写法仍可搜到）；主条目改为最常用的写法；修正大量标签、拼音、例句和出处。",
      "星级改为按母语者的熟悉程度评定，而不只看书面出现频率：叶公好龙、负荆请罪、班门弄斧等成语故事和课本成语现为★★★。",
      "根据更大范围的词频表新增约四百五十条（如铸剑为犁、安不忘危、言有尽而意无穷），并新增约四百四十条经核实的出处。",
      "新增标签：出处时代（先秦、秦汉、魏晋南北朝、隋唐五代、宋代、元代）及具体品格（诚实正直、忠义、仁厚宽容、勇敢无畏、勤奋敬业、沉着镇定、贪婪自私、凶狠残暴、奸诈阴险、反复无常）。",
      "内容总览（在“我的”中打开）：全部词条以气泡呈现，可按标签、类型或星级分组，并叠加类型和星级筛选；点气泡即放大进入，直到具体词条。",
      "“我的”页面更简洁：去掉学习统计和浏览记录；“更新”和新增的“关于与许可”（内容说明、隐私、数据来源）可折叠。提示和卡片不再用〇遮住字。",
      "首页直接显示每日一词的完整词条（例句、出处、近反义词、标签），并可收藏，无需另行打开。",
      "搜索框移到屏幕底部，更大、单手可及；在空白处点一下（或再点“词典”标签）即可输入。",
      "长列表右侧新增快速滚动条：拖动即可直接跳到任意位置。",
      "学习和游戏卡组更新：可按星级（★★★/★★/★）、类型或任一标签选择，包括新的时代和品格标签。",
      "测验和游戏只出成语和俗语等熟语（普通词组仍保留在词典中）；看释义选成语的题目不再用〇遮住字。",
    ],
  },
  {
    version: "0.16",
    date: "2026-10-21",
    en: [
      "Quiz and timed challenge: results list what you got right and wrong, and every finished quiz is kept under Games → Past results.",
      "New period labels: 明代 Ming, 清代 Qing, 民国 Republican era, 国民党 Nationalist and 中共 Communist era, with about 200 new entries — everyday Ming sayings, Qing court and edict phrases (八百里加急, 钦此钦遵, 龙颜大悦), statesmen's lines, May Fourth and Lu Xun phrases, Sun Yat-sen, Chiang Kai-shek and Mao-era sayings and poem lines.",
      "The 三十六计 label is complete again: the five three-character stratagem names are the only entries under four characters.",
      "About 400 famous lines and quotations: Tang and Song poetry, Ming–Qing writers, late-Qing reformers, Republican intellectuals and writers, Mao-era poems, and phrases from 西厢记 and 金瓶梅.",
      "New source labels: 名人名言 Famous quotes, 诗人 Poets, 作家 Writers, 学者·思想家 Thinkers and 政治人物 Statesmen. The 字数 filter now includes 3.",
      "Every origin now shows when its source was written: the dynasty or period, and the year where it is known (e.g. 《悯农》 · 唐 · 约800年).",
    ],
    zh: [
      "测验和限时挑战：结果显示答对和答错的词条，所有完成的测验都保存在“游戏 → 历史成绩”中。",
      "新增时期标签：明代、清代、民国、国民党、中共，并新增约二百条词条：明代俗语、清代朝廷与圣旨用语（八百里加急、钦此钦遵、龙颜大悦）、名臣名句、五四与鲁迅用语、孙中山、蒋介石及毛泽东时代的名言与诗句。",
      "三十六计标签重新补齐：五个三字计名是唯一少于四个字的词条。",
      "新增约四百条名句名言：唐宋诗词、明清文人、晚清维新人物、民国学者作家、毛泽东诗词，以及《西厢记》《金瓶梅》中的常用语。",
      "新增出处标签：名人名言、诗人、作家、学者·思想家、政治人物；“字数”筛选新增 3。",
      "所有出处均标注成书或写作年代：朝代或时期，能确定的注明年份（如《悯农》· 唐 · 约800年）。",
    ],
  },
  {
    version: "0.15",
    date: "2026-10-21",
    en: [
      "Other forms of an expression are now grouped: Also written, Older form, Full form, Short form, and Common error (误作). Where a variant was clearly the standard form it is now the headword (e.g. 防患于未然, 含糊其词, 一笔抹杀).",
      "About 170 more rare literary idioms. Religion labels reviewed: 儒家 Confucian, 道家·道教 Daoist, 佛教 Buddhist and a new 基督教 Christian label.",
      "Entries shorter than four characters have been removed.",
    ],
    zh: [
      "异形词按类型分组显示：也作、旧作、全作、简作，以及“误作”。明显更规范的写法改为主词条（如防患于未然、含糊其词、一笔抹杀）。",
      "新增约一百七十条罕用文学成语；重新整理儒家、道家·道教、佛教标签，并新增基督教标签。",
      "已删除所有少于四个字的词条。",
    ],
  },
  {
    version: "0.14",
    date: "2026-10-21",
    en: [
      "List: search labels in English or Chinese (e.g. 三十六计, 二十四孝, friendship). All filters are shown in full, with Pattern at the bottom.",
      "Export PDF: print or save the current list, filtered or not, as a clean PDF.",
      "About 500 rare literary idioms (label Rare & literary 罕用成语), the missing stratagems 空城计 and 反间计, and new theme entries such as 折柳送别 and 桂林山水甲天下.",
    ],
    zh: [
      "列表：可用中文或英文搜索标签（如三十六计、二十四孝、友情）；所有筛选项完整展开，“结构”放在最后。",
      "导出 PDF：可把当前列表（含筛选结果）打印或保存为 PDF。",
      "新增约五百条罕用文学成语（标签“罕用成语”）、补齐三十六计中的空城计和反间计，以及折柳送别、桂林山水甲天下等主题词条。",
    ],
  },
  {
    version: "0.13",
    date: "2026-10-21",
    en: [
      "Nearly 9,000 entries: about 1,700 more chengyu (story, literary, textbook and exam idioms), plus big new sets of 俗语 (now ~760), 歇后语 (~310), 惯用语 (~570) and 名句 (~580).",
      "New labels: Exam favourites 高考常考 and Often misused 易误用, with the trap explained in each entry's usage note.",
      "New coverage: the 36 stratagems, the 24 filial-piety stories, idioms from the four classic novels, polite and humble phrases, festive wishes, and solar-term and weather sayings.",
      "Hundreds more alternative spellings: searching an older or variant form opens the main entry.",
    ],
    zh: [
      "词条接近九千条：新增约一千七百条成语（典故、文学、课本和高考成语），以及大量俗语（约七百六十条）、歇后语（约三百一十条）、惯用语（约五百七十条）和名句（约五百八十条）。",
      "新增标签“高考常考”和“易误用”，易误用词条的用法说明会解释常见错误。",
      "新增三十六计、二十四孝、四大名著成语、敬辞谦辞、节日祝福语、节气和天气农谚等内容。",
      "新增数百个异形写法：搜索旧写法或异体也能打开主词条。",
    ],
  },
  {
    version: "0.12",
    date: "2026-10-19",
    en: [
      "New game: Crossword. Fill the blanks in a grid of crossing chengyu, with their meanings as clues.",
      "Tap any other expression in an example sentence, or any quiz option or matched card after answering, to see its meaning and open its entry.",
      "The app remembers what you've studied. List rows show 学习中, 已掌握 or 看过 (opened), and Me has Recently viewed and Studied lists.",
      "List rows preview the entry's labels. The bottom tab names are always red.",
      "Over 5,100 entries, covering nearly all of the THUOCL top 5,000 chengyu.",
    ],
    zh: [
      "新游戏“填字游戏”：成语交叉成格，按释义填空。",
      "例句里的其他词语，以及答题后的选项和已配对的卡片，点一下就能看释义并打开词条。",
      "应用会记住你学过的内容：列表显示“学习中”“已掌握”“看过”，“我的”页新增“最近查看”和“学过的”。",
      "列表中直接预览词条标签；底部标签栏文字一直显示为红色。",
      "词条超过五千一百条，几乎涵盖 THUOCL 前五千条成语。",
    ],
  },
  {
    version: "0.11",
    date: "2026-10-14",
    en: [
      "Phase 2 complete: the 1,000 most frequent chengyu (THUOCL) are all in — about 2,170 entries in total.",
      "Frequency stars now follow corpus rank for every chengyu that has one.",
      "New labels: News & officialese, Luxury & extravagance; more variant forms merged (e.g. 独辟蹊径 → 另辟蹊径, 深入民心 → 深入人心).",
    ],
    zh: ["第二阶段完成：一千条最常用成语（THUOCL）全部收录，共约两千一百七十条。", "有语料排名的成语，常用度星级均按排名确定。", "新增“新闻政务用语”“奢华铺张”标签；合并更多异形写法（如 独辟蹊径 → 另辟蹊径，深入民心 → 深入人心）。"],
  },
  {
    version: "0.10",
    date: "2026-10-14",
    en: [
      "Phase 1 complete: every expression on the master list is in, about 1,440 entries in all.",
      "New labels such as Well wishes & greetings, Fleeting time, Comebacks & renewal, Fairness, Adaptability, Public opinion and Wordiness, added to older entries too.",
      "More variant forms linked (e.g. 鼠肚鸡肠 → 小肚鸡肠, 盛世太平 → 太平盛世).",
    ],
    zh: ["第一阶段完成：主词表全部收录，共约一千四百四十条。", "新增“祝福吉语”“光阴飞逝”“东山再起”“公平公正”“灵活应变”“民心民意”“啰唆冗长”等标签，并补加到旧词条。", "关联更多异形写法（如 鼠肚鸡肠 → 小肚鸡肠，盛世太平 → 太平盛世）。"],
  },
  {
    version: "0.9",
    date: "2026-10-14",
    en: [
      "\u201cThemes\u201d are now called \u201cLabels\u201d: an entry can have many, and you can filter by any of them.",
      "The least-common tier is now \u201c★ Uncommon\u201d instead of \u201cLiterary\u201d.",
      "Phase 1 content: over 1,200 entries now.",
    ],
    zh: ["\u201c主题\u201d改称\u201c标签\u201d：一个词条可有多个标签，可按任一标签筛选。", "最低常用度改为\u201c★ 少见\u201d，不再叫\u201c文学\u201d。", "第一阶段内容：现已超过一千二百条。"],
  },
  {
    version: "0.8",
    date: "2026-10-14",
    en: [
      "Variant forms are merged into one entry (e.g. 青山绿水 → 绿水青山), shown as \u201cAlso written\u201d.",
      "Searching a variant, or tapping a synonym written in a variant form, opens the main entry.",
      "75 new entries (phase 1 batches 3–5).",
    ],
    zh: ["异体/异序写法并入同一词条（如 青山绿水 → 绿水青山），显示为\u201c也作\u201d。", "搜索异形词或点击异形写法的近反义词，会打开主词条。", "新增 75 条词目（第一阶段第 3–5 批）。"],
  },
  {
    version: "0.7",
    date: "2026-10-14",
    en: ["List: themes show how many entries they have; empty themes are hidden.", "List remembers your type and theme selection."],
    zh: ["列表：主题显示词条数量，空主题自动隐藏。", "列表会记住你选择的类型和主题。"],
  },
  {
    version: "0.6",
    date: "2026-10-14",
    en: ["Page headings are now red.", "Simpler Me tab: removed the daily goal, backups and (in the web app) reminders."],
    zh: ["页面标题改为红色。", "精简\u201c我的\u201d：移除每日目标、备份，以及网页版中的提醒。"],
  },
  {
    version: "0.5",
    date: "2026-10-14",
    en: [
      "Safer backups: restoring asks first, rejects empty backups and keeps a safety copy.",
      "Flashcards: double taps no longer count twice; keyboard shortcuts (Space, 1–4).",
      "歇后语 punchlines stay hidden until you reveal them; clues no longer give away answers.",
      "Search understands mixed tones (hua4 she) and v for ü (yi jv).",
      "Fixes to 成语接龙, quizzes, tap sizes and narrow screens; a tone note corrected (一 is yì before a 3rd tone).",
    ],
    zh: [
      "备份更安全：恢复前先确认，拒绝空备份，并保留安全副本。",
      "记忆卡片：连点不再重复计分；支持键盘快捷键（空格、1–4）。",
      "歇后语后半句在点击前保持隐藏；提示不再泄露答案。",
      "搜索支持部分带声调（hua4 she）和用 v 代替 ü（yi jv）。",
      "修复成语接龙、测验、按钮大小和窄屏显示；更正变调说明（“一”在第三声前读 yì）。",
    ],
  },
  {
    version: "0.4",
    date: "2026-10-14",
    en: ["Updates now install automatically while you use the app.", "New Updates section in Me, with a manual check and this list.", "The phone's status bar now blends in with the app instead of showing red."],
    zh: ["应用使用时会自动安装更新。", "“我的”中新增“更新”栏目，可手动检查更新并查看更新内容。"],
  },
  {
    version: "0.3",
    date: "2026-10-14",
    en: ["Home shows the chengyu of the day in full: story, examples and usage.", "Search starts empty; new List tab with a drop-down to choose types and themes."],
    zh: ["首页完整展示每日一词：典故、例句和用法。", "搜索页默认空白；新增“列表”页，可通过下拉菜单选择类型和主题。"],
  },
  {
    version: "0.2",
    date: "2026-10-14",
    en: ["Installable web app that works offline.", "Four-colour icon and new colours."],
    zh: ["可安装的网页应用，支持离线使用。", "四色图标和新配色。"],
  },
  {
    version: "0.1",
    date: "2026-10-14",
    en: ["First version: 20 sample entries, search, filters, flashcards and games."],
    zh: ["首个版本：20 个示例词条、搜索、筛选、记忆卡片和游戏。"],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
