// Client-side entry point for matching. Until Sync 1 this serves the shared
// mocks; set NEXT_PUBLIC_MATCH_MODE=live to call the real /api/match.
import type { MatchResponse } from "./contract";
import { findSpan } from "./exact-match";
import mockMatch from "../../shared/mock_match.json";
import mockFallback from "../../shared/mock_match_fallback.json";
import mockRisk from "../../shared/mock_match_risk.json";

export const IS_MOCK = process.env.NEXT_PUBLIC_MATCH_MODE !== "live";

export type MockVariant = "match" | "fallback" | "risk";

export async function requestMatch(
  entryId: string,
  entryText: string,
  variant: MockVariant = "match",
): Promise<MatchResponse> {
  if (IS_MOCK) return mockFor(entryId, entryText, variant);

  const res = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry_id: entryId }),
  });
  if (!res.ok) throw new Error(`Matching failed (${res.status})`);
  return res.json();
}

// Re-anchors the mock lines in the user's real text, the same way the real
// endpoint verifies lines. Writing shared/mock_entry.txt as an entry shows all
// three highlights; any other text falls back, as the real endpoint would.
function mockFor(entryId: string, text: string, variant: MockVariant): MatchResponse {
  if (variant === "risk") return { ...(mockRisk as MatchResponse), entry_id: entryId };
  if (variant === "fallback") return { ...(mockFallback as MatchResponse), entry_id: entryId };

  const links = (mockMatch as MatchResponse).links.flatMap((link) => {
    const span = findSpan(text, link.line_text!);
    return span ? [{ ...link, line_start: span.start, line_end: span.end }] : [];
  });
  if (!links.length) return { ...(mockFallback as MatchResponse), entry_id: entryId };
  return { ...(mockMatch as MatchResponse), entry_id: entryId, links };
}
