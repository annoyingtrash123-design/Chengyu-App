import { api } from "../api";
import type { Deck, Question, QuestionKind } from "../types";
import { h, clear, en, pageHeader, englishToggle, toast } from "../ui";
import { deckPicker } from "./study";

const KINDS: { kind: QuestionKind; zh: string; en: string }[] = [
  { kind: "meaning_to_idiom", zh: "看释义选成语", en: "Meaning → expression" },
  { kind: "idiom_to_meaning", zh: "看成语选释义", en: "Expression → meaning" },
  { kind: "missing_char", zh: "填空缺的字", en: "Missing character" },
  { kind: "sentence_cloze", zh: "例句填空", en: "Fill the sentence" },
  { kind: "pinyin", zh: "选正确拼音", en: "Pinyin & tones" },
  { kind: "synonym", zh: "选近义词", en: "Synonym" },
  { kind: "antonym", zh: "选反义词", en: "Antonym" },
];

const INSTRUCTION: Record<QuestionKind, [string, string]> = {
  meaning_to_idiom: ["哪个成语符合这个意思？", "Which expression matches this meaning?"],
  idiom_to_meaning: ["这个是什么意思？", "What does this mean?"],
  missing_char: ["缺的是哪个字？", "Which character is missing?"],
  sentence_cloze: ["哪个填进句子最合适？", "Which fits the sentence?"],
  pinyin: ["哪个拼音正确？", "Which pinyin is correct?"],
  synonym: ["哪个是近义词？", "Which is a synonym?"],
  antonym: ["哪个是反义词？", "Which is an antonym?"],
};

const prefs: { deck: Deck; kinds: QuestionKind[]; count: number } = {
  deck: { type: "all" },
  kinds: KINDS.map((k) => k.kind),
  count: 10,
};

export function renderQuiz(root: HTMLElement, [mode]: string[]) {
  const timed = mode === "timed";
  const title = timed ? (en() ? "Timed challenge" : "限时挑战") : en() ? "Quiz" : "测验";

  const kindChips = h(
    "div",
    { class: "chip-group" },
    KINDS.map((k) => {
      const b = h("button", { class: `chip ${prefs.kinds.includes(k.kind) ? "on" : ""}` }, en() ? k.en : k.zh);
      b.addEventListener("click", () => {
        prefs.kinds = prefs.kinds.includes(k.kind) ? prefs.kinds.filter((x) => x !== k.kind) : [...prefs.kinds, k.kind];
        b.classList.toggle("on", prefs.kinds.includes(k.kind));
      });
      return b;
    }),
  );
  const countSel = h(
    "select",
    { class: "select", onchange: (e: Event) => (prefs.count = Number((e.target as HTMLSelectElement).value)) },
    [5, 10, 20, 30].map((n) => h("option", { value: String(n), selected: n === prefs.count }, String(n))),
  );

  const start = async () => {
    if (!prefs.kinds.length) return toast(en() ? "Pick at least one question type" : "请至少选择一种题型");
    const questions = await api.quiz(prefs.deck, prefs.kinds, timed ? 60 : prefs.count, en() ? "en" : "zh");
    if (!questions.length) return toast(en() ? "Not enough entries in this deck for these question types" : "这个卡组的词条不够出题");
    play(root, title, questions, timed);
  };

  clear(
    root,
    pageHeader(title, { back: true }),
    h(
      "section",
      { class: "card" },
      timed ? h("p", { class: "muted" }, en() ? "60 seconds. Every correct answer scores a point." : "60 秒，答对一题得一分。") : null,
      h("label", { class: "field-label" }, en() ? "Deck" : "卡组"),
      deckPicker((d) => (prefs.deck = d), prefs.deck),
      h("label", { class: "field-label" }, en() ? "Question types" : "题型"),
      kindChips,
      timed ? null : [h("label", { class: "field-label" }, en() ? "Questions" : "题数"), countSel],
      h("button", { class: "btn primary block", onclick: start }, en() ? "Start" : "开始"),
    ),
  );
}

