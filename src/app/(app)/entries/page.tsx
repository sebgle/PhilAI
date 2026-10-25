import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { THEMES } from "@/lib/contract";

const themeName = new Map(THEMES.map((t) => [t.slug, t.name]));

export default async function PastEntries() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, text, prompt, themes, created_at")
    .order("created_at", { ascending: false });

  if (error) return <p className="text-red-600">{error.message}</p>;

  if (!entries.length) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">Past entries</h1>
        <p className="opacity-70">Nothing here yet. Your entries will collect here, along with the passages they find.</p>
        <Link href="/" className="underline">Write your first entry</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Past entries</h1>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <li key={e.id}>
            <Link
              href={`/entries/${e.id}`}
              className="block rounded border border-foreground/10 p-4 hover:border-foreground/30"
            >
              <div className="text-sm opacity-60">
                <LocalDate iso={e.created_at} />
                {e.prompt && <span> · {e.prompt}</span>}
              </div>
              <p className="mt-1 line-clamp-3">{e.text}</p>
              {e.themes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.themes.map((t: string) => (
                    <span key={t} className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
                      {themeName.get(t) ?? t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
