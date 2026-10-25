// Fills the Explore feed: ~80 seeded posts across all sixteen rooms, so the
// mosaic has enough to scroll through. Each line is matched to a passage the
// way the app does it (MiniLM embedding -> match_passages), and the passage
// sentence closest to the line is highlighted. A few get replies and likes
// from the two demo accounts.
// Posts belong to their own demo account, so re-running replaces only these
// (seed-demo.mts deletes every is_seeded post, these included; run it first).
// Run: npx tsx --env-file=.env.local scripts/seed-feed.mts
import { createClient } from "@supabase/supabase-js";
import { randomAlias } from "../src/lib/forum.ts";
import { embed, cosine } from "../src/lib/embed.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD ?? "philai-demo-2026";

const LINES: Record<string, string[]> = {
  belonging: [
    "Everyone in my dorm already had a group chat by week two.",
    "I laugh at the inside jokes I don't understand.",
    "Found a club where nobody asks where I'm from. First time in a while I didn't feel like a guest.",
    "My cousins speak the language and I just nod along at dinner.",
    "Sat with new people at lunch today. Small thing, felt huge.",
  ],
  loneliness: [
    "My phone was quiet all weekend and I checked it anyway.",
    "Lonely in a full lecture hall is a specific kind of lonely.",
    "I talk to my cat more than to any human this semester.",
    "I keep making plans in my head with friends I haven't called in a year.",
    "Ate dinner alone again and told my mom I was out with friends.",
  ],
  grief: [
    "My dad's voicemail is still saved. I can't delete it.",
    "It's been a year and the grocery store still ambushes me with her favorite cereal.",
    "I miss my dog more than I know how to explain to people.",
    "Grief comes in waves and today was a big one.",
    "I keep reaching for my phone to text her.",
  ],
  love: [
    "I think I'm in love with my best friend and I'm scared to ruin it.",
    "He remembered how I take my coffee. I'm doomed.",
    "Loving someone who doesn't love you back is like shouting into a well.",
    "We broke up kindly, which somehow makes it harder.",
    "My grandparents still hold hands. I want that so badly.",
  ],
  longing: [
    "I want a life I can't even describe yet.",
    "I keep scrolling photos of cities I've never been to.",
    "Some nights I miss people I've never met.",
    "I want to be the version of me that exists in my daydreams.",
    "Every summer I wish I was back at camp, nine years old.",
  ],
  home: [
    "Home doesn't feel like home since my parents sold the house.",
    "The smell of rain on hot pavement takes me straight back to my street.",
    "I moved across the country and now I'm a visitor in both places.",
    "My childhood bedroom is an office now and I feel weirdly erased.",
    "Called home just to hear the background noise of the kitchen.",
  ],
  family: [
    "My parents fight in a language they think I don't understand anymore.",
    "I'm the oldest, so I'm the one who has to be fine.",
    "My brother and I haven't talked in months over something stupid.",
    "My mom said she was proud of me and I didn't know what to do with my hands.",
    "Holidays are just performing being a happy family for six hours.",
  ],
  identity: [
    "I've been so many versions of myself I don't know which one is real.",
    "I act different around every friend group and it's exhausting.",
    "Changed my major and suddenly don't know how to introduce myself.",
    "I'm not who my parents think I am and I don't know how to tell them.",
    "Cut my hair short and finally recognized myself in the mirror.",
  ],
  freedom: [
    "First apartment, first night alone. Terrified and thrilled.",
    "I quit the job everyone said I should be grateful for.",
    "Drove with the windows down and for one hour nothing owned me.",
    "Freedom is scarier than I thought. No one tells you what to do next.",
    "I want to leave everything and I hate that I want to.",
  ],
  ambition: [
    "I don't even know if I want this, I just know I'm supposed to.",
    "Pulled another all-nighter for a grade nobody will remember.",
    "Everyone my age seems to have a startup and I can barely do laundry.",
    "I got the internship and felt nothing. Is that normal?",
    "I'm tired of measuring my worth in accomplishments.",
  ],
  fear: [
    "I'm scared I peaked in high school.",
    "Every time my phone rings late I assume someone died.",
    "I'm afraid if I stop being useful people will leave.",
    "Presentation tomorrow and my heart is already racing.",
    "I'm scared of becoming my father.",
  ],
  hope: [
    "Today was a little better than yesterday. I'll take it.",
    "The first warm day of spring made me believe in things again.",
    "My therapist said I'm making progress and I almost cried.",
    "I planted tomatoes. That's a bet on the future, right?",
    "Someone I lost touch with texted me out of nowhere. Maybe it's not too late.",
  ],
  change: [
    "Graduating and everything I knew is ending at once.",
    "My best friend is moving away and I'm pretending I'm fine.",
    "I don't recognize the person I was two years ago, in a good way.",
    "Everything is changing and I just want one thing to stay the same.",
    "Started over in a new city. Day one, no idea what I'm doing.",
  ],
  mortality: [
    "My grandpa forgot my name today.",
    "Turned 25 and suddenly time feels like it's running.",
    "Went to a funeral and kept thinking about how short all of it is.",
    "I keep counting how many summers I have left with my parents.",
    "Life is short and I've been spending it scrolling.",
  ],
  meaning: [
    "What is the point of any of this if it all ends anyway?",
    "I volunteered today and it was the first time in weeks I felt useful.",
    "I keep waiting for my life to start.",
    "Working a job I don't care about to buy things I don't need.",
    "Small things matter. Coffee with a friend. A good book. Maybe that's it.",
  ],
  regret: [
    "I didn't say goodbye to my grandmother because I thought there'd be time.",
    "I wish I had told her how I felt before she moved.",
    "I quit piano at 12 and I think about it every week.",
    "Said something cruel to a friend years ago and it still keeps me up.",
    "I spent all of high school trying to be cool. What a waste.",
  ],
};

