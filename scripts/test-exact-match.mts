import assert from "node:assert/strict";
import { findSpan, verifyQuote } from "../src/lib/exact-match.ts";
const entry = "First week at the new school and I keep smiling at everyone like it’s fine. Everyone already has their people.  I don’t belong anywhere yet.";
let s = findSpan(entry, "Everyone already has their people.")!;
assert.equal(entry.slice(s.start, s.end), "Everyone already has their people.");
s = findSpan(entry, "I don't belong anywhere yet")!;   // straight vs curly apostrophe
assert.equal(entry.slice(s.start, s.end), "I don’t belong anywhere yet");
s = findSpan(entry, "like it's fine. Everyone already")!; // whitespace + quote normalization
assert.equal(entry.slice(s.start, s.end), "like it’s fine. Everyone already");
s = findSpan(entry, "has their people. I don't")!;  // double space in haystack
assert.equal(entry.slice(s.start, s.end), "has their people.  I don’t");
assert.equal(findSpan(entry, "I belong everywhere"), null);
assert.equal(findSpan(entry, "   "), null);
assert.equal(verifyQuote(entry, "“First week”")!.text, "First week");
console.log("exact-match: all assertions passed");
