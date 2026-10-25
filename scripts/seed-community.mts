// Fills the community: three posts in each of the sixteen rooms from a cast
// of fourteen accounts, plus the demo account's own posts, each with replies
// written for that post (some answering each other, some from the poster),
// and likes spread across the cast so counts vary. The demo account's newest
// replies land after its replies_seen_at, so the bell opens with unread ones.
//
// Wipes EVERY post first (replies, likes, aliases and reports cascade), so the
// room holds only this. Accounts, journal entries and Saved are untouched.
// Lines are matched to passages the way the app does it (MiniLM embedding ->
// match_passages), with the passage sentence closest to the line highlighted.
// Run: npx tsx --env-file=.env.local scripts/seed-community.mts
import { createClient } from "@supabase/supabase-js";
import { randomAlias } from "../src/lib/forum.ts";
import { embed, cosine } from "../src/lib/embed.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD ?? "";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "";
if (!PASSWORD || !DEMO_EMAIL) throw new Error("Set DEMO_PASSWORD (for the cast accounts) and DEMO_EMAIL (the demo account).");

// A reply: plain text from someone in the cast, or with `to` (index of an
// earlier reply in the thread it answers), `op` (written by the poster), `me`
// (written by the demo account) and `fresh` (lands after the demo account last
// opened its bell, so it shows as unread).
type R = string | { t: string; to?: number; op?: boolean; me?: boolean; fresh?: boolean };
type Seed = { room: string; line: string; replies: R[] };

