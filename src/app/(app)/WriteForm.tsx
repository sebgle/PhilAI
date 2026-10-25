"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { randomPrompt } from "@/lib/prompts";
import { WindowPlant } from "@/components/art/WindowPlant";
import { MicButton } from "./MicButton";

const join = (a: string, b: string) => (a.trim() && b ? `${a.trimEnd()} ${b}` : a.trim() ? a : b);

// The Write page from the sketch: an editable title ("New entry #N" until you
// name it), a sheet of paper with a wavy top edge and the prompt on its first
// line (↻ for another), and the night window beside it.
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
    <div className="grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex flex-col gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={`New entry #${entryNumber}`}
          aria-label="Entry title"
          className="w-full rounded-md bg-transparent px-1 -mx-1 text-3xl font-bold tracking-tight placeholder:text-foreground hover:bg-hover focus:bg-transparent focus:outline-none focus:placeholder:text-muted/50"
        />

        <div className="relative border-x border-b border-rule bg-paper pt-3 shadow-[0_1px_2px_rgb(15_15_15/0.04)]">
          <WavyEdge />
          <div className="flex items-center gap-2 border-b border-dashed border-rule px-6 pb-3 pt-4 text-[15px]">
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
            className="block min-h-[52vh] w-full resize-y bg-transparent px-6 py-4 text-[17px] leading-[1.9] placeholder:text-muted/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

      <WindowPlant className="hidden w-full text-foreground md:block md:sticky md:top-24" />
    </div>
  );
}

// The torn/wavy top edge of the sheet from the sketch.
function WavyEdge() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      className="absolute -top-[6px] left-[-1px] h-3 w-[calc(100%+2px)]"
    >
      <path
        d="M0 6 C 25 1, 45 11, 70 6 S 115 1, 140 6 S 185 11, 210 6 S 255 1, 280 6 S 325 11, 350 6 S 385 2, 400 6 L 400 12 L 0 12 Z"
        fill="var(--paper)"
      />
      <path
        d="M0 6 C 25 1, 45 11, 70 6 S 115 1, 140 6 S 185 11, 210 6 S 255 1, 280 6 S 325 11, 350 6 S 385 2, 400 6"
        fill="none"
        stroke="var(--rule)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
