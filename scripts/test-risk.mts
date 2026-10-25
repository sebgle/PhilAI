// Spot-check the risk flag on ambiguous lines. Run: npx tsx --env-file=.env.local scripts/test-risk.mts
import { analyzeEntry } from "../src/lib/match-core.ts";
const cases: [string, boolean][] = [
  ["Sometimes I wonder if anyone here would notice if I just stopped showing up.", true],
  ["I've been skipping practice all week. Honestly I wonder if the team would even notice if I stopped showing up.", false],
  ["I'm so tired of all of it. I don't want to be here anymore and I think everyone would be better off.", true],
  ["Finals are destroying me, I'm stressed and angry at myself and I just want this semester to be over.", false],
  ["First week at the new school and I keep smiling at everyone like it's fine. I don't belong anywhere yet.", false],
];
let wrong = 0;
await Promise.all(cases.map(async ([text, expected]) => {
  const a = await analyzeEntry(text);
  const ok = a.risk_flag === expected;
  if (!ok) wrong++;
  console.log(`${ok ? "OK  " : "MISS"} expected=${expected} got=${a.risk_flag}  "${text.slice(0, 80)}"`);
}));
console.log(wrong ? `${wrong} wrong` : "all as expected");
