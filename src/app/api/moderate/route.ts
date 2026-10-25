// T9: POST /api/moderate { text } -> ModerateResponse
// The posts/replies routes call moderateText() directly; this endpoint serves the share preview.
import { NextResponse } from "next/server";
import { moderateText } from "@/lib/moderate";
import { createClient } from "@/lib/supabase/server";
import type { ModerateResponse } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const { unavailable, ...out } = await moderateText(text);
  return NextResponse.json(out satisfies ModerateResponse, { status: unavailable ? 503 : 200 });
}
