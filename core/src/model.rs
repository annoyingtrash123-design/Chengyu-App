//! Dictionary entry types. These mirror the JSON files in `data/entries/`.

use serde::{Deserialize, Serialize};

/// What kind of expression an entry is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// 成语 — set idioms, usually four characters.
    Chengyu,
    /// 俗语 / 谚语 — proverbs and common sayings.
    Suyu,
    /// 歇后语 — two-part allegorical sayings.
    Xiehouyu,
    /// 惯用语 — colloquial set phrases, usually three characters.
    Guanyongyu,
}

/// 褒义 / 贬义 / 中性.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Sentiment {
    Positive,
    Negative,
    Neutral,
}

/// How formal an expression sounds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Register {
    /// Fine in everyday conversation.
    Casual,
    /// Fine anywhere.
    Neutral,
    /// Mostly writing, speeches and news; can sound stiff in casual talk.
    Formal,
    /// Mainly met in literature and classical texts.
    Literary,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Bilingual {
    pub en: String,
    pub zh: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Example {
    pub zh: String,
    pub en: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Origin {
    /// Classical source, e.g. 《战国策·齐策二》.
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub story: Bilingual,
}

/// One dictionary entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    /// Stable unique id (toneless pinyin slug, e.g. `hua-she-tian-zu`).
    pub id: String,
    pub text: String,
    /// Space-separated pinyin with tone marks, one syllable per character.
    pub pinyin: String,
    pub kind: Kind,
    /// 1 = core (everyday), 2 = common (news / writing), 3 = literary / less common.
    pub frequency: u8,
    pub sentiment: Sentiment,
    pub register: Register,
    #[serde(default)]
    pub themes: Vec<String>,
    /// Word-for-word meaning in English.
    pub literal: String,
    pub meaning: Bilingual,
    #[serde(default)]
    pub examples: Vec<Example>,
    #[serde(default)]
    pub origin: Option<Origin>,
    #[serde(default)]
    pub usage: Bilingual,
    /// Synonyms / antonyms by text. They may or may not exist in the dictionary yet.
    #[serde(default)]
    pub synonyms: Vec<String>,
    #[serde(default)]
    pub antonyms: Vec<String>,
    /// For 歇后语: the lead-in and the punchline.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parts: Option<[String; 2]>,
}

/// Is `c` a CJK ideograph?
pub fn is_han(c: char) -> bool {
    matches!(c as u32, 0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF | 0x20000..=0x2FA1F)
}

/// Han characters of `text`, ignoring punctuation and parenthesised
/// alternative readings: `照舅（旧）` → `照舅`.
pub fn reading_chars(text: &str) -> Vec<char> {
    let mut depth = 0i32;
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
            _ => depth <= 0 && is_han(c),
        })
        .collect()
}

impl Entry {
    /// The Han characters as read aloud, ignoring punctuation and alternates.
    pub fn chars(&self) -> Vec<char> {
        reading_chars(&self.text)
    }

    /// Number of Han characters.
    pub fn length(&self) -> usize {
        self.chars().len()
    }

    /// Repetition pattern such as `AABB`, `ABAC` or `ABCD`.
    /// Only computed for expressions of up to eight characters; longer ones return `None`.
    pub fn structure(&self) -> Option<String> {
        let chars = self.chars();
        if chars.len() > 8 || chars.is_empty() {
            return None;
        }
        let mut seen: Vec<char> = Vec::new();
        let pattern = chars
            .iter()
            .map(|c| {
                let idx = seen.iter().position(|s| s == c).unwrap_or_else(|| {
                    seen.push(*c);
                    seen.len() - 1
                });
                (b'A' + idx as u8) as char
            })
            .collect();
        Some(pattern)
    }

    /// First and last Han characters (used by 成语接龙).
    pub fn first_last(&self) -> Option<(char, char)> {
        let chars = self.chars();
        Some((*chars.first()?, *chars.last()?))
    }
}
