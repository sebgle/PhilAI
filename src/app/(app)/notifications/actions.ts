"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markRepliesSeen } from "@/lib/notifications";

export async function markSeen() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await markRepliesSeen(user.id);
  // Clears the bell badge in the shared layout.
  revalidatePath("/", "layout");
}
