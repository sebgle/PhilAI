// POST /api/likes { post_id } or { reply_id }: toggles the signed-in user's
// like on a visible post or reply and returns { liked, count }. One like per
// person per item; the response never says who else liked it.
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DUPLICATE } from "@/lib/forum";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to like." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const postId = typeof body?.post_id === "string" ? body.post_id : null;
  const replyId = typeof body?.reply_id === "string" ? body.reply_id : null;
  if ((postId === null) === (replyId === null)) {
    return NextResponse.json({ error: "Send exactly one of post_id or reply_id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = postId ? "posts" : "replies";
  const column = postId ? "post_id" : "reply_id";
  const targetId = (postId ?? replyId)!;

  const { data: target } = await admin.from(table).select("id, status").eq("id", targetId).maybeSingle();
  if (!target || target.status !== "visible") return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: existing } = await admin
    .from("likes")
    .select("user_id")
    .eq(column, targetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("likes").delete().eq(column, targetId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from("likes").insert({ [column]: targetId, user_id: user.id });
    // A double-tap can race itself; the unique index makes the second insert a no-op.
    if (error && error.code !== DUPLICATE) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await admin.from("likes").select("user_id", { count: "exact", head: true }).eq(column, targetId);
  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
