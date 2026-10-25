// Regenerates shared/mock_match*.json from shared/mock_entry.txt.
// Offsets are computed with the same exact-match rule the real endpoint uses
// (first occurrence, end exclusive), so the mock can never drift from the text.
// Run: node scripts/build-mocks.mjs
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../shared/", import.meta.url);
const entry = readFileSync(new URL("mock_entry.txt", root), "utf8");

function span(haystack, needle) {
  const start = haystack.indexOf(needle);
  if (start === -1) throw new Error(`Not found: "${needle}"`);
  return { start, end: start + needle.length };
}

const passages = {
  thoreau: {
    id: "p_mock_thoreau_walden_01",
    author: "Henry David Thoreau",
    work: "Walden",
    year: 1854,
    text: "The mass of men lead lives of quiet desperation. What is called resignation is confirmed desperation.",
  },
  shelley: {
    id: "p_mock_shelley_frankenstein_01",
    author: "Mary Shelley",
    work: "Frankenstein",
    year: 1818,
    text: "I am alone and miserable; man will not associate with me; but one as deformed and horrible as myself would not deny herself to me.",
  },
  dickens: {
    id: "p_mock_dickens_great_expectations_01",
    author: "Charles Dickens",
    work: "Great Expectations",
    year: 1861,
    text: "Heaven knows we need never be ashamed of our tears, for they are rain upon the blinding dust of earth, overlying our hard hearts.",
  },
};

function link(line, theme, passage, phrase, reason, score) {
  const l = span(entry, line);
  const p = span(passage.text, phrase);
  return {
    line_text: line,
    line_start: l.start,
    line_end: l.end,
    theme,
    passage,
    phrase_start: p.start,
    phrase_end: p.end,
    reason,
    score,
  };
}

const base = {
  entry_id: "e_mock_001",
  emotions: ["sadness", "nervousness", "grief"],
  themes: ["belonging", "home", "identity"],
  risk_flag: false,
  fallback: false,
};

const match = {
  ...base,
  links: [
    link(
      "I keep smiling at everyone",
      "identity",
      passages.thoreau,
      "lives of quiet desperation",
      "You both describe holding it together on the outside while something heavier sits underneath.",
      0.58,
    ),
    link(
      "I don't belong anywhere yet",
      "belonging",
      passages.shelley,
      "I am alone and miserable",
      "You both name the ache of being surrounded by people and still having no one who is yours.",
      0.51,
    ),
    link(
      "I miss my mom's kitchen",
      "home",
      passages.dickens,
      "we need never be ashamed of our tears",
      "You both describe missing a place while being relieved to be gone.",
      0.47,
    ),
  ],
};

// Whole-entry fallback: 3 passages, no line or phrase highlights.
const fallback = {
  ...base,
  fallback: true,
  links: match.links.map(({ theme, passage, reason, score }) => ({
    line_text: null,
    line_start: null,
    line_end: null,
    theme,
    passage,
    phrase_start: null,
    phrase_end: null,
    reason,
    score,
  })),
};

// Safety flag set: no links, UI shows the 988 card and locks sharing.
const risk = { ...base, risk_flag: true, links: [] };

for (const [name, data] of [
  ["mock_match.json", match],
  ["mock_match_fallback.json", fallback],
  ["mock_match_risk.json", risk],
]) {
  writeFileSync(new URL(name, root), JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote shared/${name}`);
}
