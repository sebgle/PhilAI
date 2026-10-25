import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { ThemeIcon } from "@/components/ThemeIcon";
import { PostCard, POST_COLUMNS, loadThreads, type Post } from "../forums/PostCard";

// One post with its whole thread, under the name of the room it lives in.
// Rendered both as the Explore popup and as the page a shared link opens.
export async function PostDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const post = data as unknown as Post;
  const thread = await loadThreads(supabase, [post]);
  const room = THEMES.find((t) => t.slug === post.forum_id);

  return (
    <div className="flex flex-col gap-3">
      {room && (
        <Link
          href={`/forums/${room.slug}`}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted hover:text-foreground"
        >
          <ThemeIcon slug={room.slug} className="size-4 text-terracotta" />
          {room.name}
        </Link>
      )}
      <PostCard post={post} thread={thread} />
    </div>
  );
}
