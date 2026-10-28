//! The app's API. Both the Tauri shell and the browser dev server call
//! [`App::dispatch`] with a command name and JSON arguments.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::dictionary::{Dictionary, Filters, MatchKind};
use crate::games::{self, MatchMode};
use crate::model::{Bilingual, Entry, Kind, Modern, Register, Sentiment};
use crate::quiz::{self, Lang, QuestionKind};
use crate::rng::hash64;
use crate::srs::{Card, Grade};
use crate::user::{Settings, Status, UserData};

/// Size of the "Core 500" deck.
pub const CORE_DECK_SIZE: usize = 500;

pub struct App {
    pub dict: Dictionary,
    pub user: UserData,
    save_path: Option<PathBuf>,
    /// Set whenever a command changes user data (the web build uses it to know when to persist).
    pub changed: bool,
}

/// Compact form used in result lists.
#[derive(Debug, Serialize)]
pub struct Summary<'a> {
    pub id: &'a str,
    pub text: &'a str,
    pub pinyin: &'a str,
    pub kind: Kind,
    pub frequency: u8,
    pub sentiment: Sentiment,
    pub register: Register,
    pub themes: &'a [String],
    pub meaning: &'a Bilingual,
    pub length: usize,
    pub structure: Option<String>,
    pub status: Status,
    pub favourite: bool,
    /// Opened recently (in the viewed history).
    pub seen: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modern: Option<Modern>,
}

#[derive(Debug, Serialize)]
struct Link {
    text: String,
    id: Option<String>,
}

/// Which cards to study.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Deck {
    #[default]
    All,
    /// The most common ~500 expressions.
    Core,
    Favourites,
    Filtered { filters: Filters },
}

fn arg<T: for<'de> Deserialize<'de>>(args: &Value, key: &str) -> Result<T, String> {
    serde_json::from_value(args.get(key).cloned().unwrap_or(Value::Null))
        .map_err(|e| format!("bad argument `{key}`: {e}"))
}

fn opt<T: for<'de> Deserialize<'de> + Default>(args: &Value, key: &str) -> Result<T, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(T::default()),
        Some(_) => arg(args, key),
    }
}

impl App {
    /// App with the embedded dictionary. Progress is loaded from / saved to
    /// `save_path` if given.
    pub fn new(save_path: Option<PathBuf>) -> Self {
        let user = save_path
            .as_deref()
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        App { dict: Dictionary::embedded(), user, save_path, changed: false }
    }

    pub fn save(&self) -> Result<(), String> {
        let Some(path) = &self.save_path else { return Ok(()) };
        write_atomic(path, &serde_json::to_string(&self.user).map_err(|e| e.to_string())?)
    }

    pub fn summary<'a>(&'a self, e: &'a Entry) -> Summary<'a> {
        Summary {
            id: &e.id,
            text: &e.text,
            pinyin: &e.pinyin,
            kind: e.kind,
            frequency: e.frequency,
            sentiment: e.sentiment,
            register: e.register,
            themes: &e.themes,
            meaning: &e.meaning,
            length: e.length(),
            structure: e.structure(),
            status: self.user.status(&e.id),
            favourite: self.user.favourites.contains(&e.id),
            seen: self.user.viewed.contains(&e.id),
            modern: e.modern,
        }
    }

    /// Resolve synonyms / antonyms. A variant form links to (and is shown as) its
    /// main entry; links back to `from` itself and repeats are dropped.
    fn links(&self, from: &Entry, texts: &[String]) -> Vec<Link> {
        let mut seen = std::collections::HashSet::new();
        texts
            .iter()
            .filter_map(|t| {
                let target = self.dict.by_text(t);
                if target.is_some_and(|e| e.id == from.id) {
                    return None;
                }
                let link = match target {
                    Some(e) => Link { text: e.text.clone(), id: Some(e.id.clone()) },
                    None => Link { text: t.clone(), id: None },
                };
                seen.insert(link.text.clone()).then_some(link)
            })
            .collect()
    }

