// Bridge to the Rust core. Inside the Tauri app this calls the `api` command;
// in a plain browser it posts to the Rust dev server (see devserver/).

import type {
  ChainCheck,
  Deck,
  EntryDetail,
  Filters,
  Grade,
  MatchCard,
  Meta,
  Question,
  QuestionKind,
  Scramble,
  Settings,
  Stats,
  Summary,
  Card,
} from "./types";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// The WebAssembly build of the Rust core (web/PWA version). The glob is empty when the
// wasm hasn't been built (Tauri builds, unit tests), in which case the dev server is used.
const wasmModules = import.meta.glob("./core-wasm/chengyu_wasm.js");
const PROGRESS_KEY = "chengyu-progress-v1";

interface Engine {
  dispatch(cmd: string, args: string): string;
  take_changed(): boolean;
}

let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  enginePromise ??= (async () => {
    const load = Object.values(wasmModules)[0];
    const mod = (await load()) as { default: () => Promise<unknown>; Engine: new () => Engine };
    await mod.default();
    const engine = new mod.Engine();
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PROGRESS_KEY);
    } catch {
      // Storage unavailable (e.g. blocked): run without saving.
    }
    if (saved) {
      try {
        engine.dispatch("import", JSON.stringify({ data: JSON.parse(saved) }));
      } catch {
        // Never lose saved progress we couldn't read: keep a copy before anything
        // overwrites the main key, so it can be recovered.
        try {
          localStorage.setItem(`${PROGRESS_KEY}-unreadable-${Date.now()}`, saved);
        } catch {
          // ignore
        }
      }
    }
    engine.take_changed();
    navigator.storage?.persist?.().catch(() => {});
    // Another tab/window of the app saved progress: pick it up instead of overwriting it.
    window.addEventListener("storage", (e) => {
      if (e.key !== PROGRESS_KEY || !e.newValue) return;
      try {
        engine.dispatch("import", JSON.stringify({ data: JSON.parse(e.newValue) }));
        engine.take_changed();
      } catch {
        // ignore
      }
    });
    return engine;
  })();
  return enginePromise;
}

function saveProgress(engine: Engine) {
  if (!engine.take_changed()) return;
  try {
    localStorage.setItem(PROGRESS_KEY, engine.dispatch("export", "{}"));
  } catch {
    // Storage full or blocked: progress stays in memory for this session.
  }
}

export const usesWasm = () => !inTauri && Object.keys(wasmModules).length > 0 && import.meta.env.VITE_BACKEND !== "devserver";

export async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>("api", { cmd, args });
  }
  if (usesWasm()) {
    const engine = await loadEngine();
    const out = engine.dispatch(cmd, JSON.stringify(args));
    saveProgress(engine);
    return JSON.parse(out) as T;
  }
  const res = await fetch(`/api/${cmd}`, { method: "POST", body: JSON.stringify(args) });
  const json = await res.json();
  if ("error" in json) throw new Error(json.error);
  return json.ok as T;
}

export const isTauri = () => inTauri;

/** Local day number (days since 1970-01-01 in the user's time zone). */
export function today(date = new Date()): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

export const api = {
  meta: () => call<Meta>("meta"),
  search: (query: string, filters: Partial<Filters>, offset = 0, limit = 40) =>
    call<{ total: number; items: Summary[] }>("search", { query, filters, offset, limit }),
  entry: (id: string) => call<EntryDetail>("entry", { id }),
  summaries: (ids: string[]) => call<Summary[]>("summaries", { ids }),
  toggleFavourite: (id: string) => call<boolean>("toggle_favourite", { id }),
  daily: (day = today()) => call<Summary | null>("daily", { today: day }),
  studyQueue: (deck: Deck, limit = 50) => call<string[]>("study_queue", { deck, limit, today: today() }),
  deckSize: (deck: Deck) => call<number>("deck_size", { deck }),
  review: (id: string, grade: Grade) => call<Card>("review", { id, grade, today: today() }),
  quiz: (deck: Deck, kinds: QuestionKind[], count: number, lang: "en" | "zh") =>
    call<Question[]>("quiz", { deck, kinds, count, lang, seed: randomSeed() }),
  quizAnswer: (id: string, correct: boolean) => call<null>("quiz_answer", { id, correct, today: today() }),
  gamePlayed: () => call<null>("game_played", { today: today() }),
  chainStart: (homophones: boolean) => call<string | null>("chain_start", { homophones, seed: randomSeed() }),
  chainCheck: (prev: string, text: string, used: string[], homophones: boolean) =>
    call<ChainCheck>("chain_check", { prev, text, used, homophones }),
  chainAi: (prev: string, used: string[], homophones: boolean) =>
    call<string | null>("chain_ai", { prev, used, homophones, seed: randomSeed() }),
  chainHint: (prev: string, used: string[], homophones: boolean) =>
    call<number>("chain_hint", { prev, used, homophones }),
  scramble: (deck: Deck, decoys: number) => call<Scramble | null>("scramble", { deck, decoys, seed: randomSeed() }),
  matchCards: (deck: Deck, mode: "meaning" | "synonym" | "antonym", pairs: number, english: boolean) =>
    call<MatchCard[]>("match_cards", { deck, mode, pairs, english, seed: randomSeed() }),
  stats: () => call<Stats>("stats", { today: today() }),
  settings: () => call<Settings>("settings"),
  setSettings: (settings: Settings) => call<Settings>("set_settings", { settings }),
  exportData: () => call<unknown>("export"),
  importData: (data: unknown) =>
    call<{ cards: number; favourites: number; days: number; dropped: number }>("import", { data }),
  previewImport: (data: unknown) =>
    call<{ cards: number; favourites: number; days: number; empty: boolean }>("preview_import", { data }),
};
