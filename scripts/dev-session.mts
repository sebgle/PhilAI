// Creates (or reuses) a test user and prints a Cookie header that the Next.js
// routes accept, so /api/* can be exercised with curl against `npm run dev`.
// Usage: npx tsx --env-file=.env.local scripts/dev-session.mts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const email = process.env.TEST_EMAIL ?? "teammate-test@philai.local";
const password = process.env.TEST_PASSWORD ?? "philai-test-password-123";

const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (!list?.users.some((u) => u.email === email)) {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.error("created test user", email);
}
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await anon.auth.signInWithPassword({ email, password });
if (error || !data.session) throw error ?? new Error("no session");

// @supabase/ssr cookie format: "base64-" + base64url(JSON session), chunked at 3180 chars.
const encoded = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
const name = `sb-${ref}-auth-token`;
const chunks: string[] = [];
for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
const cookie = chunks.length === 1 ? `${name}=${encoded}` : chunks.map((c, i) => `${name}.${i}=${c}`).join("; ");
console.error("user id", data.user.id);
console.log(cookie);
