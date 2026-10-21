// Shapes returned by the Rust core (see core/src/app.rs).

export type Kind = "chengyu" | "suyu" | "xiehouyu" | "guanyongyu" | "phrase" | "mingju";
export type Sentiment = "positive" | "negative" | "neutral";
export type Register = "casual" | "neutral" | "formal" | "literary";
export type Status = "new" | "learning" | "mastered";
export type Grade = "again" | "hard" | "good" | "easy";

export interface Bilingual {
  en: string;
  zh: string;
}

export interface Summary {
  id: string;
  text: string;
  pinyin: string;
  kind: Kind;
  frequency: number;
  sentiment: Sentiment;
  register: Register;
  themes: string[];
  meaning: Bilingual;
  length: number;
  structure: string | null;
  status: Status;
  favourite: boolean;
  seen: boolean;
  modern?: "modern" | "borrowed";
  matched?: string;
}

export interface Entry {
  id: string;
  text: string;
  pinyin: string;
  kind: Kind;
  frequency: number;
  sentiment: Sentiment;
  register: Register;
  themes: string[];
  literal: string;
  natural: string;
  meaning: Bilingual;
  equivalents: string[];
  examples: { zh: string; en: string }[];
  origin: { source: string; story: Bilingual; date?: Bilingual } | null;
  usage: Bilingual;
  synonyms: string[];
  antonyms: string[];
  parts?: [string, string];
  modern?: "modern" | "borrowed";
  /** Other accepted forms, merged into this entry. */
  variants?: string[];
  /** Type of each variant; missing means an equally acceptable alternative. */
  variant_kinds?: Record<string, "alt" | "old" | "error" | "short" | "full">;
}

export interface Card {
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  due: number;
  last_review: number;
}

export interface Link {
  text: string;
  id: string | null;
}

export interface EntryDetail {
  entry: Entry;
  summary: Summary;
  card: Card | null;
  accuracy: { seen: number; correct: number } | null;
  synonyms: Link[];
  antonyms: Link[];
  chars: string[];
}

export interface Theme {
  id: string;
  en: string;
  zh: string;
  /** Broad theme this detailed theme belongs to; absent for broad themes. */
  group?: string;
}

export interface Meta {
  total: number;
  themes: Theme[];
  theme_counts: Record<string, number>;
  structures: string[];
  kinds: Record<Kind, number>;
}

export interface Filters {
  kinds: Kind[];
  themes: string[];
  themes_all: boolean;
  lengths: number[];
  structures: string[];
  frequencies: number[];
  sentiments: Sentiment[];
  registers: Register[];
  statuses: Status[];
  favourites_only: boolean;
  has_origin: boolean;
  modern_only: boolean;
}

export type Deck =
  | { type: "all" }
  | { type: "core" }
  | { type: "favourites" }
  | { type: "filtered"; filters: Partial<Filters> };

export type QuestionKind =
  | "meaning_to_idiom"
  | "idiom_to_meaning"
  | "missing_char"
  | "sentence_cloze"
  | "pinyin"
  | "synonym"
  | "antonym";

export interface Question {
  kind: QuestionKind;
  entry_id: string;
  prompt: string;
  prompt_en: string | null;
  options: string[];
  answer: number;
}

export interface Settings {
  daily_goal: number;
  new_per_day: number;
  show_english: boolean;
  reminders: boolean;
  reminder_time: string;
}

export interface DayLog {
  reviews: number;
  correct: number;
  new_cards: number;
  quiz_answers: number;
  games: number;
}

export interface Stats {
  new: number;
  learning: number;
  mastered: number;
  due_today: number;
  streak: number;
  best_streak: number;
  today: DayLog;
  daily_goal: number;
  last_30_days: number[];
  total_reviews: number;
  accuracy: number;
  weak_spots: { id: string; lapses: number; accuracy: number }[];
}

export type ChainCheck =
  | { result: "ok"; id: string }
  | { result: "not_in_dictionary" }
  | { result: "already_used"; id: string }
  | { result: "does_not_connect"; id: string; need: string };

export interface MatchCard {
  pair: number;
  face: string;
  is_idiom: boolean;
  entry_id: string;
}

export interface LinkPart {
  text: string;
  id?: string;
  summary?: Summary;
}

export interface History {
  viewed: Summary[];
  studied: Summary[];
  studied_total: number;
}

export interface CrosswordWord {
  entry_id: string;
  number: number;
  row: number;
  col: number;
  across: boolean;
  length: number;
}

export interface Crossword {
  width: number;
  height: number;
  cells: { row: number; col: number; ch: string; given: boolean }[];
  words: CrosswordWord[];
  tiles: string[];
}

export interface Scramble {
  entry_id: string;
  tiles: string[];
  length: number;
}
