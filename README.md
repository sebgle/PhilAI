# PhilAI

An anonymous journal that links the lines you write to passages in public-domain literature, and lets you talk about them with strangers in theme forums.

This README records the **Step 0 contract**: the decisions both build tracks depend on. To change any of it, update the files listed below in the same commit and tell the other person.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Muse keys
npm run dev
```

Login is email + password. In the Supabase dashboard, under **Authentication > Sign In / Providers > Email**, turn **off** "Confirm email". Supabase's built-in mailer won't deliver to arbitrary addresses without custom SMTP. After signing up, the home page shows your random handle.

## Workflow

- One short branch per task in [docs/TASKS.md](docs/TASKS.md), named `seb/<task>-<slug>` or `<teammate>/<task>-<slug>`, e.g. `seb/s2-write-screen`, `<teammate>/t4-tagging`.
- Open a PR into `main`. Vercel posts a preview URL on each PR. Merge once it builds and works on the preview.
- Keep `main` deployable. Pull `main` before starting each new task.
- Contract changes (`src/lib/contract.ts`, `shared/mock_*`) go in their own PR, and the other person approves it.

## Deploy

Production is Vercel, built from `main`. Every PR gets a preview deploy.

1. On vercel.com, choose **Add New → Project** and import `sebgle/PhilAI`. The defaults are fine: framework Next.js, root `./`.
2. Add the environment variables from `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and the Muse keys once you have them) for Production and Preview.
3. Deploy. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to the production URL. Add `https://*.vercel.app/**` under Redirect URLs so preview deploys work.

## Decisions (Step 0)

| Decision | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind |
| Backend | Supabase: Postgres, pgvector, Auth (email + password), RLS |
| Anonymity | Anonymous **to other users**, not to the server. The email is used only for login and is never shown or returned by any API. Other users see only a handle or alias |
| Text AI | **Muse Spark** for entry analysis, passage tagging, echoing phrase, "why this fits", scrub and moderate |
| Voice | **Muse voice transcription**. Audio is transcribed, then discarded |
| Forums | One per theme, 16 themes (below). Authors are a tag plus an author page |
| Identity | Random handle per account (owner-only). **Fresh alias per thread** in forums |
| Emotions | GoEmotions: 27 categories + neutral ([shared/emotions.json](shared/emotions.json)) |
| Embeddings | all-MiniLM-L6-v2 via transformers.js, the same for passages and entries. Columns are `vector(384)` |
| Moderation | 3 reports hide a post or reply until it's reviewed |
| Age | 18+ (checkbox on sign-up) |
| Muse call budget | Per entry: 1 analysis call, then 1 call per line that returns the echoing phrase *and* the reason. The line calls run in parallel, so at most 4 calls |
| Scrub | Regex pre-pass for emails and phone numbers, then Muse Spark for names, places and schools |

### Themes

belonging, loneliness, grief, love, longing, home, family, identity, freedom, ambition, fear, hope, change, mortality, meaning, regret

Source of truth: [shared/themes.json](shared/themes.json). The slugs are the forum ids and the theme tags everywhere else. They're mirrored in the migration's `forums` seed.

## Contract files

| File | What it is |
|---|---|
| [src/lib/contract.ts](src/lib/contract.ts) | TypeScript types for `/match`, `/scrub`, `/moderate` |
| [shared/mock_match.json](shared/mock_match.json) | Normal result: 3 lines, 3 authors, phrase highlights |
| [shared/mock_match_fallback.json](shared/mock_match_fallback.json) | Whole-entry fallback: no highlights |
| [shared/mock_match_risk.json](shared/mock_match_risk.json) | `risk_flag: true`: 988 card, sharing locked |
| [shared/mock_entry.txt](shared/mock_entry.txt) | The entry text the mock offsets point into |
| [shared/mock_scrub.json](shared/mock_scrub.json), [shared/mock_moderate.json](shared/mock_moderate.json), [shared/mock_transcribe.json](shared/mock_transcribe.json) | Scrub, moderate and transcribe examples |
| [scripts/build-mocks.mjs](scripts/build-mocks.mjs) | Regenerates the mock_match files. Offsets come from an exact-match check, so they always line up |

