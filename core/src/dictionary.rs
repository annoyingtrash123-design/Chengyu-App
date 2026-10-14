//! The dictionary: loading, lookup, search and filtering.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::model::{is_han, Entry, Kind, Register, Sentiment};
use crate::pinyin;
use crate::user::{Status, UserData};

static EMBEDDED_ENTRIES: &str = include_str!(concat!(env!("OUT_DIR"), "/entries.json"));
static EMBEDDED_THEMES: &str = include_str!("../../data/themes.json");

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub en: String,
    pub zh: String,
    /// Broad theme this detailed theme belongs to. `None` for the broad themes themselves.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

/// Pre-computed search keys for one entry.
#[derive(Debug, Clone)]
struct Keys {
    chars: Vec<char>,
    pinyin_toned: String,
    pinyin_plain: String,
    initials: String,
    english_words: Vec<String>,
    english_text: String,
}

pub struct Dictionary {
    entries: Vec<Entry>,
    keys: Vec<Keys>,
    by_id: HashMap<String, usize>,
    by_text: HashMap<String, usize>,
    pub themes: Vec<Theme>,
    /// Detailed theme id → its broad theme id.
    theme_group: HashMap<String, String>,
}

/// Overlapping filters. An empty list means "no restriction".
/// Within one list values are OR-ed; different lists are AND-ed.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Filters {
    pub kinds: Vec<Kind>,
    pub themes: Vec<String>,
    /// Require every selected theme instead of any.
    pub themes_all: bool,
    /// Character counts. `8` means "8 or more".
    pub lengths: Vec<usize>,
    pub structures: Vec<String>,
    pub frequencies: Vec<u8>,
    pub sentiments: Vec<Sentiment>,
    pub registers: Vec<Register>,
    pub statuses: Vec<Status>,
    pub favourites_only: bool,
    pub has_origin: bool,
    /// Only modern coinages and borrowings.
    pub modern_only: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchKind {
    All,
    Text,
    Pinyin,
    English,
    ChineseMeaning,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Hit {
    pub index: usize,
    pub score: u32,
    pub matched: MatchKind,
}

const STOPWORDS: &[&str] = &["a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "with", "is", "be", "by"];

fn english_words(s: &str) -> Vec<String> {
    s.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty() && !STOPWORDS.contains(w))
        .map(str::to_string)
        .collect()
}

/// Levenshtein distance, capped for speed: returns `max + 1` once exceeded.
fn edit_distance(a: &str, b: &str, max: usize) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    if a.len().abs_diff(b.len()) > max {
        return max + 1;
    }
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut cur = vec![i; b.len() + 1];
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            cur[j] = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
        }
        if cur.iter().min().copied().unwrap_or(0) > max {
            return max + 1;
        }
        prev = cur;
    }
    prev[b.len()]
}

fn word_matches(query: &str, word: &str) -> bool {
    word == query
        || (query.len() >= 3 && word.starts_with(query))
        || (query.len() >= 5 && edit_distance(query, word, 1) <= 1)
}

impl Dictionary {
    /// The dictionary built into the app.
    pub fn embedded() -> Self {
        let entries: Vec<Entry> =
            serde_json::from_str(EMBEDDED_ENTRIES).expect("embedded entries are invalid");
        let themes: Vec<Theme> =
            serde_json::from_str(EMBEDDED_THEMES).expect("embedded themes are invalid");
        Self::new(entries, themes)
    }

    pub fn new(entries: Vec<Entry>, themes: Vec<Theme>) -> Self {
        let keys = entries
            .iter()
            .map(|e| {
                let english_text = format!(
                    "{} {} {} {}",
                    e.literal.replace('·', " "),
                    e.natural,
                    e.meaning.en,
                    e.equivalents.join(" ")
                )
                .to_lowercase();
                Keys {
                    chars: e.chars(),
                    pinyin_toned: pinyin::compact(&e.pinyin),
                    pinyin_plain: pinyin::strip_tones(&pinyin::compact(&e.pinyin)),
                    initials: pinyin::initials(&e.pinyin),
                    english_words: english_words(&english_text),
                    english_text,
                }
            })
            .collect();
        let by_id = entries.iter().enumerate().map(|(i, e)| (e.id.clone(), i)).collect();
        let by_text = entries.iter().enumerate().map(|(i, e)| (e.text.clone(), i)).collect();
        let theme_group = themes
            .iter()
            .filter_map(|t| t.group.clone().map(|g| (t.id.clone(), g)))
            .collect();
        Dictionary { entries, keys, by_id, by_text, themes, theme_group }
    }

    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn get(&self, id: &str) -> Option<&Entry> {
        self.by_id.get(id).map(|&i| &self.entries[i])
    }

    pub fn by_text(&self, text: &str) -> Option<&Entry> {
        self.by_text.get(text).map(|&i| &self.entries[i])
    }

