// T3: check the mock passages in scripts/build-mocks.mjs against the Gutenberg text.
import { readFileSync } from "node:fs";
import { findSpan } from "../src/lib/exact-match.ts";
const checks = [
  { id: 205, text: "The mass of men lead lives of quiet desperation. What is called resignation is confirmed desperation." },
  { id: 84, text: "I am alone and miserable; man will not associate with me; but one as deformed and horrible as myself would not deny herself to me." },
  { id: 1400, text: "Heaven knows we need never be ashamed of our tears, for they are rain upon the blinding dust of earth, overlying our hard hearts." },
];
for (const c of checks) {
  const book = readFileSync(`data/raw/${c.id}.txt`, "utf8").replace(/\s*\n\s*/g, " ");
  const span = findSpan(book, c.text);
  console.log(span ? `OK   ${c.id}: "${book.slice(span.start, span.end)}"` : `MISS ${c.id}: ${c.text.slice(0, 60)}`);
  if (!span) {
    const probe = c.text.split(" ").slice(0, 5).join(" ");
    const i = book.indexOf(probe);
    if (i !== -1) console.log(`     actual: "${book.slice(i, i + c.text.length + 40)}"`);
  }
}
