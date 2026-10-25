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
      <header className="border-b border-rule">
        <nav className="mx-auto flex max-w-2xl flex-wrap items-baseline gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/" className="font-serif text-lg italic">PhilAI</Link>
          <Link href="/" className="text-muted hover:text-foreground">Write</Link>
          <Link href="/entries" className="text-muted hover:text-foreground">Past entries</Link>
          <Link href="/library" className="text-muted hover:text-foreground">Library</Link>
          <Link href="/forums" className="text-muted hover:text-foreground">Forums</Link>
          <span className="ml-auto flex items-baseline gap-4">
            <Link href="/account" title="Your account" className="text-muted hover:text-foreground">
              {data?.handle}
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-muted underline hover:text-foreground">Log out</button>
            </form>
          </span>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 py-6 text-xs text-muted">
        A reflection and community space, not therapy or emergency help. If you&apos;re in crisis in the
        US, call or text 988.
      </footer>
    </div>
  );
}
