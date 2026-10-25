import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { LocalDate } from "@/components/LocalDate";
import { ThemeIcon } from "@/components/ThemeIcon";
import { DeleteAccount } from "./DeleteAccount";
import { DeletePost } from "./DeletePost";
import { signOut } from "../../actions";
import { PageTitle } from "@/components/PageTitle";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("handle").eq("id", user!.id).single();
  // posts.user_id is never readable by clients, so your own posts come through
  // the admin client, filtered to you here on the server. Only visible ones:
  // a post moderation took down doesn't come back through the history.
  const { data: postRows } = await createAdminClient()
    .from("posts")
    .select("id, forum_id, line_text, created_at, passage:passages(author, work)")
    .eq("user_id", user!.id)
    .eq("status", "visible")
    .order("created_at", { ascending: false });
  const posts = (postRows ?? []) as unknown as {
    id: string; forum_id: string; line_text: string; created_at: string; passage: { author: string; work: string } | null;
  }[];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <PageTitle title="Your account" />
        <p>
          You are <span className="font-medium">{profile?.handle}</span>. Only you see this name. In the
          forums you get a fresh one in every thread.
        </p>
        <p className="text-sm text-muted">
          Your email ({user!.email}) is used only to log in. It&apos;s never shown to anyone.
        </p>
        <form action={signOut}>
          <button type="submit" className="mt-2 rounded-md border border-rule px-3 py-1.5 text-sm hover:bg-hover">
            Log out
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Your posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing shared yet. When you post a line to a room from one of your entries, it shows up here.
          </p>
        ) : (
          <ul className="flex flex-col">
            {posts.map((p) => {
              const room = THEMES.find((t) => t.slug === p.forum_id);
              return (
                <li key={p.id} className="group relative border-t border-rule">
                  <Link
                    href={`/posts/${p.id}`}
                    scroll={false}
                    className="-mx-3 block rounded-lg py-4 pl-3 pr-12 transition-colors hover:bg-card hover:shadow-sm hover:ring-1 hover:ring-rule"
                  >
                    <p className="line-clamp-2 font-serif leading-snug">&ldquo;{p.line_text}&rdquo;</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted transition-colors group-hover:text-foreground/80">
                      {room && (
                        <>
                          <ThemeIcon slug={room.slug} className="size-3.5 text-terracotta" />
                          <span>{room.name}</span>
                          <span>·</span>
                        </>
                      )}
                      <LocalDate iso={p.created_at} />
                      {p.passage && (
                        <>
                          <span>·</span>
                          <span>
                            {p.passage.author}, <cite>{p.passage.work}</cite>
                          </span>
                        </>
                      )}
                    </p>
                  </Link>
                  <div className="absolute right-0 top-3">
                    <DeletePost id={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded border border-red-500/30 p-5">
        <h2 className="font-medium">Delete your account</h2>
        <p className="text-sm opacity-80">
          This permanently removes your entries, matches, library, and everything you&apos;ve posted or
          replied in the forums. It can&apos;t be undone.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
