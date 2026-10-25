"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { randomPrompt } from "@/lib/prompts";
import { MicButton } from "./MicButton";

export function WriteForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  // Starts empty so server and client render the same; filled on tap.
  const [prompt, setPrompt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error } = await createClient()
      .from("entries")
      .insert({ text: text.trim(), prompt })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return setError(error.message);
    }
    router.push(`/entries/${data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        {prompt ? (
          <>
            <button
              type="button"
              onClick={() => setPrompt(randomPrompt(prompt))}
              title="Tap for another prompt"
              className="rounded-full border border-foreground/20 px-3 py-1 text-left hover:bg-foreground/5"
            >
              {prompt}
            </button>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              aria-label="Dismiss prompt"
              className="opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPrompt(randomPrompt())}
            className="rounded-full border border-dashed border-foreground/30 px-3 py-1 opacity-70 hover:opacity-100"
          >
            Need a prompt?
          </button>
        )}
      </div>

      <MicButton onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t))} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write what you need to get off your chest…"
        aria-label="Journal entry"
        className="min-h-[50vh] w-full resize-y rounded border border-foreground/15 bg-transparent p-4 leading-relaxed focus:outline-none focus:border-foreground/40"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim()}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="text-sm opacity-50">Private. Only you can see your entries.</span>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
