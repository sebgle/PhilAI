import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import type { MatchLink, MatchResponse } from "@/lib/contract";
import type { MockVariant } from "@/lib/matching";
import { Matches } from "./Matches";

const VARIANTS: MockVariant[] = ["match", "fallback", "risk"];

// The Matches screen. Saved matches are read from the database; an entry the
// matcher hasn't analyzed yet (summary still null) is matched on first view.
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
    .select("id, text, prompt, created_at, emotions, themes, summary, risk_flag")
    .eq("id", id)
    .maybeSingle();
  if (!entry) notFound();

  const { data: rows } = await supabase
    .from("matches")
    .select(
      "line_text, line_start, line_end, theme, phrase_start, phrase_end, score, reason, feedback, passage:passages(id, author, work, year, text)",
    )
    .eq("entry_id", id)
    .order("line_start", { ascending: true, nullsFirst: false });

  const links = (rows ?? []) as unknown as MatchLink[];
  const analyzed = entry.summary !== null || entry.risk_flag || links.length > 0;
  const initial: MatchResponse | null = analyzed
    ? {
        entry_id: entry.id,
        emotions: entry.emotions,
        themes: entry.themes,
        risk_flag: entry.risk_flag,
        fallback: links.length > 0 && links[0].line_text === null,
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
  for (const r of rows ?? []) {
    if (r.feedback === "not_for_me") initialFeedback[(r.passage as unknown as { id: string }).id] = "not_for_me";
  }
  for (const s of saved ?? []) initialFeedback[s.passage_id] = "saved";

  return (
    <article className="flex flex-col gap-4">
      <div className="text-sm text-muted">
        <LocalDate iso={entry.created_at} withTime />
      </div>
      {entry.prompt && <p className="text-sm italic text-muted">{entry.prompt}</p>}
      <Matches
        entryId={entry.id}
        text={entry.text}
        initial={initial}
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
