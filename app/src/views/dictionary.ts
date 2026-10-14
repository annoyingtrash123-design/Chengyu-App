import { api } from "../api";
import type { Filters, Kind, Register, Sentiment, Status } from "../types";
import { activeFilterCount, emptyFilters } from "../filters";

export { emptyFilters };
import {
  h,
  clear,
  en,
  entryRow,
  label,
  state,
  KIND_LABEL,
  SENTIMENT_LABEL,
  REGISTER_LABEL,
  FREQUENCY_LABEL,
  STATUS_LABEL,
  themeLabel,
} from "../ui";

// Kept between visits so going back to the dictionary restores your search.
const saved = { query: "", filters: emptyFilters() };

/** Open the dictionary with a single theme selected (used by theme chips). */
export function showTheme(theme: string) {
  saved.query = "";
  saved.filters = { ...emptyFilters(), themes: [theme] };
  location.hash = "#/dict";
}

const PAGE = 40;

export async function renderDictionary(root: HTMLElement) {
  const input = h("input", {
    type: "search",
    class: "search-input",
    placeholder: en() ? "汉字 / pinyin / English…" : "输入汉字、拼音…",
    value: saved.query,
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: false,
  });
  const filterBtn = h("button", { class: "btn filter-btn" });
  const chips = h("div", { class: "active-chips" });
  const count = h("div", { class: "muted small result-count" });
  const list = h("div", { class: "entry-list" });
  const more = h("button", { class: "btn block", hidden: true }, en() ? "Load more" : "加载更多");

  let offset = 0;
  let seq = 0;

  async function load(reset: boolean) {
    const mine = ++seq;
    if (reset) offset = 0;
    const r = await api.search(saved.query, saved.filters, offset, PAGE);
    if (mine !== seq) return; // a newer search started meanwhile
    if (reset) list.replaceChildren();
    if (r.total === 0) {
      list.appendChild(h("div", { class: "empty" }, en() ? "No matches. Try fewer filters or another spelling." : "没有找到，试试减少筛选条件。"));
    }
    r.items.forEach((s) => list.appendChild(entryRow(s)));
    offset += r.items.length;
    more.hidden = offset >= r.total;
    count.textContent = en() ? `${r.total} result${r.total === 1 ? "" : "s"}` : `共 ${r.total} 条`;
  }

  function refreshChips() {
    const n = activeFilterCount(saved.filters);
    filterBtn.textContent = (en() ? "Filters" : "筛选") + (n ? ` · ${n}` : "");
    filterBtn.classList.toggle("on", n > 0);
    const f = saved.filters;
    const all: [string, () => void][] = [
      ...f.kinds.map((k) => [KIND_LABEL[k].zh, () => (f.kinds = f.kinds.filter((x) => x !== k))] as [string, () => void]),
      ...f.themes.map((t) => [themeLabel(t), () => (f.themes = f.themes.filter((x) => x !== t))] as [string, () => void]),
      ...f.lengths.map((l) => [`${l === 8 ? "8+" : l}字`, () => (f.lengths = f.lengths.filter((x) => x !== l))] as [string, () => void]),
      ...f.structures.map((s) => [s, () => (f.structures = f.structures.filter((x) => x !== s))] as [string, () => void]),
      ...f.frequencies.map((q) => [FREQUENCY_LABEL[q].zh, () => (f.frequencies = f.frequencies.filter((x) => x !== q))] as [string, () => void]),
      ...f.sentiments.map((s) => [SENTIMENT_LABEL[s].zh, () => (f.sentiments = f.sentiments.filter((x) => x !== s))] as [string, () => void]),
      ...f.registers.map((r) => [REGISTER_LABEL[r].zh, () => (f.registers = f.registers.filter((x) => x !== r))] as [string, () => void]),
      ...f.statuses.map((s) => [STATUS_LABEL[s].zh, () => (f.statuses = f.statuses.filter((x) => x !== s))] as [string, () => void]),
      ...(f.favourites_only ? [["♥", () => (f.favourites_only = false)] as [string, () => void]] : []),
      ...(f.has_origin ? [[en() ? "Has story" : "有典故", () => (f.has_origin = false)] as [string, () => void]] : []),
    ];
    clear(
      chips,
      all.map(([text, remove]) =>
        h("button", { class: "chip on removable", onclick: () => { remove(); refreshChips(); load(true); } }, text, " ×"),
      ),
    );
  }

  let debounce: number | undefined;
  input.addEventListener("input", () => {
    saved.query = input.value;
    clearTimeout(debounce);
    debounce = window.setTimeout(() => load(true), 150);
  });
  more.addEventListener("click", () => load(false));
  filterBtn.addEventListener("click", () =>
    openFilterSheet(saved.filters, (f) => {
      saved.filters = f;
      refreshChips();
      load(true);
    }),
  );

  clear(
    root,
    h("div", { class: "search-bar" }, input, filterBtn),
    chips,
    count,
    list,
    more,
  );
  refreshChips();
  await load(true);
  if (!saved.query) input.focus({ preventScroll: true });
}

