// S6: POST /api/replies { post_id, text }
// One level of replies. A user keeps one alias per thread: reused if they've
// posted in it before, otherwise a new one that's unique within the thread.
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { moderateText } from "@/lib/moderate";
import { DUPLICATE, MAX_REPLY, randomAlias } from "@/lib/forum";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to reply." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const postId = body?.post_id;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (typeof postId !== "string") return NextResponse.json({ error: "post_id is required." }, { status: 400 });
  if (!text || text.length > MAX_REPLY) {
    return NextResponse.json({ error: `Replies are 1–${MAX_REPLY} characters.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: post } = await admin.from("posts").select("status").eq("id", postId).maybeSingle();
  if (!post || post.status !== "visible") return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const mod = await moderateText(text);
  if (mod.status === "flagged") {
    return NextResponse.json({ error: mod.reason }, { status: mod.unavailable ? 503 : 422 });
  }

  const alias = await threadAlias(admin, postId, user.id);
  if (!alias) return NextResponse.json({ error: "Couldn't assign an alias. Try again." }, { status: 500 });

  const { data: reply, error } = await admin
    .from("replies")
    .insert({ post_id: postId, user_id: user.id, alias, text })
    .select("id, post_id, alias, text, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(reply, { status: 201 });
}

async function threadAlias(admin: ReturnType<typeof createAdminClient>, postId: string, userId: string) {
  const { data: existing } = await admin
    .from("thread_aliases")
    .select("alias")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.alias as string;

  // unique (post_id, alias) rejects a collision; a few retries is plenty.
  for (let i = 0; i < 5; i++) {
    const alias = randomAlias();
    const { error } = await admin.from("thread_aliases").insert({ post_id: postId, user_id: userId, alias });
    if (!error) return alias;
    if (error.code !== DUPLICATE) return null;
    // A concurrent request may have just created this user's alias.
    const { data: raced } = await admin
      .from("thread_aliases")
      .select("alias")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (raced) return raced.alias as string;
  }
  return null;
}
