import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { LocalDate } from "@/components/LocalDate";
import { Marginalia } from "@/components/Marginalia";
import { ReplyForm } from "./ReplyForm";
import { ReportButton } from "./ReportButton";

type Post = {
  id: string;
  alias: string;
  line_text: string;
  phrase_start: number | null;
  phrase_end: number | null;
  is_seeded: boolean;
  created_at: string;
  passage: { id: string; author: string; work: string; year: number | null; text: string };
};
type Reply = { id: string; post_id: string; alias: string; text: string; created_at: string };

export default async function ThemeForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ author?: string }>;
}) {
  const { theme: slug } = await params;
  const { author } = await searchParams;
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) notFound();

  const supabase = await createClient();
  // Explicit columns only: user_id is not granted to clients.
  const { data } = await supabase
    .from("posts")
    .select("id, alias, line_text, phrase_start, phrase_end, is_seeded, created_at, passage:passages(id, author, work, year, text)")
    .eq("forum_id", slug)
    .order("created_at", { ascending: false });
  const allPosts = (data ?? []) as unknown as Post[];

  const authors = [...new Set(allPosts.map((p) => p.passage.author))].sort();
  const posts = author ? allPosts.filter((p) => p.passage.author === author) : allPosts;

  const { data: replyRows } = posts.length
    ? await supabase
        .from("replies")
        .select("id, post_id, alias, text, created_at")
        .in("post_id", posts.map((p) => p.id))
        .order("created_at", { ascending: true })
    : { data: [] };
  const repliesByPost = new Map<string, Reply[]>();
  for (const r of (replyRows ?? []) as Reply[]) {
    repliesByPost.set(r.post_id, [...(repliesByPost.get(r.post_id) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/forums" className="text-sm text-muted hover:text-foreground">← All forums</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{theme.name}</h1>
        <p className="mt-1 text-sm text-muted">{theme.description}</p>
      </div>

      {authors.length > 1 && (
        <nav aria-label="Filter by author" className="flex flex-wrap gap-2 text-sm">
          <FilterChip href={`/forums/${slug}`} active={!author}>All authors</FilterChip>
          {authors.map((a) => (
            <FilterChip key={a} href={`/forums/${slug}?author=${encodeURIComponent(a)}`} active={author === a}>
              {a}
            </FilterChip>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="text-muted">
          {author
            ? `No posts linked to ${author} here yet.`
            : "No one has shared here yet. When a line of yours lands in this theme, share it from its passage card."}
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} replies={repliesByPost.get(post.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full border border-rule px-3 py-1 text-muted hover:text-foreground aria-[current=page]:bg-hover aria-[current=page]:text-foreground"
    >
      {children}
    </Link>
  );
}

function PostCard({ post, replies }: { post: Post; replies: Reply[] }) {
  return (
    <article className="rounded border border-rule">
      <Marginalia
        passage={post.passage}
        phraseStart={post.phrase_start}
        phraseEnd={post.phrase_end}
        line={post.line_text}
        meta={
          <>
            {post.alias} · <LocalDate iso={post.created_at} />
            {post.is_seeded && <span title="Seeded by the PhilAI team for the demo"> · seeded</span>}
          </>
        }
      />

      <div className="border-t border-rule px-5 py-4">
        {replies.length > 0 && (
          <ul className="mb-4 flex flex-col gap-3">
            {replies.map((r) => (
              <li key={r.id} className="border-l border-rule pl-3">
                <p className="whitespace-pre-wrap text-sm">{r.text}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {r.alias} · <LocalDate iso={r.created_at} />
                  <ReportButton replyId={r.id} />
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-start gap-3">
          <div className="flex-1"><ReplyForm postId={post.id} /></div>
          <ReportButton postId={post.id} />
        </div>
      </div>
    </article>
  );
}
