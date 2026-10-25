// The exact-match rule every highlight relies on: first occurrence, end
// exclusive. A quote that isn't found verbatim is never highlighted.
// (T6 extends this with an optional curly-quote / whitespace normalizing retry.)
export function findSpan(haystack: string, needle: string): { start: number; end: number } | null {
  if (!needle) return null;
  const start = haystack.indexOf(needle);
  return start === -1 ? null : { start, end: start + needle.length };
}
