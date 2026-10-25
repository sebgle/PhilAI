// Memo for LLM answers that depend only on the text (scrub, moderate). Keyed
// by a hash of kind + text; the row holds the parsed JSON answer. Misses and
// storage errors never fail the caller: if the table is missing or the write
// fails, the answer is just computed and returned as before.
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

export type CacheKind = "scrub" | "moderate";

function keyFor(kind: CacheKind, text: string) {
  return createHash("sha256").update(`${kind}\n${text.trim()}`).digest("hex");
}

export async function cacheGet<T>(kind: CacheKind, text: string): Promise<T | undefined> {
  try {
    const { data, error } = await createAdminClient().from("llm_cache").select("value").eq("key", keyFor(kind, text)).maybeSingle();
    if (error || !data) return undefined;
    return data.value as T;
  } catch {
    return undefined;
  }
}

export async function cacheSet(kind: CacheKind, text: string, value: unknown) {
  try {
    const { error } = await createAdminClient().from("llm_cache").upsert({ key: keyFor(kind, text), kind, value });
    if (error) console.warn(`[llm-cache] ${kind} write skipped: ${error.message}`);
  } catch (e) {
    console.warn(`[llm-cache] ${kind} write skipped: ${(e as Error).message}`);
  }
}

// Read-through: return the stored answer, or compute it and store it when the
// compute step says the answer is worth keeping (a Muse outage is not).
export async function cached<T>(kind: CacheKind, text: string, compute: () => Promise<{ value: T; keep: boolean }>): Promise<T> {
  const hit = await cacheGet<T>(kind, text);
  if (hit !== undefined) return hit;
  const { value, keep } = await compute();
  if (keep) await cacheSet(kind, text, value);
  return value;
}
