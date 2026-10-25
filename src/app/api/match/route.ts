// Analyze -> retrieve -> compare actual passages -> atomically store a generation.
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embed";
import { analyzeEntry, verifyLines, scoreCandidate, RISK_EXCLUDED_THEMES, withRetry, type Candidate } from "@/lib/match-core";
import { reviewPassages, assignInsights } from "@/lib/insight-match";
import { retrievalQueries, balancedShortlist, mapConcurrent, type RetrievalGroup } from "@/lib/match-retrieval";
import { feedbackPreferences, withQualityFeedback, type FeedbackSignal } from "@/lib/match-feedback";
import { MATCH_VERSION, isCurrentMatch } from "@/lib/match-version";
import { groupAlternates } from "@/lib/match-links";
import type { MatchResponse, MatchLink, ThemeSlug } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    return await match(req);
  } catch {
    // Do not leak private journal/model output through error details or logs.
    return NextResponse.json({ error: "Matching is unavailable. Your entry is saved. Try again shortly." }, { status: 503 });
  }
}

async function match(req: Request) {
  const deadline = Date.now() + 65_000;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  if (!entryId) return NextResponse.json({ error: "entry_id required" }, { status: 400 });
  const { data: entry, error } = await supabase.from("entries")
    .select("id, text, emotions, themes, summary, risk_flag, match_version, match_generation, match_fallback")
    .eq("id", entryId).abortSignal(AbortSignal.timeout(10_000)).single();
  if (error || !entry) return NextResponse.json({ error: "entry not found" }, { status: 404 });
  const admin = createAdminClient();
  const qualityForEntry = async (links: MatchLink[]) => {
    const { data, error } = await supabase.from("match_quality_feedback")
      .select("passage_id, rating").eq("entry_id", entryId).abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return withQualityFeedback(links, data ?? []);
  };
  if (body?.force !== true && isCurrentMatch(entry)) {
    const { data: rows, error: readError } = await admin.from("matches")
      .select("line_text, line_start, line_end, theme, phrase_start, phrase_end, score, reason, rank, resonated, connection_kind, passage:passages(id, author, work, year, text)")
      .eq("entry_id", entryId).eq("generation", entry.match_generation)
      .order("line_start", { ascending: true, nullsFirst: false }).order("rank", { ascending: true }).abortSignal(AbortSignal.timeout(8_000));
    if (readError) throw readError;
    const links = await qualityForEntry(groupAlternates((rows ?? []) as unknown as (MatchLink & { rank: number })[]));
    return NextResponse.json({ entry_id: entryId, emotions: entry.emotions, themes: entry.themes,
      risk_flag: entry.risk_flag, fallback: entry.match_fallback, links } satisfies MatchResponse,
      { headers: { "x-philai-match": "stored" } });
  }

  // Start preference reads alongside analysis. A preference outage need not
  // prevent matching; relevance is decided by the passage comparison.
  const tastePromise = Promise.all([
    admin.from("library_items").select("ref, passages(author)").eq("user_id", user.id).abortSignal(AbortSignal.timeout(8_000)),
    admin.from("matches").select("passages(author), entries!inner(user_id)").eq("resonated", true).eq("entries.user_id", user.id).abortSignal(AbortSignal.timeout(8_000)),
  ]).then(([saved, resonated]) => {
    const taste = new Map<string, number>();
    const author = (p: { author: string } | { author: string }[] | null) => (Array.isArray(p) ? p[0] : p)?.author;
    for (const row of saved.data ?? []) {
      for (const a of [row.ref, author(row.passages)]) if (a) taste.set(a, Math.max(taste.get(a) ?? 0, 0.6));
    }
    for (const row of resonated.data ?? []) { const a = author(row.passages); if (a) taste.set(a, 1); }
    return taste;
  }).catch(() => new Map<string, number>());
  const qualityPromise = Promise.resolve(admin.from("match_quality_feedback")
    .select("passage_id, rating, context_text").eq("user_id", user.id)
    .order("updated_at", { ascending: false }).limit(20).abortSignal(AbortSignal.timeout(8_000)))
    .then((result) => (result.data ?? []) as FeedbackSignal[]).catch(() => [] as FeedbackSignal[]);
  // If analysis fails, do not retrieve without knowing the entry's risk state.
  const analysis = await analyzeEntry(entry.text, Math.min(deadline, Date.now() + 30_000));
  const lines = verifyLines(entry.text, analysis.key_lines);
  const fallback = lines.length === 0;
  const excluded = analysis.risk_flag ? RISK_EXCLUDED_THEMES : new Set<string>();
  const plan = (fallback ? [null] : lines).map((line) => retrievalQueries(line, analysis.summary));
  const queries = plan.flatMap((qs, lineIndex) => qs.map((q) => ({ ...q, lineIndex })));
  const signals = await qualityPromise;
  // Past snippets are embedded locally; they are never sent to the comparison model.
  const vectors = await embed([...queries.map((q) => q.text), ...signals.map((r) => r.context_text)]);
  const preferences = plan.map((qs, i) => {
    const start = plan.slice(0, i).reduce((n, q) => n + q.length, 0);
    const tensionIndex = qs.findIndex((q) => q.kind === "tension");
    return feedbackPreferences(signals, vectors[start + Math.max(0, tensionIndex)], vectors.slice(queries.length));
  });
  const tasks = queries.flatMap((q, vectorIndex) => (["semantic", "profile"] as const).map((source) => ({ ...q, source, vectorIndex })));
  const retrieved = await mapConcurrent(tasks, 6, async (task) => {
    const candidates = await withRetry(async () => {
      const rpc = task.source === "semantic"
        ? admin.rpc("match_passages", { query_embedding: JSON.stringify(vectors[task.vectorIndex]), match_count: 30 })
        : admin.rpc("search_passage_insights", { query_text: task.text, match_count: 12 });
      const { data, error } = await rpc.abortSignal(AbortSignal.timeout(Math.max(1, Math.min(8_000, deadline - Date.now()))));
      if (error) throw error;
      return (data ?? []) as Candidate[];
    }, 2, 200);
    return { kind: task.kind, source: task.source, candidates, lineIndex: task.lineIndex };
  });
  const taste = await tastePromise;
  const pools = plan.map((_, i) => balancedShortlist(retrieved.filter((g) => g.lineIndex === i) as RetrievalGroup[], excluded, (c) =>
    scoreCandidate(c, analysis.emotions, fallback ? analysis.themes : [lines[i].theme], new Set()) + 0.01 * (taste.get(c.author) ?? 0)));
  const reviews = await Promise.all(pools.map((pool, i) => reviewPassages({
    line: fallback ? null : lines[i].text,
    interpretation: fallback ? analysis.summary : lines[i].interpretation ?? analysis.summary,
    context: entry.text, candidates: pool, excluded, preferences: preferences[i], deadline,
  })));
  const picks = assignInsights(reviews);
  const links: MatchLink[] = [];
  for (let i = 0; i < picks.length; i++) {
    const cards = picks[i].map((p): MatchLink => ({
      line_text: fallback ? null : lines[i].text,
      line_start: fallback ? null : lines[i].start, line_end: fallback ? null : lines[i].end,
      theme: (fallback ? p.cand.themes[0] ?? analysis.themes[0] : lines[i].theme) as ThemeSlug,
      passage: { id: p.cand.id, author: p.cand.author, work: p.cand.work, year: p.cand.year, text: p.cand.text },
      connection_kind: p.connection_kind, phrase_start: p.phrase_start, phrase_end: p.phrase_end, reason: p.reason, score: p.score,
    }));
    if (fallback) links.push(...cards); // Whole-entry cards have no shared line to group by.
    else if (cards.length) links.push({ ...cards[0], alternates: cards.slice(1) });
  }
  const response: MatchResponse = { entry_id: entryId, emotions: analysis.emotions, themes: analysis.themes,
    risk_flag: analysis.risk_flag, fallback, links };
  const row = (l: MatchLink, rank: number) => ({ line_text: l.line_text, line_start: l.line_start,
    line_end: l.line_end, theme: l.theme, passage_id: l.passage.id,
    phrase_start: l.phrase_start, phrase_end: l.phrase_end, score: l.score, reason: l.reason, connection_kind: l.connection_kind, rank });
  // A transaction installs the new generation only after every insert succeeds.
  // Historical rows keep library references and feedback intact.
  const { data: generation, error: writeError } = await admin.rpc("store_insight_matches", {
    p_entry_id: entryId, p_user_id: user.id, p_text: entry.text, p_version: MATCH_VERSION,
    p_analysis: { emotions: analysis.emotions, themes: analysis.themes, summary: analysis.summary, risk_flag: analysis.risk_flag, fallback },
    p_rows: links.flatMap((l) => [row(l, 0), ...(l.alternates ?? []).map((a, k) => row(a, k + 1))]),
  }).abortSignal(AbortSignal.timeout(10_000));
  if (writeError) throw writeError;
  const { data: saved, error: savedError } = await admin.from("matches")
    .select("line_text, line_start, line_end, theme, phrase_start, phrase_end, score, reason, rank, resonated, connection_kind, passage:passages(id, author, work, year, text)")
    .eq("entry_id", entryId).eq("generation", generation).abortSignal(AbortSignal.timeout(5_000))
    .order("line_start", { ascending: true, nullsFirst: false }).order("rank", { ascending: true });
  if (savedError) throw savedError;
  response.links = await qualityForEntry(groupAlternates((saved ?? []) as unknown as (MatchLink & { rank: number })[]));
  return NextResponse.json(response, { headers: { "x-philai-match": "fresh" } });
}