    /// Is the entry tagged with `theme`, either directly or through one of
    /// that broad theme's detailed themes?
    pub fn has_theme(&self, e: &Entry, theme: &str) -> bool {
        e.themes.iter().any(|t| t == theme || self.theme_group.get(t).is_some_and(|g| g == theme))
    }

    /// Does the entry pass every filter?
    pub fn matches(&self, e: &Entry, f: &Filters, user: &UserData) -> bool {
        let any_or_empty = |list_empty: bool, hit: bool| list_empty || hit;
        let len = e.length();
        any_or_empty(f.kinds.is_empty(), f.kinds.contains(&e.kind))
            && (f.themes.is_empty()
                || if f.themes_all {
                    f.themes.iter().all(|t| self.has_theme(e, t))
                } else {
                    f.themes.iter().any(|t| self.has_theme(e, t))
                })
            && any_or_empty(
                f.lengths.is_empty(),
                f.lengths.iter().any(|&l| l == len || (l >= 8 && len >= 8)),
            )
            && any_or_empty(
                f.structures.is_empty(),
                e.structure().is_some_and(|s| f.structures.contains(&s)),
            )
            && any_or_empty(f.frequencies.is_empty(), f.frequencies.contains(&e.frequency))
            && any_or_empty(f.sentiments.is_empty(), f.sentiments.contains(&e.sentiment))
            && any_or_empty(f.registers.is_empty(), f.registers.contains(&e.register))
            && any_or_empty(f.statuses.is_empty(), f.statuses.contains(&user.status(&e.id)))
            && (!f.favourites_only || user.favourites.contains(&e.id))
            && (!f.has_origin || e.origin.is_some())
            && (!f.modern_only || e.modern.is_some())
    }

    /// Score one entry against a query. `None` means no match.
    fn score(&self, i: usize, query: &str) -> Option<(u32, MatchKind)> {
        let e = &self.entries[i];
        let k = &self.keys[i];
        let mut best: Option<(u32, MatchKind)> = None;
        let mut consider = |score: u32, kind: MatchKind| {
            if score > 0 && best.is_none_or(|(s, _)| score > s) {
                best = Some((score, kind));
            }
        };

        let han: Vec<char> = query.chars().filter(|c| is_han(*c)).collect();
        if !han.is_empty() {
            let q: String = han.iter().collect();
            let text: String = k.chars.iter().collect();
            if text == q {
                consider(100, MatchKind::Text);
            } else if text.starts_with(&q) {
                consider(90, MatchKind::Text);
            } else if text.contains(&q) {
                consider(80, MatchKind::Text);
            } else {
                // Fuzzy: characters in any position / order.
                let present = han.iter().filter(|c| k.chars.contains(c)).count();
                if present == han.len() {
                    consider(60, MatchKind::Text);
                } else if han.len() >= 2 && present * 2 >= han.len() {
                    consider((30 * present / han.len()) as u32, MatchKind::Text);
                }
            }
            if e.meaning.zh.contains(&q) {
                consider(35, MatchKind::ChineseMeaning);
            }
            return best;
        }

        // Pinyin (toned, toneless or numbered).
        let q = pinyin::compact(query);
        if !q.is_empty() {
            let toned = pinyin::has_tone_marks(&q);
            let (hay, needle) = if toned {
                (&k.pinyin_toned, q.clone())
            } else {
                (&k.pinyin_plain, pinyin::strip_tones(&q))
            };
            if *hay == needle {
                consider(95, MatchKind::Pinyin);
            } else if hay.starts_with(&needle) && needle.chars().count() >= 2 {
                consider(85, MatchKind::Pinyin);
            } else if hay.contains(&needle) && needle.chars().count() >= 3 {
                consider(70, MatchKind::Pinyin);
            } else if needle.chars().count() >= 6 && edit_distance(&needle, hay, 2) <= 2 {
                consider(40, MatchKind::Pinyin);
            }
            if !toned && needle.len() >= 3 && needle == k.initials {
                consider(65, MatchKind::Pinyin);
            }
        }

        // English.
        let words = english_words(query);
        if !words.is_empty() {
            let hits = words
                .iter()
                .filter(|w| k.english_words.iter().any(|ew| word_matches(w, ew)))
                .count();
            if hits == words.len() {
                let phrase = query.trim().to_lowercase();
                let bonus = if words.len() > 1 && k.english_text.contains(&phrase) { 10 } else { 0 };
                consider(50 + bonus, MatchKind::English);
            } else if words.len() >= 2 && hits * 2 >= words.len() {
                consider((25 * hits / words.len()) as u32, MatchKind::English);
            }
        }
        best
    }

