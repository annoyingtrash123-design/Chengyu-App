import { api } from "../api";
import { activeFilterCount, emptyFilters } from "../filters";
import type { Filters } from "../types";
import { h, clear, en, entryRow, pageHeader } from "../ui";
import { filterPanel, filterSummary } from "./filterpanel";

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

/** Open the List tab showing a single theme (used by theme chips on entry pages). */
export function showTheme(theme: string) {
  saved.filters = { ...emptyFilters(), themes: [theme] };
  persist();
  location.hash = "#/list";
}

const PAGE = 50;

/** Browse everything, narrowed by the drop-down panel of types and themes. */
export async function renderList(root: HTMLElement) {
  const bar = h("button", { class: "dropdown-bar", "aria-expanded": "false" });
  const panelSlot = h("div", { class: "panel-slot" });
  const count = h("div", { class: "muted small result-count" });
  const list = h("div", { class: "entry-list" });
  const more = h("button", { class: "btn block", hidden: true }, en() ? "Load more" : "加载更多");
  let open = false;
  let offset = 0;
  let seq = 0;

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
              load(true);
            },
            () => setOpen(false),
            () => {
              saved.filters = emptyFilters();
              setOpen(true); // redraw the panel cleared
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
    if (reset) offset = 0;
    const r = await api.search("", saved.filters, offset, PAGE);
    if (mine !== seq) return;
    if (reset) list.replaceChildren();
    if (r.total === 0) list.appendChild(h("div", { class: "empty" }, en() ? "Nothing matches this selection." : "没有符合条件的词条。"));
    r.items.forEach((s) => list.appendChild(entryRow(s)));
    offset += r.items.length;
    more.hidden = offset >= r.total;
    count.textContent = en() ? `${r.total} entr${r.total === 1 ? "y" : "ies"}` : `共 ${r.total} 条`;
  }

  bar.addEventListener("click", () => setOpen(!open));
  more.addEventListener("click", () => load(false));

  clear(root, pageHeader(en() ? "List" : "列表"), h("div", { class: "dropdown-wrap" }, bar, panelSlot), count, list, more);
  drawBar();
  await load(true);
}
