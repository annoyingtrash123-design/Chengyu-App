//! Games: 成语接龙 (idiom chain), unscramble, memory match and synonym/antonym matching.

use serde::{Deserialize, Serialize};

use crate::dictionary::Dictionary;
use crate::model::{reading_chars, Entry, Kind, VariantKind};
use crate::rng::Rng;

// ---------- 成语接龙 ----------

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "result", rename_all = "snake_case")]
pub enum ChainCheck {
    /// `text` is the form played (the headword or a variant), which the next move must follow.
    Ok { id: String, text: String },
    NotInDictionary,
    AlreadyUsed { id: String },
    DoesNotConnect { id: String, need: String },
}

fn chainable(e: &Entry) -> bool {
    matches!(e.kind, Kind::Chengyu | Kind::Guanyongyu) && e.length() >= 3
}

/// The form of `e` that was played: `form` if it is the headword or one of its variants, else the headword.
pub fn played_form<'a>(e: &'a Entry, form: Option<&'a str>) -> &'a str {
    match form {
        Some(f) if f == e.text || e.variants.iter().any(|v| v == f) => f,
        _ => &e.text,
    }
}

/// The first or last character of a played form.
fn end_char(form: &str, last: bool) -> Option<char> {
    let chars = reading_chars(form);
    if last { chars.last().copied() } else { chars.first().copied() }
}

/// The toneless syllable of a played form's first or last character, taken from the headword's pinyin
/// (a variant borrows the reading of the same character in the headword; `None` if it has none).
fn end_syllable(dict: &Dictionary, e: &Entry, form: &str, last: bool) -> Option<String> {
    let head = e.chars();
    let syls = dict.plain_syllables(e);
    if syls.len() != head.len() {
        return None;
    }
    let pos = if form == e.text {
        if last { head.len() - 1 } else { 0 }
    } else {
        let c = end_char(form, last)?;
        if last { head.iter().rposition(|&h| h == c)? } else { head.iter().position(|&h| h == c)? }
    };
    Some(syls[pos].clone())
}

/// Does `next` (played as `next_form`) follow `prev` (played as `prev_form`)? Same character, or
/// (if `homophones`) same toneless syllable.
pub fn connects(dict: &Dictionary, prev: &Entry, prev_form: &str, next: &Entry, next_form: &str, homophones: bool) -> bool {
    let (Some(last), Some(first)) = (end_char(prev_form, true), end_char(next_form, false)) else {
        return false;
    };
    if last == first {
        return true;
    }
    homophones && {
        let a = end_syllable(dict, prev, prev_form, true);
        a.is_some() && a == end_syllable(dict, next, next_form, false)
    }
}

/// All unused entries that can follow `prev` (played as `prev_form`), in their headword form.
pub fn chain_candidates<'a>(
    dict: &'a Dictionary,
    prev: &Entry,
    prev_form: &str,
    used: &[String],
    homophones: bool,
) -> Vec<&'a Entry> {
    dict.entries()
        .iter()
        .filter(|e| chainable(e) && !used.contains(&e.id) && connects(dict, prev, prev_form, e, &e.text, homophones))
        .collect()
}

/// Check the player's move. `text` is what they typed: any form of an entry, in simplified or traditional
/// characters. `prev_form` is the form the previous move was played in (the headword if `None`).
pub fn chain_check(
    dict: &Dictionary,
    prev_id: &str,
    prev_form: Option<&str>,
    text: &str,
    used: &[String],
    homophones: bool,
) -> ChainCheck {
    let Some((next, form)) = dict.resolve_typed(text).filter(|(e, _)| chainable(e)) else {
        return ChainCheck::NotInDictionary;
    };
    // A known miswriting counts as its correct headword.
    let form = if next.variant_kinds.get(&form) == Some(&VariantKind::Error) { next.text.clone() } else { form };
    if used.contains(&next.id) {
        return ChainCheck::AlreadyUsed { id: next.id.clone() };
    }
    match dict.get(prev_id) {
        Some(prev) => {
            let prev_form = played_form(prev, prev_form);
            if connects(dict, prev, prev_form, next, &form, homophones) {
                ChainCheck::Ok { id: next.id.clone(), text: form }
            } else {
                ChainCheck::DoesNotConnect {
                    id: next.id.clone(),
                    need: end_char(prev_form, true).map(String::from).unwrap_or_default(),
                }
            }
        }
        None => ChainCheck::Ok { id: next.id.clone(), text: form },
    }
}