    /// Search and filter. An empty query lists everything that passes the filters,
    /// most common first.
    pub fn search(&self, query: &str, filters: &Filters, user: &UserData) -> Vec<Hit> {
        let query = query.trim();
        let mut hits: Vec<Hit> = (0..self.entries.len())
            .filter(|&i| self.matches(&self.entries[i], filters, user))
            .filter_map(|i| {
                if query.is_empty() {
                    Some(Hit { index: i, score: 0, matched: MatchKind::All })
                } else {
                    self.score(i, query).map(|(score, matched)| Hit { index: i, score, matched })
                }
            })
            .collect();
        hits.sort_by(|a, b| {
            let (ea, eb) = (&self.entries[a.index], &self.entries[b.index]);
            b.score
                .cmp(&a.score)
                .then(ea.frequency.cmp(&eb.frequency))
                .then_with(|| self.keys[a.index].pinyin_plain.cmp(&self.keys[b.index].pinyin_plain))
        });
        hits
    }

    /// Plain toneless syllables of an entry, e.g. `["hua", "she", "tian", "zu"]`.
    pub fn plain_syllables(&self, e: &Entry) -> Vec<String> {
        pinyin::syllables(&e.pinyin).iter().map(|s| pinyin::strip_tones(s)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dict() -> Dictionary {
        Dictionary::embedded()
    }

    fn top(d: &Dictionary, q: &str) -> String {
        let hits = d.search(q, &Filters::default(), &UserData::default());
        d.entries()[hits.first().expect("no hits").index].text.clone()
    }

    #[test]
    fn embedded_data_loads() {
        let d = dict();
        assert!(d.len() >= 20);
        assert!(!d.themes.is_empty());
    }

    #[test]
    fn searches_by_characters() {
        let d = dict();
        assert_eq!(top(&d, "画蛇添足"), "画蛇添足");
        assert_eq!(top(&d, "蛇"), "画蛇添足");
        // Any order / position.
        assert_eq!(top(&d, "足蛇"), "画蛇添足");
    }

    #[test]
    fn searches_by_pinyin_in_every_form() {
        let d = dict();
        for q in ["huà shé tiān zú", "hua she tian zu", "huashetianzu", "hua4 she2 tian1 zu2", "hua she", "hstz"] {
            assert_eq!(top(&d, q), "画蛇添足", "query {q:?}");
        }
        // Small typo.
        assert_eq!(top(&d, "huashetainzu"), "画蛇添足");
    }

    #[test]
    fn toned_queries_respect_tones() {
        let d = dict();
        let hits = d.search("huā shé", &Filters::default(), &UserData::default());
        assert!(hits.iter().all(|h| d.entries()[h.index].text != "画蛇添足"));
    }

    #[test]
    fn searches_by_english() {
        let d = dict();
        assert_eq!(top(&d, "snake feet"), "画蛇添足");
        // English equivalents are searchable too.
        assert_eq!(top(&d, "gild the lily"), "画蛇添足");
        assert_eq!(top(&d, "blessing in disguise"), "塞翁失马");
        // Typo tolerance.
        assert_eq!(top(&d, "blesing disguise"), "塞翁失马");
    }

    #[test]
    fn filters_overlap() {
        let d = dict();
        let u = UserData::default();
        let f = Filters { kinds: vec![Kind::Chengyu], themes: vec!["animals".into()], ..Default::default() };
        let hits = d.search("", &f, &u);
        assert!(!hits.is_empty());
        for h in &hits {
            let e = &d.entries()[h.index];
            assert_eq!(e.kind, Kind::Chengyu);
            assert!(d.has_theme(e, "animals"));
        }
        let f = Filters { lengths: vec![3], ..Default::default() };
        assert!(d.search("", &f, &u).iter().all(|h| d.entries()[h.index].length() == 3));
        let f = Filters { structures: vec!["ABAC".into()], ..Default::default() };
        assert!(d.search("", &f, &u).iter().any(|h| d.entries()[h.index].text == "自由自在"));
    }

    #[test]
    fn broad_theme_includes_detailed_themes() {
        let themes = vec![
            Theme { id: "animals".into(), en: "Animals".into(), zh: "动物".into(), group: None },
            Theme { id: "fables".into(), en: "Fables".into(), zh: "寓言".into(), group: Some("animals".into()) },
        ];
        let mut e = Dictionary::embedded().entries()[0].clone();
        e.themes = vec!["fables".into()];
        let d = Dictionary::new(vec![e], themes);
        let u = UserData::default();
        let by = |t: &str| d.search("", &Filters { themes: vec![t.into()], ..Default::default() }, &u).len();
        assert_eq!(by("animals"), 1);
        assert_eq!(by("fables"), 1);
        assert_eq!(by("other"), 0);
    }

    #[test]
    fn empty_query_lists_common_first() {
        let d = dict();
        let hits = d.search("", &Filters::default(), &UserData::default());
        assert_eq!(hits.len(), d.len());
        let freqs: Vec<u8> = hits.iter().map(|h| d.entries()[h.index].frequency).collect();
        assert!(freqs.windows(2).all(|w| w[0] <= w[1]));
    }

    #[test]
    fn edit_distance_works() {
        assert_eq!(edit_distance("kitten", "sitting", 5), 3);
        assert_eq!(edit_distance("abc", "abc", 1), 0);
        assert!(edit_distance("abc", "xyzxyz", 1) > 1);
    }
}
