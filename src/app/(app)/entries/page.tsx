import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { PageTitle } from "@/components/PageTitle";
import { Backdrop } from "@/components/Backdrop";
import { THEMES } from "@/lib/contract";

const themeName = new Map(THEMES.map((t) => [t.slug, t.name]));

// Every entry, newest first.
export default async function PastEntries() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, title, text, prompt, themes, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="flex flex-col gap-5">
        <Backdrop variant="entries" />
        <PageTitle title="Entries" />

        {error && <p className="text-red-600">{error.message}</p>}

        {entries && entries.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-rule p-6">
            <p className="text-muted">Nothing here yet. Each entry you write lands here, with the passages it found.</p>
            <Link href="/" className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-white hover:bg-terracotta-deep">
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
                  className="block rounded-lg border border-rule bg-card/70 px-5 py-4 transition-colors hover:bg-hover/70"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm text-muted">
                    <span className="text-[17px] font-medium text-foreground">{e.title || `Entry #${entries.length - i}`}</span>
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
  );
}
