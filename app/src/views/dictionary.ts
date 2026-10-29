import { api } from "../api";
import { startSearching } from "../nav";
import { emptyFilters } from "../filters";
import { h, clear, en, entryRow } from "../ui";

// Kept between visits so going back to the dictionary restores your search.
const saved = { query: "" };
/** Empty the search box (next time the Search page is drawn). */
export const clearSearch = () => (saved.query = "");
/** Whether anything is typed in the search box. */
export const searching = () => saved.query.trim() !== "";

const PAGE = 40;

/** Search page: empty until you type. Browsing everything lives on the List tab. */
export async function renderDictionary(root: HTMLElement) {
  const input = h("input", {
    type: "search",
    class: "search-input",
    placeholder: en() ? "Search 汉字, pinyin or English" : "输入汉字、拼音或英文",
    value: saved.query,
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: false,
    "aria-label": "Search",
  });
  const count = h("div", { class: "muted small result-count" });
  const list = h("div", { class: "entry-list" });
  const more = h("button", { class: "btn block", hidden: true }, en() ? "Load more" : "加载更多");
  // Blank until something is typed.
  // Blank until something is typed.
  const hint = h("div", { class: "search-hint" });

  let offset = 0;
  let seq = 0;

  async function load(reset: boolean) {
    const mine = ++seq;
    if (reset) offset = 0;
    const q = saved.query.trim();
    hint.hidden = q !== "";
    if (!q) {
      list.replaceChildren();
      count.textContent = "";
      more.hidden = true;
      return;
    }
    const r = await api.search(q, emptyFilters(), offset, PAGE);
    if (mine !== seq) return; // a newer search started meanwhile
    if (reset) list.replaceChildren();
    if (r.total === 0) {
      list.appendChild(h("div", { class: "empty" }, en() ? "No matches. Try another spelling." : "没有找到，换个写法试试。"));
    }
    r.items.forEach((s) => list.appendChild(entryRow(s)));
    offset += r.items.length;
    more.hidden = offset >= r.total;
    count.textContent = r.total ? (en() ? `${r.total} result${r.total === 1 ? "" : "s"}` : `共 ${r.total} 条`) : "";
  }

  let debounce: number | undefined;
  input.addEventListener("input", () => {
    saved.query = input.value;
    if (saved.query.trim()) startSearching();
    clearTimeout(debounce);
    debounce = window.setTimeout(() => load(true), 150);
  });
  more.addEventListener("click", () => load(false));

  // The search box sits at the bottom, just above the tab bar, within reach of a thumb.
  const clearBtn = h("button", { class: "search-clear", "aria-label": en() ? "Clear" : "清除", hidden: !saved.query }, "×");
  clearBtn.addEventListener("click", () => {
    input.value = saved.query = "";
    clearBtn.hidden = true;
    load(true);
    input.focus();
  });
  input.addEventListener("input", () => (clearBtn.hidden = !input.value));
  // With nothing typed, a tap anywhere on the empty page opens the keyboard.
  root.addEventListener("click", (e) => {
    if (!saved.query.trim() && !(e.target as HTMLElement).closest("a, button")) input.focus();
  });

  root.classList.add("search-page");
  clear(root, hint, count, list, more, h("div", { class: "search-bar bottom" }, searchIcon(), input, clearBtn));
  // No autofocus: opening the tab shouldn't throw up the keyboard (and squeeze the page); tap the box to type.
  await load(true);
}

/** Magnifying-glass icon for the search box. */
function searchIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "search-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  return svg;
}
