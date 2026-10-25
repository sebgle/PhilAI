import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unreadReplyCount } from "@/lib/notifications";
import { TopNav } from "@/components/TopNav";

// Shell for every signed-in screen: one reading column. Log out lives on the
// account page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, unread] = await Promise.all([
    supabase.from("users").select("handle").eq("id", user.id).single(),
    unreadReplyCount(user.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav handle={data?.handle ?? ""} unread={unread} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 py-6 text-center text-xs text-muted">
        A reflection and community space, not therapy or emergency help. If you&apos;re in crisis in the
        US, call or text 988.
      </footer>
    </div>
  );
}
