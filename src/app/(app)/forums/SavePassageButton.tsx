"use client";

import { useState } from "react";
import { setPostPassageSaved } from "../library/actions";

// Bookmark on a post's passage. Optimistic, like the heart: flips at once and
// reverts if the save doesn't go through.
export function SavePassageButton({ passageId, saved: initial }: { passageId: string; saved: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    setError(false);
    const res = await setPostPassageSaved(passageId, next).catch(() => ({ error: "failed" }));
    setBusy(false);
    if (res.error) {
      setSaved(!next);
      setError(true);
    }
  }

  const label = saved ? "Saved. Click to remove from Saved" : "Save passage";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={error ? "Couldn't save that. Try again." : label}
      className={`inline-flex items-center gap-1 rounded px-1 leading-none hover:text-foreground ${
        saved ? "text-terracotta" : "text-muted"
      } ${error ? "underline decoration-red-600" : ""}`}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
