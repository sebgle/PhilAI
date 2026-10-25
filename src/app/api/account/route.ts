// S11: DELETE /api/account. Delete means delete: removing the auth user
// cascades to users, entries, matches, library_items, posts, replies and
// thread_aliases; reports they filed keep the report but lose the reporter.
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed:", error.message);
    return NextResponse.json({ error: "Couldn't delete your account. Try again." }, { status: 500 });
  }

  // The session belongs to a user that no longer exists; clear its cookies.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