    /// Ids in a deck, in study order (most common first).
    pub fn deck_ids(&self, deck: &Deck) -> Vec<String> {
        let filters = match deck {
            Deck::Filtered { filters } => filters.clone(),
            Deck::Favourites => Filters { favourites_only: true, ..Default::default() },
            _ => Filters::default(),
        };
        let hits = self.dict.search("", &filters, &self.user);
        let mut ids: Vec<String> = hits.iter().map(|h| self.dict.entries()[h.index].id.clone()).collect();
        if matches!(deck, Deck::Core) {
            ids.truncate(CORE_DECK_SIZE);
        }
        ids
    }

    /// Ids for quizzes and games: the deck without plain phrases (collocations, not idioms),
    /// unless the user explicitly filtered for phrases.
    pub fn practice_ids(&self, deck: &Deck) -> Vec<String> {
        let wants_phrases = matches!(deck, Deck::Filtered { filters } if filters.kinds.contains(&Kind::Phrase));
        self.deck_ids(deck)
            .into_iter()
            .filter(|id| wants_phrases || self.dict.get(id).is_some_and(|e| e.kind != Kind::Phrase))
            .collect()
    }

    /// Due cards first (most overdue first), then new cards up to today's allowance.
    pub fn study_queue(&self, deck: &Deck, today: i64, limit: usize) -> Vec<String> {
        let ids = self.deck_ids(deck);
        let mut due: Vec<(&Card, &String)> = ids
            .iter()
            .filter_map(|id| self.user.cards.get(id).filter(|c| c.is_due(today)).map(|c| (c, id)))
            .collect();
        due.sort_by_key(|(c, _)| c.due);
        let allowance = self.user.settings.new_per_day.saturating_sub(self.user.new_today(today)) as usize;
        let new = ids.iter().filter(|id| !self.user.cards.contains_key(*id)).take(allowance);
        due.into_iter().map(|(_, id)| id).chain(new).take(limit).cloned().collect()
    }

    /// Chengyu of the day: a stable pick from the common chengyu (never a saying or a famous line).
    pub fn daily(&self, today: i64) -> Option<&Entry> {
        let pool: Vec<&Entry> =
            self.dict.entries().iter().filter(|e| e.kind == Kind::Chengyu && e.frequency <= 2).collect();
        let pool = if pool.is_empty() { self.dict.entries().iter().collect() } else { pool };
        if pool.is_empty() {
            return None;
        }
        Some(pool[(hash64(today as u64) % pool.len() as u64) as usize])
    }

    fn entry_or_err(&self, id: &str) -> Result<&Entry, String> {
        self.dict.get(id).ok_or_else(|| format!("unknown entry `{id}`"))
    }

