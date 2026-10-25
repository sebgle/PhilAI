// T6: the exact-match check that keeps highlights honest.
// findSpan returns the first occurrence of needle in haystack as character
// offsets, end exclusive, so haystack.slice(start, end) === needle. If the
// exact text is not found, one retry normalizes curly quotes, dashes and
// whitespace on both sides and maps the hit back to original offsets.
export type Span = { start: number; end: number };

const QUOTE_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "–": "-", "—": "-", "‒": "-", "‐": "-",
  " ": " ", " ": " ", " ": " ", " ": " ", " ": " ",
};

// Normalize one character at a time so every output char maps to one input index.
function normalizeChars(s: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    let ch = QUOTE_MAP[s[i]] ?? s[i];
    if (/\s/.test(ch)) {
      if (prevSpace) continue;
      ch = " ";
      prevSpace = true;
    } else {
      prevSpace = false;
    }
    text += ch.toLowerCase();
    map.push(i);
  }
  return { text, map };
}

export function findSpan(haystack: string, needle: string): Span | null {
  const trimmed = needle.trim();
  if (!trimmed) return null;
  const exact = haystack.indexOf(trimmed);
  if (exact !== -1) return { start: exact, end: exact + trimmed.length };

  const h = normalizeChars(haystack);
  const n = normalizeChars(trimmed);
  const stripped = n.text.replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, "");
  if (!stripped) return null;
  const idx = h.text.indexOf(stripped);
  if (idx === -1) return null;
  const start = h.map[idx];
  const end = h.map[idx + stripped.length - 1] + 1;
  return { start, end };
}

// Convenience: span plus the exact text as it appears in the haystack.
export function verifyQuote(haystack: string, needle: string): (Span & { text: string }) | null {
  const span = findSpan(haystack, needle);
  return span ? { ...span, text: haystack.slice(span.start, span.end) } : null;
}
