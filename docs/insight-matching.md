# Insight-based passage matching

The matcher now asks what a passage helps the writer notice, rather than selecting a passage by mood and explaining it afterward.

## Behavior

- Analysis preserves exact journal spans and adds a tentative, line-specific interpretation.
- Each snippet plus its interpretation retrieves 30 candidates using the existing embeddings and library. Metadata scores shortlist 10, with author preference contributing at most 0.01.
- One structured comparison per snippet evaluates the actual passage texts. Fit and insight each use a 0–3 rubric. Both must be at least 2; standalone readability, an exact supporting excerpt, and a substantive explanation are also required. These scores are judgments, not calibrated probabilities.
- Accepted passages receive a two-sentence explanation of their connection and perspective. Highlighted phrases still pass exact span verification.
- Up to three primaries and two alternates per primary are returned. Exact passages cannot repeat; an author may repeat. Distinct perspective descriptions are preferred for alternates, although semantic redundancy still needs human review.
- Weak candidate sets produce a completed empty result. Failed analysis/comparison produces a retryable 503, without storing an unreviewed match. Whole-entry matching is used when journal spans cannot be verified and goes through the same quality gate.
- The existing risk flag and excluded themes apply before comparison and again before acceptance. Known risk warnings remain visible while rematching or on failure.

## Storage and rollout

Apply `supabase/migrations/20261025060000_insight_matches.sql` **before deploying this code**. No new environment variables or provider changes are required.

The migration adds a matching version, active generation, and whole-entry flag to entries, plus a generation on matches. A service-role-only function inserts a complete generation and activates it in one transaction. It checks the owner and original entry text under a row lock. Failed inserts roll back; old rows, feedback, and saved library references remain intact. Feedback for repeated passages is carried forward. Historical rows are retained until the entry is deleted.

Both the API and server-rendered entry page check version 2. Older entries regenerate individually when opened. There is no bulk regeneration. A successful empty result has an active generation, so revisiting it does not repeatedly call the model. Existing author feedback remains available as a preference signal.

To roll back application code after applying the migration, leave the additive schema in place. The old reader does not understand generations and would display history: restore its match reads to filter the active generation before serving saved entries. Do not drop historical matches to roll back.

## Verification

Run the offline suite without credentials:

```sh
npm run test:matching
npx tsc --noEmit
npm run lint
npm run build
```

The matching suite includes 12 tests for acceptance/rejection, evidence, IDs, duplicates, risk filtering, author repetition, cache versioning, snippet verification, nearby context, and mocked analysis/comparison calls. It also runs the existing quotation assertions and a real local PostgreSQL transaction test using PGlite. The database test uses a minimal disposable schema to check migration syntax, saved-reference/feedback preservation, rollback after a partial insert, owner/text checks, empty generations, and function permissions. It does not replace a Supabase staging integration test.

Twelve synthetic journal fixtures are in `shared/match-evaluation.json`. To compare primary matches against the previous ranking and explanation behavior, using only passage-library reads:

```sh
npx tsx --env-file=.env.local scripts/evaluate-matches.mts --limit=12 --out=work/match-evaluation.json
npx tsx --env-file=.env.local scripts/evaluate-matches.mts --case=contentment --insight-only
```

Create the output directory first. Both paths share the updated analysis so snippet selection stays comparable; this is not a replay of the old analysis prompt. The baseline generates primary explanations only, not all original alternates. Provider retries and JSON repairs can add requests beyond the nominal call count. `scripts/test-match.mts` now runs the insight path by default; `--legacy` retains its older path.

## Observed live results (2026-10-25)

`docs/matching-evaluation-results.json` records five read-only attempts across four synthetic fixtures. One comparison completed; four attempts ended in model timeouts. No production records were changed.

For the completed grief/relief entry, the old primary matcher returned two passages. One was the fragment “Thus I ever lost my children without solace, and got them amidst fresh grief.....'”, paired with an explanation about guilt over telling the truth. The passage does not establish that interpretation. The new matcher returned no accepted passages for either snippet. This demonstrates abstention rather than a better positive recommendation.

The shared analysis took 15.8 seconds, the baseline primary path 12.2 seconds, and the new path 37.3 seconds, including retrieval and provider retry time. Those measurements are one example, not a latency benchmark. The new production path uses one analysis plus up to three comparison calls, in place of analysis plus up to nine phrase/explanation calls. Each comparison includes more passage text, so fewer calls do not establish lower cost. Token costs were not measured. Model calls share an absolute deadline, leaving time for storage within the route's 90-second limit.

**Limitations:** live positive-match quality, the full 12-case evaluation, and a complete signed-in Supabase flow remain unverified. The acceptance rubric may need tuning once the provider is reliable. If comparison repeatedly rejects the retrieved library, inspect candidate coverage and passage annotations before weakening the gate. The completed example suggests corpus coverage may be a limitation, but is insufficient evidence to conclude that broadly.
