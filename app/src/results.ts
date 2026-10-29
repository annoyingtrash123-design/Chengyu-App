import { en } from "./ui";

export type GameKind = "quiz" | "timed" | "chain" | "scramble" | "crossword" | "memory" | "synonym" | "antonym";
export interface Item {
  id: string;
  text: string;
}

/** One finished game, as kept under Games → Past results. */
export interface PastGame {
  at: number;
  game?: GameKind;
  /** Older saves (quizzes only) have `timed` instead of `game`. */
  timed?: boolean;
  /** Short result line, e.g. "8 / 10" or "chain of 7". */
  score?: string | number;
  total?: number;
  right: Item[];
  missed: Item[];
}

const KEY = "quiz-history";
const MAX = 50;

export function loadResults(): PastGame[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveResult(r: PastGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify([r, ...loadResults()].slice(0, MAX)));
  } catch {
    /* storage unavailable: the result is still shown, just not kept */
  }
}

export function gameName(r: PastGame): string {
  const g = r.game ?? (r.timed ? "timed" : "quiz");
  const names: Record<GameKind, [string, string]> = {
    quiz: ["测验", "Quiz"],
    timed: ["限时挑战", "Timed challenge"],
    chain: ["成语接龙", "Idiom chain"],
    scramble: ["拼成语", "Unscramble"],
    crossword: ["填字游戏", "Crossword"],
    memory: ["翻牌配对", "Memory match"],
    synonym: ["近义配对", "Synonym match"],
    antonym: ["反义配对", "Antonym match"],
  };
  return names[g][en() ? 1 : 0];
}

/** The score line: quizzes keep their "score / total" form. */
export function scoreLine(r: PastGame): string {
  if (r.score === undefined) return "";
  if (typeof r.score === "number" && r.total !== undefined && !r.timed && (r.game ?? "quiz") === "quiz") return `${r.score} / ${r.total}`;
  return String(r.score);
}

/**
 * Games played one round at a time (Unscramble): rounds within half an hour of the last one
 * join the same Past results card instead of filling the list.
 */
export function saveRound(game: GameKind, item: Item, ok: boolean) {
  const all = loadResults();
  const top = all[0];
  const r: PastGame =
    top && top.game === game && Date.now() - top.at < 30 * 60_000 ? all.shift()! : { at: 0, game, right: [], missed: [] };
  r.at = Date.now();
  (ok ? r.right : r.missed).unshift(item);
  r.total = r.right.length + r.missed.length;
  r.score = `${r.right.length} / ${r.total}`;
  try {
    localStorage.setItem(KEY, JSON.stringify([r, ...all].slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}
