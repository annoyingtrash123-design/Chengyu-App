import { api } from "../api";
import type { Deck } from "../types";
import { h, clear, en, pageHeader, peekText } from "../ui";
import { deckPicker } from "./study";
import { saveResult } from "../results";

let deck: Deck = { type: "all" };

export async function renderMemory(root: HTMLElement) {
  const cards = await api.matchCards(deck, "meaning", 6, en());
  const header = pageHeader(en() ? "Memory match 翻牌配对" : "翻牌配对", { back: true });
  const picker = deckPicker((d) => { deck = d; renderMemory(root); }, deck);
  if (cards.length < 4) {
    clear(root, header, picker, h("div", { class: "empty" }, en() ? "Not enough entries in this deck." : "这个卡组的词条不够。"));
    return;
  }

  let open: number[] = [];
  const matched = new Set<number>();
  let moves = 0;
  let busy = false;
  const status = h("div", { class: "muted small center" });
  const grid = h("div", { class: "memory-grid" });

  const buttons = cards.map((c, i) =>
    h(
      "button",
      {
        class: `memory-card ${c.is_idiom ? "is-idiom" : "is-meaning"}`,
        onclick: () => flip(i),
        "aria-label": en() ? "Face-down card" : "背面朝上的卡片",
      },
      h("span", { class: "face" }, c.face),
    ),
  );

  function flip(i: number) {
    // Matched expressions: tap to see what they mean.
    if (matched.has(i) && cards[i].is_idiom) return void peekText(cards[i].face);
    if (busy || matched.has(i) || open.includes(i)) return;
    buttons[i].classList.add("up");
    buttons[i].removeAttribute("aria-label");
    open.push(i);
    if (open.length < 2) return;
    moves++;
    const [a, b] = open;
    if (cards[a].pair === cards[b].pair) {
      matched.add(a).add(b);
      buttons[a].classList.add("done");
      buttons[b].classList.add("done");
      api.quizAnswer(cards[a].entry_id, true);
      open = [];
      if (matched.size === cards.length) win();
    } else {
      busy = true;
      setTimeout(() => {
        buttons[a].classList.remove("up");
        buttons[b].classList.remove("up");
        buttons[a].setAttribute("aria-label", en() ? "Face-down card" : "背面朝上的卡片");
        buttons[b].setAttribute("aria-label", en() ? "Face-down card" : "背面朝上的卡片");
        open = [];
        busy = false;
      }, 1100);
    }
    status.textContent = en() ? `Moves: ${moves}` : `步数：${moves}`;
  }

  function win() {
    api.gamePlayed();
    const right = cards.filter((c) => c.is_idiom).map((c) => ({ id: c.entry_id, text: c.face }));
    saveResult({ at: Date.now(), game: "memory", score: en() ? `${moves} moves` : `${moves} 步`, right, missed: [] });
    root.appendChild(
      h(
        "section",
        { class: "card center" },
        h("p", { class: "good" }, en() ? `🎉 All matched in ${moves} moves!` : `🎉 全部配对，用了 ${moves} 步！`),
        h("p", { class: "muted small" }, en() ? "Tap a matched expression to see its meaning." : "点已配对的词语可查看释义。"),
        h("button", { class: "btn primary", onclick: () => renderMemory(root) }, en() ? "Play again" : "再来一局"),
      ),
    );
  }

  clear(grid, buttons);
  status.textContent = en() ? "Find each expression's meaning" : "找出每个词语对应的释义";
  clear(root, header, picker, status, grid);
}