const CAST_POSTS: Seed[] = [
  { room: "belonging", line: "Everyone at the new job already has a lunch spot. I've been 'just finishing something' at my desk for two weeks.", replies: [
    "Ask one person to grab coffee. Just one. It's how I broke my own desk-lunch streak.",
    "Two weeks is nothing. It took me four months and now those people are coming to my wedding.",
    { t: "Seconding this. Most people are relieved when someone else makes the first move.", to: 0 },
    { t: "Okay. Tomorrow. Holding myself to it.", op: true },
  ] },
  { room: "belonging", line: "Joined a run club mostly to have somewhere to be on Thursdays. Six weeks in, somebody saved me a seat at brunch.", replies: [
    "This is the kind of post I come here for.",
    "Somewhere to be on Thursdays is underrated.",
  ] },
  { room: "belonging", line: "I'm the friend people call when they need something, and nobody calls just to talk.", replies: [
    "Being the reliable one gets lonely. Have you told any of them?",
    { t: "Not really. It feels like complaining about being needed.", to: 0, op: true },
    "You're allowed to want to be wanted, not just needed.",
  ] },
  { room: "loneliness", line: "Sunday afternoons are the worst. Everyone's busy with their real lives and I'm reorganizing a bookshelf for the third time.", replies: [
    "Sunday at 3pm is a specific kind of quiet.",
    "I started going to the library on Sundays just to be around people being quiet together. Helps more than it should.",
    { t: "Okay, that's actually a good idea. Trying it this week.", to: 1, op: true },
    { t: "Stealing the library idea too.", to: 1, me: true },
    { t: "Go to the one with the big windows if your city has one. Worth the bus ride.", to: 3, fresh: true },
  ] },
  { room: "loneliness", line: "Moved cities for a job and the only person who knows my name here is the barista.", replies: [
    "Learn the barista's name back. Seriously, it starts there.",
    "First year in a new city is brutal. Year two is so much better, I promise.",
  ] },
  { room: "loneliness", line: "Being lonely in a relationship is lonelier than being single ever was.", replies: [
    "This one is hard to say out loud. Glad you did.",
    "I lived in that for three years. The quiet in the car was the worst part.",
    { t: "The car. Yes. Exactly the car.", to: 1, op: true },
  ] },
  { room: "grief", line: "My dad's voicemail greeting is still the same. Some nights I call just to hear him say he'll call me back.", replies: [
    "Please save a copy of that recording somewhere. Carriers delete inactive mailboxes.",
    { t: "I didn't know that. Doing it tonight. Thank you.", to: 0, op: true },
    "My mom's handwriting on an old grocery list does this to me.",
  ] },
  { room: "grief", line: "It's been a year. People stopped asking how I'm doing around month two.", replies: [
    "The casseroles stop and the real thing starts. I'm sorry.",
    "How are you doing, though? Genuinely.",
    { t: "Some days okay. Today, not really. Thanks for asking.", to: 1, op: true },
  ] },
  { room: "grief", line: "Our dog died on Tuesday and the house is so quiet I keep the TV on.", replies: [
    "Nobody tells you how much of the day was shaped around them.",
    "The leash by the door got me for months. Be gentle with yourself.",
  ] },
  { room: "love", line: "He learned to make my grandmother's soup from a voice memo she sent me in 2019.", replies: [
    "Okay, marry him.",
    "The voice memo detail. I'm not okay.",
    { t: "Working on it.", to: 0, op: true },
  ] },
  { room: "love", line: "We're breaking up kindly, which is somehow so much worse than a fight.", replies: [
    "A kind ending is still an ending. You get to grieve it.",
    "There's nobody to be angry at. That's what makes it heavy.",
  ] },
  { room: "love", line: "Fell for my best friend over an entire year and told her last night. She said she needs time.", replies: [
    "Time isn't no.",
    "Whatever happens, telling her was brave.",
    { t: "Came here to say this. Time isn't no.", to: 0 },
  ] },
  { room: "longing", line: "I keep a folder of apartment listings in cities I'll probably never live in.", replies: [
    "Mine is Lisbon. Yours?",
    { t: "Edinburgh, mostly. Something about the stone.", to: 0, op: true },
    "Daydreaming is how you find out what you want.",
  ] },
  { room: "longing", line: "I miss a version of my friends that only existed for one summer.", replies: [
    "Summer friendships are their own thing. They don't have to last to have been real.",
  ] },
  { room: "longing", line: "Some days I want a quieter life so badly I can taste it. Garden, dog, slow mornings.", replies: [
    "Start with the slow mornings. The garden can come later.",
    "Same dream, same list. Mine adds a bread oven.",
  ] },
  { room: "home", line: "Went back to my hometown and the bakery on the corner is a phone store now. Stood there like an idiot.", replies: [
    "Not an idiot. Places are part of who we are.",
    "My elementary school is condos now. I drove past it twice.",
  ] },
  { room: "home", line: "Called my mom for no reason except to hear the kitchen in the background.", replies: [
    "The most relatable thing I've read all week.",
    "The sound of someone else doing dishes. Yes.",
  ] },
  { room: "home", line: "After six years here, my accent only slips back in when I'm tired. Like home is leaking out.", replies: [
    "That's a beautiful way to put it.",
    "My grandmother said the same about her language. It comes back when you need it.",
  ] },
  { room: "family", line: "I'm the oldest, so I'm the one who has to be fine.", replies: [
    "Oldest daughter here. Hi. You don't have to be fine in this room.",
    "Someone told me once that the oldest is still somebody's kid. I think about it a lot.",
  ] },
  { room: "family", line: "My dad said 'I'm proud of you' on the phone and then immediately asked about my car's oil change.", replies: [
    "That's how dads say it twice.",
    { t: "The oil change IS the second 'I love you'.", to: 0 },
  ] },
  { room: "family", line: "My brother and I haven't spoken since March over something I can't even fully remember.", replies: [
    "Text him something small. A meme. Anything.",
    { t: "I typed one out. Haven't sent it.", to: 0, op: true },
    { t: "Send it. Worst case you're where you already are.", to: 1 },
  ] },
  { room: "identity", line: "I'm a slightly different person in every group chat and I'm not sure which one is me.", replies: [
    "Maybe all of them? People are rooms with a lot of doors.",
    "The one you are when you're alone and not performing is a good place to start.",
  ] },
  { room: "identity", line: "Changed my major junior year. Now I don't know how to introduce myself at parties.", replies: [
    "'I'm figuring it out' is a perfectly good introduction.",
    "I changed careers at 34. The not-knowing passes.",
  ] },
  { room: "identity", line: "Cut my hair short and recognized myself in the mirror for the first time in years.", replies: [
    "Love this for you.",
    "The mirror moment is everything.",
  ] },
  { room: "freedom", line: "First night in my own apartment. No furniture, eating cereal on the floor, never been happier.", replies: [
    "Floor cereal era is elite.",
    "Enjoy it. The quiet of the first night is a special kind.",
  ] },
  { room: "freedom", line: "Quit the job everyone said I should be grateful for. Terrified. Lighter.", replies: [
    "Terrified and lighter at the same time sounds like the right call.",
    "Proud of you, stranger.",
  ] },
  { room: "freedom", line: "Drove two hours with the windows down for no reason. Nothing needed me.", replies: [
    "This is the whole point of cars.",
    "Two unreachable hours is a luxury now.",
  ] },
  { room: "ambition", line: "Got the offer I worked three years for and felt nothing for a whole day.", replies: [
    "Same thing happened to me. The feeling arrived about a week later, quietly.",
    "Sometimes relief looks like numbness.",
    { t: "Glad it's not just me. It's starting to land.", to: 0, op: true },
  ] },
  { room: "ambition", line: "Everyone my age has a startup or a mortgage and I'm proud I did laundry.", replies: [
    "Laundry counts.",
    "Comparison is a thief, etc. But really, laundry counts.",
  ] },
  { room: "ambition", line: "I don't know if I want this or if I just want to be someone who wants this.", replies: [
    "That's a hard and honest question.",
    "Imagine nobody ever finds out you did it. Do you still want it?",
  ] },
  { room: "fear", line: "Every time my phone rings after 10pm I assume someone died.", replies: [
    "Same. My mom now texts 'nothing's wrong' before she calls.",
    { t: "That's genius. Sending this to my family.", to: 0 },
  ] },
  { room: "fear", line: "I'm scared that if I stop being useful, people will leave.", replies: [
    "You are more than what you do for people. I know it doesn't feel true.",
    "This is the one my therapist and I are still working on.",
  ] },
  { room: "fear", line: "Presentation tomorrow. My heart's already doing the thing.", replies: [
    "Breathe out longer than you breathe in. Old trick, it works.",
    "You'll be fine. Report back?",
    { t: "It went okay! Only blanked once.", to: 1, op: true },
  ] },
  { room: "hope", line: "Planted tomatoes on my balcony. A small bet on the future.", replies: [
    "The best kind of bet.",
    "Update us when the first one comes in.",
  ] },
  { room: "hope", line: "Today was a little better than yesterday. I'm counting it.", replies: [
    "Counting it with you.",
    "That's how it goes. One slightly better day at a time.",
  ] },
  { room: "hope", line: "My sister texted 'I'm proud of you' out of nowhere and I've reread it eleven times.", replies: [
    "Eleven is a reasonable number.",
    "Screenshot it for the bad days.",
  ] },
  { room: "change", line: "Graduating next month and every 'last time' is hitting me sideways.", replies: [
    "Last dining hall breakfast got me. Didn't see it coming.",
    "Leave room for firsts, too.",
  ] },
  { room: "change", line: "My best friend is moving across the country and I'm pretending it's fine.", replies: [
    "It's allowed to not be fine.",
    "Long-distance friendship is real. Voice memos saved mine.",
  ] },
  { room: "change", line: "I don't recognize who I was two years ago, in a good way.", replies: [
    "Love it when change is the good kind.",
    "What changed the most?",
    { t: "I stopped apologizing for taking up space.", to: 1, op: true },
  ] },
  { room: "mortality", line: "My grandpa asked my name twice today. He was gentle about it both times.", replies: [
    "The gentle part is him, still there.",
    "Sit with him anyway. He knows you're someone who belongs there.",
  ] },
  { room: "mortality", line: "Did the math on how many more summers I'll have with my parents. Shouldn't have.", replies: [
    "That math is brutal, but it made me call more.",
    { t: "That's the right lesson. I called today.", to: 0, op: true },
  ] },
  { room: "mortality", line: "Funerals make me want to quit everything and go live by the ocean.", replies: [
    "Maybe don't quit everything. But go see the ocean.",
  ] },
  { room: "meaning", line: "Volunteered at the food bank today. First time in weeks I felt like I mattered.", replies: [
    "Being useful to strangers is underrated medicine.",
    "Which one? I'm looking for somewhere to go.",
  ] },
  { room: "meaning", line: "Small things might be the whole thing. Coffee with a friend. A good book. Clean sheets.", replies: [
    "Clean sheets are a top-five human experience.",
    "I keep coming back to this.",
  ] },
  { room: "meaning", line: "I keep waiting for my real life to start.", replies: [
    "I think this is it. Which is scary and good.",
    "Felt this for most of my twenties. It quietly started without me noticing.",
  ] },
  { room: "regret", line: "I didn't visit my grandmother that last month because I thought there'd be more time.", replies: [
    "She knew you loved her. I'm sure of it.",
    "I carry the same one. Saying it out loud helps a little.",
  ] },
  { room: "regret", line: "Quit piano at twelve and I think about it every single week.", replies: [
    "Adults can start again. I did at 30.",
    { t: "You're the second person to tell me that this month. Maybe it's a sign.", to: 0, op: true },
  ] },
  { room: "regret", line: "Said something cruel to a friend in high school. Still think about it at 2am.", replies: [
    "You could still reach out. Apologies age well.",
    "The fact it still bothers you says a lot about who you are now.",
  ] },
];

