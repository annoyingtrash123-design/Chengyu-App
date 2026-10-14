// Small DOM helpers, labels and shared app state.

import { api } from "./api";
import type { Kind, Meta, Register, Sentiment, Settings, Status, Summary } from "./types";

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown>;

/** Create an element: h("div", { class: "x", onclick: fn }, "text", child). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "class") {
      el.className = String(v);
    } else if (k in el && typeof v !== "string") {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

export function navigate(hash: string) {
  location.hash = hash;
}

// ---------- Shared state ----------

export const state: { settings: Settings; meta: Meta | null } = {
  settings: { daily_goal: 20, new_per_day: 10, show_english: true, reminders: false, reminder_time: "20:00" },
  meta: null,
};

export async function loadState() {
  [state.settings, state.meta] = await Promise.all([api.settings(), api.meta()]);
}

export async function saveSettings(patch: Partial<Settings>) {
  state.settings = await api.setSettings({ ...state.settings, ...patch });
}

export const en = () => state.settings.show_english;

// ---------- Labels ----------

export const KIND_LABEL: Record<Kind, { zh: string; en: string }> = {
  chengyu: { zh: "成语", en: "Chengyu" },
  suyu: { zh: "俗语", en: "Proverb" },
  xiehouyu: { zh: "歇后语", en: "Two-part saying" },
  guanyongyu: { zh: "惯用语", en: "Idiom phrase" },
  phrase: { zh: "四字词语", en: "Set phrase" },
};

export const SENTIMENT_LABEL: Record<Sentiment, { zh: string; en: string }> = {
  positive: { zh: "褒义", en: "Positive" },
  negative: { zh: "贬义", en: "Negative" },
  neutral: { zh: "中性", en: "Neutral" },
};

export const REGISTER_LABEL: Record<Register, { zh: string; en: string }> = {
  casual: { zh: "口语", en: "Casual" },
  neutral: { zh: "通用", en: "Neutral" },
  formal: { zh: "书面", en: "Formal" },
  literary: { zh: "文学", en: "Literary" },
};

export const FREQUENCY_LABEL: Record<number, { zh: string; en: string; stars: string }> = {
  1: { zh: "核心", en: "Core", stars: "★★★" },
  2: { zh: "常用", en: "Common", stars: "★★" },
  3: { zh: "文学", en: "Literary", stars: "★" },
};

export const STATUS_LABEL: Record<Status, { zh: string; en: string }> = {
  new: { zh: "未学", en: "New" },
  learning: { zh: "学习中", en: "Learning" },
  mastered: { zh: "已掌握", en: "Mastered" },
};

/** "成语 Chengyu" or just "成语" when English is off. */
export function label(l: { zh: string; en: string }): string {
  return en() ? `${l.zh} ${l.en}` : l.zh;
}

export function themeLabel(id: string): string {
  const t = state.meta?.themes.find((t) => t.id === id);
  return t ? label(t) : id;
}

export function meaningOf(s: { meaning: { en: string; zh: string } }): string {
  return en() ? s.meaning.en : s.meaning.zh;
}

// ---------- Common components ----------

export function badge(text: string, cls = "") {
  return h("span", { class: `badge ${cls}` }, text);
}

/** One row in a result list. */
export function entryRow(s: Summary) {
  return h(
    "a",
    { class: "entry-row", href: `#/entry/${s.id}` },
    h(
      "div",
      { class: "entry-row-head" },
      h("span", { class: "hanzi" }, s.text),
      s.favourite ? h("span", { class: "fav-mark", title: "Favourite" }, "♥") : null,
      h("span", { class: `freq freq-${s.frequency}`, title: FREQUENCY_LABEL[s.frequency]?.en }, FREQUENCY_LABEL[s.frequency]?.stars),
    ),
    h("div", { class: "pinyin" }, s.pinyin),
    h("div", { class: "meaning" }, meaningOf(s)),
    h(
      "div",
      { class: "badges" },
      badge(KIND_LABEL[s.kind].zh, `kind-${s.kind}`),
      badge(SENTIMENT_LABEL[s.sentiment].zh, `sent-${s.sentiment}`),
      s.status !== "new" ? badge(STATUS_LABEL[s.status].zh, `status-${s.status}`) : null,
    ),
  );
}

export function pageHeader(title: string, opts: { back?: boolean; right?: Child } = {}) {
  return h(
    "header",
    { class: "page-header" },
    opts.back ? h("button", { class: "icon-btn", "aria-label": "Back", onclick: () => history.back() }, "‹") : null,
    h("h1", null, title),
    h("div", { class: "header-right" }, opts.right ?? null),
  );
}

/** Small EN on/off switch for pages where you might want to hide English quickly. */
export function englishToggle(onChange: () => void) {
  const btn = h("button", { class: `chip toggle ${en() ? "on" : ""}`, "aria-pressed": String(en()) }, "EN");
  btn.addEventListener("click", async () => {
    await saveSettings({ show_english: !en() });
    onChange();
  });
  return btn;
}

export function toast(msg: string) {
  const t = h("div", { class: "toast" }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export function loading() {
  return h("div", { class: "loading" }, "加载中…");
}
