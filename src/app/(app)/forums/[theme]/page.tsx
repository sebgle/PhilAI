import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/lib/contract";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ThemeIcon } from "@/components/ThemeIcon";
import { PostCard, POST_COLUMNS, loadThreads, type Post } from "../PostCard";

export default async function ThemeForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ author?: string }>;
}) {
  const { theme: slug } = await params;
  const { author } = await searchParams;
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("forum_id", slug)
    .order("created_at", { ascending: false });
  const allPosts = (data ?? []) as unknown as Post[];

  const authors = [...new Set(allPosts.map((p) => p.passage.author))].sort();
  const posts = author ? allPosts.filter((p) => p.passage.author === author) : allPosts;
  const thread = await loadThreads(supabase, posts);

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <Breadcrumb href="/forums" label="Community" />
        <h1 className="mt-1 flex items-center gap-2.5 text-[2rem] font-semibold tracking-tight">
          {theme.name}
          <ThemeIcon slug={theme.slug} className="size-7 text-terracotta" />
        </h1>
        <p className="mt-1 text-sm text-muted">{theme.description}</p>
      </div>

      {authors.length > 1 && (
        <nav aria-label="Filter by author" className="flex flex-wrap gap-2 text-sm">
          <FilterChip href={`/forums/${slug}`} active={!author}>All authors</FilterChip>
          {authors.map((a) => (
            <FilterChip key={a} href={`/forums/${slug}?author=${encodeURIComponent(a)}`} active={author === a}>
              {a}
            </FilterChip>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <p className="text-muted">
          {author
            ? `No posts linked to ${author} here yet.`
            : "No one has shared here yet. When a line of yours lands in this theme, share it from its passage card."}
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} thread={thread} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full border border-rule px-3 py-1 text-muted hover:text-foreground aria-[current=page]:bg-hover aria-[current=page]:text-foreground"
    >
      {children}
    </Link>
  );
}
