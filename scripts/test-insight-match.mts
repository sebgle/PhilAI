import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { acceptReview, assignInsights, shortlist, ReviewSchema, reviewPassages, journalContext } from "../src/lib/insight-match.ts";
import { isCurrentMatch, MATCH_VERSION } from "../src/lib/match-version.ts";
import { analyzeEntry, verifyLines, RISK_EXCLUDED_THEMES, type Candidate } from "../src/lib/match-core.ts";

function candidate(id = "a", author = "One"): Candidate {
  return { id, author, work: "Test", year: null, text: `Keeping every feeling hidden can leave a friend outside the door. ${id}`, emotions: [], themes: ["belonging"], summary: null, similarity: 0.8 };
}
function evaluation(id = "a") {
  return { id, fit: 3, insight: 2, standalone: true, evidence: "leave a friend outside the door", phrase: "leave a friend outside the door",
    reason: "The passage links hiding feelings with distance. It offers a way to consider what sharing might make possible.", perspective: "concealment and connection", connection_kind: "recognition" as const, redundant_with: [] as string[] };
}
const review = (...evaluations: ReturnType<typeof evaluation>[]) => ({ evaluations });

test("mood-only matches are rejected, including high similarity candidates", () => {
  assert.equal(acceptReview(review({ ...evaluation(), fit: 1 }), [candidate()]).length, 0);
  assert.equal(acceptReview(review({ ...evaluation(), insight: 1 }), [candidate()]).length, 0);
});
test("acceptance requires an understandable passage and verified evidence", () => {
  assert.equal(acceptReview(review({ ...evaluation(), standalone: false }), [candidate()]).length, 0);
  assert.equal(acceptReview(review({ ...evaluation(), evidence: "invented evidence" }), [candidate()]).length, 0);
  assert.equal(acceptReview(review({ ...evaluation(), reason: "" }), [candidate()]).length, 0);
});
test("invalid IDs, duplicates, and malformed scores fail closed", () => {
  assert.throws(() => acceptReview(review(evaluation("unknown")), [candidate()]));
  assert.throws(() => acceptReview(review(evaluation(), evaluation()), [candidate()]));
  assert.equal(ReviewSchema.safeParse(review({ ...evaluation(), fit: 9 })).success, false);
});
test("phrase highlights are verified against original text", () => {
  const [p] = acceptReview(review(evaluation()), [candidate()]);
  assert.equal(p.cand.text.slice(p.phrase_start!, p.phrase_end!), evaluation().phrase);
  const [q] = acceptReview(review({ ...evaluation(), phrase: "made up" }), [candidate()]);
  assert.equal(q.phrase_start, null);
});
test("risk themes are removed before comparison and checked again at acceptance", () => {
  const c = { ...candidate(), themes: ["mortality"] };
  assert.deepEqual(shortlist([c], RISK_EXCLUDED_THEMES, () => 1), []);
  assert.deepEqual(acceptReview(review(evaluation()), [c], RISK_EXCLUDED_THEMES), []);
});
test("shortlist is bounded, deduplicated, and excludes oversized text", () => {
  const cs = Array.from({ length: 20 }, (_, i) => candidate(String(i)));
  assert.equal(shortlist(cs, new Set(), () => 1).length, 10);
  assert.equal(shortlist([candidate(), candidate()], new Set(), () => 1).length, 1);
  assert.equal(shortlist([{ ...candidate(), text: "x".repeat(3001) }], new Set(), () => 1).length, 0);
});
test("primary matches get priority over alternates; no repeated passages", () => {
  const a = acceptReview(review(evaluation()), [candidate()])[0];
  const b = { ...a, cand: candidate("b", "One"), score: 0.7, perspective: "a second perspective" };
  const output = assignInsights([[a, b], [b]]);
  assert.deepEqual(output.map((ps) => ps.map((p) => p.cand.id)), [["a"], ["b"]]);
  assert.equal(output[0][0].cand.author, output[1][0].cand.author);
});
test("no accepted candidates produces a valid empty result", async () => {
  assert.deepEqual(assignInsights([[], []]), [[], []]);
  assert.deepEqual(await reviewPassages({ line: null, interpretation: "none", context: "none", candidates: [], excluded: new Set() }), []);
});
test("cache needs both the current version and a completed generation", () => {
  assert.equal(isCurrentMatch({ match_version: MATCH_VERSION, match_generation: "completed" }), true);
  assert.equal(isCurrentMatch({ match_version: MATCH_VERSION - 1, match_generation: "old" }), false);
  assert.equal(isCurrentMatch({ match_version: MATCH_VERSION, match_generation: null }), false);
  assert.equal(isCurrentMatch({}), false);
});
test("line interpretation survives verification but invented/overlapping lines do not", () => {
  const lines = verifyLines("I feel alone. I want to be heard.", [
    { text: "I feel alone.", theme: "loneliness", interpretation: "Wanting recognition" },
    { text: "feel alone", theme: "loneliness" }, { text: "Invented journal words", theme: "meaning" },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].interpretation, "Wanting recognition");
});

test("analysis and comparison use two calls, retain context, and reject incomplete review", async () => {
  const previousKey = process.env.MUSE_SPARK_API_KEY;
  process.env.MUSE_SPARK_API_KEY = "offline-test";
  const calls: { messages: { role: string; content: string }[] }[] = [];
  const fakeFetch = mock.method(globalThis, "fetch", async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    calls.push(body);
    const result = calls.length === 1 ? {
      emotions: ["sadness"], themes: ["belonging"], summary: "Wanting support while hiding feelings from friends.", risk_flag: false,
      key_lines: [{ text: "I keep saying I am fine.", theme: "belonging", interpretation: "Concealing feelings while wanting support", situation: "Hiding feelings from friends", perspective_query: "Sharing feelings can allow connection" }],
    } : calls.length === 2 ? review(evaluation()) : review();
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  });
  try {
    const context = "I keep saying I am fine. I wish someone would ask again.";
    const a = await analyzeEntry(context, Date.now() + 5000);
    const [line] = verifyLines(context, a.key_lines);
    const input = { line: line.text, interpretation: line.interpretation!, context, candidates: [candidate()], excluded: new Set<string>(), deadline: Date.now() + 5000 };
    const picks = await reviewPassages(input);
    assert.equal(picks.length, 1);
    assert.equal(calls.length, 2);
    const request = JSON.parse(calls[1].messages[1].content);
    assert.equal(request.journal_context, context);
    assert.equal(request.tentative_interpretation, line.interpretation);
    assert.equal(request.candidates[0].text, candidate().text);
    await assert.rejects(reviewPassages(input), /Incomplete/);
  } finally {
    fakeFetch.mock.restore();
    if (previousKey === undefined) delete process.env.MUSE_SPARK_API_KEY;
    else process.env.MUSE_SPARK_API_KEY = previousKey;
  }
});

test("long entries retain context surrounding a late snippet", () => {
  const line = "This is the line near the end.";
  const context = "x".repeat(18000) + "My manager said: " + line + " More surrounding context.";
  const window = journalContext(context, line);
  assert.ok(window.includes("My manager said: " + line));
  assert.ok(window.length <= 12000);
});
