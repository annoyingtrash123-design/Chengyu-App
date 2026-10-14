import type { Filters, Kind, Register, Sentiment, Status } from "../types";
import { activeFilterCount } from "../filters";
import {
  h,
  clear,
  en,
  label,
  state,
  KIND_LABEL,
  SENTIMENT_LABEL,
  REGISTER_LABEL,
  FREQUENCY_LABEL,
  STATUS_LABEL,
  themeLabel,
} from "../ui";

// Shared filter controls: used by the List tab's drop-down panel.

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

/** Broad themes as chips; each selected or expanded broad theme shows its detailed themes. */
function themePicker(f: Filters, onChange: () => void) {
  const meta = state.meta!;
  // Only themes that have entries (plus any already selected), each with its count.
  const count = (id: string) => meta.theme_counts?.[id] ?? 0;
  const visible = (id: string) => count(id) > 0 || f.themes.includes(id);
  const groups = meta.themes.filter((x) => !x.group && visible(x.id));
  const children = (g: string) => meta.themes.filter((x) => x.group === g && visible(x.id));
  const named = (id: string) => `${themeLabel(id)} (${count(id)})`;
  const open = new Set(groups.filter((g) => f.themes.includes(g.id) || children(g.id).some((c) => f.themes.includes(c.id))).map((g) => g.id));
  const wrap = h("div", { class: "theme-picker" });
  const toggle = (id: string) => {
    f.themes = f.themes.includes(id) ? f.themes.filter((x) => x !== id) : [...f.themes, id];
    onChange();
  };
  const draw = () =>
    clear(
      wrap,
      groups.map((g) => {
        const kids = children(g.id);
        const selectedKids = kids.filter((c) => f.themes.includes(c.id)).length;
        return h(
          "div",
          { class: "theme-group" },
          h(
            "div",
            { class: "theme-group-row" },
            h(
              "button",
              { class: `chip ${f.themes.includes(g.id) ? "on" : ""}`, onclick: () => { toggle(g.id); draw(); } },
              named(g.id),
            ),
            kids.length
              ? h(
                  "button",
                  {
                    class: "chip small expander",
                    "aria-expanded": String(open.has(g.id)),
                    onclick: () => { open.has(g.id) ? open.delete(g.id) : open.add(g.id); draw(); },
                  },
                  `${open.has(g.id) ? "▾" : "▸"} ${kids.length}${selectedKids ? ` · ${selectedKids}✓` : ""}`,
                )
              : null,
          ),
          open.has(g.id)
            ? h(
                "div",
                { class: "chip-group theme-children" },
                kids.map((c) =>
                  h("button", { class: `chip small ${f.themes.includes(c.id) ? "on" : ""}`, onclick: () => { toggle(c.id); draw(); } }, named(c.id)),
                ),
              )
            : null,
        );
      }),
    );
  draw();
  return wrap;
}

function section(title: string, ...body: (Node | null)[]) {
  return h("section", { class: "sheet-section" }, h("h3", null, title), ...body);
}

export const t = (zh: string, enText: string) => (en() ? `${zh} ${enText}` : zh);

/**
 * The drop-down filter panel. Type and theme are shown first; the rest sit under
 * "More filters". Every change is applied immediately through `onChange`.
 */
export function filterPanel(f: Filters, onChange: () => void, onDone: () => void, onClear: () => void) {
  const meta = state.meta!;
  const changed = <T>(set: (v: T) => void) => (v: T) => {
    set(v);
    onChange();
  };
  const toggle = (text: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h("button", { class: `chip ${get() ? "on" : ""}` }, text);
    b.addEventListener("click", () => {
      set(!get());
      b.classList.toggle("on", get());
      onChange();
    });
    return b;
  };
  const themesAll = h("button", { class: `chip small ${f.themes_all ? "on" : ""}` });
  const drawThemesAll = () => {
    themesAll.textContent = f.themes_all ? t("全部满足", "Match ALL selected") : t("满足任一", "Match ANY selected");
    themesAll.classList.toggle("on", f.themes_all);
  };
  themesAll.addEventListener("click", () => {
    f.themes_all = !f.themes_all;
    drawThemesAll();
    onChange();
  });
  drawThemesAll();

  const more = h(
    "details",
    { class: "more-filters" },
    h("summary", null, t("更多筛选", "More filters")),
    section(t("字数", "Characters"), chipGroup([3, 4, 5, 6, 7, 8], f.lengths, (l) => (l === 8 ? "8+" : String(l)), changed((v) => (f.lengths = v)))),
    section(t("结构", "Pattern"), chipGroup(meta.structures, f.structures, (s) => s, changed((v) => (f.structures = v)))),
    section(t("常用度", "How common"), chipGroup([1, 2, 3], f.frequencies, (q) => `${FREQUENCY_LABEL[q].stars} ${label(FREQUENCY_LABEL[q])}`, changed((v) => (f.frequencies = v)))),
    section(t("感情色彩", "Sentiment"), chipGroup<Sentiment>(["positive", "neutral", "negative"], f.sentiments, (s) => label(SENTIMENT_LABEL[s]), changed((v) => (f.sentiments = v)))),
    section(t("语体", "Register"), chipGroup<Register>(["casual", "neutral", "formal", "literary"], f.registers, (r) => label(REGISTER_LABEL[r]), changed((v) => (f.registers = v)))),
    section(t("学习状态", "My progress"), chipGroup<Status>(["new", "learning", "mastered"], f.statuses, (s) => label(STATUS_LABEL[s]), changed((v) => (f.statuses = v)))),
    section(
      t("其他", "Other"),
      h(
        "div",
        { class: "chip-group" },
        toggle(t("♥ 收藏", "Favourites"), () => f.favourites_only, (v) => (f.favourites_only = v)),
        toggle(t("有典故", "Has origin story"), () => f.has_origin, (v) => (f.has_origin = v)),
        toggle(t("现代/外来", "Modern & borrowed"), () => f.modern_only, (v) => (f.modern_only = v)),
      ),
    ),
  );

  return h(
    "div",
    { class: "filter-panel", role: "region", "aria-label": "Choose what to view" },
    section(
      t("类型", "Type"),
      chipGroup<Kind>(KINDS, f.kinds, (k) => `${label(KIND_LABEL[k])} (${meta.kinds[k] ?? 0})`, changed((v) => (f.kinds = v))),
    ),
    section(t("标签", "Labels"), themePicker(f, onChange), h("div", { class: "sheet-note" }, themesAll)),
    more,
    h(
      "div",
      { class: "panel-actions" },
      h("button", { class: "btn", onclick: onClear }, t("清除", "Clear")),
      h("button", { class: "btn primary", onclick: onDone }, t("完成", "Done")),
    ),
  );
}

export const KINDS: Kind[] = ["chengyu", "suyu", "xiehouyu", "guanyongyu", "phrase", "mingju"];

/** Short text for the drop-down bar describing the current selection. */
export function filterSummary(f: Filters): string {
  const parts: string[] = [];
  if (f.kinds.length) parts.push(f.kinds.map((k) => KIND_LABEL[k].zh).join("、"));
  if (f.themes.length) parts.push(f.themes.map((x) => themeLabel(x).split(" ")[0]).join("、"));
  const others = activeFilterCount(f) - f.kinds.length - f.themes.length;
  if (others > 0) parts.push(`+${others}`);
  return parts.length ? parts.join(" · ") : t("全部类型和标签", "All types & labels");
}
