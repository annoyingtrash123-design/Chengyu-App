import "./styles.css";
import { h, clear, loadState, en, loading } from "./ui";
import { renderHome } from "./views/home";
import { renderDictionary } from "./views/dictionary";
import { renderEntry } from "./views/entry";
import { renderStudy } from "./views/study";
import { renderGames } from "./views/games";
import { renderQuiz } from "./views/quiz";
import { renderChain } from "./views/chain";
import { renderScramble } from "./views/scramble";
import { renderMemory } from "./views/memory";
import { renderMatch } from "./views/match";
import { renderMe } from "./views/me";
import { scheduleReminders } from "./notifications";
import { setupInstall } from "./install";

setupInstall();

type View = (root: HTMLElement, params: string[]) => void | Promise<void>;

const routes: [RegExp, View, string][] = [
  [/^\/?$/, renderHome, "home"],
  [/^\/dict$/, renderDictionary, "dict"],
  [/^\/entry\/([\w-]+)$/, renderEntry, "dict"],
  [/^\/study$/, renderStudy, "study"],
  [/^\/games$/, renderGames, "games"],
  [/^\/games\/(quiz|timed)$/, renderQuiz, "games"],
  [/^\/games\/chain$/, renderChain, "games"],
  [/^\/games\/scramble$/, renderScramble, "games"],
  [/^\/games\/memory$/, renderMemory, "games"],
  [/^\/games\/match\/(synonym|antonym)$/, renderMatch, "games"],
  [/^\/me$/, renderMe, "me"],
];

const TABS = [
  { id: "home", hash: "#/", icon: "首", zh: "首页", en: "Home" },
  { id: "dict", hash: "#/dict", icon: "典", zh: "词典", en: "Dictionary" },
  { id: "study", hash: "#/study", icon: "学", zh: "学习", en: "Study" },
  { id: "games", hash: "#/games", icon: "戏", zh: "游戏", en: "Games" },
  { id: "me", hash: "#/me", icon: "我", zh: "我的", en: "Me" },
];

const view = document.getElementById("view")!;
const tabs = document.getElementById("tabs")!;

function renderTabs(active: string) {
  clear(
    tabs,
    TABS.map((t) =>
      h(
        "a",
        { href: t.hash, class: `tab ${t.id === active ? "active" : ""}`, "aria-current": t.id === active ? "page" : null },
        h("span", { class: "tab-icon" }, t.icon),
        h("span", { class: "tab-label" }, en() ? t.en : t.zh),
      ),
    ),
  );
}

let renderId = 0;

async function route() {
  const path = location.hash.replace(/^#/, "").split("?")[0] || "/";
  const id = ++renderId;
  document.querySelectorAll(".sheet-overlay, .toast").forEach((el) => el.remove());
  for (const [re, render, tab] of routes) {
    const m = path.match(re);
    if (m) {
      renderTabs(tab);
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
  window.addEventListener("hashchange", route);
  await route();
  scheduleReminders().catch(() => {});
}

start();
