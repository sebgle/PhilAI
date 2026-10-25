"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEntry, updateEntryText } from "./actions";

// The date row with Edit and Delete, then either the entry and its passages
// (children) or the editor. Saving new text sends the page back through
// matching, so the passages follow what the entry now says.
export function EntryBody({ entryId, text, date, children }: { entryId: string; text: string; date: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (draft.trim() === text.trim()) return setEditing(false);
    start(async () => {
      const res = await updateEntryText(entryId, draft);
      if (res.error) return setError(res.error);
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteEntry(entryId);
      if (res?.error) setError(res.error);
    });
  }

  const quiet = "rounded-md px-2 py-1 text-muted transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50";

  return (
    <>
      {/* Pulled up under the title the way the date sat before. */}
      <div className="-mt-3 flex min-h-8 items-center justify-between gap-3 text-sm">
        <span className="text-muted">{date}</span>
        {!editing && (
          confirming ? (
            <span className="flex items-center gap-1">
              <span className="mr-1 text-muted">Delete this entry?</span>
              <button type="button" onClick={remove} disabled={pending} className="rounded-md bg-terracotta px-2.5 py-1 font-medium text-white hover:bg-terracotta-deep disabled:opacity-60">
                {pending ? "Deleting…" : "Delete"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={quiet}>Cancel</button>
            </span>
          ) : (
            <span className="flex items-center gap-0.5">
              <button type="button" onClick={() => { setDraft(text); setEditing(true); }} className={quiet}>
                Edit
              </button>
              <button type="button" onClick={() => setConfirming(true)} aria-label="Delete entry" title="Delete entry" className={`${quiet} hover:bg-[var(--hl-3)] hover:text-terracotta-deep`}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
              </button>
            </span>
          )
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            aria-label="Entry text"
            className="min-h-48 w-full rounded-lg border border-rule bg-card p-4 leading-relaxed [field-sizing:content]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={pending || !draft.trim()} className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-white hover:bg-terracotta-deep disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={pending} className={`${quiet} text-sm`}>Cancel</button>
            <span className="text-xs text-muted">Saving finds new passages for what you wrote.</span>
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
