# Content guide

Every entry is a JSON object in one of the arrays in `data/entries/`.

```jsonc
{
  "id": "hua-she-tian-zu",          // toneless pinyin slug, unique, a-z 0-9 and dashes
  "text": "画蛇添足",
  "pinyin": "huà shé tiān zú",      // one syllable per character, tone marks on every syllable
  "kind": "chengyu",                 // chengyu | suyu | xiehouyu | guanyongyu | phrase (四字词语)
  "frequency": 1,                    // 1 core (everyday), 2 common (news/writing), 3 literary
  "sentiment": "negative",           // positive (褒义) | negative (贬义) | neutral (中性)
  "register": "neutral",             // casual | neutral | formal | literary
  "themes": ["animals", "stories"],  // ids from data/themes.json, any number
  "literal": "Draw a snake and add feet",
  "meaning": { "en": "…", "zh": "…" },
  "examples": [{ "zh": "…画蛇添足…", "en": "…" }],   // at least one; must contain the expression
  "origin": {                        // optional
    "source": "《战国策·齐策二》",
    "story": { "en": "…", "zh": "…" }
  },
  "usage": { "en": "…", "zh": "…" }, // grammar role, tone, common pitfalls, register warnings
  "synonyms": ["多此一举"],          // by text; they link up automatically once added
  "antonyms": ["恰到好处"],
  "parts": ["外甥打灯笼", "照舅（旧）"] // 歇后语 only: text must be parts[0] + "——" + parts[1]
}
```

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
- **Origin**: only include a story when the source is well attested. Mark folk
  explanations as such (see 乱七八糟).

## Plan

1. ✅ App infrastructure + 20 sample entries for review.
2. Linked expressions that samples already refer to (`python3 scripts/backlog.py`).
3. The rest of the original master list, most common first.
4. Additional high-frequency chengyu (THUOCL ranking), 俗语/谚语, 歇后语 and 惯用语 — maximum
   useful coverage, no fixed cap.
5. 四字词语: as many useful ones as possible from the agreed categories.
