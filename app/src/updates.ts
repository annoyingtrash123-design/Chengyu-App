// Keeps the installed web app up to date without reinstalling.
// The service worker is checked for a new version when the app starts, whenever you come
// back to it, and every 30 minutes. A new version installs in the background and the app
// reloads itself onto it (only when you're not in the middle of a quiz or study session),
// then shows what's new.

import { registerSW } from "virtual:pwa-register";
import { isTauri } from "./api";
import { APP_VERSION, CHANGELOG } from "./changelog";
import { en, toast } from "./ui";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "downloading" | "offline" | "error" | "unsupported";

export const updateState: { status: UpdateStatus; lastChecked: number | null } = { status: "idle", lastChecked: null };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const onUpdateState = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));

const SEEN_KEY = "chengyu-version-seen";
const CHECK_EVERY_MS = 30 * 60 * 1000;
let registration: ServiceWorkerRegistration | undefined;
let pendingReload = false;

/** Pages where an automatic reload would lose what you're doing. */
const busy = () => /^#\/(study|games\/)/.test(location.hash) && document.querySelector(".flashcard, .question, .slots, .memory-grid, .match-cols, .chain-form") !== null;

function reloadNow() {
  location.reload();
}

function reloadWhenSafe() {
  if (!busy()) return reloadNow();
  pendingReload = true;
  toast(en() ? "An update is ready. It will apply when you leave this screen." : "更新已就绪，离开此页面后自动应用。", 6000);
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!registration) {
    updateState.status = "unsupported";
    notify();
    return updateState.status;
  }
  if (!navigator.onLine) {
    updateState.status = "offline";
    notify();
    return updateState.status;
  }
  updateState.status = "checking";
  notify();
  try {
    await registration.update();
    updateState.lastChecked = Date.now();
    updateState.status = registration.installing || registration.waiting ? "downloading" : "up-to-date";
  } catch {
    updateState.status = navigator.onLine ? "error" : "offline";
  }
  notify();
  return updateState.status;
}

/** After an update has been applied, say so once. */
function announceIfUpdated() {
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    return;
  }
  if (seen && seen !== APP_VERSION) {
    const notes = CHANGELOG[0];
    toast(`${en() ? `Updated to v${APP_VERSION}` : `已更新到 v${APP_VERSION}`}: ${(en() ? notes.en : notes.zh)[0]}`, 6000);
  }
}

export function setupUpdates() {
  if (isTauri() || !("serviceWorker" in navigator)) {
    updateState.status = "unsupported";
    return;
  }
  announceIfUpdated();
  registerSW({
    immediate: true,
    onNeedReload() {
      // A new version has taken control of the app.
      updateState.status = "downloading";
      notify();
      reloadWhenSafe();
    },
    onRegisteredSW(_url, r) {
      registration = r;
      checkForUpdate();
      setInterval(checkForUpdate, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("online", () => checkForUpdate());
    },
  });
  window.addEventListener("hashchange", () => {
    if (pendingReload && !busy()) reloadNow();
  });
}
