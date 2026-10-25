// Journaling prompts, written as the start of a thought so they can sit in the
// empty text box as its placeholder. The Write screen shows one at a time and
// offers another on hover.
export const PROMPTS = [
  "Something you left unsaid today…",
  "Whatever you're carrying right now…",
  "A moment this week you felt most like yourself…",
  "Something you're pretending not to care about…",
  "Someone you miss, and what you'd tell them…",
  "Something you can't say out loud yet…",
  "Where you feel at home, and where you don't…",
  "Something that scared you today, even a little…",
  "Something you're hoping for that you haven't admitted…",
  "A change you haven't made peace with yet…",
  "What you'd do if nobody was watching…",
  "What you wish someone had asked you today…",
];

export function randomPrompt(exclude?: string | null): string {
  const pool = PROMPTS.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