**Mock mode.** Until Sync 1, `NEXT_PUBLIC_MATCH_MODE=mock` (the default) makes the entry page use the mocks, with lines re-anchored in your actual entry text. If you write [shared/mock_entry.txt](shared/mock_entry.txt) as an entry, you get all three highlights. Other text falls back. Add `?mock=fallback` or `?mock=risk` to an entry URL to see those states. Set `NEXT_PUBLIC_MATCH_MODE=live` (locally and in Vercel) to switch to `/api/match`.

**Mock passages in the database.** The 3 mock passages are seeded into `passages` with ids starting `p_mock_`, so Save and the library work before the real library is loaded. They have no embedding, so the similarity search must skip rows where `embedding is null`. Before the demo, remove them with `delete from passages where id like 'p_mock_%';`. Saved copies in users' libraries are deleted along with them.

Offsets are character indexes, end exclusive, first occurrence. `entry_text.slice(line_start, line_end) === line_text` always holds.

### Endpoints (teammate owns these)

- `POST /match { entry_id }` returns `MatchResponse`. It also writes one `matches` row per link and fills `entries.summary`, `emotions`, `themes` and `risk_flag`. The entry page reads those saved rows on later visits. An entry whose `summary` is still null counts as not yet matched, and gets matched on first view.
- `POST /scrub { text }` returns `{ text, spans: [{ start, end, type, value }] }`
- `POST /moderate { text }` returns `{ status: "ok" | "flagged", reason }`
- `POST /transcribe` (multipart, field `audio`) returns `{ text }`. Audio is never stored

## Muse data use (T11)

PhilAI calls Meta's Model API in **Standard mode** (`muse-spark-1.3` and `muse-voice-transcribe-1.0`, never the `-contributor` ids). Meta's model docs state: "In Standard mode, your content is not used to train Meta models." Meta does not publish how long it retains Standard-mode request data, so the pitch says exactly that: entries and audio are sent to Meta for analysis, are not used for training, and we store no audio ourselves. Source: dev.meta.ai/docs/models.

## Library and matching (teammate track)

```bash
npx tsx --env-file=.env.local scripts/smoke-muse.mts        # T1: one Spark JSON call
npx tsx scripts/library/download.mts                        # T2: Gutenberg texts -> data/raw/ (gitignored)
npx tsx scripts/library/cut.mts                             # T3: candidate passages -> data/candidates.jsonl
npx tsx scripts/library/select.mts                          # T3: ~30 per work by theme anchors -> data/passages.jsonl
npx tsx --env-file=.env.local scripts/library/tag.mts       # T4: emotions/themes/summary/quality -> data/passages.tagged.jsonl
npx tsx --env-file=.env.local scripts/library/load.mts      # T5: embed summaries, upsert into passages (quality >= 4)
npx tsx --env-file=.env.local scripts/test-match.mts        # T7: run the pipeline on shared/mock_entry.txt
```

Apply `supabase/migrations/20261024001000_match_passages.sql` in the SQL editor before running load or match: it adds the `match_passages` RPC that `/api/match` calls.

Embeddings run in-process with transformers.js (`src/lib/embed.ts`, all-MiniLM-L6-v2). Passages are embedded by their plain-English summary; entry lines are embedded as line + entry summary (`lineQuery` in `src/lib/match-core.ts`). Every quoted line and phrase passes `findSpan` in `src/lib/exact-match.ts` before it is returned.

Voice: `/api/transcribe` forwards mono 16-bit PCM WAV (16 or 24 kHz) to Muse. Record in the browser with `WavRecorder` from `src/lib/wav-recorder.ts`; MediaRecorder's webm/opus only works locally where ffmpeg is installed.

## Data model

Migration: [supabase/migrations/20261024000000_init.sql](supabase/migrations/20261024000000_init.sql)

| Table | Client access |
|---|---|
| `users` (id, handle) | Owner reads own. Handle is set by a trigger on sign-up |
| `entries` | Owner: full CRUD |
| `passages` | Everyone reads. Loaded by the library build with the service role |
| `matches` | Owner reads, and can update only `feedback`. Written by the matcher |
| `library_items` | Owner: read, insert, delete |
| `forums` | Everyone reads. Seeded with the 16 themes |
| `posts`, `replies` | Everyone reads **visible rows, without `user_id`** (column grants). Writes are server-only |
| `thread_aliases` | Server only. One alias per (thread, user) |
| `reports` | Server only |

Querying `posts`/`replies` from the client means listing columns explicitly. `select('*')` fails because `user_id` isn't granted. Posts store no link to their source entry. Deleting the auth user cascades to everything they own.
