// One LLM entry point for routes and scripts. Returns zod-validated JSON.
// Muse Spark (Meta Model API, OpenAI-compatible) answers every call it can;
// OpenAI is the last resort when every Spark id is failing.
import { z } from "zod";

const MUSE_URL = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1/chat/completions";
const OPENAI_URL = process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

// Standard-mode Muse ids only (no "-contributor": our content must not train
// Meta models). Muse returns 404 model_not_found intermittently for one id and
// sometimes for every Spark id at once (2026-10-25 01:00: all three down for
// 35+ min), and from Vercel it fails far more often than from a laptop. So the
// chain ends with OpenAI, used only when OPENAI_API_KEY is set and only after
// the Spark ids have failed. The "openai:" prefix routes the request.
const MODEL_CHAIN = [...new Set([
  process.env.MUSE_MODEL ?? "muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1",
  ...(process.env.OPENAI_API_KEY ? [`openai:${OPENAI_MODEL}`] : []),
])];

function sparkKey() {
  const k = process.env.MUSE_SPARK_API_KEY ?? process.env.MUSE_API_KEY;
  if (!k) throw new Error("MUSE_SPARK_API_KEY is not set");
  return k;
}

// Where a chain entry goes and what the provider calls the model.
function target(entry: string) {
  if (entry.startsWith("openai:")) {
    return { provider: "openai", url: OPENAI_URL, key: process.env.OPENAI_API_KEY ?? "", model: entry.slice("openai:".length) };
  }
  return { provider: "muse", url: MUSE_URL, key: sparkKey(), model: entry };
}

export async function museText(system: string, user: string, opts: { temperature?: number; json?: boolean; timeoutMs?: number } = {}) {
  const body: Record<string, unknown> = {
    model: MODEL_CHAIN[0],
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.2,
  };
  const timeoutMs = opts.timeoutMs ?? Number(process.env.MUSE_TIMEOUT_MS ?? 40_000);
  const post = (t: ReturnType<typeof target>, b: Record<string, unknown>) =>
    fetch(t.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t.key}` },
      body: JSON.stringify(b),
      signal: AbortSignal.timeout(timeoutMs),
    });
  // Muse intermittently answers 404 model_not_found, and occasionally stalls or
  // 429s. The 404s come in bursts that hit every model id at once (seen from
  // Vercel: 8/8 failing one hour, 3/8 the next), so retrying instantly just
  // fails the whole call in under a second. On a 404, rotate to the next
  // model in the chain and back off too; on anything else back off and retry.
  // Up to 12 attempts (404 waits capped at 3 s), and no new attempt once
  // RETRY_BUDGET_MS has passed, so the calling route keeps time for its other
  // steps.
  const attempt = async (entry: string): Promise<Response> => {
    const t = target(entry);
    const b: Record<string, unknown> = { ...body, model: t.model };
    let res = await post(t, opts.json === false ? b : { ...b, response_format: { type: "json_object" } });
    if (res.status === 400 && opts.json !== false) res = await post(t, b);
    return res;
  };
  const MAX = 12;
  const RETRY_BUDGET_MS = 25_000;
  const started = Date.now();
  let modelIdx = 0;
  let res: Response | null = null;
  let lastErr = "";
  for (let i = 0; i < MAX; i++) {
    const model = MODEL_CHAIN[modelIdx % MODEL_CHAIN.length];
    let backoff = 600 * (i + 1);
    try {
      res = await attempt(model);
      if (res.ok) break;
      const text = (await res.text()).slice(0, 200);
      const provider = target(model).provider;
      lastErr = `${provider} ${res.status} (${model}): ${text}`;
      // Muse auth and quota problems will not fix themselves; fail fast on
      // those. A bad OpenAI key only costs that attempt: rotate back to Spark.
      if (provider === "muse" && (res.status === 401 || res.status === 402 || res.status === 403)) throw new Error(lastErr);
      if (provider === "openai" && (res.status === 401 || res.status === 402 || res.status === 403)) { modelIdx++; backoff = 400; }
      if (res.status === 404 && /model_not_found/.test(text)) { modelIdx++; backoff = Math.min(400 * (i + 1), 3000); }
    } catch (e) {
      if (/^muse 40[123] /.test((e as Error).message)) throw e;
      lastErr = `${(e as Error).name} (${model}): ${(e as Error).message.slice(0, 120)}`;
    }
    res = null;
    if (i < MAX - 1) {
      if (Date.now() - started + backoff > RETRY_BUDGET_MS) break;
      console.warn(`[muse] attempt ${i + 1} failed: ${lastErr.slice(0, 140)}; retrying in ${backoff} ms with ${MODEL_CHAIN[modelIdx % MODEL_CHAIN.length]}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  if (!res) throw new Error(lastErr || "muse: no response");
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c: { text?: string }) => c.text ?? "").join("");
  throw new Error(`muse: unexpected response ${JSON.stringify(data).slice(0, 300)}`);
}

function extractJson(raw: string): unknown {
  const fenced = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
  const m = fenced.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : fenced);
}

// Call Muse, parse JSON, validate. One repair round on schema failure.
export async function museJson<T>(args: { system: string; user: string; schema: z.ZodType<T>; temperature?: number }): Promise<T> {
  const sys = `${args.system}\n\nRespond with a single JSON object only. Use exactly the field names and enum values specified; never invent alternatives.`;
  const raw = await museText(sys, args.user, { temperature: args.temperature });
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    parsed = null;
  }
  const first = args.schema.safeParse(parsed);
  if (first.success) return first.data;
  const issues = first.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  const repaired = await museText(
    sys,
    `Your previous JSON failed validation.\n\nPrevious output:\n${raw}\n\nErrors:\n${issues}\n\nReturn the corrected JSON object only, keeping all content the same except the invalid fields.`,
    { temperature: 0 },
  );
  return args.schema.parse(extractJson(repaired));
}
