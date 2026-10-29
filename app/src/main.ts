import "./styles.css";
import { h, clear, loadState, en, loading } from "./ui";
import { renderHome } from "./views/home";
import { renderDictionary } from "./views/dictionary";
import { renderList } from "./views/list";
import { renderEntry } from "./views/entry";
import { renderStudy } from "./views/study";
import { renderGames } from "./views/games";
import { renderQuiz, renderQuizHistory } from "./views/quiz";
import { renderChain } from "./views/chain";
import { renderScramble } from "./views/scramble";
import { renderCrossword } from "./views/crossword";
import { renderMemory } from "./views/memory";
import { renderMatch } from "./views/match";
import { renderMe } from "./views/me";
import { renderMap } from "./views/mindmap";
import { scheduleReminders } from "./notifications";
import { setupInstall } from "./install";
import { setupUpdates } from "./updates";
import { initNav, goToTab, markDepth } from "./nav";

setupInstall();
setupUpdates();

type View = (root: HTMLElement, params: string[]) => void | Promise<void>;

const routes: [RegExp, View, string][] = [
  [/^\/?$/, renderHome, "home"],
  [/^\/dict$/, renderDictionary, "dict"],
  [/^\/list$/, renderList, "list"],
  [/^\/entry\/([\w-]+)$/, renderEntry, "keep"],
  [/^\/study$/, renderStudy, "study"],
  [/^\/games$/, renderGames, "games"],
  [/^\/games\/(quiz|timed)$/, renderQuiz, "games"],
  [/^\/games\/history$/, renderQuizHistory, "games"],
  [/^\/games\/chain$/, renderChain, "games"],
  [/^\/games\/scramble$/, renderScramble, "games"],
  [/^\/games\/crossword$/, renderCrossword, "games"],
  [/^\/games\/memory$/, renderMemory, "games"],
  [/^\/games\/match\/(synonym|antonym)$/, renderMatch, "games"],
  [/^\/me$/, renderMe, "me"],
  [/^\/map$/, renderMap, "me"],
];

const TABS = [
  { id: "home", hash: "#/", icon: "首", zh: "首页", en: "Home" },
  { id: "dict", hash: "#/dict", icon: "典", zh: "词典", en: "Search" },
  { id: "list", hash: "#/list", icon: "表", zh: "列表", en: "List" },
  { id: "study", hash: "#/study", icon: "学", zh: "学习", en: "Study" },
  { id: "games", hash: "#/games", icon: "戏", zh: "游戏", en: "Games" },
  { id: "me", hash: "#/me", icon: "我", zh: "我的", en: "Me" },
];

// Hide the tab bar while the on-screen keyboard is up (it would otherwise sit on top of the keyboard).
// Detected from the visible height, so it also comes back when the keyboard is closed with the back gesture.
{
  let tallest = 0;
  const check = () => {
    const hgt = window.visualViewport?.height ?? window.innerHeight;
    tallest = Math.max(tallest, hgt);
    document.body.classList.toggle("kb", tallest - hgt > 150);
  };
  window.visualViewport?.addEventListener("resize", check);
  window.addEventListener("resize", check);
  window.addEventListener("orientationchange", () => {
    tallest = 0;
    setTimeout(check, 300);
  });
  check();
}

const view = document.getElementById("view")!;
const tabs = document.getElementById("tabs")!;

function renderTabs(active: string) {
  clear(
    tabs,
    TABS.map((t) =>
      h(
        "a",
        {
          href: t.hash,
          class: `tab ${t.id === active ? "active" : ""}`,
          "aria-current": t.id === active ? "page" : null,
          // Tapping Search again while on it opens the keyboard.
          onclick: (e: Event) => {
            e.preventDefault();
            const box = document.querySelector<HTMLInputElement>(".search-bar .search-input");
            if (t.id === "dict" && location.hash === t.hash && box) return box.focus();
            if (location.hash === t.hash || (t.hash === "#/" && location.hash === "")) return;
            goToTab(t.hash, SEARCH);
          },
        },
        h("span", { class: "tab-icon" }, t.icon),
        h("span", { class: "tab-label" }, en() ? t.en : t.zh),
      ),
    ),
  );
}

const SEARCH = "#/dict";
let renderId = 0;
let lastTab = "home";

async function route() {
  const path = location.hash.replace(/^#/, "").split("?")[0] || "/";
  const id = ++renderId;
  markDepth();
  document.querySelectorAll(".sheet-overlay").forEach((el) => el.remove());
  for (const [re, render, tab] of routes) {
    const m = path.match(re);
    if (m) {
      if (tab !== "keep") lastTab = tab;
      renderTabs(lastTab);
      const root = h("div", { class: "page" }, loading());
      clear(view, root);
      window.scrollTo(0, 0);
      try {
        await render(root, m.slice(1));
      } catch (e) {
        if (id === renderId) clear(root, h("div", { class: "error" }, `出错了 Something went wrong: ${String(e)}`));
      }
      return;
    }
  }
  location.hash = "#/";
}

async function start() {
  try {
    await loadState();
  } catch (e) {
    clear(view, h("div", { class: "error" }, `Could not reach the app core: ${String(e)}`));
    return;
  }
  initNav(SEARCH);
  window.addEventListener("hashchange", route);
  await route();
  scheduleReminders().catch(() => {});
}

start();
