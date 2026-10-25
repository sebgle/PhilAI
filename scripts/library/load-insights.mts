// Dry-run by default; --apply updates annotation fields only on exact source matches.
// npx tsx --env-file=.env.local scripts/library/load-insights.mts --file=reviewed.jsonl --apply
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { validateProfile } from "../../src/lib/passage-profile.ts";
const args = process.argv.slice(2);
const file = args.find((a) => a.startsWith("--file="))?.slice(7) ?? "data/passage-insights.jsonl";
const source = new Map(readFileSync("data/passages.tagged.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((r) => [r.id, r]));
const raw = readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const seen = new Set<string>();
const profiles = raw.map((r) => {
  if (seen.has(r.id) || !source.has(r.id)) throw new Error("Duplicate or unknown passage ID");
  seen.add(r.id); return validateProfile(r, source.get(r.id));
});
if (!args.includes("--apply")) {
  console.log(`Validated ${profiles.length} local profiles. No database writes. Review the file and use --apply against the intended database to load.`);
} else {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  let updated = 0;
  for (const p of profiles) {
    const { data, error } = await db.from("passages").update({ central_idea: p.central_idea, tension: p.tension, perspective: p.perspective, profile_evidence: p.evidence })
      .eq("id", p.id).eq("text", p.text).select("id");
    if (error) throw error;
    updated += data?.length ?? 0;
  }
  console.log(`Updated ${updated}/${profiles.length} existing exact-text passages. Other passages were missing or changed; no quotations were replaced.`);
}
