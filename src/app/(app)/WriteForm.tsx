"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { randomPrompt } from "@/lib/prompts";
import { MicButton } from "./MicButton";

const join = (a: string, b: string) => (a.trim() && b ? `${a.trimEnd()} ${b}` : a.trim() ? a : b);

// The Write page: an editable title ("New entry #N" until you name it), the
// prompt under it with ↻ for another, the text on the cream surface, and at
// the bottom Save with the microphone beside it.
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
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={`New entry #${entryNumber}`}
          aria-label="Entry title"
          className="-mx-1 w-full rounded-md bg-transparent px-1 text-[2rem] font-semibold tracking-tight placeholder:text-foreground hover:bg-hover/60 focus:bg-transparent focus:outline-none focus:placeholder:text-muted/50"
        />
        <div className="flex items-center gap-2 text-[15px] text-muted">
          {prompt ? (
            <>
              <span className="italic">{prompt}</span>
              <button
                type="button"
                onClick={() => setPrompt(randomPrompt(prompt))}
                aria-label="Another prompt"
                title="Another prompt"
                className="rounded-md p-1 transition-colors hover:bg-hover hover:text-foreground"
              >
                <RefreshIcon />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setPrompt(randomPrompt())} className="italic hover:text-foreground">
              Need a prompt?
            </button>
          )}
        </div>
      </div>

      <textarea
        value={live !== null ? join(text, live) : text}
        onChange={(e) => setText(e.target.value)}
        readOnly={live !== null}
        placeholder="Write what you need to get off your chest…"
        aria-label="Journal entry"
        className="block min-h-[48vh] w-full resize-y bg-transparent text-[17px] leading-[1.9] placeholder:text-muted/60 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim() || live !== null}
          className="rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-deep disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <MicButton onLive={setLive} onTranscript={(t) => setText((prev) => join(prev, t))} />
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
