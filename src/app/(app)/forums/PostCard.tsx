import type { createClient } from "@/lib/supabase/server";
import { LocalDate } from "@/components/LocalDate";
import { Marginalia } from "@/components/Marginalia";
import { LikeButton } from "@/components/LikeButton";
import { likesFor, type LikeInfo } from "@/lib/likes";
import { ReplyThread, ReplyButton, ReplyComposer } from "./ReplyComposer";
import { ReportButton } from "./ReportButton";

// One post as strangers see it. Explore tiles open these in their room.
export type Post = {
  id: string;
  forum_id: string;
  alias: string;
  line_text: string;
  phrase_start: number | null;
  phrase_end: number | null;
  is_seeded: boolean;
  created_at: string;
  passage: { id: string; author: string; work: string; year: number | null; text: string };
};
type Reply = { id: string; post_id: string; parent_id: string | null; alias: string; text: string; created_at: string };
export type Thread = { repliesByPost: Map<string, Reply[]>; likes: Likes };
type Likes = { posts: Map<string, LikeInfo>; replies: Map<string, LikeInfo> };

// Explicit columns only: user_id is not granted to clients.
export const POST_COLUMNS =
  "id, forum_id, alias, line_text, phrase_start, phrase_end, is_seeded, created_at, passage:passages(id, author, work, year, text)";

const NO_LIKES: LikeInfo = { count: 0, liked: false };

// Replies and like counts for a page of posts. Likes come from the server side
// (likes rows are never granted to clients); the signed-in user also learns
// which ones are theirs.
export async function loadThreads(supabase: Awaited<ReturnType<typeof createClient>>, posts: Post[]): Promise<Thread> {
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

  const { data: { user } } = await supabase.auth.getUser();
  const likes = await likesFor(posts.map((p) => p.id), replies.map((r) => r.id), user?.id ?? null);
  return { repliesByPost, likes };
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

export function PostCard({ post, thread }: { post: Post; thread: Thread }) {
  const replies = thread.repliesByPost.get(post.id) ?? [];
  const children = threadReplies(replies);
  const roots = children.get(null) ?? [];
  const postLikes = thread.likes.posts.get(post.id) ?? NO_LIKES;
  return (
    <article className="rounded-lg border border-rule bg-card">
      <ReplyThread>
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
          <span className="ml-auto"><ReportButton postId={post.id} /></span>
        </div>

        {roots.length > 0 && (
          <ul className="flex flex-col gap-4 border-t border-rule px-5 py-4">
            {roots.map((r) => (
              <ReplyNode key={r.id} reply={r} postId={post.id} children_={children} likes={thread.likes} depth={0} />
            ))}
          </ul>
        )}

        <ReplyComposer postId={post.id} />
      </ReplyThread>
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
        <ReplyButton id={reply.id} alias={reply.alias} />
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