// The demo account's own posts, a day or three old, with the newest replies unread.
const DEMO_POSTS: (Seed & { daysAgo: number })[] = [
  { room: "belonging", daysAgo: 1.2, line: "Spent the weekend at a hackathon with three people I met on Friday. By Sunday we had inside jokes.", replies: [
    "This is what hackathons are actually for.",
    "Inside jokes by day two means it's a good team.",
    { t: "Sleep deprivation speeds it up.", to: 1, op: true },
    { t: "Ha, true. Still counts.", to: 2, fresh: true },
    { t: "Keep those three. Hackathon friends turn into real ones.", fresh: true },
  ] },
  { room: "love", daysAgo: 2.5, line: "Still think about her when a certain song comes on. It's been months.", replies: [
    "Months is not that long. Be patient with yourself.",
    "Which song?",
    { t: "Not saying. Too embarrassing.", to: 1, op: true },
    { t: "Respect.", to: 2, fresh: true },
    { t: "Some songs stay haunted for a while. It fades, I promise.", fresh: true },
  ] },
  { room: "ambition", daysAgo: 1.8, line: "Building something I care about for the first time instead of something that looks good on a résumé.", replies: [
    "That shift changes everything.",
    "What are you building?",
    { t: "A journal that finds you passages from books. Long story.", to: 1, op: true },
    { t: "Wait, that's lovely. Hope it works out.", to: 2, fresh: true },
  ] },
  { room: "change", daysAgo: 3.1, line: "Senior year started and suddenly everyone's talking about 'after.' I'm not ready for after.", replies: [
    "Nobody is. They're just louder about it.",
    { t: "After is less of a cliff than it looks from here.", fresh: true },
  ] },
  { room: "meaning", daysAgo: 0.9, line: "Started reading one page of philosophy before class every morning. It's helping more than I expected.", replies: [
    "Which book?",
    { t: "Small rituals do a lot of quiet work.", fresh: true },
  ] },
  { room: "home", daysAgo: 2.1, line: "Mom sent a photo of the dinner table with my chair empty. She said 'we saved your seat.'", replies: [
    "Crying in public, thanks.",
    "Go home for a weekend if you can.",
    { t: "Your mom is wonderful.", fresh: true },
  ] },
];

