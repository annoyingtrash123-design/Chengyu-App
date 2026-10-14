# Chengyu App — working rules

Read `docs/content-guide.md` before writing entries. Key standing rules from the owner:

- **Labels, not themes.** The `themes` field is shown as "Labels" (标签). Tag every label that applies;
  add new labels to `data/themes.json` when a recurring type of expression needs one, and back-fill
  them onto existing entries. Applies to all three content phases.
- **Frequency tiers:** ★★★ Core · ★★ Common · ★ Uncommon (not "Literary").
- **Variants** are one entry: headword = most common form, others in `variants`; never list a variant
  as a synonym/antonym, and never list two forms of one expression in the same list.
  Run `python3 scripts/lint_variants.py` on each batch.
- **Origins only when well attested**; otherwise leave `origin` out.
- Content phases: (1) the owner's master list, (2) top-1000 THUOCL chengyu, (3) expand to 5,000.
- Batches: `python3 scripts/add_batch.py drafts.json data/entries/p1-NNN.json`, then
  `cargo test -p chengyu-core`, then commit and push (Pages deploys automatically).
