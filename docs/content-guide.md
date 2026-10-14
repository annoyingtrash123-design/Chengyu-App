# Content guide

Every entry is a JSON object in one of the arrays in `data/entries/`.

```jsonc
{
  "id": "hua-she-tian-zu",          // toneless pinyin slug, unique, a-z 0-9 and dashes
  "text": "画蛇添足",
  "pinyin": "huà shé tiān zú",      // one syllable per character, tone marks on every syllable
  "kind": "chengyu",                 // chengyu | suyu | xiehouyu | guanyongyu | phrase (四字词语) | mingju (名句)
  "frequency": 1,                    // 1 core (everyday), 2 common (news/writing), 3 literary
  "sentiment": "negative",           // positive (褒义) | negative (贬义) | neutral (中性)
  "register": "neutral",             // casual | neutral | formal | literary
  "themes": ["animals", "unintended-results"], // broad or detailed ids from data/themes.json
  "literal": "draw · snake · add · foot",       // word-by-word gloss
  "natural": "Drawing a snake and adding feet to it", // the image in natural English
  "meaning": { "en": "…", "zh": "…" },          // what it means
  "equivalents": ["gild the lily"],             // English idioms, ideally with a different image
  "examples": [{ "zh": "…画蛇添足…", "en": "…" }],   // at least one; must contain the expression
  "origin": {                        // optional
    "source": "《战国策·齐策二》",
    "story": { "en": "…", "zh": "…" }
  },
  "usage": { "en": "…", "zh": "…" }, // grammar role, tone, common pitfalls, register warnings
  "synonyms": ["多此一举"],          // by text; they link up automatically once added
  "antonyms": ["恰到好处"],
  "parts": ["外甥打灯笼", "照舅（旧）"], // 歇后语 only: text must be parts[0] + "——" + parts[1]
  "modern": "borrowed"               // optional: "modern" (recent coinage) or "borrowed" (from another language)
}
```

## Translations

Every entry has three layers of English: a **literal** word-by-word gloss, a **natural**
rendering of the image, and the **meaning**, plus **equivalents**: real English idioms with
the same sense, especially ones using a different metaphor (对牛弹琴 → *cast pearls before
swine*).

## Themes

Two levels. Twenty broad themes (no `group`) each contain detailed themes (with `group`),
mostly taken from the thematic master list. Tag entries with the most specific themes that
fit; filtering by a broad theme also finds everything tagged with its detailed themes.

## Conventions

- **Pinyin**: citation tones, not tone sandhi (一举两得 → `yī jǔ liǎng dé`; the usage note
  can mention that 一 is said yí). Syllables are separated by spaces; punctuation such as
  `,` and `——` is allowed. Neutral-tone syllables (e.g. 外甥 `wài sheng`) may be written
  without a mark only for characters listed in `NEUTRAL_OK` in `core/src/validate.rs`.
- **Alternative readings** in brackets (照舅（旧）) are written in pinyin in brackets too
  (`zhào jiù (jiù)`) and are not counted as characters.
- **Separable 惯用语** (拍马屁 → 拍老板的马屁) may appear split in examples.
- **Frequency**: aim for ~500 entries at level 1 overall (the "Core 500" deck takes the
  most common first).
- **四字词语 (`phrase`)**: common set phrases that aren't classic idioms (互利共赢, 细致入微)
  and cultural terms (梅兰竹菊, 笔墨纸砚). In scope: narrative & descriptive phrases
  (连夜追赶, 灯火通明), cultural sets with a short cultural note, and common news/formal
  phrases (register `formal`). Out of scope: connectors (也就是说) and AABB reduplications.
  See docs/phrase-candidates.md.
- **名句 (`mingju`)**: famous lines from poems and classics, stored as the full line or
  couplet (工欲善其事，必先利其器). `origin.source` must name the work and author; the usage
  note says when people quote it today.
- **歇后语**: always store the full saying (丈二和尚——摸不着头脑). Searching either half finds
  it; the usage note says that people often say only the first half.
- **AABB**: only idiomatic set expressions (战战兢兢, 兢兢业业, 三三两两), not plain doubled
  adjectives (干干净净).
- **Modern & borrowed** (蝴蝶效应, 豆腐渣工程): set `modern` and say so in the usage note and
  explanation (when and where it came from).
- **Colloquial words** from the lists (差不多, 大概其, 八九不离十) go in as 惯用语.
- **Examples**: vary the situations across entries: everyday life, work & business, school &
  essays, news & literature.
- **Variants** (塞翁失马焉知非福 for 塞翁失马) are one entry, never two.
- **Origin**: only include a story when the source is well attested. Mark folk
  explanations as such (see 乱七八糟).

## Plan

1. ✅ App infrastructure + 20 sample entries for review.
2. All 1,455 items from the user's two lists (`data/master_list.json`), most common first
   (sorted by THUOCL rank; unranked items after).
3. Linked synonyms/antonyms and the most frequent chengyu missing from the lists.
4. Additional high-frequency chengyu (THUOCL ranking), 俗语/谚语, 歇后语 and 惯用语 — maximum
   useful coverage, no fixed cap.
5. 四字词语: as many useful ones as possible from the agreed categories.
