//! Pinyin helpers: tone stripping, numbered-tone conversion and syllable checks.

const TONED: [(char, char, u8); 24] = [
    ('ā', 'a', 1), ('á', 'a', 2), ('ǎ', 'a', 3), ('à', 'a', 4),
    ('ē', 'e', 1), ('é', 'e', 2), ('ě', 'e', 3), ('è', 'e', 4),
    ('ī', 'i', 1), ('í', 'i', 2), ('ǐ', 'i', 3), ('ì', 'i', 4),
    ('ō', 'o', 1), ('ó', 'o', 2), ('ǒ', 'o', 3), ('ò', 'o', 4),
    ('ū', 'u', 1), ('ú', 'u', 2), ('ǔ', 'u', 3), ('ù', 'u', 4),
    ('ǖ', 'ü', 1), ('ǘ', 'ü', 2), ('ǚ', 'ü', 3), ('ǜ', 'ü', 4),
];

/// Split a toned vowel into (base vowel, tone 1-4). Plain characters return `None`.
fn decompose(c: char) -> Option<(char, u8)> {
    TONED.iter().find(|(t, _, _)| *t == c).map(|(_, b, n)| (*b, *n))
}

fn compose(base: char, tone: u8) -> char {
    TONED
        .iter()
        .find(|(_, b, n)| *b == base && *n == tone)
        .map(|(t, _, _)| *t)
        .unwrap_or(base)
}

/// Remove tone marks: `huà shé` → `hua she`. `ü` becomes `v` so it can be typed.
pub fn strip_tones(s: &str) -> String {
    s.chars()
        .map(|c| decompose(c).map(|(b, _)| b).unwrap_or(c))
        .map(|c| if c == 'ü' { 'v' } else { c })
        .collect()
}

/// Tone (1-4) of a single syllable, or 0 for neutral tone / no mark.
pub fn tone_of(syllable: &str) -> u8 {
    syllable.chars().find_map(decompose).map(|(_, t)| t).unwrap_or(0)
}

/// Put tone `tone` (1-4, anything else = neutral) on a plain syllable
/// following the standard placement rules (a/e first, then the o of "ou",
/// otherwise the last vowel).
pub fn apply_tone(syllable: &str, tone: u8) -> String {
    let plain: String = strip_tones(syllable).replace('v', "ü");
    if !(1..=4).contains(&tone) {
        return plain;
    }
    let chars: Vec<char> = plain.chars().collect();
    let target = chars
        .iter()
        .position(|c| *c == 'a' || *c == 'e')
        .or_else(|| plain.find("ou").map(|byte| plain[..byte].chars().count()))
        .or_else(|| chars.iter().rposition(|c| "iouü".contains(*c)));
    match target {
        Some(i) => chars
            .iter()
            .enumerate()
            .map(|(j, c)| if j == i { compose(*c, tone) } else { *c })
            .collect(),
        None => plain,
    }
}

/// Convert numbered pinyin (`hua4 she2`, `lv4`) to tone marks (`huà shé`, `lǜ`).
/// Text without digits is returned unchanged.
pub fn numbered_to_marked(s: &str) -> String {
    let mut out = String::new();
    let mut syllable = String::new();
    for c in s.chars() {
        if c.is_ascii_alphabetic() || c == 'ü' {
            syllable.push(c);
        } else if let Some(d) = c.to_digit(10).filter(|_| !syllable.is_empty()) {
            out.push_str(&apply_tone(&syllable, d as u8));
            syllable.clear();
        } else {
            out.push_str(&syllable);
            syllable.clear();
            out.push(c);
        }
    }
    out.push_str(&syllable);
    out
}

/// Lowercase, convert numbered tones, drop everything but letters.
/// `Huà shé-tiān zú` → `huàshétiānzú`.
pub fn compact(s: &str) -> String {
    numbered_to_marked(&s.to_lowercase())
        .chars()
        .filter(|c| c.is_alphabetic())
        .collect()
}

/// Typed "v" stands for "ü"; after j/q/x/y the ü is written as plain "u" in pinyin,
/// so `jv` → `ju` (举 jǔ), while `lv` stays `lü`-equivalent (`lv` matches `lǜ`'s plain form).
pub fn normalize_v(s: &str) -> String {
    let lower = s.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    chars
        .iter()
        .enumerate()
        .map(|(i, &c)| {
            if c == 'v' && i > 0 && "jqxy".contains(chars[i - 1]) {
                'u'
            } else {
                c
            }
        })
        .collect()
}

