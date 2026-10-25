// T9: POST /api/moderate { text } -> ModerateResponse
// Called by the posts/replies routes before anything appears in a forum.
import { NextResponse } from "next/server";
import { z } from "zod";
import { museJson } from "@/lib/muse";
import { createClient } from "@/lib/supabase/server";
import type { ModerateResponse } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 30;

const Schema = z.object({
  status: z.enum(["ok", "flagged"]),
  reason: z.string().nullable(),
});

const SYSTEM = `You moderate short anonymous posts in a reflective journaling community where people share one line of their own writing next to a literary passage. Honest expression of sadness, loneliness, anger, grief, doubt, or past struggles is allowed and expected.
Flag only: harassment or insults aimed at another user; hate speech or slurs; sexual content; threats; encouragement, instructions, or glorification of self-harm or suicide (expressing one's own pain is NOT flagged); doxxing (full names with addresses, phone numbers, emails); spam or advertising.
Return {"status":"ok","reason":null} or {"status":"flagged","reason":"<one short sentence the user will see>"}.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ status: "flagged", reason: "Nothing to post." } satisfies ModerateResponse);

  try {
    const r = await museJson({ system: SYSTEM, user: text, schema: Schema, temperature: 0 });
    const out: ModerateResponse = r.status === "ok" ? { status: "ok", reason: null } : { status: "flagged", reason: r.reason ?? "This can't be posted." };
    return NextResponse.json(out);
  } catch (e) {
    console.error("[moderate] muse failed:", (e as Error).message);
    // Fail closed: nothing unreviewed reaches the forum.
    return NextResponse.json({ status: "flagged", reason: "Moderation is unavailable right now. Try again in a moment." } satisfies ModerateResponse, { status: 503 });
  }
}