    /// Run one API command.
    pub fn dispatch(&mut self, cmd: &str, args: &Value) -> Result<Value, String> {
        let today = || -> Result<i64, String> { arg(args, "today") };
        let mut dirty = false;
        let result = match cmd {
            "meta" => {
                let mut structures: Vec<String> =
                    self.dict.entries().iter().filter_map(Entry::structure).collect();
                structures.sort();
                structures.dedup();
                let count = |k: Kind| self.dict.entries().iter().filter(|e| e.kind == k).count();
                // Entries per theme (a broad theme counts everything under it).
                let theme_counts: serde_json::Map<String, Value> = self
                    .dict
                    .themes
                    .iter()
                    .map(|t| {
                        let n = self.dict.entries().iter().filter(|e| self.dict.has_theme(e, &t.id)).count();
                        (t.id.clone(), json!(n))
                    })
                    .collect();
                json!({
                    "total": self.dict.len(),
                    "themes": self.dict.themes,
                    "theme_counts": theme_counts,
                    "structures": structures,
                    "kinds": {
                        "chengyu": count(Kind::Chengyu),
                        "suyu": count(Kind::Suyu),
                        "xiehouyu": count(Kind::Xiehouyu),
                        "guanyongyu": count(Kind::Guanyongyu),
                        "phrase": count(Kind::Phrase),
                        "mingju": count(Kind::Mingju),
                    },
                })
            }
            "search" => {
                let query: String = opt(args, "query")?;
                let filters: Filters = opt(args, "filters")?;
                let offset: usize = opt(args, "offset")?;
                let limit: usize = match opt::<usize>(args, "limit")? { 0 => 50, n => n };
                let hits = self.dict.search(&query, &filters, &self.user);
                let items: Vec<Value> = hits
                    .iter()
                    .skip(offset)
                    .take(limit)
                    .map(|h| {
                        let mut v = json!(self.summary(&self.dict.entries()[h.index]));
                        if h.matched != MatchKind::All {
                            v["matched"] = json!(h.matched);
                        }
                        v
                    })
                    .collect();
                json!({ "total": hits.len(), "items": items })
            }
            "entry" => {
                let id: String = arg(args, "id")?;
                let e = self.entry_or_err(&id)?;
                json!({
                    "entry": e,
                    "summary": self.summary(e),
                    "card": self.user.cards.get(&id),
                    "accuracy": self.user.accuracy.get(&id),
                    "synonyms": self.links(e, &e.synonyms),
                    "antonyms": self.links(e, &e.antonyms),
                    "chars": e.chars().iter().map(|c| c.to_string()).collect::<Vec<_>>(),
                })
            }
            "summaries" => {
                let ids: Vec<String> = arg(args, "ids")?;
                json!(ids.iter().filter_map(|id| self.dict.get(id)).map(|e| self.summary(e)).collect::<Vec<_>>())
            }
            "toggle_favourite" => {
                let id: String = arg(args, "id")?;
                self.entry_or_err(&id)?;
                dirty = true;
                json!(self.user.toggle_favourite(&id))
            }
            "daily" => json!(self.daily(today()?).map(|e| self.summary(e))),
            "study_queue" => {
                let deck: Deck = opt(args, "deck")?;
                let limit: usize = match opt::<usize>(args, "limit")? { 0 => 50, n => n };
                json!(self.study_queue(&deck, today()?, limit))
            }
            "deck_size" => {
                let deck: Deck = opt(args, "deck")?;
                json!(self.deck_ids(&deck).len())
            }
            "review" => {
                let id: String = arg(args, "id")?;
                let grade: Grade = arg(args, "grade")?;
                self.entry_or_err(&id)?;
                dirty = true;
                json!(self.user.review(&id, grade, today()?))
            }
            "quiz" => {
                let deck: Deck = opt(args, "deck")?;
                let kinds: Vec<QuestionKind> = opt(args, "kinds")?;
                let count: usize = match opt::<usize>(args, "count")? { 0 => 10, n => n };
                let lang: Lang = opt(args, "lang")?;
                let seed: u64 = opt(args, "seed")?;
                let pool = self.practice_ids(&deck);
                json!(quiz::generate(&self.dict, &pool, &kinds, count, lang, seed))
            }
            "quiz_answer" => {
                let id: String = arg(args, "id")?;
                let correct: bool = arg(args, "correct")?;
                dirty = true;
                self.user.quiz_answer(&id, correct, today()?);
                Value::Null
            }
            "game_played" => {
                dirty = true;
                self.user.game_played(today()?);
                Value::Null
            }
            "chain_start" => {
                let homophones: bool = opt(args, "homophones")?;
                let seed: u64 = opt(args, "seed")?;
                json!(games::chain_start(&self.dict, homophones, seed))
            }
            "chain_check" => {
                let prev: String = arg(args, "prev")?;
                let text: String = arg(args, "text")?;
                let used: Vec<String> = opt(args, "used")?;
                let homophones: bool = opt(args, "homophones")?;
                json!(games::chain_check(&self.dict, &prev, &text, &used, homophones))
            }
            "chain_ai" => {
                let prev: String = arg(args, "prev")?;
                let used: Vec<String> = opt(args, "used")?;
                let homophones: bool = opt(args, "homophones")?;
                let seed: u64 = opt(args, "seed")?;
                json!(games::chain_ai(&self.dict, &prev, &used, homophones, seed))
            }
            "chain_hint" => {
                let prev: String = arg(args, "prev")?;
                let used: Vec<String> = opt(args, "used")?;
                let homophones: bool = opt(args, "homophones")?;
                let e = self.entry_or_err(&prev)?;
                json!(games::chain_candidates(&self.dict, e, &used, homophones).len())
            }
            "scramble" => {
                let deck: Deck = opt(args, "deck")?;
                let decoys: usize = opt(args, "decoys")?;
                let seed: u64 = opt(args, "seed")?;
                let pool: Vec<String> = self
                    .practice_ids(&deck)
                    .into_iter()
                    .filter(|id| self.dict.get(id).is_some_and(|e| (3..=8).contains(&e.length())))
                    .collect();
                let id = pool.get((hash64(seed) % pool.len().max(1) as u64) as usize);
                json!(id.and_then(|id| games::scramble(&self.dict, id, decoys, seed)))
            }
            "match_cards" => {
                let deck: Deck = opt(args, "deck")?;
                let pairs: usize = match opt::<usize>(args, "pairs")? { 0 => 6, n => n };
                let mode: MatchMode = arg(args, "mode")?;
                let english: bool = opt(args, "english")?;
                let seed: u64 = opt(args, "seed")?;
                let pool = self.practice_ids(&deck);
                json!(games::match_cards(&self.dict, &pool, pairs, mode, english, seed))
            }
            "crossword" => {
                let deck: Deck = opt(args, "deck")?;
                let words: usize = match opt::<usize>(args, "words")? { 0 => 6, n => n };
                let seed: u64 = opt(args, "seed")?;
                let pool = self.practice_ids(&deck);
                json!(games::crossword(&self.dict, &pool, words, seed))
            }
            "link_text" => {
                let text: String = arg(args, "text")?;
                let exclude: Vec<String> = opt(args, "exclude")?;
                let parts: Vec<Value> = self
                    .dict
                    .link_text(&text, &exclude)
                    .into_iter()
                    .map(|(t, e)| match e {
                        Some(e) => json!({ "text": t, "id": e.id, "summary": self.summary(e) }),
                        None => json!({ "text": t }),
                    })
                    .collect();
                json!(parts)
            }
            "view" => {
                let id: String = arg(args, "id")?;
                self.entry_or_err(&id)?;
                dirty = true;
                self.user.view(&id);
                Value::Null
            }
            "history" => {
                let limit: usize = match opt::<usize>(args, "limit")? { 0 => 50, n => n };
                let summaries = |ids: Vec<&str>| -> Vec<Value> {
                    ids.into_iter().filter_map(|id| self.dict.get(id)).take(limit).map(|e| json!(self.summary(e))).collect()
                };
                json!({
                    "viewed": summaries(self.user.viewed.iter().map(String::as_str).collect()),
                    "studied": summaries(self.user.studied()),
                    "studied_total": self.user.cards.len(),
                })
            }
            "stats" => {
                let ids: Vec<&str> = self.dict.entries().iter().map(|e| e.id.as_str()).collect();
                json!(self.user.stats(&ids, today()?))
            }
            "settings" => json!(self.user.settings),
            "set_settings" => {
                let settings: Settings = arg(args, "settings")?;
                self.user.settings = settings;
                dirty = true;
                json!(self.user.settings)
            }
            "export" => json!(self.user),
            "import" => {
                let mut data: UserData = arg(args, "data")?;
                if data.cards.is_empty() && data.favourites.is_empty() && data.history.is_empty() {
                    return Err("this backup has no progress in it (no cards, favourites or history)".into());
                }
                // Drop anything that refers to entries this version doesn't have.
                let known = |id: &String| self.dict.get(id).is_some();
                let before = data.cards.len() + data.favourites.len();
                data.cards.retain(|id, _| known(id));
                data.favourites.retain(known);
                data.accuracy.retain(|id, _| known(id));
                data.viewed.retain(known);
                let dropped = before - data.cards.len() - data.favourites.len();
                let summary = json!({
                    "cards": data.cards.len(),
                    "favourites": data.favourites.len(),
                    "days": data.history.len(),
                    "dropped": dropped,
                });
                self.user = data;
                dirty = true;
                summary
            }
            "preview_import" => {
                let data: UserData = arg(args, "data")?;
                json!({
                    "cards": data.cards.len(),
                    "favourites": data.favourites.len(),
                    "days": data.history.len(),
                    "empty": data.cards.is_empty() && data.favourites.is_empty() && data.history.is_empty(),
                })
            }
            _ => return Err(format!("unknown command `{cmd}`")),
        };
        if dirty {
            self.changed = true;
            self.save()?;
        }
        Ok(result)
    }
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(app: &mut App, cmd: &str, args: Value) -> Value {
        app.dispatch(cmd, &args).unwrap_or_else(|e| panic!("{cmd}: {e}"))
    }

