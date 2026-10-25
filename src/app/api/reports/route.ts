// S6: POST /api/reports { post_id } or { reply_id }, optional reason
// One report per user per item. Once REPORT_THRESHOLD distinct people report
// something it's hidden until someone reviews it.
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { REPORT_THRESHOLD } from "@/lib/forum";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const postId = typeof body?.post_id === "string" ? body.post_id : null;
  const replyId = typeof body?.reply_id === "string" ? body.reply_id : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;
  if ((postId === null) === (replyId === null)) {
    return NextResponse.json({ error: "Send exactly one of post_id or reply_id." }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = postId ? "posts" : "replies";
  const column = postId ? "post_id" : "reply_id";
  const targetId = (postId ?? replyId)!;

  const { data: target } = await admin.from(table).select("id").eq("id", targetId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: already } = await admin
    .from("reports")
    .select("id")
    .eq(column, targetId)
    .eq("reporter_id", user.id)
    .maybeSingle();
  if (!already) {
    const { error } = await admin.from("reports").insert({ [column]: targetId, reporter_id: user.id, reason });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: reporters } = await admin.from("reports").select("reporter_id").eq(column, targetId);
  const distinct = new Set((reporters ?? []).map((r) => r.reporter_id)).size;
  if (distinct >= REPORT_THRESHOLD) {
    await admin.from(table).update({ status: "hidden" }).eq("id", targetId).eq("status", "visible");
  }

  return NextResponse.json({ ok: true });
}
