// T8: POST /api/scrub { text } -> ScrubResponse
// Regex pass for emails and phone numbers, then Muse Spark for names, places
// and schools. Every span is verified against the text with findSpan, so the
// UI only ever highlights characters that are really there.
import { NextResponse } from "next/server";
import { z } from "zod";
import { museJson } from "@/lib/muse";
import { findSpan } from "@/lib/exact-match";
import { createClient } from "@/lib/supabase/server";
import type { ScrubResponse, ScrubSpan } from "@/lib/contract";

export const runtime = "nodejs";
export const maxDuration = 30;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

const Schema = z.object({
  identifiers: z.array(z.object({
    value: z.string(),
    type: z.enum(["name", "place", "school", "other"]),
  })),
});

const SYSTEM = `You find details in a short journal line that could identify a real person: personal names (first names, surnames, nicknames of real people), specific places (cities, neighborhoods, street names, named buildings, workplaces), and schools (universities, high schools, dorms, named programs). Also flag usernames or handles as "other".
Do not flag: generic words (mom, roommate, school, the city), feelings, famous historical authors, or anything that is not identifying.
Each value must be copied word for word from the text. Return {"identifiers":[{"value":"...","type":"name|place|school|other"}]}. Return an empty list if there is nothing to flag.`;

function allSpans(text: string, value: string, type: ScrubSpan["type"]): ScrubSpan[] {
  const out: ScrubSpan[] = [];
  let from = 0;
  for (let i = 0; i < 20; i++) {
    const hit = findSpan(text.slice(from), value);
    if (!hit) break;
    const start = from + hit.start, end = from + hit.end;
    out.push({ start, end, type, value: text.slice(start, end) });
    from = end;
  }
  return out;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ text, spans: [] } satisfies ScrubResponse);

  const spans: ScrubSpan[] = [];
  for (const m of text.matchAll(EMAIL)) spans.push({ start: m.index!, end: m.index! + m[0].length, type: "email", value: m[0] });
  for (const m of text.matchAll(PHONE)) spans.push({ start: m.index!, end: m.index! + m[0].length, type: "phone", value: m[0] });

  try {
    const { identifiers } = await museJson({ system: SYSTEM, user: text, schema: Schema, temperature: 0 });
    for (const id of identifiers) spans.push(...allSpans(text, id.value, id.type));
  } catch (e) {
    console.error("[scrub] muse failed, returning regex spans only:", (e as Error).message);
  }

  // Drop overlaps (keep the earliest/longest) and sort.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: ScrubSpan[] = [];
  for (const s of spans) if (!merged.length || s.start >= merged[merged.length - 1].end) merged.push(s);

  return NextResponse.json({ text, spans: merged } satisfies ScrubResponse);
}
