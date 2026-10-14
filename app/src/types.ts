// Shapes returned by the Rust core (see core/src/app.rs).

export type Kind = "chengyu" | "suyu" | "xiehouyu" | "guanyongyu" | "phrase";
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
  meaning: Bilingual;
  examples: { zh: string; en: string }[];
  origin: { source: string; story: Bilingual } | null;
  usage: Bilingual;
  synonyms: string[];
  antonyms: string[];
  parts?: [string, string];
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
}

export interface Meta {
  total: number;
  themes: Theme[];
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

export interface Scramble {
  entry_id: string;
  tiles: string[];
  length: number;
}