    #[test]
    fn search_and_entry() {
        let mut app = App::new(None);
        let r = call(&mut app, "search", json!({"query": "hua she"}));
        assert_eq!(r["items"][0]["text"], "画蛇添足");
        let id = r["items"][0]["id"].as_str().unwrap().to_string();
        let e = call(&mut app, "entry", json!({"id": id}));
        assert_eq!(e["entry"]["text"], "画蛇添足");
        assert_eq!(e["summary"]["structure"], "ABCD");
        let syns = e["synonyms"].as_array().unwrap();
        assert!(syns.len() >= 2);
        // Links resolve to an id only when the expression is in the dictionary.
        for l in syns {
            let t = l["text"].as_str().unwrap();
            assert_eq!(l["id"].is_null(), app.dict.by_text(t).is_none());
        }
    }

    #[test]
    fn variant_links_open_the_main_entry() {
        let mut entries = Dictionary::embedded().entries().to_vec();
        let i = entries.iter().position(|e| e.text == "画蛇添足").unwrap();
        // A synonym written in a variant form, plus the entry's own variant.
        entries[i].synonyms = vec!["莫明其妙".into(), "莫名其妙".into(), "未知词语".into()];
        let mut app = App::new(None);
        app.dict = Dictionary::new(entries, Dictionary::embedded().themes.clone());
        let id = app.dict.by_text("画蛇添足").unwrap().id.clone();
        let e = call(&mut app, "entry", json!({"id": id}));
        let syns = e["synonyms"].as_array().unwrap();
        assert_eq!(syns.len(), 2, "{syns:?}");
        assert_eq!(syns[0]["text"], "莫名其妙");
        assert!(syns[0]["id"].is_string());
        assert!(syns[1]["id"].is_null());
    }

