// Fire N Muse calls at once and report status/time per call, to see how the key behaves under load.
const N = Number(process.argv[2] ?? 8);
const key = process.env.MUSE_SPARK_API_KEY!;
const body = JSON.stringify({ model: "muse-spark-1.3", temperature: 0, response_format: { type: "json_object" },
  messages: [{ role: "system", content: "Return JSON {\"ok\": true}." }, { role: "user", content: "go" }] });
const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
  const t0 = Date.now();
  try {
    const r = await fetch("https://api.meta.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body });
    const text = await r.text();
    return `#${i} ${r.status} ${Date.now() - t0}ms ${r.ok ? "" : text.slice(0, 160).replace(/\s+/g, " ")} ${[...r.headers.entries()].filter(([k]) => /ratelimit|retry/i.test(k)).map(([k, v]) => `${k}=${v}`).join(" ")}`;
  } catch (e) { return `#${i} ERR ${Date.now() - t0}ms ${(e as Error).message}`; }
}));
console.log(results.join("\n"));
