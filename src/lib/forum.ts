// Shared forum rules. Aliases are fresh per thread, so one person's posts in
// different threads can't be linked. Words differ from account handles on purpose.
const ADJECTIVES = [
  "ink", "paper", "candle", "quiet", "dusk", "lamplit", "inkwell", "margin",
  "velvet", "willow", "harbor", "twilight", "linen", "morning", "rain", "ember",
];
const NOUNS = [
  "quill", "reader", "wren", "lantern", "page", "fox", "moth", "heron",
  "letter", "owl", "sparrow", "chapter", "fern", "comet", "thrush", "verse",
];

export function randomAlias(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 90 + 10)}`;
}

// Distinct reporters needed to hide a post or reply until it's reviewed.
export const REPORT_THRESHOLD = 3;

export const MAX_LINE = 280;
export const MAX_REPLY = 2000;

// Postgres unique_violation.
export const DUPLICATE = "23505";
