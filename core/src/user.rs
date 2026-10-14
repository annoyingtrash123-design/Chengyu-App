//! Everything personal: flashcard state, favourites, history, settings and stats.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::srs::{self, Card, Grade};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    New,
    Learning,
    Mastered,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct DayLog {
    pub reviews: u32,
    pub correct: u32,
    pub new_cards: u32,
    pub quiz_answers: u32,
    pub games: u32,
}

impl DayLog {
    /// Number of activities that count towards the daily goal and streak.
    pub fn activity(&self) -> u32 {
        self.reviews + self.quiz_answers
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Accuracy {
    pub seen: u32,
    pub correct: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Reviews + quiz answers per day.
    pub daily_goal: u32,
    pub new_per_day: u32,
    /// Show English translations (switch off to practise in Chinese only).
    pub show_english: bool,
    pub reminders: bool,
    /// Local time "HH:MM" for the daily reminder.
    pub reminder_time: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            daily_goal: 20,
            new_per_day: 10,
            show_english: true,
            reminders: false,
            reminder_time: "20:00".into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct UserData {
    pub version: u32,
    pub cards: BTreeMap<String, Card>,
    pub favourites: BTreeSet<String>,
    pub history: BTreeMap<i64, DayLog>,
    pub accuracy: BTreeMap<String, Accuracy>,
    pub settings: Settings,
    pub best_streak: u32,
}

impl Default for UserData {
    fn default() -> Self {
        UserData {
            version: 1,
            cards: BTreeMap::new(),
            favourites: BTreeSet::new(),
            history: BTreeMap::new(),
            accuracy: BTreeMap::new(),
            settings: Settings::default(),
            best_streak: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WeakSpot {
    pub id: String,
    pub lapses: u32,
    pub accuracy: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Stats {
    pub new: usize,
    pub learning: usize,
    pub mastered: usize,
    pub due_today: usize,
    pub streak: u32,
    pub best_streak: u32,
    pub today: DayLog,
    pub daily_goal: u32,
    /// Activity for the last 30 days, oldest first.
    pub last_30_days: Vec<u32>,
    pub total_reviews: u32,
    pub accuracy: f32,
    pub weak_spots: Vec<WeakSpot>,
}

impl UserData {
    pub fn status(&self, id: &str) -> Status {
        match self.cards.get(id) {
            None => Status::New,
            Some(c) if c.is_mastered() => Status::Mastered,
            Some(_) => Status::Learning,
        }
    }

    fn day(&mut self, today: i64) -> &mut DayLog {
        self.history.entry(today).or_default()
    }

    /// Record a flashcard review.
    pub fn review(&mut self, id: &str, grade: Grade, today: i64) -> &Card {
        let is_new = !self.cards.contains_key(id);
        let card = srs::review(self.cards.get(id), grade, today);
        if self.cards.get(id) == Some(&card) {
            return &self.cards[id]; // ignored repeat (e.g. double tap): nothing to record
        }
        let correct = grade != Grade::Again;
        let day = self.day(today);
        day.reviews += 1;
        day.correct += u32::from(correct);
        day.new_cards += u32::from(is_new);
        self.record_accuracy(id, correct);
        self.cards.insert(id.to_string(), card);
        self.update_best_streak(today);
        &self.cards[id]
    }

    /// Record a quiz or game answer.
    pub fn quiz_answer(&mut self, id: &str, correct: bool, today: i64) {
        let day = self.day(today);
        day.quiz_answers += 1;
        day.correct += u32::from(correct);
        self.record_accuracy(id, correct);
        self.update_best_streak(today);
    }

    pub fn game_played(&mut self, today: i64) {
        self.day(today).games += 1;
    }

    fn record_accuracy(&mut self, id: &str, correct: bool) {
        let a = self.accuracy.entry(id.to_string()).or_default();
        a.seen += 1;
        a.correct += u32::from(correct);
    }

    fn update_best_streak(&mut self, today: i64) {
        self.best_streak = self.best_streak.max(self.streak(today));
    }

    pub fn toggle_favourite(&mut self, id: &str) -> bool {
        if !self.favourites.remove(id) {
            self.favourites.insert(id.to_string());
            true
        } else {
            false
        }
    }

    fn active(&self, day: i64) -> bool {
        self.history.get(&day).is_some_and(|d| d.activity() > 0)
    }

    /// Consecutive active days ending today (or yesterday, if nothing done yet today).
    pub fn streak(&self, today: i64) -> u32 {
        let mut day = if self.active(today) { today } else { today - 1 };
        let mut n = 0;
        while self.active(day) {
            n += 1;
            day -= 1;
        }
        n
    }

    /// New cards introduced today.
    pub fn new_today(&self, today: i64) -> u32 {
        self.history.get(&today).map_or(0, |d| d.new_cards)
    }

    pub fn stats(&self, all_ids: &[&str], today: i64) -> Stats {
        let mut s = Stats {
            new: 0,
            learning: 0,
            mastered: 0,
            due_today: 0,
            streak: self.streak(today),
            best_streak: self.best_streak.max(self.streak(today)),
            today: self.history.get(&today).cloned().unwrap_or_default(),
            daily_goal: self.settings.daily_goal,
            last_30_days: (today - 29..=today)
                .map(|d| self.history.get(&d).map_or(0, DayLog::activity))
                .collect(),
            total_reviews: 0,
            accuracy: 0.0,
            weak_spots: Vec::new(),
        };
        for id in all_ids {
            match self.status(id) {
                Status::New => s.new += 1,
                Status::Learning => s.learning += 1,
                Status::Mastered => s.mastered += 1,
            }
            if self.cards.get(*id).is_some_and(|c| c.is_due(today)) {
                s.due_today += 1;
            }
        }
        let (seen, correct) = self
            .accuracy
            .values()
            .fold((0, 0), |(s, c), a| (s + a.seen, c + a.correct));
        s.total_reviews = self.history.values().map(|d| d.reviews).sum();
        s.accuracy = if seen == 0 { 0.0 } else { correct as f32 / seen as f32 };

        let mut weak: Vec<WeakSpot> = self
            .accuracy
            .iter()
            .filter(|(id, a)| a.seen >= 3 && all_ids.contains(&id.as_str()))
            .map(|(id, a)| WeakSpot {
                id: id.clone(),
                lapses: self.cards.get(id).map_or(0, |c| c.lapses),
                accuracy: a.correct as f32 / a.seen as f32,
            })
            .filter(|w| w.accuracy < 0.8 || w.lapses > 0)
            .collect();
        weak.sort_by(|a, b| {
            a.accuracy
                .partial_cmp(&b.accuracy)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(b.lapses.cmp(&a.lapses))
        });
        weak.truncate(10);
        s.weak_spots = weak;
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statuses_follow_cards() {
        let mut u = UserData::default();
        assert_eq!(u.status("x"), Status::New);
        u.review("x", Grade::Good, 0);
        assert_eq!(u.status("x"), Status::Learning);
        u.cards.get_mut("x").unwrap().interval = 30;
        assert_eq!(u.status("x"), Status::Mastered);
    }

    #[test]
    fn streak_counts_consecutive_days() {
        let mut u = UserData::default();
        for d in [10, 11, 12] {
            u.quiz_answer("x", true, d);
        }
        assert_eq!(u.streak(12), 3);
        // Nothing yet today: yesterday's streak still stands.
        assert_eq!(u.streak(13), 3);
        // Missed a day: streak broken.
        assert_eq!(u.streak(14), 0);
        assert_eq!(u.best_streak, 3);
    }

    #[test]
    fn stats_report_progress() {
        let mut u = UserData::default();
        u.review("a", Grade::Good, 5);
        u.review("b", Grade::Again, 5);
        for _ in 0..3 {
            u.quiz_answer("b", false, 5);
        }
        let s = u.stats(&["a", "b", "c"], 5);
        assert_eq!((s.new, s.learning, s.mastered), (1, 2, 0));
        assert_eq!(s.due_today, 1); // "b" was failed so is due again today
        assert_eq!(s.today.reviews, 2);
        assert_eq!(s.today.new_cards, 2);
        assert_eq!(s.streak, 1);
        assert_eq!(s.last_30_days.len(), 30);
        assert_eq!(*s.last_30_days.last().unwrap(), 5);
        assert_eq!(s.weak_spots[0].id, "b");
    }

    #[test]
    fn favourites_toggle() {
        let mut u = UserData::default();
        assert!(u.toggle_favourite("a"));
        assert!(u.favourites.contains("a"));
        assert!(!u.toggle_favourite("a"));
        assert!(u.favourites.is_empty());
    }

    #[test]
    fn old_save_files_still_load() {
        let u: UserData = serde_json::from_str(r#"{"favourites":["a"]}"#).unwrap();
        assert!(u.favourites.contains("a"));
        assert_eq!(u.settings.daily_goal, 20);
    }
}
