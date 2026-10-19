import { h, clear, en, pageHeader } from "../ui";

const GAMES = [
  { href: "#/games/quiz", icon: "测", zh: "测验", en: "Quiz", descZh: "选择题：释义、填字、例句、拼音、近反义", descEn: "Multiple choice: meanings, missing characters, sentences, tones, synonyms" },
  { href: "#/games/timed", icon: "时", zh: "限时挑战", en: "Timed challenge", descZh: "60 秒内答对越多越好", descEn: "Answer as many as you can in 60 seconds" },
  { href: "#/games/chain", icon: "龙", zh: "成语接龙", en: "Idiom chain", descZh: "用上一个成语的最后一个字开头", descEn: "Start each idiom with the last character of the previous one" },
  { href: "#/games/scramble", icon: "拼", zh: "拼成语", en: "Unscramble", descZh: "把打乱的字排回正确顺序", descEn: "Put the jumbled characters back in order" },
  { href: "#/games/crossword", icon: "填", zh: "填字游戏", en: "Crossword", descZh: "成语交叉成格，按释义填空", descEn: "Fill the blanks in a grid of crossing chengyu, using their meanings as clues" },
  { href: "#/games/memory", icon: "翻", zh: "翻牌配对", en: "Memory match", descZh: "把成语和释义配成一对", descEn: "Flip cards to pair expressions with their meanings" },
  { href: "#/games/match/synonym", icon: "近", zh: "近义配对", en: "Synonym match", descZh: "把意思相近的配成一对", descEn: "Pair expressions with their synonyms" },
  { href: "#/games/match/antonym", icon: "反", zh: "反义配对", en: "Antonym match", descZh: "把意思相反的配成一对", descEn: "Pair expressions with their opposites" },
];

export function renderGames(root: HTMLElement) {
  clear(
    root,
    pageHeader(en() ? "Games & tests" : "游戏与测验"),
    h(
      "div",
      { class: "game-list" },
      GAMES.map((g) =>
        h(
          "a",
          { class: "card game", href: g.href },
          h("span", { class: "game-icon" }, g.icon),
          h("div", null, h("strong", null, en() ? `${g.zh} ${g.en}` : g.zh), h("div", { class: "muted small" }, en() ? g.descEn : g.descZh)),
        ),
      ),
    ),
  );
}
