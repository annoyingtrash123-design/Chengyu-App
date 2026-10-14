import { api } from "../api";
import { h, clear, en, meaningOf, KIND_LABEL, label, navigate } from "../ui";

export async function renderHome(root: HTMLElement) {
  const [daily, stats] = await Promise.all([api.daily(), api.stats()]);
  const done = stats.today.reviews + stats.today.quiz_answers;
  const pct = Math.min(100, Math.round((done / Math.max(1, stats.daily_goal)) * 100));

  clear(
    root,
    h(
      "header",
      { class: "hero" },
      h("div", { class: "hero-title" }, h("span", { class: "hero-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), "成语词典"),
      h("div", { class: "hero-sub" }, en() ? "Chengyu & proverbs" : "成语 · 俗语 · 歇后语 · 惯用语"),
    ),
    h(
      "section",
      { class: "card stat-strip" },
      h("div", { class: "stat" }, h("div", { class: "stat-num" }, `🔥 ${stats.streak}`), h("div", { class: "stat-label" }, en() ? "day streak" : "连续天数")),
      h("div", { class: "stat" }, h("div", { class: "stat-num" }, String(stats.due_today)), h("div", { class: "stat-label" }, en() ? "due today" : "今日待复习")),
      h("div", { class: "stat" }, h("div", { class: "stat-num" }, String(stats.mastered)), h("div", { class: "stat-label" }, en() ? "mastered" : "已掌握")),
    ),
    h(
      "section",
      { class: "card" },
      h("div", { class: "row-between" }, h("strong", null, en() ? "Today's goal" : "今日目标"), h("span", { class: "muted" }, `${done} / ${stats.daily_goal}`)),
      h("div", { class: "progress" }, h("div", { class: "progress-bar", style: `width:${pct}%` })),
      h("button", { class: "btn primary block", onclick: () => navigate("#/study") }, en() ? "Start studying" : "开始学习"),
    ),
    daily
      ? h(
          "a",
          { class: "card daily", href: `#/entry/${daily.id}` },
          h("div", { class: "eyebrow" }, en() ? "Chengyu of the day · 每日一词" : "每日一词"),
          h("div", { class: "daily-text" }, daily.text),
          h("div", { class: "pinyin" }, daily.pinyin),
          h("div", { class: "meaning" }, meaningOf(daily)),
          h("div", { class: "muted small" }, label(KIND_LABEL[daily.kind])),
        )
      : null,
    h(
      "section",
      { class: "quick-grid" },
      quick("#/games/quiz", "测", en() ? "Quiz" : "测验"),
      quick("#/games/chain", "龙", en() ? "Idiom chain" : "成语接龙"),
      quick("#/games/scramble", "拼", en() ? "Unscramble" : "拼成语"),
      quick("#/games/memory", "翻", en() ? "Memory" : "翻牌配对"),
    ),
  );
}

function quick(href: string, icon: string, text: string) {
  return h("a", { class: "quick", href }, h("span", { class: "quick-icon" }, icon), h("span", null, text));
}
