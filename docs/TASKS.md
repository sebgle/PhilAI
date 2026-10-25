# Task assignments

**Sebastian** owns the app and the community. **Teammate** owns the passage library, matching, and every Muse call. You work in parallel from the start: Sebastian builds against the mocks in [shared/](../shared/), and Teammate tests matching with scripts before any UI exists.

Tick boxes as you go. To change a contract (anything in [src/lib/contract.ts](../src/lib/contract.ts) or `shared/mock_*`), update the types and mocks in the same commit and tell the other person.

**Where server code lives:** all endpoints are Next.js route handlers under `src/app/api/`, so the app deploys as one project. Server code uses `createAdminClient()` from [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) only when it has to bypass RLS.

---

## Decide together first (15 min)

- [x] **Embedding model:** all-MiniLM-L6-v2, run in Node via transformers.js, for both passages and entries (384-d).
- [x] **Report threshold:** 3 reports hide a post or reply until it's reviewed.
- [x] **Minimum age:** 18+, as a checkbox on sign-up.
- [x] **App name:** PhilAI.
- [x] **Transcription contract:** `POST /api/transcribe` (multipart, field `audio`) → `TranscribeResponse` `{ text }`. Mock: `shared/mock_transcribe.json`.

---

## Phase 1: build in parallel

### Teammate: library and matching

- [x] **T1. Muse smoke test.** Make one Muse Spark call that returns JSON, and one Muse transcription call, from a script using the keys in `.env.local`. Note latency and rate limits.
- [x] **T2. Pick sources.** Choose 20–40 works published in 1930 or earlier from Project Gutenberg, favoring readable prose and poetry. List them in `data/sources.json` (author, work, year, Gutenberg id).
- [x] **T3. Cut passages.** Hand-pick 300–1,000 passages of 1–4 sentences, with Gutenberg headers and license text stripped. Save as `data/passages.jsonl` with `{ id, author, work, year, text }`. Ids must be stable (e.g. `p_0412`). Also check the 3 mock passages in `scripts/build-mocks.mjs` against the Gutenberg text; they were quoted from memory.
- [x] **T4. Tag passages.** Write `scripts/library/tag`: one Muse Spark call per passage returns `{ emotions, themes, summary }`. Reject any label not in `shared/emotions.json` or `shared/themes.json`. Spot-check 30 by hand.
- [x] **T5. Embed and load.** Embed each passage's summary and upsert it into `passages` with the secret key. Add a migration with an RPC like `match_passages(query_embedding vector(384), match_count int)` that returns passages by cosine similarity.
  *Done when:* a few hundred tagged passages are queryable.
- [x] **T6. Exact-match helper.** In `src/lib/exact-match.ts`, write `findSpan(haystack, needle) → { start, end } | null`: first occurrence, end exclusive. Add an optional retry that normalizes curly quotes and whitespace. Use it for both lines and phrases.
- [x] **T7. `/api/match`.** `POST { entry_id }`. The route reads the entry as the signed-in user, then:
  1. Makes the Muse analysis call: emotions, themes, summary, risk flag, and 2–3 key lines copied word for word, each with its own theme.
  2. Verifies each line with `findSpan` and drops the ones that fail.
  3. Embeds each line together with the entry summary, and retrieves the ~30 nearest passages.
  4. Re-ranks with 0.5·sim + 0.2·emo + 0.2·theme + 0.1·taste and picks the best passage per line, never repeating an author.
  5. Makes one Muse call per line, in parallel, that returns the echoing phrase and the reason together, then verifies the phrase.
  6. Falls back to whole-entry matching (3 passages, no highlights) if no line verifies.
  7. If the risk flag is set, skips passages with themes that could romanticize death.
  8. Writes the analysis back to `entries`, inserts one `matches` row per link, and returns a `MatchResponse`.

  *Done when:* saving `shared/mock_entry.txt` as an entry returns 2–3 verified links.
- [x] **T8. `/api/scrub`.** `POST { text }`. A regex pass for emails and phone numbers, then Muse for names, places and schools. Returns a `ScrubResponse` with verified spans.
- [x] **T9. `/api/moderate`.** `POST { text }`. Returns a `ModerateResponse`.
- [x] **T10. `/api/transcribe`.** Takes audio, calls Muse transcription and returns `{ text }`. Never write the audio to disk or storage.
- [x] **T11. Data retention.** Find out how long Meta keeps the data the app sends to Muse Spark and Muse transcription. Write one accurate sentence for the pitch and add it to the README.

### Sebastian: app and community

- [ ] **S1. Deploy.** Connect the repo to Vercel, add the env vars, and deploy. Change the Supabase Auth Site URL to the deployed URL.
  *Done when:* Teammate can sign up on the deployed URL and see a handle.
