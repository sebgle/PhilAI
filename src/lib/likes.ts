// Likes are server-only rows (RLS on, no client grants), so pages read them
// through the admin client and hand the UI a count plus "did I like this".
// Who liked what never leaves the server, same rule as user_id on posts.
import { createAdminClient } from "@/lib/supabase/server";

export type LikeInfo = { count: number; liked: boolean };

const blank = (): LikeInfo => ({ count: 0, liked: false });

export async function likesFor(postIds: string[], replyIds: string[], userId: string | null) {
  const admin = createAdminClient();
  const posts = new Map<string, LikeInfo>();
  const replies = new Map<string, LikeInfo>();
  const [p, r] = await Promise.all([
    postIds.length ? admin.from("likes").select("post_id, user_id").in("post_id", postIds) : { data: [] },
    replyIds.length ? admin.from("likes").select("reply_id, user_id").in("reply_id", replyIds) : { data: [] },
  ]);
  for (const row of (p.data ?? []) as { post_id: string; user_id: string }[]) {
    const v = posts.get(row.post_id) ?? blank();
    v.count++; if (row.user_id === userId) v.liked = true;
    posts.set(row.post_id, v);
  }
  for (const row of (r.data ?? []) as { reply_id: string; user_id: string }[]) {
    const v = replies.get(row.reply_id) ?? blank();
    v.count++; if (row.user_id === userId) v.liked = true;
    replies.set(row.reply_id, v);
  }
  return { posts, replies };
}
