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
      {/* The reading column sits a little left of center on wide screens, leaving the right margin to the art. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <div className="max-w-2xl lg:ml-[6%]">{children}</div>
      </main>
      <footer className="mx-auto max-w-2xl px-4 py-5 text-center text-[11px] leading-relaxed text-muted/80">
        A reflection and community space, not therapy or emergency help. If you&apos;re in crisis in the
        US, call or text 988.
      </footer>
    </div>
  );
}
