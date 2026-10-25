import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { LocalDate } from "@/components/LocalDate";
import { Marginalia } from "@/components/Marginalia";
import { Backdrop } from "@/components/Backdrop";

// S8: read-only author page. Every passage by the author in the library, and
// every visible post linked to one of them, across all theme forums. A
// database filter, not a separate forum: no posting here.
type Passage = { id: string; author: string; work: string; year: number | null; text: string };
type Post = {
  id: string;
  forum_id: string;
  alias: string;
  line_text: string;
  phrase_start: number | null;
  phrase_end: number | null;
  is_seeded: boolean;
  created_at: string;
  passage: Passage;
};

export default async function AuthorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const supabase = await createClient();

  const { data: passageRows } = await supabase
    .from("passages")
    .select("id, author, work, year, text")
    .eq("author", name)
    .order("work")
    .order("id");
  const passages = (passageRows ?? []) as Passage[];
  if (passages.length === 0) notFound();

  // Explicit columns only: user_id is not granted to clients.
  const { data: postRows } = await supabase
    .from("posts")
    .select("id, forum_id, alias, line_text, phrase_start, phrase_end, is_seeded, created_at, passage:passages!inner(id, author, work, year, text)")
    .eq("passages.author", name)
    .order("created_at", { ascending: false });
  const posts = (postRows ?? []) as unknown as Post[];

  const works = [...new Map(passages.map((p) => [p.work, p.year])).entries()];
  const themeName = (slug: string) => THEMES.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/forums" className="text-sm text-muted hover:text-foreground">← Community</Link>
        <Backdrop variant="community" />
        <h1 className="mt-2 text-[2rem] font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted">
          {passages.length} passage{passages.length === 1 ? "" : "s"} from{" "}
          {works.map(([work, year], i) => (
            <span key={work}>
              {i > 0 && (i === works.length - 1 ? " and " : ", ")}
              <cite>{work}</cite>{year ? ` (${year})` : ""}
            </span>
          ))}
          . {posts.length === 0 ? "No one has shared a line with this author yet." : `${posts.length} line${posts.length === 1 ? "" : "s"} shared next to these passages.`}
        </p>
      </div>

      {posts.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">What strangers wrote beside {name.split(" ").pop()}</h2>
          <ul className="flex flex-col gap-6">
            {posts.map((post) => (
              <li key={post.id}>
                <article className="rounded border border-rule">
                  <Marginalia
                    passage={post.passage}
                    phraseStart={post.phrase_start}
                    phraseEnd={post.phrase_end}
                    line={post.line_text}
                    meta={
                      <>
                        {post.alias} · <LocalDate iso={post.created_at} /> ·{" "}
                        <Link href={`/forums/${post.forum_id}`} className="underline hover:text-foreground">
                          {themeName(post.forum_id)}
                        </Link>
                        {post.is_seeded && <span title="Seeded by the PhilAI team for the demo"> · seeded</span>}
                      </>
                    }
                  />
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Passages</h2>
        <ul className="flex flex-col gap-5">
          {passages.map((p) => (
            <li key={p.id} className="rounded border border-rule p-5">
              <blockquote className="whitespace-pre-line font-serif text-lg leading-relaxed">{p.text}</blockquote>
              <p className="mt-2 text-sm text-muted">
                <cite>{p.work}</cite>{p.year ? ` (${p.year})` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
