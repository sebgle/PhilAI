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

- [x] **S1. Deploy.** Connect the repo to Vercel, add the env vars, and deploy. Change the Supabase Auth Site URL to the deployed URL.
  *Done when:* Teammate can sign up on the deployed URL and see a handle.
- [x] **S2. Write screen.** A large text area and a prompt chip (rotating set in `src/lib/prompts.ts`, tap for a new one). Save inserts into `entries` with the browser client. Add a past entries page listing entries newest first, with date and themes.
  *Done when:* an entry survives a page refresh.
- [x] **S3. Mic.** *(Built as tap to start / tap to stop, since holding a button for 30 s is awkward on a laptop. Auto-stops at 2 min, because WAV is ~32 KB/s and Vercel rejects bodies over 4.5 MB. The transcript is appended to any typed text.)* Hold-to-talk that posts to `/api/transcribe` (use `WavRecorder` from `src/lib/wav-recorder.ts`, not `MediaRecorder`: Muse only accepts 16 kHz mono WAV and Vercel has no ffmpeg) and puts the transcript in the text box for editing. Build it against a stub that returns `shared/mock_transcribe.json` until T10 lands.
- [x] **S4. Matches screen.** Built on `shared/mock_match.json`:
  - Colored highlights on the entry from `line_start`/`line_end`.
  - Tapping a highlight opens its passage card, with the phrase highlighted in the same color from `phrase_start`/`phrase_end`, plus the reason.
  - Card buttons: save, not for me (sets `matches.feedback`), see more by this author, share this line.
  - Fallback state from `mock_match_fallback.json`, and risk state from `mock_match_risk.json`.
- [x] **S5. Library.** Tabs for passages, authors, books and quotes (`library_items`). Saving a passage also adds its author ("authors who found me"). Users can add books and quotes by hand.
- [x] **S6. Forum server routes.**
  - `POST /api/posts`: call moderate, give the user a fresh alias for the new thread in `thread_aliases`, then insert with the admin client.
  - `POST /api/replies`: reuse the user's alias in that thread, or create one.
  - `POST /api/reports`: hide the post or reply once it reaches the report threshold.
  - Never return `user_id` from any of them.
- [x] **S7. Forum pages.** `/forums` lists the 16 themes. `/forums/[theme]` shows posts newest first, with an author filter. Each post shows the line beside its passage ("marginalia"), with replies one level deep and a report button. Client queries list columns explicitly (no `select('*')`).
- [x] **S8. Author pages.** (done by Teammate under T13) `/authors/[name]` shows the author's passages and every visible post linked to them, across all themes.
- [x] **S9. Share flow.** "Share this line" opens a preview with the editable line, theme tag and linked passage. It calls `/api/scrub` and highlights any warnings, then posts via `/api/posts`. Build it against `mock_scrub.json` and `mock_moderate.json` first.
- [x] **S10. Safety UI.** When `risk_flag` is true, show a calm card offering 988 (call or text 988, or chat online), and hide or disable sharing for that entry. Add the "not therapy or emergency help" line to the footer and the sign-up screen, plus the age checkbox. *(Risk entries keep their safe passages under the 988 card with no Share button; `/api/posts` also refuses them. Sign-up needs the 18+ box ticked.)*
- [x] **S11. Delete account.** A route that calls `auth.admin.deleteUser` with the admin client. Everything the user owns cascades. *(`DELETE /api/account`; reached from the handle in the header → `/account`; you type "delete" to confirm.)*

---

## Sync 1: swap mocks for real endpoints

Teammate notes (2026-10-24, late): all four routes are live locally and tested with a signed-in cookie (`scripts/dev-session.mts` prints one for curl). Library: 856 passages loaded from 56 works (quality >= 3). `/api/match` takes ~25 s today, 14 s of it the Muse analysis call; `/api/scrub` ~9 s; `/api/moderate` ~2 s; `/api/transcribe` ~2 s. Unauthenticated API calls get a 307 to /login from the middleware rather than a 401. Risk entries still return links (minus mortality) so the UI can show the 988 card next to them with sharing locked.

- [x] `/api/match`, `/api/scrub`, `/api/moderate` and `/api/transcribe` return the agreed shapes on the deployed URL.
- [x] Sebastian swaps each mock for the real call. Nothing else on those screens should need to change. If something does, fix the contract, not the screen.

Sync 1 notes (2026-10-24, late): `NEXT_PUBLIC_MATCH_MODE=live` is set in Vercel. On https://philai.vercel.app, `/api/match` returned 200 in 13.6 s with 3 verified links. It took two fixes: vendoring the q8 model, and tracing onnxruntime's linux/x64 binary into the function. Locally the scrub and moderate calls ran through the share flow, and transcribe ran end to end through the mic UI (2.8 s).

## Phase 2: tune and harden

