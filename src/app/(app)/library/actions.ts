"use server";

import { isQualityRating, type QualityRating } from "@/lib/match-feedback";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Passage feedback updates all generations, preserving consistency with saved historical cards.
// All of these run as the signed-in user, so RLS keeps them owner-only.
// The library_items unique indexes make saves idempotent: a duplicate insert
// fails with 23505, which we treat as "already there".
const DUPLICATE = "23505";

export type Status = "saved" | "not_for_me" | null;

// Sets a passage card's status from the Matches screen. "saved" adds the
// passage (with the matched line, when a matches row exists) and its author to
// the library; anything else removes the saved passage. matches.feedback
// mirrors the status; before Sync 1 there is no matches row and that update
// simply touches nothing.
export async function setPassageStatus(entryId: string, passageId: string, status: Status) {
  const supabase = await createClient();

  const { data: matchRows, error: feedbackError } = await supabase
    .from("matches")
    .update({ feedback: status })
    .eq("entry_id", entryId)
    .eq("passage_id", passageId)
    .select("id");
  if (feedbackError) return { error: feedbackError.message };

  if (status === "saved") {
    const { data: passage } = await supabase
      .from("passages")
      .select("author")
      .eq("id", passageId)
      .single();
    if (!passage) return { error: "That passage isn't in the library yet." };

    const results = await Promise.all([
      supabase
        .from("library_items")
        .insert({ kind: "passage", passage_id: passageId, match_id: matchRows?.[0]?.id ?? null }),
      supabase.from("library_items").insert({ kind: "author", ref: passage.author }),
    ]);
    const failed = results.find((r) => r.error && r.error.code !== DUPLICATE);
    if (failed) return { error: failed.error!.message };
  } else {
    const { error } = await supabase
      .from("library_items")
      .delete()
      .eq("kind", "passage")
      .eq("passage_id", passageId);
    if (error) return { error: error.message };
  }

  revalidatePath("/library");
  return { error: null };
}

// "Spoke to me" on a passage card. Not a bookmark: a ranking signal, kept on
// the matches row so future entries lean toward what moved this reader.
export async function setResonated(entryId: string, passageId: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("matches")
    .update({ resonated: value })
    .eq("entry_id", entryId)
    .eq("passage_id", passageId);
  return { error: error?.message ?? null };
}

// Save from a post in the community. No entry or matched line behind it, so
// only the passage and its author go in; un-saving removes just the passage,
// like Remove on the Saved page.
export async function setPostPassageSaved(passageId: string, save: boolean) {
  const supabase = await createClient();
  if (save) {
    const { data: passage } = await supabase.from("passages").select("author").eq("id", passageId).single();
    if (!passage) return { error: "That passage isn't in the library." };
    const results = await Promise.all([
      supabase.from("library_items").insert({ kind: "passage", passage_id: passageId }),
      supabase.from("library_items").insert({ kind: "author", ref: passage.author }),
    ]);
    const failed = results.find((r) => r.error && r.error.code !== DUPLICATE);
    if (failed) return { error: failed.error!.message };
  } else {
    const { error } = await supabase.from("library_items").delete().eq("kind", "passage").eq("passage_id", passageId);
    if (error) return { error: error.message };
  }
  revalidatePath("/library");
  return { error: null };
}

export async function removeLibraryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("library_items").delete().eq("id", id);
  revalidatePath("/library");
}

// Quality feedback is separate from bookmarks and author affinity.
export async function setMatchQuality(entryId: string, passageId: string, rating: QualityRating | null) {
  if (rating !== null && !isQualityRating(rating)) return { error: "Choose a valid response." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { data: entry } = await supabase.from("entries").select("match_generation, summary").eq("id", entryId).single();
  if (!entry?.match_generation) return { error: "This entry has no current matches." };
  const { data: match } = await supabase.from("matches").select("line_text")
    .eq("entry_id", entryId).eq("generation", entry.match_generation).eq("passage_id", passageId).maybeSingle();
  if (!match) return { error: "This passage is no longer in the current matches." };
  if (rating === null) {
    const { error } = await supabase.from("match_quality_feedback").delete()
      .eq("user_id", user.id).eq("entry_id", entryId).eq("passage_id", passageId);
    return { error: error?.message ?? null };
  }
  const context = (match.line_text || entry.summary || "").slice(0, 2000);
  if (!context.trim()) return { error: "Could not identify the context for this passage." };
  const { error } = await supabase.from("match_quality_feedback").upsert({
    user_id: user.id, entry_id: entryId, passage_id: passageId, rating,
    context_text: context, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,entry_id,passage_id" });
  return { error: error?.message ?? null };
}
