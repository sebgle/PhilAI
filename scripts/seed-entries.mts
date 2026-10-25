// Fills the demo account's Entries and Saved: replaces its journal entries
// with a few weeks of written ones and gives each its matches, then saves a
// handful of the strongest with their authors.
//
// The matches are staged, not run through the live matcher: each entry names
// its key lines, themes and why-this-passage notes here, and each line is
// pinned to a passage by author and a phrase in it, which is highlighted.
// They're stored through the same store_insight_matches RPC the matcher uses,
// so every page reads them as real.
//
// Wipes the demo account's entries (matches cascade) and Saved items first.
// --resume keeps entries and only stages the ones with no matches yet.
// Run: npx tsx --env-file=.env.local scripts/seed-entries.mts [--resume]
import { createClient } from "@supabase/supabase-js";
import { MATCH_VERSION } from "../src/lib/match-version.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "";
if (!DEMO_EMAIL) throw new Error("Set DEMO_EMAIL to the demo account's email.");
const DAY = 24 * 3600_000;

// A key line must appear in the entry's text exactly; `phrase` must appear in
// one of `author`'s passages and is what gets highlighted. `reason` is the
// italic note under the passage card. `also` are the runner-ups shown under
// "Also close", each taking a different angle from the main card, as the
// matcher requires.
type Pin = { author: string; phrase: string };
type Line = Pin & { text: string; theme: string; reason: string; also: (Pin & { kind: "distinction" | "reframe" })[] };
type Entry = { daysAgo: number; title: string; text: string; emotions: string[]; themes: string[]; summary: string; lines: Line[] };

