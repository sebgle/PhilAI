// T3 step 2: pick ~18 passages per work from data/candidates.jsonl by embedding
// similarity to modern first-person anchor sentences for each theme, with
// theme round-robin and near-duplicate suppression. Output: data/passages.jsonl
// Run: npx tsx scripts/library/select.mts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { embed, cosine } from "../../src/lib/embed.ts";

const PER_WORK = Number(process.env.PER_WORK ?? 30);
type Cand = { src: number; author: string; work: string; year: number; para: number; text: string; vec?: number[]; best?: number; bestTheme?: string };

const ANCHORS: Record<string, string[]> = {
  belonging: ["I don't fit in anywhere and everyone else already has their people.", "I finally feel like I am among my own kind, accepted as I am.", "I smile and act fine around people so nobody notices I feel like an outsider."],
  loneliness: ["I am surrounded by people and still completely alone.", "Nobody really knows me, and the silence at night is heavy."],
  grief: ["Someone I loved is gone and the world keeps going without them.", "I keep reaching for a person who isn't there anymore."],
  love: ["I love this person so much it frightens me.", "Being loved by them makes me feel whole and seen."],
  longing: ["I ache for something I can't name and can't reach.", "I want so badly to be somewhere else, with someone else, as someone else."],
  home: ["I miss the place I grew up, even though I chose to leave it.", "Home is a feeling I keep looking for in new rooms."],
  family: ["My parents shaped me in ways I am only now understanding.", "The people I was born to are the ones I can't escape or stop loving."],
  identity: ["I keep performing a version of myself that isn't really me.", "I don't know who I am when nobody is watching.", "I compare myself to everyone and always come up short."],
  freedom: ["I want to be free of every expectation and just live.", "Independence is lonely and costly, but I would not trade it."],
  ambition: ["I push myself relentlessly and still feel I am not enough.", "I wonder what all this striving for success is actually for.", "Everyone around me is getting ahead and announcing their wins while I keep failing.", "I was rejected again and I am starting to doubt I am as good as I thought."],
  fear: ["Anxiety keeps me awake, dreading what might happen.", "I am afraid of failing, of being seen, of the future."],
  hope: ["Despite everything, I believe things can still get better.", "A small light keeps me going through the dark days."],
  change: ["Everything in my life is shifting and I am becoming someone new.", "Growing up means leaving behind the person I used to be."],
  mortality: ["Time is passing and life is shorter than I thought.", "I think about death and how little of my life I have really lived."],
  meaning: ["I wonder whether any of this matters or has a purpose.", "I am searching for something to make my life feel meaningful."],
  regret: ["I can't stop thinking about what I should have done differently.", "I wasted years and said things I can never take back."],
};

const cands: Cand[] = readFileSync("data/candidates.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const themes = Object.keys(ANCHORS);
const anchorTexts = themes.flatMap((t) => ANCHORS[t]);
const anchorVecs = await embed(anchorTexts);
const anchorTheme = themes.flatMap((t) => ANCHORS[t].map(() => t));

const t0 = Date.now();
// Cache embeddings keyed by text hash so re-selection is cheap.
const CACHE = "data/candidate_vecs.json";
const cache: Record<string, number[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const h = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 16);
for (let i = 0; i < cands.length; i += 256) {
  const chunk = cands.slice(i, i + 256);
  const need = chunk.filter((c) => !cache[h(c.text)]);
  const vecs = await embed(need.map((c) => c.text.replace(/\n/g, " ")));
  need.forEach((c, j) => { cache[h(c.text)] = vecs[j].map((x) => Number(x.toFixed(5))); });
  chunk.forEach((c) => {
    c.vec = cache[h(c.text)];
    let best = -1, bestTheme = "";
    anchorVecs.forEach((a, k) => { const s = cosine(c.vec!, a); if (s > best) { best = s; bestTheme = anchorTheme[k]; } });
    // Mild preferences: shorter, no dialogue, first person.
    const len = c.text.length;
    best += (len <= 260 ? 0.02 : 0) - (/^[“"]/.test(c.text) ? 0.05 : 0) + (/\bI\b/.test(c.text) ? 0.01 : 0);
    c.best = best; c.bestTheme = bestTheme;
  });
  if (i % 10240 === 0) console.log(`embedded ${i}/${cands.length} (${Date.now() - t0}ms)`);
}

writeFileSync(CACHE, JSON.stringify(cache));
const byWork = new Map<number, Cand[]>();
for (const c of cands) (byWork.get(c.src) ?? byWork.set(c.src, []).get(c.src)!).push(c);

const picked: (Cand & { id: string })[] = [];
for (const [, list] of byWork) {
  const byTheme = new Map<string, Cand[]>();
  for (const c of list) (byTheme.get(c.bestTheme!) ?? byTheme.set(c.bestTheme!, []).get(c.bestTheme!)!).push(c);
  for (const l of byTheme.values()) l.sort((a, b) => b.best! - a.best!);
  const chosen: Cand[] = [];
  const order = [...byTheme.keys()].sort((a, b) => byTheme.get(b)![0].best! - byTheme.get(a)![0].best!);
  let progress = true;
  while (chosen.length < PER_WORK && progress) {
    progress = false;
    for (const t of order) {
      if (chosen.length >= PER_WORK) break;
      const l = byTheme.get(t)!;
      while (l.length) {
        const c = l.shift()!;
        const dup = chosen.some((p) => (p.para === c.para && (p.text.includes(c.text) || c.text.includes(p.text) || overlap(p.text, c.text))) || cosine(p.vec!, c.vec!) > 0.85);
        if (dup) continue;
        chosen.push(c); progress = true; break;
      }
    }
  }
  for (const c of chosen) picked.push({ ...c, id: `p_${c.src}_${h(c.text).slice(0, 8)}` });
  console.log(`${String(list[0].src).padStart(6)} ${chosen.length} picked  ${list[0].work}`);
}

function overlap(a: string, b: string) {
  // Share a sentence?
  const sa = new Set(a.split(/(?<=[.!?])\s+/));
  return b.split(/(?<=[.!?])\s+/).some((s) => s.length > 30 && sa.has(s));
}

writeFileSync("data/passages.jsonl", picked.map(({ vec, best, bestTheme, ...p }) => JSON.stringify({ id: p.id, author: p.author, work: p.work, year: p.year, text: p.text, src: p.src, para: p.para, anchor_theme: bestTheme, anchor_score: Number(best!.toFixed(3)) })).join("\n") + "\n");
console.log(`${picked.length} passages -> data/passages.jsonl in ${Date.now() - t0}ms`);
