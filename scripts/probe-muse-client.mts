// 12 concurrent calls through museJson: every one must succeed; retries are logged by the client.
import { z } from "zod";
import { museJson } from "../src/lib/muse.ts";
const N = Number(process.argv[2] ?? 12);
const t0 = Date.now();
const r = await Promise.allSettled(Array.from({ length: N }, (_, i) => museJson({ system: 'Return JSON {"n": <the number the user sends>}.', user: String(i), schema: z.object({ n: z.number() }) })));
const ok = r.filter((x) => x.status === "fulfilled").length;
console.log(`${ok}/${N} succeeded in ${Date.now() - t0}ms`, r.filter((x) => x.status === "rejected").map((x) => (x as PromiseRejectedResult).reason.message.slice(0, 100)));