/// Compare compact pinyin character by character. A plain vowel in the query matches the
/// same vowel with any tone; a toned vowel must match exactly. `v` matches `ü`.
pub fn tone_tolerant_eq(query: &[char], hay: &[char]) -> bool {
    query.len() == hay.len()
        && query.iter().zip(hay).all(|(&q, &h)| {
            if q == h {
                return true;
            }
            let base_h = decompose(h).map(|(b, _)| b).unwrap_or(h);
            match q {
                'v' => base_h == 'ü',
                _ if decompose(q).is_none() => base_h == q,
                _ => false,
            }
        })
}

/// Does the text contain any tone marks?
pub fn has_tone_marks(s: &str) -> bool {
    s.chars().any(|c| decompose(c).is_some())
}

/// Syllables of a pinyin string, ignoring punctuation and parenthesised readings.
pub fn syllables(s: &str) -> Vec<String> {
    let mut depth = 0;
    let mut cleaned = String::new();
    for c in s.chars() {
        match c {
            '(' | '（' => depth += 1,
            ')' | '）' => depth -= 1,
            _ if depth > 0 => {}
            _ if c.is_alphabetic() => cleaned.push(c),
            _ => cleaned.push(' '),
        }
    }
    cleaned.split_whitespace().map(|s| s.to_lowercase()).collect()
}

/// First letter of each syllable: `huà shé tiān zú` → `hstz`.
pub fn initials(s: &str) -> String {
    syllables(s)
        .iter()
        .filter_map(|syl| strip_tones(syl).chars().next())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_tones() {
        assert_eq!(strip_tones("huà shé tiān zú"), "hua she tian zu");
        assert_eq!(strip_tones("lǜ"), "lv");
    }

    #[test]
    fn tone_of_syllables() {
        assert_eq!(tone_of("huà"), 4);
        assert_eq!(tone_of("ma"), 0);
        assert_eq!(tone_of("lǚ"), 3);
    }

    #[test]
    fn applies_tones_with_placement_rules() {
        assert_eq!(apply_tone("hua", 4), "huà");
        assert_eq!(apply_tone("gou", 3), "gǒu");
        assert_eq!(apply_tone("liu", 2), "liú");
        assert_eq!(apply_tone("gui", 4), "guì");
        assert_eq!(apply_tone("xue", 2), "xué");
        assert_eq!(apply_tone("lv", 4), "lǜ");
        assert_eq!(apply_tone("ma", 5), "ma");
        assert_eq!(apply_tone("huà", 1), "huā");
    }

    #[test]
    fn converts_numbered_pinyin() {
        assert_eq!(numbered_to_marked("hua4 she2 tian1 zu2"), "huà shé tiān zú");
        assert_eq!(numbered_to_marked("hua4she2"), "huàshé");
        assert_eq!(numbered_to_marked("hua she"), "hua she");
    }

    #[test]
    fn compacts_queries() {
        assert_eq!(compact("Huà Shé"), "huàshé");
        assert_eq!(compact("hua4 she2"), "huàshé");
    }

    #[test]
    fn splits_syllables_ignoring_punctuation_and_alternates() {
        assert_eq!(
            syllables("wài shēng dǎ dēng lóng —— zhào jiù (jiù)"),
            vec!["wài", "shēng", "dǎ", "dēng", "lóng", "zhào", "jiù"]
        );
        assert_eq!(syllables("chī yī qiàn, zhǎng yī zhì").len(), 6);
    }

    #[test]
    fn tone_tolerant_matching() {
        let q: Vec<char> = "huàshe".chars().collect();
        let h: Vec<char> = "huàshé".chars().collect();
        assert!(tone_tolerant_eq(&q, &h));
        let wrong: Vec<char> = "huāshe".chars().collect();
        assert!(!tone_tolerant_eq(&wrong, &h));
        assert_eq!(normalize_v("yi jv"), "yi ju");
        assert_eq!(normalize_v("lv"), "lv");
        let lv: Vec<char> = "lv".chars().collect();
        let lu: Vec<char> = "lǜ".chars().collect();
        assert!(tone_tolerant_eq(&lv, &lu));
    }

    #[test]
    fn computes_initials() {
        assert_eq!(initials("huà shé tiān zú"), "hstz");
    }
}
