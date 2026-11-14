import { api, today } from "../api";
import type { EntryDetail } from "../types";
import { h, clear, en, englishToggle } from "../ui";
import { entryBody, favouriteButton } from "./entry";

const PER_DAY = 5;
/** Which of today's five was on screen, so coming back from an entry returns to it. */
let shownIndex = 0;
let shownDay = -1;

/** Today's five chengyu: a stable pick per day (the first is the classic chengyu of the day). */
async function todaysFive(): Promise<string[]> {
  const day = today();
  const ids: string[] = [];
  // Extra picks use seeds far from real day numbers so they never repeat another day's first pick.
  for (let k = 0; ids.length < PER_DAY && k < PER_DAY * 4; k++) {
    const s = await api.daily(k ? 1_000_000 + day * 16 + k : day);
    if (s && !ids.includes(s.id)) ids.push(s.id);
  }
  return ids;
}

/** Home: today's five chengyu, each a full entry; swipe left and right between them. */
export async function renderHome(root: HTMLElement) {
  const ids = await todaysFive();
  const details: EntryDetail[] = await Promise.all(ids.map((id) => api.entry(id)));
  const showEn = en();
  if (shownDay !== today()) {
    shownDay = today();
    shownIndex = 0;
  }

  const header = h(
    "header",
    { class: "hero" },
    h(
      "div",
      { class: "row-between" },
      h("div", { class: "hero-title" }, h("span", { class: "hero-mark", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")), "语林词典"),
      englishToggle(() => renderHome(root)),
    ),
  );

  if (!details.length) {
    clear(root, header, h("div", { class: "empty" }, en() ? "No entries yet." : "暂无词条。"));
    return;
  }
  const date = new Date().toLocaleDateString(showEn ? "en-GB" : "zh-CN", { weekday: "long", day: "numeric", month: "long" });
  const dots = h("div", { class: "daily-dots", role: "group", "aria-label": showEn ? "Chengyu of the day" : "每日成语" });
  const track = h("div", { class: "daily-track" });
  const slides = details.map((d, i) =>
    h(
      "div",
      { class: "daily-slide", role: "group", "aria-label": `${i + 1} / ${details.length}` },
      h(
        "div",
        { class: "row-between daily-bar" },
        h("div", { class: "eyebrow" }, `${showEn ? "Chengyu of the day" : "每日成语"} ${i + 1}/${details.length} · ${date}`),
        favouriteButton(d),
      ),
      ...entryBody(d, () => renderHome(root)),
    ),
  );
  clear(track, slides);

  const dotButtons = details.map((d, i) =>
    h("button", { class: "daily-dot", "aria-label": d.entry.text, onclick: () => go(i) }, h("span", null, d.entry.text)),
  );
  clear(dots, dotButtons);

  // The track is as tall as the slide on screen, so a short entry doesn't leave a gap under it.
  const fit = () => {
    const s = slides[shownIndex];
    if (s) track.style.height = `${s.offsetHeight}px`;
  };
  const mark = () => {
    dotButtons.forEach((b, i) => b.classList.toggle("on", i === shownIndex));
    const b = dotButtons[shownIndex];
    if (b) dots.scrollTo({ left: b.offsetLeft - dots.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
  };
  function go(i: number, smooth = true) {
    shownIndex = Math.max(0, Math.min(details.length - 1, i));
    track.scrollTo({ left: shownIndex * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    mark();
    fit();
  }
  let settle = 0;
  track.addEventListener(
    "scroll",
    () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== shownIndex) {
        shownIndex = i;
        mark();
        if (window.scrollY > track.offsetTop) window.scrollTo({ top: Math.max(0, track.offsetTop - 70) });
      }
      clearTimeout(settle);
      settle = window.setTimeout(fit, 80);
    },
    { passive: true },
  );
  // Entries finish laying out (linked text, fonts) after the first paint.
  slides.forEach((s) => new ResizeObserver(() => s === slides[shownIndex] && fit()).observe(s));

  clear(root, header, dots, track);
  requestAnimationFrame(() => go(shownIndex, false));
}
