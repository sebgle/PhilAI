import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

// Shell for every signed-in screen.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("users").select("handle").eq("id", user.id).single();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-foreground/10">
        <nav className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold">PhilAI</Link>
          <Link href="/" className="opacity-70 hover:opacity-100">Write</Link>
          <Link href="/entries" className="opacity-70 hover:opacity-100">Past entries</Link>
          <Link href="/library" className="opacity-70 hover:opacity-100">Library</Link>
          <span className="ml-auto opacity-60">{data?.handle}</span>
          <form action={signOut}>
            <button type="submit" className="underline opacity-60 hover:opacity-100">Log out</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 py-6 text-xs opacity-50">
        A reflection and community space, not therapy or emergency help.
      </footer>
    </div>
  );
}
