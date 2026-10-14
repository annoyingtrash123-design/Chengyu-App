//! Data checks run by `cargo test` on every build, so a bad entry never ships.

use std::collections::HashSet;

use crate::dictionary::Dictionary;
use crate::model::{is_han, Entry, Kind};
use crate::pinyin;

/// Characters that are often read in the neutral tone and may lack a tone mark.
const NEUTRAL_OK: &str = "的了着过子么们吗呢吧啊头个儿得地里上下来去巴气甥笼";

#[derive(Debug, Default)]
pub struct Report {
    /// Problems that must be fixed.
    pub errors: Vec<String>,
    /// Synonyms / antonyms that are not in the dictionary yet (a to-do list, not an error).
    pub missing_links: Vec<String>,
}

/// Han characters with parenthesised alternative readings removed:
/// `照舅（旧）` → `照舅`.
fn reading_chars(text: &str) -> Vec<char> {
    let mut depth = 0;
    text.chars()
        .filter(|&c| match c {
            '(' | '（' => {
                depth += 1;
                false
            }
            ')' | '）' => {
                depth -= 1;
                false
            }
            _ => depth == 0 && is_han(c),
        })
        .collect()
}

/// Are all characters of `needle` in `hay`, in order? Allows for separable
/// 惯用语 such as 拍马屁 → 拍老板的马屁.
fn is_subsequence(needle: &str, hay: &str) -> bool {
    let mut it = hay.chars();
    needle.chars().all(|c| it.any(|h| h == c))
}

fn check_pinyin(e: &Entry, errors: &mut Vec<String>) {
    let chars = reading_chars(&e.text);
    let syls = pinyin::syllables(&e.pinyin);
    if chars.len() != syls.len() {
        errors.push(format!(
            "{}: {} characters but {} pinyin syllables ({})",
            e.text,
            chars.len(),
            syls.len(),
            e.pinyin
        ));
        return;
    }
    for (c, s) in chars.iter().zip(&syls) {
        let marks = s.chars().filter(|ch| pinyin::has_tone_marks(&ch.to_string())).count();
        if marks > 1 {
            errors.push(format!("{}: syllable `{s}` has more than one tone mark", e.text));
        }
        if marks == 0 && !NEUTRAL_OK.contains(*c) {
            errors.push(format!("{}: `{c}` ({s}) is missing a tone mark", e.text));
        }
        if !s.chars().all(|ch| ch.is_alphabetic()) {
            errors.push(format!("{}: odd syllable `{s}`", e.text));
        }
    }
}

pub fn check(dict: &Dictionary) -> Report {
    let mut r = Report::default();
    let themes: HashSet<&str> = dict.themes.iter().map(|t| t.id.as_str()).collect();
    let mut ids = HashSet::new();
    let mut texts = HashSet::new();

    for e in dict.entries() {
        let err = &mut r.errors;
        let t = &e.text;
        if !ids.insert(&e.id) {
            err.push(format!("{t}: duplicate id `{}`", e.id));
        }
        if !texts.insert(t) {
            err.push(format!("{t}: duplicate entry"));
        }
        if e.id.is_empty() || !e.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            err.push(format!("{t}: id `{}` must be lowercase ascii letters, digits and dashes", e.id));
        }
        check_pinyin(e, err);
        if !(1..=3).contains(&e.frequency) {
            err.push(format!("{t}: frequency must be 1, 2 or 3"));
        }
        if e.themes.is_empty() {
            err.push(format!("{t}: needs at least one theme"));
        }
        for th in &e.themes {
            if !themes.contains(th.as_str()) {
                err.push(format!("{t}: unknown theme `{th}` (add it to data/themes.json)"));
            }
        }
        for (name, value) in [
            ("literal", &e.literal),
            ("meaning.en", &e.meaning.en),
            ("meaning.zh", &e.meaning.zh),
            ("usage.en", &e.usage.en),
            ("usage.zh", &e.usage.zh),
        ] {
            if value.trim().is_empty() {
                err.push(format!("{t}: `{name}` is empty"));
            }
        }
        if e.examples.is_empty() {
            err.push(format!("{t}: needs at least one example"));
        }
        let core: String = match &e.parts {
            Some([lead, _]) => lead.clone(),
            None => t.clone(),
        };
        for ex in &e.examples {
            if ex.zh.trim().is_empty() || ex.en.trim().is_empty() {
                err.push(format!("{t}: example missing Chinese or English"));
            } else if !ex.zh.contains(core.as_str())
                && !(e.kind == Kind::Guanyongyu && is_subsequence(&core, &ex.zh))
            {
                err.push(format!("{t}: example does not contain the expression: {}", ex.zh));
            }
        }
        if let Some(o) = &e.origin {
            if o.story.en.trim().is_empty() || o.story.zh.trim().is_empty() {
                err.push(format!("{t}: origin story needs English and Chinese"));
            }
        }
        match (&e.kind, &e.parts) {
            (Kind::Xiehouyu, None) => err.push(format!("{t}: 歇后语 needs `parts`")),
            (Kind::Xiehouyu, Some([a, b])) if *t != format!("{a}——{b}") => {
                err.push(format!("{t}: text must be parts joined by ——"))
            }
            (k, Some(_)) if *k != Kind::Xiehouyu => err.push(format!("{t}: only 歇后语 have `parts`")),
            _ => {}
        }
        if e.synonyms.contains(t) || e.antonyms.contains(t) {
            err.push(format!("{t}: lists itself as a synonym/antonym"));
        }
        if e.synonyms.iter().any(|s| e.antonyms.contains(s)) {
            err.push(format!("{t}: same expression is both synonym and antonym"));
        }
        for link in e.synonyms.iter().chain(&e.antonyms) {
            if dict.by_text(link).is_none() {
                r.missing_links.push(link.clone());
            }
        }
    }
    r.missing_links.sort();
    r.missing_links.dedup();
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_data_is_valid() {
        let r = check(&Dictionary::embedded());
        assert!(r.errors.is_empty(), "data errors:\n{}", r.errors.join("\n"));
    }

    #[test]
    fn reading_chars_skip_alternates() {
        assert_eq!(reading_chars("外甥打灯笼——照舅（旧）").len(), 7);
    }

    #[test]
    fn catches_bad_entries() {
        let mut d: Vec<Entry> = Dictionary::embedded().entries().to_vec();
        let mut bad = d[0].clone();
        bad.id = "Bad ID".into();
        bad.pinyin = "hua she tian".into();
        bad.themes = vec!["nonsense".into()];
        bad.examples.clear();
        d.push(bad);
        let r = check(&Dictionary::new(d, Dictionary::embedded().themes));
        let all = r.errors.join("\n");
        for needle in ["duplicate entry", "id `Bad ID`", "pinyin syllables", "unknown theme", "needs at least one example"] {
            assert!(all.contains(needle), "missing `{needle}` in:\n{all}");
        }
    }
}
