//! Quiz question generation.

use serde::{Deserialize, Serialize};

use crate::dictionary::Dictionary;
use crate::model::{is_han, Entry, Kind};
use crate::pinyin;
use crate::rng::Rng;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuestionKind {
    /// Show the meaning, pick the expression.
    MeaningToIdiom,
    /// Show the expression, pick the meaning.
    IdiomToMeaning,
    /// One character is blanked out, pick it.
    MissingChar,
    /// An example sentence with the expression blanked out.
    SentenceCloze,
    /// Pick the pinyin with the correct tones.
    Pinyin,
    /// Pick the synonym.
    Synonym,
    /// Pick the antonym.
    Antonym,
}

impl QuestionKind {
    pub const ALL: [QuestionKind; 7] = [
        QuestionKind::MeaningToIdiom,
        QuestionKind::IdiomToMeaning,
        QuestionKind::MissingChar,
        QuestionKind::SentenceCloze,
        QuestionKind::Pinyin,
        QuestionKind::Synonym,
        QuestionKind::Antonym,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    #[default]
    En,
    Zh,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Question {
    pub kind: QuestionKind,
    pub entry_id: String,
    /// Main prompt (Chinese).
    pub prompt: String,
    /// English helper text, if any (the UI hides it when English is switched off).
    pub prompt_en: Option<String>,
    pub options: Vec<String>,
    pub answer: usize,
}

const BLANK: &str = "＿";

/// Other entries ranked as plausible distractors for `e` (same kind, shared
/// themes and same length first), excluding its synonyms and antonyms.
fn distractor_entries<'a>(dict: &'a Dictionary, e: &Entry, rng: &mut Rng) -> Vec<&'a Entry> {
    let mut scored: Vec<(u64, &Entry)> = dict
        .entries()
        .iter()
        .filter(|o| o.id != e.id && !e.synonyms.contains(&o.text) && !e.antonyms.contains(&o.text))
        .map(|o| {
            let mut s = 0;
            if o.kind == e.kind {
                s += 4;
            }
            if o.length() == e.length() {
                s += 2;
            }
            s += o.themes.iter().filter(|t| e.themes.contains(t)).count() as u64;
            // Random tiebreak in the low bits.
            ((s << 32) | (rng.next_u64() & 0xFFFF_FFFF), o)
        })
        .collect();
    scored.sort_by_key(|s| std::cmp::Reverse(s.0));
    scored.into_iter().map(|(_, o)| o).collect()
}

/// Shuffle the correct answer in with the distractors.
fn finish(
    kind: QuestionKind,
    e: &Entry,
    prompt: String,
    prompt_en: Option<String>,
    correct: String,
    distractors: Vec<String>,
    rng: &mut Rng,
) -> Option<Question> {
    let mut options = vec![correct.clone()];
    for d in distractors {
        if options.len() == 4 {
            break;
        }
        if !options.contains(&d) {
            options.push(d);
        }
    }
    if options.len() < 2 {
        return None;
    }
    rng.shuffle(&mut options);
    let answer = options.iter().position(|o| *o == correct)?;
    Some(Question { kind, entry_id: e.id.clone(), prompt, prompt_en, options, answer })
}

fn meaning(e: &Entry, lang: Lang) -> String {
    match lang {
        Lang::En => e.meaning.en.clone(),
        Lang::Zh => e.meaning.zh.clone(),
    }
}

/// Take the top distractors, with a bit of randomness among the best ones.
fn top_texts(pool: &[&Entry], n: usize, rng: &mut Rng, f: impl Fn(&Entry) -> String) -> Vec<String> {
    let best: Vec<String> = pool.iter().take(n * 2).map(|e| f(e)).collect();
    rng.sample(&best, n + 2)
}

/// Pinyin with 1–2 syllables' tones changed.
fn wrong_tones(py: &str, rng: &mut Rng) -> String {
    let mut syls: Vec<String> = py.split_whitespace().map(str::to_string).collect();
    let changes = 1 + rng.below(2.min(syls.len()));
    let indices: Vec<usize> = (0..syls.len()).collect();
    for i in rng.sample(&indices, changes) {
        let current = pinyin::tone_of(&syls[i]);
        let new_tone = (current + 1 + rng.below(3) as u8) % 4 + 1;
        let new_tone = if new_tone == current { current % 4 + 1 } else { new_tone };
        syls[i] = pinyin::apply_tone(&syls[i], new_tone);
    }
    syls.join(" ")
}

