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
      <PageTitle
        title="Community"
        subtitle="Pick the room closest to how you feel. You get a new name in every thread, so no one knows it's you."
      />
      {/* Two ruled columns, no boxes: each room is a row with a hairline above,
          the way the Entries list reads. The icon sits at the right edge. */}
      <ul className="grid sm:grid-cols-2 sm:gap-x-10">
        {THEMES.map((t) => {
          const n = counts.get(t.slug) ?? 0;
          return (
            <li key={t.slug} className="border-t border-rule">
              <Link
                href={`/forums/${t.slug}`}
                className="-mx-3 flex items-center justify-between gap-6 rounded-lg px-3 py-4 transition-colors hover:bg-hover"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.name}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {n} post{n === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{t.description}</p>
                </div>
                <ThemeIcon slug={t.slug} className="size-5 shrink-0 text-terracotta/80" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
