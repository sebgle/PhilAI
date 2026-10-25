import { z } from "zod";
import { findSpan } from "./exact-match";
export const ProfileSchema = z.object({
  id: z.string(), text: z.string().min(1),
  central_idea: z.string().min(10).max(350), tension: z.string().min(10).max(350),
  perspective: z.string().min(10).max(350), evidence: z.string().min(12).max(600),
  annotation_version: z.literal(1), method: z.enum(["editorial", "model"]),
});
export type PassageProfile = z.infer<typeof ProfileSchema>;
export function validateProfile(raw: unknown, source: { id: string; text: string }): PassageProfile {
  const profile = ProfileSchema.parse(raw);
  if (source.id !== profile.id || source.text !== profile.text) throw new Error("Passage source changed");
  const evidence = findSpan(source.text, profile.evidence);
  if (!evidence || evidence.end - evidence.start < 12) throw new Error("Profile evidence is not in the passage");
  return { ...profile, evidence: source.text.slice(evidence.start, evidence.end) };
}
