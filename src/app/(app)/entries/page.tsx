import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { PageTitle } from "@/components/PageTitle";

type Row = { id: string; title: string | null; text: string; created_at: string; match_generation: string | null };
type Lead = { entry_id: string; generation: string | null; line_text: string | null; line_start: number | null;
  passage: { author: string; work: string; year: number | null } | null };

// Every entry, newest first, as a ruled list. The title leads, since it is
// the one thing the writer chose to say about the entry; the line the matcher
// chose follows in the book face as the preview; date and the author who
// answered close the row in one small line. An index, not a dashboard.
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
          <Link href="/write" className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-white hover:bg-terracotta-deep">
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
                <Link href={`/entries/${e.id}`} className="group -mx-3 block rounded-lg px-3 py-5 transition-colors hover:bg-card hover:shadow-sm hover:ring-1 hover:ring-rule">
                  {/* The title is what the writer chose to call it, so it leads. The
                      matcher's line follows as the preview, and the date with the
                      author who answered close the row in one small line. */}
                  <p className="text-[1.2rem] font-semibold tracking-tight">{e.title || `Entry #${rows.length - i}`}</p>
                  <p className="mt-1.5 line-clamp-2 font-serif leading-snug text-foreground/80 transition-colors group-hover:text-foreground">&ldquo;{quote}&rdquo;</p>
                  <p className="mt-2.5 text-xs text-muted transition-colors group-hover:text-foreground/80">
                    <LocalDate iso={e.created_at} />
                    {m?.passage ? (
                      <>
                        {" · "}{m.passage.author}, <cite>{m.passage.work}</cite>
                        {m.passage.year ? ` (${m.passage.year})` : ""}
                      </>
                    ) : (
                      " · Finding passages…"
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