/// The app's move: prefer an expression that leaves the player an answer
/// (it's a learning game, not a trap), otherwise any valid one.
pub fn chain_ai(
    dict: &Dictionary,
    prev_id: &str,
    prev_form: Option<&str>,
    used: &[String],
    homophones: bool,
    seed: u64,
) -> Option<String> {
    let prev = dict.get(prev_id)?;
    let prev_form = played_form(prev, prev_form);
    let mut rng = Rng::new(seed);
    let mut options = chain_candidates(dict, prev, prev_form, used, homophones);
    rng.shuffle(&mut options);
    let mut used_after: Vec<String> = used.to_vec();
    let friendly = options.iter().find(|e| {
        used_after.push(e.id.clone());
        let ok = !chain_candidates(dict, e, &e.text, &used_after, homophones).is_empty();
        used_after.pop();
        ok
    });
    friendly.or(options.first()).map(|e| e.id.clone())
}

/// A random starting expression that has at least one follow-up.
pub fn chain_start(dict: &Dictionary, homophones: bool, seed: u64) -> Option<String> {
    let mut rng = Rng::new(seed);
    let mut starts: Vec<&Entry> = dict.entries().iter().filter(|e| chainable(e)).collect();
    rng.shuffle(&mut starts);
    starts
        .iter()
        .find(|e| !chain_candidates(dict, e, &e.text, std::slice::from_ref(&e.id), homophones).is_empty())
        .or(starts.first())
        .map(|e| e.id.clone())
}

// ---------- Unscramble ----------

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Scramble {
    pub entry_id: String,
    pub tiles: Vec<String>,
    pub length: usize,
}

/// The characters of an expression shuffled, plus `decoys` extra characters.
pub fn scramble(dict: &Dictionary, id: &str, decoys: usize, seed: u64) -> Option<Scramble> {
    let e = dict.get(id)?;
    let mut rng = Rng::new(seed);
    let chars = e.chars();
    let mut tiles: Vec<String> = chars.iter().map(|c| c.to_string()).collect();
    let mut pool: Vec<char> = dict
        .entries()
        .iter()
        .filter(|o| o.id != e.id)
        .flat_map(|o| o.chars())
        .filter(|c| !chars.contains(c))
        .collect();
    pool.sort();
    pool.dedup();
    tiles.extend(rng.sample(&pool, decoys).into_iter().map(|c| c.to_string()));
    let original = tiles.clone();
    rng.shuffle(&mut tiles);
    if tiles == original && tiles.len() > 1 {
        tiles.rotate_left(1);
    }
    Some(Scramble { entry_id: e.id.clone(), tiles, length: chars.len() })
}

// ---------- Matching games ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchMode {
    /// Expression ↔ meaning.
    Meaning,
    Synonym,
    Antonym,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MatchCard {
    pub pair: usize,
    pub face: String,
    /// The expression side of a pair (as opposed to its partner).
    pub is_idiom: bool,
    pub entry_id: String,
}

