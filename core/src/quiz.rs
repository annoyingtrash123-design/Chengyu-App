//! Quiz question generation.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::dictionary::Dictionary;
use crate::model::{is_han, reading_chars, Entry, Kind};
use crate::pinyin;
use crate::rng::Rng;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

/// Does a Chinese prompt give the answer away by quoting two or more of its characters in a row?
/// (Single shared characters are fine; masking them made prompts unreadable.)
pub fn gives_away(prompt: &str, e: &Entry) -> bool {
    let chars = e.chars();
    chars.windows(2).any(|w| prompt.contains(&w.iter().collect::<String>()))
}

/// Texts too close to `e` to be a fair wrong answer: its synonyms and antonyms, and theirs (two steps
/// away), since a synonym's synonym usually fits the same sentence or meaning.
fn too_close(dict: &Dictionary, e: &Entry) -> HashSet<String> {
    let mut out: HashSet<String> = HashSet::new();
    for t in e.synonyms.iter().chain(&e.antonyms) {
        out.insert(t.clone());
        if let Some(o) = dict.by_text(t) {
            out.insert(o.text.clone());
            out.extend(o.synonyms.iter().chain(&o.antonyms).cloned());
        }
    }
    out
}

fn shared_themes(a: &Entry, b: &Entry) -> usize {
    a.themes.iter().filter(|t| b.themes.contains(t)).count()
}

