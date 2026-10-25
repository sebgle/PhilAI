"use server";

import { createClient } from "@/lib/supabase/server";
import { likesFor } from "@/lib/likes";

// What a tile on Explore needs: the line, where it's from, and its counts.
export type TileData = {
  id: string;
  forum_id: string;
  line: string;
  author: string;
  work: string;
  likes: number;
  replies: number;
};
// Pages run newest first; the cursor is the last tile shown, with its id
// breaking ties between posts made in the same instant.
export type Cursor = { at: string; id: string };

const PAGE_SIZE = 24;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f-]{36}$/i;

export async function exploreTiles(cursor?: Cursor): Promise<{ tiles: TileData[]; next: Cursor | null }> {
  if (cursor && !(ISO.test(cursor.at) && UUID.test(cursor.id))) return { tiles: [], next: null };

  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select("id, forum_id, line_text, created_at, passage:passages(author, work)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.or(`created_at.lt."${cursor.at}",and(created_at.eq."${cursor.at}",id.lt.${cursor.id})`);
  const { data } = await query;
  const posts = (data ?? []) as unknown as {
    id: string; forum_id: string; line_text: string; created_at: string; passage: { author: string; work: string };
  }[];
  if (!posts.length) return { tiles: [], next: null };

  // Tiles show counts only, so replies are fetched as ids.
  const ids = posts.map((p) => p.id);
  const { data: replyRows } = await supabase.from("replies").select("post_id").in("post_id", ids);
  const replyCounts = new Map<string, number>();
  for (const r of replyRows ?? []) replyCounts.set(r.post_id, (replyCounts.get(r.post_id) ?? 0) + 1);
  const { data: { user } } = await supabase.auth.getUser();
  const likes = await likesFor(ids, [], user?.id ?? null);

  const last = posts[posts.length - 1];
  return {
    tiles: posts.map((p) => ({
      id: p.id,
      forum_id: p.forum_id,
      line: p.line_text,
      author: p.passage.author,
      work: p.passage.work,
      likes: likes.posts.get(p.id)?.count ?? 0,
      replies: replyCounts.get(p.id) ?? 0,
    })),
    next: posts.length === PAGE_SIZE ? { at: last.created_at, id: last.id } : null,
  };
}