const HOUR = 3600_000;
const now = Date.now();
const seenAt = now - 6 * HOUR;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
async function ensureUser(email: string) {
  const existing = authUsers?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

const demo = authUsers?.users.find((u) => u.email === DEMO_EMAIL)?.id;
if (!demo) throw new Error(`${DEMO_EMAIL} has no account; sign up first or set DEMO_EMAIL.`);
const cast: string[] = [];
for (let i = 1; i <= 14; i++) cast.push(await ensureUser(`cast-${String(i).padStart(2, "0")}@philai.app`));

// Every post goes; replies, likes, aliases and reports cascade.
const { error: wipeErr, count: wiped } = await admin.from("posts").delete({ count: "exact" }).not("id", "is", null);
if (wipeErr) throw wipeErr;
console.log(`wiped ${wiped} posts`);

// Passages: nearest by embedding, never the same one twice, with the sentence
// closest to the line highlighted.
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
const used = new Set<string>();
async function passageFor(line: string) {
  const [v] = await embed([line]);
  const { data, error } = await admin.rpc("match_passages", { query_embedding: JSON.stringify(v), match_count: 12 });
  if (error) throw error;
  const cands = data as { id: string; text: string }[];
  const p = cands.find((c) => !used.has(c.id)) ?? cands[0];
  used.add(p.id);
  const sents = sentences(p.text);
  let span: { start: number; end: number } | null = null;
  if (sents.length > 1) {
    const sv = await embed(sents.map((s) => s.s));
    span = sents[sv.map((x) => cosine(x, v)).reduce((b, c, k, arr) => (c > arr[b] ? k : b), 0)];
  }
  return { id: p.id, span };
}

// One alias per person per thread, unique within the thread.
async function aliasIn(postId: string, userId: string, taken: Map<string, string>) {
  if (taken.has(userId)) return taken.get(userId)!;
  let a = randomAlias();
  while ([...taken.values()].includes(a)) a = randomAlias();
  taken.set(userId, a);
  const { error } = await admin.from("thread_aliases").insert({ post_id: postId, user_id: userId, alias: a });
  if (error) throw error;
  return a;
}

async function like(row: { post_id?: string; reply_id?: string }, n: number, pool: string[]) {
  const who = shuffle([...pool]).slice(0, n);
  if (!who.length) return;
  const { error } = await admin.from("likes").insert(who.map((user_id) => ({ ...row, user_id })));
  if (error) throw error;
}

let posts = 0, replies = 0, unread = 0;
async function seed(s: Seed, poster: string, createdAt: number) {
  const passage = await passageFor(s.line);
  const taken = new Map<string, string>();
  const { data: post, error } = await admin.from("posts").insert({
    forum_id: s.room, user_id: poster, alias: "pending", line_text: s.line, passage_id: passage.id,
    phrase_start: passage.span?.start ?? null, phrase_end: passage.span?.end ?? null,
    is_seeded: true, created_at: new Date(createdAt).toISOString(),
  }).select("id").single();
  if (error) throw error;
  const alias = await aliasIn(post.id, poster, taken);
  await admin.from("posts").update({ alias }).eq("id", post.id);
  posts++;

  // Replies follow the post over hours; fresh ones land after the demo
  // account's last look at its bell. Nothing lands in the future.
  const made: { id: string; author: string }[] = [];
  let t = createdAt;
  const fresh = s.replies.filter((r) => typeof r !== "string" && r.fresh).length;
  let f = 0;
  for (const r of s.replies) {
    const spec = typeof r === "string" ? { t: r } : r;
    const parent = spec.to != null ? made[spec.to] : undefined;
    const author = spec.op ? poster : spec.me ? demo! :
      pick(cast.filter((c) => c !== poster && c !== parent?.author));
    if (spec.fresh) t = seenAt + ((++f) / (fresh + 1)) * (now - seenAt - HOUR);
    // Older replies stay before the bell's last look, a minute apart at least so a thread keeps its order.
    else t = Math.min(t + rand(0.3, 5) * HOUR, Math.max(t + 60_000, seenAt - 10 * 60_000));
    const { data: reply, error: rErr } = await admin.from("replies").insert({
      post_id: post.id, user_id: author, alias: await aliasIn(post.id, author, taken), text: spec.t,
      parent_id: parent?.id ?? null, created_at: new Date(t).toISOString(),
    }).select("id").single();
    if (rErr) throw rErr;
    made.push({ id: reply.id, author });
    replies++;
    if (spec.fresh) unread++;
    // Replies collect a few hearts from people other than their author.
    await like({ reply_id: reply.id }, Math.floor(rand(0, 5)), [...cast, demo!].filter((c) => c !== author));
  }
  return post.id;
}

// The cast's posts spread over the last nine days, rooms shuffled so neighbours
// in the feed differ; the demo account likes about a third of them.
const order = shuffle([...CAST_POSTS]);
for (const [i, s] of order.entries()) {
  const poster = pick(cast);
  const created = now - (i + 1) * ((9 * 24 * HOUR) / order.length) - rand(0, HOUR);
  const id = await seed(s, poster, Math.min(created, seenAt - 2 * HOUR));
  const pool = cast.filter((c) => c !== poster);
  await like({ post_id: id }, Math.floor(rand(1, pool.length)), Math.random() < 0.35 ? [...pool, demo] : pool);
  console.log(`[${s.room}] ${s.line.slice(0, 56)}...`);
}
for (const s of DEMO_POSTS) {
  const id = await seed(s, demo, now - s.daysAgo * 24 * HOUR);
  await like({ post_id: id }, Math.floor(rand(5, 13)), cast);
  console.log(`[${s.room}] (demo) ${s.line.slice(0, 50)}...`);
}

// Last look at the bell: six hours ago, so the fresh replies count as new.
const { error: seenErr } = await admin.from("users").update({ replies_seen_at: new Date(seenAt).toISOString() }).eq("id", demo);
if (seenErr) throw seenErr;
console.log(`${posts} posts, ${replies} replies, ${unread} unread for ${DEMO_EMAIL}`);
