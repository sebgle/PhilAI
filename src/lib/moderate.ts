// T9 moderation core, shared by /api/moderate and the posts/replies routes so
// forum writes don't need an extra HTTP hop.
import { z } from "zod";
import { museJson } from "@/lib/muse";
import type { ModerateResponse } from "@/lib/contract";

const Schema = z.object({
  status: z.enum(["ok", "flagged"]),
  reason: z.string().nullable(),
});

const SYSTEM = `You moderate short anonymous posts in a reflective journaling community where people share one line of their own writing next to a literary passage. Honest expression of sadness, loneliness, anger, grief, doubt, or past struggles is allowed and expected.
Flag only: harassment or insults aimed at another user; hate speech or slurs; sexual content; threats; encouragement, instructions, or glorification of self-harm or suicide (expressing one's own pain is NOT flagged); doxxing (full names with addresses, phone numbers, emails); spam or advertising.
Return {"status":"ok","reason":null} or {"status":"flagged","reason":"<one short sentence the user will see>"}.`;

// `unavailable` is set when Muse couldn't be reached. Callers fail closed:
// nothing unreviewed reaches the forum.
export async function moderateText(text: string): Promise<ModerateResponse & { unavailable?: true; detail?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { status: "flagged", reason: "Nothing to post." };
  try {
    const r = await museJson({ system: SYSTEM, user: trimmed, schema: Schema, temperature: 0 });
    return r.status === "ok"
      ? { status: "ok", reason: null }
      : { status: "flagged", reason: r.reason ?? "This can't be posted." };
  } catch (e) {
    console.error("[moderate] muse failed:", (e as Error).message);
    return {
      status: "flagged",
      reason: "Moderation is unavailable right now. Try again in a moment.",
      unavailable: true,
      detail: (e as Error).message.slice(0, 300),
    };
  }
}
