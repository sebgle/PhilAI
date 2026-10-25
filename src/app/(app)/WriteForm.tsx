"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { randomPrompt } from "@/lib/prompts";
import { Doodle } from "@/components/Doodle";
import { MicButton } from "./MicButton";

const join = (a: string, b: string) => (a.trim() && b ? `${a.trimEnd()} ${b}` : a.trim() ? a : b);

// The Write page: an editable title ("New entry #N" until you name it), the
// prompt on a line above the text (↻ for another), and the text itself on
// plain white, Notion-style.
export function WriteForm({ entryNumber }: { entryNumber: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  // Live words while recording; shown after the typed text, read-only.
  const [live, setLive] = useState<string | null>(null);
  // Picked after mount so server and client render the same markup.
  const [prompt, setPrompt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPrompt(randomPrompt()), []);

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error } = await createClient()
      .from("entries")
      .insert({ text: text.trim(), prompt, title: title.trim() || null })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return setError(error.message);
    }
    router.push(`/entries/${data.id}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={`New entry #${entryNumber}`}
          aria-label="Entry title"
          className="-mx-1 w-full min-w-0 rounded-md bg-transparent px-1 text-3xl font-bold tracking-tight placeholder:text-foreground hover:bg-hover focus:bg-transparent focus:outline-none focus:placeholder:text-muted/50"
        />
        <Doodle name="leaf" className="mt-1 h-10 w-10 shrink-0 text-foreground/15" />
      </div>

      <div className="flex items-center gap-2 border-b border-rule pb-3 text-[15px]">
        {prompt ? (
          <>
            <span className="italic text-muted">{prompt}</span>
            <button
              type="button"
              onClick={() => setPrompt(randomPrompt(prompt))}
              aria-label="Another prompt"
              title="Another prompt"
              className="rounded p-1 text-muted hover:bg-hover hover:text-foreground"
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              aria-label="No prompt"
              title="No prompt"
              className="ml-auto rounded px-1.5 text-muted hover:bg-hover hover:text-foreground"
            >
              ×
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setPrompt(randomPrompt())} className="text-muted hover:text-foreground">
            Need a prompt?
          </button>
        )}
      </div>

      <textarea
        value={live !== null ? join(text, live) : text}
        onChange={(e) => setText(e.target.value)}
        readOnly={live !== null}
        placeholder="Write what you need to get off your chest…"
        aria-label="Journal entry"
        className="block min-h-[50vh] w-full resize-y bg-transparent py-2 text-[17px] leading-[1.9] placeholder:text-muted/60 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim() || live !== null}
          className="rounded-md bg-[#2383e2] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save entry"}
        </button>
        <MicButton onLive={setLive} onTranscript={(t) => setText((prev) => join(prev, t))} />
        <span className="text-sm text-muted">Private. Only you can see your entries.</span>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
