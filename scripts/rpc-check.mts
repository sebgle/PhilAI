import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const vec = JSON.stringify(Array(384).fill(0.05));
const t0 = Date.now();
const { data, error } = await s.rpc("match_passages", { query_embedding: vec, match_count: 1 });
console.log(error ? `RPC ERROR: ${error.message}` : `RPC OK in ${Date.now() - t0}ms, rows: ${JSON.stringify(data).slice(0, 200)}`);
