"use client";

import { useState, useTransition } from "react";
import { deletePost } from "./actions";

// The trash can shows on hover, like in Saved. Deleting also takes the
// replies other people left, so the first click asks before anything goes.
export function DeletePost({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (asking) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-card py-1 pl-3 pr-1 text-xs shadow-sm ring-1 ring-rule">
        <span className="text-muted">{error ?? "Delete post and its replies?"}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deletePost(id);
              if (res.error) setError(res.error);
            })
          }
          className="rounded-md bg-terracotta px-2.5 py-1 font-medium text-white hover:bg-terracotta-deep disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAsking(false);
            setError(null);
          }}
          className="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      aria-label="Delete post"
      title="Delete post"
      className="rounded-md p-1.5 text-muted opacity-0 transition hover:bg-[var(--hl-3)] hover:text-terracotta-deep focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}
