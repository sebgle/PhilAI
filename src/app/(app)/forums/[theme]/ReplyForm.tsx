"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_REPLY } from "@/lib/forum";

export function ReplyForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline text-muted hover:text-foreground">
        Reply
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, text }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Couldn't post your reply.");
    }
    setText("");
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_REPLY}
        required
        rows={3}
        autoFocus
        aria-label="Your reply"
        placeholder="Reply anonymously. You'll get a name for this thread."
        className="w-full rounded border border-rule bg-transparent p-2 text-sm"
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded bg-[#2383e2] px-3 py-1 text-white disabled:opacity-40"
        >
          {busy ? "Checking…" : "Post reply"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
          Cancel
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </form>
  );
}
