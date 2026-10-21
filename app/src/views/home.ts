import { api } from "../api";
import { h, clear, en, badge, label, KIND_LABEL, FREQUENCY_LABEL, englishToggle, sourceDate } from "../ui";

/** Home: the chengyu of the day as a full feature: meaning, origin story and examples. */
export async function renderHome(root: HTMLElement) {
  const daily = await api.daily();
  const detail = daily ? await api.entry(daily.id) : null;
  const showEn = en();
  const date = new Date().toLocaleDateString(showEn ? "en-GB" : "zh-CN", { weekday: "long", day: "numeric", month: "long" });

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
  const e = detail.entry;
  const highlight = (sentence: string, phrase: string) => {
    const parts = sentence.split(phrase);
    if (parts.length === 1) return sentence;
    return h("span", null, parts.flatMap((p, i) => (i ? [h("mark", null, phrase), p] : [p])));
  };

  clear(
    root,
    header,
    h(
      "article",
      { class: "feature" },
      h("div", { class: "eyebrow" }, `${showEn ? "Chengyu of the day" : "每日一词"} · ${date}`),
      h("div", { class: "feature-text" }, e.text),
      h("div", { class: "pinyin-lg" }, e.pinyin),
      h(
        "div",
        { class: "badges" },
        badge(label(KIND_LABEL[e.kind]), `kind-${e.kind}`),
        badge(`${FREQUENCY_LABEL[e.frequency].stars} ${label(FREQUENCY_LABEL[e.frequency])}`, `freq-${e.frequency}`),
      ),
      showEn ? h("p", { class: "feature-literal" }, h("span", { class: "gloss" }, e.literal), " — ", e.natural) : null,
      h("section", { class: "feature-section" }, h("h3", null, showEn ? "释义 Meaning" : "释义"), h("p", { class: "zh" }, e.meaning.zh), showEn ? h("p", { class: "en" }, e.meaning.en) : null,
        showEn && e.equivalents.length ? h("div", { class: "equivalents" }, e.equivalents.map((q) => h("span", { class: "chip equiv" }, q))) : null),
      e.origin
        ? h(
            "section",
            { class: "feature-section story" },
            h("h3", null, showEn ? "典故 The story" : "典故"),
            e.origin.source ? h("p", { class: "source" }, e.origin.source, sourceDate(e.origin.date)) : null,
            h("p", { class: "zh story-text" }, e.origin.story.zh),
            showEn ? h("p", { class: "en story-text" }, e.origin.story.en) : null,
          )
        : null,
      h(
        "section",
        { class: "feature-section" },
        h("h3", null, showEn ? "例句 Examples" : "例句"),
        e.examples.map((x) =>
          h("div", { class: "example" }, h("p", { class: "zh" }, highlight(x.zh, e.parts ? e.parts[0] : e.text)), showEn ? h("p", { class: "en" }, x.en) : null),
        ),
      ),
      h("section", { class: "feature-section" }, h("h3", null, showEn ? "用法 Usage" : "用法"), h("p", { class: "zh" }, e.usage.zh), showEn ? h("p", { class: "en" }, e.usage.en) : null),
      h("a", { class: "btn block feature-link", href: `#/entry/${e.id}` }, showEn ? "Open full entry ›" : "查看完整词条 ›"),
    ),
  );
}
