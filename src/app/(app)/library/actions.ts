"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// Hand-added favorite book or quote, from the library form.
export async function addLibraryItem(formData: FormData) {
  const kind = formData.get("kind");
  const text = String(formData.get("text") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim() || null;
  if ((kind !== "book" && kind !== "quote") || !text) return;

  const supabase = await createClient();
  await supabase.from("library_items").insert({ kind, text, ref });
  revalidatePath("/library");
}

export async function removeLibraryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("library_items").delete().eq("id", id);
  revalidatePath("/library");
}
