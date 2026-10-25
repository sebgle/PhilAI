import type { MatchLink } from "./contract";
export const QUALITY_RATINGS = ["helped", "related", "misunderstood"] as const;
export type QualityRating = (typeof QUALITY_RATINGS)[number];
export const QUALITY_OPTIONS: { value: QualityRating; label: string }[] = [
  { value: "helped", label: "Helped me understand something" },
  { value: "related", label: "Related, but did not add much" },
  { value: "misunderstood", label: "Misunderstood what I meant" },
];
export function isQualityRating(value: unknown): value is QualityRating {
  return QUALITY_RATINGS.includes(value as QualityRating);
}
export type FeedbackSignal = { passage_id: string; rating: QualityRating; context_text: string };

// Feedback is contextual: disliking a passage for one situation must not ban it
// for another. Cosine 0.45 is a conservative starting heuristic, not confidence.
export function feedbackPreferences(signals: FeedbackSignal[], context: number[], vectors: number[][]) {
  const result = new Map<string, number>();
  signals.forEach((signal, i) => {
    const vector = vectors[i];
    if (!vector || vector.length !== context.length || !isQualityRating(signal.rating)) return;
    const similarity = vector.reduce((sum, value, j) => sum + value * context[j], 0);
    const relevance = Math.max(0, Math.min(1, (similarity - 0.45) / 0.55));
    const direction = signal.rating === "helped" ? 1 : signal.rating === "related" ? -0.4 : -1;
    result.set(signal.passage_id, Math.max(-1, Math.min(1, (result.get(signal.passage_id) ?? 0) + relevance * direction)));
  });
  return result;
}

export function withQualityFeedback(links: MatchLink[], ratings: { passage_id: string; rating: string }[]): MatchLink[] {
  const byId = new Map(ratings.filter((r) => isQualityRating(r.rating)).map((r) => [r.passage_id, r.rating as QualityRating]));
  return links.map((link) => ({ ...link, quality_feedback: byId.get(link.passage.id) ?? null,
    ...(link.alternates ? { alternates: withQualityFeedback(link.alternates, ratings) } : {}) }));
}
