import { api } from "../api";
import { activeFilterCount, emptyFilters } from "../filters";
import type { Filters, Summary } from "../types";
import { h, clear, en, entryRow, pageHeader, state, themeLabel, KIND_LABEL, toast } from "../ui";
import { filterPanel, filterSummary } from "./filterpanel";
import { fastScroller, firstVisibleIndex } from "./fastscroll";

// Kept between visits, and across app restarts, so the list stays as you left it.
const LIST_KEY = "chengyu-list-filters";
function loadSaved(): Filters {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (raw) return { ...emptyFilters(), ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return emptyFilters();
}
function persist() {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(saved.filters));
  } catch {
    // ignore
  }
}
const saved = { filters: loadSaved() };

/** Open the List tab with the given filters (e.g. from the contents map on Me). */
export function showFilters(f: Partial<Filters>) {
  saved.filters = { ...emptyFilters(), ...f };
  persist();
  location.hash = "#/list";
}

/** Open the List tab showing a single theme (used by theme chips on entry pages). */
export function showTheme(theme: string) {
  showFilters({ themes: [theme] });
}

const PAGE = 50;

const themeCount = (id: string) => state.meta?.theme_counts?.[id] ?? 0;

/** Labels whose Chinese or English name (or id) contains the query, most entries first. */
function findLabels(q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return (state.meta?.themes ?? [])
    .filter((t) => themeCount(t.id) > 0)
    .filter((t) => t.zh.includes(needle) || t.en.toLowerCase().includes(needle) || t.id.replace(/-/g, " ").includes(needle))
    .sort((a, b) => themeCount(b.id) - themeCount(a.id));
}

/** Browse everything, narrowed by the drop-down panel of types and themes. */
export async function renderList(root: HTMLElement) {
  const bar = h("button", { class: "dropdown-bar", "aria-expanded": "false" });
  const panelSlot = h("div", { class: "panel-slot" });
  const count = h("div", { class: "muted small result-count" });
  const list = h("div", { class: "entry-list" });
  const more = h("button", { class: "btn block", hidden: true }, en() ? "Load more" : "加载更多");
  const labelInput = h("input", {
    type: "search",
    class: "search-input label-search",
    placeholder: en() ? "Search labels 搜索标签 (e.g. 三十六计, friendship)" : "搜索标签，如：三十六计、友情、思乡",
    "aria-label": "Search labels",
  });
  const labelResults = h("div", { class: "label-results" });
  let total = 0;

  function toggleTheme(id: string) {
    const f = saved.filters;
    f.themes = f.themes.includes(id) ? f.themes.filter((x) => x !== id) : [...f.themes, id];
    drawLabels();
    drawBar();
    if (open) setOpen(true);
    load(true);
  }

  const labelChip = (id: string) =>
    h(
      "button",
      { class: `chip ${saved.filters.themes.includes(id) ? "on" : ""}`, onclick: () => toggleTheme(id) },
      `${themeLabel(id)} (${themeCount(id)})`,
    );

  /** Search results while typing; otherwise the labels currently selected. */
  function drawLabels() {
    const q = labelInput.value;
    if (q.trim()) {
      const hits = findLabels(q);
      clear(labelResults, h("div", { class: "chip-group" }, hits.length ? hits.slice(0, 24).map((t) => labelChip(t.id)) : h("span", { class: "muted small" }, en() ? "No label matches." : "没有匹配的标签。")));
      return;
    }
    const selected = saved.filters.themes;
    clear(labelResults, selected.length ? h("div", { class: "chip-group" }, selected.map((id) => labelChip(id))) : null);
  }
  labelInput.addEventListener("input", drawLabels);
  let open = false;
  let start = 0; // index of the first loaded row (after a fast-scroll jump the list starts mid-way)
  let end = 0; // index after the last loaded row
  let seq = 0;
  let busy = false;
  const earlier = h("button", { class: "btn block", hidden: true }, en() ? "Show earlier entries" : "显示前面的词条");
  const row = (s: Summary, i: number) => {
    const el = entryRow(s);
    el.dataset.index = String(i);
    return el;
  };
  const scrollToRow = (i: number) => {
    const el = list.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12 });
  };
  const scroller = fastScroller({ total: () => total, current: () => firstVisibleIndex(list), jump: (i) => jumpTo(i) });

  /** Show row `i`: scroll to it if loaded, load on to it if close, otherwise reload the list starting near it. */
  async function jumpTo(i: number) {
    if (i >= start && i < end) return scrollToRow(i);
    const mine = ++seq;
    busy = true;
    let from: number;
    let n: number;
    if (i >= end && i - end <= 200) {
      from = end;
      n = i - end + PAGE;
    } else {
      from = Math.max(0, i - 5);
      n = PAGE * 2;
    }
    const r = await api.search("", saved.filters, from, n);
    busy = false;
    if (mine !== seq) return;
    const rows = r.items.map((s, k) => row(s, from + k));
    if (from === end) list.append(...rows);
    else {
      list.replaceChildren(...rows);
      start = from;
    }
    end = from + r.items.length;
    earlier.hidden = start === 0;
    more.hidden = end >= total;
    scrollToRow(i);
    scroller.update();
  }

  async function loadEarlier() {
    const n = Math.min(PAGE, start);
    const from = start - n;
    const r = await api.search("", saved.filters, from, n);
    const first = list.firstElementChild as HTMLElement | null;
    const before = first?.getBoundingClientRect().top ?? 0;
    list.prepend(...r.items.map((s, k) => row(s, from + k)));
    start = from;
    earlier.hidden = start === 0;
    if (first) window.scrollBy(0, first.getBoundingClientRect().top - before);
  }

  function drawBar() {
    const n = activeFilterCount(saved.filters);
    clear(
      bar,
      h("span", { class: "dropdown-label" + (n ? " on" : "") }, filterSummary(saved.filters)),
      h("span", { class: "dropdown-caret", "aria-hidden": "true" }, open ? "▴" : "▾"),
    );
    bar.setAttribute("aria-expanded", String(open));
  }

  function setOpen(v: boolean) {
    open = v;
    clear(
      panelSlot,
      open
        ? filterPanel(
            saved.filters,
            () => {
              drawBar();
              drawLabels();
              load(true);
            },
            () => setOpen(false),
            () => {
              saved.filters = emptyFilters();
              setOpen(true); // redraw the panel cleared
              drawLabels();
              load(true);
            },
          )
        : null,
    );
    drawBar();
  }

  async function load(reset: boolean) {
    persist();
    const mine = ++seq;
    if (reset) start = end = 0;
    busy = true;
    const r = await api.search("", saved.filters, end, PAGE);
    busy = false;
    if (mine !== seq) return;
    if (reset) list.replaceChildren();
    if (r.total === 0) list.appendChild(h("div", { class: "empty" }, en() ? "Nothing matches this selection." : "没有符合条件的词条。"));
    r.items.forEach((s, k) => list.appendChild(row(s, end + k)));
    end += r.items.length;
    total = r.total;
    more.hidden = end >= r.total;
    earlier.hidden = start === 0;
    scroller.update();
    count.textContent = en() ? `${r.total} entr${r.total === 1 ? "y" : "ies"}` : `共 ${r.total} 条`;
  }

  bar.addEventListener("click", () => setOpen(!open));
  more.addEventListener("click", () => load(false));
  earlier.addEventListener("click", loadEarlier);
  // Load the next page automatically when the end of the list comes into view.
  new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && !more.hidden && !busy && load(false), { rootMargin: "600px" }).observe(more);

  const exportBtn = h("button", { class: "btn small", onclick: () => exportPdf(saved.filters, total) }, en() ? "Export PDF 导出" : "导出 PDF");

  clear(
    root,
    pageHeader(en() ? "List" : "列表", { right: exportBtn }),
    labelInput,
    labelResults,
    h("div", { class: "dropdown-wrap" }, bar, panelSlot),
    count,
    earlier,
    list,
    more,
    scroller.el,
  );
  drawBar();
  drawLabels();
  await load(true);
}

