"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { randomPrompt } from "@/lib/prompts";
import { MicButton } from "./MicButton";

const join = (a: string, b: string) => (a.trim() && b ? `${a.trimEnd()} ${b}` : a.trim() ? a : b);

// The Write page: an editable title ("New entry #N" until you name it), the
// text box with the prompt as its placeholder (↻ appears on hover for another),
// and at the bottom Save with the microphone beside it.
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
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder={`New entry #${entryNumber}`}
        aria-label="Entry title"
        className="-mx-1 w-full rounded-md bg-transparent px-1 text-[2rem] font-semibold tracking-tight placeholder:text-foreground hover:bg-hover/60 focus:bg-transparent focus:outline-none focus:placeholder:text-muted/50"
      />

      {/* The prompt plays the placeholder: drawn over the empty box in the
          placeholder style. Clicking the words swaps in another prompt;
          clicking anywhere else in the box starts writing. */}
      <div className="relative">
        <textarea
          value={live !== null ? join(text, live) : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={live !== null}
          placeholder={prompt ? undefined : "Write what you need to get off your chest…"}
          aria-label="Journal entry"
          aria-describedby={prompt && !text ? "prompt" : undefined}
          className="block h-[48vh] w-full resize-none overflow-y-auto bg-transparent text-[17px] leading-[1.9] placeholder:text-muted/60 focus:outline-none"
        />
        {prompt && !text && live === null && (
          <button
            id="prompt"
            type="button"
            onClick={() => setPrompt(randomPrompt(prompt))}
            title="Another prompt"
            className="absolute left-0 top-0 text-left text-[17px] leading-[1.9] text-muted/60 transition-colors hover:text-muted"
          >
            {prompt}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim() || live !== null}
          className="shrink-0 rounded-full bg-terracotta px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-deep disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <MicButton
          onLive={setLive}
          onTranscript={(t) => setText((prev) => join(prev, t))}
          // Muse's transcript replaces the live chunk if it is still there untouched; if the
          // writer already edited it, their version wins.
          onReplace={(from, to) => setText((prev) => (prev.includes(from) ? prev.replace(from, to) : prev))}
        />
        {error && <span className="truncate text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}
