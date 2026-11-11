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
  linked,
  sourceDate,
  state,
  refreshMyTags,
} from "../ui";
import { showTheme } from "./list";

// 歇后语 whose punchline you've revealed (kept while the app is open).
const revealedPunchlines = new Set<string>();

export async function renderEntry(root: HTMLElement, [id]: string[]) {
  const d = await api.entry(id);
  api.view(id).catch(() => {});
  draw(root, d);
}

function draw(root: HTMLElement, d: EntryDetail) {
  clear(root, pageHeader("", { back: true, right: [englishToggle(() => draw(root, d)), favouriteButton(d)] }), ...entryBody(d, () => draw(root, d)));
}

/** Heart button that toggles the entry as a favourite. */
export function favouriteButton(d: EntryDetail) {
  const s = d.summary;
  const favBtn = h("button", { class: `icon-btn fav ${s.favourite ? "on" : ""}`, "aria-label": en() ? "Favourite" : "收藏", "aria-pressed": String(s.favourite) }, s.favourite ? "♥" : "♡");
  favBtn.addEventListener("click", async () => {
    s.favourite = await api.toggleFavourite(d.entry.id);
    favBtn.textContent = s.favourite ? "♥" : "♡";
    favBtn.classList.toggle("on", s.favourite);
    favBtn.setAttribute("aria-pressed", String(s.favourite));
  });
  return favBtn;
}

/** Everything on an entry page below the header (also shown in full on Home for the chengyu of the day). */
export function entryBody(d: EntryDetail, redraw: () => void): Node[] {
  const e = d.entry;
  const s = d.summary;
  const showEn = en();

  // Other expressions in the Chinese text (e.g. 沟壑纵横 in a gloss) are tappable when they have an entry.
  const bi = (b: { zh: string; en: string }) =>
    h("div", { class: "bilingual" }, h("p", { class: "zh" }, linked(b.zh, [e.id])), showEn ? h("p", { class: "en" }, b.en) : null);

  // A synonym that praises where this entry criticises (or the reverse) gets a small 褒 / 贬 mark.
  const tone = (l: Link, mark: boolean) =>
    mark && l.sentiment && l.sentiment !== "neutral" && e.sentiment !== "neutral" && l.sentiment !== e.sentiment
      ? h("span", { class: `tone tone-${l.sentiment}`, title: en() ? (l.sentiment === "positive" ? "Praise" : "Criticism") : "" }, l.sentiment === "positive" ? "褒" : "贬")
      : null;
  const links = (title: string, items: Link[], mark = false) =>
    items.length
      ? h(
          "div",
          { class: "links" },
          h("span", { class: "links-title" }, title),
          items.map((l) =>
            l.id
              ? h("a", { class: "chip link", href: `#/entry/${l.id}` }, l.text, tone(l, mark))
              : h("span", { class: "chip muted-chip", title: en() ? "Not in the dictionary yet" : "暂未收录" }, l.text),
          ),
        )
      : null;

  // 歇后语: show only the lead-in; the punchline and everything that gives it away
  // (its pinyin, translations, examples) stay hidden until you tap to reveal.
  const concealed = !!e.parts && !revealedPunchlines.has(e.id);
  const reveal = () => {
    revealedPunchlines.add(e.id);
    redraw();
  };
  const head =
    e.parts
      ? h(
          "div",
          { class: "xhy" },
          h("h1", { class: "hanzi-xl" }, e.parts[0]),
          concealed
            ? h("button", { class: "punchline hidden-punch", onclick: reveal }, en() ? "—— tap to reveal the punchline" : "—— 点击查看后半句")
            : h("div", { class: "punchline" }, `—— ${e.parts[1]}`),
        )
      : h("h1", { class: "hanzi-xl" }, e.text);
  const pinyinText = concealed ? `${e.pinyin.split("——")[0].trim()} —— …` : e.pinyin;

  const card = d.card;
  const progress = card
    ? `${label(STATUS_LABEL[s.status])} · ${
        card.due <= today() ? (en() ? "due now" : "今天复习") : en() ? `next review in ${card.due - today()} d` : `${card.due - today()} 天后复习`
      }${d.accuracy ? ` · ${Math.round((100 * d.accuracy.correct) / d.accuracy.seen)}%` : ""}`
    : label(STATUS_LABEL.new);

  return [
    h(
      "section",
      { class: "entry-head" },
      head,
      h("div", { class: "pinyin-lg" }, pinyinText),
      variantLines(e),
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
    h(
      "div",
      { class: concealed ? "concealed" : "", "aria-hidden": concealed ? "true" : null, onclick: concealed ? reveal : null },
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
      e.examples.map((x) => h("div", { class: "example" }, h("p", { class: "zh" }, highlight(x.zh, e.parts ? [e.parts[0]] : [e.text, ...(e.variants ?? [])], e.id)), showEn ? h("p", { class: "en" }, x.en) : null)),
    ),
    e.origin
      ? h(
          "section",
          { class: "card" },
          h("h3", null, en() ? "出处 Origin" : "出处"),
          e.origin.source ? h("p", { class: "source" }, e.origin.source, sourceDate(e.origin.date)) : null,
          bi(e.origin.story),
        )
      : null,
    h("section", { class: "card" }, h("h3", null, en() ? "用法 Usage" : "用法"), bi(e.usage)),
    e.synonyms.length || e.antonyms.length
      ? h("section", { class: "card" }, links(en() ? "近义 Synonyms" : "近义", d.synonyms, true), links(en() ? "反义 Antonyms" : "反义", d.antonyms))
      : null,
    h(
      "section",
      { class: "card" },
      h("h3", null, en() ? "标签 Labels" : "标签"),
      h("div", { class: "chip-group" }, e.themes.map((t) => h("button", { class: "chip", onclick: () => showTheme(t) }, themeLabel(t)))),
    ),
    ),
    myTagsCard(d),
    h("section", { class: "card muted small" }, h("strong", null, en() ? "My progress: " : "学习进度："), progress),
  ];
}

