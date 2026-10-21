import { api } from "../api";
import { emptyFilters } from "../filters";
import { h, clear, en, entryRow } from "../ui";

// Kept between visits so going back to the dictionary restores your search.
const saved = { query: "" };

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
    clearTimeout(debounce);
    debounce = window.setTimeout(() => load(true), 150);
  });
  more.addEventListener("click", () => load(false));

  clear(root, h("div", { class: "search-bar" }, input), hint, count, list, more);
  await load(true);
  if (!saved.query) input.focus({ preventScroll: true });
}