/// `n` pairs of cards, shuffled. Used by memory match and the matching games.
pub fn match_cards(
    dict: &Dictionary,
    pool: &[String],
    n: usize,
    mode: MatchMode,
    english: bool,
    seed: u64,
) -> Vec<MatchCard> {
    let mut rng = Rng::new(seed);
    let mut candidates: Vec<&Entry> = pool
        .iter()
        .filter_map(|id| dict.get(id))
        .filter(|e| match mode {
            MatchMode::Meaning => true,
            MatchMode::Synonym => !e.synonyms.is_empty(),
            MatchMode::Antonym => !e.antonyms.is_empty(),
        })
        .collect();
    rng.shuffle(&mut candidates);
    // Memory cards have little room: prefer meanings short enough to read in full.
    if mode == MatchMode::Meaning {
        let limit = if english { 70 } else { 26 };
        candidates.sort_by_key(|e| {
            let m = if english { &e.meaning.en } else { &e.meaning.zh };
            m.chars().count() > limit
        });
    }
    let list = |e: &Entry| -> Vec<String> {
        match mode {
            MatchMode::Meaning => Vec::new(),
            MatchMode::Synonym => e.synonyms.clone(),
            MatchMode::Antonym => e.antonyms.clone(),
        }
    };

    let mut cards = Vec::new();
    let mut faces: Vec<String> = Vec::new();
    let mut placed: Vec<(&Entry, String)> = Vec::new();
    for e in candidates {
        if cards.len() / 2 == n {
            break;
        }
        let partner = match mode {
            MatchMode::Meaning if english => e.meaning.en.clone(),
            MatchMode::Meaning => e.meaning.zh.clone(),
            MatchMode::Synonym => rng.pick(&e.synonyms).cloned().unwrap_or_default(),
            MatchMode::Antonym => rng.pick(&e.antonyms).cloned().unwrap_or_default(),
        };
        // Every face must be unique or the game becomes ambiguous.
        if partner.is_empty() || faces.contains(&e.text) || faces.contains(&partner) {
            continue;
        }
        // Nor may a partner fit two expressions on the board.
        let mine = list(e);
        if placed.iter().any(|(o, op)| list(o).contains(&partner) || mine.contains(op) || mine.contains(&o.text) || list(o).contains(&e.text)) {
            continue;
        }
        placed.push((e, partner.clone()));
        let pair = cards.len() / 2;
        faces.push(e.text.clone());
        faces.push(partner.clone());
        cards.push(MatchCard { pair, face: e.text.clone(), is_idiom: true, entry_id: e.id.clone() });
        cards.push(MatchCard { pair, face: partner, is_idiom: false, entry_id: e.id.clone() });
    }
    rng.shuffle(&mut cards);
    cards
}

