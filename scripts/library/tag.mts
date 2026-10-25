// T4: tag selected passages with Muse Spark: emotions (GoEmotions), themes
// (shared/themes.json), and a one-sentence summary. 5 passages per call,
// labels outside the lists are rejected. Resumable: skips ids already in
// data/passages.tagged.jsonl.
// Run: npx tsx --env-file=.env.local scripts/library/tag.mts
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { z } from "zod";
import { museJson } from "../../src/lib/muse.ts";
import emotionsList from "../../shared/emotions.json" with { type: "json" };
import themesList from "../../shared/themes.json" with { type: "json" };

type Passage = { id: string; author: string; work: string; year: number; text: string };
type Tagged = Passage & { emotions: string[]; themes: string[]; summary: string; quality: number };

const IN = process.env.IN ?? "data/passages.jsonl";
const OUT = process.env.OUT ?? "data/passages.tagged.jsonl";
const BATCH = 5, CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);

const EMO = new Set<string>(emotionsList);
const THEMES = new Set<string>(themesList.map((t) => t.slug));

const Schema = z.object({
  passages: z.array(z.object({
    id: z.string(),
    emotions: z.array(z.string()).min(1).max(4),
    themes: z.array(z.string()).min(1).max(3),
    summary: z.string().min(10),
    quality: z.number().int().min(1).max(5),
  })),
});

const SYSTEM = `You tag passages from classic literature for a journaling app that links a person's diary line to a passage that feels the same way.
For each passage return:
- emotions: 1-3 labels from exactly this list: ${[...EMO].join(", ")}. Pick the feelings the passage expresses or evokes, not the topic.
- themes: 1-2 labels from exactly this list: ${[...THEMES].join(", ")}.
- quality: 1-5. How well the passage stands alone for a stranger with no context: 5 = universal, complete, moving on its own; 3 = understandable but leans on context; 1 = plot fragment, dialogue reply, or needs names/events to make sense. Be strict: most passages are 2-3.
- summary: one plain, modern English sentence (12-25 words) describing the feeling and situation in the passage as a person today might describe their own life. Write in first person when the passage is first person. No names, no archaic words, no quotation.
Return {"passages":[{"id":"...","emotions":[...],"themes":[...],"quality":3,"summary":"..."}]} with every id from the input, in order.`;

const all: Passage[] = readFileSync(IN, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const done = new Set<string>(existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
const todo = all.filter((p) => !done.has(p.id));
console.log(`${all.length} passages, ${done.size} already tagged, ${todo.length} to go`);

const batches: Passage[][] = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
let ok = 0, failed = 0;

async function worker() {
  while (batches.length) {
    const batch = batches.shift()!;
    const user = batch.map((p) => `[${p.id}] (${p.author}, ${p.work})\n${p.text}`).join("\n\n");
    try {
      const res = await museJson({ system: SYSTEM, user, schema: Schema, temperature: 0.1 });
      const byId = new Map(res.passages.map((r) => [r.id, r]));
      for (const p of batch) {
        const r = byId.get(p.id);
        if (!r) { failed++; console.warn("missing", p.id); continue; }
        const emotions = r.emotions.map((e) => e.toLowerCase().trim()).filter((e) => EMO.has(e));
        const themes = r.themes.map((t) => t.toLowerCase().trim()).filter((t) => THEMES.has(t));
        if (!emotions.length || !themes.length) { failed++; console.warn("no valid labels", p.id, r.emotions, r.themes); continue; }
        const row: Tagged = { ...p, emotions: [...new Set(emotions)], themes: [...new Set(themes)], summary: r.summary.trim(), quality: r.quality };
        appendFileSync(OUT, JSON.stringify(row) + "\n");
        ok++;
      }
    } catch (e) {
      failed += batch.length;
      console.warn("batch failed:", (e as Error).message.slice(0, 200));
    }
    if ((ok + failed) % 50 < BATCH) console.log(`tagged ${ok}, failed ${failed}, ${batches.length} batches left`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: ${ok} tagged, ${failed} failed -> ${OUT}`);