// Oldest first, spread over about three weeks.
const ENTRIES: Entry[] = [
  { daysAgo: 21, title: "Senior year, week one", emotions: ["nervousness", "realization"], themes: ["change", "meaning"],
    summary: "Facing questions about life after graduation, the writer realizes they've treated college as a waiting room.",
    text:
    "Everyone keeps asking what I'm doing after graduation, like it's small talk. I smile and say I'm figuring it out, which is true, but it's also the scariest sentence I know. " +
    "Walking across the quad today I realized I've been treating college like a waiting room. Like real life is somewhere else and I'm just killing time until they call my name. " +
    "I don't want to look back and find out this was the real part and I missed it.",
    lines: [
      { text: "I've been treating college like a waiting room", theme: "meaning", author: "Marcus Aurelius", phrase: "man can part with no life properly, save with that little part of life, which he now lives", reason: "The only life you ever have is the part you're living now.",
        also: [{ author: "James Joyce", phrase: "real adventures, I reflected, do not happen to people who remain at home", kind: "reframe" }, { author: "Fyodor Dostoevsky", phrase: "I want to live myself", kind: "distinction" }] },
      { text: "I don't want to look back and find out this was the real part and I missed it.", theme: "mortality", author: "Henry David Thoreau", phrase: "not, when I came to die, discover that I had not lived", reason: "The fear of reaching the end and finding you never quite lived the middle.",
        also: [{ author: "W. E. B. Du Bois", phrase: "is it the twilight of nightfall or the flush of some faint-dawning day?", kind: "reframe" }, { author: "Edith Wharton", phrase: "he sought to postpone certainty", kind: "distinction" }] },
    ] },
  { daysAgo: 18, title: "The song", emotions: ["sadness", "love"], themes: ["love", "longing"],
    summary: "A song in a grocery store brings back a past relationship and the person the writer was inside it.",
    text:
    "It came on in the grocery store. Of course it did. I stood in the cereal aisle holding a box I didn't even want until it ended. " +
    "It's been months. I'm fine most days. But it's strange how a song can hold a whole person inside it, the way she laughed at the second verse, the drive back from the coast. " +
    "I don't want her back, I think. I just miss who I was when I was with her.",
    lines: [
      { text: "it's strange how a song can hold a whole person inside it", theme: "longing", author: "Thomas Hardy", phrase: "I grieve and grieve to miss you who used to see them with me", reason: "How an absent person lives on in the ordinary things you shared.",
        also: [{ author: "Walt Whitman", phrase: "among my lovers and caroling these songs, O I never doubt whether that is really me", kind: "reframe" }, { author: "William Shakespeare", phrase: "all those friends which I thought buried", kind: "distinction" }] },
      { text: "I just miss who I was when I was with her.", theme: "love", author: "Blaise Pascal", phrase: "we change and are no longer the same persons", reason: "Grieving a version of yourself along with the person.",
        also: [{ author: "Charlotte Brontë", phrase: "that was an atom of sweet in much bitter", kind: "reframe" }, { author: "Homer", phrase: "crying is cold comfort and one soon tires of it", kind: "distinction" }] },
    ] },
  { daysAgo: 15, title: "Sunday", emotions: ["sadness", "embarrassment"], themes: ["loneliness", "belonging"],
    summary: "A quiet weekend turns lonely, and asking for company feels like admitting something.",
    text:
    "Quiet weekend. Everyone went home or had plans and I told myself I wanted the rest. By Sunday afternoon I had cleaned my desk twice and refreshed my messages more times than I'd admit. " +
    "It's not that nobody cares. It's that I don't know how to ask for company without it sounding like a confession. " +
    "Going to try the library tomorrow, just to sit near people.",
    lines: [
      { text: "I don't know how to ask for company without it sounding like a confession", theme: "loneliness", author: "Charlotte Brontë", phrase: "I want my kindred", reason: "Wanting kindred company, not just people nearby.",
        also: [{ author: "Jane Austen", phrase: "with no one to speak to of what I felt", kind: "distinction" }, { author: "Henry David Thoreau", phrase: "sincerity and truth were not", kind: "reframe" }] },
      { text: "Going to try the library tomorrow, just to sit near people.", theme: "belonging", author: "Ralph Waldo Emerson", phrase: "we are no longer strangers", reason: "How little it takes to stop being strangers.",
        also: [{ author: "Henry David Thoreau", phrase: "I think that I love society as much as most", kind: "reframe" }, { author: "Louisa May Alcott", phrase: "My rooms are always open to you", kind: "distinction" }] },
    ] },
  { daysAgo: 12, title: "One page a morning", emotions: ["amusement", "realization"], themes: ["fear", "meaning"],
    summary: "A morning reading habit shows the writer how much of their worry never comes true.",
    text:
    "Started a small thing this week: one page of philosophy with my coffee before class. Today it was about how we suffer more in imagination than in reality, and I laughed out loud because that's my entire week. " +
    "I spent three days dreading a conversation with my professor that took four minutes and went fine. " +
    "Maybe the trick isn't to stop worrying but to notice how rarely the worry is right.",
    lines: [
      { text: "we suffer more in imagination than in reality", theme: "fear", author: "Charles Dickens", phrase: "my fear was altogether undefined and vague, but there was great fear upon me", reason: "Dread is usually bigger and vaguer than the thing itself.",
        also: [{ author: "Epictetus", phrase: "you are afraid lest necessary things should fail you, and are sleepless by night", kind: "distinction" }, { author: "Joseph Conrad", phrase: "I belonged still to a world of straightforward facts", kind: "reframe" }] },
      { text: "notice how rarely the worry is right", theme: "hope", author: "Kahlil Gibran", phrase: "the seat of that fear is in your heart and not in the hand of the feared", reason: "Fear lives in you more than in the thing you're afraid of.",
        also: [{ author: "Friedrich Nietzsche", phrase: "How PERSONAL does a long fear make one", kind: "distinction" }, { author: "Blaise Pascal", phrase: "True fear is joined to hope", kind: "reframe" }] },
    ] },
  { daysAgo: 9, title: "Dinner table", emotions: ["love", "sadness", "gratitude"], themes: ["home", "family"],
    summary: "A photo of a saved seat at the family table makes the writer feel the distance from home.",
    text:
    "Mom texted a photo of the dinner table tonight with my chair pushed in and a plate set anyway. 'We saved your seat.' " +
    "I'm three hours away and I felt it in my chest like I was ten. Home is weird now. When I'm there I feel like a visitor, and when I'm here I miss things I used to complain about, like my little brother's music through the wall. " +
    "I'm going to call more. I always say that.",
    lines: [
      { text: "When I'm there I feel like a visitor", theme: "home", author: "Oscar Wilde", phrase: "We are unwelcome when we reappear", reason: "On returning to the place that made you and finding you've changed shape.",
        also: [{ author: "George Eliot", phrase: "losing that grievance makes me feel rather empty", kind: "distinction" }, { author: "W. E. B. Du Bois", phrase: "there swept over me a sudden longing to pass again beyond the blue hill", kind: "reframe" }] },
      { text: "I miss things I used to complain about", theme: "family", author: "Charles Dickens", phrase: "what a strange feeling it was to be going home when it was not home", reason: "Home changes once you've left it, and so does what you miss about it.",
        also: [{ author: "Charlotte Brontë", phrase: "the sight of the empty chair and fireless hearth chilled me", kind: "distinction" }, { author: "Henry David Thoreau", phrase: "Things do not change; we change.", kind: "reframe" }] },
    ] },
  { daysAgo: 6, title: "Before the presentation", emotions: ["nervousness", "fear"], themes: ["fear", "identity"],
    summary: "The night before a presentation, the writer dreads the moment of being looked at.",
    text:
    "Presentation tomorrow and my heart is already doing the thing. I know the material. That's not the problem. " +
    "The problem is the moment right before, when every face looks like a verdict. I keep picturing my voice cracking. " +
    "My roommate said nobody remembers your presentation as much as you do, and I'm choosing to believe her tonight.",
    lines: [
      { text: "every face looks like a verdict", theme: "fear", author: "Marcus Aurelius", phrase: "should more regard other men's opinions concerning himself than his own", reason: "Why other people's judgment weighs more than our own.",
        also: [{ author: "Kahlil Gibran", phrase: "To judge you by your failures is to cast blame upon the seasons for their inconstancy.", kind: "reframe" }, { author: "Ralph Waldo Emerson", phrase: "If I can be firm enough to-day to do right and scorn eyes", kind: "distinction" }] },
      { text: "I'm choosing to believe her tonight", theme: "hope", author: "Oscar Wilde", phrase: "Be afraid of nothing.", reason: "Courage as a choice you make before you feel ready.",
        also: [{ author: "Leo Tolstoy", phrase: "I want peace of mind and trust", kind: "distinction" }, { author: "Kate Chopin", phrase: "A certain light was beginning to dawn dimly within her", kind: "reframe" }] },
    ] },
  { daysAgo: 3, title: "Hackathon", emotions: ["joy", "excitement", "gratitude"], themes: ["belonging", "hope"],
    summary: "Three strangers at a hackathon become friends over one sleepless weekend.",
    text:
    "I met three people on Friday night and by Sunday we had inside jokes, a half-working app, and a group chat called 'sleep is a social construct.' " +
    "I haven't laughed that hard in months. It's funny, I spent all of last year trying to find my people in places I was supposed to, and they turned up at 2am arguing about a database. " +
    "We're building a journal that answers you with books. Whatever happens with it, I want to remember how this weekend felt.",
    lines: [
      { text: "I spent all of last year trying to find my people in places I was supposed to", theme: "belonging", author: "Emily Dickinson", phrase: "Then there 's a pair of us", reason: "Finding your people among the ones who don't fit either.",
        also: [{ author: "Blaise Pascal", phrase: "Our instinct makes us feel that we must seek our happiness outside ourselves.", kind: "distinction" }, { author: "Walt Whitman", phrase: "Saw many I loved in the street or ferry-boat", kind: "reframe" }] },
      { text: "I haven't laughed that hard in months.", theme: "hope", author: "Kahlil Gibran", phrase: "the selfsame well from which your laughter rises was oftentimes filled with your tears", reason: "Joy that lands harder because of the months before it.",
        also: [{ author: "Oscar Wilde", phrase: "nothing in the whole world is meaningless, and suffering least of all", kind: "reframe" }, { author: "Virginia Woolf", phrase: "It used, thought Clarissa, to be so simple.", kind: "distinction" }] },
    ] },
  { daysAgo: 1, title: "Something I care about", emotions: ["pride", "nervousness", "optimism"], themes: ["ambition", "identity"],
    summary: "Building something for its own sake feels exposed, but more real than playing it safe.",
    text:
    "For the first time I'm building something because I want it to exist, not because it'll look good on a résumé. It feels exposed. If it fails, it's not a line item, it's me. " +
    "But I'd rather be scared of something real than comfortable with something that doesn't matter to me. " +
    "Tired, a little proud, mostly hopeful.",
    lines: [
      { text: "I'm building something because I want it to exist", theme: "ambition", author: "Henry David Thoreau", phrase: "advances confidently in the direction of his dreams", reason: "Going confidently toward the life you've imagined, not the one that looks right.",
        also: [{ author: "James Joyce", phrase: "whereby your spirit could express itself in unfettered freedom", kind: "distinction" }, { author: "Louisa May Alcott", phrase: "I want to do something splendid", kind: "reframe" }] },
      { text: "I'd rather be scared of something real than comfortable with something that doesn't matter to me.", theme: "freedom", author: "James Joyce", phrase: "I am not afraid to make a mistake, even a great mistake", reason: "Choosing your own way, mistakes and all, over a safe performance.",
        also: [{ author: "George Eliot", phrase: "I must always be doing things of no consequence", kind: "distinction" }, { author: "Friedrich Nietzsche", phrase: "With your love shall ye assail him who inspireth you with fear!", kind: "reframe" }] },
    ] },
];

