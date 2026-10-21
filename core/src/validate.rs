//! Data checks run by `cargo test` on every build, so a bad entry never ships.

use std::collections::HashSet;

use crate::dictionary::Dictionary;
use crate::model::{reading_chars, Entry, Kind};
use crate::pinyin;

/// Characters that are often read in the neutral tone and may lack a tone mark.
const NEUTRAL_OK: &str = "的了着过子么们吗呢吧啊甥笼儿卜芦狸巴虎得地头裳候睛尚腐驼神量袱袋股姥蟆婆妈爷奶哥姐弟妹叔舅娘爹乎服伙计实气思意亮快和匠拉家事傅公刀势匙友叭听呼咐咕唤喝嗦场婿宜帚当彩息情戚户掌朵毛涂烦爸甲盖眼碜稼窝笆索罕腾膊花识诉话道酬闹面食";

#[derive(Debug, Default)]
pub struct Report {
    /// Problems that must be fixed.
    pub errors: Vec<String>,
    /// Synonyms / antonyms that are not in the dictionary yet (a to-do list, not an error).
    pub missing_links: Vec<String>,
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
    for t in &dict.themes {
        match &t.group {
            Some(g) if !dict.themes.iter().any(|x| &x.id == g && x.group.is_none()) => {
                r.errors.push(format!("theme `{}`: group `{g}` is not a broad theme", t.id))
            }
            _ => {}
        }
    }
    let mut ids = HashSet::new();
    let mut texts = HashSet::new();
    // Every headword and variant must be unique across the whole dictionary,
    // so one form never belongs to two entries.
    let mut forms: std::collections::HashMap<&str, &str> = std::collections::HashMap::new();
    for e in dict.entries() {
        for f in std::iter::once(&e.text).chain(&e.variants) {
            if let Some(other) = forms.insert(f, &e.text) {
                if other != e.text || f != &e.text {
                    r.errors.push(format!(
                        "{}: form `{f}` also belongs to {other} (merge variants into one entry)",
                        e.text
                    ));
                }
            }
        }
    }

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
        // House rule: no entries shorter than four characters.
        if e.length() < 4 {
            err.push(format!("{t}: entries must be at least four characters long"));
        }
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
            ("natural", &e.natural),
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
                && !e.variants.iter().any(|v| ex.zh.contains(v.as_str()))
                && !(e.kind == Kind::Guanyongyu && is_subsequence(&core, &ex.zh))
            {
                err.push(format!("{t}: example does not contain the expression: {}", ex.zh));
            }
        }
        if e.kind == Kind::Mingju && e.origin.as_ref().is_none_or(|o| o.source.trim().is_empty()) {
            err.push(format!("{t}: 名句 must give its source (origin.source)"));
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
        for v in &e.variants {
            if v == t || v.trim().is_empty() {
                err.push(format!("{t}: bad variant `{v}`"));
            }
            if e.synonyms.contains(v) || e.antonyms.contains(v) {
                err.push(format!("{t}: lists its own variant {v} as a synonym/antonym (keep it in `variants` only)"));
            }
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
    fn variants_must_be_unique_and_not_synonyms() {
        let mut entries = Dictionary::embedded().entries().to_vec();
        let a = entries.iter().position(|e| e.text == "绿水青山").unwrap();
        let b = entries.iter().position(|e| e.text == "莫名其妙").unwrap();
        entries[a].synonyms.push("青山绿水".into());
        entries[b].variants.push("青山绿水".into());
        let themes = Dictionary::embedded().themes.clone();
        let r = check(&Dictionary::new(entries, themes));
        assert!(r.errors.iter().any(|e| e.contains("own variant")), "{:?}", r.errors);
        assert!(r.errors.iter().any(|e| e.contains("also belongs to")), "{:?}", r.errors);
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
