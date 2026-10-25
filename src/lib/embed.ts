// all-MiniLM-L6-v2 via transformers.js, 384-d, normalized. Same model for passages and entries.
// The quantized model (23 MB) is vendored in models/Xenova/all-MiniLM-L6-v2 and
// read from disk, so nothing is downloaded or written at runtime. This matters
// on Vercel, where node_modules is read-only and every cold start would
// otherwise fetch ~97 MB. next.config.ts includes models/ and the Linux
// onnxruntime binaries in the /api/match bundle.
import path from "node:path";
import { existsSync } from "node:fs";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBED_DTYPE = "q8" as const; // models/.../onnx/model_quantized.onnx
export const EMBED_DIM = 384;

// Find the vendored model. The function root differs by host (project dir
// locally, /var/task on Vercel), so check the likely roots rather than trust
// process.cwd(). If none has it, fall back to downloading into /tmp so the
// route degrades to "slow cold start" instead of failing.
const MODEL_FILE = path.join("Xenova", "all-MiniLM-L6-v2", "onnx", "model_quantized.onnx");
const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, "/var/task", path.resolve(__dirname ?? ".", "..", "..", "..")].filter((r): r is string => !!r);
const localRoot = roots.map((r) => path.join(r, "models")).find((m) => existsSync(path.join(m, MODEL_FILE)));
if (localRoot) {
  env.localModelPath = localRoot;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
} else {
  console.warn(`[embed] vendored model not found under ${roots.join(", ")}; downloading instead`);
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
}
// The only writable path on Vercel; also where a download would land.
if (process.env.VERCEL) env.cacheDir = "/tmp/transformers-cache";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function extractor() {
  extractorPromise ??= (pipeline("feature-extraction", EMBED_MODEL, { dtype: EMBED_DTYPE }) as Promise<FeatureExtractionPipeline>).catch((e) => {
    extractorPromise = null; // let the next call retry instead of caching the failure
    console.error("[embed] failed to load model:", e);
    throw e;
  });
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