// ---------- Crossword ----------

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CrosswordWord {
    pub entry_id: String,
    pub number: usize,
    pub row: usize,
    pub col: usize,
    /// `true` for across, `false` for down.
    pub across: bool,
    pub length: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CrosswordCell {
    pub row: usize,
    pub col: usize,
    pub ch: String,
    /// Shown from the start; the rest are blanks to fill.
    pub given: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Crossword {
    pub width: usize,
    pub height: usize,
    pub cells: Vec<CrosswordCell>,
    pub words: Vec<CrosswordWord>,
    /// Characters to fill the blanks with (the answers plus a few decoys), shuffled.
    pub tiles: Vec<String>,
}

/// Largest grid side, so the puzzle fits on a phone.
const CROSSWORD_MAX: i32 = 9;

/// A small grid of intersecting four-character expressions with some
/// characters blanked out.
pub fn crossword(dict: &Dictionary, pool: &[String], words: usize, seed: u64) -> Option<Crossword> {
    use std::collections::HashMap;
    let mut rng = Rng::new(seed);
    let mut candidates: Vec<&Entry> = pool
        .iter()
        .filter_map(|id| dict.get(id))
        .filter(|e| e.kind == Kind::Chengyu && e.length() == 4)
        .collect();
    rng.shuffle(&mut candidates);
    let first = *candidates.first()?;

    // cell → (character, used across, used down)
    let mut grid: HashMap<(i32, i32), (char, bool, bool)> = HashMap::new();
    let mut placed: Vec<(&Entry, i32, i32, bool)> = Vec::new();
    let put = |grid: &mut HashMap<(i32, i32), (char, bool, bool)>, e: &Entry, r: i32, c: i32, across: bool| {
        for (k, ch) in e.chars().into_iter().enumerate() {
            let pos = if across { (r, c + k as i32) } else { (r + k as i32, c) };
            let cell = grid.entry(pos).or_insert((ch, false, false));
            if across { cell.1 = true } else { cell.2 = true }
        }
    };
    put(&mut grid, first, 0, 0, true);
    placed.push((first, 0, 0, true));

    let fits = |grid: &HashMap<(i32, i32), (char, bool, bool)>, chars: &[char], r: i32, c: i32, across: bool| -> bool {
        let (dr, dc) = if across { (0, 1) } else { (1, 0) };
        let n = chars.len() as i32;
        if grid.contains_key(&(r - dr, c - dc)) || grid.contains_key(&(r + dr * n, c + dc * n)) {
            return false;
        }
        let mut crossings = 0;
        for (k, &ch) in chars.iter().enumerate() {
            let pos = (r + dr * k as i32, c + dc * k as i32);
            match grid.get(&pos) {
                Some(&(g, a, d)) => {
                    if g != ch || (across && a) || (!across && d) {
                        return false;
                    }
                    crossings += 1;
                }
                None => {
                    // No touching neighbours alongside a fresh cell.
                    if grid.contains_key(&(pos.0 + dc, pos.1 + dr)) || grid.contains_key(&(pos.0 - dc, pos.1 - dr)) {
                        return false;
                    }
                }
            }
        }
        if crossings == 0 {
            return false;
        }
        let rows = grid.keys().map(|p| p.0).chain([r, r + dr * (n - 1)]);
        let cols = grid.keys().map(|p| p.1).chain([c, c + dc * (n - 1)]);
        let (r0, r1) = rows.fold((i32::MAX, i32::MIN), |(a, b), x| (a.min(x), b.max(x)));
        let (c0, c1) = cols.fold((i32::MAX, i32::MIN), |(a, b), x| (a.min(x), b.max(x)));
        r1 - r0 < CROSSWORD_MAX && c1 - c0 < CROSSWORD_MAX
    };

    for e in candidates.iter().skip(1).take(4000) {
        if placed.len() >= words {
            break;
        }
        if placed.iter().any(|p| p.0.text == e.text) {
            continue;
        }
        let chars = e.chars();
        let mut spots: Vec<(i32, i32, bool)> = Vec::new();
        for (&(r, c), &(g, a, d)) in &grid {
            for (k, &ch) in chars.iter().enumerate() {
                if ch != g {
                    continue;
                }
                if a && !d {
                    spots.push((r - k as i32, c, false));
                }
                if d && !a {
                    spots.push((r, c - k as i32, true));
                }
            }
        }
        spots.sort();
        rng.shuffle(&mut spots);
        if let Some(&(r, c, across)) = spots.iter().find(|&&(r, c, across)| fits(&grid, &chars, r, c, across)) {
            put(&mut grid, e, r, c, across);
            placed.push((e, r, c, across));
        }
    }
    if placed.len() < 2 {
        return None;
    }

    let r0 = grid.keys().map(|p| p.0).min()?;
    let c0 = grid.keys().map(|p| p.1).min()?;
    let height = (grid.keys().map(|p| p.0).max()? - r0 + 1) as usize;
    let width = (grid.keys().map(|p| p.1).max()? - c0 + 1) as usize;

    // Blank two characters of each word, but keep at least one of every word visible.
    let cells_of = |&(e, r, c, across): &(&Entry, i32, i32, bool)| -> Vec<(i32, i32)> {
        (0..e.length() as i32).map(|k| if across { (r, c + k) } else { (r + k, c) }).collect()
    };
    let mut hidden: std::collections::BTreeSet<(i32, i32)> = std::collections::BTreeSet::new();
    for p in &placed {
        let cells = cells_of(p);
        hidden.extend(rng.sample(&cells, 2));
    }
    for p in &placed {
        let cells = cells_of(p);
        if cells.iter().all(|x| hidden.contains(x)) {
            if let Some(x) = rng.pick(&cells) {
                hidden.remove(x);
            }
        }
    }

    let mut cells: Vec<CrosswordCell> = grid
        .iter()
        .map(|(&(r, c), &(ch, _, _))| CrosswordCell {
            row: (r - r0) as usize,
            col: (c - c0) as usize,
            ch: ch.to_string(),
            given: !hidden.contains(&(r, c)),
        })
        .collect();
    cells.sort_by_key(|x| (x.row, x.col));

    let mut tiles: Vec<String> = cells.iter().filter(|x| !x.given).map(|x| x.ch.clone()).collect();
    let mut decoys: Vec<char> = candidates
        .iter()
        .take(200)
        .flat_map(|e| e.chars())
        .filter(|ch| !grid.values().any(|g| g.0 == *ch))
        .collect();
    decoys.sort();
    decoys.dedup();
    tiles.extend(rng.sample(&decoys, 3).into_iter().map(|c| c.to_string()));
    rng.shuffle(&mut tiles);

    let mut starts: Vec<(usize, usize)> = placed.iter().map(|p| ((p.1 - r0) as usize, (p.2 - c0) as usize)).collect();
    starts.sort();
    starts.dedup();
    let mut out_words: Vec<CrosswordWord> = placed
        .iter()
        .map(|&(e, r, c, across)| {
            let (row, col) = ((r - r0) as usize, (c - c0) as usize);
            CrosswordWord {
                entry_id: e.id.clone(),
                number: starts.iter().position(|&s| s == (row, col)).unwrap_or(0) + 1,
                row,
                col,
                across,
                length: e.length(),
            }
        })
        .collect();
    out_words.sort_by_key(|w| (!w.across, w.number));
    Some(Crossword { width, height, cells, words: out_words, tiles })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(d: &Dictionary) -> Vec<String> {
        d.entries().iter().map(|e| e.id.clone()).collect()
    }

    #[test]
    fn chain_rules() {
        let d = Dictionary::embedded();
        // 自相矛盾 → 自 … ; 马到成功 ends in 功. Find any connecting pair in the data.
        let pair = d.entries().iter().find_map(|a| {
            chain_candidates(&d, a, &a.text, std::slice::from_ref(&a.id), false).first().map(|b| (a.clone(), (*b).clone()))
        });
        let (a, b) = pair.expect("sample data should contain at least one chain pair");
        assert_eq!(
            chain_check(&d, &a.id, None, &b.text, std::slice::from_ref(&a.id), false),
            ChainCheck::Ok { id: b.id.clone(), text: b.text.clone() }
        );
        assert_eq!(
            chain_check(&d, &a.id, None, &b.text, &[a.id.clone(), b.id.clone()], false),
            ChainCheck::AlreadyUsed { id: b.id.clone() }
        );
        assert_eq!(chain_check(&d, &a.id, None, "不是成语", &[], false), ChainCheck::NotInDictionary);
    }

    #[test]
    fn chain_follows_the_form_played() {
        let d = Dictionary::embedded();
        // 零玑碎玉 ends in 玉; 玉食锦衣 is a variant of 锦衣玉食 and starts with 玉.
        let a = d.by_text("零玑碎玉").unwrap();
        let b = d.by_text("锦衣玉食").unwrap();
        assert_eq!(
            chain_check(&d, &a.id, None, "玉食锦衣", &[], false),
            ChainCheck::Ok { id: b.id.clone(), text: "玉食锦衣".into() }
        );
        // The next move follows the variant's last character (衣), not the headword's (食).
        assert!(matches!(
            chain_check(&d, &b.id, Some("玉食锦衣"), "食古不化", &[], false),
            ChainCheck::DoesNotConnect { ref need, .. } if need == "衣"
        ));
        if let Some(next) = chain_ai(&d, &b.id, Some("玉食锦衣"), &[], false, 3) {
            assert_eq!(d.get(&next).unwrap().chars()[0], '衣');
        }
        // Traditional characters, spaces and quotes are fine.
        assert!(matches!(
            chain_check(&d, "no-such-id", None, " “畫蛇添足” ", &[], false),
            ChainCheck::Ok { ref text, .. } if text == "画蛇添足"
        ));
    }

    #[test]
    fn chain_rejects_non_connecting() {
        let d = Dictionary::embedded();
        let a = d.by_text("画蛇添足").unwrap();
        let b = d.by_text("马到成功").unwrap();
        assert!(matches!(
            chain_check(&d, &a.id, None, &b.text, &[], false),
            ChainCheck::DoesNotConnect { .. }
        ));
    }

    #[test]
    fn chain_ai_plays_valid_moves() {
        let d = Dictionary::embedded();
        // Every entry would make this quadratic in the dictionary size; a spread-out sample is enough.
        for e in d.entries().iter().step_by(11) {
            if let Some(next) = chain_ai(&d, &e.id, None, std::slice::from_ref(&e.id), true, 9) {
                let n = d.get(&next).unwrap();
                assert!(connects(&d, e, &e.text, n, &n.text, true));
                assert_ne!(n.id, e.id);
            }
        }
        assert!(chain_start(&d, true, 1).is_some());
    }

    #[test]
    fn crosswords_are_consistent() {
        let d = Dictionary::embedded();
        let pool = ids(&d);
        for seed in 0..20 {
            let x = crossword(&d, &pool, 6, seed).expect("crossword");
            assert!(x.words.len() >= 2);
            assert!(x.width as i32 <= CROSSWORD_MAX && x.height as i32 <= CROSSWORD_MAX);
            for w in &x.words {
                let e = d.get(&w.entry_id).unwrap();
                let mut any_given = false;
                for (k, ch) in e.chars().iter().enumerate() {
                    let (r, c) = if w.across { (w.row, w.col + k) } else { (w.row + k, w.col) };
                    let cell = x.cells.iter().find(|x| x.row == r && x.col == c).expect("cell");
                    assert_eq!(cell.ch, ch.to_string());
                    any_given |= cell.given;
                }
                assert!(any_given, "every word keeps a visible character");
            }
            let blanks = x.cells.iter().filter(|c| !c.given).count();
            assert_eq!(x.tiles.len(), blanks + 3);
        }
    }

    #[test]
    fn scramble_contains_all_characters() {
        let d = Dictionary::embedded();
        let e = d.by_text("画蛇添足").unwrap();
        let s = scramble(&d, &e.id, 2, 5).unwrap();
        assert_eq!(s.tiles.len(), 6);
        for c in e.chars() {
            assert!(s.tiles.contains(&c.to_string()));
        }
    }

    #[test]
    fn match_cards_come_in_unique_pairs() {
        let d = Dictionary::embedded();
        for mode in [MatchMode::Meaning, MatchMode::Synonym, MatchMode::Antonym] {
            let cards = match_cards(&d, &ids(&d), 4, mode, true, 11);
            assert!(!cards.is_empty(), "{mode:?}");
            assert_eq!(cards.len() % 2, 0);
            let mut faces: Vec<&String> = cards.iter().map(|c| &c.face).collect();
            faces.sort();
            faces.dedup();
            assert_eq!(faces.len(), cards.len());
            for p in 0..cards.len() / 2 {
                assert_eq!(cards.iter().filter(|c| c.pair == p).count(), 2);
            }
        }
    }
}
