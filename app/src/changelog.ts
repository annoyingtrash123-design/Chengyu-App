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
