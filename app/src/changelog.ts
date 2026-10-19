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
