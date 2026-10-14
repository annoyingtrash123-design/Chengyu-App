import { api, isTauri } from "../api";
import { h, clear, en, pageHeader, saveSettings, state, toast } from "../ui";
import { scheduleReminders } from "../notifications";
import { canPromptInstall, isIos, isStandalone, promptInstall } from "../install";
import { APP_VERSION, CHANGELOG } from "../changelog";
import { checkForUpdate, onUpdateState, updateState, type UpdateStatus } from "../updates";

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
        const input = e.target as HTMLInputElement;
        const n = Math.max(min, Math.min(max, Math.round(Number(input.value)) || min));
        input.value = String(n);
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
      h("label", { class: "setting-row" }, h("span", null, en() ? "New cards per day" : "每日新卡"), numberField(s.new_per_day, 0, 100, (n) => saveSettings({ new_per_day: n }))),
      // Reminders need native notifications, so they only exist in the Android/iOS app.
      isTauri()
        ? [
            switchRow(en() ? "Daily reminder with chengyu of the day" : "每日提醒（附每日一词）", s.reminders, async (v) => {
              await saveSettings({ reminders: v });
              const ok = await scheduleReminders();
              if (v && !ok) toast(en() ? "Notifications are not allowed" : "未获得通知权限");
            }),
            h("label", { class: "setting-row" }, h("span", null, en() ? "Reminder time" : "提醒时间"), timeInput),
          ]
        : null,
    ),
    updatesSection(),
    !isTauri() && !isStandalone() && (canPromptInstall() || isIos())
      ? h(
          "section",
          { class: "card" },
          h("h3", null, en() ? "Install app" : "安装应用"),
          isIos()
            ? h("p", { class: "small" }, en() ? "In Safari, tap Share (square with an arrow), then “Add to Home Screen”." : "在 Safari 中点击分享（带箭头的方框），再选“添加到主屏幕”。")
            : h("button", { class: "btn primary", onclick: async () => { if (await promptInstall()) renderMe(root); } }, en() ? "Install on this device" : "安装到本机"),
        )
      : null,
    h("p", { class: "muted small center" }, `${state.meta?.total ?? 0} ${en() ? "entries" : "条词目"} · v${APP_VERSION}`),
  );
}

function stat(num: string, text: string) {
  return h("div", { class: "stat" }, h("div", { class: "stat-num" }, num), h("div", { class: "stat-label" }, text));
}

const STATUS_TEXT: Record<UpdateStatus, [string, string]> = {
  idle: ["", ""],
  checking: ["正在检查…", "Checking…"],
  "up-to-date": ["已是最新版本", "You're on the latest version"],
  downloading: ["正在下载更新，稍后自动应用…", "Downloading an update; it will apply in a moment…"],
  offline: ["离线中，联网后会自动检查", "Offline; will check when you're back online"],
  error: ["检查失败，请稍后再试", "Couldn't check; try again later"],
  unsupported: ["", ""],
};

/** Me → Updates: current version, manual check and what's new. */
function updatesSection() {
  const status = h("p", { class: "small muted update-status" });
  const draw = () => {
    const [zh, enText] = STATUS_TEXT[updateState.status];
    const when = updateState.lastChecked
      ? new Date(updateState.lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;
    status.textContent = [en() ? enText : zh, when ? (en() ? `last checked ${when}` : `上次检查 ${when}`) : ""].filter(Boolean).join(" · ");
  };
  draw();
  const off = onUpdateState(() => (status.isConnected ? draw() : off()));
  const web = !isTauri();
  return h(
    "section",
    { class: "card" },
    h("h3", null, en() ? "Updates" : "更新"),
    h("div", { class: "row-between" }, h("strong", null, `${en() ? "Version" : "版本"} ${APP_VERSION}`), web ? h("button", { class: "btn", onclick: () => checkForUpdate() }, en() ? "Check for updates" : "检查更新") : null),
    web
      ? status
      : h("p", { class: "small muted" }, en() ? "New versions of this app come as a new APK." : "此应用的新版本需安装新的 APK。"),
    web ? h("p", { class: "small muted" }, en() ? "Updates install automatically: when you open the app, when you come back to it, and every 30 minutes." : "更新会自动安装：打开应用、返回应用时以及每 30 分钟检查一次。") : null,
    h(
      "details",
      { class: "changelog", open: true },
      h("summary", null, en() ? "What's new" : "更新内容"),
      CHANGELOG.slice(0, 5).map((r) =>
        h("div", { class: "release" }, h("div", { class: "release-head" }, h("strong", null, `v${r.version}`), h("span", { class: "muted small" }, r.date)), h("ul", null, (en() ? r.en : r.zh).map((line) => h("li", null, line)))),
      ),
    ),
  );
}
