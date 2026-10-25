// T7: POST /api/match { entry_id, force? } -> MatchResponse
// Reads the entry as the signed-in user (RLS), runs analysis -> verify ->
// embed -> retrieve -> re-rank -> phrase+reason, writes results back with
// the admin client, and returns the contract shape. An entry that already has
// results is served from the database (no model calls) unless force is true.
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embed";
import {
  analyzeEntry, verifyLines, scoreCandidate, pickPerLine, phraseAndReason,
  lineQuery, RISK_EXCLUDED_THEMES, withRetry, type Candidate,
} from "@/lib/match-core";

// Runners-up kept per line, shown under the chosen passage.
const ALTERNATES = 2;
// Taste weights: a library save counts, a "spoke to me" counts more.
const TASTE_SAVED = 0.6, TASTE_RESONATED = 1;
const PLAIN_REASON = "This passage carries the same feeling as your line.";
import type { MatchResponse, MatchLink, ThemeSlug } from "@/lib/contract";
import { groupAlternates } from "@/lib/match-links";

export const runtime = "nodejs";
// 90 s: Muse analysis + 3 phrase calls, with headroom for the model fallback
// chain (Wonder can take 20 s a call under load). Vercel Fluid allows 300.
export const maxDuration = 90;

const RETRIEVE = 30;

// Unhandled throws used to surface as a bare 500 with nothing in the response;
// log the real error for Vercel's function logs and return a readable one. The
// `detail` field carries the same message so the cause can be read off a curl
// against production without dashboard access; the UI shows only `error`.
export async function POST(req: Request) {
  try {
    return await match(req);
  } catch (e) {
    console.error("[match] failed:", e);
    const detail = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
    return NextResponse.json({ error: "Matching failed. Try again in a moment.", detail }, { status: 500 });
  }
}

type Analysis = Awaited<ReturnType<typeof analyzeEntry>>;
// When Muse cannot be reached at all the entry still gets passages: embed the
// whole entry, take the three closest, no highlights and a plain reason. The
// UI already renders this shape (fallback: true), so the reader never sees an
// error for something Meta's side did.
const NO_ANALYSIS: Analysis = { emotions: [], themes: [], summary: "", risk_flag: false, key_lines: [] };

