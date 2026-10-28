import { h } from "../ui";

/**
 * A fast-scroll bar on the right edge for long lists: drag the handle to any position
 * ("523 / 1,000" shows while dragging) and the list follows as you drag.
 */
export function fastScroller(opts: { total: () => number; current: () => number; jump: (index: number) => void }) {
  const thumb = h("div", { class: "fs-thumb" });
  const bubble = h("div", { class: "fs-bubble", hidden: true });
  const track = h("div", { class: "fs-track", hidden: true, "aria-hidden": "true" }, thumb, bubble);
  const THUMB = 44;
  let dragging = false;
  let shown = -1;
  let lastJump = 0;
  let timer = 0;
  /** Move the list along while dragging, at most every 90 ms, and once more when the finger stops. */
  const follow = (i: number) => {
    clearTimeout(timer);
    if (i === shown) return;
    const now = performance.now();
    if (now - lastJump > 90) {
      shown = i;
      lastJump = now;
      opts.jump(i);
    } else timer = window.setTimeout(() => follow(i), 100);
  };

  const place = (f: number) => {
    const y = f * (track.clientHeight - THUMB);
    thumb.style.transform = `translateY(${y}px)`;
    bubble.style.transform = `translateY(${y + THUMB / 2 - 18}px)`;
  };
  const update = () => {
    const t = opts.total();
    track.hidden = t < 60;
    if (track.hidden || dragging) return;
    place(t > 1 ? Math.min(1, opts.current() / (t - 1)) : 0);
  };
  const indexAt = (clientY: number) => {
    const r = track.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientY - r.top - THUMB / 2) / (r.height - THUMB)));
    return { f, i: Math.round(f * (opts.total() - 1)) };
  };
  const move = (e: PointerEvent) => {
    const { f, i } = indexAt(e.clientY);
    place(f);
    bubble.textContent = `${(i + 1).toLocaleString("en-US")} / ${opts.total().toLocaleString("en-US")}`;
    follow(i);
  };
  track.addEventListener("pointerdown", (e) => {
    dragging = true;
    track.classList.add("dragging");
    track.setPointerCapture(e.pointerId);
    bubble.hidden = false;
    move(e);
    e.preventDefault();
  });
  track.addEventListener("pointermove", (e) => dragging && move(e));
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    clearTimeout(timer);
    track.classList.remove("dragging");
    bubble.hidden = true;
    const i = indexAt(e.clientY).i;
    if (i !== shown) opts.jump(i);
    shown = -1;
  };
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);

  let queued = false;
  const onScroll = () => {
    if (!track.isConnected) return window.removeEventListener("scroll", onScroll);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return { el: track, update };
}

/** Index (from `data-index`) of the first row of `list` that is at least partly on screen. */
export function firstVisibleIndex(list: HTMLElement): number {
  const rows = list.children;
  let lo = 0;
  let hi = rows.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((rows[mid] as HTMLElement).getBoundingClientRect().bottom < 0) lo = mid + 1;
    else hi = mid;
  }
  return Number((rows[lo] as HTMLElement).dataset.index ?? 0);
}
