import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { PageTitle } from "@/components/PageTitle";
import { ThemeIcon } from "@/components/ThemeIcon";

export default async function ForumsPage() {
  const supabase = await createClient();
  // RLS returns only visible posts; column grants mean columns are listed explicitly.
  const { data: posts } = await supabase.from("posts").select("forum_id");
  const counts = new Map<string, number>();
  for (const p of posts ?? []) counts.set(p.forum_id, (counts.get(p.forum_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Community" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const n = counts.get(t.slug) ?? 0;
          return (
            <li key={t.slug}>
              <Link
                href={`/forums/${t.slug}`}
                className="block h-full rounded-lg border border-rule bg-card p-4 transition-colors hover:bg-hover"
              >
                <div className="flex h-full items-center justify-between gap-6">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-muted">
                      {n} post{n === 1 ? "" : "s"}
                    </span>
                    <p className="mt-1 text-sm text-muted">{t.description}</p>
                  </div>
                  <ThemeIcon slug={t.slug} className="size-6 text-terracotta" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