/**
 * Print the whole current selection (not just the loaded page) as a clean list; the browser's
 * print dialog can save it as a PDF.
 */
async function exportPdf(filters: Filters, total: number) {
  if (!total) return toast(en() ? "Nothing to export." : "没有可导出的词条。");
  if (total > 3000 && !confirm(en() ? `Export all ${total} entries? This may take a moment.` : `导出全部 ${total} 条？可能需要一点时间。`)) return;
  const r = await api.search("", filters, 0, total);
  const title = filterSummaryText(filters);
  const row = (s: Summary) =>
    h(
      "div",
      { class: "print-entry" },
      h("div", { class: "print-head" }, h("span", { class: "print-hanzi" }, s.text), h("span", { class: "print-pinyin" }, s.pinyin), h("span", { class: "print-kind" }, KIND_LABEL[s.kind].zh)),
      h("div", { class: "print-meaning" }, s.meaning.zh),
      en() ? h("div", { class: "print-meaning en" }, s.meaning.en) : null,
    );
  document.getElementById("print-root")?.remove();
  const printRoot = h(
    "div",
    { id: "print-root" },
    h("h1", null, title),
    h("p", { class: "print-sub" }, `${r.total} ${en() ? "entries" : "条"} · ${new Date().toLocaleDateString()}`),
    r.items.map(row),
  );
  document.body.appendChild(printRoot);
  document.body.classList.add("printing");
  const done = () => {
    document.body.classList.remove("printing");
    printRoot.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  // Give the browser a frame to lay the page out before opening the dialog.
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}

function filterSummaryText(f: Filters) {
  const parts = [...f.kinds.map((k) => KIND_LABEL[k].zh), ...f.themes.map((x) => themeLabel(x))];
  return parts.length ? parts.join(" · ") : en() ? "All entries 全部词条" : "全部词条";
}
