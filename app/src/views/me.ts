import { api, isTauri } from "../api";
import { h, clear, en, pageHeader, saveSettings, state, toast } from "../ui";
import { scheduleReminders } from "../notifications";

export async function renderMe(root: HTMLElement) {
  const stats = await api.stats();
  const weak = stats.weak_spots.length ? await api.summaries(stats.weak_spots.map((w) => w.id)) : [];
  const max = Math.max(1, ...stats.last_30_days);
  const s = state.settings;

  const numberField = (value: number, min: number, max: number, onChange: (n: number) => void) =>
    h("input", {
      type: "number",
      class: "num-input",
      value: String(value),
      min: String(min),
      max: String(max),
      onchange: (e: Event) => {
        const n = Math.max(min, Math.min(max, Number((e.target as HTMLInputElement).value) || min));
        onChange(n);
      },
    });

  const switchRow = (text: string, on: boolean, onChange: (v: boolean) => void) => {
    const input = h("input", { type: "checkbox", checked: on, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) });
    return h("label", { class: "setting-row" }, h("span", null, text), h("span", { class: "switch" }, input, h("span", { class: "slider" })));
  };

  const timeInput = h("input", {
    type: "time",
    class: "num-input",
    value: s.reminder_time,
    onchange: async (e: Event) => {
      await saveSettings({ reminder_time: (e.target as HTMLInputElement).value });
      await scheduleReminders();
    },
  });

  const backupBox = h("textarea", { class: "backup", rows: 3, placeholder: en() ? "Paste a backup here to restore" : "粘贴备份数据以恢复" });

  clear(
    root,
    pageHeader(en() ? "Me" : "我的"),
    h(
      "section",
      { class: "card stat-strip" },
      stat(`🔥 ${stats.streak}`, en() ? "streak" : "连续天数"),
      stat(String(stats.best_streak), en() ? "best" : "最长"),
      stat(`${Math.round(stats.accuracy * 100)}%`, en() ? "accuracy" : "正确率"),
    ),
    h(
      "section",
      { class: "card stat-strip" },
      stat(String(stats.mastered), en() ? "mastered" : "已掌握"),
      stat(String(stats.learning), en() ? "learning" : "学习中"),
      stat(String(stats.new), en() ? "new" : "未学"),
    ),
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "Last 30 days" : "近 30 天"),
      h(
        "div",
        { class: "bars", role: "img", "aria-label": "Activity over the last 30 days" },
        stats.last_30_days.map((n, i) =>
          h("div", { class: "bar-wrap", title: `${n}` }, h("div", { class: `bar ${i === 29 ? "today" : ""}`, style: `height:${(n / max) * 100}%` })),
        ),
      ),
      h("div", { class: "row-between muted small" }, h("span", null, en() ? "30 days ago" : "30 天前"), h("span", null, en() ? "today" : "今天")),
    ),
    weak.length
      ? h(
          "section",
          { class: "card" },
          h("h3", null, en() ? "Weak spots" : "薄弱词条"),
          h("div", { class: "chip-group" }, weak.map((w) => h("a", { class: "chip link", href: `#/entry/${w.id}` }, w.text))),
        )
      : null,
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "Settings" : "设置"),
      switchRow(en() ? "Show English" : "显示英文", s.show_english, async (v) => {
        await saveSettings({ show_english: v });
        renderMe(root);
      }),
      h("label", { class: "setting-row" }, h("span", null, en() ? "Daily goal (reviews + answers)" : "每日目标（复习 + 答题）"), numberField(s.daily_goal, 1, 500, (n) => saveSettings({ daily_goal: n }))),
      h("label", { class: "setting-row" }, h("span", null, en() ? "New cards per day" : "每日新卡"), numberField(s.new_per_day, 0, 100, (n) => saveSettings({ new_per_day: n }))),
      switchRow(en() ? "Daily reminder with chengyu of the day" : "每日提醒（附每日一词）", s.reminders, async (v) => {
        await saveSettings({ reminders: v });
        const ok = await scheduleReminders();
        if (v && !ok) toast(isTauri() ? (en() ? "Notifications are not allowed" : "未获得通知权限") : en() ? "Reminders work in the phone app" : "提醒需在手机应用中使用");
      }),
      h("label", { class: "setting-row" }, h("span", null, en() ? "Reminder time" : "提醒时间"), timeInput),
    ),
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "Backup" : "备份"),
      h("p", { class: "muted small" }, en() ? "Copy your progress to keep it safe, or paste a backup to restore it." : "复制学习进度以备份，或粘贴备份数据恢复。"),
      h(
        "div",
        { class: "row-gap" },
        h("button", {
          class: "btn",
          onclick: async () => {
            const data = JSON.stringify(await api.exportData());
            try {
              await navigator.clipboard.writeText(data);
              toast(en() ? "Copied to clipboard" : "已复制");
            } catch {
              backupBox.value = data;
            }
          },
        }, en() ? "Copy backup" : "复制备份"),
        h("button", {
          class: "btn",
          onclick: async () => {
            try {
              await api.importData(JSON.parse(backupBox.value));
              toast(en() ? "Restored" : "已恢复");
              renderMe(root);
            } catch (e) {
              toast(`${en() ? "Invalid backup" : "备份数据无效"}: ${String(e)}`);
            }
          },
        }, en() ? "Restore" : "恢复"),
      ),
      backupBox,
    ),
    h("p", { class: "muted small center" }, `${state.meta?.total ?? 0} ${en() ? "entries" : "条词目"} · v0.1`),
  );
}

function stat(num: string, text: string) {
  return h("div", { class: "stat" }, h("div", { class: "stat-num" }, num), h("div", { class: "stat-label" }, text));
}
