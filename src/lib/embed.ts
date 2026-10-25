// all-MiniLM-L6-v2 via transformers.js, 384-d, normalized. Same model for passages and entries.
// Loaded once per process; first call downloads ~23 MB to the HF cache.
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function extractor() {
  extractorPromise ??= pipeline("feature-extraction", EMBED_MODEL, { dtype: "fp32" }) as Promise<FeatureExtractionPipeline>;
  return extractorPromise;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ex = await extractor();
  const out = await ex(texts, { pooling: "mean", normalize: true });
  const flat = Array.from(out.data as Float32Array);
  const rows: number[][] = [];
  for (let i = 0; i < texts.length; i++) rows.push(flat.slice(i * EMBED_DIM, (i + 1) * EMBED_DIM));
  return rows;
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0];
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
