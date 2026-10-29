import { api } from "../api";
import type { Crossword, Deck, Summary } from "../types";
import { h, clear, en, pageHeader, meaningOf, peek, toast } from "../ui";
import { deckPicker } from "./study";
import { saveResult } from "../results";

let deck: Deck = { type: "filtered", filters: { frequencies: [1] } };
/** "tiles": pick from the characters given; "type": write each answer yourself. */
let mode: "tiles" | "type" = "tiles";

const key = (r: number, c: number) => `${r},${c}`;

export async function renderCrossword(root: HTMLElement) {
  const header = pageHeader(en() ? "Crossword 填字" : "填字游戏", { back: true });
  const picker = deckPicker((d) => { deck = d; renderCrossword(root); }, deck);
  const x: Crossword | null = await api.crossword(deck);
  if (!x) {
    clear(root, header, picker, h("div", { class: "empty" }, en() ? "Not enough four-character chengyu in this deck." : "这个卡组的四字成语不够。"));
    return;
  }
  const entries: Summary[] = await api.summaries(x.words.map((w) => w.entry_id));
  const byId = new Map(entries.map((s) => [s.id, s]));

  const cellsOf = (wi: number) => {
    const w = x.words[wi];
    return Array.from({ length: w.length }, (_, k) => (w.across ? key(w.row, w.col + k) : key(w.row + k, w.col)));
  };
  const answer = new Map(x.cells.map((c) => [key(c.row, c.col), c]));
  const blanks = x.cells.filter((c) => !c.given).map((c) => key(c.row, c.col));
  const fills = new Map<string, string>(); // cell → character entered
  const tileOf = new Map<string, number>(); // cell → index into x.tiles (tile mode)
  let word = 0;
  let selected: string | null = cellsOf(0).find((k) => blanks.includes(k)) ?? blanks[0] ?? null;
  let finished = false;
  const wrong = new Set<string>();

  const gridEl = h("div", { class: "xw-grid", style: `grid-template-columns: repeat(${x.width}, 1fr); max-width: ${x.width * 44}px` });
  const tilesEl = h("div", { class: "tiles xw-tiles" });
  const cluesEl = h("div", { class: "xw-clues" });
  const feedback = h("div", { class: "feedback" });
  const typeInput = h("input", { class: "search-input", autocomplete: "off", lang: "zh-CN", enterkeyhint: "done" }) as HTMLInputElement;
  const typeForm = h("form", { class: "chain-form", hidden: true }, typeInput, h("button", { class: "btn primary", type: "submit" }, en() ? "Fill" : "填入"));

  const numbers = new Map<string, number>();
  for (const w of x.words) numbers.set(key(w.row, w.col), w.number);

  function select(k: string) {
    selected = k;
    // Prefer the current word if it runs through this cell, else the first that does.
    if (!cellsOf(word).includes(k)) {
      const wi = x!.words.findIndex((_, i) => cellsOf(i).includes(k));
      if (wi >= 0) word = wi;
    }
    draw();
  }

  function nextBlank() {
    const inWord = cellsOf(word).filter((k) => blanks.includes(k) && !fills.has(k));
    selected = inWord[0] ?? blanks.find((k) => !fills.has(k)) ?? null;
    if (selected && !cellsOf(word).includes(selected)) select(selected);
  }

  function draw() {
    const active = new Set(cellsOf(word));
    const cells: HTMLElement[] = [];
    for (let r = 0; r < x!.height; r++) {
      for (let c = 0; c < x!.width; c++) {
        const k = key(r, c);
        const cell = answer.get(k);
        if (!cell) {
          cells.push(h("div", { class: "xw-cell void" }));
          continue;
        }
        const num = numbers.get(k);
        const fill = fills.get(k);
        const text = cell.given || finished ? cell.ch : fill ?? "";
        const cls = [
          "xw-cell",
          cell.given ? "given" : "blank",
          active.has(k) ? "active" : "",
          k === selected && !finished ? "sel" : "",
          wrong.has(k) ? "wrong" : "",
          finished && !cell.given ? "solved" : "",
        ].join(" ");
        cells.push(
          h(
            "button",
            {
              class: cls,
              onclick: () => {
                if (finished) {
                  const wi = x!.words.findIndex((_, i) => cellsOf(i).includes(k));
                  const s = byId.get(x!.words[wi]?.entry_id);
                  if (s) peek(s);
                  return;
                }
                if (mode === "tiles" && !cell.given && fills.has(k) && selected === k) {
                  fills.delete(k);
                  tileOf.delete(k);
                  wrong.delete(k);
                }
                select(k);
              },
            },
            num ? h("span", { class: "xw-num" }, String(num)) : null,
            text,
          ),
        );
      }
    }
    clear(gridEl, cells);

    const used = new Set(tileOf.values());
    tilesEl.hidden = mode !== "tiles";
    typeForm.hidden = mode !== "type" || finished;
    if (mode === "type") {
      const w = x!.words[word];
      typeInput.placeholder = en() ? `${w.number} ${w.across ? "across" : "down"}: type the expression` : `${w.number}${w.across ? "横" : "竖"}：输入整个成语`;
      const have = cellsOf(word).map((k) => (answer.get(k)!.given ? answer.get(k)!.ch : fills.get(k) ?? ""));
      if (document.activeElement !== typeInput) typeInput.value = have.every(Boolean) ? have.join("") : "";
    }
    clear(
      tilesEl,
      mode !== "tiles" ? [] : x!.tiles.map((t, i) =>
        h(
          "button",
          {
            class: "tile",
            disabled: used.has(i) || finished,
            onclick: () => {
              if (!selected || !blanks.includes(selected)) nextBlank();
              if (!selected) return;
              fills.set(selected, x!.tiles[i]);
              tileOf.set(selected, i);
              wrong.delete(selected);
              nextBlank();
              draw();
              if (fills.size === blanks.length) check();
            },
          },
          t,
        ),
      ),
    );

    const clue = (i: number) => {
      const w = x!.words[i];
      const s = byId.get(w.entry_id);
      const text = s ? meaningOf(s) : "";
      return h(
        "button",
        {
          class: `xw-clue ${i === word ? "on" : ""}`,
          onclick: () => {
            if (finished && s) return peek(s);
            word = i;
            selected = cellsOf(i).find((k) => blanks.includes(k) && !fills.has(k)) ?? cellsOf(i).find((k) => blanks.includes(k)) ?? null;
            draw();
          },
        },
        h("strong", null, `${w.number}. `),
        finished && s ? h("span", { class: "hanzi" }, `${s.text} `) : null,
        text,
      );
    };
    const across = x!.words.map((w, i) => [w, i] as const).filter(([w]) => w.across);
    const down = x!.words.map((w, i) => [w, i] as const).filter(([w]) => !w.across);
    clear(
      cluesEl,
      across.length ? h("div", null, h("h3", null, en() ? "横 Across" : "横"), across.map(([, i]) => clue(i))) : null,
      down.length ? h("div", null, h("h3", null, en() ? "竖 Down" : "竖"), down.map(([, i]) => clue(i))) : null,
    );
  }

  function check() {
    wrong.clear();
    for (const k of blanks) {
      const f = fills.get(k);
      if (f !== undefined && f !== answer.get(k)!.ch) wrong.add(k);
    }
    if (wrong.size === 0 && fills.size === blanks.length) return finish(true);
    draw();
    if (wrong.size) toast(en() ? `${wrong.size} square${wrong.size === 1 ? " is" : "s are"} wrong — tap to change.` : `有 ${wrong.size} 个格子不对，点一下可以改。`);
    else toast(en() ? "So far so good — keep going." : "目前都对，继续！");
  }

  function finish(won: boolean) {
    finished = true;
    for (const w of x!.words) api.quizAnswer(w.entry_id, won);
    api.gamePlayed();
    const items = entries.map((s) => ({ id: s.id, text: s.text }));
    saveResult({ at: Date.now(), game: "crossword", score: won ? (en() ? "solved" : "全部填对") : en() ? "answers shown" : "看了答案", right: won ? items : [], missed: won ? [] : items });
    draw();
    clear(
      feedback,
      h("p", { class: won ? "good" : "" }, won ? (en() ? "🎉 Solved!" : "🎉 全部填对！") : en() ? "Here are the answers." : "答案如下。"),
      h("div", { class: "chip-group" }, entries.map((s) => h("button", { class: "chip link", onclick: () => peek(s) }, s.text))),
      h("p", { class: "muted small" }, en() ? "Tap an expression to see its meaning." : "点词语可查看释义。"),
      h("button", { class: "btn primary block", onclick: () => renderCrossword(root) }, en() ? "New puzzle" : "再来一局"),
    );
  }

  // Typing mode: write the whole expression for the selected clue (pinyin keyboards suggest whole chengyu).
  typeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (finished) return;
    const cells = cellsOf(word);
    const chars = [...typeInput.value.replace(/\s/g, "")];
    if (chars.length !== cells.length) {
      toast(en() ? `This answer has ${cells.length} characters.` : `这个答案是 ${cells.length} 个字。`);
      return;
    }
    cells.forEach((k, i) => {
      if (!answer.get(k)!.given) {
        fills.set(k, chars[i]);
        wrong.delete(k);
      }
    });
    typeInput.value = "";
    if (fills.size === blanks.length) {
      typeInput.blur();
      draw();
      return check();
    }
    // On to the next clue that still has empty squares.
    const n = x!.words.length;
    for (let d = 1; d <= n; d++) {
      const wi = (word + d) % n;
      const open = cellsOf(wi).find((k) => blanks.includes(k) && !fills.has(k));
      if (open) {
        word = wi;
        selected = open;
        break;
      }
    }
    draw();
  });

  const modeBtns = (["tiles", "type"] as const).map((m) =>
    h(
      "button",
      {
        class: `chip ${mode === m ? "on" : ""}`,
        onclick: () => {
          if (mode === m) return;
          mode = m;
          tileOf.clear();
          modeBtns.forEach((b, i) => b.classList.toggle("on", ["tiles", "type"][i] === m));
          draw();
        },
      },
      m === "tiles" ? (en() ? "Pick characters 选字" : "选字") : en() ? "Type answers 自己输入" : "自己输入",
    ),
  );

  const checkBtn = h("button", { class: "btn", onclick: () => !finished && check() }, en() ? "Check 检查" : "检查");
  const revealBtn = h("button", { class: "btn", onclick: () => !finished && finish(false) }, en() ? "Show answers 看答案" : "看答案");

  clear(
    root,
    header,
    picker,
    h("div", { class: "chip-group center" }, modeBtns),
    h("p", { class: "muted small center" }, en() ? "Tap a square or clue, then pick characters or type the answer. Clues are the meanings." : "点一个空格或提示，再选字或输入答案。提示是成语的释义。"),
    gridEl,
    tilesEl,
    typeForm,
    h("div", { class: "row-gap" }, checkBtn, revealBtn),
    feedback,
    h("section", { class: "card" }, cluesEl),
  );
  draw();
}
