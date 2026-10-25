"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Writes to posts are server-only, so this goes through the admin client,
// scoped to the signed-in user so no one can delete a post that isn't theirs.
// Replies, likes, aliases and reports on the post go with it (on delete cascade).
export async function deletePost(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const { error } = await createAdminClient().from("posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath("/");
  return { error: null };
}
