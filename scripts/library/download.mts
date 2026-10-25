// T2: download each source from Project Gutenberg, strip the header/license,
// save to data/raw/{id}.txt, and print the Title line so ids can be checked.
// Run: npx tsx scripts/library/download.mts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

type Source = { gutenberg_id: number; author: string; work: string; year: number };
const sources: Source[] = JSON.parse(readFileSync("data/sources.json", "utf8"));
mkdirSync("data/raw", { recursive: true });

const START = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;
const END = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;

async function fetchText(id: number): Promise<string> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
  let lastErr = "";
  for (const u of urls) {
    try {
      const r = await fetch(u, { redirect: "follow" });
      if (r.ok) return await r.text();
      lastErr = `${r.status} ${u}`;
    } catch (e) {
      lastErr = `${(e as Error).message} ${u}`;
    }
  }
  throw new Error(lastErr);
}

const results: { id: number; ok: boolean; title: string; chars: number; expected: string }[] = [];
const queue = [...sources];
async function worker() {
  while (queue.length) {
    const s = queue.shift()!;
    const out = `data/raw/${s.gutenberg_id}.txt`;
    try {
      let raw: string;
      if (existsSync(`data/raw/${s.gutenberg_id}.full.txt`)) raw = readFileSync(`data/raw/${s.gutenberg_id}.full.txt`, "utf8");
      else {
        raw = await fetchText(s.gutenberg_id);
        writeFileSync(`data/raw/${s.gutenberg_id}.full.txt`, raw);
      }
      const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "(no Title line)";
      const sIdx = raw.search(START);
      const eIdx = raw.search(END);
      const body = sIdx !== -1 && eIdx !== -1 ? raw.slice(raw.indexOf("\n", sIdx) + 1, eIdx) : raw;
      writeFileSync(out, body.replace(/\r\n/g, "\n"));
      results.push({ id: s.gutenberg_id, ok: true, title, chars: body.length, expected: `${s.author} - ${s.work}` });
    } catch (e) {
      results.push({ id: s.gutenberg_id, ok: false, title: (e as Error).message, chars: 0, expected: `${s.author} - ${s.work}` });
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => a.id - b.id);
for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${String(r.id).padStart(6)}  ${String(r.chars).padStart(8)}  ${r.title.slice(0, 60).padEnd(60)}  <- ${r.expected}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} downloaded`);
