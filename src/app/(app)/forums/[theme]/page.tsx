import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { LocalDate } from "@/components/LocalDate";
import { Marginalia } from "@/components/Marginalia";
import { LikeButton } from "@/components/LikeButton";
import { Backdrop } from "@/components/Backdrop";
import { ThemeIcon } from "@/components/ThemeIcon";
import { likesFor, type LikeInfo } from "@/lib/likes";
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
type Reply = { id: string; post_id: string; parent_id: string | null; alias: string; text: string; created_at: string };
type Likes = { posts: Map<string, LikeInfo>; replies: Map<string, LikeInfo> };

const NO_LIKES: LikeInfo = { count: 0, liked: false };

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
        .select("id, post_id, parent_id, alias, text, created_at")
        .in("post_id", posts.map((p) => p.id))
        .order("created_at", { ascending: true })
    : { data: [] };
  const replies = (replyRows ?? []) as Reply[];
  const repliesByPost = new Map<string, Reply[]>();
  for (const r of replies) repliesByPost.set(r.post_id, [...(repliesByPost.get(r.post_id) ?? []), r]);

  // Like counts come from the server side (likes rows are never granted to
  // clients); the signed-in user also learns which ones are theirs.
  const { data: { user } } = await supabase.auth.getUser();
  const likes = await likesFor(posts.map((p) => p.id), replies.map((r) => r.id), user?.id ?? null);

  return (
    <div className="flex flex-col gap-6">
      <Backdrop variant="community" />
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/forums" className="underline-offset-4 hover:text-foreground hover:underline">Community</Link>
          <span aria-hidden="true" className="ml-1.5 opacity-60">/</span>
        </nav>
        <h1 className="mt-1 flex items-center gap-2.5 text-[2rem] font-semibold tracking-tight">
          {theme.name}
          <ThemeIcon slug={theme.slug} className="size-7 text-terracotta" />
        </h1>
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
              <PostCard post={post} replies={repliesByPost.get(post.id) ?? []} likes={likes} />
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

// Replies arrive flat (oldest first). Group them by parent so each level
// renders in order; a reply whose parent is hidden or removed is shown at the
// top level rather than vanishing with it.
function threadReplies(replies: Reply[]) {
  const ids = new Set(replies.map((r) => r.id));
  const children = new Map<string | null, Reply[]>();
  for (const r of replies) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    children.set(key, [...(children.get(key) ?? []), r]);
  }
  return children;
}

function PostCard({ post, replies, likes }: { post: Post; replies: Reply[]; likes: Likes }) {
  const children = threadReplies(replies);
  const roots = children.get(null) ?? [];
  const postLikes = likes.posts.get(post.id) ?? NO_LIKES;
  return (
    <article className="rounded-lg border border-rule bg-card/70">
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4 text-sm text-muted">
        <LikeButton postId={post.id} count={postLikes.count} liked={postLikes.liked} />
        {replies.length > 0 && (
          <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
        )}
        <ReplyForm postId={post.id} />
        <span className="ml-auto"><ReportButton postId={post.id} /></span>
      </div>

      {roots.length > 0 && (
        <ul className="flex flex-col gap-4 border-t border-rule px-5 py-4">
          {roots.map((r) => (
            <ReplyNode key={r.id} reply={r} postId={post.id} children_={children} likes={likes} depth={0} />
          ))}
        </ul>
      )}
    </article>
  );
}

// Nested replies indent for the first few levels, then stay put so a long
// back-and-forth doesn't squeeze itself off a phone screen.
const MAX_INDENT = 3;

function ReplyNode({
  reply,
  postId,
  children_,
  likes,
  depth,
}: {
  reply: Reply;
  postId: string;
  children_: Map<string | null, Reply[]>;
  likes: Likes;
  depth: number;
}) {
  const kids = children_.get(reply.id) ?? [];
  const mine = likes.replies.get(reply.id) ?? NO_LIKES;
  return (
    <li className="border-l border-rule pl-3">
      <p className="text-xs text-muted">{reply.alias} · <LocalDate iso={reply.created_at} /></p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{reply.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <LikeButton replyId={reply.id} count={mine.count} liked={mine.liked} />
        <ReplyForm postId={postId} parentId={reply.id} parentAlias={reply.alias} />
        <ReportButton replyId={reply.id} />
      </div>
      {kids.length > 0 && (
        <ul className={`mt-3 flex flex-col gap-3 ${depth < MAX_INDENT ? "ml-2" : ""}`}>
          {kids.map((k) => (
            <ReplyNode key={k.id} reply={k} postId={postId} children_={children_} likes={likes} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