const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const demo = users?.users.find((u) => u.email === DEMO_EMAIL);
if (!demo) throw new Error(`${DEMO_EMAIL} has no account`);

const resume = process.argv.includes("--resume");
const now = Date.now();
if (!resume) {
  for (const t of ["library_items", "entries"] as const) {
    const { error, count } = await admin.from(t).delete({ count: "exact" }).eq("user_id", demo.id);
    if (error) throw error;
    console.log(`wiped ${count} ${t}`);
  }
  for (const e of ENTRIES) {
    const { error } = await admin.from("entries").insert({
      user_id: demo.id, title: e.title, text: e.text, created_at: new Date(now - e.daysAgo * DAY - Math.random() * 6 * 3600_000).toISOString(),
    });
    if (error) throw error;
  }
}
const { data: pending, error: pendErr } = await admin.from("entries").select("id, title, text")
  .eq("user_id", demo.id).is("match_generation", null).order("created_at");
if (pendErr) throw pendErr;

for (const row of pending ?? []) {
  const e = ENTRIES.find((x) => x.title === row.title);
  if (!e) { console.warn(`no staged matches for "${row.title}"`); continue; }
  const rows = [];
  for (const line of e.lines) {
    const start = row.text.indexOf(line.text);
    if (start < 0) throw new Error(`"${line.text}" is not in "${e.title}"`);
    const cards = [{ ...line, kind: "recognition" as const }, ...line.also.map((a) => ({ ...a, reason: null }))];
    for (const [rank, c] of cards.entries()) {
      // Passages keep their line breaks (poems), so a phrase matches across any run of whitespace.
      const words = c.phrase.split(/\s+/);
      const { data: pinned, error: pinErr } = await admin.from("passages").select("id, text")
        .eq("author", c.author).ilike("text", `%${words.join("%")}%`).limit(1);
      if (pinErr) throw pinErr;
      const span = pinned?.[0] && new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i").exec(pinned[0].text);
      if (!span) throw new Error(`no ${c.author} passage contains "${c.phrase}"`);
      rows.push({
        line_text: line.text, line_start: start, line_end: start + line.text.length, theme: line.theme, passage_id: pinned![0].id,
        phrase_start: span.index, phrase_end: span.index + span[0].length, score: 0.92 - rank * 0.08,
        reason: c.reason, connection_kind: c.kind, rank,
      });
    }
  }
  const { error } = await admin.rpc("store_insight_matches", {
    p_entry_id: row.id, p_user_id: demo.id, p_text: row.text, p_version: MATCH_VERSION,
    p_analysis: { emotions: e.emotions, themes: e.themes, summary: e.summary, risk_flag: false, fallback: false },
    p_rows: rows,
  });
  if (error) throw error;
  console.log(`staged "${e.title}": ${rows.length} cards`);
}

