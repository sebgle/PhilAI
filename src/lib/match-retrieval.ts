import type { Candidate, VerifiedLine } from "./match-core";
import { SHORTLIST_SIZE } from "./insight-match";

export type QueryKind = "situation" | "tension" | "perspective";
export type RetrievalQuery = { kind: QueryKind; text: string };
export function retrievalQueries(line: Pick<VerifiedLine, "text" | "interpretation" | "situation" | "perspective_query"> | null, summary: string): RetrievalQuery[] {
  const possible: RetrievalQuery[] = line ? [
    { kind: "situation", text: `${line.text} ${line.situation ?? ""}`.trim() },
    { kind: "tension", text: line.interpretation ?? summary },
    { kind: "perspective", text: line.perspective_query ?? line.interpretation ?? summary },
  ] : [{ kind: "situation", text: summary }];
  const seen = new Set<string>();
  return possible.filter((q) => { const key = q.text.toLowerCase().trim(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
export type RetrievalGroup = { kind: QueryKind; source: "semantic" | "profile"; candidates: Candidate[] };

// Reciprocal rank fusion combines independently ranked channels without treating
// full-text rank as cosine similarity. Reserve one result per channel first.
export function balancedShortlist(groups: RetrievalGroup[], excluded: Set<string>, nudge: (c: Candidate) => number = () => 0) {
  const scores = new Map<string, number>();
  const candidates = new Map<string, Candidate>();
  const eligible = groups.map((group) => {
    const seen = new Set<string>();
    return group.candidates.filter((c) => {
      if (seen.has(c.id) || c.text.length > 3000 || c.themes.some((t) => excluded.has(t))) return false;
      seen.add(c.id); return true;
    });
  });
  for (const list of eligible) list.forEach((c, rank) => {
    scores.set(c.id, (scores.get(c.id) ?? 0) + 1 / (60 + rank + 1));
    const old = candidates.get(c.id);
    if (!old || c.similarity > old.similarity) candidates.set(c.id, c);
  });
  const output: Candidate[] = [];
  const used = new Set<string>();
  const add = (c: Candidate) => { if (!used.has(c.id) && output.length < SHORTLIST_SIZE) { output.push(candidates.get(c.id)!); used.add(c.id); } };
  // Channel order is fixed and bounded to six: three query kinds, two indexes.
  for (const list of eligible) if (list[0]) add(list[0]);
  const ranked = [...candidates.values()].sort((a, b) => (scores.get(b.id)! - scores.get(a.id)!) || nudge(b) - nudge(a) || b.similarity - a.similarity);
  for (const c of ranked) add(c);
  return output;
}

export async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) { const i = next++; result[i] = await fn(items[i], i); }
  }));
  return result;
}