const REPLIES = [
  "This hit me hard. You're not alone in this.",
  "I felt this in my chest. Thank you for putting it into words.",
  "Same. Every word of it.",
  "Sending you something warm. It gets lighter, slowly.",
  "I didn't know anyone else felt this way.",
  "Reading this at 2am and feeling a little less weird.",
  "That passage is perfect for this. Saving it.",
  "Be gentle with yourself. This is a lot.",
];

async function ensureUser(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return created.user.id;
}

const poster = await ensureUser("demo-feed@philai.app");
const others = await Promise.all(["demo-one@philai.app", "demo-two@philai.app"].map(ensureUser));

const { error: delErr } = await admin.from("posts").delete().eq("user_id", poster);
if (delErr) throw delErr;

// Sentences with their offsets in the passage, for the highlight.
function sentences(text: string) {
  const out: { start: number; end: number; s: string }[] = [];
  const re = /[^.!?;]+[.!?;]*/g;
  for (let m; (m = re.exec(text)); ) {
    const lead = m[0].length - m[0].trimStart().length;
    const s = m[0].trim();
    if (s.length > 15) out.push({ start: m.index + lead, end: m.index + lead + s.length, s });
  }
  return out;
}

const all = Object.entries(LINES).flatMap(([forum, lines]) => lines.map((line) => ({ forum, line })));
// Shuffle so neighbours in the feed come from different rooms.
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [all[i], all[j]] = [all[j], all[i]];
}
const vectors = await embed(all.map((a) => a.line));
const used = new Set<string>();
let made = 0;

for (const [i, { forum, line }] of all.entries()) {
  const { data: cands, error } = await admin.rpc("match_passages", { query_embedding: JSON.stringify(vectors[i]), match_count: 10 });
  if (error) throw error;
  const passage = (cands as { id: string; text: string }[]).find((p) => !used.has(p.id)) ?? cands[0];
  used.add(passage.id);

  const sents = sentences(passage.text);
  let span: { start: number; end: number } | null = null;
  if (sents.length > 1) {
    const sv = await embed(sents.map((s) => s.s));
    span = sents[sv.map((v) => cosine(v, vectors[i])).reduce((b, c, k, arr) => (c > arr[b] ? k : b), 0)];
  }

  // Spread over the last ten days, newest first in shuffle order.
  const created = new Date(Date.now() - (i + 1) * 3 * 3600_000 - Math.floor(Math.random() * 3600_000)).toISOString();
  const alias = randomAlias();
  const { data: post, error: pErr } = await admin.from("posts").insert({
    forum_id: forum, user_id: poster, alias, line_text: line, passage_id: passage.id,
    phrase_start: span?.start ?? null, phrase_end: span?.end ?? null, is_seeded: true, created_at: created,
  }).select("id").single();
  if (pErr) throw pErr;
  await admin.from("thread_aliases").insert({ post_id: post.id, user_id: poster, alias });

  // About half get a reply or two; likes from zero to both demo accounts.
  const nReplies = Math.random() < 0.5 ? 1 + Math.floor(Math.random() * 2) : 0;
  for (let j = 0; j < nReplies; j++) {
    const who = others[j % 2];
    const replyAlias = randomAlias();
    await admin.from("thread_aliases").insert({ post_id: post.id, user_id: who, alias: replyAlias });
    const at = new Date(new Date(created).getTime() + (j + 1) * 1200_000).toISOString();
    const { error: rErr } = await admin.from("replies").insert({
      post_id: post.id, user_id: who, alias: replyAlias, text: REPLIES[(i + j) % REPLIES.length], created_at: at,
    });
    if (rErr) throw rErr;
  }
  for (const who of others) if (Math.random() < 0.55) await admin.from("likes").insert({ post_id: post.id, user_id: who });

  made++;
  console.log(`[${forum}] "${line.slice(0, 48)}" -> ${passage.id}${span ? " (highlighted)" : ""}, ${nReplies} replies`);
}
console.log(`${made}/${all.length} feed posts seeded`);
