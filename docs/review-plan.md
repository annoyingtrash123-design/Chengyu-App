# Adversarial review — plan

The plan for a high-level, adversarial review of 语林词典 (web app, Android app, data). It is the brief for the lead
(Opus, high effort) and the sub-agents it delegates to. **This review finds and proves problems; it does not fix them.**
Fixes come afterwards, from the ranked report, in the detailed check.

## 1. Principles

- **Adversarial, not confirmatory.** Every stream starts from "how does this fail, mislead or disappoint?". Praise is
  out of scope except as a one-line note on what to keep.
- **No evidence, no finding.** Each finding needs reproducible steps, a screenshot, a failing input, an entry id or
  a code line. Agents are told that a short list of proven findings beats a long list of guesses.
- **Two-step truth.** Sub-agents discover; the lead (or a separate verifier agent) reproduces every S1/S2 finding before
  it reaches the report. Unverified findings are labelled as such or dropped.
- **Learner-first.** The yardstick is a non-native learner using a phone, with a native-speaker check of content.
- **Nothing changes during the review.** Agents work only in the scratchpad, never edit the repo, and never publish
  anything. The live data and the user's progress are never touched.
- **Survive usage limits.** Every agent writes findings to its output file as it goes (one JSON line per finding), so a
  rate-limit stop loses nothing and the agent can be resumed. The highest-value streams run first.

## 2. Roles

| Role | Model / effort | Does |
|---|---|---|
| Lead | Opus, high | Builds the baseline, writes every agent spec, verifies findings, dedupes, ranks, writes the report, interviews the owner |
| Explorers | Sonnet | Judgement work: persona walkthroughs, code review, content sampling, product/competitor gaps, trust and publishing checks |
| Sweepers | Haiku | Mechanical work: screenshot matrices, accessibility and contrast scans, string/translation consistency, route crawling, timing measurements |
| Verifier | Sonnet (separate agent) | Re-runs the steps of S1/S2 findings it did not discover itself; marks each CONFIRMED / NOT REPRODUCED |

## 3. Phase 0 — preparation (lead)

1. Fresh build: wasm + `vite build` + `vite preview`; record the version, commit and entry count.
2. **Feature inventory**: every route (`#/`, `#/dict`, `#/list`, `#/entry/:id`, `#/study`, `#/games/*`, `#/me`,
   `#/map`), every control on each screen, every stored setting, every user-data field (cards, favourites, tags,
   history, settings, viewed).
3. **Risk map**: rank areas by (how often used × how bad a failure is). Starting view, to be confirmed:
   - high: search, entry page content, back navigation (`nav.ts`), progress storage and import/export, service-worker
     updates, study scheduling;
   - medium: list filters and fast scroll, games, home carousel, my tags, mind map gestures;
   - lower: about/licences, install prompt, reminders.
4. **Baseline screenshots** of every route in light and dark mode, English on and off, at 390×844 (phone).
5. Shared harness for agents: a Playwright helper (launch, phone viewport, touch, console-error capture, screenshot
   naming) so agents don't each reinvent it.
6. Write each stream's spec (section 4) with: the question, the method, inputs, the finding schema (section 6),
   examples of a good finding and of a non-finding, and a stop rule.

## 4. Workstreams

Each stream lists its agents, what they do, and what counts as a finding.

### A. Persona journeys — Sonnet ×4 (highest priority)
Each agent role-plays one user, drives the real app with Playwright, and logs every point of confusion, dead end,
wrong result or missing feature, with screenshots.
- **Beginner learner** (reads little Chinese, searches in English or toneless pinyin): find "add legs to a snake",
  understand the entry, save it, study 10 new cards, play two games.
- **Exam student**: build a 高考常考 deck, study it over two simulated days, use the quiz and timed challenge, review
  past results, make a "考试必背" tag deck.
- **Fluent native speaker**: browse 30 entries across types, judge naturalness of examples, check labels, try
  traditional-character search, try to find errors.
- **Teacher preparing a lesson**: pick a theme (e.g. 勤奋), gather 15 expressions via labels and the mind map, compare
  synonyms/antonyms, export or share them somehow (expect gaps here).
Finding = a task the persona could not finish, finished wrongly, or only with unreasonable effort.

### B. Break-it testing — Sonnet ×2 (scripts) + Haiku ×1 (capture)
- **Search**: typos, toneless and numbered pinyin, ü/v, traditional characters, variant forms, English words with several
  senses, mixed scripts, punctuation, empty and 200-character queries, emoji.
- **Navigation matrix**: every route × (back, double back, reload, deep link opened cold, tab switch mid-flow, rotate,
  keyboard open/closed); check the back-stack rules (blank Search, one extra stay after a search, exit).
- **State and data**: clear storage; corrupted, empty, old-version and huge backups; two tabs editing at once; storage
  full; tags-only and favourites-only progress (the reload bug class found on 11 Nov).
- **Games and study**: empty deck, one-card deck, tag deck, deck with only sayings, answers spammed, app backgrounded
  during the timed challenge, crossword typing mode with wrong lengths and traditional characters.
