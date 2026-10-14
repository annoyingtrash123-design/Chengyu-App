# 成语词典 Chengyu App

A searchable dictionary of 成语, 俗语/谚语, 歇后语, 惯用语 and common 四字词语 for advanced learners, with
flashcards, quizzes and games. Runs as a native Android / iOS app (Tauri 2) with all
logic in Rust.

## Features

- **Search** by characters (any position or order: `足蛇` finds 画蛇添足), pinyin with or
  without tones (`huà shé`, `hua she`, `huashe`, `hua4 she2`, initials `hstz`), or English,
  with typo tolerance.
- **Filters that combine**: type, theme (match any / all), number of characters, pattern
  (AABB, ABAC…), how common (core / common / literary), 褒义/贬义/中性, register, your
  learning status, favourites, has an origin story.
- **Entries** include pinyin, literal and idiomatic meaning (English + Chinese), example
  sentences, origin story and classical source, usage notes, and synonyms / antonyms that
  link to each other.
- **Flashcards** with spaced repetition (Anki-style), decks for everything, the Core 500,
  favourites, a type or a theme; either direction.
- **Games & tests**: quiz (7 question types), 60-second timed challenge, 成语接龙 against
  the app, unscramble, memory match, synonym and antonym matching.
- **Progress**: streaks, daily goal, mastered/learning counts, 30-day activity, weak spots,
  backup/restore.
- **Chengyu of the day** on the home screen and as an optional daily reminder notification.
- **Bilingual**: switch English off anywhere (the EN button) to practise in Chinese only.

## Project layout

```
core/            Rust library: data model, search, filters, SRS, quizzes, games, stats
  src/validate.rs  data checks run by `cargo test`
data/
  entries/*.json   the dictionary content (one JSON array per file)
  themes.json      theme list (id + English + Chinese label)
  master_list.json your list after review: 905 unique items (typos corrected, merged, a few dropped)
  source/          the raw 916-item list and the review decisions
app/             Tauri app
  src/           TypeScript UI (no framework)
  src-tauri/     Tauri shell — forwards one `api` command to the Rust core
devserver/       Runs the Rust core over HTTP so the UI can be developed in a browser
scripts/         Python helpers (content backlog report)
```

## Running it

Prerequisites: Rust (stable), Node 22.

```bash
cd app && npm install

# In a browser, with the real Rust core behind it (fastest for UI work):
npm run dev:browser            # then open http://localhost:1420

# As a desktop window:
npm run tauri dev
```

### Android

**Easiest:** every push builds a debug APK on GitHub. Open the repo's **Actions** tab, then
**Android APK**, then the latest run, and download `chengyu-android-debug-apk` from
**Artifacts**. Unzip it, copy the `.apk` to your phone and open it (allow "install unknown
apps" when asked).

Locally (needs Android Studio with the SDK + NDK):

```bash
cd app
npx tauri android init     # once
npx tauri android dev      # run on a connected phone / emulator
npx tauri android build    # release build
```

### iOS

Needs a Mac with Xcode (and an Apple developer account to install on a real iPhone):

```bash
cd app
npx tauri ios init
npx tauri ios dev          # simulator or connected iPhone
```

## Tests

```bash
cargo test -p chengyu-core     # logic + validates every dictionary entry
cd app && npm test             # frontend unit tests
python3 scripts/backlog.py     # content progress report
```

CI runs all of these on every push.

## Adding entries

Add objects to any file in `data/entries/` (see `docs/content-guide.md` for every field).
`cargo test` will refuse entries with wrong pinyin syllable counts, missing tone marks,
unknown themes, examples that don't contain the expression, duplicates, and so on.
