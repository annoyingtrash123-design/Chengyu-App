import { api } from "../api";
import type { Crossword, Deck, Summary } from "../types";
import { h, clear, en, pageHeader, meaningOf, peek, toast } from "../ui";
import { deckPicker } from "./study";

let deck: Deck = { type: "filtered", filters: { frequencies: [1] } };

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
  const fills = new Map<string, number>(); // cell → index into x.tiles
  let word = 0;
  let selected: string | null = cellsOf(0).find((k) => blanks.includes(k)) ?? blanks[0] ?? null;
  let finished = false;
  const wrong = new Set<string>();

  const gridEl = h("div", { class: "xw-grid", style: `grid-template-columns: repeat(${x.width}, 1fr); max-width: ${x.width * 44}px` });
  const tilesEl = h("div", { class: "tiles xw-tiles" });
  const cluesEl = h("div", { class: "xw-clues" });
  const feedback = h("div", { class: "feedback" });

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
        const text = cell.given || finished ? cell.ch : fill !== undefined ? x!.tiles[fill] : "";
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
                if (!cell.given && fills.has(k) && selected === k) {
                  fills.delete(k);
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

    const used = new Set(fills.values());
    clear(
      tilesEl,
      x!.tiles.map((t, i) =>
        h(
          "button",
          {
            class: "tile",
            disabled: used.has(i) || finished,
            onclick: () => {
              if (!selected || !blanks.includes(selected)) nextBlank();
              if (!selected) return;
              fills.set(selected, i);
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
      if (f !== undefined && x!.tiles[f] !== answer.get(k)!.ch) wrong.add(k);
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
    draw();
    clear(
      feedback,
      h("p", { class: won ? "good" : "" }, won ? (en() ? "🎉 Solved!" : "🎉 全部填对！") : en() ? "Here are the answers." : "答案如下。"),
      h("div", { class: "chip-group" }, entries.map((s) => h("button", { class: "chip link", onclick: () => peek(s) }, s.text))),
      h("p", { class: "muted small" }, en() ? "Tap an expression to see its meaning." : "点词语可查看释义。"),
      h("button", { class: "btn primary block", onclick: () => renderCrossword(root) }, en() ? "New puzzle" : "再来一局"),
    );
  }

  const checkBtn = h("button", { class: "btn", onclick: () => !finished && check() }, en() ? "Check 检查" : "检查");
  const revealBtn = h("button", { class: "btn", onclick: () => !finished && finish(false) }, en() ? "Show answers 看答案" : "看答案");

  clear(
    root,
    header,
    picker,
    h("p", { class: "muted small center" }, en() ? "Tap a square, then a character below. Clues are the meanings." : "点一个空格，再点下面的字。提示是成语的释义。"),
    gridEl,
    tilesEl,
    h("div", { class: "row-gap" }, checkBtn, revealBtn),
    feedback,
    h("section", { class: "card" }, cluesEl),
  );
  draw();
}
