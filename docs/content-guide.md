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

## Labels (stored as `themes` in the data)

In the app these are called **labels** (标签), not themes. Treat them as tags:

- An entry can carry as many labels as fit — tag every label that genuinely applies, not just one or two.
- Labels have two levels: broad labels (no `group`) contain detailed labels (with `group`). Filtering by a
  broad label also finds everything tagged with its detailed labels.
- **Add new labels freely** (in `data/themes.json`) whenever a recurring type of expression has no good label
  yet — e.g. origin types (Three Kingdoms stories, Buddhist sayings, the Thirty-Six Stratagems), uses
  (wedding blessings, New Year greetings, self-deprecating phrases) or subjects.
- **Back-fill**: when a new label is added, go back and add it to existing entries it applies to.
- `python3 scripts/backfill_labels.py` adds origin labels (Confucian/Daoist classics, Buddhist origin,
  historical records, Three Kingdoms, Thirty-Six Stratagems, myths, famous poems & prose) from
  `origin.source`, and usage labels (festive greetings, wedding wishes, polite & humble phrases, essay
  favourites) from usage notes. Run it after every batch; extend its rules or `MANUAL` list when adding
  a label, so old entries get it too.
- This rule applies to phase 1, 2 and 3 alike.

## Frequency tiers

★★★ Core (核心) · ★★ Common (常用) · ★ Uncommon (少见). Tier 3 means rarely used, not "literary" —
register (casual / neutral / formal / literary) is a separate field.

## Conventions

- **Pinyin**: citation tones, not tone sandhi (一举两得 → `yī jǔ liǎng dé`). The usage note
  may mention sandhi, correctly: 一 is said **yí before a 4th tone** (一路 yílù) and **yì before
  1st/2nd/3rd tones** (一举 yìjǔ); 不 is said **bú only before a 4th tone** (不要 búyào). Syllables are separated by spaces; punctuation such as
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
- **Variants** (塞翁失马焉知非福 for 塞翁失马, 青山绿水 for 绿水青山, 名符其实 for 名副其实) are one entry, never two.
  The headword is the most common, standard form; the others go in `variants`.
  - Searching a variant (characters, or pinyin when it reuses the main form's characters) finds the entry,
    and a synonym/antonym written in a variant form links to the main entry.
  - Never list an entry's own variant as its synonym or antonym, and never list two variant forms of
    the same expression in one synonym/antonym list — pick the main form.
  - Count as variants: other characters for the same word (蒂/柢, 缭/撩), recognised word-order swaps
    with the same meaning (绿水青山/青山绿水), and full/short forms (塞翁失马/…焉知非福).
    Distinct expressions with a related form stay separate entries (翻天覆地 vs 天翻地覆, 争分夺秒 vs 分秒必争).
  - `cargo test` fails if a form belongs to two entries or an entry lists its own variant as a synonym.
  - Run `python3 scripts/lint_variants.py` on each batch: it flags likely variant pairs for review (add confirmed-distinct pairs to its `DISTINCT` list).
- **Origin**: only include a story when the source is well attested. Mark folk
  explanations as such (see 乱七八糟).

## Plan (target: 5,000 entries, no duplicates)

1. ✅ App infrastructure + 20 sample entries for review.
2. **Phase 1, the user's lists:** all 1,455 items in `data/queue/phase1.json`
   (= `data/master_list.json`), most common first (THUOCL rank; unranked after).
3. **Phase 2, the 1,000 most common chengyu:** the 739 of THUOCL's top 1,000 not already in
   phase 1 (`data/queue/phase2.json`), most common first.
4. **Phase 3, broad coverage to 5,000 (~2,800 entries):** popular and common first:
   - ~1,900 more chengyu, continuing down THUOCL (only those confirmed by the Xinhua idiom
     dictionary; `data/queue/phase3-chengyu.json`)
   - ~350 俗语/谚语, ~250 歇后语 (common ones from the Xinhua 歇后语 list), ~150 惯用语,
     ~100 名句 and ~50 more 四字词语 (narrative/descriptive, cultural, common news phrases)
   - linked synonyms/antonyms that are still missing are pulled forward as they come up

Entries are written in batches, each batch validated (`cargo test`) and published.
