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
| Embeddings | `vector(384)`, which fits all-MiniLM-L6-v2 or gte-small. **Still open:** confirm the model, and change the column if it isn't 384-d |

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
| [shared/mock_scrub.json](shared/mock_scrub.json), [shared/mock_moderate.json](shared/mock_moderate.json) | Scrub and moderate examples |
| [scripts/build-mocks.mjs](scripts/build-mocks.mjs) | Regenerates the mock_match files. Offsets come from an exact-match check, so they always line up |

Offsets are character indexes, end exclusive, first occurrence. `entry_text.slice(line_start, line_end) === line_text` always holds.

### Endpoints (teammate owns these)

- `POST /match { entry_id }` returns `MatchResponse`. It also writes one `matches` row per link.
- `POST /scrub { text }` returns `{ text, spans: [{ start, end, type, value }] }`
- `POST /moderate { text }` returns `{ status: "ok" | "flagged", reason }`

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
