// The bell: replies other people left on your forum posts. Server-only, since
// posts.user_id is never readable by clients; uses the admin client and never
// returns anyone's user_id.
import { createAdminClient } from "@/lib/supabase/server";

async function myPostIds(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from("posts").select("id").eq("user_id", userId);
  return (data ?? []).map((p) => p.id as string);
}

async function seenAt(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.from("users").select("replies_seen_at").eq("id", userId).single();
  return (data?.replies_seen_at as string | undefined) ?? new Date(0).toISOString();
}

export async function unreadReplyCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const [ids, since] = await Promise.all([myPostIds(admin, userId), seenAt(admin, userId)]);
  if (!ids.length) return 0;
  const { count } = await admin
    .from("replies")
    .select("id", { count: "exact", head: true })
    .in("post_id", ids)
    .neq("user_id", userId)
    .eq("status", "visible")
    .gt("created_at", since);
  return count ?? 0;
}

export type ReplyNotice = {
  id: string;
  alias: string;
  text: string;
  created_at: string;
  unread: boolean;
  post: { id: string; forum_id: string; line_text: string };
};

export async function recentReplies(userId: string, limit = 30): Promise<ReplyNotice[]> {
  const admin = createAdminClient();
  const [ids, since] = await Promise.all([myPostIds(admin, userId), seenAt(admin, userId)]);
  if (!ids.length) return [];
  const { data } = await admin
    .from("replies")
    .select("id, alias, text, created_at, post:posts(id, forum_id, line_text)")
    .in("post_id", ids)
    .neq("user_id", userId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Omit<ReplyNotice, "unread">[]).map((r) => ({
    ...r,
    unread: r.created_at > since,
  }));
}

export async function markRepliesSeen(userId: string) {
  await createAdminClient().from("users").update({ replies_seen_at: new Date().toISOString() }).eq("id", userId);
}
