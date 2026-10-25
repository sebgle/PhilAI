// all-MiniLM-L6-v2 via transformers.js, 384-d, normalized. Same model for passages and entries.
// The quantized model (23 MB) is vendored in models/Xenova/all-MiniLM-L6-v2 and
// read from disk, so nothing is downloaded or written at runtime. This matters
// on Vercel, where node_modules is read-only and every cold start would
// otherwise fetch ~97 MB. next.config.ts includes models/ and the Linux
// onnxruntime binaries in the /api/match bundle.
import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

env.localModelPath = path.join(process.cwd(), "models");
env.allowLocalModels = true;
env.allowRemoteModels = false;
// Belt and braces: if anything still tries to cache, use the one writable path.
if (process.env.VERCEL) env.cacheDir = "/tmp/transformers-cache";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DTYPE = "q8" as const; // models/.../onnx/model_quantized.onnx
export const EMBED_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function extractor() {
  extractorPromise ??= pipeline("feature-extraction", EMBED_MODEL, { dtype: EMBED_DTYPE }) as Promise<FeatureExtractionPipeline>;
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
