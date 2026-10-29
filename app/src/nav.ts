// Back-button history, app style: a blank Search page sits at the bottom of the stack (depth 0),
// each tab's pages stack on top of it, and switching tabs never adds to the stack. So pressing
// back steps out of what you opened, then lands on the Search page; from there, back clears it to
// blank, one more press stays on the blank page (spare entries at depths -1 and -2), then the app closes.

/** How many back presses from here to the blank Search page at the bottom. */
export const depth = (): number => (history.state as { d?: number } | null)?.d ?? 0;

/** Add a history entry without changing the page (e.g. a zoom level in the map). */
export function pushLevel(state: object) {
  history.pushState({ ...state, d: depth() + 1 }, "");
  lastDepth = depth();
}

/** Change this entry's extra state, keeping its depth. */
export function replaceLevel(state: object) {
  history.replaceState({ ...(history.state ?? {}), ...state }, "");
}

let lastDepth = 0;
let here = "";
let pendingTab: string | null = null;

/** Call on each route change: a new entry (a link was followed) is one deeper than the last. */
export function markDepth() {
  if ((history.state as { d?: number } | null)?.d === undefined) replaceLevel({ d: Math.max(lastDepth, 0) + 1 });
  lastDepth = depth();
  here = location.hash;
}

/** Set up the stack at start-up: blank Search underneath whatever page the app opened on. */
export function initNav(o: { search: string; tabRoots: string[]; searching: () => boolean; clearSearch: () => void; redraw: () => void }) {
  const searchHash = o.search;
  window.addEventListener("popstate", () => {
    // Following a link fires this too, with no state yet: that's not going back.
    if ((history.state as { d?: number } | null)?.d === undefined) return;
    const from = here;
    lastDepth = depth();
    // The spare entries under the Search page show the same page, blank.
    if (depth() === -1) {
      // Search was already blank: this press is the "stay" one, so drop straight to the last spare
      // entry (the next press closes the app). Otherwise clear the search.
      if (!o.searching()) return history.back();
      o.clearSearch();
      return o.redraw();
    }
    if (depth() === -2) {
      if (!o.searching()) return;
      o.clearSearch();
      return o.redraw();
    }
    // Back from a tab's main page: a blank Search page (back from an entry keeps the search).
    if (depth() === 0 && o.tabRoots.includes(from)) o.clearSearch();
    // Switching tabs: once back at the bottom, go on to the tab that was tapped.
    if (pendingTab && depth() === 0) {
      const to = pendingTab;
      pendingTab = null;
      if (to !== location.hash) location.hash = to;
    }
  });
  if ((history.state as { d?: number } | null)?.d !== undefined) {
    lastDepth = depth(); // a reload: the stack is already set up
    return;
  }
  const start = location.hash || "#/";
  history.replaceState({ d: -2 }, "", searchHash);
  history.pushState({ d: -1 }, "", searchHash);
  history.pushState({ d: 0 }, "", searchHash);
  if (start !== searchHash) history.pushState({ d: 1 }, "", start);
  lastDepth = depth();
  here = location.hash;
}

/** Go to a tab: drop everything above the blank Search page, then open the tab on top of it. */
export function goToTab(hash: string, searchHash: string) {
  const d = depth();
  if (hash === searchHash) {
    if (d > 0) history.go(-d);
    return;
  }
  if (d === 0) location.hash = hash;
  else {
    pendingTab = hash;
    history.go(-d);
  }
}
