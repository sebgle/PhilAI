// T7/T12 harness: run the matching pipeline on a text without the web app.
// Usage: npx tsx --env-file=.env.local scripts/test-match.mts [file-or-text] [--mode=line|line+summary]
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../src/lib/embed.ts";
import { analyzeEntry, verifyLines, scoreCandidate, pickPerLine, phraseAndReason, lineQuery, RISK_EXCLUDED_THEMES, type Candidate } from "../src/lib/match-core.ts";

const args = process.argv.slice(2);
const mode = (args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "line+summary") as "line" | "line+summary";
const src = args.find((a) => !a.startsWith("--")) ?? "shared/mock_entry.txt";
const text = existsSync(src) ? readFileSync(src, "utf8").trim() : src;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const t0 = Date.now();
const analysis = await analyzeEntry(text);
const tA = Date.now();
console.log(`analysis ${tA - t0}ms  emotions=${analysis.emotions} themes=${analysis.themes} risk=${analysis.risk_flag}\n  summary: ${analysis.summary}`);
const lines = verifyLines(text, analysis.key_lines);
for (const l of analysis.key_lines) console.log(`  ${lines.some((v) => v.text === text.slice(v.start, v.end) && text.slice(v.start, v.end).includes(l.text.replace(/[’']/g, "").slice(0, 10))) ? "OK  " : "DROP"} [${l.theme}] ${l.text}`);
const fallback = lines.length === 0;
const queries = fallback ? [analysis.summary] : lines.map((l) => lineQuery(l.text, analysis.summary, mode));
const vectors = await embed(queries);
const excluded = analysis.risk_flag ? RISK_EXCLUDED_THEMES : new Set<string>();
const retrieved: Candidate[][] = await Promise.all(vectors.map(async (v) => {
  const { data, error } = await admin.rpc("match_passages", { query_embedding: JSON.stringify(v), match_count: 30 });
  if (error) throw new Error(`match_passages: ${error.message}`);
  return data as Candidate[];
}));
const tR = Date.now();
console.log(`retrieve ${tR - tA}ms (${retrieved.map((r) => r.length).join(",")} candidates)`);
if (fallback) {
  console.log("FALLBACK: no line verified");
  for (const c of retrieved[0].slice(0, 3)) console.log(`  ${c.author}: ${c.text.slice(0, 150)}`);
  process.exit(0);
}
const score = (c: Candidate, i: number) => scoreCandidate(c, analysis.emotions, [lines[i].theme, ...analysis.themes], new Set());
const sorted = retrieved.map((cands, i) => [...cands].sort((a, b) => score(b, i) - score(a, i)));
const picks = pickPerLine(lines, sorted, score, excluded);
const results = await Promise.all(picks.map((p, i) => (p ? phraseAndReason(lines[i].text, analysis.summary, p.cand) : null)));
console.log(`phrases ${Date.now() - tR}ms, total ${Date.now() - t0}ms\n`);
picks.forEach((p, i) => {
  if (!p) return console.log(`LINE "${lines[i].text}" -> no passage`);
  const r = results[i]!;
  console.log(`LINE [${lines[i].theme}] "${lines[i].text}"`);
  console.log(`  -> ${p.cand.author}, ${p.cand.work} (score ${p.score.toFixed(3)}, sim ${p.cand.similarity.toFixed(3)}, ${p.cand.emotions}/${p.cand.themes})`);
  console.log(`     ${p.cand.text.replace(/\n/g, " / ")}`);
  console.log(`     phrase: ${r.phrase_start !== null ? `"${p.cand.text.slice(r.phrase_start, r.phrase_end!)}"` : "(unverified)"}`);
  console.log(`     reason: ${r.reason}`);
  console.log(`     runners-up: ${sorted[i].slice(0, 4).map((c) => `${c.author.split(" ").pop()} ${score(c, i).toFixed(2)}`).join(" | ")}\n`);
});
