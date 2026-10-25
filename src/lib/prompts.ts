// Optional journaling prompts. The Write screen shows one at a time and the
// user can ask for another or dismiss it.
export const PROMPTS = [
  "What did you leave unsaid today?",
  "What are you carrying right now?",
  "When did you feel most like yourself this week?",
  "What are you pretending not to care about?",
  "Who do you miss, and what would you tell them?",
  "What's something you can't say out loud yet?",
  "Where do you feel at home, and where don't you?",
  "What scared you today, even a little?",
  "What are you hoping for that you haven't admitted?",
  "What changed recently that you haven't made peace with?",
  "What would you do if nobody was watching?",
  "What do you wish someone had asked you today?",
];

export function randomPrompt(exclude?: string | null): string {
  const pool = PROMPTS.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
