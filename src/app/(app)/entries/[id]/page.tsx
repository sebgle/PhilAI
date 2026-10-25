import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";

// One saved entry. S4 turns this into the Matches screen (highlights + passage cards).
export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS limits this to the signed-in user's own entries.
  const { data: entry } = await supabase
    .from("entries")
    .select("id, text, prompt, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!entry) notFound();

  return (
    <article className="flex flex-col gap-4">
      <div className="text-sm opacity-60">
        <LocalDate iso={entry.created_at} withTime />
      </div>
      {entry.prompt && <p className="text-sm italic opacity-70">{entry.prompt}</p>}
      <p className="whitespace-pre-wrap leading-relaxed">{entry.text}</p>
      <p className="text-sm opacity-50">Literature that matches this entry will appear here.</p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">Write another</Link>
        <Link href="/entries" className="underline">All entries</Link>
      </div>
    </article>
  );
}
