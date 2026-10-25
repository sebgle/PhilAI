# Broader retrieval and useful feedback (matching version 3)

This builds on insight selection from PR #26. It keeps the same fit/insight acceptance gate and adds better candidate discovery, distinct alternate purposes, and private context-specific feedback.

## What changes

Analysis supplies three grounded search descriptions per verified snippet: its situation, its tension, and a relevant perspective. Each searches the existing summary embedding index and a new full-text index of passage ideas, tensions, and perspectives. Reciprocal rank fusion combines channel rankings without comparing text-search scores directly with cosine similarity. A balanced shortlist reserves a candidate from each nonempty channel, then fills remaining slots by fused rank. The comparison model still sees at most ten actual passages per snippet.

The new migration seeds **24 editorial annotations**, matched against exact source quotations already in the database. It never inserts or changes quotation text. Database constraints require real supporting evidence, and a quotation edit automatically clears its previous annotations. The remaining library continues to participate through semantic search. Rich annotations are a separate index, so the existing embedding model and stored vectors are unchanged.

The comparison now identifies a passage as a shared experience, a useful distinction, or another angle, and flags other candidates that make substantially the same point. Alternates must have a different purpose and must not be redundant with selected cards. Identical quotations cannot repeat under different IDs. A single good match is preferable to forced variety.

Readers can respond with “Helped me understand something”, “Related, but did not add much”, or “Misunderstood what I meant”. These ratings are separate from bookmarks and author affinity. They survive regeneration in their own owner-protected table. At most 20 recent feedback contexts are embedded **locally**, alongside current queries. Feedback on the same passage breaks ties only when the contexts are semantically similar. It cannot admit a rejected candidate or outrank a higher fit/insight score. The 0.45 context-similarity threshold is an initial heuristic, not a calibrated confidence score.

Feedback snippets are not sent to the comparison model. They have owner-only row policies and cascade on entry/user deletion. Existing risk filtering, exact quotation verification, and saved references remain intact.

## Apply and test in a preview

1. Apply `supabase/migrations/20261025070000_richer_passage_matching.sql` after the previous migration, in the database used by the preview. Run it once. It includes the 24 annotations, so no separate loader is required for this initial set.
2. Deploy this branch with the existing live matching environment variables. No new API keys are needed.
3. Use fresh synthetic test entries. Check that alternate labels reflect distinct perspectives, and that quality feedback remains selected after reloading.
4. Check Save and Spoke to me independently; quality feedback must not change either.
5. Confirm another account cannot read the first account's feedback. The local PostgreSQL suite already exercises these policies, but the real signed-in preview flow still needs manual verification.

Version 3 invalidates older cached matches on next visit. Generations preserve previous rows and saved references. If preview and production share a database, opening the same entry in versions 2 and 3 will rematch it for each version; use a test account and fresh entries or an isolated preview database. Rolling application code back to version 2 can leave this additive migration in place; version 2 regenerates entries it does not consider current.

To check annotation coverage:

```sql
select count(*) as annotated_passages
from public.passages
where central_idea is not null and profile_evidence is not null;
```

Expect 24 if all reviewed passages exist with unchanged text. A lower count means some source passages are absent or differ; the migration intentionally skips them.

## Checks and measured evidence

- `npm run test:matching`: selection/feedback/retrieval tests, exact-span assertions, and a disposable local PostgreSQL suite. The SQL tests apply both migrations, verify all 24 annotations and search, preserve saved references and rollback behavior, and exercise two-user feedback ownership, invalid writes, restricted RPCs, and connection-purpose persistence.
- `npx tsc --noEmit`, `npm run lint`, and the production build check application integration. Lint retains the two pre-existing library-script warnings.
- `npx tsx scripts/evaluate-retrieval.mts`: an entirely offline controlled benchmark across 911 quality>=3 passages, using 20 authored positive examples and one no-fit example. Expected passages appeared in the top ten in **8/20 single-query searches** and **20/20 expanded searches**. Results are in `docs/retrieval-evaluation-results.json`.

**That benchmark is regression coverage, not an unbiased quality estimate.** Its queries and expected answers were authored around the curated annotations. Production's loaded corpus can differ; it does not evaluate model analysis, explanation quality, negative-case rejection, or signed-in behavior. Unseen examples and real user judgments remain necessary.

One live model comparison completed using local retrieval and a synthetic entry about judging oneself by one selfish choice. It selected Gibran's passage beginning “To measure you by your smallest deed” as a distinction between one action and the whole person. The expected passage was absent from the baseline top ten and present in the expanded shortlist. `docs/richer-match-example.json` records the result. This call included a provider timeout/retry; it is one positive example, not a reliability or latency benchmark. No production journal data was read or written.

The production route still uses one analysis and up to three comparison calls, before provider retries/repairs. Database retrieval increases to at most 18 bounded requests, with six in flight, and local embedding includes up to 20 feedback contexts. A shared 65-second computation deadline leaves room for atomic storage and reads within the 90-second route limit. Monetary cost and production latency have not been benchmarked.

## Expand the annotation library

```sh
# Generates only local, resumable model annotations. Review them first.
npx tsx --env-file=.env.local scripts/library/annotate-insights.mts --limit=20

# Validate a reviewed file without connecting to or writing a database.
npx tsx scripts/library/load-insights.mts --file=work/generated-passage-insights.jsonl

# Explicitly apply only annotation fields to existing exact-text passages.
# Use configuration pointing to the intended preview/staging database.
npx tsx --env-file=.env.local scripts/library/load-insights.mts --file=work/generated-passage-insights.jsonl --apply
```

Generated annotations are marked as model-produced rather than editorial. Loading requires valid IDs, unchanged source text, and a verified evidence excerpt. A supporting excerpt does not by itself prove that an annotation is a good interpretation; review the descriptions before loading them. No mass annotation generation or production load was performed during implementation.

For further evaluation, collect voluntary ratings on new entries and review a sample of accepted and rejected connections. Avoid weakening the acceptance gate simply to fill more cards.
