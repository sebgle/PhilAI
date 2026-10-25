// T3 step 1: cut every downloaded book into candidate passages of 1-4 sentences
// (or one stanza for verse), filter out headings/dialogue/name-heavy text, and
// keep the most reflective ~1500 per work by a cheap lexical score. Output:
// data/candidates.jsonl. Selection by embedding happens in select.mts.
// Run: npx tsx scripts/library/cut.mts
import { readFileSync, writeFileSync } from "node:fs";

type Source = { gutenberg_id: number; author: string; work: string; year: number };
const sources: Source[] = JSON.parse(readFileSync("data/sources.json", "utf8"));
const VERSE = new Set([1322, 12242, 1041, 216]);
const PER_WORK = Number(process.env.PER_WORK ?? 1500);
const MIN_LEN = 70, MAX_LEN = 420;

const REFLECTIVE = /\b(i|we|you|my|our|your|myself|heart|soul|life|lives|love|loved|death|die|dead|alone|lonely|home|fear|afraid|hope|hoped|world|time|happiness|happy|sorrow|sorrows|grief|grieve|pain|joy|tears|wept|cry|memory|remember|forget|forgotten|dream|dreams|longing|long for|belong|stranger|strange|free|freedom|change|changed|meaning|nothing|everything|always|never|lost|found|truth|god|silence|silent|night|dark|light|beauty|beautiful|suffer|suffering|wish|wished|want|wanted|regret|courage|brave|weak|strong|mother|father|friend|friends|child|young|old|age|youth|past|future|moment|peace|rest|tired|weary|empty|whole|broken|wound|heal|wonder|know|knew|understand|feel|felt|feeling|think|thought|believe|hunger|thirst)\b/gi;

function sentences(p: string): string[] {
  const protectedText = p.replace(/\b(Mr|Mrs|Ms|Dr|St|Mme|Mlle|M|Jr|Sr|Prof|Capt|Col|Gen|Lieut|vs|etc|i\.e|e\.g)\./g, (m) => m.replace(".", "\u0000"));
  const parts = protectedText.split(/(?<=[.!?][”"'’)]?)\s+(?=[“"'‘(]?[A-Z])/);
  return parts.map((s) => s.replace(/\u0000/g, ".").trim()).filter(Boolean);
}

function bad(text: string): boolean {
  if (text.length < MIN_LEN || text.length > MAX_LEN) return true;
  if (/^(chapter|book|part|canto|section|letter|act|scene)\b/i.test(text)) return true;
  if (/^[IVXLC]+\.?$|^\d+\.?$/.test(text.trim())) return true;
  if (/\[|\]|\*|_|Gutenberg|Illustration|Footnote|\bp\. ?\d|^\d+\s/.test(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  const caps = text.replace(/[^A-Z]/g, "");
  if (letters.length && caps.length / letters.length > 0.25) return true; // headings, shouting
  if ((text.match(/\d/g) ?? []).length > 6) return true;
  if (!/[.!?”"'’)]$/.test(text)) return true;
  if (!/^[“"'‘(]?[A-Z]/.test(text)) return true;
  const quotes = (text.match(/[“”"]/g) ?? []).length;
  if (quotes >= 4) return true; // back-and-forth dialogue
  if (/\b(said|replied|asked|cried|exclaimed|answered|returned|muttered)\b/.test(text) && quotes >= 2) return true;
  // Proper nouns not at sentence start: character names make a passage less universal.
  const inner = text.replace(/(^|[.!?]\s+)[“"'‘(]?[A-Z]/g, "$1x");
  const proper = (inner.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).filter((w) => !/^(God|Lord|Heaven|Christ|Nature|Fate|Time|Death|Love|Truth|Spirit|Soul|Earth|Christmas|Sunday|Monday|English|French|Christian)$/.test(w));
  if (proper.length > 1) return true;
  return false;
}

function score(text: string): number {
  const hits = (text.match(REFLECTIVE) ?? []).length;
  const words = text.split(/\s+/).length;
  return hits / Math.sqrt(words) + (text.length <= 240 ? 0.3 : 0) + (/\bI\b/.test(text) ? 0.2 : 0);
}

const out: string[] = [];
let total = 0;
for (const s of sources) {
  const raw = readFileSync(`data/raw/${s.gutenberg_id}.txt`, "utf8");
  const paras = raw.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length >= MIN_LEN);
  const cands = new Map<string, { text: string; score: number; para: number }>();
  paras.forEach((p, pi) => {
    if (VERSE.has(s.gutenberg_id)) {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      // Long verse (sonnets): split into 4-line groups.
      const groups: string[][] = lines.length <= 8 ? [lines] : Array.from({ length: Math.ceil(lines.length / 4) }, (_, g) => lines.slice(g * 4, g * 4 + 4));
      for (const g of groups) {
        if (g.length < 2) continue;
        const text = g.join("\n");
        if (text.length < MIN_LEN || text.length > MAX_LEN || /\[|\]|\*|_/.test(text)) continue;
        const caps = text.replace(/[^A-Z]/g, "").length / Math.max(1, text.replace(/[^A-Za-z]/g, "").length);
        if (caps > 0.3) continue;
        cands.set(text, { text, score: score(text) + 0.5, para: pi });
      }
      return;
    }
    const flat = p.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
    const sents = sentences(flat);
    for (let i = 0; i < sents.length; i++) {
      for (let n = 1; n <= 4 && i + n <= sents.length; n++) {
        const text = sents.slice(i, i + n).join(" ");
        if (text.length > MAX_LEN) break;
        if (bad(text)) continue;
        cands.set(text, { text, score: score(text), para: pi });
      }
    }
  });
  const kept = [...cands.values()].sort((a, b) => b.score - a.score).slice(0, PER_WORK);
  for (const c of kept) out.push(JSON.stringify({ src: s.gutenberg_id, author: s.author, work: s.work, year: s.year, para: c.para, text: c.text }));
  total += kept.length;
  console.log(`${String(s.gutenberg_id).padStart(6)}  ${String(cands.size).padStart(7)} candidates -> ${String(kept.length).padStart(5)} kept  ${s.work}`);
}
writeFileSync("data/candidates.jsonl", out.join("\n") + "\n");
console.log(`total ${total} candidates -> data/candidates.jsonl`);
