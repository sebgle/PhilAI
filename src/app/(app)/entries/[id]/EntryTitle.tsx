"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Click the heading to rename the entry; saves on blur or Enter, Escape
// cancels. An empty title falls back to "Entry #N".
export function EntryTitle({ entryId, initial, fallback }: { entryId: string; initial: string | null; fallback: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial ?? "");
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const next = value.trim();
    if (next === saved) return;
    const { error } = await createClient()
      .from("entries")
      .update({ title: next || null })
      .eq("id", entryId);
    if (error) {
      setValue(saved);
      return setError("Couldn't rename this entry. Try again.");
    }
    setError(null);
    setSaved(next);
    setValue(next);
    router.refresh();
  }

  return (
    <div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(saved);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        maxLength={120}
        placeholder={fallback}
        aria-label="Entry title"
        title="Click to rename"
        className="-mx-1 w-full rounded-md bg-transparent px-1 text-3xl font-bold tracking-tight placeholder:text-foreground hover:bg-hover focus:bg-transparent focus:outline-none focus:placeholder:text-muted/50"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
