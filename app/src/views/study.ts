import { api } from "../api";
import type { Deck, Grade, Summary } from "../types";
import { h, clear, en, pageHeader, englishToggle, state, themeLabel, label, KIND_LABEL, toast, maskAnswer } from "../ui";
import type { Kind } from "../types";

/** Deck picker shared by study and games. */
export function deckPicker(onChange: (d: Deck) => void, initial: Deck = { type: "all" }) {
  const sel = h("select", { class: "select" });
  const options: [string, string, Deck][] = [
    ["all", en() ? "Everything" : "全部", { type: "all" }],
    ["core", en() ? "Core 500 (most common)" : "核心 500", { type: "core" }],
    ["favourites", en() ? "♥ Favourites" : "♥ 收藏", { type: "favourites" }],
    ...(["chengyu", "suyu", "xiehouyu", "guanyongyu", "phrase", "mingju"] as Kind[]).map(
      (k) => [`kind:${k}`, label(KIND_LABEL[k]), { type: "filtered", filters: { kinds: [k] } }] as [string, string, Deck],
    ),
    ...(state.meta?.themes ?? []).filter((t) => !t.group).map(
      (t) => [`theme:${t.id}`, `${en() ? "Label" : "标签"}: ${themeLabel(t.id)}`, { type: "filtered", filters: { themes: [t.id] } }] as [string, string, Deck],
    ),
  ];
  const key = (d: Deck) =>
    d.type === "filtered" ? (d.filters.kinds?.length ? `kind:${d.filters.kinds[0]}` : `theme:${d.filters.themes?.[0]}`) : d.type;
  options.forEach(([k, text]) => sel.appendChild(h("option", { value: k, selected: k === key(initial) }, text)));
  sel.addEventListener("change", () => onChange(options.find(([k]) => k === sel.value)![2]));
  return sel;
}

let lastDeck: Deck = { type: "all" };
let recall = false; // false: see expression → recall meaning; true: see meaning → recall expression

export async function renderStudy(root: HTMLElement) {
  const info = h("div", { class: "muted small" });
  const startBtn = h("button", { class: "btn primary block" }, en() ? "Start session" : "开始");

  async function refresh() {
    const [queue, size] = await Promise.all([api.studyQueue(lastDeck, 200), api.deckSize(lastDeck)]);
    info.textContent = en()
      ? `${queue.length} card${queue.length === 1 ? "" : "s"} ready (due + new) · ${size} in deck`
      : `可学习 ${queue.length} 张（复习 + 新词）· 共 ${size} 条`;
    startBtn.disabled = queue.length === 0;
  }

  const directionBtn = h("button", { class: "chip" });
  const drawDirection = () => {
    directionBtn.textContent = recall ? (en() ? "Meaning → expression" : "释义 → 成语") : en() ? "Expression → meaning" : "成语 → 释义";
  };
  directionBtn.addEventListener("click", () => {
    recall = !recall;
    drawDirection();
  });
  drawDirection();

  startBtn.addEventListener("click", async () => {
    const ids = await api.studyQueue(lastDeck, 200);
    if (!ids.length) return toast(en() ? "Nothing to study right now 🎉" : "暂时没有要学的 🎉");
    session(root, await api.summaries(ids));
  });

  clear(
    root,
    pageHeader(en() ? "Flashcards" : "记忆卡片"),
    h(
      "section",
      { class: "card" },
      h("label", { class: "field-label" }, en() ? "Deck" : "卡组"),
      deckPicker((d) => {
        lastDeck = d;
        refresh();
      }, lastDeck),
      h("label", { class: "field-label" }, en() ? "Direction" : "方向"),
      h("div", null, directionBtn),
      info,
      startBtn,
    ),
    h(
      "section",
      { class: "card muted small" },
      en()
        ? "Cards you find hard come back sooner; ones you know well are spaced further apart. A card counts as mastered once its review interval reaches 3 weeks."
        : "答错的卡片会更快再出现，熟悉的卡片间隔越来越长。复习间隔达到三周即视为已掌握。",
    ),
  );
  await refresh();
}

