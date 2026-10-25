"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_REPLY } from "@/lib/forum";

// Reply to a post, or to another reply in the same thread when parentId is set.
// Closed, it is a small "Reply" link that fits in a meta row; open, it takes
// the full row (basis-full) so the textarea has room.
export function ReplyForm({
  postId,
  parentId,
  parentAlias,
}: {
  postId: string;
  parentId?: string;
  parentAlias?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`underline text-muted hover:text-foreground ${parentId ? "text-xs" : "text-sm"}`}
      >
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
      body: JSON.stringify({ post_id: postId, text, ...(parentId ? { parent_id: parentId } : {}) }),
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
    <form onSubmit={submit} className="flex basis-full flex-col gap-2 pt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_REPLY}
        required
        rows={3}
        autoFocus
        aria-label={parentAlias ? `Your reply to ${parentAlias}` : "Your reply"}
        placeholder={
          parentAlias
            ? `Reply to ${parentAlias}. You keep one name for this thread.`
            : "Reply anonymously. You'll get a name for this thread."
        }
        className="w-full rounded border border-rule bg-transparent p-2 text-sm"
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-terracotta px-3 py-1 text-white hover:bg-terracotta-deep disabled:opacity-40"
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
