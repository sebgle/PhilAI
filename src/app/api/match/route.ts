// T7: POST /api/match { entry_id } -> MatchResponse
// Reads the entry as the signed-in user (RLS), runs analysis -> verify ->
// embed -> retrieve -> re-rank -> phrase+reason, writes results back with
// the admin client, and returns the contract shape.
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embed";
import {
  analyzeEntry, verifyLines, scoreCandidate, pickPerLine, phraseAndReason,
  lineQuery, RISK_EXCLUDED_THEMES, withRetry, type Candidate,
} from "@/lib/match-core";
import type { MatchResponse, MatchLink, ThemeSlug } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 60;

const RETRIEVE = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  if (!entryId) return NextResponse.json({ error: "entry_id required" }, { status: 400 });

  const { data: entry, error } = await supabase.from("entries").select("id, text").eq("id", entryId).single();
  if (error || !entry) return NextResponse.json({ error: "entry not found" }, { status: 404 });
  const text: string = entry.text;

  const admin = createAdminClient();

  // Taste signal: authors the user saved or favorited.
  const tastePromise = admin.from("library_items").select("ref, passage_id, passages(author)").eq("user_id", user.id)
    .then(({ data }) => new Set((data ?? []).flatMap((r: { ref: string | null; passages: { author: string } | { author: string }[] | null }) => {
      const p = Array.isArray(r.passages) ? r.passages[0] : r.passages;
      return [r.ref, p?.author].filter((x): x is string => !!x);
    })));

  const analysis = await analyzeEntry(text);
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
    const results = await Promise.all(picks.map(async (p, i) => {
      if (!p) return null;
      const pr = await withRetry(() => phraseAndReason(lines[i].text, analysis.summary, p.cand), 2, 500)
        .catch(() => ({ phrase_start: null, phrase_end: null, reason: "This passage carries the same feeling as your line." }));
      return { i, p, pr };
    }));
    links = results.filter((r): r is NonNullable<typeof r> => !!r).map(({ i, p, pr }) => ({
      line_text: lines[i].text, line_start: lines[i].start, line_end: lines[i].end, theme: lines[i].theme,
      passage: { id: p.cand.id, author: p.cand.author, work: p.cand.work, year: p.cand.year, text: p.cand.text },
      phrase_start: pr.phrase_start, phrase_end: pr.phrase_end, reason: pr.reason, score: Number(p.score.toFixed(3)),
    }));
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
    const reasons = await Promise.all(top.map((x) => withRetry(() => phraseAndReason(null, analysis.summary, x.c), 2, 500)
      .catch(() => ({ phrase_start: null, phrase_end: null, reason: "This passage carries the same feeling as your entry." }))));
    links = top.map((x, i) => ({
      line_text: null, line_start: null, line_end: null,
      theme: (x.c.themes.find((t) => analysis.themes.includes(t as ThemeSlug)) ?? x.c.themes[0] ?? analysis.themes[0]) as ThemeSlug,
      passage: { id: x.c.id, author: x.c.author, work: x.c.work, year: x.c.year, text: x.c.text },
      phrase_start: null, phrase_end: null, reason: reasons[i].reason, score: Number(x.s.toFixed(3)),
    }));
  }

  // Persist: analysis on the entry, one matches row per link (replacing any previous run).
  const entryVec = fallback ? vectors[0] : (await embed([analysis.summary]))[0];
  await admin.from("entries").update({
    emotions: analysis.emotions, themes: analysis.themes, summary: analysis.summary,
    risk_flag: analysis.risk_flag, embedding: JSON.stringify(entryVec),
  }).eq("id", entryId);
  await admin.from("matches").delete().eq("entry_id", entryId);
  if (links.length) {
    const { error: insErr } = await admin.from("matches").insert(links.map((l) => ({
      entry_id: entryId, line_text: l.line_text, line_start: l.line_start, line_end: l.line_end, theme: l.theme,
      passage_id: l.passage.id, phrase_start: l.phrase_start, phrase_end: l.phrase_end, score: l.score, reason: l.reason,
    })));
    if (insErr) console.error("[match] insert matches:", insErr.message);
  }

  const res: MatchResponse = { entry_id: entryId, emotions: analysis.emotions, themes: analysis.themes, risk_flag: analysis.risk_flag, fallback, links };
  return NextResponse.json(res);
}
