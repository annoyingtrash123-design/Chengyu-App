import { isTauri } from "../api";
import { h, clear, en, pageHeader, saveSettings, state, toast } from "../ui";
import { scheduleReminders } from "../notifications";
import { canPromptInstall, isIos, isStandalone, promptInstall } from "../install";
import { APP_VERSION, CHANGELOG } from "../changelog";
import { contentsMapCard } from "./mindmap";
import { checkForUpdate, onUpdateState, updateState, type UpdateStatus } from "../updates";

export async function renderMe(root: HTMLElement) {
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
    contentsMapCard(),
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
    aboutSection(),
    h("p", { class: "muted small center" }, `${state.meta?.total ?? 0} ${en() ? "entries" : "条词目"} · v${APP_VERSION}`),
  );
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
    "details",
    { class: "card collapsible" },
    h("summary", null, h("span", null, en() ? "Updates 更新" : "更新"), h("span", { class: "muted small" }, `v${APP_VERSION}`)),
    h("div", { class: "row-between" }, h("strong", null, `${en() ? "Version" : "版本"} ${APP_VERSION}`), web ? h("button", { class: "btn", onclick: () => checkForUpdate() }, en() ? "Check for updates" : "检查更新") : null),
    web
      ? status
      : h("p", { class: "small muted" }, en() ? "New versions of this app come as a new APK." : "此应用的新版本需安装新的 APK。"),
    web ? h("p", { class: "small muted" }, en() ? "Updates install automatically: when you open the app, when you come back to it, and every 30 minutes." : "更新会自动安装：打开应用、返回应用时以及每 30 分钟检查一次。") : null,
    h(
      "details",
      { class: "changelog" },
      h("summary", null, en() ? "What's new" : "更新内容"),
      CHANGELOG.slice(0, 5).map((r) =>
        h("div", { class: "release" }, h("div", { class: "release-head" }, h("strong", null, `v${r.version}`), h("span", { class: "muted small" }, r.date)), h("ul", null, (en() ? r.en : r.zh).map((line) => h("li", null, line)))),
      ),
    ),
  );
}

const MIT = (who: string) =>
  `MIT License\n\nCopyright (c) ${who}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const CREDITS: { name: string; by: string; use: [string, string]; licence: string; text?: string }[] = [
  { name: "THUOCL", by: "THUNLP, Tsinghua University", use: ["Idiom frequency ranks (used for the star ratings)", "成语词频排名（用于星级）"], licence: "MIT", text: MIT("2018 THUNLP") },
  { name: "chinese-xinhua", by: "pwxcoo", use: ["Idiom and two-part-saying lists, pinyin cross-checks", "成语与歇后语词表、拼音核对"], licence: "MIT", text: MIT("2018 pwxcoo") },
  { name: "jieba", by: "Sun Junyi", use: ["Word-frequency cross-checks when choosing entries", "选词时的词频核对"], licence: "MIT", text: MIT("2013 Sun Junyi") },
  { name: "CC-CEDICT", by: "MDBG", use: ["Cross-checking which expressions exist (no text copied)", "核对词条是否存在（未复制其内容）"], licence: "CC BY-SA 4.0" },
];

/** About the content, privacy and third-party licences, each folded away, at the bottom of Me. */
function aboutSection() {
  const fold = (title: string, ...body: (Node | Node[] | null)[]) =>
    h("details", { class: "card collapsible" }, h("summary", null, h("span", null, title)), ...body);
  const p = (zh: string, enText: string) => h("p", { class: "small" }, en() ? enText : zh);
  return [
    fold(
      en() ? "About the content 关于内容" : "关于内容",
      p(
        "词条的释义、例句、用法说明和出处由编者在人工智能辅助下撰写，并经多轮核对。出处只收录有可靠文献依据的；星级综合书面词频与母语者熟悉程度。如发现错误，欢迎反馈。",
        "Meanings, examples, usage notes and origins were written with AI assistance and checked in several review rounds. Origins are given only when well attested; star ratings combine written frequency with how familiar an expression is to native speakers. If you spot a mistake, please report it.",
      ),
    ),
    fold(
      en() ? "Privacy 隐私" : "隐私",
      p(
        "本应用不需要账号，不收集、不上传任何数据，也不含广告或统计追踪。收藏、学习进度、测验成绩和设置只保存在你的设备上；清除浏览器数据或卸载应用会将其删除。",
        "No account is needed. The app collects and uploads nothing, and has no ads or analytics. Favourites, study progress, quiz results and settings are stored only on your device; clearing site data or uninstalling the app deletes them.",
      ),
    ),
    fold(
      en() ? "Data sources & licences 数据来源与许可" : "数据来源与许可",
      h(
        "ul",
        { class: "credits small" },
        CREDITS.map((c) =>
          h(
            "li",
            null,
            h("strong", null, c.name),
            ` — ${c.by} · ${c.licence}`,
            h("div", { class: "muted" }, en() ? c.use[0] : c.use[1]),
            c.text ? h("details", { class: "licence" }, h("summary", null, en() ? "Licence text" : "许可全文"), h("pre", null, c.text)) : null,
          ),
        ),
      ),
    ),
  ];
}
