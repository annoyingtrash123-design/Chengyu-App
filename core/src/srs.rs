//! Spaced repetition (an Anki-style variant of SM-2). Days are integers
//! ("local day number" = days since 1970-01-01 in the user's time zone).

use serde::{Deserialize, Serialize};

/// Interval (days) at which a card counts as mastered.
pub const MASTERED_INTERVAL: u32 = 21;
const MIN_EASE: f32 = 1.3;
const START_EASE: f32 = 2.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grade {
    Again,
    Hard,
    Good,
    Easy,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Card {
    /// Current interval in days (0 = still being learned today).
    pub interval: u32,
    pub ease: f32,
    pub reps: u32,
    pub lapses: u32,
    pub due: i64,
    pub last_review: i64,
}

impl Default for Card {
    fn default() -> Self {
        Card { interval: 0, ease: START_EASE, reps: 0, lapses: 0, due: 0, last_review: 0 }
    }
}

impl Card {
    pub fn is_due(&self, today: i64) -> bool {
        self.due <= today
    }

    pub fn is_mastered(&self) -> bool {
        self.interval >= MASTERED_INTERVAL
    }
}

/// Apply a review. `card` is `None` for a card seen for the first time.
pub fn review(card: Option<&Card>, grade: Grade, today: i64) -> Card {
    // A card already scheduled for a later day can't be pushed further by reviewing it
    // again today (e.g. a double tap); only "Again" counts.
    if let Some(c) = card {
        if c.last_review == today && c.interval > 0 && grade != Grade::Again {
            return c.clone();
        }
    }
    let mut c = card.cloned().unwrap_or(Card { due: today, last_review: today, ..Card::default() });
    let first = c.reps == 0;
    let prev = c.interval;
    c.interval = match grade {
        Grade::Again => {
            if !first && prev > 0 {
                c.lapses += 1;
            }
            c.ease = (c.ease - 0.2).max(MIN_EASE);
            0
        }
        Grade::Hard => {
            c.ease = (c.ease - 0.15).max(MIN_EASE);
            // A card that isn't learnt yet stays in today's session.
            if prev == 0 { 0 } else { ((prev as f32 * 1.2).round() as u32).max(prev + 1) }
        }
        Grade::Good => match prev {
            0 => 1,
            1 => 3,
            _ => ((prev as f32 * c.ease).round() as u32).max(prev + 1),
        },
        Grade::Easy => {
            c.ease += 0.15;
            match prev {
                0 => 4,
                _ => ((prev as f32 * c.ease * 1.3).round() as u32).max(prev + 2),
            }
        }
    };
    c.reps += 1;
    c.last_review = today;
    c.due = today + c.interval as i64;
    c
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_card_good_then_grows() {
        let c = review(None, Grade::Good, 100);
        assert_eq!((c.interval, c.due), (1, 101));
        let c = review(Some(&c), Grade::Good, 101);
        assert_eq!(c.interval, 3);
        let c = review(Some(&c), Grade::Good, 104);
        assert_eq!(c.interval, 8); // 3 * 2.5 = 7.5 → 8
        let c = review(Some(&c), Grade::Good, 112);
        assert_eq!(c.interval, 20);
        assert!(!c.is_mastered());
        let c = review(Some(&c), Grade::Good, 132);
        assert!(c.is_mastered());
    }

    #[test]
    fn again_resets_and_counts_lapse() {
        let c = review(None, Grade::Good, 0);
        let c = review(Some(&c), Grade::Good, 1);
        let c = review(Some(&c), Grade::Again, 4);
        assert_eq!(c.interval, 0);
        assert_eq!(c.due, 4);
        assert_eq!(c.lapses, 1);
        assert!(c.ease < 2.5);
    }

    #[test]
    fn again_on_new_card_is_not_a_lapse() {
        let c = review(None, Grade::Again, 0);
        assert_eq!(c.lapses, 0);
        assert!(c.is_due(0));
    }

    #[test]
    fn ease_never_drops_below_minimum() {
        let mut c = review(None, Grade::Good, 0);
        for d in 1..20 {
            c = review(Some(&c), Grade::Again, d);
        }
        assert!(c.ease >= MIN_EASE);
    }

    #[test]
    fn repeat_review_same_day_does_not_inflate() {
        let c = review(None, Grade::Good, 10);
        let again_same_day = review(Some(&c), Grade::Good, 10);
        assert_eq!(again_same_day, c);
        // But "Again" still counts.
        assert_eq!(review(Some(&c), Grade::Again, 10).interval, 0);
    }

    #[test]
    fn hard_on_new_card_keeps_it_in_session() {
        let c = review(None, Grade::Hard, 3);
        assert_eq!(c.interval, 0);
        assert!(c.is_due(3));
        let c = review(Some(&c), Grade::Good, 3);
        assert_eq!(c.interval, 1);
    }

    #[test]
    fn old_cards_with_missing_fields_still_load() {
        let c: Card = serde_json::from_str(r#"{"interval": 5, "due": 9}"#).unwrap();
        assert_eq!(c.interval, 5);
        assert!(c.ease > 1.0);
    }

    #[test]
    fn easy_beats_good_beats_hard() {
        let base = review(Some(&review(None, Grade::Good, 0)), Grade::Good, 1);
        let h = review(Some(&base), Grade::Hard, 4).interval;
        let g = review(Some(&base), Grade::Good, 4).interval;
        let e = review(Some(&base), Grade::Easy, 4).interval;
        assert!(h < g && g < e, "{h} {g} {e}");
    }
}
