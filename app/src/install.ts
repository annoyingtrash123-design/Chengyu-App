// "Install this app" banner for the web version. Android/desktop Chrome fire
// `beforeinstallprompt`, which lets a button open the native install dialog; iOS Safari
// has no such event, so it gets two-step instructions instead.

import { isTauri } from "./api";
import { h, en } from "./ui";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "chengyu-install-dismissed";
const DISMISS_DAYS = 7;
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Can we offer a one-tap install right now (Android/desktop Chrome)? */
export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  listeners.forEach((l) => l());
  return outcome === "accepted";
}

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function showBanner() {
  if (isTauri() || isStandalone() || dismissedRecently() || document.querySelector(".install-banner")) return;
  const ios = isIos();
  if (!ios && !deferred) return;

  const close = () => {
    banner.remove();
    rememberDismiss();
  };
  const banner = h(
    "div",
    { class: "install-banner", role: "dialog", "aria-label": "Install app" },
    h("img", { src: "./icon-192.png", alt: "", class: "install-icon" }),
    h(
      "div",
      { class: "install-text" },
      h("strong", null, en() ? "Install 成语词典" : "安装成语词典"),
      h(
        "span",
        null,
        ios
          ? en()
            ? "Tap the Share button (square with an arrow), then “Add to Home Screen”."
            : "点击分享按钮（带箭头的方框），然后选择“添加到主屏幕”。"
          : en()
            ? "Add it to your home screen. Works offline."
            : "添加到主屏幕，离线也能用。",
      ),
    ),
    ios
      ? null
      : h(
          "button",
          {
            class: "btn primary install-btn",
            onclick: async () => {
              await promptInstall();
              banner.remove();
            },
          },
          en() ? "Install" : "安装",
        ),
    h("button", { class: "icon-btn install-close", "aria-label": "Close", onclick: close }, "×"),
  );
  document.body.appendChild(banner);
}

/** Call once at start-up, before anything else renders. */
export function setupInstall() {
  if (isTauri()) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
    showBanner();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    document.querySelector(".install-banner")?.remove();
  });
  // iOS never fires beforeinstallprompt; show instructions after a moment.
  if (isIos()) setTimeout(showBanner, 1500);
}

export function onInstallAvailabilityChange(fn: () => void) {
  listeners.add(fn);
}
