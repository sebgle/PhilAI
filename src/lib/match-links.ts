// Shared by the match route (stored path) and the entry page.
import type { MatchLink } from "@/lib/contract";

// Stored rows back into links: rank 0 rows are the links, rank 1-2 rows hang
// off the rank 0 row for the same line. Fallback rows (no line) stay flat.
export function groupAlternates(rows: (MatchLink & { rank: number })[]): MatchLink[] {
  const links: MatchLink[] = [];
  const byLine = new Map<number, MatchLink>();
  for (const r of rows) {
    const { rank, ...link } = r;
    if (rank === 0 || link.line_start === null) {
      if (link.line_start !== null) { link.alternates = []; byLine.set(link.line_start, link); }
      links.push(link);
    } else {
      byLine.get(link.line_start!)?.alternates?.push(link);
    }
  }
  return links;
}
