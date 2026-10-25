"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_REPLY } from "@/lib/forum";

// Every post ends in an always-open reply box, like a comment field. "Reply"
// on a reply doesn't open a box of its own: it points this one at that reply.
type Target = { id: string; alias: string } | null;
const ReplyContext = createContext<{ replyTo: (t: Target) => void; target: Target; field: React.RefObject<HTMLTextAreaElement | null> } | null>(null);

export function ReplyThread({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  function replyTo(t: Target) {
    setTarget(t);
    field.current?.focus();
  }
  return <ReplyContext.Provider value={{ replyTo, target, field }}>{children}</ReplyContext.Provider>;
}

// The small "Reply" link under each reply.
export function ReplyButton({ id, alias }: { id: string; alias: string }) {
  const ctx = useContext(ReplyContext);
  return (
    <button type="button" onClick={() => ctx?.replyTo({ id, alias })} className="text-xs text-muted hover:text-foreground">
      Reply
    </button>
  );
}

export function ReplyComposer({ postId }: { postId: string }) {
  const router = useRouter();
  const ctx = useContext(ReplyContext);
  const target = ctx?.target ?? null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, text, ...(target ? { parent_id: target.id } : {}) }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Couldn't post your reply.");
    }
    setText("");
    ctx?.replyTo(null);
    ctx?.field.current?.blur();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="border-t border-rule px-5 py-3">
      {target && (
        <p className="mb-1.5 flex items-center gap-2 text-xs text-muted">
          Replying to {target.alias}
          <button type="button" onClick={() => ctx?.replyTo(null)} aria-label="Stop replying to them" className="hover:text-foreground">
            ×
          </button>
        </p>
      )}
      <div className="flex items-end gap-3">
        <textarea
          ref={ctx?.field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enter posts, Shift+Enter starts a new line.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={MAX_REPLY}
          rows={1}
          aria-label={target ? `Your reply to ${target.alias}` : "Your reply"}
          placeholder={target ? `Reply to ${target.alias}…` : "Add a reply… you'll get a name for this thread"}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm outline-none [field-sizing:content] placeholder:text-muted/80"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 py-1 text-sm font-semibold text-terracotta hover:text-terracotta-deep disabled:opacity-40"
        >
          {busy ? "Checking…" : "Post"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
}