// ---------- Filter sheet ----------

function chipGroup<T>(values: T[], selected: T[], text: (v: T) => string, onToggle: (next: T[]) => void) {
  const wrap = h("div", { class: "chip-group" });
  let current = [...selected];
  const draw = () =>
    clear(
      wrap,
      values.map((v) =>
        h(
          "button",
          {
            class: `chip ${current.includes(v) ? "on" : ""}`,
            "aria-pressed": String(current.includes(v)),
            onclick: () => {
              current = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
              onToggle(current);
              draw();
            },
          },
          text(v),
        ),
      ),
    );
  draw();
  return wrap;
}

function section(title: string, ...body: (Node | null)[]) {
  return h("section", { class: "sheet-section" }, h("h3", null, title), ...body);
}

export function openFilterSheet(initial: Filters, onApply: (f: Filters) => void) {
  const f: Filters = structuredClone(initial);
  const meta = state.meta!;
  const t = (zh: string, enText: string) => (en() ? `${zh} ${enText}` : zh);

  const overlay = h("div", { class: "sheet-overlay" });
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => e.target === overlay && close());

  const themesAll = h("button", { class: `chip small ${f.themes_all ? "on" : ""}` });
  const drawThemesAll = () => {
    themesAll.textContent = f.themes_all ? (en() ? "Match ALL selected" : "全部满足") : (en() ? "Match ANY selected" : "满足任一");
    themesAll.classList.toggle("on", f.themes_all);
  };
  themesAll.addEventListener("click", () => {
    f.themes_all = !f.themes_all;
    drawThemesAll();
  });
  drawThemesAll();

  const toggle = (text: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h("button", { class: `chip ${get() ? "on" : ""}` }, text);
    b.addEventListener("click", () => {
      set(!get());
      b.classList.toggle("on", get());
    });
    return b;
  };

  const sheet = h(
    "div",
    { class: "sheet", role: "dialog", "aria-label": "Filters" },
    h("div", { class: "sheet-handle" }),
    h("div", { class: "row-between" }, h("h2", null, t("筛选", "Filters")), h("button", { class: "icon-btn", onclick: close, "aria-label": "Close" }, "×")),
    section(
      t("类型", "Type"),
      chipGroup<Kind>(["chengyu", "suyu", "xiehouyu", "guanyongyu"], f.kinds, (k) => `${label(KIND_LABEL[k])} (${meta.kinds[k]})`, (v) => (f.kinds = v)),
    ),
    section(
      t("主题", "Theme"),
      chipGroup(meta.themes.map((x) => x.id), f.themes, themeLabel, (v) => (f.themes = v)),
      h("div", { class: "sheet-note" }, themesAll),
    ),
    section(t("字数", "Characters"), chipGroup([3, 4, 5, 6, 7, 8], f.lengths, (l) => (l === 8 ? "8+" : String(l)), (v) => (f.lengths = v))),
    section(t("结构", "Pattern"), chipGroup(meta.structures, f.structures, (s) => s, (v) => (f.structures = v))),
    section(
      t("常用度", "How common"),
      chipGroup([1, 2, 3], f.frequencies, (q) => `${FREQUENCY_LABEL[q].stars} ${label(FREQUENCY_LABEL[q])}`, (v) => (f.frequencies = v)),
    ),
    section(t("感情色彩", "Sentiment"), chipGroup<Sentiment>(["positive", "neutral", "negative"], f.sentiments, (s) => label(SENTIMENT_LABEL[s]), (v) => (f.sentiments = v))),
    section(t("语体", "Register"), chipGroup<Register>(["casual", "neutral", "formal", "literary"], f.registers, (r) => label(REGISTER_LABEL[r]), (v) => (f.registers = v))),
    section(t("学习状态", "My progress"), chipGroup<Status>(["new", "learning", "mastered"], f.statuses, (s) => label(STATUS_LABEL[s]), (v) => (f.statuses = v))),
    section(
      t("其他", "Other"),
      h(
        "div",
        { class: "chip-group" },
        toggle(t("♥ 收藏", "Favourites"), () => f.favourites_only, (v) => (f.favourites_only = v)),
        toggle(t("有典故", "Has origin story"), () => f.has_origin, (v) => (f.has_origin = v)),
      ),
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { class: "btn", onclick: () => { onApply(emptyFilters()); close(); } }, t("清除", "Clear all")),
      h("button", { class: "btn primary", onclick: () => { onApply(f); close(); } }, t("应用", "Apply")),
    ),
  );
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
