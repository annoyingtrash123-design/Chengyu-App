//! Games: 成语接龙 (idiom chain), unscramble, memory match and synonym/antonym matching.

use serde::{Deserialize, Serialize};

use crate::dictionary::Dictionary;
use crate::model::{Entry, Kind};
use crate::rng::Rng;

// ---------- 成语接龙 ----------

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "result", rename_all = "snake_case")]
pub enum ChainCheck {
    Ok { id: String },
    NotInDictionary,
    AlreadyUsed { id: String },
    DoesNotConnect { id: String, need: String },
}

fn chainable(e: &Entry) -> bool {
    matches!(e.kind, Kind::Chengyu | Kind::Guanyongyu) && e.length() >= 3
}

/// Does `next` follow `prev`? Same character, or (if `homophones`) same toneless syllable.
pub fn connects(dict: &Dictionary, prev: &Entry, next: &Entry, homophones: bool) -> bool {
    let (Some((_, last)), Some((first, _))) = (prev.first_last(), next.first_last()) else {
        return false;
    };
    if last == first {
        return true;
    }
    homophones && {
        let a = dict.plain_syllables(prev);
        let b = dict.plain_syllables(next);
        a.len() == prev.length() && b.len() == next.length() && a.last() == b.first()
    }
}

/// All unused entries that can follow `prev`.
pub fn chain_candidates<'a>(
    dict: &'a Dictionary,
    prev: &Entry,
    used: &[String],
    homophones: bool,
) -> Vec<&'a Entry> {
    dict.entries()
        .iter()
        .filter(|e| chainable(e) && !used.contains(&e.id) && connects(dict, prev, e, homophones))
        .collect()
}

/// Check the player's move. `text` is what they typed.
pub fn chain_check(dict: &Dictionary, prev_id: &str, text: &str, used: &[String], homophones: bool) -> ChainCheck {
    let text: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    let Some(next) = dict.by_text(&text).filter(|e| chainable(e)) else {
        return ChainCheck::NotInDictionary;
    };
    if used.contains(&next.id) {
        return ChainCheck::AlreadyUsed { id: next.id.clone() };
    }
    match dict.get(prev_id) {
        Some(prev) if !connects(dict, prev, next, homophones) => ChainCheck::DoesNotConnect {
            id: next.id.clone(),
            need: prev.first_last().map(|(_, l)| l.to_string()).unwrap_or_default(),
        },
        _ => ChainCheck::Ok { id: next.id.clone() },
    }
}

/// The app's move: prefer an expression that leaves the player an answer
/// (it's a learning game, not a trap), otherwise any valid one.
pub fn chain_ai(dict: &Dictionary, prev_id: &str, used: &[String], homophones: bool, seed: u64) -> Option<String> {
    let prev = dict.get(prev_id)?;
    let mut rng = Rng::new(seed);
    let mut options = chain_candidates(dict, prev, used, homophones);
    rng.shuffle(&mut options);
    let mut used_after: Vec<String> = used.to_vec();
    let friendly = options.iter().find(|e| {
        used_after.push(e.id.clone());
        let ok = !chain_candidates(dict, e, &used_after, homophones).is_empty();
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
        .find(|e| !chain_candidates(dict, e, std::slice::from_ref(&e.id), homophones).is_empty())
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

    let mut cards = Vec::new();
    let mut faces: Vec<String> = Vec::new();
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
        let pair = cards.len() / 2;
        faces.push(e.text.clone());
        faces.push(partner.clone());
        cards.push(MatchCard { pair, face: e.text.clone(), is_idiom: true, entry_id: e.id.clone() });
        cards.push(MatchCard { pair, face: partner, is_idiom: false, entry_id: e.id.clone() });
    }
    rng.shuffle(&mut cards);
    cards
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
            chain_candidates(&d, a, std::slice::from_ref(&a.id), false).first().map(|b| (a.clone(), (*b).clone()))
        });
        let (a, b) = pair.expect("sample data should contain at least one chain pair");
        assert_eq!(chain_check(&d, &a.id, &b.text, std::slice::from_ref(&a.id), false), ChainCheck::Ok { id: b.id.clone() });
        assert_eq!(
            chain_check(&d, &a.id, &b.text, &[a.id.clone(), b.id.clone()], false),
            ChainCheck::AlreadyUsed { id: b.id.clone() }
        );
        assert_eq!(chain_check(&d, &a.id, "不是成语", &[], false), ChainCheck::NotInDictionary);
    }

    #[test]
    fn chain_rejects_non_connecting() {
        let d = Dictionary::embedded();
        let a = d.by_text("画蛇添足").unwrap();
        let b = d.by_text("马到成功").unwrap();
        assert!(matches!(
            chain_check(&d, &a.id, &b.text, &[], false),
            ChainCheck::DoesNotConnect { .. }
        ));
    }

    #[test]
    fn chain_ai_plays_valid_moves() {
        let d = Dictionary::embedded();
        for e in d.entries() {
            if let Some(next) = chain_ai(&d, &e.id, std::slice::from_ref(&e.id), true, 9) {
                let n = d.get(&next).unwrap();
                assert!(connects(&d, e, n, true));
                assert_ne!(n.id, e.id);
            }
        }
        assert!(chain_start(&d, true, 1).is_some());
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