    #[test]
    fn filters_via_api() {
        let mut app = App::new(None);
        let r = call(&mut app, "search", json!({"filters": {"kinds": ["xiehouyu"]}}));
        assert!(r["total"].as_u64().unwrap() >= 1);
        for item in r["items"].as_array().unwrap() {
            assert_eq!(item["kind"], "xiehouyu");
        }
    }

    #[test]
    fn study_flow_updates_progress() {
        let mut app = App::new(None);
        app.user.settings.new_per_day = 3;
        let q: Vec<String> = serde_json::from_value(call(&mut app, "study_queue", json!({"today": 100}))).unwrap();
        assert_eq!(q.len(), 3);
        call(&mut app, "review", json!({"id": q[0], "grade": "good", "today": 100}));
        call(&mut app, "review", json!({"id": q[1], "grade": "again", "today": 100}));
        // Allowance used up apart from one new card; the failed card is due again.
        let q2: Vec<String> = serde_json::from_value(call(&mut app, "study_queue", json!({"today": 100}))).unwrap();
        assert_eq!(q2[0], q[1]);
        assert_eq!(q2.len(), 2);
        let s = call(&mut app, "stats", json!({"today": 100}));
        assert_eq!(s["learning"], 2);
        assert_eq!(s["streak"], 1);
    }

    #[test]
    fn meta_counts_themes_including_groups() {
        let mut app = App::new(None);
        let m = call(&mut app, "meta", json!({}));
        let animals = m["theme_counts"]["animals"].as_u64().unwrap();
        let direct = app.dict.entries().iter().filter(|e| e.themes.iter().any(|t| t == "animals")).count() as u64;
        assert!(animals >= direct && animals > 0);
    }

    #[test]
    fn core_deck_is_capped() {
        let app = App::new(None);
        assert!(app.deck_ids(&Deck::Core).len() <= CORE_DECK_SIZE);
    }