let keyHandler: ((e: KeyboardEvent) => void) | null = null;
document.addEventListener("keydown", (e) => {
  if (location.hash.startsWith("#/study") && keyHandler) keyHandler(e);
});

function session(root: HTMLElement, cards: Summary[]) {
  const queue = [...cards];
  let reviewed = 0;
  let correct = 0;

  const next = () => {
    const card = queue.shift();
    if (!card) return finish();
    let revealed = false;

    const back = h(
      "div",
      { class: "flash-back" },
      recall || card.kind === "xiehouyu" ? h("div", { class: "hanzi-xl" }, card.text) : null,
      h("div", { class: "pinyin-lg" }, card.pinyin),
      h("p", { class: "zh" }, card.meaning.zh),
      en() ? h("p", { class: "en" }, card.meaning.en) : null,
      h("a", { class: "small", href: `#/entry/${card.id}` }, en() ? "Full entry ›" : "查看详情 ›"),
    );
    back.hidden = true;

    const grades = h(
      "div",
      { class: "grade-row" },
      gradeBtn("again", en() ? "Again" : "忘了"),
      gradeBtn("hard", en() ? "Hard" : "困难"),
      gradeBtn("good", en() ? "Good" : "记得"),
      gradeBtn("easy", en() ? "Easy" : "简单"),
    );
    grades.hidden = true;
    const showBtn = h("button", { class: "btn primary block" }, en() ? "Show answer" : "显示答案");

    function reveal() {
      if (revealed) return;
      revealed = true;
      back.hidden = false;
      grades.hidden = false;
      showBtn.hidden = true;
    }
    showBtn.addEventListener("click", reveal);

    let grading = false;
    async function grade(g: Grade) {
      if (grading || !revealed) return; // ignore double taps
      grading = true;
      grades.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
      const result = await api.review(card!.id, g);
      reviewed++;
      if (g !== "again") correct++;
      if (result.interval === 0) queue.push(card!); // not learnt yet: see it again this session
      next();
    }
    function gradeBtn(g: Grade, text: string) {
      return h("button", { class: `btn grade grade-${g}`, onclick: () => grade(g) }, text);
    }
    keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === " " || e.key === "Enter") && !revealed) {
        e.preventDefault();
        reveal();
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        grade((["again", "hard", "good", "easy"] as Grade[])[Number(e.key) - 1]);
      }
    };

    clear(
      root,
      pageHeader(en() ? "Flashcards" : "记忆卡片", { right: englishToggle(() => { queue.unshift(card); next(); }) }),
      h("div", { class: "muted small center" }, en() ? `${queue.length + 1} left` : `剩余 ${queue.length + 1}`),
      h(
        "section",
        { class: "card flashcard", onclick: reveal },
        recall
          ? h("div", { class: "flash-front" }, h("p", { class: "zh big" }, maskAnswer(card.meaning.zh, card.text)), en() ? h("p", { class: "en" }, card.meaning.en) : null)
          : h("div", { class: "flash-front" }, h("div", { class: "hanzi-xl" }, card.kind === "xiehouyu" ? `${card.text.split("——")[0]} ——？` : card.text)),
        back,
      ),
      showBtn,
      grades,
      h("p", { class: "muted small center kbd-hint" }, en() ? "Keyboard: Space to show · 1–4 to grade" : "键盘：空格显示答案 · 1–4 评分"),
    );
  };

  const finish = () => {
    keyHandler = null;
    clear(
      root,
      pageHeader(en() ? "Session complete" : "完成"),
      h(
        "section",
        { class: "card center" },
        h("div", { class: "big-emoji" }, "🎉"),
        h("p", null, en() ? `${reviewed} reviews · ${Math.round((100 * correct) / Math.max(1, reviewed))}% remembered` : `复习 ${reviewed} 次 · 记住 ${Math.round((100 * correct) / Math.max(1, reviewed))}%`),
        h("button", { class: "btn primary", onclick: () => renderStudy(root) }, en() ? "Back" : "返回"),
      ),
    );
  };

  next();
}