- [x] **T12. Tuning.** Run 10 test entries. Compare embedding the raw line vs the line plus summary. Adjust the weights using "not for me" results, and aim for under ~5 s until the first highlight appears.
- [x] **T13. Spare capacity.** If ahead, take S8 (author pages) and the seed data in S12.
- [x] **S12. Polish.** *(Laid-paper / fountain-pen-ink palette in `globals.css`, Literata for passages and Instrument Sans for the UI, highlighter strokes that sweep across each line in turn, a passage card that lands like a letter, matching-stage status text during the ~15 s wait, a header that wraps on phones, and animations off for reduced motion. Seed data by Teammate.)* Warm paper tones in light mode, ink tones in dark mode, serif type for passages. Lines light up one at a time, and the passage card slides in like a letter. Empty states everywhere. Seed 2 demo accounts and a few posts (`is_seeded = true`).
- [ ] **S13. Spare capacity.** If ahead, help Teammate hand-check passage tags.

**Seed data (T13):** `npx tsx --env-file=.env.local scripts/seed-community.mts` wipes every forum post, then seeds three posts per room from fourteen cast accounts (`cast-01@philai.app` to `cast-14@philai.app`, password `philai-demo-2026` unless `DEMO_PASSWORD` is set), each with replies written for it, plus posts with unread replies for the demo account (`DEMO_EMAIL`, default sebastianle1259@gmail.com). `scripts/seed-entries.mts` then replaces that account's journal entries with eight written ones, each with hand-picked passages stored as real matches, and fills Saved from them. The demo entry for step 2 is `shared/demo_entry.txt`; it returns Wilde, Brontë and Montgomery, and scrub flags "Westlake".

**Muse outages (2026-10-25 ~01:00):** all three Spark ids returned 404 model_not_found for 30+ min at once, so prod match/moderate/scrub failed for the whole window. Muse is also far flakier from Vercel than from a laptop (match 500s there while the same code passes locally). So (a) the chain now ends with OpenAI (`gpt-4.1-mini`, only when `OPENAI_API_KEY` is set in Vercel Production, only after all Spark ids fail; Wonder was tried first and dropped as too slow and still Muse), (b) `/api/match` never 500s on Muse: if analysis fails it embeds the whole entry and returns the 3 closest passages as `fallback: true` with plain reasons, and (c) match/moderate error responses carry a `detail` field with the real upstream error so it can be read with curl. Route limits: match 90 s, moderate and scrub 60 s.

**Threaded replies + likes (2026-10-25 ~02:00, Teammate):** `supabase/migrations/20261025030000_threaded_replies_likes.sql` adds `replies.parent_id` and a server-only `likes` table. Apply it in the SQL editor BEFORE merging the code: the forum page selects `parent_id`. Replies to replies nest (indent capped at 3 levels; children of a hidden reply surface at the top level). `POST /api/likes { post_id | reply_id }` toggles and returns `{ liked, count }`; hearts sit in the post meta line and on each reply. The bell now also shows replies under your replies. Seed script likes every seeded post from the other demo account and the first reply from the poster.

**Stored results (2026-10-25 ~04:00, Teammate):** `/api/match` returns the stored analysis and `matches` rows for an entry that was already matched (response header `x-philai-match: stored|fresh|degraded`); send `{ "force": true }` to re-run. A Muse-down (degraded) result is returned but not stored, so the next visit re-runs for real. Scrub identifiers and moderation verdicts are cached by text hash in `llm_cache` (migration `20261025040000_llm_cache.sql`, server-only; apply any time, the code tolerates its absence), so the share preview and the post that follows cost one model call.

**Alternates + "spoke to me" (2026-10-25 ~05:30, Teammate):** migration `20261025050000_match_alternates.sql` adds `matches.rank` (0 shown, 1-2 runners-up) and `matches.resonated`. Apply BEFORE merging: the match route inserts `rank`. Each highlighted line now shows its passage plus two runners-up by other authors, all with phrase + reason (nine Muse calls in parallel, same wall time as three). Every card has "Spoke to me": not a save, a ranking signal; resonated authors get taste weight 1.0 vs 0.6 for saved authors in `scoreCandidate`. `MatchLink.alternates` carries the runners-up; mocks have none.

**Risk flag (tuned):** passive ideation ("would anyone notice if I stopped showing up") is now flagged; skipping class/practice is not. Spot-check with `scripts/test-risk.mts`.

## Sync 2: demo

**Before the demo** (in this order):
- [ ] Delete the dev test account `philai-s2-test@example.com` from its Account page. That also removes its two test forum posts, both linked to mock passages.
- [ ] Remove the mock passages: `delete from passages where id like 'p_mock_%';`. This only works after the step above, because posts block the delete.
- [ ] Re-run the seed script, so the forums hold only seeded posts plus whatever you post live.
- [ ] Warm up production: save one entry on https://philai.vercel.app a few minutes before going on, so the demo doesn't hit a cold start.
- [ ] Do the voice step in Chrome, and allow the microphone ahead of time.

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
