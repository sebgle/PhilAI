import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { PageTitle } from "@/components/PageTitle";

type Row = { id: string; title: string | null; text: string; created_at: string; match_generation: string | null };
type Lead = { entry_id: string; generation: string | null; line_text: string | null; line_start: number | null;
  passage: { author: string; work: string; year: number | null } | null };

// Every entry, newest first, as a ruled list of quotations: the line the
// matcher chose leads in the book face, the author who answered sits under it
// as a byline. Date and title share one quiet eyebrow. The list is an index of
// what the entry screen shows, not a dashboard of its metadata.
export default async function PastEntries() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, title, text, created_at, match_generation")
    .order("created_at", { ascending: false });
  const rows = (entries ?? []) as Row[];

  // The shown passage (rank 0) of each entry's current generation. Older
  // generations stay in the table as history, so filter by generation here.
  const { data: matchRows } = rows.length
    ? await supabase
        .from("matches")
        .select("entry_id, generation, line_text, line_start, passage:passages(author, work, year)")
        .in("entry_id", rows.map((e) => e.id))
        .eq("rank", 0)
        .order("line_start", { ascending: true, nullsFirst: false })
    : { data: [] };
  const lead = new Map<string, Lead>();
  for (const m of (matchRows ?? []) as unknown as Lead[]) {
    const entry = rows.find((e) => e.id === m.entry_id);
    if (!entry || m.generation !== entry.match_generation || lead.has(m.entry_id)) continue;
    lead.set(m.entry_id, m);
  }

  return (
    <section className="flex flex-col gap-5">
      <PageTitle title="Entries" />

      {error && <p className="text-red-600">{error.message}</p>}

      {entries && entries.length === 0 && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-muted">Nothing here yet. Each entry you write lands here, with the passages it found.</p>
          <Link href="/" className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-white hover:bg-terracotta-deep">
            Write your first entry
          </Link>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col">
          {rows.map((e, i) => {
            const m = lead.get(e.id);
            const quote = (m?.line_text ?? e.text).trim();
            return (
              <li key={e.id} className="border-t border-rule">
                <Link href={`/entries/${e.id}`} className="-mx-3 block rounded-lg px-3 py-5 transition-colors hover:bg-hover">
                  <p className="text-xs text-muted">
                    <LocalDate iso={e.created_at} /> · {e.title || `Entry #${rows.length - i}`}
                  </p>
                  <p className="mt-1.5 line-clamp-2 font-serif text-[1.25rem] leading-snug">&ldquo;{quote}&rdquo;</p>
                  <p className="mt-2 text-xs text-muted">
                    {m?.passage ? (
                      <>
                        {m.passage.author}, <cite>{m.passage.work}</cite>
                        {m.passage.year ? ` (${m.passage.year})` : ""}
                      </>
                    ) : (
                      "Finding passages…"
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
