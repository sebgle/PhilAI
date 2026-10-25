import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Step 0 smoke test: show the random handle the on_auth_user_created trigger
// assigned. Replaced by the Write screen in slice 1.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("users").select("handle").eq("id", user.id).single();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold">PhilAI</h1>
      <p>You are {data?.handle ?? "…"}</p>
      <form action={signOut}>
        <button type="submit" className="text-sm underline opacity-70">Log out</button>
      </form>
      <p className="text-sm opacity-60">
        A reflection and community space, not therapy or emergency help.
      </p>
    </main>
  );
}
