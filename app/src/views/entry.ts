import { api, today } from "../api";
import type { EntryDetail, Link } from "../types";
import {
  h,
  clear,
  en,
  badge,
  label,
  pageHeader,
  englishToggle,
  KIND_LABEL,
  SENTIMENT_LABEL,
  REGISTER_LABEL,
  FREQUENCY_LABEL,
  STATUS_LABEL,
  MODERN_LABEL,
  themeLabel,
} from "../ui";
import { showTheme } from "./list";

export async function renderEntry(root: HTMLElement, [id]: string[]) {
  const d = await api.entry(id);
  draw(root, d);
}

function draw(root: HTMLElement, d: EntryDetail) {
  const e = d.entry;
  const s = d.summary;
  const showEn = en();

  const favBtn = h("button", { class: `icon-btn fav ${s.favourite ? "on" : ""}`, "aria-label": "Favourite" }, s.favourite ? "♥" : "♡");
  favBtn.addEventListener("click", async () => {
    s.favourite = await api.toggleFavourite(e.id);
    favBtn.textContent = s.favourite ? "♥" : "♡";
    favBtn.classList.toggle("on", s.favourite);
  });

  const bi = (b: { zh: string; en: string }) =>
    h("div", { class: "bilingual" }, h("p", { class: "zh" }, b.zh), showEn ? h("p", { class: "en" }, b.en) : null);

  const links = (title: string, items: Link[]) =>
    items.length
      ? h(
          "div",
          { class: "links" },
          h("span", { class: "links-title" }, title),
          items.map((l) =>
            l.id
              ? h("a", { class: "chip link", href: `#/entry/${l.id}` }, l.text)
              : h("span", { class: "chip muted-chip", title: en() ? "Not in the dictionary yet" : "暂未收录" }, l.text),
          ),
        )
      : null;

  // 歇后语: show the lead-in, tap to reveal the punchline.
  const head =
    e.parts
      ? h(
          "div",
          { class: "xhy" },
          h("div", { class: "hanzi-xl" }, e.parts[0]),
          (() => {
            const p = h("button", { class: "punchline hidden-punch" }, en() ? "—— tap to reveal" : "—— 点击查看");
            p.addEventListener("click", () => {
              p.textContent = `—— ${e.parts![1]}`;
              p.classList.remove("hidden-punch");
            }, { once: true });
            return p;
          })(),
        )
      : h("div", { class: "hanzi-xl" }, e.text);

  const card = d.card;
  const progress = card
    ? `${label(STATUS_LABEL[s.status])} · ${
        card.due <= today() ? (en() ? "due now" : "今天复习") : en() ? `next review in ${card.due - today()} d` : `${card.due - today()} 天后复习`
      }${d.accuracy ? ` · ${Math.round((100 * d.accuracy.correct) / d.accuracy.seen)}%` : ""}`
    : label(STATUS_LABEL.new);

  clear(
    root,
    pageHeader("", { back: true, right: [englishToggle(() => draw(root, d)), favBtn] }),
    h(
      "section",
      { class: "entry-head" },
      head,
      h("div", { class: "pinyin-lg" }, e.pinyin),
      h(
        "div",
        { class: "badges" },
        badge(label(KIND_LABEL[e.kind]), `kind-${e.kind}`),
        badge(`${FREQUENCY_LABEL[e.frequency].stars} ${label(FREQUENCY_LABEL[e.frequency])}`, `freq-${e.frequency}`),
        badge(label(SENTIMENT_LABEL[e.sentiment]), `sent-${e.sentiment}`),
        badge(label(REGISTER_LABEL[e.register]), "reg"),
        e.modern ? badge(label(MODERN_LABEL[e.modern]), "modern") : null,
        badge(`${s.length}字${s.structure && s.length <= 4 ? ` · ${s.structure}` : ""}`, "len"),
      ),
    ),
    showEn
      ? h(
          "section",
          { class: "card" },
          h("h3", null, "字面 Literally"),
          h("p", { class: "gloss" }, e.literal),
          h("p", null, e.natural),
        )
      : null,
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "释义 Meaning" : "释义"),
      bi(e.meaning),
      showEn && e.equivalents.length
        ? h(
            "div",
            { class: "equivalents" },
            h("span", { class: "links-title" }, "English equivalents"),
            e.equivalents.map((q) => h("span", { class: "chip equiv" }, q)),
          )
        : null,
    ),
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "例句 Examples" : "例句"),
      e.examples.map((x) => h("div", { class: "example" }, h("p", { class: "zh" }, highlight(x.zh, e.parts ? e.parts[0] : e.text)), showEn ? h("p", { class: "en" }, x.en) : null)),
    ),
    e.origin
      ? h(
          "section",
          { class: "card" },
          h("h3", null, en() ? "出处 Origin" : "出处"),
          e.origin.source ? h("p", { class: "source" }, e.origin.source) : null,
          bi(e.origin.story),
        )
      : null,
    h("section", { class: "card" }, h("h3", null, en() ? "用法 Usage" : "用法"), bi(e.usage)),
    e.synonyms.length || e.antonyms.length
      ? h("section", { class: "card" }, links(en() ? "近义 Synonyms" : "近义", d.synonyms), links(en() ? "反义 Antonyms" : "反义", d.antonyms))
      : null,
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "主题 Themes" : "主题"),
      h("div", { class: "chip-group" }, e.themes.map((t) => h("button", { class: "chip", onclick: () => showTheme(t) }, themeLabel(t)))),
    ),
    h("section", { class: "card muted small" }, h("strong", null, en() ? "My progress: " : "学习进度："), progress),
  );
}

/** Wrap occurrences of the expression in a highlight span. */
function highlight(sentence: string, phrase: string) {
  const parts = sentence.split(phrase);
  if (parts.length === 1) return sentence;
  const out: (string | Node)[] = [];
  parts.forEach((p, i) => {
    if (i) out.push(h("mark", null, phrase));
    out.push(p);
  });
  return h("span", null, out);
}