/// Build one question of `kind` about `e`, if that kind makes sense for it.
pub fn make_question(
    dict: &Dictionary,
    e: &Entry,
    kind: QuestionKind,
    lang: Lang,
    rng: &mut Rng,
) -> Option<Question> {
    let pool = distractor_entries(dict, e, rng);
    match kind {
        QuestionKind::MeaningToIdiom => {
            let d = top_texts(&pool, 3, rng, |o| o.text.clone());
            finish(kind, e, e.meaning.zh.clone(), Some(e.meaning.en.clone()), e.text.clone(), d, rng)
        }
        QuestionKind::IdiomToMeaning => {
            let d = top_texts(&pool, 3, rng, |o| meaning(o, lang));
            finish(kind, e, e.text.clone(), None, meaning(e, lang), d, rng)
        }
        QuestionKind::MissingChar => {
            let chars = e.chars();
            if chars.len() < 3 || chars.len() > 8 || e.kind == Kind::Xiehouyu {
                return None;
            }
            let i = rng.below(chars.len());
            let target = chars[i];
            let mut seen = 0;
            let prompt: String = e
                .text
                .chars()
                .map(|c| {
                    if is_han(c) {
                        seen += 1;
                        if seen - 1 == i {
                            return BLANK.to_string();
                        }
                    }
                    c.to_string()
                })
                .collect();
            let mut d: Vec<String> = pool
                .iter()
                .flat_map(|o| o.chars())
                .filter(|c| !chars.contains(c))
                .map(|c| c.to_string())
                .take(30)
                .collect();
            rng.shuffle(&mut d);
            finish(kind, e, prompt, Some(e.meaning.en.clone()), target.to_string(), d, rng)
        }
        QuestionKind::SentenceCloze => {
            let ex = e.examples.iter().find(|x| x.zh.contains(&e.text))?;
            let blank = BLANK.repeat(e.length().min(6));
            let prompt = ex.zh.replace(&e.text, &blank);
            let d = top_texts(&pool, 3, rng, |o| o.text.clone());
            finish(kind, e, prompt, Some(ex.en.clone()), e.text.clone(), d, rng)
        }
        QuestionKind::Pinyin => {
            if e.length() > 8 || pinyin::syllables(&e.pinyin).len() != e.length() {
                return None;
            }
            let d: Vec<String> = (0..12).map(|_| wrong_tones(&e.pinyin, rng)).collect();
            finish(kind, e, e.text.clone(), None, e.pinyin.clone(), d, rng)
        }
        QuestionKind::Synonym | QuestionKind::Antonym => {
            let (targets, others) = if kind == QuestionKind::Synonym {
                (&e.synonyms, &e.antonyms)
            } else {
                (&e.antonyms, &e.synonyms)
            };
            let correct = rng.pick(targets)?.clone();
            let d: Vec<String> = top_texts(&pool, 3, rng, |o| o.text.clone())
                .into_iter()
                .filter(|t| !others.contains(t) && *t != correct)
                .collect();
            finish(kind, e, e.text.clone(), Some(e.meaning.en.clone()), correct, d, rng)
        }
    }
}

/// Generate up to `count` questions about entries in `pool` (ids), cycling
/// through entries before repeating any.
pub fn generate(
    dict: &Dictionary,
    pool: &[String],
    kinds: &[QuestionKind],
    count: usize,
    lang: Lang,
    seed: u64,
) -> Vec<Question> {
    let mut rng = Rng::new(seed);
    let kinds: Vec<QuestionKind> = if kinds.is_empty() { QuestionKind::ALL.to_vec() } else { kinds.to_vec() };
    let entries: Vec<&Entry> = pool.iter().filter_map(|id| dict.get(id)).collect();
    if entries.is_empty() {
        return Vec::new();
    }
    let mut order: Vec<&Entry> = Vec::new();
    let mut out = Vec::new();
    let mut failures = 0;
    while out.len() < count && failures < count * 10 + 50 {
        if order.is_empty() {
            order = entries.clone();
            rng.shuffle(&mut order);
        }
        let e = order.pop().unwrap();
        let kind = *rng.pick(&kinds).unwrap();
        match make_question(dict, e, kind, lang, &mut rng) {
            Some(q) => out.push(q),
            None => failures += 1,
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn all_ids(d: &Dictionary) -> Vec<String> {
        d.entries().iter().map(|e| e.id.clone()).collect()
    }

    #[test]
    fn every_kind_produces_valid_questions() {
        let d = Dictionary::embedded();
        for kind in QuestionKind::ALL {
            let qs = generate(&d, &all_ids(&d), &[kind], 10, Lang::En, 7);
            assert!(!qs.is_empty(), "{kind:?} produced nothing");
            for q in qs {
                assert_eq!(q.kind, kind);
                assert!(q.options.len() >= 2 && q.options.len() <= 4);
                assert!(q.answer < q.options.len());
                let mut unique = q.options.clone();
                unique.dedup();
                unique.sort();
                unique.dedup();
                assert_eq!(unique.len(), q.options.len(), "duplicate options in {q:?}");
            }
        }
    }

    #[test]
    fn answers_are_correct() {
        let d = Dictionary::embedded();
        for q in generate(&d, &all_ids(&d), &[], 50, Lang::En, 3) {
            let e = d.get(&q.entry_id).unwrap();
            let ans = &q.options[q.answer];
            match q.kind {
                QuestionKind::MeaningToIdiom | QuestionKind::SentenceCloze => assert_eq!(ans, &e.text),
                QuestionKind::IdiomToMeaning => assert_eq!(ans, &e.meaning.en),
                QuestionKind::Pinyin => assert_eq!(ans, &e.pinyin),
                QuestionKind::Synonym => assert!(e.synonyms.contains(ans)),
                QuestionKind::Antonym => assert!(e.antonyms.contains(ans)),
                QuestionKind::MissingChar => {
                    assert!(q.prompt.contains(BLANK));
                    assert_eq!(q.prompt.replace(BLANK, ans), e.text);
                }
            }
            if q.kind == QuestionKind::SentenceCloze {
                assert!(!q.prompt.contains(&e.text));
            }
        }
    }

    #[test]
    fn generation_is_deterministic() {
        let d = Dictionary::embedded();
        let a = generate(&d, &all_ids(&d), &[], 10, Lang::Zh, 42);
        let b = generate(&d, &all_ids(&d), &[], 10, Lang::Zh, 42);
        assert_eq!(a, b);
    }

    #[test]
    fn wrong_tones_differ_from_correct() {
        let mut rng = Rng::new(1);
        for _ in 0..50 {
            assert_ne!(wrong_tones("huà shé tiān zú", &mut rng), "huà shé tiān zú");
        }
    }
}
