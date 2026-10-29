// Back-button history, app style: a blank Search page sits at the bottom of the stack (depth 0),
// each tab's pages stack on top of it, and switching tabs never adds to the stack. So pressing
// back steps out of what you opened, then lands on a blank Search page, then leaves the app.

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
let pendingTab: string | null = null;

/** Call on each route change: a new entry (a link was followed) is one deeper than the last. */
export function markDepth() {
  if ((history.state as { d?: number } | null)?.d === undefined) replaceLevel({ d: lastDepth + 1 });
  lastDepth = depth();
}

/** Set up the stack at start-up: blank Search underneath whatever page the app opened on. */
export function initNav(searchHash: string) {
  window.addEventListener("popstate", () => {
    if ((history.state as { d?: number } | null)?.d !== undefined) lastDepth = depth();
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
  history.replaceState({ d: 0 }, "", searchHash);
  if (start !== searchHash) history.pushState({ d: 1 }, "", start);
  lastDepth = depth();
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
