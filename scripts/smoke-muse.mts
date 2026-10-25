// T1: one Muse Spark JSON call. Run: npx tsx --env-file=.env.local scripts/smoke-muse.mts
import { z } from "zod";
import { museJson } from "../src/lib/muse.ts";

const Schema = z.object({
  emotions: z.array(z.string()),
  themes: z.array(z.string()),
  summary: z.string(),
  key_lines: z.array(z.object({ text: z.string(), theme: z.string() })),
});
const entry = "First week at the new school and I keep smiling at everyone like it's fine. Everyone already has their people. I don't belong anywhere yet.";
const t0 = Date.now();
const out = await museJson({
  system: "You analyze a journal entry. Return {emotions: string[], themes: string[], summary: string, key_lines: [{text, theme}]}. key_lines are 2-3 sentences copied word for word from the entry.",
  user: entry,
  schema: Schema,
});
console.log(JSON.stringify(out, null, 2));
for (const l of out.key_lines) console.log(entry.includes(l.text) ? "VERIFIED" : "NOT FOUND", "|", l.text);
console.log(`muse spark ok in ${Date.now() - t0}ms`);