/** The learner's own tags on this entry: tap a tag to put it on or take it off, or make a new one. */
function myTagsCard(d: EntryDetail) {
  const box = h("div", { class: "chip-group" });
  const draw = () => {
    const names = [...new Set([...state.myTags.map((t) => t.name), ...d.my_tags])].sort();
    clear(
      box,
      names.map((n) => {
        const on = d.my_tags.includes(n);
        return h(
          "button",
          {
            class: `chip ${on ? "on" : ""}`,
            "aria-pressed": String(on),
            onclick: async () => {
              await api.setTag(d.entry.id, n, !on);
              d.my_tags = on ? d.my_tags.filter((x) => x !== n) : [...d.my_tags, n];
              await refreshMyTags();
              draw();
            },
          },
          n,
        );
      }),
      h(
        "button",
        {
          class: "chip add-tag",
          onclick: async () => {
            const name = prompt(en() ? "New tag name (e.g. Exam, Essay words, Favourites from class)" : "新标签名称（如：考试、作文用词）")?.trim();
            if (!name) return;
            await api.setTag(d.entry.id, name, true);
            if (!d.my_tags.includes(name)) d.my_tags = [...d.my_tags, name];
            await refreshMyTags();
            draw();
          },
        },
        en() ? "+ New tag" : "+ 新标签",
      ),
    );
  };
  draw();
  return h(
    "section",
    { class: "card" },
    h("h3", null, en() ? "我的标签 My tags" : "我的标签"),
    h("p", { class: "muted small" }, en() ? "Your own tags, only on this device. Filter by them in List, or study them as a deck." : "自己的标签，只保存在本机。可在列表中筛选，或作为学习卡组。"),
    box,
  );
}

/**
 * Wrap occurrences of the expression (or one of its variants) in a highlight span;
 * other expressions in the sentence become tappable.
 */
function highlight(sentence: string, phrases: string[], self: string) {
  const phrase = phrases.find((p) => sentence.includes(p));
  if (!phrase) return linked(sentence, [self]);
  const out: (string | Node)[] = [];
  sentence.split(phrase).forEach((p, i) => {
    if (i) out.push(h("mark", null, phrase));
    if (p) out.push(linked(p, [self]));
  });
  return h("span", null, out);
}

const VARIANT_HEAD: Record<string, [string, string]> = {
  alt: ["也作", "Also written"],
  old: ["旧作", "Older form"],
  full: ["全作", "Full form"],
  short: ["简作", "Short form"],
  error: ["误作", "Common error"],
};

/** The other forms of an expression, grouped: equal alternatives first, common errors (误作) last. */
function variantLines(e: EntryDetail["entry"]) {
  if (!e.variants?.length) return null;
  const groups = new Map<string, string[]>();
  for (const v of e.variants) {
    const kind = e.variant_kinds?.[v] ?? "alt";
    groups.set(kind, [...(groups.get(kind) ?? []), v]);
  }
  return h(
    "div",
    { class: "variants" },
    ["alt", "old", "full", "short", "error"]
      .filter((k) => groups.has(k))
      .map((k) => {
        const [zh, enText] = VARIANT_HEAD[k];
        const forms = groups.get(k)!;
        return h(
          "div",
          { class: `variant-line variant-${k}` },
          h("span", { class: "variant-head" }, en() ? `${zh} ${enText}` : zh),
          " ",
          forms.join("、"),
        );
      }),
  );
}
