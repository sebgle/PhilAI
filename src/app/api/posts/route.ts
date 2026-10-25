// S6: POST /api/posts { entry_id, forum_id, line_text, passage_id, phrase_start, phrase_end }
// Shares one highlighted line to a theme forum. The entry is checked (it must be
// the user's own and not risk-flagged) but never stored on the post, and
// user_id never leaves the server.
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { moderateText } from "@/lib/moderate";
import { THEMES } from "@/lib/contract";
import { MAX_LINE, randomAlias } from "@/lib/forum";

export const runtime = "nodejs";
export const maxDuration = 30;

const THEME_SLUGS = new Set(THEMES.map((t) => t.slug));
const isInt = (v: unknown): v is number => Number.isInteger(v);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to post." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lineText = typeof body?.line_text === "string" ? body.line_text.trim() : "";
  const { entry_id: entryId, forum_id: forumId, passage_id: passageId } = body ?? {};
  const phraseStart = body?.phrase_start ?? null;
  const phraseEnd = body?.phrase_end ?? null;

  if (!lineText || lineText.length > MAX_LINE) {
    return NextResponse.json({ error: `Lines are 1–${MAX_LINE} characters.` }, { status: 400 });
  }
  if (typeof forumId !== "string" || !THEME_SLUGS.has(forumId)) {
    return NextResponse.json({ error: "Unknown forum." }, { status: 400 });
  }
  if (typeof entryId !== "string" || typeof passageId !== "string") {
    return NextResponse.json({ error: "entry_id and passage_id are required." }, { status: 400 });
  }

  // RLS: only finds the entry if it belongs to this user.
  const { data: entry } = await supabase.from("entries").select("risk_flag").eq("id", entryId).maybeSingle();
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  if (entry.risk_flag) {
    return NextResponse.json({ error: "Sharing is turned off for this entry." }, { status: 403 });
  }

  const { data: passage } = await supabase.from("passages").select("text").eq("id", passageId).maybeSingle();
  if (!passage) return NextResponse.json({ error: "Passage not found." }, { status: 404 });
  const phraseOk =
    (phraseStart === null && phraseEnd === null) ||
    (isInt(phraseStart) && isInt(phraseEnd) && phraseStart >= 0 && phraseStart < phraseEnd && phraseEnd <= passage.text.length);
  if (!phraseOk) return NextResponse.json({ error: "Invalid phrase offsets." }, { status: 400 });

  const mod = await moderateText(lineText);
  if (mod.status === "flagged") {
    return NextResponse.json({ error: mod.reason }, { status: mod.unavailable ? 503 : 422 });
  }

  const admin = createAdminClient();
  const alias = randomAlias();
  const { data: post, error } = await admin
    .from("posts")
    .insert({
      forum_id: forumId,
      user_id: user.id,
      alias,
      line_text: lineText,
      passage_id: passageId,
      phrase_start: phraseStart,
      phrase_end: phraseEnd,
    })
    .select("id, forum_id, alias, line_text, passage_id, phrase_start, phrase_end, is_seeded, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: aliasError } = await admin
    .from("thread_aliases")
    .insert({ post_id: post.id, user_id: user.id, alias });
  if (aliasError) {
    await admin.from("posts").delete().eq("id", post.id);
    return NextResponse.json({ error: aliasError.message }, { status: 500 });
  }

  return NextResponse.json(post, { status: 201 });
}
