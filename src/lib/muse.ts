// One Muse Spark entry point for routes and scripts. Returns zod-validated JSON.
// Meta Model API is OpenAI-compatible: https://api.meta.ai/v1/chat/completions
import { z } from "zod";

const MUSE_URL = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1/chat/completions";
const MUSE_MODEL = process.env.MUSE_MODEL ?? "muse-spark-1.3";

function sparkKey() {
  const k = process.env.MUSE_SPARK_API_KEY ?? process.env.MUSE_API_KEY;
  if (!k) throw new Error("MUSE_SPARK_API_KEY is not set");
  return k;
}

export async function museText(system: string, user: string, opts: { temperature?: number; json?: boolean; timeoutMs?: number } = {}) {
  const body: Record<string, unknown> = {
    model: MUSE_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.2,
  };
  const timeoutMs = opts.timeoutMs ?? Number(process.env.MUSE_TIMEOUT_MS ?? 40_000);
  const post = (b: Record<string, unknown>) =>
    fetch(MUSE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sparkKey()}` },
      body: JSON.stringify(b),
      signal: AbortSignal.timeout(timeoutMs),
    });
  // Muse intermittently answers 404 model_not_found (about 1 call in 8 under
  // load) and occasionally stalls or 429s, so retry any failure with a short
  // backoff: up to 3 attempts in total.
  const attempt = async (): Promise<Response> => {
    let res = await post(opts.json === false ? body : { ...body, response_format: { type: "json_object" } });
    if (res.status === 400 && opts.json !== false) res = await post(body);
    return res;
  };
  const MAX = 3;
  let res: Response | null = null;
  let lastErr = "";
  for (let i = 0; i < MAX; i++) {
    try {
      res = await attempt();
      if (res.ok) break;
      lastErr = `muse ${res.status}: ${(await res.text()).slice(0, 200)}`;
      // Auth and quota problems will not fix themselves; fail fast on those.
      if (res.status === 401 || res.status === 403 || res.status === 402) throw new Error(lastErr);
    } catch (e) {
      if (/^muse 40[123]:/.test((e as Error).message)) throw e;
      lastErr = `${(e as Error).name}: ${(e as Error).message.slice(0, 120)}`;
    }
    res = null;
    if (i < MAX - 1) {
      console.warn(`[muse] attempt ${i + 1} failed (${lastErr}), retrying`);
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
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