/// Other entries ranked as plausible distractors for `e` (same kind and same length first), leaving out
/// anything close enough to be a second right answer: synonyms and antonyms one or two steps away,
/// entries that list this one, and entries sharing more than one label with it (三三两两 / 三五成群 are not
/// cross-listed but fit the same sentence).
fn distractor_entries<'a>(dict: &'a Dictionary, e: &Entry, rng: &mut Rng) -> Vec<&'a Entry> {
    let close = too_close(dict, e);
    let lists_e = |l: &[String]| l.iter().any(|t| *t == e.text || e.variants.contains(t));
    let mut scored: Vec<(u64, &Entry)> = dict
        .entries()
        .iter()
        .filter(|o| {
            o.id != e.id
                && !close.contains(&o.text)
                && !lists_e(&o.synonyms)
                && !lists_e(&o.antonyms)
                && shared_themes(o, e) <= 1
        })
        .map(|o| {
            let mut s = 0;
            if o.kind == e.kind {
                s += 4;
            }
            if o.length() == e.length() {
                s += 2;
            }
            s += shared_themes(o, e) as u64;
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

/// Pinyin with 1–2 syllables' tones changed. 一 and 不 are left alone: the data writes their citation
/// tones (yī, bù), so a changed tone would often be the spoken sandhi form (yí, bú) — not really wrong.
/// `None` when nothing else can change.
fn wrong_tones(py: &str, chars: &[char], rng: &mut Rng) -> Option<String> {
    let mut syls: Vec<String> = py.split_whitespace().map(str::to_string).collect();
    let indices: Vec<usize> = (0..syls.len()).filter(|&i| !matches!(chars.get(i), Some('一' | '不'))).collect();
    if indices.is_empty() {
        return None;
    }
    let changes = 1 + rng.below(2.min(indices.len()));
    for i in rng.sample(&indices, changes) {
        let current = pinyin::tone_of(&syls[i]);
        let new_tone = (current + 1 + rng.below(3) as u8) % 4 + 1;
        let new_tone = if new_tone == current { current % 4 + 1 } else { new_tone };
        syls[i] = pinyin::apply_tone(&syls[i], new_tone);
    }
    Some(syls.join(" "))
}

/// The English line under a fill-the-sentence question, with the answer taken out: the expression itself
/// (some translations quote the Chinese) and its stock English rendering (名句 examples quote it).
fn masked_english(en: &str, e: &Entry) -> String {
    let mut out = en.to_string();
    let mut forms: Vec<&String> = std::iter::once(&e.text).chain(&e.variants).collect();
    forms.sort_by_key(|f| std::cmp::Reverse(f.chars().count()));
    for f in forms {
        out = out.replace(f.as_str(), "…");
    }
    let natural = e.natural.trim();
    if natural.chars().count() >= 12 {
        let mut cap = natural.chars();
        let capitalised: String = cap.next().map(|c| c.to_uppercase().chain(cap).collect()).unwrap_or_default();
        out = out.replace(natural, "…").replace(&capitalised, "…");
    }
    out
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
            if gives_away(&e.meaning.zh, e) {
                return None;
            }
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
                    if is_han(c) && chars.get(seen) == Some(&c) {
                        seen += 1;
                        if seen - 1 == i {
                            return BLANK.to_string();
                        }
                    }
                    c.to_string()
                })
                .collect();
            // A variant's character in the same place (莫明其妙 for 莫名其妙) would be a second right answer.
            let alt: Vec<char> = e
                .variants
                .iter()
                .map(|v| reading_chars(v))
                .filter(|v| v.len() == chars.len())
                .map(|v| v[i])
                .collect();
            let mut d: Vec<String> = pool
                .iter()
                .flat_map(|o| o.chars())
                .filter(|c| !chars.contains(c) && !alt.contains(c))
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
            finish(kind, e, prompt, Some(masked_english(&ex.en, e)), e.text.clone(), d, rng)
        }
        QuestionKind::Pinyin => {
            if e.length() > 8 || pinyin::syllables(&e.pinyin).len() != e.length() {
                return None;
            }
            let chars = e.chars();
            let d: Vec<String> = (0..12).map(|_| wrong_tones(&e.pinyin, &chars, rng)).collect::<Option<_>>()?;
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
/// through entries before repeating any, and never asking the same kind of
/// question about the same entry twice (a small deck gives fewer questions
/// rather than repeats).
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
    let mut entries: Vec<&Entry> = pool.iter().filter_map(|id| dict.get(id)).collect();
    entries.dedup_by(|a, b| a.id == b.id);
    let mut tried: HashSet<(String, QuestionKind)> = HashSet::new();
    let mut order: Vec<&Entry> = Vec::new();
    let mut out = Vec::new();
    while out.len() < count && !entries.is_empty() {
        if order.is_empty() {
            order = entries.clone();
            rng.shuffle(&mut order);
        }
        let e = order.pop().unwrap();
        let mut ks = kinds.clone();
        rng.shuffle(&mut ks);
        let mut made = None;
        for k in ks {
            if !tried.insert((e.id.clone(), k)) {
                continue;
            }
            made = make_question(dict, e, k, lang, &mut rng);
            if made.is_some() {
                break;
            }
        }
        match made {
            Some(q) => out.push(q),
            // Every kind has been asked (or can't be) for this entry: drop it from the deck.
            None => entries.retain(|x| x.id != e.id),
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
    fn meaning_prompts_do_not_give_the_answer_away() {
        let d = Dictionary::embedded();
        for q in generate(&d, &all_ids(&d), &[QuestionKind::MeaningToIdiom], 40, Lang::En, 5) {
            let e = d.get(&q.entry_id).unwrap();
            assert!(!gives_away(&q.prompt, e), "{} leaks into {}", e.text, q.prompt);
            assert!(!q.prompt.contains('〇'), "masked prompt: {}", q.prompt);
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
        let chars: Vec<char> = "画蛇添足".chars().collect();
        for _ in 0..50 {
            assert_ne!(wrong_tones("huà shé tiān zú", &chars, &mut rng).unwrap(), "huà shé tiān zú");
        }
        // 一 and 不 keep their written tones; the other syllables change.
        let chars: Vec<char> = "一心一意".chars().collect();
        for _ in 0..50 {
            let w = wrong_tones("yī xīn yī yì", &chars, &mut rng).unwrap();
            let s: Vec<&str> = w.split(' ').collect();
            assert_eq!((s[0], s[2]), ("yī", "yī"));
        }
        assert_eq!(wrong_tones("bù yī", &['不', '一'], &mut rng), None);
    }

    #[test]
    fn small_decks_do_not_repeat_questions() {
        let d = Dictionary::embedded();
        let one = vec![d.get("hua-she-tian-zu").unwrap().id.clone()];
        let qs = generate(&d, &one, &[], 30, Lang::En, 9);
        assert!(!qs.is_empty() && qs.len() <= QuestionKind::ALL.len());
        let kinds: HashSet<QuestionKind> = qs.iter().map(|q| q.kind).collect();
        assert_eq!(kinds.len(), qs.len(), "a kind was asked twice about one entry");
    }

    #[test]
    fn near_synonyms_are_not_distractors() {
        let d = Dictionary::embedded();
        let e = d.by_text("三三两两").unwrap();
        let mut rng = Rng::new(3);
        let pool = distractor_entries(&d, e, &mut rng);
        assert!(!pool.iter().any(|o| o.text == "三五成群"));
        // Nor a variant's character in a missing-character question.
        let e = d.by_text("莫名其妙").unwrap();
        for seed in 0..40 {
            if let Some(q) = make_question(&d, e, QuestionKind::MissingChar, Lang::En, &mut Rng::new(seed)) {
                if q.prompt.starts_with("莫＿") {
                    assert!(!q.options.contains(&"明".to_string()), "{q:?}");
                }
            }
        }
    }

    #[test]
    fn cloze_english_hides_the_answer() {
        let d = Dictionary::embedded();
        let e = d.by_text("床前明月光，疑是地上霜").unwrap();
        let q = make_question(&d, e, QuestionKind::SentenceCloze, Lang::En, &mut Rng::new(1));
        if let Some(q) = q {
            let en = q.prompt_en.unwrap();
            assert!(!en.contains("床前") && !en.to_lowercase().contains("moonlight before my bed"), "{en}");
        }
    }
}
