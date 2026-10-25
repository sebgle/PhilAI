import { embed, cosine } from "../src/lib/embed.ts";
const t0 = Date.now();
const [a, b, c] = await embed([
  "Feeling alone at a new school, surrounded by people who already have friends.",
  "A person is miserable and alone because others will not associate with them.",
  "Instructions for baking sourdough bread at home.",
]);
console.log("dims", a.length, "load+embed ms", Date.now() - t0);
console.log("sim(alone, alone-passage)", cosine(a, b).toFixed(3), " sim(alone, bread)", cosine(a, c).toFixed(3));
const t1 = Date.now();
await embed(Array.from({ length: 64 }, (_, i) => `test sentence number ${i} about longing and home`));
console.log("64 texts ms", Date.now() - t1);