- [ ] **S2. Write screen.** A large text area and a prompt chip (rotating set in `src/lib/prompts.ts`, tap for a new one). Save inserts into `entries` with the browser client. Add a past entries page listing entries newest first, with date and themes.
  *Done when:* an entry survives a page refresh.
- [ ] **S3. Mic.** Hold-to-talk that posts to `/api/transcribe` (use `WavRecorder` from `src/lib/wav-recorder.ts`, not `MediaRecorder`: Muse only accepts 16 kHz mono WAV and Vercel has no ffmpeg) and puts the transcript in the text box for editing. Build it against a stub that returns `shared/mock_transcribe.json` until T10 lands.
- [ ] **S4. Matches screen.** Built on `shared/mock_match.json`:
  - Colored highlights on the entry from `line_start`/`line_end`.
  - Tapping a highlight opens its passage card, with the phrase highlighted in the same color from `phrase_start`/`phrase_end`, plus the reason.
  - Card buttons: save, not for me (sets `matches.feedback`), see more by this author, share this line.
  - Fallback state from `mock_match_fallback.json`, and risk state from `mock_match_risk.json`.
- [ ] **S5. Library.** Tabs for passages, authors, books and quotes (`library_items`). Saving a passage also adds its author ("authors who found me"). Users can add books and quotes by hand.
- [ ] **S6. Forum server routes.**
  - `POST /api/posts`: call moderate, give the user a fresh alias for the new thread in `thread_aliases`, then insert with the admin client.
  - `POST /api/replies`: reuse the user's alias in that thread, or create one.
  - `POST /api/reports`: hide the post or reply once it reaches the report threshold.
  - Never return `user_id` from any of them.
- [ ] **S7. Forum pages.** `/forums` lists the 16 themes. `/forums/[theme]` shows posts newest first, with an author filter. Each post shows the line beside its passage ("marginalia"), with replies one level deep and a report button. Client queries list columns explicitly (no `select('*')`).
- [ ] **S8. Author pages.** `/authors/[name]` shows the author's passages and every visible post linked to them, across all themes.
- [ ] **S9. Share flow.** "Share this line" opens a preview with the editable line, theme tag and linked passage. It calls `/api/scrub` and highlights any warnings, then posts via `/api/posts`. Build it against `mock_scrub.json` and `mock_moderate.json` first.
- [ ] **S10. Safety UI.** When `risk_flag` is true, show a calm card offering 988 (call or text 988, or chat online), and hide or disable sharing for that entry. Add the "not therapy or emergency help" line to the footer and the sign-up screen, plus the age checkbox.
- [ ] **S11. Delete account.** A route that calls `auth.admin.deleteUser` with the admin client. Everything the user owns cascades.

---

## Sync 1: swap mocks for real endpoints

Teammate notes (2026-10-24, late): all four routes are live locally and tested with a signed-in cookie (`scripts/dev-session.mts` prints one for curl). Library: 856 passages loaded from 56 works (quality >= 3). `/api/match` takes ~25 s today, 14 s of it the Muse analysis call; `/api/scrub` ~9 s; `/api/moderate` ~2 s; `/api/transcribe` ~2 s. Unauthenticated API calls get a 307 to /login from the middleware rather than a 401. Risk entries still return links (minus mortality) so the UI can show the 988 card next to them with sharing locked.

- [ ] `/api/match`, `/api/scrub`, `/api/moderate` and `/api/transcribe` return the agreed shapes on the deployed URL.
- [ ] Sebastian swaps each mock for the real call. Nothing else on those screens should need to change. If something does, fix the contract, not the screen.

## Phase 2: tune and harden

- [ ] **T12. Tuning.** Run 10 test entries. Compare embedding the raw line vs the line plus summary. Adjust the weights using "not for me" results, and aim for under ~5 s until the first highlight appears.
- [ ] **T13. Spare capacity.** If ahead, take S8 (author pages) and the seed data in S12.
- [ ] **S12. Polish.** Warm paper tones in light mode, ink tones in dark mode, serif type for passages. Lines light up one at a time, and the passage card slides in like a letter. Empty states everywhere. Seed 2 demo accounts and a few posts (`is_seeded = true`).
- [ ] **S13. Spare capacity.** If ahead, help Teammate hand-check passage tags.

## Sync 2: demo

- [ ] Run the [demo script](#demo-script) end to end, twice in a row, with no fixes needed in between.
- [ ] Record a screen capture of a full run as a backup.

### Demo script

1. Hook (20 s)
2. Write by voice (30 s)
3. Highlights: tap one, read the reason, save (45 s)
4. Share: the scrub warning catches a school name, remove it, post to Belonging (40 s)
5. Second account replies, still anonymous (30 s)
6. 988 card on a prepared test entry (15 s)
7. Close (10 s)

**If time runs short, cut from the top:** voice → hand-added books and quotes → author filter and author pages → phrase highlight inside passages → reply threading.
