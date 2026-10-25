// T5: embed each tagged passage's summary and upsert into public.passages
// with the secret key (bypasses RLS). Run after tag.mts.
// Run: npx tsx --env-file=.env.local scripts/library/load.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../../src/lib/embed.ts";

const MIN_QUALITY = Number(process.env.MIN_QUALITY ?? 4);
const all = readFileSync(process.env.IN ?? "data/passages.tagged.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
// Keep passages that stand alone (quality >= MIN_QUALITY), but never fewer than 8 per work.
const byWork = new Map<string, typeof all>();
for (const r of all) (byWork.get(r.work) ?? byWork.set(r.work, []).get(r.work)!).push(r);
const rows: typeof all = [];
for (const list of byWork.values()) {
  list.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0) || (b.anchor_score ?? 0) - (a.anchor_score ?? 0));
  const good = list.filter((r) => (r.quality ?? 0) >= MIN_QUALITY);
  rows.push(...(good.length >= 8 ? good : list.slice(0, 8)));
}
console.log(`${all.length} tagged -> ${rows.length} kept (quality >= ${MIN_QUALITY}, min 8 per work)`);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
console.log(`embedding ${rows.length} summaries`);
const t0 = Date.now();
for (let i = 0; i < rows.length; i += 64) {
  const chunk = rows.slice(i, i + 64);
  const vecs = await embed(chunk.map((r) => r.summary));
  const payload = chunk.map((r, j) => ({
    id: r.id, author: r.author, work: r.work, year: r.year, text: r.text,
    emotions: r.emotions, themes: r.themes, summary: r.summary, embedding: JSON.stringify(vecs[j]),
  }));
  const { error } = await supabase.from("passages").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  console.log(`upserted ${Math.min(i + 64, rows.length)}/${rows.length}`);
}
console.log(`done in ${Date.now() - t0}ms`);
