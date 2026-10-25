"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Both run as the signed-in user, so RLS keeps them to their own entries.

// New text clears the current generation, so the entry page matches it again
// on its next render. Older match rows stay as history, which keeps Saved
// items that point at them intact.
export async function updateEntryText(id: string, text: string) {
  const next = text.trim();
  if (!next) return { error: "An entry can't be empty." };
  const supabase = await createClient();
  const { error } = await supabase.from("entries").update({ text: next, match_generation: null }).eq("id", id);
  if (error) return { error: "Couldn't save your changes. Try again." };
  revalidatePath(`/entries/${id}`);
  revalidatePath("/entries");
  return { error: null };
}

// Matches go with it (on delete cascade); saved passages stay in Saved.
export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return { error: "Couldn't delete this entry. Try again." };
  revalidatePath("/entries");
  redirect("/entries");
}
