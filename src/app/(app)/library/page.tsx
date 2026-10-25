import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { removeLibraryItem } from "./actions";
import { PageTitle } from "@/components/PageTitle";

// Everything here arrived through matching: passages the reader saved, and
// the authors those passages came from. Nothing is added by hand.
const TABS = [
  { id: "passages", label: "Passages" },
  { id: "authors", label: "Authors" },
] as const;
type Tab = (typeof TABS)[number]["id"];

type Item = {
  id: string;
  kind: "passage" | "author";
  ref: string | null;
  text: string | null;
  passage: { id: string; author: string; work: string; year: number | null; text: string } | null;
  match: { line_text: string | null; phrase_start: number | null; phrase_end: number | null } | null;
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "passages";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_items")
    .select(
      "id, kind, ref, text, passage:passages(id, author, work, year, text), match:matches(line_text, phrase_start, phrase_end)",
    )
    .order("created_at", { ascending: false });
  if (error) return <p className="text-red-600">{error.message}</p>;

  const items = (data ?? []) as unknown as Item[];
  const byKind = (k: Item["kind"]) => items.filter((i) => i.kind === k);
  const passages = byKind("passage");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Saved" />
      <nav className="flex gap-1 border-b border-rule text-sm">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/library?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-muted hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:opacity-100"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "passages" && <Passages items={passages} />}
      {tab === "authors" && <Authors items={byKind("author")} passages={passages} />}
    </div>
  );
}

function Passages({ items }: { items: Item[] }) {
  if (!items.length) {
    return (
      <p className="text-muted">
        No saved passages yet. When a passage hits, tap Save on its card and it lands here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const p = item.passage!;
        const m = item.match;
        const hasPhrase =
          m?.phrase_start != null && m.phrase_end != null && m.phrase_start < m.phrase_end && m.phrase_end <= p.text.length;
        return (
          <li key={item.id} className="rounded-lg border border-rule bg-card p-5">
            <blockquote className="font-serif text-lg leading-relaxed">
              {hasPhrase ? (
                <>
                  {p.text.slice(0, m!.phrase_start!)}
                  <mark className="rounded-sm bg-[var(--hl-1)] px-0.5 text-inherit">
                    {p.text.slice(m!.phrase_start!, m!.phrase_end!)}
                  </mark>
                  {p.text.slice(m!.phrase_end!)}
                </>
              ) : (
                p.text
              )}
            </blockquote>
            <p className="mt-3 text-sm">
              <span className="font-medium">{p.author}</span>
              <span className="text-muted">, <cite>{p.work}</cite>{p.year ? ` (${p.year})` : ""}</span>
            </p>
            {m?.line_text && (
              <p className="mt-2 text-sm text-muted">
                Your line: <span className="italic">&ldquo;{m.line_text}&rdquo;</span>
              </p>
            )}
            <RemoveButton id={item.id} />
          </li>
        );
      })}
    </ul>
  );
}

function Authors({ items, passages }: { items: Item[]; passages: Item[] }) {
  if (!items.length) {
    return <p className="text-muted">Authors whose passages you save show up here: the authors who found you.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Authors who found you</p>
      <ul className="flex flex-col divide-y divide-rule">
        {items.map((item) => {
          const count = passages.filter((p) => p.passage?.author === item.ref).length;
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <Link href={`/authors/${encodeURIComponent(item.ref ?? "")}`} className="font-medium underline-offset-2 hover:underline">{item.ref}</Link>
              <span className="text-sm text-muted">
                {count} saved passage{count === 1 ? "" : "s"}
              </span>
              <span className="ml-auto"><RemoveButton id={item.id} /></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RemoveButton({ id }: { id: string }) {
  return (
    <form action={removeLibraryItem} className="mt-3 inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm underline opacity-50 hover:text-foreground">
        Remove
      </button>
    </form>
  );
}
