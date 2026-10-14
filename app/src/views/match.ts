import { api } from "../api";
import type { Deck, MatchCard } from "../types";
import { h, clear, en, pageHeader } from "../ui";
import { deckPicker } from "./study";

let deck: Deck = { type: "all" };

export async function renderMatch(root: HTMLElement, [mode]: string[]) {
  const m = mode as "synonym" | "antonym";
  const title = m === "synonym" ? (en() ? "Synonym match 近义配对" : "近义配对") : en() ? "Antonym match 反义配对" : "反义配对";
  const cards = await api.matchCards(deck, m, 5, en());
  const header = pageHeader(title, { back: true });
  const picker = deckPicker((d) => { deck = d; renderMatch(root, [mode]); }, deck);
  if (cards.length < 4) {
    clear(root, header, picker, h("div", { class: "empty" }, en() ? "Not enough entries with this data in the deck." : "这个卡组的数据不够。"));
    return;
  }

  const left = cards.filter((c) => c.is_idiom);
  const right = cards.filter((c) => !c.is_idiom);
  let selected: MatchCard | null = null;
  let selectedBtn: HTMLButtonElement | null = null;
  let done = 0;
  let mistakes = 0;
  const status = h("div", { class: "muted small center" }, en() ? "Tap an expression, then its partner" : "先点左边，再点右边对应的词");

  const mk = (c: MatchCard) => {
    const b = h("button", { class: "match-btn" }, c.face);
    b.addEventListener("click", () => {
      if (b.classList.contains("done")) return;
      if (!selected || selected.is_idiom === c.is_idiom) {
        selectedBtn?.classList.remove("sel");
        selected = c;
        selectedBtn = b;
        b.classList.add("sel");
        return;
      }
      if (selected.pair === c.pair) {
        b.classList.add("done");
        selectedBtn!.classList.add("done");
        selectedBtn!.classList.remove("sel");
        api.quizAnswer(c.entry_id, true);
        done++;
        if (done === left.length) {
          api.gamePlayed();
          clear(status, en() ? `🎉 Done! ${mistakes} mistake${mistakes === 1 ? "" : "s"}.` : `🎉 完成！错了 ${mistakes} 次。`, " ", h("button", { class: "btn primary", onclick: () => renderMatch(root, [mode]) }, en() ? "Again" : "再来"));
        }
      } else {
        mistakes++;
        api.quizAnswer(selected.entry_id, false);
        b.classList.add("wrong");
        setTimeout(() => b.classList.remove("wrong"), 500);
        selectedBtn!.classList.remove("sel");
      }
      selected = null;
      selectedBtn = null;
    });
    return b;
  };

  clear(root, header, picker, status, h("div", { class: "match-cols" }, h("div", { class: "match-col" }, left.map(mk)), h("div", { class: "match-col" }, right.map(mk))));
}
