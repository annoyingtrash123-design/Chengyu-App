// Back-button history, app style. A blank Search page sits at the bottom of the stack (depth -2), each
// tab's pages stack on top of it, and switching tabs never adds to the stack. So back steps out of what
// you opened, then lands on the blank Search page, and the next press closes the app.
// After a search there are two more entries (depths -1 and 0, pushed when you start typing): results
// at 0, then back clears them to a blank page (-1), one more press stays there (-2), then the app closes.

/** Position in the stack: -2 is the bottom (blank Search), tab pages are 1 and up. */
export const depth = (): number => (history.state as { d?: number } | null)?.d ?? 0;
const hasDepth = () => (history.state as { d?: number } | null)?.d !== undefined;

let lastDepth = -2;
let here = "";
let pendingTab: string | null = null;

/** Add a history entry without changing the page (e.g. a zoom level in the map). */
export function pushLevel(state: object) {
  history.pushState({ ...state, d: depth() + 1 }, "");
  lastDepth = depth();
}

/** Change this entry's extra state, keeping its depth. */
export function replaceLevel(state: object) {
  history.replaceState({ ...(history.state ?? {}), ...state }, "");
}

/** Call on each route change: a new entry (a link was followed) is one deeper than the last. */
export function markDepth() {
  if (!hasDepth()) replaceLevel({ d: Math.max(lastDepth, 0) + 1 });
  lastDepth = depth();
  here = location.hash;
}

/** Typing on the blank Search page at the bottom: add the entries that back will step through later. */
export function startSearching() {
  const d = depth();
  if (d >= 0 || !hasDepth()) return;
  if (d === -2) history.pushState({ d: -1 }, "");
  history.pushState({ d: 0 }, "");
  lastDepth = 0;
}

export function initNav(o: { search: string; tabRoots: string[]; searching: () => boolean; clearSearch: () => void; redraw: () => void }) {
  window.addEventListener("popstate", () => {
    // Following a link fires this too, with no state yet: that's not going back.
    if (!hasDepth()) return;
    const from = here;
    const d = (lastDepth = depth());
    // Switching tabs: once back at the Search page, go on to the tab that was tapped.
    if (pendingTab && d <= 0) {
      const to = pendingTab;
      pendingTab = null;
      if (to !== location.hash) location.hash = to;
      return;
    }
    // Back from a tab's main page: a blank Search page (back from an entry keeps the search).
    if (d <= 0 && o.tabRoots.includes(from)) o.clearSearch();
    if (d === 0 && !o.searching()) {
      // Nothing searched: skip the spare entries, so the next press closes the app.
      history.go(-2);
      return;
    }
    if (d === -1 && !o.searching()) {
      history.back(); // (cleared by hand before going back) straight to the bottom
      return;
    }
    if (d < 0 && o.searching()) {
      // Back from search results: clear to a blank page (same page, so redraw it here).
      o.clearSearch();
      o.redraw();
    }
  });
  if (hasDepth()) {
    lastDepth = depth(); // a reload: the stack is already set up
    here = location.hash;
    return;
  }
  const start = location.hash || "#/";
  history.replaceState({ d: -2 }, "", o.search);
  if (start !== o.search) history.pushState({ d: 1 }, "", start);
  lastDepth = depth();
  here = location.hash;
}

/** Go to a tab: drop everything above the Search page, then open the tab on top of it. */
export function goToTab(hash: string, searchHash: string) {
  const d = depth();
  if (hash === searchHash) {
    if (d > 0) history.go(-d);
    return;
  }
  if (d <= 0) location.hash = hash;
  else {
    pendingTab = hash;
    history.go(-d);
  }
}