- **Layout**: 320 px wide, tablet, landscape, browser font at 200 %, dark mode, English off, very long entries
  (long 名句 and 歇后语).
Finding = crash, console error, wrong state, lost data, or layout that breaks reading or tapping.

### C. Code review — Sonnet ×3, verified by the lead
Modules in risk order: `nav.ts`; `api.ts` persistence and import; `updates.ts`; `core/src/app.rs` and `user.rs`
(import/export, tags, history); `srs.rs`; `games.rs` and `quiz.rs`; `dictionary.rs` search scoring and filters;
`list.ts` windowing and `fastscroll.ts`; `mindmap.ts` gestures; `home.ts` carousel.
Each reviewer traces real callers and inputs and proposes a concrete failure scenario. Findings without a plausible
path from real use are dropped. Tests are not changed.

### D. Content — Sonnet ×3 sampling, lead spot-check
- **Stratified random sample of ~400 entries**: by kind (成语, 俗语, 歇后语, 惯用语, 四字词语, 名句), by star tier, and
  by batch (early lists, audit-era, the November phrases), plus the most visible entries (daily picks, 高考 list).
- Per entry, one question at a time: meaning correct? example natural modern Chinese? labels fit (side rule)? star
  rating plausible? origin genuinely attested (quote and source)? pinyin and polyphones right? synonyms and antonyms
  real?
- **Targeted probes**: invented or wrongly attributed origins, politically or culturally sensitive entries and how they
  are presented, offensive or dated wording (gender, ethnicity, disability), English that misleads.
- Output: per-check error rates with a rough confidence range, plus the concrete wrong entries. The lead re-checks 10 %
  of the agents' "fine" verdicts to estimate what they miss.

### E. Accessibility and UX heuristics — Haiku ×1 scan + Sonnet ×1 judgement
- Haiku: run axe-core on every route; compute text contrast in both themes; list buttons without labels; measure tap
  targets (< 44 px); check focus order and that every action works by keyboard.
- Sonnet: a heuristic walkthrough (visibility of state, consistency of terms between zh/en, error recovery, recognition
  over recall, help for first-time users), using the baseline screenshots.

### F. Performance and reliability — Haiku ×1
Cold start time and download size (wasm, data), time to first search result, list scrolling, mind map with all
bubbles, memory after long use, offline behaviour after first load, the update-and-reload flow. Lighthouse on the
built site. Numbers are recorded against a simulated slow phone (CPU ×4 slowdown, slow 4G).

### G. Platforms — Sonnet ×1
PWA installability (manifest, icons, offline), Android build (manifest, permissions, size, signing and update path,
launcher name), behaviours that differ in the Tauri shell (notifications, storage). States plainly what cannot be
tested here (real devices, iOS Safari) so the report doesn't overclaim.

### H. Product gaps and competitors — Sonnet ×1 (web research)
Feature matrix against Pleco, Hanping, 汉典 / 成语词典 apps and printed idiom dictionaries: lookup, audio, stroke order,
handwriting input, sync, sharing, export, example sources, exam features. Each gap is tagged with who it matters to and
whether it fits the owner's stated choices (e.g. no audio by decision).

### I. Trust and publishing readiness — Sonnet ×1
Privacy text vs actual behaviour (any network requests? what is stored?), licences and credits complete, honest
disclosure of AI-assisted content, store-policy risks, the report-a-mistake gap, backup and data-loss messaging.

## 5. Order and gating

1. Phase 0 (lead) → 2. **Wave 1**: A, B, C, D (the streams most likely to find serious problems) → 3. **Wave 2**:
E, F, G, H, I → 4. Verification of all S1/S2 findings → 5. Dedupe and rank → 6. Report and owner interview.
If a usage limit hits, finish verifying what is in hand and report it before starting the next wave.

## 6. Finding format (one JSON line each)

`{id, stream, area, title, severity, evidence: {steps, screenshot, input, entry_ids, code_ref}, impact,
suspected_cause, suggested_fix, confidence: high|medium|low, verified: confirmed|not_reproduced|unverified}`

Severity:
- **S1**: data loss, wrong or harmful content in a visible place, crash, a core flow impossible.
- **S2**: a core flow broken or misleading for some users, content errors in a pattern (not one-offs).
- **S3**: friction, inconsistency, confusing wording, accessibility problems that hinder but don't block.
- **S4**: polish.

## 7. Deliverables

- `docs/review-YYYY-MM.md`: an executive summary (top 10), findings by severity with evidence, content error-rate
  table, what was not tested, and a proposed fix order.
- A screenshot gallery of the evidence.
- A short list of decisions for the owner (asked in an interview, not assumed).

## 8. Budget guide

About 20 agent runs (A 4, B 3, C 3, D 3, E 2, F 1, G 1, H 1, I 1, verifier 1–2), plus the lead's verification,
which is the expensive part and the part not to cut. Expect two usage windows. If budget is tight, run A, B and D
first: they cover what users and content reviewers would notice most.