function play(root: HTMLElement, title: string, questions: Question[], timed: boolean) {
  let i = 0;
  let score = 0;
  const missed: Question[] = [];
  let timeLeft = 60;
  let timer: number | undefined;
  let over = false;
  const clock = h("span", { class: "clock" });

  if (timed) {
    clock.textContent = "60s";
    timer = window.setInterval(() => {
      timeLeft--;
      clock.textContent = `${timeLeft}s`;
      if (timeLeft <= 0 || !root.isConnected) finish();
    }, 1000);
  }

  function finish() {
    if (over) return;
    over = true;
    clearInterval(timer);
    if (!root.isConnected) return;
    api.gamePlayed();
    clear(
      root,
      pageHeader(title, { back: true }),
      h(
        "section",
        { class: "card center" },
        h("div", { class: "big-emoji" }, score === i && i > 0 ? "🏆" : "✅"),
        h("p", { class: "score" }, timed ? `${score}` : `${score} / ${i}`),
        h("p", { class: "muted" }, timed ? (en() ? "correct in 60 seconds" : "60 秒答对题数") : en() ? "correct" : "答对"),
        h("button", { class: "btn primary", onclick: () => renderQuiz(root, [timed ? "timed" : "quiz"]) }, en() ? "Play again" : "再来一次"),
      ),
      missed.length
        ? h(
            "section",
            { class: "card" },
            h("h3", null, en() ? "Review these" : "需要复习"),
            missed.map((q) => h("a", { class: "chip link", href: `#/entry/${q.entry_id}` }, q.kind === "missing_char" ? q.prompt.replace("＿", q.options[q.answer]) : q.kind === "meaning_to_idiom" || q.kind === "sentence_cloze" ? q.options[q.answer] : q.prompt)),
          )
        : null,
    );
  }

  function show() {
    if (over) return;
    const q = questions[i];
    if (!q) return finish();
    let answered = false;
    const feedback = h("div", { class: "feedback" });
    const buttons = q.options.map((opt, idx) =>
      h(
        "button",
        {
          class: `option ${q.kind === "idiom_to_meaning" ? "option-text" : "option-hanzi"}`,
          onclick: async () => {
            if (answered) return;
            answered = true;
            const ok = idx === q.answer;
            if (ok) score++;
            else missed.push(q);
            buttons[q.answer].classList.add("correct");
            if (!ok) buttons[idx].classList.add("wrong");
            api.quizAnswer(q.entry_id, ok);
            i++;
            if (timed) {
              setTimeout(show, ok ? 350 : 900);
            } else {
              clear(
                feedback,
                h("span", { class: ok ? "good" : "bad" }, ok ? (en() ? "Correct!" : "答对了！") : en() ? "Not quite." : "答错了。"),
                h("a", { href: `#/entry/${q.entry_id}`, class: "small" }, en() ? " See entry ›" : " 查看词条 ›"),
                h("button", { class: "btn primary block", onclick: show }, i < questions.length ? (en() ? "Next" : "下一题") : en() ? "Finish" : "完成"),
              );
            }
          },
        },
        opt,
      ),
    );
    const [instZh, instEn] = INSTRUCTION[q.kind];
    clear(
      root,
      pageHeader(title, { back: true, right: [timed ? clock : null, englishToggle(show)] }),
      h("div", { class: "muted small center" }, timed ? `${en() ? "Score" : "得分"} ${score}` : `${i + 1} / ${questions.length}`),
      h(
        "section",
        { class: "card question" },
        h("div", { class: "muted small" }, en() ? `${instZh} ${instEn}` : instZh),
        h("div", { class: q.kind === "meaning_to_idiom" || q.kind === "sentence_cloze" ? "prompt-text" : "prompt-hanzi" }, q.prompt),
        q.prompt_en && en() ? h("div", { class: "en" }, q.prompt_en) : null,
      ),
      h("div", { class: "options" }, buttons),
      feedback,
    );
  }

  show();
}
