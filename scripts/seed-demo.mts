// S12 seed data: two demo accounts plus a handful of seeded posts, replies and likes
// so the forums are not empty on stage. Posts are marked is_seeded = true.
// Idempotent: re-running removes earlier seeded posts first.
// Run: npx tsx --env-file=.env.local scripts/seed-demo.mts
import { createClient } from "@supabase/supabase-js";
import { randomAlias } from "../src/lib/forum.ts";
import { findSpan } from "../src/lib/exact-match.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const ACCOUNTS = [
  { email: process.env.DEMO1_EMAIL ?? "demo-one@philai.app", password: process.env.DEMO_PASSWORD ?? "philai-demo-2026" },
  { email: process.env.DEMO2_EMAIL ?? "demo-two@philai.app", password: process.env.DEMO_PASSWORD ?? "philai-demo-2026" },
];

// Each seed: the theme forum, the stranger's line, which passage (by author +
// a phrase that must appear in it), and optional replies from the other account.
const SEEDS: { forum: string; line: string; author: string; phrase: string; replies?: string[] }[] = [
  { forum: "belonging", line: "Everyone already has their group and I keep smiling like it's fine.", author: "Oscar Wilde", phrase: "We are unwelcome when we reappear", replies: ["Three weeks in and I still eat lunch in my car. You're not the only one smiling through it.", "The smiling part is the exhausting part. Wilde got that."] },
  { forum: "loneliness", line: "I didn't expect starting over to feel this lonely.", author: "L. M. Montgomery", phrase: "horribly lonesome all alone in my room", replies: ["Anne being lonely in a new place is the most comforting thing I've read this week."] },
  { forum: "home", line: "I miss my mom's kitchen on Sunday mornings.", author: "Charlotte Brontë", phrase: "empty chair and fireless hearth" },
  { forum: "ambition", line: "Third rejection this month and everyone on LinkedIn is announcing offers.", author: "Charles Dickens", phrase: "humiliated, hurt, spurned", replies: ["Same. Got mine the same day a friend posted their offer. It passes, slowly."] },
  { forum: "identity", line: "I don't know who I am if I'm not the person who had it all figured out.", author: "George Eliot", phrase: "no longer sure enough of myself" },
  { forum: "grief", line: "They sold grandma's house this week and it feels like she died a second time.", author: "Emily Dickinson", phrase: "death in the opposite house", replies: ["Houses hold people. Of course it hurts."] },
  { forum: "meaning", line: "Sat in lecture today and couldn't name one thing about it that excites me.", author: "Marcus Aurelius", phrase: "for which I myself was born" },
];

async function ensureUser(email: string, password: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return created.user.id;
}

const users = await Promise.all(ACCOUNTS.map((a) => ensureUser(a.email, a.password)));
console.log("demo accounts", ACCOUNTS.map((a, i) => `${a.email} (${users[i].slice(0, 8)})`).join(", "));

// Remove earlier seeded content (replies/aliases cascade from posts).
const { error: delErr } = await admin.from("posts").delete().eq("is_seeded", true);
if (delErr) throw delErr;

// Likes need the threaded_replies_likes migration; warn once and carry on without them if it is missing.
let likesOk = true;
async function like(row: { post_id?: string; reply_id?: string; user_id: string }) {
  if (!likesOk) return;
  const { error } = await admin.from("likes").insert(row);
  if (error) { likesOk = false; console.warn(`likes skipped: ${error.message}`); }
}

let made = 0;
for (const [i, seed] of SEEDS.entries()) {
  const { data: cands } = await admin.from("passages").select("id, text").eq("author", seed.author);
  const passage = (cands ?? []).map((p) => ({ ...p, span: findSpan(p.text, seed.phrase) })).find((p) => p.span);
  if (!passage) { console.warn(`skip: no ${seed.author} passage containing "${seed.phrase}"`); continue; }
  const poster = users[i % 2], other = users[(i + 1) % 2];
  const alias = randomAlias();
  // Stagger timestamps so the forum does not look like it was filled in one second.
  const created = new Date(Date.now() - (SEEDS.length - i) * 3600_000 * 5 - Math.floor(Math.random() * 3600_000)).toISOString();
  const { data: post, error } = await admin.from("posts").insert({
    forum_id: seed.forum, user_id: poster, alias, line_text: seed.line, passage_id: passage.id,
    phrase_start: passage.span!.start, phrase_end: passage.span!.end, is_seeded: true, created_at: created,
  }).select("id").single();
  if (error) throw error;
  await admin.from("thread_aliases").insert({ post_id: post.id, user_id: poster, alias });
  if (seed.replies?.length) {
    const replyAlias = randomAlias();
    await admin.from("thread_aliases").insert({ post_id: post.id, user_id: other, alias: replyAlias });
    for (const [j, text] of seed.replies.entries()) {
      const at = new Date(new Date(created).getTime() + (j + 1) * 1800_000).toISOString();
      const { data: reply, error: rErr } = await admin.from("replies")
        .insert({ post_id: post.id, user_id: other, alias: replyAlias, text, created_at: at })
        .select("id").single();
      if (rErr) throw rErr;
      // The poster likes the first reply they got.
      if (j === 0) await like({ reply_id: reply.id, user_id: poster });
    }
  }
  // The other account likes every seeded post, so the forums open with hearts on them.
  await like({ post_id: post.id, user_id: other });
  made++;
  console.log(`seeded [${seed.forum}] ${seed.author}: "${seed.line.slice(0, 50)}..." (${seed.replies?.length ?? 0} replies)`);
}
console.log(`${made}/${SEEDS.length} seeded posts`);