async function match(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  if (!entryId) return NextResponse.json({ error: "entry_id required" }, { status: 400 });

  const { data: entry, error } = await supabase.from("entries")
    .select("id, text, emotions, themes, summary, risk_flag").eq("id", entryId).single();
  if (error || !entry) return NextResponse.json({ error: "entry not found" }, { status: 404 });
  const text: string = entry.text;

  const admin = createAdminClient();

  // Already matched: hand back what is stored. A page retry, a second tab or a
  // double submit must not spend 20 s and five model calls on the same entry.
  if (body?.force !== true && (entry.summary !== null || entry.risk_flag)) {
    const { data: rows } = await admin.from("matches")
      .select("line_text, line_start, line_end, theme, phrase_start, phrase_end, score, reason, rank, resonated, passage:passages(id, author, work, year, text)")
      .eq("entry_id", entryId)
      .order("line_start", { ascending: true, nullsFirst: false })
      .order("rank", { ascending: true });
    const links = groupAlternates((rows ?? []) as unknown as (MatchLink & { rank: number })[]);
    const stored: MatchResponse = {
      entry_id: entryId, emotions: entry.emotions, themes: entry.themes, risk_flag: entry.risk_flag,
      fallback: links.length > 0 && links[0].line_text === null, links,
    };
    return NextResponse.json(stored, { headers: { "x-philai-match": "stored" } });
  }

  // Taste signal: authors the user saved or favorited, and, weighted higher,
  // authors of passages they said spoke to them.
  const tastePromise = Promise.all([
    admin.from("library_items").select("ref, passage_id, passages(author)").eq("user_id", user.id),
    admin.from("matches").select("passages(author), entries!inner(user_id)").eq("resonated", true).eq("entries.user_id", user.id),
  ]).then(([saved, resonated]) => {
    const taste = new Map<string, number>();
    const one = (p: { author: string } | { author: string }[] | null) => (Array.isArray(p) ? p[0] : p)?.author;
    for (const r of (saved.data ?? []) as { ref: string | null; passages: { author: string } | { author: string }[] | null }[]) {
      for (const a of [r.ref, one(r.passages)]) if (a) taste.set(a, Math.max(taste.get(a) ?? 0, TASTE_SAVED));
    }
    for (const r of (resonated.data ?? []) as { passages: { author: string } | { author: string }[] | null }[]) {
      const a = one(r.passages);
      if (a) taste.set(a, TASTE_RESONATED);
    }
    return taste;
  });

  let analysis: Analysis;
  let museDown = false;
  try {
    analysis = await analyzeEntry(text);
  } catch (e) {
    console.error("[match] analysis failed, falling back to whole-entry retrieval:", (e as Error).message);
    analysis = NO_ANALYSIS;
    museDown = true;
  }
  const lines = verifyLines(text, analysis.key_lines);
  const fallback = lines.length === 0;
  const excluded = analysis.risk_flag ? RISK_EXCLUDED_THEMES : new Set<string>();

  const queries = fallback ? [analysis.summary || text.slice(0, 500)] : lines.map((l) => lineQuery(l.text, analysis.summary));
  const vectors = await embed(queries);

  const retrieved: Candidate[][] = await Promise.all(vectors.map((v) => withRetry(async () => {
    const { data, error } = await admin.rpc("match_passages", { query_embedding: JSON.stringify(v), match_count: RETRIEVE });
    if (error) throw new Error(`match_passages: ${error.message}`);
    return (data ?? []) as Candidate[];
  })));
  const tasteAuthors = await tastePromise;

  let links: MatchLink[] = [];
  if (!fallback) {
    const scored = retrieved.map((cands, i) => cands
      .map((c) => ({ c, s: scoreCandidate(c, analysis.emotions, [lines[i].theme, ...analysis.themes], tasteAuthors) }))
      .sort((a, b) => b.s - a.s).map((x) => x.c));
    const scoreOf = (c: Candidate, i: number) => scoreCandidate(c, analysis.emotions, [lines[i].theme, ...analysis.themes], tasteAuthors);
    const picks = pickPerLine(lines, scored, scoreOf, excluded);
    // Runners-up for each line: the next best candidates by a different
    // author than the chosen one (and than each other).
    const alternatesFor = (i: number, chosen: Candidate) => {
      const out: { cand: Candidate; score: number }[] = [];
      const authors = new Set([chosen.author]);
      for (const c of scored[i]) {
        if (out.length === ALTERNATES) break;
        if (authors.has(c.author) || c.themes.some((t) => excluded.has(t))) continue;
        authors.add(c.author);
        out.push({ cand: c, score: scoreOf(c, i) });
      }
      return out;
    };
    // One phrase+reason call per card, all in parallel: nine calls take about
    // as long as the slowest one, not nine times as long.
    const describe = (i: number, p: { cand: Candidate; score: number }) =>
      withRetry(() => phraseAndReason(lines[i].text, analysis.summary, p.cand), 2, 500)
        .catch(() => ({ phrase_start: null, phrase_end: null, reason: PLAIN_REASON }))
        .then((pr) => ({
          line_text: lines[i].text, line_start: lines[i].start, line_end: lines[i].end, theme: lines[i].theme,
          passage: { id: p.cand.id, author: p.cand.author, work: p.cand.work, year: p.cand.year, text: p.cand.text },
          phrase_start: pr.phrase_start, phrase_end: pr.phrase_end, reason: pr.reason, score: Number(p.score.toFixed(3)),
        }) as MatchLink);
    const results = await Promise.all(picks.map(async (p, i) => {
      if (!p) return null;
      const [primary, ...alternates] = await Promise.all([describe(i, p), ...alternatesFor(i, p.cand).map((a) => describe(i, a))]);
      return { ...primary, alternates };
    }));
    links = results.filter((r): r is NonNullable<typeof r> => !!r);
  } else {
    const cands = retrieved[0]
      .map((c) => ({ c, s: scoreCandidate(c, analysis.emotions, analysis.themes, tasteAuthors) }))
      .sort((a, b) => b.s - a.s);
    const used = new Set<string>();
    const top: { c: Candidate; s: number }[] = [];
    for (const x of cands) {
      if (used.has(x.c.author) || x.c.themes.some((t) => excluded.has(t))) continue;
      top.push(x); used.add(x.c.author);
      if (top.length === 3) break;
    }
    const plain = { phrase_start: null, phrase_end: null, reason: "This passage sits closest to what you wrote tonight." };
    const reasons = museDown
      ? top.map(() => plain)
      : await Promise.all(top.map((x) => withRetry(() => phraseAndReason(null, analysis.summary, x.c), 2, 500)
          .catch(() => ({ phrase_start: null, phrase_end: null, reason: "This passage carries the same feeling as your entry." }))));
    links = top.map((x, i) => ({
      line_text: null, line_start: null, line_end: null,
      theme: (x.c.themes.find((t) => analysis.themes.includes(t as ThemeSlug)) ?? x.c.themes[0] ?? analysis.themes[0]) as ThemeSlug,
      passage: { id: x.c.id, author: x.c.author, work: x.c.work, year: x.c.year, text: x.c.text },
      phrase_start: null, phrase_end: null, reason: reasons[i].reason, score: Number(x.s.toFixed(3)),
    }));
  }

  const res: MatchResponse = { entry_id: entryId, emotions: analysis.emotions, themes: analysis.themes, risk_flag: analysis.risk_flag, fallback, links };

  // A Muse-down result is shown but not stored, so the next visit runs the
  // real analysis instead of keeping three unexplained passages forever.
  if (museDown) return NextResponse.json(res, { headers: { "x-philai-match": "degraded" } });

  // Persist: analysis on the entry, one matches row per link (replacing any previous run).
  const entryVec = fallback ? vectors[0] : (await embed([analysis.summary]))[0];
  await admin.from("entries").update({
    emotions: analysis.emotions, themes: analysis.themes, summary: analysis.summary || null,
    risk_flag: analysis.risk_flag, embedding: JSON.stringify(entryVec),
  }).eq("id", entryId);
  await admin.from("matches").delete().eq("entry_id", entryId);
  if (links.length) {
    const row = (l: MatchLink, rank: number) => ({
      entry_id: entryId, line_text: l.line_text, line_start: l.line_start, line_end: l.line_end, theme: l.theme,
      passage_id: l.passage.id, phrase_start: l.phrase_start, phrase_end: l.phrase_end, score: l.score, reason: l.reason, rank,
    });
    const rows = links.flatMap((l) => [row(l, 0), ...(l.alternates ?? []).map((a, k) => row(a, k + 1))]);
    const { error: insErr } = await admin.from("matches").insert(rows);
    if (insErr) console.error("[match] insert matches:", insErr.message);
  }

  return NextResponse.json(res, { headers: { "x-philai-match": "fresh" } });
}

