import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { RoomNight } from "@/components/art/RoomNight";
import { THEMES } from "@/lib/contract";

const themeName = new Map(THEMES.map((t) => [t.slug, t.name]));

// The Entries page from the sketch: the moonlit room on the left, the list of
// entries stacked on the right.
export default async function PastEntries() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, title, text, prompt, themes, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="grid items-start gap-12 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <RoomNight className="hidden w-full text-foreground md:block md:sticky md:top-24" />

      <section className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold tracking-tight">Entries</h1>

        {error && <p className="text-red-600">{error.message}</p>}

        {entries && entries.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-rule p-6">
            <p className="text-muted">Nothing here yet. Each entry you write lands here, with the passages it found.</p>
            <Link href="/" className="rounded-md bg-[#2383e2] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0077d4]">
              Write your first entry
            </Link>
          </div>
        )}

        {entries && entries.length > 0 && (
          <ul className="flex flex-col gap-3">
            {entries.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/entries/${e.id}`}
                  className="block rounded-md border border-rule bg-card px-5 py-4 transition-colors hover:bg-hover"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm text-muted">
                    <span className="font-medium text-foreground">{e.title || `Entry #${entries.length - i}`}</span>
                    <LocalDate iso={e.created_at} />
                  </div>
                  {e.prompt && <p className="mt-1 text-sm italic text-muted">{e.prompt}</p>}
                  <p className="mt-2 line-clamp-2 leading-relaxed">{e.text}</p>
                  {e.themes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {e.themes.map((t: string) => (
                        <span key={t} className="rounded bg-hover px-1.5 py-0.5 text-xs text-muted">
                          {themeName.get(t) ?? t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
