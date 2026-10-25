import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import type { MatchLink, MatchResponse } from "@/lib/contract";
import type { MockVariant } from "@/lib/matching";
import { Matches } from "./Matches";
import { groupAlternates } from "@/lib/match-links";
import { isCurrentMatch } from "@/lib/match-version";
import { EntryTitle } from "./EntryTitle";
import { Backdrop } from "@/components/Backdrop";

const VARIANTS: MockVariant[] = ["match", "fallback", "risk"];

// The Matches screen. Saved matches are read from the database; an entry the
// matcher has not processed at the current version is matched on first view.
export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { id } = await params;
  const { mock } = await searchParams;
  const supabase = await createClient();

  // RLS limits both queries to the signed-in user's own rows.
  const { data: entry } = await supabase
    .from("entries")
    .select("id, title, text, prompt, created_at, emotions, themes, summary, risk_flag, match_version, match_generation, match_fallback")
    .eq("id", id)
    .maybeSingle();
  if (!entry) notFound();

  // Its number among the user's entries, for the "Entry #N" fallback title.
  const { count: entryNumber } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .lte("created_at", entry.created_at);

  const { data: rows, error: matchesError } = await supabase
    .from("matches")
    .select(
      "line_text, line_start, line_end, theme, phrase_start, phrase_end, score, reason, feedback, rank, resonated, passage:passages(id, author, work, year, text)",
    )
    .eq("entry_id", id)
    .eq("generation", entry.match_generation ?? "00000000-0000-0000-0000-000000000000")
    .order("line_start", { ascending: true, nullsFirst: false })
    .order("rank", { ascending: true });

  if (matchesError) throw new Error("Could not load saved matches");
  const links = groupAlternates((rows ?? []) as unknown as (MatchLink & { rank: number })[]);
  const analyzed = isCurrentMatch(entry);
  const initial: MatchResponse | null = analyzed
    ? {
        entry_id: entry.id,
        emotions: entry.emotions,
        themes: entry.themes,
        risk_flag: entry.risk_flag,
        fallback: entry.match_fallback,
        links,
      }
    : null;
  // "Saved" comes from the library (the source of truth, and the only record in
  // mock mode); "not for me" comes from matches.feedback.
  const { data: saved } = await supabase
    .from("library_items")
    .select("passage_id")
    .eq("kind", "passage");
  const initialFeedback: Record<string, "saved" | "not_for_me" | null> = {};
  const { data: historicalFeedback } = await supabase.from("matches")
    .select("passage_id, feedback").eq("entry_id", id).eq("feedback", "not_for_me");
  for (const r of historicalFeedback ?? []) initialFeedback[r.passage_id] = "not_for_me";
  for (const s of saved ?? []) initialFeedback[s.passage_id] = "saved";

  return (
    <article className="flex flex-col gap-4">
      <Backdrop variant="matches" />
      <div>
        <EntryTitle entryId={entry.id} initial={entry.title} fallback={`Entry #${entryNumber ?? ""}`} />
        <div className="mt-1 text-sm text-muted">
          <LocalDate iso={entry.created_at} withTime />
        </div>
      </div>
      {entry.prompt && <p className="text-sm italic text-muted">{entry.prompt}</p>}
      <Matches
        entryId={entry.id}
        text={entry.text}
        initial={initial}
        initialRiskFlag={entry.risk_flag}
        initialFeedback={initialFeedback}
        mockVariant={VARIANTS.includes(mock as MockVariant) ? (mock as MockVariant) : "match"}
      />
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">Write another</Link>
        <Link href="/entries" className="underline">All entries</Link>
      </div>
    </article>
  );
}