// Saved is rebuilt from what's matched: the first card of each entry, oldest
// entry first so the newest saves sit on top, plus each author. "Spoke to me"
// on every other one, the way a reader would leave it.
await admin.from("library_items").delete().eq("user_id", demo.id);
const { data: done } = await admin.from("entries").select("id, match_generation")
  .eq("user_id", demo.id).not("match_generation", "is", null).order("created_at");
const picks: { id: string; passage_id: string; author: string }[] = [];
for (const e of done ?? []) {
  const { data: m } = await admin.from("matches").select("id, passage_id, passage:passages(author)")
    .eq("entry_id", e.id).eq("generation", e.match_generation).eq("rank", 0)
    .order("line_start", { ascending: true, nullsFirst: false }).limit(1);
  const row = m?.[0] as unknown as { id: string; passage_id: string; passage: { author: string } } | undefined;
  if (row && !picks.some((p) => p.passage_id === row.passage_id)) picks.push({ id: row.id, passage_id: row.passage_id, author: row.passage.author });
}
const authors = new Set<string>();
for (const [k, p] of picks.entries()) {
  await admin.from("matches").update({ feedback: "saved", resonated: k % 2 === 0 }).eq("id", p.id);
  const at = new Date(now - (picks.length - k) * 7 * 3600_000).toISOString();
  const { error } = await admin.from("library_items").insert({ user_id: demo.id, kind: "passage", passage_id: p.passage_id, match_id: p.id, created_at: at });
  if (error) throw error;
  if (!authors.has(p.author)) {
    authors.add(p.author);
    await admin.from("library_items").insert({ user_id: demo.id, kind: "author", ref: p.author, created_at: at });
  }
}
console.log(`${done?.length ?? 0}/${ENTRIES.length} entries matched, ${picks.length} passages and ${authors.size} authors saved`);
