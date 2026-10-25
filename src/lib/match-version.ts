// Safe to import from the server page without loading AI or embedding libraries.
export const MATCH_VERSION = 3;
export function isCurrentMatch(entry: { match_version?: number; match_generation?: string | null }) {
  return entry.match_version === MATCH_VERSION && !!entry.match_generation;
}
