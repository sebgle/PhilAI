// T7/T12 harness: run the matching pipeline on a text without the web app.
// Usage: npx tsx --env-file=.env.local scripts/test-match.mts [file-or-text] [--legacy] [--mode=line|line+summary]
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../src/lib/embed.ts";
import { findSpan } from "../src/lib/exact-match.ts";
import { analyzeEntry, verifyLines, scoreCandidate, pickPerLine, phraseAndReason, lineQuery, RISK_EXCLUDED_THEMES, withRetry, type Candidate } from "../src/lib/match-core.ts";

import { shortlist, reviewPassages, assignInsights } from "../src/lib/insight-match.ts";

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
for (const l of analysis.key_lines) console.log(`  ${findSpan(text, l.text) ? "OK  " : "DROP"} [${l.theme}] ${l.text}`);
const fallback = lines.length === 0;
const queries = fallback ? [analysis.summary] : lines.map((l) => lineQuery(l.text, args.includes("--legacy") ? analysis.summary : l.interpretation ?? analysis.summary, mode));
const vectors = await embed(queries);
const excluded = analysis.risk_flag ? RISK_EXCLUDED_THEMES : new Set<string>();
const retrieved: Candidate[][] = await Promise.all(vectors.map((v) => withRetry(async () => {
  const { data, error } = await admin.rpc("match_passages", { query_embedding: JSON.stringify(v), match_count: 30 });
  if (error) throw new Error(`match_passages: ${error.message}`);
  return data as Candidate[];
})));
const tR = Date.now();
console.log(`retrieve ${tR - tA}ms (${retrieved.map((r) => r.length).join(",")} candidates)`);
if (!args.includes("--legacy")) {
  const taste = new Set<string>();
  const pools = retrieved.map((cs, i) => shortlist(cs, excluded, (c) => scoreCandidate(c, analysis.emotions, fallback ? analysis.themes : [lines[i].theme], taste)));
  const reviewed = await Promise.all(pools.map((candidates, i) => reviewPassages({ line: fallback ? null : lines[i].text,
    interpretation: fallback ? analysis.summary : lines[i].interpretation ?? analysis.summary, context: text, candidates, excluded, deadline: Date.now() + 45_000 })));
  const assigned = assignInsights(reviewed);
  console.log(JSON.stringify({ pipeline: "insight", elapsedMs: Date.now() - t0,
    results: assigned.map((ps, i) => ({ line: fallback ? null : lines[i].text, interpretation: fallback ? analysis.summary : lines[i].interpretation,
      passages: ps.map((p) => ({ id: p.cand.id, author: p.cand.author, text: p.cand.text, score: p.score, reason: p.reason })) })) }, null, 2));
  process.exit(0);
}
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
