import { api } from "../api";
import { h, clear, en, englishToggle } from "../ui";
import { entryBody, favouriteButton } from "./entry";

/** Home: the chengyu of the day, shown as the full entry. */
export async function renderHome(root: HTMLElement) {
  const daily = await api.daily();
  const detail = daily ? await api.entry(daily.id) : null;
  const showEn = en();

  const header = h(
    "header",
    { class: "hero" },
    h(
      "div",
      { class: "row-between" },
      h("div", { class: "hero-title" }, h("span", { class: "hero-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), "成语词典"),
      englishToggle(() => renderHome(root)),
    ),
  );

  if (!detail) {
    clear(root, header, h("div", { class: "empty" }, en() ? "No entries yet." : "暂无词条。"));
    return;
  }
  const date = new Date().toLocaleDateString(showEn ? "en-GB" : "zh-CN", { weekday: "long", day: "numeric", month: "long" });
  clear(
    root,
    header,
    h("div", { class: "row-between daily-bar" }, h("div", { class: "eyebrow" }, `${showEn ? "Chengyu of the day" : "每日一词"} · ${date}`), favouriteButton(detail)),
    ...entryBody(detail, () => renderHome(root)),
  );
}
