// Read-only comparison using synthetic journals and the existing passage library.
// npx tsx --env-file=.env.local scripts/evaluate-matches.mts --limit=3 --out=report.json
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { embed } from "../src/lib/embed.ts";
import { analyzeEntry, verifyLines, scoreCandidate, pickPerLine, phraseAndReason, lineQuery, RISK_EXCLUDED_THEMES, type Candidate } from "../src/lib/match-core.ts";
import { shortlist, reviewPassages, assignInsights } from "../src/lib/insight-match.ts";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 12);
const caseId = args.find((a) => a.startsWith("--case="))?.split("=")[1];
const out = args.find((a) => a.startsWith("--out="))?.slice(6);
const fixtures = JSON.parse(readFileSync("shared/match-evaluation.json", "utf8")) as { id: string; text: string; expected_focus: string }[];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const report: unknown[] = [];
async function retrieve(queries: string[]) {
  const vectors = await embed(queries);
  return Promise.all(vectors.map(async (v) => {
    const { data, error } = await db.rpc("match_passages", { query_embedding: JSON.stringify(v), match_count: 30 });
    if (error) throw error;
    return data as Candidate[];
  }));
}
for (const fixture of fixtures.filter((f) => !caseId || f.id === caseId).slice(0, limit)) {
  console.log(`Evaluating ${fixture.id} (synthetic text; database reads only)`);
  const started = Date.now();
  try {
    const analysis = await analyzeEntry(fixture.text, Date.now() + 30_000);
    const lines = verifyLines(fixture.text, analysis.key_lines);
    if (!lines.length) throw new Error("No verified snippets in synthetic case");
    const analysisMs = Date.now() - started;
    const excluded = analysis.risk_flag ? RISK_EXCLUDED_THEMES : new Set<string>();
    const oldStarted = Date.now();
    const legacy = args.includes("--insight-only") ? null : await (async () => {
      const oldPools = await retrieve(lines.map((l) => lineQuery(l.text, analysis.summary)));
      const score = (c: Candidate, i: number) => scoreCandidate(c, analysis.emotions, [lines[i].theme, ...analysis.themes], new Set());
      const oldSorted = oldPools.map((cs, i) => [...cs].sort((a, b) => score(b, i) - score(a, i)));
      const oldPicks = pickPerLine(lines, oldSorted, score, excluded);
      return await Promise.all(oldPicks.map(async (p, i) => p ? {
        line: lines[i].text, id: p.cand.id, author: p.cand.author, text: p.cand.text,
        ...(await phraseAndReason(lines[i].text, analysis.summary, p.cand, Date.now() + 30_000)),
      } : null));
    })().catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
    const legacyMs = Date.now() - oldStarted;
    const newStarted = Date.now();
    const newPools = await retrieve(lines.map((l) => lineQuery(l.text, l.interpretation ?? analysis.summary)));
    const pools = newPools.map((cs, i) => shortlist(cs, excluded, (c) => scoreCandidate(c, analysis.emotions, [lines[i].theme], new Set())));
    const judgments: unknown[] = [];
    const reviewed = await Promise.all(pools.map((candidates, i) => reviewPassages({ line: lines[i].text,
      interpretation: lines[i].interpretation ?? analysis.summary, context: fixture.text,
      candidates, excluded, onReview: (review) => { judgments[i] = review; }, deadline: Date.now() + 45_000 })));
    const insight = assignInsights(reviewed).map((ps, i) => ({ line: lines[i].text, interpretation: lines[i].interpretation,
      passages: ps.map((p) => ({ id: p.cand.id, author: p.cand.author, text: p.cand.text, reason: p.reason, score: p.score })) }));
    report.push({ ...fixture, risk_flag: analysis.risk_flag, analysisMs, legacyMs, insightMs: Date.now() - newStarted,
      legacy, insight, judgments, totalMs: Date.now() - started });
    console.log(`Completed ${fixture.id} in ${Date.now() - started}ms`);
  } catch (e) {
    report.push({ id: fixture.id, error: e instanceof Error ? e.message : String(e), totalMs: Date.now() - started });
    console.log(`Could not complete ${fixture.id}`);
  }
  if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
}
if (!out) console.log(JSON.stringify(report, null, 2));
