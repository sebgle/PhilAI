import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addLibraryItem, removeLibraryItem } from "./actions";

const TABS = [
  { id: "passages", label: "Passages" },
  { id: "authors", label: "Authors" },
  { id: "books", label: "Books" },
  { id: "quotes", label: "Quotes" },
] as const;
type Tab = (typeof TABS)[number]["id"];

type Item = {
  id: string;
  kind: "passage" | "author" | "book" | "quote";
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
      <h1 className="text-xl font-semibold">Library</h1>
      <nav className="flex gap-1 border-b border-foreground/10 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/library?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-3 py-2 opacity-60 hover:opacity-100 aria-[current=page]:border-foreground aria-[current=page]:opacity-100"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "passages" && <Passages items={passages} />}
      {tab === "authors" && <Authors items={byKind("author")} passages={passages} />}
      {tab === "books" && (
        <HandAdded
          kind="book"
          items={byKind("book")}
          empty="Add books you love. They'll help us find passages that suit you."
          textLabel="Title"
          refLabel="Author (optional)"
        />
      )}
      {tab === "quotes" && (
        <HandAdded
          kind="quote"
          items={byKind("quote")}
          empty="Keep the lines that stay with you."
          textLabel="Quote"
          refLabel="Who said it (optional)"
        />
      )}
    </div>
  );
}

function Passages({ items }: { items: Item[] }) {
  if (!items.length) {
    return (
      <p className="opacity-70">
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
          <li key={item.id} className="rounded border border-foreground/15 p-5">
            <blockquote className="font-serif text-lg leading-relaxed">
              {hasPhrase ? (
                <>
                  {p.text.slice(0, m!.phrase_start!)}
                  <mark className="rounded bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-400/30">
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
              <span className="opacity-70">, <cite>{p.work}</cite>{p.year ? ` (${p.year})` : ""}</span>
            </p>
            {m?.line_text && (
              <p className="mt-2 text-sm opacity-70">
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
    return <p className="opacity-70">Authors whose passages you save show up here: the authors who found you.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-60">Authors who found you</p>
      <ul className="flex flex-col divide-y divide-foreground/10">
        {items.map((item) => {
          const count = passages.filter((p) => p.passage?.author === item.ref).length;
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <span className="font-medium">{item.ref}</span>
              <span className="text-sm opacity-60">
                {count} saved passage{count === 1 ? "" : "s"}
              </span>
              {/* Links to the author page once S8 lands. */}
              <span className="ml-auto"><RemoveButton id={item.id} /></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HandAdded({
  kind,
  items,
  empty,
  textLabel,
  refLabel,
}: {
  kind: "book" | "quote";
  items: Item[];
  empty: string;
  textLabel: string;
  refLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <form action={addLibraryItem} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="kind" value={kind} />
        {kind === "quote" ? (
          <textarea
            name="text"
            required
            placeholder={textLabel}
            aria-label={textLabel}
            rows={2}
            className="flex-1 rounded border border-foreground/15 bg-transparent px-3 py-2"
          />
        ) : (
          <input
            name="text"
            required
            placeholder={textLabel}
            aria-label={textLabel}
            className="flex-1 rounded border border-foreground/15 bg-transparent px-3 py-2"
          />
        )}
        <input
          name="ref"
          placeholder={refLabel}
          aria-label={refLabel}
          className="rounded border border-foreground/15 bg-transparent px-3 py-2 sm:w-48"
        />
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-background">
          Add
        </button>
      </form>

      {items.length ? (
        <ul className="flex flex-col divide-y divide-foreground/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <div className="flex-1">
                <p className={kind === "quote" ? "font-serif" : "font-medium"}>
                  {kind === "quote" ? <>&ldquo;{item.text}&rdquo;</> : item.text}
                </p>
                {item.ref && <p className="text-sm opacity-60">{kind === "quote" ? `— ${item.ref}` : item.ref}</p>}
              </div>
              <RemoveButton id={item.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="opacity-70">{empty}</p>
      )}
    </div>
  );
}

function RemoveButton({ id }: { id: string }) {
  return (
    <form action={removeLibraryItem} className="mt-3 inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm underline opacity-50 hover:opacity-100">
        Remove
      </button>
    </form>
  );
}
