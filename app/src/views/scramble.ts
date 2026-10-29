import { api } from "../api";
import type { Deck, EntryDetail } from "../types";
import { h, clear, en, pageHeader, meaningOf } from "../ui";
import { deckPicker } from "./study";
import { saveRound } from "../results";

let deck: Deck = { type: "all" };
let streak = 0;

export async function renderScramble(root: HTMLElement) {
  const s = await api.scramble(deck, 2);
  if (!s) {
    clear(root, pageHeader(en() ? "Unscramble" : "拼成语", { back: true }), deckPicker((d) => { deck = d; renderScramble(root); }, deck), h("div", { class: "empty" }, en() ? "No suitable entries in this deck." : "这个卡组没有合适的词条。"));
    return;
  }
  const detail: EntryDetail = await api.entry(s.entry_id);
  const target = detail.chars;
  const picked: number[] = []; // indices into s.tiles
  let solved = false;

  const slots = h("div", { class: "slots" });
  const tiles = h("div", { class: "tiles" });
  const feedback = h("div", { class: "feedback" });

  function draw() {
    clear(
      slots,
      target.map((_, i) =>
        h(
          "button",
          {
            class: `slot ${picked[i] !== undefined ? "filled" : ""}`,
            onclick: () => {
              if (solved || picked[i] === undefined) return;
              picked.splice(i, 1);
              draw();
            },
          },
          picked[i] !== undefined ? s!.tiles[picked[i]] : "",
        ),
      ),
    );
    clear(
      tiles,
      s!.tiles.map((t, i) =>
        h(
          "button",
          {
            class: "tile",
            disabled: picked.includes(i) || solved,
            onclick: () => {
              if (picked.length >= target.length) return;
              picked.push(i);
              draw();
              if (picked.length === target.length) check();
            },
          },
          t,
        ),
      ),
    );
  }

  function check() {
    const guess = picked.map((i) => s!.tiles[i]).join("");
    if (guess === target.join("")) {
      solved = true;
      streak++;
      api.quizAnswer(s!.entry_id, true);
      saveRound("scramble", { id: s!.entry_id, text: detail.entry.text }, true);
      slots.classList.add("win");
      clear(
        feedback,
        h("p", { class: "good" }, en() ? `Correct! Streak: ${streak}` : `正确！连对 ${streak}`),
        h("div", { class: "pinyin" }, detail.entry.pinyin),
        h("a", { href: `#/entry/${s!.entry_id}`, class: "small" }, en() ? "See entry ›" : "查看词条 ›"),
        h("button", { class: "btn primary block", onclick: () => renderScramble(root) }, en() ? "Next" : "下一个"),
      );
      draw();
    } else {
      slots.classList.add("shake");
      setTimeout(() => slots.classList.remove("shake"), 400);
      feedback.textContent = en() ? "Not quite — tap a character to remove it." : "不对，点击已选的字可以撤回。";
    }
  }

  const giveUp = h("button", { class: "btn" }, en() ? "Show answer" : "看答案");
  giveUp.addEventListener("click", () => {
    if (solved) return;
    solved = true;
    streak = 0;
    api.quizAnswer(s!.entry_id, false);
    saveRound("scramble", { id: s!.entry_id, text: detail.entry.text }, false);
    clear(
      feedback,
      h("p", { class: "hanzi" }, detail.entry.text),
      h("div", { class: "pinyin" }, detail.entry.pinyin),
      h("button", { class: "btn primary block", onclick: () => renderScramble(root) }, en() ? "Next" : "下一个"),
    );
    draw();
  });

  clear(
    root,
    pageHeader(en() ? "Unscramble 拼成语" : "拼成语", { back: true }),
    deckPicker((d) => { deck = d; renderScramble(root); }, deck),
    h("section", { class: "card" }, h("div", { class: "muted small" }, en() ? "Clue" : "提示"), h("p", null, meaningOf(detail.entry))),
    slots,
    tiles,
    h("div", { class: "row-gap" }, giveUp),
    feedback,
  );
  draw();
}