    #[test]
    fn daily_is_stable() {
        let mut app = App::new(None);
        let a = call(&mut app, "daily", json!({"today": 20000}));
        let b = call(&mut app, "daily", json!({"today": 20000}));
        assert_eq!(a, b);
        assert!(a["id"].is_string());
    }

    #[test]
    fn games_via_api() {
        let mut app = App::new(None);
        assert!(app.practice_ids(&Deck::All).iter().all(|id| app.dict.get(id).unwrap().kind != Kind::Phrase));
        let q = call(&mut app, "quiz", json!({"count": 5, "seed": 1}));
        assert_eq!(q.as_array().unwrap().len(), 5);
        let s = call(&mut app, "scramble", json!({"seed": 2, "decoys": 2}));
        assert!(s["tiles"].as_array().unwrap().len() >= 5);
        let m = call(&mut app, "match_cards", json!({"mode": "meaning", "pairs": 4, "seed": 3, "english": true}));
        assert_eq!(m.as_array().unwrap().len(), 8);
        let start = call(&mut app, "chain_start", json!({"seed": 4, "homophones": true}));
        assert!(start.is_string());
    }

    #[test]
    fn progress_persists() {
        let dir = std::env::temp_dir().join(format!("chengyu-test-{}", std::process::id()));
        let path = dir.join("user.json");
        let _ = fs::remove_file(&path);
        {
            let mut app = App::new(Some(path.clone()));
            let id = app.dict.entries()[0].id.clone();
            call(&mut app, "toggle_favourite", json!({"id": id}));
        }
        let app = App::new(Some(path.clone()));
        assert_eq!(app.user.favourites.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn changed_flag_tracks_user_data_edits() {
        let mut app = App::new(None);
        call(&mut app, "search", json!({"query": "hua"}));
        assert!(!app.changed);
        let id = app.dict.entries()[0].id.clone();
        call(&mut app, "toggle_favourite", json!({"id": id}));
        assert!(app.changed);
    }

    #[test]
    fn import_rejects_empty_backups_and_unknown_ids() {
        let mut app = App::new(None);
        let id = app.dict.entries()[0].id.clone();
        call(&mut app, "toggle_favourite", json!({"id": id}));
        assert!(app.dispatch("import", &json!({"data": {}})).is_err());
        assert!(app.dispatch("import", &json!({"data": []})).is_err());
        assert_eq!(app.user.favourites.len(), 1, "failed import must not touch progress");
        let r = call(&mut app, "import", json!({"data": {"favourites": [id, "zzz-nonexistent"]}}));
        assert_eq!(r["favourites"], 1);
        assert_eq!(r["dropped"], 1);
    }

    #[test]
    fn history_and_links() {
        let mut app = App::new(None);
        let a = app.dict.by_text("画蛇添足").unwrap().id.clone();
        let b = app.dict.by_text("马到成功").unwrap().id.clone();
        call(&mut app, "view", json!({"id": a}));
        call(&mut app, "view", json!({"id": b}));
        call(&mut app, "view", json!({"id": a}));
        let h = call(&mut app, "history", json!({}));
        let viewed: Vec<&str> = h["viewed"].as_array().unwrap().iter().map(|s| s["id"].as_str().unwrap()).collect();
        assert_eq!(viewed, [a.as_str(), b.as_str()]);
        assert_eq!(h["studied_total"], 0);

        let parts = call(&mut app, "link_text", json!({"text": "他这样做真是画蛇添足。", "exclude": [b]}));
        let parts = parts.as_array().unwrap();
        assert_eq!(parts.len(), 3, "{parts:?}");
        assert_eq!(parts[1]["id"], json!(a));
        let excluded = call(&mut app, "link_text", json!({"text": "画蛇添足", "exclude": [a]}));
        assert!(excluded[0]["id"].is_null());
    }

    #[test]
    fn errors_are_reported() {
        let mut app = App::new(None);
        assert!(app.dispatch("nope", &json!({})).is_err());
        assert!(app.dispatch("entry", &json!({"id": "missing"})).is_err());
        assert!(app.dispatch("review", &json!({"id": "x"})).is_err());
    }
}
